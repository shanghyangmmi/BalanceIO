using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Goods Receipt Note (GRN) - Receipt of goods from vendor
/// </summary>
public class GoodsReceipt
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string ReceiptNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly ReceiptDate { get; set; }

    [Required]
    public Guid ContactId { get; set; }
    public Contact? Contact { get; set; }

    // Link to Purchase Order
    public Guid? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    [MaxLength(100)]
    public string? VendorDeliveryNote { get; set; }

    public GoodsReceiptStatus Status { get; set; } = GoodsReceiptStatus.Draft;

    public string? Notes { get; set; }

    // Navigation
    public List<GoodsReceiptLine> Lines { get; set; } = new();

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
}

public class GoodsReceiptLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid GoodsReceiptId { get; set; }
    public GoodsReceipt? GoodsReceipt { get; set; }

    public int LineNumber { get; set; }

    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Column(TypeName = "decimal(19,4)")]
    public decimal QuantityOrdered { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal QuantityReceived { get; set; }

    [MaxLength(20)]
    public string Unit { get; set; } = "pcs";

    // Link to original PO line
    public Guid? PurchaseOrderLineId { get; set; }
    public PurchaseOrderLine? PurchaseOrderLine { get; set; }
}

public enum GoodsReceiptStatus
{
    Draft,
    Pending,
    Posted,
    Cancelled
}
