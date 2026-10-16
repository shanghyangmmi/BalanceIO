using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public enum DppScheme
{
    /// <summary>
    /// PMK 131/2024 default for non-luxury goods/services: DPP = 11/12 * Net, PPN = 12% * DPP (effective 11%).
    /// </summary>
    NilaiLain11Over12 = 0,

    /// <summary>
    /// Full 100% DPP. Standard for luxury goods (PPnBM) or historical invoices prior to 2025.
    /// </summary>
    Standard = 1,

    /// <summary>
    /// Specific percentage concessions (Besaran Tertentu e.g. 1.1%, 2.2%).
    /// </summary>
    BesaranTertentu = 2,

    /// <summary>
    /// 0% VAT (e.g. exports).
    /// </summary>
    ZeroRated = 3,

    /// <summary>
    /// Non-taxable / exempt.
    /// </summary>
    Exempt = 4
}

/// <summary>
/// Date-effective tax rates and DPP schemes per Indonesian tax regulations (UU HPP & PMK 131/2024).
/// </summary>
public class TaxRate
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Null for system-wide standard rates, non-null for tenant-specific customizations.
    /// </summary>
    public Guid? CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Column(TypeName = "decimal(5,2)")]
    public decimal Rate { get; set; } = 12;

    [Required]
    public DppScheme DppScheme { get; set; } = DppScheme.NilaiLain11Over12;

    [Required]
    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsSystemDefault { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
