using System.Globalization;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The statement set, bilingual, from posted journal lines only.
///
/// Classification follows the account code, as every other report here:
/// 1-11 cash and cash equivalents, 1-1 current assets, other 1 non-current
/// assets; 2-1 current liabilities, other 2 non-current; 3 equity; 4
/// revenue; 5 cost of revenue; 6 operating expenses; 7 other income; 8 and
/// 9 other expenses, with 8-5000 as income tax expense.
///
/// Profit is never closed into equity by the ledger, so the statement of
/// financial position carries it: profit before the start of the fiscal
/// year in retained earnings, profit since in profit for the year.
///
/// The cash flow statement uses the indirect method over every non-cash
/// account, so it reconciles to the cash accounts by construction; the
/// check printed on it proves that rather than assumes it.
/// </summary>
public class FinancialStatementsService
{
    private const string RetainedEarningsCode = "3-2000";
    private const string CurrentYearEarningsCode = "3-3000";
    private const string IncomeTaxCode = "8-5000";

    private static readonly CultureInfo Id = new("id-ID");
    private static readonly CultureInfo En = new("en-US");

    private readonly ApplicationDbContext _context;

    public FinancialStatementsService(ApplicationDbContext context)
    {
        _context = context;
    }

    private enum Class
    {
        Cash, CurrentAsset, NonCurrentAsset, CurrentLiability, NonCurrentLiability, Equity,
        Revenue, CostOfRevenue, OperatingExpense, OtherIncome, OtherExpense, IncomeTax,
    }

    private sealed record Acct(string Code, string NameEn, string NameId, Class Class, bool CreditNormal);

    private sealed record Line(string Code, DateOnly Date, decimal Debit, decimal Credit);

    public async Task<FinancialStatementPack> BuildAsync(Guid companyId, DateOnly start, DateOnly end, bool comparative, string? generatedBy)
    {
        if (end < start)
            throw new System.ComponentModel.DataAnnotations.ValidationException("The period end is before its start.");

        var company = await _context.Companies.AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => new { c.Name, c.Address, c.City, c.TaxId, c.Currency, c.FiscalYearStartMonth })
            .FirstAsync();

        var accounts = (await _context.Accounts.AsNoTracking()
                .Where(a => a.CompanyId == companyId)
                .Select(a => new { a.Code, a.Name, a.NameId, a.NormalBalance })
                .ToListAsync())
            .GroupBy(a => a.Code)
            .ToDictionary(g => g.Key, g =>
            {
                var a = g.First();
                return new Acct(a.Code, a.Name, string.IsNullOrWhiteSpace(a.NameId) ? a.Name : a.NameId,
                    Classify(a.Code), string.Equals(a.NormalBalance, "Credit", StringComparison.OrdinalIgnoreCase));
            });

        // Summed here rather than in SQL: SQLite stores decimal(19,4) as REAL
        // and would add floats. A statement that is out by 1e-9 is out.
        var lines = await _context.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && l.JournalEntry.Date <= end)
            .Select(l => new Line(l.AccountId, l.JournalEntry!.Date, l.Debit, l.Credit))
            .ToListAsync();

        // A line on a code with no account still belongs in the statements;
        // dropping it would unbalance them silently.
        foreach (var code in lines.Select(l => l.Code).Distinct().Where(c => !accounts.ContainsKey(c)))
        {
            accounts[code] = new Acct(code, $"Unknown account {code}", $"Akun tidak dikenal {code}", Classify(code), false);
        }

        var cur = new Period(start, end, FiscalYearStart(end, company.FiscalYearStartMonth));
        var prior = comparative
            ? new Period(start.AddYears(-1), end.AddYears(-1), FiscalYearStart(end.AddYears(-1), company.FiscalYearStartMonth))
            : null;

        var ctx = new Calc(accounts, lines, cur, prior);

        var pack = new FinancialStatementPack
        {
            CompanyName = company.Name,
            CompanyAddress = string.Join(", ", new[] { company.Address, company.City }.Where(s => !string.IsNullOrWhiteSpace(s))),
            CompanyTaxId = company.TaxId,
            Currency = company.Currency,
            PeriodStart = start,
            PeriodEnd = end,
            Comparative = comparative,
            PriorStart = prior?.Start,
            PriorEnd = prior?.End,
            ColumnCurrent = end.Year.ToString(CultureInfo.InvariantCulture),
            ColumnPrior = prior?.End.Year.ToString(CultureInfo.InvariantCulture),
            GeneratedAt = DateTime.UtcNow,
            GeneratedBy = generatedBy,
        };

        if (string.IsNullOrWhiteSpace(pack.CompanyAddress)) pack.CompanyAddress = null;

        var fullYear = start == cur.FiscalYearStart && end == cur.FiscalYearStart.AddYears(1).AddDays(-1);

        pack.Statements.Add(PositionStatement(ctx, end, prior?.End));
        pack.Statements.Add(ProfitOrLoss(ctx, start, end, fullYear));
        pack.Statements.Add(ChangesInEquity(ctx, start, end, fullYear));
        pack.Statements.Add(CashFlows(ctx, start, end, fullYear));
        pack.Statements.Add(TrialBalance(ctx, end));

        pack.HasFractions = pack.Statements
            .SelectMany(s => s.Lines)
            .SelectMany(l => new[] { l.Current, l.Prior, l.Credit })
            .Any(v => v.HasValue && v.Value != decimal.Truncate(v.Value));

        return pack;
    }

    // ── statements ────────────────────────────────────────────────────

    private static FinancialStatement PositionStatement(Calc c, DateOnly end, DateOnly? priorEnd)
    {
        var s = new FinancialStatement
        {
            Key = "sofp",
            TitleId = "Laporan Posisi Keuangan",
            TitleEn = "Statement of Financial Position",
            BasisId = priorEnd is null ? $"Per {DateId(end)}" : $"Per {DateId(end)} dan {priorEnd.Value.Year}",
            BasisEn = priorEnd is null ? $"As of {DateEn(end)}" : $"As of {DateEn(end)} and {priorEnd.Value.Year}",
        };

        var b = new Builder(s, c);

        // Assets read as debit balances, liabilities and equity as credit.
        (decimal, decimal?) Debit(string code) => (c.Cur.Balance(code), c.Prior?.Balance(code));
        (decimal, decimal?) Credit(string code) => Neg(Debit(code));

        b.Section("ASET", "ASSETS");
        var cash = b.Group("Aset lancar", "Current assets", c.Codes(Class.Cash, Class.CurrentAsset), Debit,
            "Jumlah aset lancar", "Total current assets");
        var nonCurrent = b.Group("Aset tidak lancar", "Non-current assets", c.Codes(Class.NonCurrentAsset), Debit,
            "Jumlah aset tidak lancar", "Total non-current assets");
        var assets = Add(cash, nonCurrent);
        b.Total("JUMLAH ASET", "TOTAL ASSETS", assets);

        b.Section("LIABILITAS DAN EKUITAS", "LIABILITIES AND EQUITY");
        var currentLiab = b.Group("Liabilitas jangka pendek", "Current liabilities", c.Codes(Class.CurrentLiability), Credit,
            "Jumlah liabilitas jangka pendek", "Total current liabilities");
        var nonCurrentLiab = b.Group("Liabilitas jangka panjang", "Non-current liabilities", c.Codes(Class.NonCurrentLiability), Credit,
            "Jumlah liabilitas jangka panjang", "Total non-current liabilities");
        var liabilities = Add(currentLiab, nonCurrentLiab);
        b.Subtotal("Jumlah liabilitas", "Total liabilities", liabilities, 0);

        // Equity: recorded balances, with unclosed profit placed in retained
        // earnings (before the fiscal year) and profit for the year (since).
        b.Heading("Ekuitas", "Equity");
        var retained = (c.Cur.ProfitBefore(c.Cur.FiscalYearStart), c.Prior?.ProfitBefore(c.Prior.FiscalYearStart));
        var forYear = (c.Cur.ProfitBetween(c.Cur.FiscalYearStart, c.Cur.End),
                       c.Prior is null ? (decimal?)null : c.Prior.ProfitBetween(c.Prior.FiscalYearStart, c.Prior.End));

        var equity = ((decimal)0, c.HasPrior ? 0m : (decimal?)null);
        var placedRetained = false;
        var placedYear = false;
        foreach (var code in c.Codes(Class.Equity))
        {
            var v = Credit(code);
            if (code == RetainedEarningsCode) { v = Add(v, retained); placedRetained = true; }
            if (code == CurrentYearEarningsCode) { v = Add(v, forYear); placedYear = true; }
            if (IsZero(v)) continue;
            b.Item(c.Accounts[code], v);
            equity = Add(equity, v);
        }
        if (!placedRetained && !IsZero(retained))
        {
            b.Item("Saldo laba", "Retained earnings", null, retained);
            equity = Add(equity, retained);
        }
        if (!placedYear && !IsZero(forYear))
        {
            b.Item("Laba (rugi) tahun berjalan", "Profit (loss) for the year", null, forYear);
            equity = Add(equity, forYear);
        }
        b.Subtotal("Jumlah ekuitas", "Total equity", equity, 0);

        var liabEquity = Add(liabilities, equity);
        b.Total("JUMLAH LIABILITAS DAN EKUITAS", "TOTAL LIABILITIES AND EQUITY", liabEquity);

        s.Checks.Add(Check("Jumlah aset sama dengan jumlah liabilitas dan ekuitas",
            "Total assets equal total liabilities and equity", assets, liabEquity));
        return s;
    }

    private static FinancialStatement ProfitOrLoss(Calc c, DateOnly start, DateOnly end, bool fullYear)
    {
        var s = new FinancialStatement
        {
            Key = "pl",
            TitleId = "Laporan Laba Rugi dan Penghasilan Komprehensif Lain",
            TitleEn = "Statement of Profit or Loss and Other Comprehensive Income",
            BasisId = PeriodId(start, end, fullYear),
            BasisEn = PeriodEn(start, end, fullYear),
        };
        var b = new Builder(s, c);
        var periodWord = fullYear ? ("tahun berjalan", "the year") : ("periode berjalan", "the period");

        // Every figure is credit minus debit: income positive, cost negative.
        (decimal, decimal?) Pl(string code) => (-c.Cur.Movement(code), c.Prior is null ? null : -c.Prior.Movement(code));

        var revenue = b.Group("Pendapatan", "Revenue", c.Codes(Class.Revenue), Pl, "Jumlah pendapatan", "Total revenue");
        var cost = b.Group("Beban pokok pendapatan", "Cost of revenue", c.Codes(Class.CostOfRevenue), Pl, "Jumlah beban pokok pendapatan", "Total cost of revenue");
        var gross = Add(revenue, cost);
        b.Subtotal("LABA BRUTO", "GROSS PROFIT", gross, 0);

        var opex = b.Group("Beban usaha", "Operating expenses", c.Codes(Class.OperatingExpense), Pl, "Jumlah beban usaha", "Total operating expenses");
        var operating = Add(gross, opex);
        b.Subtotal("LABA USAHA", "OPERATING PROFIT", operating, 0);

        var other = b.Group("Pendapatan (beban) lain-lain", "Other income (expenses)", c.Codes(Class.OtherIncome, Class.OtherExpense), Pl,
            "Jumlah pendapatan (beban) lain-lain", "Total other income (expenses)");
        var beforeTax = Add(operating, other);
        b.Subtotal("LABA SEBELUM PAJAK PENGHASILAN", "PROFIT BEFORE INCOME TAX", beforeTax, 0);

        var tax = (0m, c.HasPrior ? 0m : (decimal?)null);
        foreach (var code in c.Codes(Class.IncomeTax))
        {
            var v = Pl(code);
            if (IsZero(v)) continue;
            b.Item("Beban pajak penghasilan", "Income tax expense", code, v, 0);
            tax = Add(tax, v);
        }

        var profit = Add(beforeTax, tax);
        b.Subtotal($"LABA (RUGI) {periodWord.Item1.ToUpperInvariant()}", $"PROFIT (LOSS) FOR {periodWord.Item2.ToUpperInvariant()}", profit, 0);

        b.Heading("Penghasilan komprehensif lain", "Other comprehensive income");
        b.Item("Pos yang tidak akan direklasifikasi ke laba rugi", "Items that will not be reclassified to profit or loss", null,
            (0m, c.HasPrior ? 0m : null));
        b.Total($"JUMLAH PENGHASILAN KOMPREHENSIF {periodWord.Item1.ToUpperInvariant()}",
            $"TOTAL COMPREHENSIVE INCOME FOR {periodWord.Item2.ToUpperInvariant()}", profit);

        var expected = (c.Cur.ProfitBetween(start, end), c.Prior?.ProfitBetween(c.Prior.Start, c.Prior.End));
        s.Checks.Add(Check("Laba sama dengan selisih seluruh akun pendapatan dan beban",
            "Profit equals the net of every income and expense account", profit, expected));
        return s;
    }

    private static FinancialStatement ChangesInEquity(Calc c, DateOnly start, DateOnly end, bool fullYear)
    {
        var s = new FinancialStatement
        {
            Key = "equity",
            TitleId = "Laporan Perubahan Ekuitas",
            TitleEn = "Statement of Changes in Equity",
            BasisId = PeriodId(start, end, fullYear),
            BasisEn = PeriodEn(start, end, fullYear),
        };
        var b = new Builder(s, c);
        var opening = (c.Cur.EquityAt(start.AddDays(-1)), c.Prior?.EquityAt(c.Prior.Start.AddDays(-1)));
        var closing = (c.Cur.EquityAt(end), c.Prior?.EquityAt(c.Prior.End));

        // With a comparative column the two openings fall on different dates,
        // so the row cannot name one.
        if (c.HasPrior) b.Subtotal("Saldo awal periode", "Balance at beginning of period", opening, 0);
        else b.Subtotal($"Saldo per {DateId(start.AddDays(-1))}", $"Balance as of {DateEn(start.AddDays(-1))}", opening, 0);

        var profit = (c.Cur.ProfitBetween(start, end), c.Prior?.ProfitBetween(c.Prior.Start, c.Prior.End));
        b.Item(fullYear ? "Laba (rugi) tahun berjalan" : "Laba (rugi) periode berjalan",
               fullYear ? "Profit (loss) for the year" : "Profit (loss) for the period", null, profit);
        b.Item("Penghasilan komprehensif lain", "Other comprehensive income", null, (0m, c.HasPrior ? 0m : null));

        var running = Add(opening, profit);
        foreach (var code in c.Codes(Class.Equity))
        {
            var v = (-c.Cur.Movement(code), c.Prior is null ? (decimal?)null : -c.Prior.Movement(code));
            if (IsZero(v)) continue;
            b.Item(c.Accounts[code], v);
            running = Add(running, v);
        }

        if (c.HasPrior) b.Total("Saldo akhir periode", "Balance at end of period", closing);
        else b.Total($"Saldo per {DateId(end)}", $"Balance as of {DateEn(end)}", closing);

        s.Checks.Add(Check("Saldo akhir sama dengan saldo awal ditambah mutasi", "Closing balance equals opening plus movements", running, closing));
        return s;
    }

    private static FinancialStatement CashFlows(Calc c, DateOnly start, DateOnly end, bool fullYear)
    {
        var s = new FinancialStatement
        {
            Key = "cashflow",
            TitleId = "Laporan Arus Kas",
            TitleEn = "Statement of Cash Flows",
            BasisId = PeriodId(start, end, fullYear) + " (metode tidak langsung)",
            BasisEn = PeriodEn(start, end, fullYear) + " (indirect method)",
        };
        var b = new Builder(s, c);

        // The cash effect of any non-cash account is its credit-minus-debit
        // movement: an asset that grows used cash, a liability that grows
        // provided it.
        (decimal, decimal?) Effect(string code) => (-c.Cur.Movement(code), c.Prior is null ? null : -c.Prior.Movement(code));

        var contra = c.Codes(Class.NonCurrentAsset).Where(code => c.Accounts[code].CreditNormal).ToList();
        var investing = c.Codes(Class.NonCurrentAsset).Where(code => !c.Accounts[code].CreditNormal).ToList();

        b.Section("ARUS KAS DARI AKTIVITAS OPERASI", "CASH FLOWS FROM OPERATING ACTIVITIES");
        var profit = (c.Cur.ProfitBetween(start, end), c.Prior?.ProfitBetween(c.Prior.Start, c.Prior.End));
        b.Item(fullYear ? "Laba (rugi) tahun berjalan" : "Laba (rugi) periode berjalan",
               fullYear ? "Profit (loss) for the year" : "Profit (loss) for the period", null, profit);
        var operating = profit;

        var depreciation = (0m, c.HasPrior ? 0m : (decimal?)null);
        foreach (var code in contra) depreciation = Add(depreciation, Effect(code));
        if (!IsZero(depreciation))
        {
            b.Heading("Penyesuaian untuk pos nonkas:", "Adjustments for non-cash items:");
            b.Item("Penyusutan dan amortisasi", "Depreciation and amortisation", null, depreciation, 1);
            operating = Add(operating, depreciation);
        }

        var workingCapital = c.Codes(Class.CurrentAsset, Class.CurrentLiability).Where(code => !IsZero(Effect(code))).ToList();
        if (workingCapital.Count > 0)
        {
            b.Heading("Perubahan aset dan liabilitas operasi:", "Changes in operating assets and liabilities:");
            foreach (var code in workingCapital)
            {
                var v = Effect(code);
                b.Item(c.Accounts[code], v, 1);
                operating = Add(operating, v);
            }
        }
        b.Subtotal("Kas bersih dari aktivitas operasi", "Net cash from operating activities", operating, 0);

        var investingTotal = b.Group("ARUS KAS DARI AKTIVITAS INVESTASI", "CASH FLOWS FROM INVESTING ACTIVITIES", investing, Effect,
            "Kas bersih dari aktivitas investasi", "Net cash from investing activities", section: true);
        var financingTotal = b.Group("ARUS KAS DARI AKTIVITAS PENDANAAN", "CASH FLOWS FROM FINANCING ACTIVITIES",
            c.Codes(Class.NonCurrentLiability, Class.Equity), Effect,
            "Kas bersih dari aktivitas pendanaan", "Net cash from financing activities", section: true);

        var net = Add(Add(operating, investingTotal), financingTotal);
        b.Subtotal("KENAIKAN (PENURUNAN) BERSIH KAS DAN SETARA KAS", "NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS", net, 0);

        var opening = (c.Cur.CashAt(start.AddDays(-1)), c.Prior?.CashAt(c.Prior.Start.AddDays(-1)));
        b.Item("Kas dan setara kas awal periode", "Cash and cash equivalents at beginning of period", null, opening, 0);
        var closing = Add(opening, net);
        b.Total("KAS DAN SETARA KAS AKHIR PERIODE", "CASH AND CASH EQUIVALENTS AT END OF PERIOD", closing);

        var actual = (c.Cur.CashAt(end), c.Prior?.CashAt(c.Prior.End));
        s.Checks.Add(Check("Kas akhir sama dengan saldo akun kas dan setara kas", "Closing cash equals the cash and cash equivalent accounts", closing, actual));
        return s;
    }

    private static FinancialStatement TrialBalance(Calc c, DateOnly end)
    {
        var s = new FinancialStatement
        {
            Key = "tb",
            TitleId = "Neraca Saldo",
            TitleEn = "Trial Balance",
            BasisId = $"Per {DateId(end)}",
            BasisEn = $"As of {DateEn(end)}",
        };

        decimal debit = 0m, credit = 0m;
        foreach (var code in c.Accounts.Keys.OrderBy(k => k, StringComparer.Ordinal))
        {
            var balance = c.Cur.Balance(code);
            if (balance == 0m) continue;
            var a = c.Accounts[code];
            var line = new StatementLine { LabelId = a.NameId, LabelEn = a.NameEn, Code = code };
            if (balance > 0m) { line.Current = balance; debit += balance; }
            else { line.Credit = -balance; credit += -balance; }
            s.Lines.Add(line);
        }

        s.Lines.Add(new StatementLine { Kind = "total", LabelId = "JUMLAH", LabelEn = "TOTAL", Current = debit, Credit = credit });
        s.Checks.Add(Check("Jumlah debit sama dengan jumlah kredit", "Total debits equal total credits", (debit, null), (credit, null)));
        return s;
    }

    // ── calculation ───────────────────────────────────────────────────

    private sealed record Period(DateOnly Start, DateOnly End, DateOnly FiscalYearStart);

    private sealed class Calc
    {
        public Dictionary<string, Acct> Accounts { get; }
        public View Cur { get; }
        public View? Prior { get; }
        public bool HasPrior => Prior is not null;

        public Calc(Dictionary<string, Acct> accounts, List<Line> lines, Period cur, Period? prior)
        {
            Accounts = accounts;
            var byCode = lines.GroupBy(l => l.Code).ToDictionary(g => g.Key, g => g.ToList());
            Cur = new View(accounts, byCode, cur);
            Prior = prior is null ? null : new View(accounts, byCode, prior);
        }

        /// <summary>Codes in these classes, in code order.</summary>
        public List<string> Codes(params Class[] classes) =>
            Accounts.Values.Where(a => classes.Contains(a.Class))
                .Select(a => a.Code).OrderBy(c => c, StringComparer.Ordinal).ToList();
    }

    private sealed class View(Dictionary<string, Acct> accounts, Dictionary<string, List<Line>> lines, Period period)
    {
        public DateOnly Start => period.Start;
        public DateOnly End => period.End;
        public DateOnly FiscalYearStart => period.FiscalYearStart;

        private readonly Dictionary<(string, DateOnly), decimal> _balances = new();

        /// <summary>Debit minus credit, everything up to and including the date.</summary>
        public decimal BalanceAt(string code, DateOnly date)
        {
            if (_balances.TryGetValue((code, date), out var cached)) return cached;
            var value = lines.TryGetValue(code, out var own) ? own.Where(l => l.Date <= date).Sum(l => l.Debit - l.Credit) : 0m;
            _balances[(code, date)] = value;
            return value;
        }

        public decimal Balance(string code) => BalanceAt(code, End);

        /// <summary>Debit minus credit within the period.</summary>
        public decimal Movement(string code) => BalanceAt(code, End) - BalanceAt(code, Start.AddDays(-1));

        private IEnumerable<Acct> ProfitAccounts =>
            accounts.Values.Where(a => a.Class >= Class.Revenue);

        /// <summary>Profit (credit minus debit on income and expense) up to and excluding the date.</summary>
        public decimal ProfitBefore(DateOnly date) => -ProfitAccounts.Sum(a => BalanceAt(a.Code, date.AddDays(-1)));

        public decimal ProfitBetween(DateOnly from, DateOnly to) =>
            -ProfitAccounts.Sum(a => BalanceAt(a.Code, to) - BalanceAt(a.Code, from.AddDays(-1)));

        /// <summary>Total equity at a date, including profit not yet closed into it.</summary>
        public decimal EquityAt(DateOnly date) =>
            -accounts.Values.Where(a => a.Class == Class.Equity).Sum(a => BalanceAt(a.Code, date))
            + ProfitBefore(date.AddDays(1));

        public decimal CashAt(DateOnly date) =>
            accounts.Values.Where(a => a.Class == Class.Cash).Sum(a => BalanceAt(a.Code, date));
    }

    private sealed class Builder(FinancialStatement statement, Calc calc)
    {
        private readonly bool _hasPrior = calc.HasPrior;

        public void Section(string id, string en) =>
            statement.Lines.Add(new StatementLine { Kind = "section", LabelId = id, LabelEn = en });

        public void Heading(string id, string en) =>
            statement.Lines.Add(new StatementLine { Kind = "heading", LabelId = id, LabelEn = en });

        public void Item(string id, string en, string? code, (decimal Cur, decimal? Prior) v, int indent = 1) =>
            statement.Lines.Add(new StatementLine
            {
                LabelId = id, LabelEn = en, Code = code, Indent = indent,
                Current = v.Cur, Prior = _hasPrior ? v.Prior ?? 0m : null,
            });

        public void Item(Acct a, (decimal Cur, decimal? Prior) v, int indent = 1) => Item(a.NameId, a.NameEn, a.Code, v, indent);

        public void Subtotal(string id, string en, (decimal Cur, decimal? Prior) v, int indent = 1) =>
            statement.Lines.Add(new StatementLine
            {
                Kind = "subtotal", LabelId = id, LabelEn = en, Indent = indent,
                Current = v.Cur, Prior = _hasPrior ? v.Prior ?? 0m : null,
            });

        public void Total(string id, string en, (decimal Cur, decimal? Prior) v) =>
            statement.Lines.Add(new StatementLine
            {
                Kind = "total", LabelId = id, LabelEn = en,
                Current = v.Cur, Prior = _hasPrior ? v.Prior ?? 0m : null,
            });

        /// <summary>A heading, an item per non-zero account, and its subtotal. Returns the subtotal.</summary>
        public (decimal, decimal?) Group(string id, string en, List<string> codes,
            Func<string, (decimal, decimal?)> value, string totalId, string totalEn, bool section = false)
        {
            if (section) Section(id, en); else Heading(id, en);

            var total = (0m, _hasPrior ? 0m : (decimal?)null);
            var any = false;
            foreach (var code in codes)
            {
                var v = value(code);
                if (IsZero(v)) continue;
                any = true;
                Item(calc.Accounts[code], v);
                total = Add(total, v);
            }

            if (!any) Item("Nihil", "Nil", null, (0m, _hasPrior ? 0m : null));
            Subtotal(totalId, totalEn, total, section ? 0 : 1);
            return total;
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private static Class Classify(string code)
    {
        var d = code.Replace("-", "");
        if (d.Length == 0) return Class.OtherExpense;
        var second = d.Length > 1 ? d[1] : '0';
        var third = d.Length > 2 ? d[2] : '0';

        return d[0] switch
        {
            '1' when second == '1' && third == '1' => Class.Cash,
            '1' when second == '1' => Class.CurrentAsset,
            '1' => Class.NonCurrentAsset,
            '2' when second == '1' => Class.CurrentLiability,
            '2' => Class.NonCurrentLiability,
            '3' => Class.Equity,
            '4' => Class.Revenue,
            '5' => Class.CostOfRevenue,
            '6' => Class.OperatingExpense,
            '7' => Class.OtherIncome,
            _ when code == IncomeTaxCode => Class.IncomeTax,
            _ => Class.OtherExpense,
        };
    }

    private static DateOnly FiscalYearStart(DateOnly date, int month)
    {
        month = month is >= 1 and <= 12 ? month : 1;
        var start = new DateOnly(date.Year, month, 1);
        return start > date ? start.AddYears(-1) : start;
    }

    private static (decimal, decimal?) Add((decimal Cur, decimal? Prior) a, (decimal Cur, decimal? Prior) b) =>
        (a.Cur + b.Cur, a.Prior.HasValue || b.Prior.HasValue ? (a.Prior ?? 0m) + (b.Prior ?? 0m) : null);

    private static (decimal, decimal?) Neg((decimal Cur, decimal? Prior) a) => (-a.Cur, -a.Prior);

    private static bool IsZero((decimal Cur, decimal? Prior) v) => v.Cur == 0m && (v.Prior ?? 0m) == 0m;

    private static StatementCheck Check(string id, string en, (decimal Cur, decimal? Prior) left, (decimal Cur, decimal? Prior) right)
    {
        var diff = Math.Abs(left.Cur - right.Cur) + Math.Abs((left.Prior ?? 0m) - (right.Prior ?? 0m));
        return new StatementCheck { LabelId = id, LabelEn = en, Passed = diff == 0m, Difference = diff };
    }

    private static string DateId(DateOnly d) => d.ToString("d MMMM yyyy", Id);
    private static string DateEn(DateOnly d) => d.ToString("MMMM d, yyyy", En);

    private static string PeriodId(DateOnly start, DateOnly end, bool fullYear) => fullYear
        ? $"Untuk tahun yang berakhir pada {DateId(end)}"
        : $"Untuk periode {DateId(start)} sampai dengan {DateId(end)}";

    private static string PeriodEn(DateOnly start, DateOnly end, bool fullYear) => fullYear
        ? $"For the year ended {DateEn(end)}"
        : $"For the period from {DateEn(start)} to {DateEn(end)}";
}
