using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Fixed Asset - Property, plant, and equipment (PPE)
/// </summary>
public class FixedAsset
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    /// <summary>Generated from the category prefix when the client sends none.</summary>
    [Required]
    [MaxLength(50)]
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }



    // Relationships
    public Guid? CategoryId { get; set; }
    public FixedAssetCategory? Category { get; set; }

    public Guid? LocationId { get; set; }
    public FixedAssetLocation? Location { get; set; }

    [MaxLength(100)]
    public string? SerialNumber { get; set; }

    // Acquisition
    [Required]
    public DateOnly AcquisitionDate { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal AcquisitionCost { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal ResidualValue { get; set; }

    // Depreciation
    public DepreciationMethod DepreciationMethod { get; set; } = DepreciationMethod.StraightLine;

    public int UsefulLifeMonths { get; set; } = 60; // 5 years default

    [Column(TypeName = "decimal(19,4)")]
    public decimal AccumulatedDepreciation { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal BookValue { get; set; }

    public DateOnly? LastDepreciationDate { get; set; }

    // Tax depreciation (UU PPh Pasal 11 and 11A as amended by UU HPP).
    // Kept beside the commercial figures, never in place of them.
    public FiscalGroup FiscalGroup { get; set; } = FiscalGroup.NotSet;

    public FiscalMethod FiscalMethod { get; set; } = FiscalMethod.StraightLine;

    /// <summary>
    /// A permanent building's actual useful life when it is longer than the
    /// 20 years the group sets (PMK 72/2023). Ignored for other groups.
    /// </summary>
    public int? FiscalUsefulLifeMonths { get; set; }

    // Status
    public AssetStatus Status { get; set; } = AssetStatus.Active;

    public DateOnly? DisposalDate { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal? DisposalAmount { get; set; }

    public string? DisposalReason { get; set; }

    /// <summary>The entry that brought the asset onto the books at cost.</summary>
    public Guid? AcquisitionJournalEntryId { get; set; }

    /// <summary>The entry that took the asset off the books.</summary>
    public Guid? DisposalJournalEntryId { get; set; }

    // Linked Accounts
    public Guid? AssetAccountId { get; set; }
    public Account? AssetAccount { get; set; }

    public Guid? DepreciationAccountId { get; set; }
    public Account? DepreciationAccount { get; set; }

    public Guid? AccumulatedDepreciationAccountId { get; set; }
    public Account? AccumulatedDepreciationAccount { get; set; }

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Kelompok harta for tax depreciation. NotSet keeps the asset out of the
/// fiscal schedule and the reconciliation; NotDepreciable is land.
/// </summary>
public enum FiscalGroup
{
    NotSet,
    Group1,
    Group2,
    Group3,
    Group4,
    PermanentBuilding,
    NonPermanentBuilding,
    NotDepreciable,
}

/// <summary>Buildings are straight line only; the other groups may use declining balance.</summary>
public enum FiscalMethod
{
    StraightLine,
    DecliningBalance,
}

public enum DepreciationMethod
{
    StraightLine,
    DecliningBalance,
    DoubleDecliningBalance,
    SumOfYearsDigits,
    UnitsOfProduction
}

public enum AssetStatus
{
    Active,
    FullyDepreciated,
    Disposed,
    Sold,
    WrittenOff
}

/// <summary>
/// Depreciation schedule entry
/// </summary>
public class AssetDepreciation
{
    public Guid Id { get; set; }

    [Required]
    public Guid FixedAssetId { get; set; }
    public FixedAsset? FixedAsset { get; set; }

    [Required]
    public DateOnly DepreciationDate { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal DepreciationAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal AccumulatedAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal BookValueAfter { get; set; }

    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
