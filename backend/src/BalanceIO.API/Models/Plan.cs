using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Subscription Plan - Defines pricing tiers
/// </summary>
public class Plan
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty; // Free, Pro, Enterprise

    [MaxLength(255)]
    public string? Description { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal PriceMonthly { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal PriceYearly { get; set; } = 0;

    /// <summary>
    /// Promotional monthly price. Charged instead of <see cref="PriceMonthly"/>
    /// for any monthly checkout started before <see cref="PromoEndsAt"/>;
    /// after that date everyone pays the normal price again. Yearly billing
    /// is never discounted by it.
    ///
    /// Both fields must be set for the promotion to run, and the promotional
    /// price must be below the normal one: a "promotion" that costs the same
    /// or more is a data-entry mistake, not an offer.
    /// </summary>
    [Column(TypeName = "decimal(19,4)")]
    public decimal? PromoPriceMonthly { get; set; }

    /// <summary>UTC instant the promotion stops applying to new checkouts.</summary>
    public DateTime? PromoEndsAt { get; set; }

    public bool IsPromoActive(DateTime utcNow) =>
        PromoPriceMonthly is decimal promo
        && PromoEndsAt is DateTime ends
        && utcNow < ends
        && promo > 0
        && promo < PriceMonthly;

    /// <summary>What a monthly checkout started at <paramref name="utcNow"/> is charged.</summary>
    public decimal EffectivePriceMonthly(DateTime utcNow) =>
        IsPromoActive(utcNow) ? PromoPriceMonthly!.Value : PriceMonthly;

    /// <summary>
    /// Feature list as JSON array
    /// </summary>
    [MaxLength(2000)]
    public string? Features { get; set; } // JSON: ["Feature 1", "Feature 2"]

    /// <summary>
    /// Which module doors this plan opens, as a JSON array of module keys:
    /// ["accounting","tax","inventory","fixedAssets"].
    ///
    /// Null means "not configured", which resolves to the core set rather
    /// than to everything - a plan nobody has priced should not quietly
    /// hand over every module.
    ///
    /// Separate from <see cref="Features"/>, which is display copy for the
    /// pricing page and is not read by any check.
    /// </summary>
    public string? Modules { get; set; }

    public int MaxUsers { get; set; } = 1;
    public int MaxCompanies { get; set; } = 1;

    public long MaxStorageMB { get; set; } = 100;
    public int MaxJournalEntries { get; set; } = 1000;

    /// <summary>
    /// Sort order for display
    /// </summary>
    public int SortOrder { get; set; } = 0;

    /// <summary>
    /// Whether this plan is visible to users
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Highlight this plan as recommended
    /// </summary>
    public bool IsPopular { get; set; } = false;

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
