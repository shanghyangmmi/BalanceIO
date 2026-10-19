using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// One attempt to pay for a plan, through whichever gateway is configured.
/// Created Pending when checkout starts; a verified gateway notification or
/// an admin confirmation moves it to Success and activates the plan.
/// </summary>
public class Payment
{
    public Guid Id { get; set; }

    /// <summary>The subscription the payment activated; set once it succeeds.</summary>
    public Guid? SubscriptionId { get; set; }

    [ForeignKey("SubscriptionId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Subscription? Subscription { get; set; }

    /// <summary>The company paying.</summary>
    public Guid? CompanyId { get; set; }

    /// <summary>The plan being bought.</summary>
    public Guid? PlanId { get; set; }

    /// <summary>monthly or yearly.</summary>
    [MaxLength(10)]
    public string? BillingCycle { get; set; }

    /// <summary>The gateway that handles it: manual, midtrans, ...</summary>
    [MaxLength(30)]
    public string? Provider { get; set; }

    /// <summary>Where the payer completes payment, when the gateway hosts a page.</summary>
    [MaxLength(500)]
    public string? CheckoutUrl { get; set; }

    [Required]
    [Column(TypeName = "decimal(19,4)")]
    public decimal Amount { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    /// <summary>
    /// Payment gateway reference ID (e.g., Midtrans order_id)
    /// </summary>
    [MaxLength(100)]
    public string? GatewayOrderId { get; set; }

    /// <summary>
    /// Payment gateway transaction ID
    /// </summary>
    [MaxLength(100)]
    public string? GatewayTransactionId { get; set; }

    /// <summary>
    /// Payment method used (e.g., "bank_transfer", "credit_card", "gopay")
    /// </summary>
    [MaxLength(50)]
    public string? PaymentMethod { get; set; }

    [Required]
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    /// <summary>
    /// Invoice number for this payment
    /// </summary>
    [MaxLength(50)]
    public string? InvoiceNumber { get; set; }

    /// <summary>
    /// Description/notes for this payment
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? ExpiredAt { get; set; }
    public DateTime? RefundedAt { get; set; }

    /// <summary>
    /// Raw webhook payload from payment gateway (for debugging)
    /// </summary>
    public string? WebhookPayload { get; set; }
}

public enum PaymentStatus
{
    Pending,
    Success,
    Failed,
    Expired,
    Refunded,
    Cancelled
}
