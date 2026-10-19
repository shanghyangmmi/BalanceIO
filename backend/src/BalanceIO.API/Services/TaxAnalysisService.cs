using System.Globalization;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The two analyses that sit between the ledger and an SPT Tahunan Badan:
/// the fiscal reconciliation, and the debt-to-equity test in PMK-169.
///
/// Both read the ledger and both stop short of a conclusion. The product
/// computes; it does not classify a cost as non-deductible, and it does not
/// file anything.
/// </summary>
public class TaxAnalysisService
{
    private readonly ApplicationDbContext _context;
    private readonly FiscalDepreciationService _fiscalDepreciation;

    public TaxAnalysisService(ApplicationDbContext context, FiscalDepreciationService fiscalDepreciation)
    {
        _context = context;
        _fiscalDepreciation = fiscalDepreciation;
    }

    // ── rekonsiliasi fiskal ───────────────────────────────────────────

    public async Task<FiscalReconciliationResponse> ReconcileAsync(Guid companyId, int year)
    {
        var currency = await CurrencyAsync(companyId);
        var start = new DateOnly(year, 1, 1);
        var end   = new DateOnly(year, 12, 31);

        // No IsHeader filter, deliberately.
        //
        // Each journal line hits exactly one account code, and balances here
        // come from postings rather than from rolling children up — so
        // excluding headers cannot prevent double counting, it can only
        // discard real postings. In this chart 5-0000, 6-1000 and 6-2000 are
        // flagged as headers and carry postings anyway; filtering them out
        // dropped Rp 18.000.000 of expense from the commercial profit.
        var accounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId
                     && (a.Type == "Revenue" || a.Type == "Expense"))
            .Select(a => new { a.Code, a.Name, a.Type, a.FiscalCorrection })
            .ToListAsync();

        var byCode = accounts.ToDictionary(a => a.Code, StringComparer.OrdinalIgnoreCase);

        // Decimal, and grouped here: the SQLite provider refuses a decimal
        // SUM and this is money.
        var lines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && l.JournalEntry.Date >= start
                     && l.JournalEntry.Date <= end)
            .Select(l => new { l.AccountId, l.Debit, l.Credit })
            .ToListAsync();

        var balances = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in lines)
        {
            if (!byCode.TryGetValue(line.AccountId, out var account)) continue;

            // Revenue is credit-normal, expense is debit-normal. Both are
            // carried as a positive figure so the reconciliation reads the
            // way a statement does.
            var amount = account.Type == "Revenue"
                ? line.Credit - line.Debit
                : line.Debit - line.Credit;

            balances[line.AccountId] = balances.GetValueOrDefault(line.AccountId) + amount;
        }

        var response = new FiscalReconciliationResponse
        {
            CompanyId            = companyId,
            Currency             = currency,
            GeneratedAt          = DateTime.UtcNow,
            Year                 = year,
            AvailableYears       = await AvailableYearsAsync(companyId, year),
            ClassifiableAccounts = accounts.Count,
            ClassifiedAccounts   = accounts.Count(a => !string.IsNullOrWhiteSpace(a.FiscalCorrection)),
        };

        foreach (var account in accounts)
        {
            var balance = balances.GetValueOrDefault(account.Code);

            if (account.Type == "Revenue") response.Revenue += balance;
            else                            response.Expenses += balance;

            if (string.IsNullOrWhiteSpace(account.FiscalCorrection) || balance == 0m) continue;

            var direction = account.FiscalCorrection.Trim().ToLowerInvariant();
            if (direction is not ("positive" or "negative")) continue;

            response.Corrections.Add(new FiscalCorrectionLine
            {
                Code      = account.Code,
                Name      = account.Name,
                Direction = direction,
                Amount    = balance,
            });

            if (direction == "positive") response.PositiveCorrections += balance;
            else                          response.NegativeCorrections += balance;
        }

        // Depreciation is a timing difference the register computes, not a
        // classification: commercial less fiscal, for assets given a fiscal
        // group. More commercial depreciation is added back.
        var assets = await _fiscalDepreciation.ForYearAsync(companyId, year);
        response.UnclassifiedAssets = assets.Unclassified;
        if (assets.Correction != 0m)
        {
            var direction = assets.Correction > 0m ? "positive" : "negative";
            var amount = Math.Abs(assets.Correction);
            response.Corrections.Add(new FiscalCorrectionLine
            {
                Code      = "ASET",
                Name      = "Selisih penyusutan dan pelepasan aset tetap (komersial − fiskal)",
                Direction = direction,
                Amount    = amount,
            });
            if (direction == "positive") response.PositiveCorrections += amount;
            else                          response.NegativeCorrections += amount;
        }

        response.Corrections = response.Corrections
            .OrderBy(c => c.Direction)
            .ThenBy(c => c.Code)
            .ToList();

        response.CommercialProfit = response.Revenue - response.Expenses;
        response.FiscalProfit     = response.CommercialProfit
                                  + response.PositiveCorrections
                                  - response.NegativeCorrections;

        return response;
    }

    // ── debt to equity ────────────────────────────────────────────────

    public async Task<DebtToEquityResponse> DebtToEquityAsync(Guid companyId, int year)
    {
        var currency = await CurrencyAsync(companyId);
        var end = new DateOnly(year, 12, 31);

        // Headers included, for the reason given in ReconcileAsync.
        var accounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId)
            .Select(a => new { a.Code, a.Name, a.Type, a.IsInterestBearingDebt })
            .ToListAsync();

        var debtCodes   = accounts.Where(a => a.IsInterestBearingDebt)
                                  .Select(a => a.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var equityCodes = accounts.Where(a => a.Type == "Equity")
                                  .Select(a => a.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Interest expense identified by name. The chart carries no field
        // for it, and inventing one to hold a single account would be worse
        // than reading the label the accountant already wrote.
        var interestAccounts = accounts
            .Where(a => a.Type == "Expense"
                     && (a.Name.Contains("Interest", StringComparison.OrdinalIgnoreCase)
                      || a.Name.Contains("Bunga", StringComparison.OrdinalIgnoreCase)))
            .ToList();
        var interestCodes = interestAccounts.Select(a => a.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Balance sheet accounts carry forward, so every posting up to the
        // month end counts — not only the ones inside the year.
        var lines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && l.JournalEntry.Date <= end)
            .Select(l => new { l.AccountId, Date = l.JournalEntry!.Date, l.Debit, l.Credit })
            .ToListAsync();

        var response = new DebtToEquityResponse
        {
            CompanyId        = companyId,
            Currency         = currency,
            GeneratedAt      = DateTime.UtcNow,
            Year             = year,
            AvailableYears   = await AvailableYearsAsync(companyId, year),
            DebtAccounts     = accounts.Where(a => a.IsInterestBearingDebt)
                                       .OrderBy(a => a.Code)
                                       .Select(a => $"{a.Code} {a.Name}").ToList(),
            InterestAccounts = interestAccounts
                                       .OrderBy(a => a.Code)
                                       .Select(a => $"{a.Code} {a.Name}").ToList(),
        };

        for (var month = 1; month <= 12; month++)
        {
            var monthEnd = new DateOnly(year, month, 1).AddMonths(1).AddDays(-1);
            var upTo = lines.Where(l => l.Date <= monthEnd).ToList();

            // Liability and equity are credit-normal.
            var debt   = upTo.Where(l => debtCodes.Contains(l.AccountId)).Sum(l => l.Credit - l.Debit);
            var equity = upTo.Where(l => equityCodes.Contains(l.AccountId)).Sum(l => l.Credit - l.Debit);

            response.Months.Add(new DebtEquityMonth
            {
                Month  = month,
                Label  = new DateOnly(year, month, 1).ToString("MMMM", CultureInfo.InvariantCulture),
                Debt   = debt,
                Equity = equity,
            });
        }

        response.AverageDebt   = Math.Round(response.Months.Sum(m => m.Debt) / 12m, 2, MidpointRounding.ToEven);
        response.AverageEquity = Math.Round(response.Months.Sum(m => m.Equity) / 12m, 2, MidpointRounding.ToEven);

        response.InterestExpense = lines
            .Where(l => l.Date >= new DateOnly(year, 1, 1) && interestCodes.Contains(l.AccountId))
            .Sum(l => l.Debit - l.Credit);

        if (debtCodes.Count == 0)
        {
            response.Notes.Add("No account is marked as interest-bearing debt, so the ratio has no numerator. Mark the borrowing accounts on the chart of accounts.");
        }

        if (response.AverageEquity <= 0m)
        {
            // A negative denominator makes the ratio meaningless rather than
            // large, and PMK-169 treats it as failing the test outright.
            response.Ratio = null;
            response.WithinLimit = response.AverageDebt == 0m;
            response.Notes.Add(response.AverageEquity == 0m
                ? "Average equity is zero, so a ratio cannot be formed."
                : "Average equity is negative. PMK-169 treats that as outside the limit however small the debt is.");
        }
        else
        {
            var ratio = Math.Round(response.AverageDebt / response.AverageEquity, 4, MidpointRounding.ToEven);
            response.Ratio = ratio;
            response.WithinLimit = ratio <= response.MaximumRatio;
        }

        if (!response.WithinLimit && response.InterestExpense > 0m && response.AverageDebt > 0m)
        {
            // Only the interest on the debt above 4:1 is disallowed, in the
            // same proportion as that excess bears to the whole debt.
            var allowedDebt = response.AverageEquity > 0m
                ? response.MaximumRatio * response.AverageEquity
                : 0m;

            var excess = response.AverageDebt - allowedDebt;
            if (excess < 0m) excess = 0m;

            response.DisallowedInterest = Math.Round(
                response.InterestExpense * (excess / response.AverageDebt), 2, MidpointRounding.ToEven);
        }

        if (interestAccounts.Count == 0)
        {
            response.Notes.Add("No expense account is named as interest, so no interest could be attributed.");
        }

        return response;
    }

    // ── shared ────────────────────────────────────────────────────────

    private async Task<string> CurrencyAsync(Guid companyId) =>
        await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Currency)
            .FirstOrDefaultAsync() ?? "IDR";

    private async Task<List<int>> AvailableYearsAsync(Guid companyId, int requested)
    {
        var years = await _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Posted)
            .Select(j => j.Date.Year)
            .Distinct()
            .ToListAsync();

        return years.Append(requested).Distinct().OrderByDescending(y => y).ToList();
    }
}
