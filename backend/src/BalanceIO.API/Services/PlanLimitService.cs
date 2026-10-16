using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Raised when a company has used everything its plan allows.
///
/// Deliberately not an authorisation failure. Nothing is wrong with the
/// request and nobody has done anything they should not have; the account
/// simply has to pay to continue, which is what 402 means and what the
/// module paywall already returns.
/// </summary>
public class PlanLimitExceededException : Exception
{
    public PlanLimitExceededException(string limitName, long used, long allowed, string message)
        : base(message)
    {
        LimitName = limitName;
        Used = used;
        Allowed = allowed;
    }

    public string LimitName { get; }
    public long Used { get; }
    public long Allowed { get; }
}

/// <summary>
/// What a plan allows, and how much of it has been used.
///
/// These numbers were editable in the admin panel long before anything
/// read them. MaxJournalEntries in particular could be set to any value and
/// the server would keep accepting journals, which made the free tier
/// unlimited and the paid tiers indistinguishable from it.
///
/// The counting window is a setting rather than a constant because the
/// column name does not say which one was meant. A running total makes the
/// free tier a trial that ends; a monthly allowance makes it a tier
/// somebody can stay on. Those are different businesses, so the choice
/// belongs to whoever is running one - it is not ours to hard-code.
/// </summary>
public class PlanLimitService
{
    private readonly ApplicationDbContext _context;

    public PlanLimitService(ApplicationDbContext context) => _context = context;

    public const string WindowSettingKey = "JOURNAL_LIMIT_WINDOW";

    /// <summary>Zero or less in a plan means no ceiling.</summary>
    public static bool IsUnlimited(long value) => value <= 0;

    /// <summary>
    /// Start of the counting window, or null when the limit is a running
    /// total over the life of the company.
    /// </summary>
    public static DateTime? WindowStart(string? window, DateTime nowUtc) =>
        string.Equals(window, "Total", StringComparison.OrdinalIgnoreCase)
            ? null
            : new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    public async Task<string> GetWindowAsync(CancellationToken ct = default)
    {
        var setting = await _context.SystemSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == WindowSettingKey, ct);

        return string.IsNullOrWhiteSpace(setting?.Value) ? "Month" : setting.Value;
    }

    /// <summary>
    /// Everything the admin panel needs to show one company's headroom:
    /// the plan it is on, what that plan allows, and what it has spent.
    /// </summary>
    public async Task<PlanUsage> GetUsageAsync(Guid companyId, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var subscription = await _context.Subscriptions
            .AsNoTracking()
            .Where(s => s.CompanyId == companyId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .Select(s => new
            {
                s.EndDate,
                PlanName = s.Plan!.Name,
                s.Plan.MaxUsers,
                s.Plan.MaxJournalEntries,
                s.Plan.MaxStorageMB,
            })
            .FirstOrDefaultAsync(ct);

        var live = subscription is not null && subscription.EndDate >= now;
        var window = await GetWindowAsync(ct);
        var from = WindowStart(window, now);

        var journalQuery = _context.JournalEntries
            .IgnoreQueryFilters()
            .Where(j => j.CompanyId == companyId);

        if (from is not null)
        {
            journalQuery = journalQuery.Where(j => j.CreatedAt >= from);
        }

        var journalsUsed = await journalQuery.CountAsync(ct);

        var usersUsed = await _context.UserCompanies
            .IgnoreQueryFilters()
            .CountAsync(uc => uc.CompanyId == companyId, ct);

        return new PlanUsage
        {
            CompanyId          = companyId,
            PlanName           = live ? subscription!.PlanName : null,
            Window             = window,
            WindowStart        = from,
            JournalEntriesUsed = journalsUsed,
            JournalEntriesMax  = live ? subscription!.MaxJournalEntries : 0,
            UsersUsed          = usersUsed,
            UsersMax           = live ? subscription!.MaxUsers : 0,
            StorageMaxMB       = live ? subscription!.MaxStorageMB : 0,
        };
    }
}

public class PlanUsage
{
    public Guid CompanyId { get; set; }

    /// <summary>Null when no subscription is live.</summary>
    public string? PlanName { get; set; }

    public string Window { get; set; } = "Month";
    public DateTime? WindowStart { get; set; }

    public int JournalEntriesUsed { get; set; }
    public int JournalEntriesMax { get; set; }

    public int UsersUsed { get; set; }
    public int UsersMax { get; set; }

    public long StorageMaxMB { get; set; }

    public bool JournalEntriesUnlimited => PlanLimitService.IsUnlimited(JournalEntriesMax);
    public bool UsersUnlimited => PlanLimitService.IsUnlimited(UsersMax);

    public int JournalEntriesRemaining =>
        JournalEntriesUnlimited ? int.MaxValue : Math.Max(0, JournalEntriesMax - JournalEntriesUsed);
}
