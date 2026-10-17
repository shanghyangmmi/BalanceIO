using BalanceIO.API.DTOs;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace BalanceIO.API.Services;

/// <summary>
/// Computes the balance state of every module for the dashboard hub.
///
/// This lives on the server because the answers have to agree with the
/// reports. A frontend that re-derives "is the ledger balanced" from a
/// list of entries will eventually disagree with the Trial Balance, and
/// then neither number can be trusted.
///
/// Every query is an aggregate over an indexed column and none of them
/// materialise rows, because this runs on every dashboard visit.
/// </summary>
public class ModuleHealthService
{
    private readonly ApplicationDbContext _context;

    public ModuleHealthService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ModuleHealthResponse> GetAsync(Guid companyId, DateOnly today)
    {
        var company = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => new { c.Currency, c.LockDate })
            .FirstOrDefaultAsync();

        var currency = company?.Currency ?? "IDR";

        var response = new ModuleHealthResponse
        {
            CompanyId  = companyId,
            Currency   = currency,
            GeneratedAt = DateTime.UtcNow,
        };

        response.Modules.Add(await AccountingAsync(companyId, today, company?.LockDate, currency));
        response.Modules.Add(await TaxAsync(companyId, today, currency));
        response.Modules.Add(await InventoryAsync(companyId, today));
        response.Modules.Add(await FixedAssetsAsync(companyId, today, currency));
        response.Modules.Add(await PayrollAsync(companyId, today, currency));

        response.Overall = ModuleHealthStatus.Worst(response.Modules.Select(m => m.Status));

        return response;
    }

    // ── Accounting ────────────────────────────────────────────────────
    // In balance when debits equal credits across posted entries, nothing
    // is sitting unposted, and the period lock has caught up.

    private async Task<ModuleHealth> AccountingAsync(
        Guid companyId, DateOnly today, DateOnly? lockDate, string currency)
    {
        // Joining through JournalEntry is not optional. JournalLine carries
        // no CompanyId and no global query filter, so querying JournalLines
        // directly would read every tenant's ledger.
        var postedLines = _context.JournalLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted);

        var (totalDebit, totalCredit) = await SumDebitCreditAsync(postedLines);

        // Exact. A tolerance here was removed from this codebase on purpose:
        // a ledger that is out by 0.0001 is out.
        var isBalanced = totalDebit == totalCredit;

        var draftCount = await _context.JournalEntries
            .AsNoTracking()
            .CountAsync(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Draft);

        // The books are expected to be closed through the end of last month.
        var expectedLockThrough = new DateOnly(today.Year, today.Month, 1).AddDays(-1);
        var periodLockCurrent = lockDate.HasValue && lockDate.Value >= expectedLockThrough;

        var module = new ModuleHealth
        {
            Key  = "accounting",
            Name = "Accounting",
            Href = "/dashboard/accounting",
            Figures =
            {
                Money("Debit",  totalDebit,  currency),
                Money("Credit", totalCredit, currency),
            },
        };

        if (!isBalanced)
        {
            // Nothing else on this card matters while this is true.
            module.Status   = ModuleHealthStatus.Overdue;
            module.Headline = "Debits and credits do not agree";
            module.Detail   = "The posted ledger is out of balance. Every report drawn from it is wrong until this is corrected.";
        }
        else if (draftCount > 0 && !periodLockCurrent)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = draftCount == 1
                ? "1 entry unposted, period not closed"
                : $"{draftCount} entries unposted, period not closed";
            module.Detail   = LockDetail(lockDate, expectedLockThrough);
        }
        else if (draftCount > 0)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = draftCount == 1
                ? "1 entry unposted"
                : $"{draftCount} entries unposted";
            module.Detail   = "Debits and credits agree across everything that is posted.";
        }
        else if (!periodLockCurrent)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = "Period not closed";
            module.Detail   = LockDetail(lockDate, expectedLockThrough);
        }
        else
        {
            module.Status   = ModuleHealthStatus.Balanced;
            module.Headline = "Debits equal credits";
            module.Detail   = string.Format(CultureInfo.InvariantCulture, "Nothing unposted. Books closed through {0:d MMM yyyy}.", lockDate);
        }

        return module;
    }

    // ── Accounting, in depth ──────────────────────────────────────────
    // The module page sits between the hub and the working screens. It
    // embeds the hub's own card rather than deriving a second opinion of
    // the same books - two screens disagreeing about whether the ledger
    // balances would make both of them worthless.

    public async Task<AccountingOverviewResponse> GetAccountingOverviewAsync(
        Guid companyId, DateOnly today)
    {
        var company = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => new { c.Currency, c.LockDate })
            .FirstOrDefaultAsync();

        var currency = company?.Currency ?? "IDR";
        var lockDate = company?.LockDate;

        var module = await AccountingAsync(companyId, today, lockDate, currency);

        // ── the identity ──────────────────────────────────────────────
        var postedLines = _context.JournalLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted);

        var (debit, credit) = await SumDebitCreditAsync(postedLines);

        var postedEntries = await _context.JournalEntries
            .AsNoTracking()
            .CountAsync(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Posted);

        var balance = new LedgerBalance
        {
            Debit         = debit,
            Credit        = credit,
            Difference    = debit - credit,
            IsBalanced    = debit == credit,
            PostedEntries = postedEntries,
        };

        // ── the period ────────────────────────────────────────────────
        var expectedLockThrough = new DateOnly(today.Year, today.Month, 1).AddDays(-1);

        var period = new PeriodState
        {
            LockDate            = lockDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            ExpectedLockThrough = expectedLockThrough.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            IsSet               = lockDate.HasValue,
            IsCurrent           = lockDate.HasValue && lockDate.Value >= expectedLockThrough,
        };

        if (lockDate.HasValue && lockDate.Value < expectedLockThrough)
        {
            period.MonthsBehind =
                (expectedLockThrough.Year - lockDate.Value.Year) * 12
                + expectedLockThrough.Month - lockDate.Value.Month;
        }

        // ── the drafts ────────────────────────────────────────────────
        // Drafts are a working set and small by definition, so they are
        // read and grouped in memory. The alternative is a decimal GROUP BY,
        // which the SQLite provider refuses outright.
        var draftLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Draft)
            .Select(l => new { l.JournalEntryId, l.Debit, l.Credit })
            .ToListAsync();

        var unbalancedDrafts = draftLines
            .GroupBy(l => l.JournalEntryId)
            .Count(g => g.Sum(x => x.Debit) != g.Sum(x => x.Credit));

        var drafts = _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Draft);

        var draftCount = await drafts.CountAsync();

        // An entry with no lines never appears in the grouping above, and
        // it cannot be posted either.
        var emptyDrafts = await drafts.CountAsync(j => !j.Lines.Any());

        var oldestDraft = await drafts
            .OrderBy(j => j.Date)
            .Select(j => (DateOnly?)j.Date)
            .FirstOrDefaultAsync();

        var blockedDrafts = unbalancedDrafts + emptyDrafts;

        // ── the recurring schedule ────────────────────────────────────
        // NextRunDate is a DateTime on this model, so it is compared with
        // the end of the company's day: an entry due today counts as due.
        var endOfToday = today.ToDateTime(TimeOnly.MaxValue);

        var recurringDue = await _context.RecurringJournalEntries
            .AsNoTracking()
            .CountAsync(r => r.CompanyId == companyId
                          && r.IsActive
                          && r.NextRunDate <= endOfToday);

        // ── the work left ─────────────────────────────────────────────
        var outstanding = new List<OutstandingItem>();

        if (!balance.IsBalanced)
        {
            outstanding.Add(new OutstandingItem
            {
                Key         = "outOfBalance",
                Severity    = ModuleHealthStatus.Overdue,
                Title       = "The posted ledger does not balance",
                Detail      = "Every report drawn from these books is wrong until debits and credits agree. Start with the general ledger.",
                Href        = "/dashboard/accounting/ledger",
                ActionLabel = "Open ledger",
            });
        }

        if (blockedDrafts > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "blockedDrafts",
                Severity = ModuleHealthStatus.Overdue,
                Count    = blockedDrafts,
                Title    = blockedDrafts == 1
                    ? "1 draft cannot be posted"
                    : $"{blockedDrafts} drafts cannot be posted",
                Detail   = emptyDrafts > 0 && unbalancedDrafts > 0
                    ? $"{unbalancedDrafts} out of balance, {emptyDrafts} with no lines."
                    : emptyDrafts > 0
                        ? "They have no lines on them yet."
                        : "Debits and credits do not agree within the entry.",
                Href        = "/dashboard/accounting/journal?status=draft",
                ActionLabel = "Review drafts",
            });
        }

        var postableDrafts = draftCount - blockedDrafts;
        if (postableDrafts > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "drafts",
                Severity = ModuleHealthStatus.Attention,
                Count    = postableDrafts,
                Title    = postableDrafts == 1
                    ? "1 entry waiting to be posted"
                    : $"{postableDrafts} entries waiting to be posted",
                Detail   = oldestDraft.HasValue
                    ? string.Format(CultureInfo.InvariantCulture, "The oldest is dated {0:d MMM yyyy}. Nothing reaches the reports until it is posted.", oldestDraft.Value)
                    : "Nothing reaches the reports until they are posted.",
                Href        = "/dashboard/accounting/approvals",
                ActionLabel = "Post entries",
            });
        }

        if (!period.IsCurrent)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "periodLock",
                Severity = ModuleHealthStatus.Attention,
                Count    = period.IsSet ? period.MonthsBehind : null,
                Title    = period.IsSet
                    ? string.Format(CultureInfo.InvariantCulture, "Books are open past {0:MMMM yyyy}", lockDate!.Value)
                    : "No period lock is set",
                Detail      = LockDetail(lockDate, expectedLockThrough),
                Href        = "/dashboard/settings",
                ActionLabel = "Set lock date",
            });
        }

        if (recurringDue > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "recurringDue",
                Severity = ModuleHealthStatus.Attention,
                Count    = recurringDue,
                Title    = recurringDue == 1
                    ? "1 recurring entry is due"
                    : $"{recurringDue} recurring entries are due",
                Detail      = "A schedule generates nothing on its own; it is run from the recurring screen.",
                Href        = "/dashboard/accounting/recurring",
                ActionLabel = "Run schedule",
            });
        }

        // ── the shape of the ledger ───────────────────────────────────
        var accounts = _context.Accounts.AsNoTracking().Where(a => a.CompanyId == companyId);

        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthEnd   = monthStart.AddMonths(1).AddDays(-1);

        var ledger = new LedgerShape
        {
            Accounts         = await accounts.CountAsync(),
            PostableAccounts = await accounts.CountAsync(a => a.IsActive && !a.IsHeader),
            EntriesThisMonth = await _context.JournalEntries.AsNoTracking()
                .CountAsync(j => j.CompanyId == companyId
                              && j.Status == JournalEntryStatus.Posted
                              && j.Date >= monthStart
                              && j.Date <= monthEnd),
        };

        var lastPosted = await _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Posted)
            .OrderByDescending(j => j.Date)
            .Select(j => (DateOnly?)j.Date)
            .FirstOrDefaultAsync();

        if (lastPosted.HasValue)
        {
            ledger.LastPostedDate = lastPosted.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        // ── recent activity ───────────────────────────────────────────
        // The debits are projected as a list and added here rather than
        // summed in SQL, for the same decimal reason as above.
        var recentRows = await _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Posted)
            .OrderByDescending(j => j.Date)
            .ThenByDescending(j => j.CreatedAt)
            .Take(5)
            .Select(j => new
            {
                j.Id,
                j.Date,
                j.ReferenceNumber,
                Debits = j.Lines.Select(l => l.Debit).ToList(),
            })
            .ToListAsync();

        var recent = recentRows.Select(r => new RecentEntry
        {
            Id        = r.Id,
            Date      = r.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Reference = string.IsNullOrWhiteSpace(r.ReferenceNumber) ? null : r.ReferenceNumber,
            Amount    = r.Debits.Sum(),
            Lines     = r.Debits.Count,
        }).ToList();

        return new AccountingOverviewResponse
        {
            CompanyId   = companyId,
            Currency    = currency,
            GeneratedAt = DateTime.UtcNow,
            Module      = module,
            Balance     = balance,
            Period      = period,
            Outstanding = outstanding,
            Ledger      = ledger,
            Recent      = recent,
        };
    }

    private static string LockDetail(DateOnly? lockDate, DateOnly expectedThrough) =>
        lockDate.HasValue
            ? string.Format(CultureInfo.InvariantCulture, "Books are locked through {0:d MMM yyyy}; {1:MMMM yyyy} is still open.", lockDate.Value, expectedThrough)
            : string.Format(CultureInfo.InvariantCulture, "No period lock is set. {0:MMMM yyyy} and everything before it can still be edited.", expectedThrough);

    // ── Tax ───────────────────────────────────────────────────────────
    // PPN keluaran against PPN masukan for the current period, plus how
    // long is left before the SPT Masa PPN deadline.

    private async Task<ModuleHealth> TaxAsync(Guid companyId, DateOnly today, string currency)
    {
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd   = periodStart.AddMonths(1).AddDays(-1);

        // PPN keluaran - output tax on invoices that have left Draft.
        var output = await SumExactAsync(_context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Void
                     && i.InvoiceDate >= periodStart
                     && i.InvoiceDate <= periodEnd)
            .Select(i => i.TaxAmount));

        // PPN masukan - input tax on bills that have left Draft.
        var input = await SumExactAsync(_context.PurchaseBills
            .AsNoTracking()
            .Where(b => b.CompanyId == companyId
                     && b.Status != BillStatus.Draft
                     && b.Status != BillStatus.Void
                     && b.BillDate >= periodStart
                     && b.BillDate <= periodEnd)
            .Select(b => b.TaxAmount));

        var everHadTaxActivity = output != 0m || input != 0m
            || await _context.SalesInvoices.AsNoTracking()
                .AnyAsync(i => i.CompanyId == companyId
                            && i.Status != InvoiceStatus.Draft
                            && i.Status != InvoiceStatus.Void);

        var module = new ModuleHealth
        {
            Key  = "tax",
            Name = "Tax",
            Href = "/dashboard/tax",
            Figures =
            {
                Money("PPN keluaran", output, currency),
                Money("PPN masukan",  input,  currency),
            },
        };

        if (!everHadTaxActivity)
        {
            module.Status   = ModuleHealthStatus.Inactive;
            module.Headline = "No PPN activity";
            module.Detail   = "No invoice or bill has carried tax yet.";
            return module;
        }

        // SPT Masa PPN for a period is due at the end of the following
        // month. The period being filed now is last month.
        var filingPeriod   = periodStart.AddMonths(-1);
        var filingDeadline = periodEnd;
        var daysToDeadline = filingDeadline.DayNumber - today.DayNumber;

        var net = output - input;

        module.Headline = net > 0m
            ? "PPN kurang bayar"
            : net < 0m
                ? "PPN lebih bayar"
                : "PPN keluaran and masukan agree";

        // Filing status is not recorded anywhere in the model, so this
        // reports the deadline rather than asserting that a return is late.
        // Claiming "overdue" from a date alone would put a permanent red
        // card on the hub for every company that files on time.
        if (daysToDeadline <= 7)
        {
            module.Status = ModuleHealthStatus.Attention;
            module.Detail = string.Format(CultureInfo.InvariantCulture, "SPT Masa PPN for {0:MMMM yyyy} is due {1:d MMM yyyy} - {2} left.", filingPeriod, filingDeadline, Days(daysToDeadline));
        }
        else
        {
            module.Status = ModuleHealthStatus.Balanced;
            module.Detail = string.Format(CultureInfo.InvariantCulture, "SPT Masa PPN for {0:MMMM yyyy} due {1:d MMM yyyy}.", filingPeriod, filingDeadline);
        }

        return module;
    }

    // ── Tax, in depth ─────────────────────────────────────────────────
    // The module page. Same card as the hub, plus the six-month PPN run,
    // the filing deadline, and the gaps in the record that would stop this
    // period being reported anywhere.
    //
    // Every item below is a fact about what was entered. None of it decides
    // how a transaction should be taxed.

    public async Task<TaxOverviewResponse> GetTaxOverviewAsync(Guid companyId, DateOnly today)
    {
        var company = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => new { c.Currency, c.TaxId })
            .FirstOrDefaultAsync();

        var currency = company?.Currency ?? "IDR";

        var module = await TaxAsync(companyId, today, currency);

        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var periodEnd   = periodStart.AddMonths(1).AddDays(-1);

        // ── six months of PPN ─────────────────────────────────────────
        // Read once over the whole window and grouped in memory rather than
        // twelve round trips, and as decimal rather than a SQL SUM, which
        // the SQLite provider refuses outright on this type.
        var windowStart = periodStart.AddMonths(-5);

        var outputRows = await _context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Void
                     && i.InvoiceDate >= windowStart
                     && i.InvoiceDate <= periodEnd)
            .Select(i => new { Date = i.InvoiceDate, i.TaxAmount })
            .ToListAsync();

        var inputRows = await _context.PurchaseBills
            .AsNoTracking()
            .Where(b => b.CompanyId == companyId
                     && b.Status != BillStatus.Draft
                     && b.Status != BillStatus.Void
                     && b.BillDate >= windowStart
                     && b.BillDate <= periodEnd)
            .Select(b => new { Date = b.BillDate, b.TaxAmount })
            .ToListAsync();

        var history = new List<VatPeriod>();
        for (var offset = 0; offset < 6; offset++)
        {
            var start = periodStart.AddMonths(-offset);
            var end   = start.AddMonths(1).AddDays(-1);

            var outs = outputRows.Where(r => r.Date >= start && r.Date <= end).ToList();
            var ins  = inputRows.Where(r => r.Date >= start && r.Date <= end).ToList();

            var outTax = outs.Sum(r => r.TaxAmount);
            var inTax  = ins.Sum(r => r.TaxAmount);

            history.Add(new VatPeriod
            {
                Label           = start.ToString("MMMM yyyy", CultureInfo.InvariantCulture),
                Start           = start.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                End             = end.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                OutputTax       = outTax,
                InputTax        = inTax,
                Net             = outTax - inTax,
                OutputDocuments = outs.Count(r => r.TaxAmount != 0m),
                InputDocuments  = ins.Count(r => r.TaxAmount != 0m),
            });
        }

        var period = history[0];

        // ── the filing deadline ───────────────────────────────────────
        // SPT Masa PPN for a month is due at the end of the month after it.
        var filingPeriod   = periodStart.AddMonths(-1);
        var filingDeadline = periodEnd;

        var filing = new FilingDeadline
        {
            Period         = filingPeriod.ToString("MMMM yyyy", CultureInfo.InvariantCulture),
            Deadline       = filingDeadline.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            DaysRemaining  = filingDeadline.DayNumber - today.DayNumber,
            StatusRecorded = false,
        };

        // ── gaps in the record ────────────────────────────────────────
        var draftTaxedInvoices = await _context.SalesInvoices
            .AsNoTracking()
            .CountAsync(i => i.CompanyId == companyId
                          && i.Status == InvoiceStatus.Draft
                          && i.TaxAmount != 0m
                          && i.InvoiceDate >= periodStart
                          && i.InvoiceDate <= periodEnd);

        var draftTaxedBills = await _context.PurchaseBills
            .AsNoTracking()
            .CountAsync(b => b.CompanyId == companyId
                          && b.Status == BillStatus.Draft
                          && b.TaxAmount != 0m
                          && b.BillDate >= periodStart
                          && b.BillDate <= periodEnd);

        // A faktur pajak carries the counterparty NPWP. Documents whose
        // counterparty has none cannot be exported, whatever the totals say.
        var invoiceContacts = await _context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.CompanyId == companyId
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Void
                     && i.TaxAmount != 0m
                     && i.InvoiceDate >= periodStart
                     && i.InvoiceDate <= periodEnd)
            .Select(i => i.ContactId)
            .Distinct()
            .ToListAsync();

        var billContacts = await _context.PurchaseBills
            .AsNoTracking()
            .Where(b => b.CompanyId == companyId
                     && b.Status != BillStatus.Draft
                     && b.Status != BillStatus.Void
                     && b.TaxAmount != 0m
                     && b.BillDate >= periodStart
                     && b.BillDate <= periodEnd)
            .Select(b => b.ContactId)
            .Distinct()
            .ToListAsync();

        var taxedContacts = invoiceContacts.Concat(billContacts).Distinct().ToList();

        // Counted by subtraction, not by matching the empty ones. A document
        // pointing at a counterparty with no Contacts row at all has no NPWP
        // either, and counting the blank TaxId rows directly would report it
        // as covered.
        var counterpartiesWithTaxId = taxedContacts.Count == 0
            ? 0
            : await _context.Contacts
                .AsNoTracking()
                .CountAsync(c => c.CompanyId == companyId
                              && taxedContacts.Contains(c.Id)
                              && c.TaxId != null
                              && c.TaxId != "");

        var counterpartiesWithoutTaxId = taxedContacts.Count - counterpartiesWithTaxId;

        var coverage = new TaxCoverage
        {
            CompanyTaxId               = string.IsNullOrWhiteSpace(company?.TaxId) ? null : company!.TaxId,
            CounterpartiesWithoutTaxId = counterpartiesWithoutTaxId,
            DraftTaxedInvoices         = draftTaxedInvoices,
            DraftTaxedBills            = draftTaxedBills,
        };

        // ── the work left ─────────────────────────────────────────────
        var outstanding = new List<OutstandingItem>();

        if (coverage.CompanyTaxId is null)
        {
            outstanding.Add(new OutstandingItem
            {
                Key         = "companyNpwp",
                Severity    = ModuleHealthStatus.Attention,
                Title       = "No NPWP recorded for this company",
                Detail      = "Both the faktur pajak and the SPT Masa PPN carry it. Nothing from this module can be exported without it.",
                Href        = "/dashboard/settings",
                ActionLabel = "Add NPWP",
            });
        }

        if (counterpartiesWithoutTaxId > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "counterpartyNpwp",
                Severity = ModuleHealthStatus.Attention,
                Count    = counterpartiesWithoutTaxId,
                Title    = counterpartiesWithoutTaxId == 1
                    ? "1 counterparty on a taxed document has no NPWP"
                    : $"{counterpartiesWithoutTaxId} counterparties on taxed documents have no NPWP",
                Detail      = "A faktur pajak carries the counterparty NPWP. These documents cannot be exported until it is recorded.",
                Href        = "/dashboard/contacts",
                ActionLabel = "Open contacts",
            });
        }

        var draftTaxed = draftTaxedInvoices + draftTaxedBills;
        if (draftTaxed > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "draftTaxedDocuments",
                Severity = ModuleHealthStatus.Attention,
                Count    = draftTaxed,
                Title    = draftTaxed == 1
                    ? "1 taxed document is still in draft"
                    : $"{draftTaxed} taxed documents are still in draft",
                Detail = (draftTaxedInvoices > 0 && draftTaxedBills > 0
                        ? string.Format(CultureInfo.InvariantCulture,
                            "{0} on the sales side, {1} on the purchase side. ",
                            draftTaxedInvoices, draftTaxedBills)
                        : string.Empty)
                    + "The PPN on them is excluded from the figures above until they leave Draft.",
                Href        = draftTaxedInvoices >= draftTaxedBills ? "/dashboard/sales" : "/dashboard/purchases",
                ActionLabel = "Review documents",
            });
        }

        if (filing.DaysRemaining <= 7)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "filingDeadline",
                Severity = ModuleHealthStatus.Attention,
                Count    = filing.DaysRemaining >= 0 ? filing.DaysRemaining : null,
                Title    = filing.DaysRemaining switch
                {
                    < 0 => $"SPT Masa PPN for {filing.Period} was due {Days(-filing.DaysRemaining)} ago",
                    0   => $"SPT Masa PPN for {filing.Period} is due today",
                    _   => $"SPT Masa PPN for {filing.Period} is due in {Days(filing.DaysRemaining)}",
                },
                Detail      = "BalanceIO tracks the deadline. It does not record whether the return was filed, and does not file it.",
                Href        = "/dashboard/reports",
                ActionLabel = "Open reports",
            });
        }

        return new TaxOverviewResponse
        {
            CompanyId   = companyId,
            Currency    = currency,
            GeneratedAt = DateTime.UtcNow,
            Module      = module,
            Period      = period,
            Filing      = filing,
            Outstanding = outstanding,
            History     = history,
            Coverage    = coverage,
        };
    }

    /// <summary>"1 day" / "3 days". The "day(s)" form is not English.</summary>
    private static string Days(int n) => n == 1 ? "1 day" : $"{n} days";

    // ── Inventory ─────────────────────────────────────────────────────
    // In balance when the book quantity matches the last stock opname.

    private async Task<ModuleHealth> InventoryAsync(Guid companyId, DateOnly today)
    {
        var stock = await _context.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.IsActive && p.TrackInventory)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Tracked   = g.Count(),
                Negative  = g.Count(p => p.StockOnHand < 0),
                NoAccount = g.Count(p => p.InventoryAccountId == null),
            })
            .FirstOrDefaultAsync();

        var tracked   = stock?.Tracked   ?? 0;
        var negative  = stock?.Negative  ?? 0;
        var noAccount = stock?.NoAccount ?? 0;

        var module = new ModuleHealth
        {
            Key  = "inventory",
            Name = "Inventory",
            Href = "/dashboard/inventory",
        };

        if (tracked == 0)
        {
            module.Status     = ModuleHealthStatus.Inactive;
            module.Headline   = "No tracked items";
            module.Detail     = "No product has inventory tracking switched on.";
            module.Figures.Add(Count("Items tracked", 0));
            return module;
        }

        // A counted difference that has not been processed is the literal
        // "book quantity does not match the count".
        var openVariance = await _context.StockOpnameLines
            .AsNoTracking()
            .CountAsync(l => l.StockOpname!.CompanyId == companyId
                          && l.StockOpname.Status == StockOpnameStatus.Draft
                          && l.Difference != 0m);

        var lastCount = await _context.StockOpnames
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId && o.Status == StockOpnameStatus.Processed)
            .OrderByDescending(o => o.OpnameDate)
            .Select(o => (DateOnly?)o.OpnameDate)
            .FirstOrDefaultAsync();

        module.Figures.Add(Count("Items tracked", tracked));
        module.Figures.Add(Count("Unreconciled", openVariance));

        if (noAccount > 0)
        {
            // The module's whole claim to a card here is that it posts to the
            // ledger. An item with no inventory account does not, so the
            // hub has to say so rather than leaving it to the module page.
            module.Status   = ModuleHealthStatus.Overdue;
            module.Headline = noAccount == 1
                ? "1 item has no inventory account"
                : $"{noAccount} items have no inventory account";
            module.Detail   = "Their movements post nowhere. COGS is understated by whatever they moved.";
        }
        else if (negative > 0)
        {
            // Negative stock is not a variance, it is impossible. Something
            // has been sold that was never received, and COGS is wrong.
            module.Status   = ModuleHealthStatus.Overdue;
            module.Headline = negative == 1
                ? "1 item at negative stock"
                : $"{negative} items at negative stock";
            module.Detail   = "Stock cannot be negative. COGS on the affected items is understated.";
        }
        else if (openVariance > 0)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = openVariance == 1
                ? "1 counted difference unprocessed"
                : $"{openVariance} counted differences unprocessed";
            module.Detail   = "A stock opname found differences that have not been posted as adjustments.";
        }
        else if (lastCount is null)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = "Never counted";
            module.Detail   = "No stock opname has been processed, so the book quantity is unverified.";
        }
        else
        {
            var daysSince = today.DayNumber - lastCount.Value.DayNumber;
            if (daysSince > 90)
            {
                module.Status   = ModuleHealthStatus.Attention;
                module.Headline = $"Last counted {daysSince} days ago";
                module.Detail   = string.Format(CultureInfo.InvariantCulture, "Stock opname {0:d MMM yyyy}. Over 90 days without a count.", lastCount.Value);
            }
            else
            {
                module.Status   = ModuleHealthStatus.Balanced;
                module.Headline = "Book quantity matches the last count";
                module.Detail   = string.Format(CultureInfo.InvariantCulture, "Stock opname {0:d MMM yyyy}, no unprocessed differences.", lastCount.Value);
            }
        }

        return module;
    }

    // ── Fixed Assets ──────────────────────────────────────────────────
    // In balance when depreciation is posted through the current period.

    private async Task<ModuleHealth> FixedAssetsAsync(Guid companyId, DateOnly today, string currency)
    {
        // Depreciation is posted monthly in arrears, so an asset is up to
        // date once it has been depreciated on or after the start of this
        // month.
        var currentPeriodStart = new DateOnly(today.Year, today.Month, 1);

        var activeAssets = _context.FixedAssets
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId && a.Status == AssetStatus.Active);

        var counts = await activeAssets
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Active = g.Count(),
                Behind = g.Count(a => a.LastDepreciationDate == null
                                   || a.LastDepreciationDate < currentPeriodStart),
                NoAccount = g.Count(a => a.DepreciationAccountId == null
                                      || a.AccumulatedDepreciationAccountId == null),
            })
            .FirstOrDefaultAsync();

        var active    = counts?.Active    ?? 0;
        var behind    = counts?.Behind    ?? 0;
        var noAccount = counts?.NoAccount ?? 0;

        // Net book value is money, so it goes through the exact adder.
        var bookValue = active == 0
            ? 0m
            : await SumExactAsync(activeAssets.Select(a => a.BookValue));

        var module = new ModuleHealth
        {
            Key  = "fixedAssets",
            Name = "Fixed Assets",
            Href = "/dashboard/assets",
        };

        if (active == 0)
        {
            module.Status   = ModuleHealthStatus.Inactive;
            module.Headline = "No active assets";
            module.Detail   = "Nothing on the register to depreciate.";
            module.Figures.Add(Count("Active assets", 0));
            return module;
        }

        module.Figures.Add(Money("Net book value", bookValue, currency));
        module.Figures.Add(Count("Awaiting depreciation", behind));

        if (noAccount > 0)
        {
            // Depreciation is the only reason this module has a card. An
            // asset missing either account cannot produce one, so this is a
            // harder failure than being a period behind.
            module.Status   = ModuleHealthStatus.Overdue;
            module.Headline = noAccount == 1
                ? "1 asset has no depreciation account"
                : $"{noAccount} assets have no depreciation account";
            module.Detail   = "Depreciation on them cannot post to the ledger at all. Expenses stay understated until the accounts are set.";
        }
        else if (behind > 0)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = behind == active
                ? string.Format(CultureInfo.InvariantCulture, "Depreciation not posted for {0:MMMM yyyy}", today)
                : $"{behind} of {active} assets not depreciated";
            module.Detail   = string.Format(CultureInfo.InvariantCulture, "Depreciation is outstanding for {0:MMMM yyyy}. Until it posts, expenses are understated.", today);
        }
        else
        {
            module.Status   = ModuleHealthStatus.Balanced;
            module.Headline = string.Format(CultureInfo.InvariantCulture, "Depreciation posted through {0:MMMM yyyy}", today);
            module.Detail   = active == 1
                ? "1 active asset on the register."
                : $"{active} active assets on the register.";
        }

        return module;
    }

    // ── Inventory, in depth ───────────────────────────────────────────
    // The module page. Same card as the hub, plus the position, the state
    // of counting, and the gaps that would stop a movement reaching the
    // ledger at all.

    public async Task<StockOverviewResponse> GetStockOverviewAsync(Guid companyId, DateOnly today)
    {
        var currency = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Currency)
            .FirstOrDefaultAsync() ?? "IDR";

        var module = await InventoryAsync(companyId, today);

        var tracked = _context.Products
            .AsNoTracking()
            .Where(p => p.CompanyId == companyId && p.IsActive && p.TrackInventory);

        var counts = await tracked
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Tracked  = g.Count(),
                Negative = g.Count(p => p.StockOnHand < 0),
                // A reorder level of zero is "not set", not "reorder at zero".
                LowStock = g.Count(p => p.ReorderLevel > 0m && p.StockOnHand <= p.ReorderLevel),
                NoAccount = g.Count(p => p.InventoryAccountId == null),
            })
            .FirstOrDefaultAsync();

        // Quantity times buy price, added as decimal. Not a costing method,
        // and the DTO says so.
        var stockAtBuyPrice = await SumExactAsync(tracked.Select(p => p.StockOnHand * p.BuyPrice));

        var position = new StockPosition
        {
            Tracked                 = counts?.Tracked ?? 0,
            Negative                = counts?.Negative ?? 0,
            LowStock                = counts?.LowStock ?? 0,
            WithoutInventoryAccount = counts?.NoAccount ?? 0,
            StockAtBuyPrice         = stockAtBuyPrice,
        };

        // ── counting ──────────────────────────────────────────────────
        var lastCount = await _context.StockOpnames
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId && o.Status == StockOpnameStatus.Processed)
            .OrderByDescending(o => o.OpnameDate)
            .Select(o => (DateOnly?)o.OpnameDate)
            .FirstOrDefaultAsync();

        var counting = new CountingState
        {
            OpenOpnames = await _context.StockOpnames
                .AsNoTracking()
                .CountAsync(o => o.CompanyId == companyId && o.Status == StockOpnameStatus.Draft),

            UnprocessedVariances = await _context.StockOpnameLines
                .AsNoTracking()
                .CountAsync(l => l.StockOpname!.CompanyId == companyId
                              && l.StockOpname.Status == StockOpnameStatus.Draft
                              && l.Difference != 0m),
        };

        if (lastCount.HasValue)
        {
            counting.LastCountDate  = lastCount.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            counting.DaysSinceCount = today.DayNumber - lastCount.Value.DayNumber;
        }

        // ── the work left ─────────────────────────────────────────────
        var outstanding = new List<OutstandingItem>();

        if (position.Negative > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "negativeStock",
                Severity = ModuleHealthStatus.Overdue,
                Count    = position.Negative,
                Title    = position.Negative == 1
                    ? "1 item is at negative stock"
                    : $"{position.Negative} items are at negative stock",
                Detail      = "A quantity below zero is impossible, not merely unusual. Something was sold that was never received, and COGS on those items is understated.",
                Href        = "/dashboard/inventory/items",
                ActionLabel = "Open items",
            });
        }

        if (position.WithoutInventoryAccount > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "noInventoryAccount",
                Severity = ModuleHealthStatus.Overdue,
                Count    = position.WithoutInventoryAccount,
                Title    = position.WithoutInventoryAccount == 1
                    ? "1 tracked item has no inventory account"
                    : $"{position.WithoutInventoryAccount} tracked items have no inventory account",
                Detail      = "Inventory only earns its place here because it posts to the ledger. Without an account, these movements post nowhere.",
                Href        = "/dashboard/inventory/items",
                ActionLabel = "Set accounts",
            });
        }

        if (counting.UnprocessedVariances > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "unprocessedVariance",
                Severity = ModuleHealthStatus.Attention,
                Count    = counting.UnprocessedVariances,
                Title    = counting.UnprocessedVariances == 1
                    ? "1 counted difference is unprocessed"
                    : $"{counting.UnprocessedVariances} counted differences are unprocessed",
                Detail      = "A stock opname found differences that have not been posted as adjustments. Until they are, the count and the books disagree.",
                Href        = "/dashboard/inventory/opname",
                ActionLabel = "Process opname",
            });
        }
        else if (counting.OpenOpnames > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "openOpname",
                Severity = ModuleHealthStatus.Attention,
                Count    = counting.OpenOpnames,
                Title    = counting.OpenOpnames == 1
                    ? "1 stock opname is still open"
                    : $"{counting.OpenOpnames} stock opnames are still open",
                Detail      = "Counted, with no differences so far, and not yet processed.",
                Href        = "/dashboard/inventory/opname",
                ActionLabel = "Open opname",
            });
        }

        if (position.Tracked > 0 && lastCount is null)
        {
            outstanding.Add(new OutstandingItem
            {
                Key         = "neverCounted",
                Severity    = ModuleHealthStatus.Attention,
                Title       = "Stock has never been counted",
                Detail      = "No opname has been processed, so nothing has ever confirmed that the book quantity matches the shelf.",
                Href        = "/dashboard/inventory/opname",
                ActionLabel = "Start a count",
            });
        }
        else if (counting.DaysSinceCount > 90)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "countOverdue",
                Severity = ModuleHealthStatus.Attention,
                Count    = counting.DaysSinceCount,
                Title    = $"Last counted {counting.DaysSinceCount} days ago",
                Detail   = string.Format(CultureInfo.InvariantCulture,
                    "Stock opname {0:d MMM yyyy}. Over 90 days without a count.", lastCount!.Value),
                Href        = "/dashboard/inventory/opname",
                ActionLabel = "Start a count",
            });
        }

        if (position.LowStock > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "lowStock",
                Severity = ModuleHealthStatus.Attention,
                Count    = position.LowStock,
                Title    = position.LowStock == 1
                    ? "1 item is at or below its reorder level"
                    : $"{position.LowStock} items are at or below their reorder level",
                Detail      = "An operational signal, not an accounting one. Nothing in the ledger is wrong because of it.",
                Href        = "/dashboard/inventory/items",
                ActionLabel = "Open items",
            });
        }

        // ── recent counts ─────────────────────────────────────────────
        var recentRows = await _context.StockOpnames
            .AsNoTracking()
            .Where(o => o.CompanyId == companyId)
            .OrderByDescending(o => o.OpnameDate)
            .ThenByDescending(o => o.CreatedAt)
            .Take(5)
            .Select(o => new
            {
                o.Id,
                o.OpnameNumber,
                o.OpnameDate,
                o.Status,
                Lines     = o.Lines.Count,
                Variances = o.Lines.Count(l => l.Difference != 0m),
            })
            .ToListAsync();

        var recent = recentRows.Select(o => new RecentOpname
        {
            Id        = o.Id,
            Number    = o.OpnameNumber,
            Date      = o.OpnameDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Status    = o.Status.ToString(),
            Lines     = o.Lines,
            Variances = o.Variances,
        }).ToList();

        return new StockOverviewResponse
        {
            CompanyId   = companyId,
            Currency    = currency,
            GeneratedAt = DateTime.UtcNow,
            Module      = module,
            Position    = position,
            Counting    = counting,
            Outstanding = outstanding,
            Recent      = recent,
        };
    }

    // ── Fixed Assets, in depth ────────────────────────────────────────
    // The register at cost, what is behind on depreciation, and the assets
    // whose depreciation could not post even if it were run.

    public async Task<AssetOverviewResponse> GetAssetOverviewAsync(Guid companyId, DateOnly today)
    {
        var currency = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Currency)
            .FirstOrDefaultAsync() ?? "IDR";

        var module = await FixedAssetsAsync(companyId, today, currency);

        var periodStart = new DateOnly(today.Year, today.Month, 1);

        var active = _context.FixedAssets
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId && a.Status == AssetStatus.Active);

        var counts = await active
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Active         = g.Count(),
                Behind         = g.Count(a => a.LastDepreciationDate == null
                                           || a.LastDepreciationDate < periodStart),
                NoCategory     = g.Count(a => a.CategoryId == null),
                NoAccount      = g.Count(a => a.DepreciationAccountId == null
                                           || a.AccumulatedDepreciationAccountId == null),
                FullyWrittenDown = g.Count(a => a.BookValue <= a.ResidualValue),
            })
            .FirstOrDefaultAsync();

        var activeCount = counts?.Active ?? 0;

        var register = new AssetRegister
        {
            Active   = activeCount,
            Disposed = await _context.FixedAssets
                .AsNoTracking()
                .CountAsync(a => a.CompanyId == companyId && a.Status != AssetStatus.Active),

            AcquisitionCost         = activeCount == 0 ? 0m : await SumExactAsync(active.Select(a => a.AcquisitionCost)),
            AccumulatedDepreciation = activeCount == 0 ? 0m : await SumExactAsync(active.Select(a => a.AccumulatedDepreciation)),
            BookValue               = activeCount == 0 ? 0m : await SumExactAsync(active.Select(a => a.BookValue)),

            WithoutCategory            = counts?.NoCategory ?? 0,
            WithoutDepreciationAccount = counts?.NoAccount ?? 0,
            FullyDepreciatedStillActive = counts?.FullyWrittenDown ?? 0,
        };

        // ── depreciation ──────────────────────────────────────────────
        var behind = counts?.Behind ?? 0;

        var postings = _context.AssetDepreciations
            .AsNoTracking()
            .Where(d => d.FixedAsset!.CompanyId == companyId);

        var lastPosted = await postings
            .OrderByDescending(d => d.DepreciationDate)
            .Select(d => (DateOnly?)d.DepreciationDate)
            .FirstOrDefaultAsync();

        var depreciation = new DepreciationState
        {
            Period   = today.ToString("MMMM yyyy", CultureInfo.InvariantCulture),
            Behind   = behind,
            UpToDate = activeCount - behind,
            PostedThisPeriod = await SumExactAsync(postings
                .Where(d => d.DepreciationDate >= periodStart)
                .Select(d => d.DepreciationAmount)),
        };

        if (lastPosted.HasValue)
        {
            depreciation.LastPostedDate = lastPosted.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        // ── the work left ─────────────────────────────────────────────
        var outstanding = new List<OutstandingItem>();

        if (register.WithoutDepreciationAccount > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "noDepreciationAccount",
                Severity = ModuleHealthStatus.Overdue,
                Count    = register.WithoutDepreciationAccount,
                Title    = register.WithoutDepreciationAccount == 1
                    ? "1 asset has no depreciation account"
                    : $"{register.WithoutDepreciationAccount} assets have no depreciation account",
                Detail      = "Fixed Assets earns its place here because depreciation posts to the ledger. Without both accounts set, it cannot.",
                Href        = "/dashboard/assets/register",
                ActionLabel = "Set accounts",
            });
        }

        if (behind > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "depreciationBehind",
                Severity = ModuleHealthStatus.Attention,
                Count    = behind,
                Title    = behind == activeCount
                    ? $"Depreciation is not posted for {depreciation.Period}"
                    : $"{behind} of {activeCount} assets are not depreciated for {depreciation.Period}",
                Detail      = "Until it posts, expenses are understated and the net book value on this page is higher than it should be.",
                Href        = "/dashboard/assets/depreciation",
                ActionLabel = "Run depreciation",
            });
        }

        if (register.FullyDepreciatedStillActive > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "fullyDepreciated",
                Severity = ModuleHealthStatus.Attention,
                Count    = register.FullyDepreciatedStillActive,
                Title    = register.FullyDepreciatedStillActive == 1
                    ? "1 asset is written down to residual value"
                    : $"{register.FullyDepreciatedStillActive} assets are written down to residual value",
                Detail      = "They have finished depreciating but are still Active on the register. Retire or dispose of them when they leave service.",
                Href        = "/dashboard/assets/disposal",
                ActionLabel = "Review disposals",
            });
        }

        if (register.WithoutCategory > 0)
        {
            outstanding.Add(new OutstandingItem
            {
                Key      = "noCategory",
                Severity = ModuleHealthStatus.Attention,
                Count    = register.WithoutCategory,
                Title    = register.WithoutCategory == 1
                    ? "1 asset has no category"
                    : $"{register.WithoutCategory} assets have no category",
                Detail      = "The asset register groups by category. Uncategorised assets fall out of that grouping in the schedule.",
                Href        = "/dashboard/assets/categories",
                ActionLabel = "Open categories",
            });
        }

        // ── recent postings ───────────────────────────────────────────
        var recentRows = await postings
            .OrderByDescending(d => d.DepreciationDate)
            .ThenByDescending(d => d.CreatedAt)
            .Take(5)
            .Select(d => new
            {
                d.Id,
                d.DepreciationDate,
                d.DepreciationAmount,
                d.JournalEntryId,
                AssetName = d.FixedAsset!.Name,
                AssetCode = d.FixedAsset.Code,
            })
            .ToListAsync();

        var recent = recentRows.Select(d => new RecentDepreciation
        {
            Id        = d.Id,
            AssetName = d.AssetName,
            AssetCode = string.IsNullOrWhiteSpace(d.AssetCode) ? null : d.AssetCode,
            Date      = d.DepreciationDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            Amount    = d.DepreciationAmount,
            Posted    = d.JournalEntryId != null,
        }).ToList();

        return new AssetOverviewResponse
        {
            CompanyId    = companyId,
            Currency     = currency,
            GeneratedAt  = DateTime.UtcNow,
            Module       = module,
            Register     = register,
            Depreciation = depreciation,
            Outstanding  = outstanding,
            Recent       = recent,
        };
    }

    // ── Payroll ───────────────────────────────────────────────────────

    // Posted when last month's run is on the ledger. Salary expense for a
    // closed month that never posted understates expenses and PPh 21
    // payable for that month, so a missing run is overdue, not pending.

    private async Task<ModuleHealth> PayrollAsync(Guid companyId, DateOnly today, string currency)
    {
        var module = new ModuleHealth
        {
            Key  = "payroll",
            Name = "Payroll",
            Href = "/dashboard/payroll",
        };

        var employees = await _context.EmployeeCompensations
            .AsNoTracking()
            .CountAsync(e => e.CompanyId == companyId && e.IsActive
                          && e.Contact!.IsEmployee && e.Contact.IsActive);

        var runs = await _context.PayrollRuns
            .AsNoTracking()
            .Where(r => r.CompanyId == companyId && r.Status != PayrollRunStatus.Void)
            .Select(r => new { r.Year, r.Month, r.Status, r.TotalNetPay, r.TotalGross, r.TotalPph21 })
            .ToListAsync();

        if (employees == 0 && runs.Count == 0)
        {
            module.Status   = ModuleHealthStatus.Inactive;
            module.Headline = "No employees on payroll";
            module.Detail   = "Mark contacts as employees and record their compensation to run payroll.";
            module.Figures.Add(Count("Employees", 0));
            return module;
        }

        var drafts = runs.Count(r => r.Status == PayrollRunStatus.Draft);
        var lastPosted = runs
            .Where(r => r.Status == PayrollRunStatus.Posted)
            .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month)
            .FirstOrDefault();

        var previous = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
        var previousPosted = runs.Any(r => r.Status == PayrollRunStatus.Posted
                                        && r.Year == previous.Year && r.Month == previous.Month);

        module.Figures.Add(lastPosted is null
            ? Count("Employees", employees)
            : Money("Last net pay", lastPosted.TotalNetPay, currency));
        module.Figures.Add(Count("Awaiting approval", drafts));

        if (!previousPosted && employees > 0)
        {
            module.Status   = ModuleHealthStatus.Overdue;
            module.Headline = string.Format(CultureInfo.InvariantCulture, "Payroll for {0:MMMM yyyy} not posted", previous);
            module.Detail   = "Salary expense, PPh 21 and BPJS for that month are missing from the ledger.";
        }
        else if (drafts > 0)
        {
            module.Status   = ModuleHealthStatus.Attention;
            module.Headline = drafts == 1 ? "1 run awaiting approval" : $"{drafts} runs awaiting approval";
            module.Detail   = "A calculated run reaches the ledger once a second person posts it.";
        }
        else
        {
            module.Status   = ModuleHealthStatus.Balanced;
            module.Headline = lastPosted is null
                ? "No run posted yet"
                : $"Posted through {PayrollService.PeriodLabel(lastPosted.Year, lastPosted.Month)}";
            module.Detail   = employees == 1 ? "1 employee on payroll." : $"{employees} employees on payroll.";
        }

        return module;
    }

    // ── exact aggregation ─────────────────────────────────────────────
    //
    // PostgreSQL maps decimal(19,4) to a true numeric, so SUM() there is
    // exact and belongs in the database.
    //
    // SQLite does not. The column type gives NUMERIC affinity, so a value
    // written as decimal is stored as REAL - a float - and SUM() adds
    // floats. A ledger that is exactly balanced in decimal then comes back
    // differing by ~1e-9, which the exact comparison below correctly
    // reports as out of balance. That is a false red alert on the single
    // most important check in the product, so on SQLite the values are
    // read and added as decimal instead.
    //
    // The slow path only ever runs against the development database.

    private async Task<(decimal Debit, decimal Credit)> SumDebitCreditAsync(
        IQueryable<JournalLine> lines)
    {
        if (_context.Database.IsSqlite())
        {
            var rows = await lines
                .Select(l => new { l.Debit, l.Credit })
                .ToListAsync();

            return (rows.Sum(r => r.Debit), rows.Sum(r => r.Credit));
        }

        var totals = await lines
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Debit  = g.Sum(l => l.Debit),
                Credit = g.Sum(l => l.Credit),
            })
            .FirstOrDefaultAsync();

        return (totals?.Debit ?? 0m, totals?.Credit ?? 0m);
    }

    private async Task<decimal> SumExactAsync(IQueryable<decimal> values)
    {
        if (_context.Database.IsSqlite())
        {
            return (await values.ToListAsync()).Sum();
        }

        return await values.SumAsync(v => (decimal?)v) ?? 0m;
    }

    // ── figure helpers ────────────────────────────────────────────────

    private static ModuleFigure Money(string label, decimal value, string currency) => new()
    {
        Label = label, Value = value, Format = ModuleFigureFormat.Money, Currency = currency,
    };

    private static ModuleFigure Count(string label, int value) => new()
    {
        Label = label, Value = value, Format = ModuleFigureFormat.Count,
    };
}
