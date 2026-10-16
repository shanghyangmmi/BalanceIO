using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// The Accounting module dashboard - the floor between the hub and the
/// working pages.
///
/// It embeds the hub's own <see cref="ModuleHealth"/> card rather than
/// recomputing the status, so the two screens cannot disagree. A hub that
/// says "in balance" over a module page that says otherwise destroys trust
/// in both, and this is the module where trust is the product.
/// </summary>
public class AccountingOverviewResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";

    /// <summary>UTC. A snapshot, not a live feed.</summary>
    public DateTime GeneratedAt { get; set; }

    /// <summary>Byte-for-byte the card the hub renders for this module.</summary>
    public ModuleHealth Module { get; set; } = new();

    public LedgerBalance Balance { get; set; } = new();
    public PeriodState Period { get; set; } = new();

    /// <summary>
    /// The work left, worst first. Empty means there is genuinely nothing
    /// to do - which is a real state worth showing, not an error.
    /// </summary>
    public List<OutstandingItem> Outstanding { get; set; } = new();

    public LedgerShape Ledger { get; set; } = new();

    /// <summary>The five most recent posted entries. Orientation, not a report.</summary>
    public List<RecentEntry> Recent { get; set; } = new();
}

/// <summary>The accounting identity, stated as three numbers.</summary>
public class LedgerBalance
{
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }

    /// <summary>Debit minus credit. Exactly zero or the books are out.</summary>
    public decimal Difference { get; set; }

    /// <summary>
    /// Compared with <c>==</c>, never a tolerance. A ledger out by 0.0001
    /// is out.
    /// </summary>
    public bool IsBalanced { get; set; }

    public int PostedEntries { get; set; }
}

public class PeriodState
{
    /// <summary>ISO date, or null when no lock has ever been set.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LockDate { get; set; }

    /// <summary>ISO date. The last day of the previous month.</summary>
    public string ExpectedLockThrough { get; set; } = string.Empty;

    public bool IsSet { get; set; }
    public bool IsCurrent { get; set; }

    /// <summary>Whole months between the lock and where it should be. 0 when current.</summary>
    public int MonthsBehind { get; set; }
}

/// <summary>Size of the ledger. Context for the figures above it.</summary>
public class LedgerShape
{
    public int Accounts { get; set; }

    /// <summary>Active, non-header accounts - the ones an entry can post to.</summary>
    public int PostableAccounts { get; set; }

    public int EntriesThisMonth { get; set; }

    /// <summary>ISO date of the most recent posted entry, or null.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LastPostedDate { get; set; }
}

public class RecentEntry
{
    public Guid Id { get; set; }

    /// <summary>ISO date.</summary>
    public string Date { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Reference { get; set; }

    /// <summary>Total debits on the entry - the conventional entry amount.</summary>
    public decimal Amount { get; set; }

    public int Lines { get; set; }
}
