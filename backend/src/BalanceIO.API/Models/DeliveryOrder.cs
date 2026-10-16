using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Delivery Order (DO) - Goods shipment to customer
/// </summary>
public class DeliveryOrder
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string DeliveryNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly DeliveryDate { get; set; }

    [Required]
    public Guid ContactId { get; set; }
    public Contact? Contact { get; set; }

    // Link to Sales Order
    public Guid? SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }

    [MaxLength(500)]
    public string? ShippingAddress { get; set; }

    [MaxLength(100)]
    public string? ShippingMethod { get; set; }

    [MaxLength(100)]
    public string? TrackingNumber { get; set; }

    public DeliveryOrderStatus Status { get; set; } = DeliveryOrderStatus.Draft;

    public string? Notes { get; set; }

    // Navigation
    public List<DeliveryOrderLine> Lines { get; set; } = new();

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ShippedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
}

public class DeliveryOrderLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid DeliveryOrderId { get; set; }
    public DeliveryOrder? DeliveryOrder { get; set; }

    public int LineNumber { get; set; }

    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Quantity { get; set; } = 1;

    [MaxLength(20)]
    public string Unit { get; set; } = "pcs";

    // Link to original sales order line
    public Guid? SalesOrderLineId { get; set; }
    public SalesOrderLine? SalesOrderLine { get; set; }
}

public enum DeliveryOrderStatus
{
    Draft,
    Pending,
    Shipped,
    Delivered,
    Cancelled
}
