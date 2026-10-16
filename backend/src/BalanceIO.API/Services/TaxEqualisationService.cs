using System.Globalization;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Ekualisasi PPN: ledger revenue against reported DPP, month by month.
///
/// Both sides are read from what was actually recorded. The ledger side is
/// posted journal lines on revenue accounts; the tax side is issued sales
/// invoices. Nothing is derived from the other, which is the point — a
/// reconciliation that computed one side from the other would always
/// balance and would tell you nothing.
/// </summary>
public class TaxEqualisationService
{
    private readonly ApplicationDbContext _context;

    public TaxEqualisationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<TaxEqualisationResponse> GetAsync(Guid companyId, int year)
    {
        var currency = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Currency)
            .FirstOrDefaultAsync() ?? "IDR";

        // ── which accounts count as peredaran usaha ───────────────────
        // AccountGroup "Sales", not Type "Revenue".
        //
        // Type alone also catches the OtherIncomeExpense accounts —
        // interest income, foreign exchange gains, gain on asset disposal.
        // None of those is a delivery of goods or services, so none carries
        // PPN, and counting them here inflates the ledger side against a
        // DPP that never included them. It made the first run of this
        // report show a difference in a month with no invoices at all.
        //
        // Matched on the group rather than a "4-" code prefix so a company
        // that renumbers its chart is still reconciled correctly.
        //
        // Headers are not excluded. A journal line hits one account code, so
        // there is no rollup to double count, and filtering headers out
        // silently drops any revenue posted straight to 4-0000.
        var revenueAccounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId
                     && a.Type == "Revenue"
                     && a.AccountGroup == "Sales")
            .Select(a => new { a.Id, a.Code, a.Name })
            .ToListAsync();

        // JournalLine.AccountId is a string holding the account CODE
        // ("4-1000"), not the Guid — checked against the data rather than
        // assumed from the type name. Matching on the Guid would have found
        // nothing and reported every rupiah of revenue as a difference.
        // Both are accepted in case a row was ever written the other way.
        var revenueKeys = revenueAccounts
            .SelectMany(a => new[] { a.Code, a.Id.ToString() })
            .Where(k => !string.IsNullOrWhiteSpace(k))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var start = new DateOnly(year, 1, 1);
        var end   = new DateOnly(year, 12, 31);

        // ── ledger side ───────────────────────────────────────────────
        // Read as decimal and grouped here: the SQLite provider refuses a
        // decimal SUM outright, and this is money.
        var ledgerRows = await _context.JournalLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && l.JournalEntry.Date >= start
                     && l.JournalEntry.Date <= end)
            .Select(l => new { l.AccountId, Date = l.JournalEntry!.Date, l.Debit, l.Credit })
            .ToListAsync();

        // ── tax side ──────────────────────────────────────────────────
        var invoiceRows = await _context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Void
                     && i.InvoiceDate >= start
                     && i.InvoiceDate <= end)
            .Select(i => new { Date = i.InvoiceDate, i.Total, i.TaxAmount })
            .ToListAsync();

        var response = new TaxEqualisationResponse
        {
            CompanyId       = companyId,
            Currency        = currency,
            GeneratedAt     = DateTime.UtcNow,
            Year            = year,
            AvailableYears  = await AvailableYearsAsync(companyId, year),
            RevenueAccounts = revenueAccounts
                .OrderBy(a => a.Code)
                .Select(a => $"{a.Code} {a.Name}")
                .ToList(),
        };

        for (var month = 1; month <= 12; month++)
        {
            var ledger = ledgerRows
                .Where(r => r.Date.Month == month && revenueKeys.Contains(r.AccountId))
                // Revenue is credit-normal, so a return or a discount posted
                // as a debit reduces it. That is correct: the DPP on the
                // other side is net of the same thing.
                .Sum(r => r.Credit - r.Debit);

            var invoices = invoiceRows.Where(r => r.Date.Month == month).ToList();
            var dpp      = invoices.Sum(r => r.Total - r.TaxAmount);
            var output   = invoices.Sum(r => r.TaxAmount);

            response.Months.Add(new EqualisationRow
            {
                Month         = month,
                Label         = new DateOnly(year, month, 1).ToString("MMMM", CultureInfo.InvariantCulture),
                LedgerRevenue = ledger,
                InvoiceDpp    = dpp,
                OutputTax     = output,
                Difference    = ledger - dpp,
                InvoiceCount  = invoices.Count,
            });
        }

        response.Totals = new EqualisationTotals
        {
            LedgerRevenue        = response.Months.Sum(m => m.LedgerRevenue),
            InvoiceDpp           = response.Months.Sum(m => m.InvoiceDpp),
            OutputTax            = response.Months.Sum(m => m.OutputTax),
            InvoiceCount         = response.Months.Sum(m => m.InvoiceCount),
            // Exact, like every other comparison in this codebase. A
            // reconciliation with a tolerance is not a reconciliation.
            MonthsWithDifference = response.Months.Count(m => m.Difference != 0m),
        };
        response.Totals.Difference = response.Totals.LedgerRevenue - response.Totals.InvoiceDpp;

        return response;
    }

    /// <summary>
    /// Years that carry a posted entry or an issued invoice, newest first.
    /// The requested year is always included so the picker never loses the
    /// year you are looking at.
    /// </summary>
    private async Task<List<int>> AvailableYearsAsync(Guid companyId, int requested)
    {
        var entryYears = await _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Posted)
            .Select(j => j.Date.Year)
            .Distinct()
            .ToListAsync();

        var invoiceYears = await _context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Void)
            .Select(i => i.InvoiceDate.Year)
            .Distinct()
            .ToListAsync();

        return entryYears
            .Concat(invoiceYears)
            .Append(requested)
            .Distinct()
            .OrderByDescending(y => y)
            .ToList();
    }
}
