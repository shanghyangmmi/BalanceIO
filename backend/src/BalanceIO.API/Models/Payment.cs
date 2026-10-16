using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Payment - Records payment transactions (Midtrans integration)
/// </summary>
public class Payment
{
    public Guid Id { get; set; }

    [Required]
    public Guid SubscriptionId { get; set; }

    [ForeignKey("SubscriptionId")]
    public Subscription? Subscription { get; set; }

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
