using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// The Fixed Assets module dashboard.
///
/// Fixed Assets earns its card because it produces depreciation. Every
/// figure here is a fact from the register; none of it decides a useful
/// life or a method for you.
/// </summary>
public class AssetOverviewResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    /// <summary>The hub's own card for this module, unedited.</summary>
    public ModuleHealth Module { get; set; } = new();

    public AssetRegister Register { get; set; } = new();
    public DepreciationState Depreciation { get; set; } = new();

    public List<OutstandingItem> Outstanding { get; set; } = new();

    /// <summary>The five most recent depreciation postings, newest first.</summary>
    public List<RecentDepreciation> Recent { get; set; } = new();
}

/// <summary>
/// The register at cost. Acquisition cost less accumulated depreciation is
/// the net book value, and the three are shown together so the reader can
/// see it rather than take it on trust.
/// </summary>
public class AssetRegister
{
    public int Active { get; set; }
    public int Disposed { get; set; }

    public decimal AcquisitionCost { get; set; }
    public decimal AccumulatedDepreciation { get; set; }
    public decimal BookValue { get; set; }

    /// <summary>Active assets with no category assigned.</summary>
    public int WithoutCategory { get; set; }

    /// <summary>
    /// Active assets with no depreciation or accumulated depreciation
    /// account. Their depreciation has nowhere to post.
    /// </summary>
    public int WithoutDepreciationAccount { get; set; }

    /// <summary>
    /// Active assets already written down to residual value. They are done
    /// depreciating but still sit on the register as Active.
    /// </summary>
    public int FullyDepreciatedStillActive { get; set; }
}

public class DepreciationState
{
    /// <summary>"August 2026" - the period being depreciated.</summary>
    public string Period { get; set; } = string.Empty;

    /// <summary>Active assets not yet depreciated for this period.</summary>
    public int Behind { get; set; }

    /// <summary>Active assets already depreciated for this period.</summary>
    public int UpToDate { get; set; }

    /// <summary>ISO date of the most recent depreciation posting, or null.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LastPostedDate { get; set; }

    /// <summary>Depreciation posted within this period.</summary>
    public decimal PostedThisPeriod { get; set; }
}

public class RecentDepreciation
{
    public Guid Id { get; set; }

    /// <summary>The asset the posting belongs to.</summary>
    public string AssetName { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? AssetCode { get; set; }

    /// <summary>ISO date.</summary>
    public string Date { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    /// <summary>False when the posting carries no journal entry reference.</summary>
    public bool Posted { get; set; }
}
