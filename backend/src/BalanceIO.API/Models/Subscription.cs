using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Subscription - Links a Company to a Plan
/// </summary>
public class Subscription
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    public Company? Company { get; set; }

    [Required]
    public Guid PlanId { get; set; }

    [ForeignKey("PlanId")]
    public Plan? Plan { get; set; }

    [Required]
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;

    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime EndDate { get; set; }

    /// <summary>
    /// Whether to auto-renew when subscription expires
    /// </summary>
    public bool AutoRenew { get; set; } = true;

    /// <summary>
    /// Billing cycle: Monthly or Yearly
    /// </summary>
    [Required]
    public BillingCycle BillingCycle { get; set; } = BillingCycle.Monthly;

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    // Navigation
    public List<Payment> Payments { get; set; } = new();
}

public enum SubscriptionStatus
{
    Active,
    PastDue,
    Cancelled,
    Expired,
    Trial,
    Suspended
}

public enum BillingCycle
{
    Monthly,
    Yearly
}
