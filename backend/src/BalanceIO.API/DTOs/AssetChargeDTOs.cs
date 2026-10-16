using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// A periodic charge against the asset register: depreciation for tangible
/// assets, amortisation for intangible ones.
///
/// One shape for both because it is one machine. The arithmetic, the
/// rounding, the final-period remainder and the journal entry are
/// identical; what changes is the class of asset, the accounts, and the
/// word the statements use.
/// </summary>
public class AssetChargeOverviewResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    /// <summary>"August 2026" — the period a run would post into.</summary>
    public string Period { get; set; } = string.Empty;

    /// <summary>ISO date the run would use: the last day of the period.</summary>
    public string PostingDate { get; set; } = string.Empty;

    public AssetChargeTotals Totals { get; set; } = new();

    /// <summary>Every active intangible asset, whether or not it is due.</summary>
    public List<ChargeableAsset> Assets { get; set; } = new();

    /// <summary>
    /// Why a run would refuse, if it would. Empty means it can run.
    /// </summary>
    public List<string> Blockers { get; set; } = new();

    /// <summary>
    /// Intangible runs only: false when no category has been marked
    /// intangible, so there is nothing to amortise yet.
    /// </summary>
    public bool HasIntangibleCategories { get; set; }

    /// <summary>"depreciation" or "amortisation".</summary>
    public string Kind { get; set; } = "depreciation";
}

public class AssetChargeTotals
{
    public int Assets { get; set; }

    /// <summary>Assets not yet amortised for this period.</summary>
    public int Due { get; set; }

    public decimal AcquisitionCost { get; set; }
    public decimal AccumulatedCharge { get; set; }
    public decimal CarryingAmount { get; set; }

    /// <summary>What a run would post for this period.</summary>
    public decimal DueThisPeriod { get; set; }
}

public class ChargeableAsset
{
    public Guid Id { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Code { get; set; }

    public string Name { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Category { get; set; }

    public int UsefulLifeMonths { get; set; }

    public decimal AcquisitionCost { get; set; }
    public decimal AccumulatedCharge { get; set; }
    public decimal CarryingAmount { get; set; }

    /// <summary>The monthly charge, or what remains if less.</summary>
    public decimal MonthlyCharge { get; set; }

    /// <summary>ISO date of the last amortisation, or null.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LastChargedDate { get; set; }

    /// <summary>False once this period has been posted for this asset.</summary>
    public bool Due { get; set; }

    /// <summary>
    /// Why this asset would be skipped by a run. Null when it is fine.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Blocker { get; set; }
}

/// <summary>What a run actually did.</summary>
public class AssetChargeRunResult
{
    public string Period { get; set; } = string.Empty;
    public string PostingDate { get; set; } = string.Empty;

    public int AssetsCharged { get; set; }
    public decimal TotalCharge { get; set; }

    /// <summary>The posted entry this run produced, when it posted one.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public Guid? JournalEntryId { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? JournalReference { get; set; }

    /// <summary>Assets the run passed over, and why.</summary>
    public List<string> Skipped { get; set; } = new();
}
