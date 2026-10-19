using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using BalanceIO.API.Models;

namespace BalanceIO.API.Models;

public class FixedAssetCategory
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Required]
    [MaxLength(10)]
    public string CodePrefix { get; set; } = "AST"; // e.g. "VEH", "FUR"

    public int DefaultUsefulLifeMonths { get; set; } = 60;

    public DepreciationMethod DefaultDepreciationMethod { get; set; } = DepreciationMethod.StraightLine;

    /// <summary>
    /// True for intangibles — software licences, goodwill, patents.
    ///
    /// The arithmetic is identical to depreciation; what differs is the
    /// class of asset, the accounts it posts to, and the word used in the
    /// statements. Carrying the distinction on the category rather than on
    /// each asset means a company classifies once and every asset in the
    /// category follows.
    /// </summary>
    public bool IsIntangible { get; set; } = false;

    /// <summary>Fiscal group and method given to new assets in the category.</summary>
    public FiscalGroup DefaultFiscalGroup { get; set; } = FiscalGroup.NotSet;

    public FiscalMethod DefaultFiscalMethod { get; set; } = FiscalMethod.StraightLine;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
