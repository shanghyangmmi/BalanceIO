using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// One sellable capability, priced on its own.
///
/// <see cref="Plan.Features"/> already existed and is display copy for the
/// pricing page - a JSON array of sentences nobody checks. This is the
/// other thing: a catalogue row with a key the server tests against, a
/// price of its own, and a set of plans that include it.
///
/// The separation matters because the two answer different questions.
/// "What does Pro get you?" is marketing. "May this company open the Tax
/// module?" is a decision the API has to make on every request, and it
/// cannot be made against a sentence.
///
/// A feature belongs to a module for grouping only. Entitlement to the
/// module door and entitlement to a feature inside it are separate: a plan
/// can open Tax without including Ekualisasi.
/// </summary>
public class PlatformFeature
{
    /// <summary>
    /// Stable identifier the code tests, e.g. "tax.equalisation". Never
    /// renamed once shipped - a rename silently revokes access for every
    /// company that bought it.
    /// </summary>
    [Key]
    [MaxLength(80)]
    public string Key { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Module key this feature is grouped under: accounting, tax,
    /// inventory, fixedAssets, payroll, or platform for anything that
    /// belongs to no module.
    /// </summary>
    [MaxLength(40)]
    public string Module { get; set; } = "platform";

    /// <summary>
    /// Price when bought on its own, on top of whatever plan the company
    /// already holds. Zero means it is not sold separately.
    /// </summary>
    [Column(TypeName = "decimal(19,4)")]
    public decimal PriceMonthly { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal PriceYearly { get; set; }

    /// <summary>
    /// Whether a company may buy this without changing plan. A feature can
    /// be priced and still not be sold as an add-on - some capabilities
    /// only make sense inside a tier.
    /// </summary>
    public bool IsAddOn { get; set; } = true;

    /// <summary>
    /// Retired features stay in the table. Deleting one would strip the
    /// meaning from every historical PlanFeature and SubscriptionAddOn row
    /// that referenced it.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public List<PlanFeature> PlanFeatures { get; set; } = new();
}

/// <summary>
/// A feature included in a plan. The answer to "fitur ini masuk paket yang
/// mana" - one row per pairing.
/// </summary>
public class PlanFeature
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PlanId { get; set; }

    [ForeignKey("PlanId")]
    public Plan? Plan { get; set; }

    [Required]
    [MaxLength(80)]
    public string FeatureKey { get; set; } = string.Empty;

    [ForeignKey("FeatureKey")]
    public PlatformFeature? Feature { get; set; }

    /// <summary>
    /// A row exists so the pairing can be recorded either way. Setting this
    /// false is an explicit exclusion, which reads differently from a
    /// missing row - it says someone decided, rather than that nobody has
    /// looked at this plan yet.
    /// </summary>
    public bool Included { get; set; } = true;

    /// <summary>
    /// Optional cap for a metered feature within this plan, e.g. how many
    /// e-Faktur exports a month. Null means unmetered.
    /// </summary>
    public int? Quota { get; set; }
}

/// <summary>
/// A feature a company bought outside its plan.
///
/// This is the paid door. A company on a plan that stops at Accounting can
/// reach Tax by buying it here, and the entitlement check treats the two
/// sources identically - the module opens whether it came with the tier or
/// was paid for separately.
/// </summary>
public class SubscriptionAddOn
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SubscriptionId { get; set; }

    [ForeignKey("SubscriptionId")]
    public Subscription? Subscription { get; set; }

    [Required]
    [MaxLength(80)]
    public string FeatureKey { get; set; } = string.Empty;

    [ForeignKey("FeatureKey")]
    public PlatformFeature? Feature { get; set; }

    /// <summary>
    /// The price agreed at purchase, not read live from the catalogue.
    /// Raising a list price must not silently reprice what somebody
    /// already bought.
    /// </summary>
    [Column(TypeName = "decimal(19,4)")]
    public decimal PricePaid { get; set; }

    [MaxLength(20)]
    public string BillingCycle { get; set; } = "Monthly";

    public DateTime StartsAt { get; set; } = DateTime.UtcNow;

    /// <summary>Null means it runs with the subscription.</summary>
    public DateTime? EndsAt { get; set; }

    public bool IsActive { get; set; } = true;

    [MaxLength(200)]
    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
