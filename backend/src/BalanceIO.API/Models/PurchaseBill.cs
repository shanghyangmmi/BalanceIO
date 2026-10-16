using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Purchase Bill - Invoice received from vendor for goods/services purchased
/// </summary>
public class PurchaseBill
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(50)]
    public string BillNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? VendorInvoiceNumber { get; set; }

    [Required]
    public DateOnly BillDate { get; set; }

    [Required]
    public DateOnly DueDate { get; set; }

    [Required]
    public Guid ContactId { get; set; }
    public Contact? Contact { get; set; }

    // Link to Purchase Order if applicable
    public Guid? PurchaseOrderId { get; set; }
    public PurchaseOrder? PurchaseOrder { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    [Column(TypeName = "decimal(19,6)")]
    public decimal ExchangeRate { get; set; } = 1;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Subtotal { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal DiscountAmount { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal DiscountPercent { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Total { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal AmountPaid { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal AmountDue { get; set; }

    public BillStatus Status { get; set; } = BillStatus.Draft;

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    public string? Notes { get; set; }

    [MaxLength(100)]
    public string TemplateName { get; set; } = "classic";

    // Journal Entry generated when posted
    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    // Navigation
    public List<PurchaseBillLine> Lines { get; set; } = new();

    // Audit & Segregation of Duties
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    public DateTime? VoidedAt { get; set; }

    public Guid? CreatedByUserId { get; set; }
    [MaxLength(100)]
    public string? CreatedBy { get; set; }

    public Guid? ApprovedByUserId { get; set; }
    [MaxLength(100)]
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    [MaxLength(500)]
    public string? RejectionReason { get; set; }
}

public class PurchaseBillLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid PurchaseBillId { get; set; }
    public PurchaseBill? PurchaseBill { get; set; }

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

    [Column(TypeName = "decimal(19,4)")]
    public decimal UnitPrice { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal DiscountAmount { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal DiscountPercent { get; set; }

    public bool IsTaxable { get; set; } = true;

    [Column(TypeName = "decimal(5,2)")]
    public decimal TaxRate { get; set; } = 12;

    public DppScheme DppScheme { get; set; } = DppScheme.NilaiLain11Over12;

    [Column(TypeName = "decimal(19,4)")]
    public decimal DppAmount { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal PPnBMAmount { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal LineTotal { get; set; }

    public Guid? AccountId { get; set; }
    public Account? Account { get; set; }
}

public enum BillStatus
{
    Draft,
    Pending,
    Posted,
    PartiallyPaid,
    Paid,
    Void
}
