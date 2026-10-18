using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Line item for Sales Invoice.
/// </summary>
public class SalesInvoiceLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid SalesInvoiceId { get; set; }

    [ForeignKey("SalesInvoiceId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public SalesInvoice? SalesInvoice { get; set; }

    public int LineNumber { get; set; } = 1;

    // Product (optional - can be free-text)
    public Guid? ProductId { get; set; }

    [ForeignKey("ProductId")]
    public Product? Product { get; set; }

    // Description
    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    // Quantity & Pricing
    [Column(TypeName = "decimal(19,4)")]
    public decimal Quantity { get; set; } = 1;

    [MaxLength(20)]
    public string Unit { get; set; } = "pcs";

    [Column(TypeName = "decimal(19,4)")]
    public decimal UnitPrice { get; set; } = 0;

    // Discount
    [Column(TypeName = "decimal(19,4)")]
    public decimal DiscountAmount { get; set; } = 0;

    [Column(TypeName = "decimal(5,2)")]
    public decimal DiscountPercent { get; set; } = 0;

    // Tax
    public bool IsTaxable { get; set; } = true;

    [Column(TypeName = "decimal(5,2)")]
    public decimal TaxRate { get; set; } = 12; // PPN 12% (PMK 131/2024)

    public DppScheme DppScheme { get; set; } = DppScheme.NilaiLain11Over12;

    [Column(TypeName = "decimal(19,4)")]
    public decimal DppAmount { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal TaxAmount { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal PPnBMAmount { get; set; } = 0;

    // Line Total
    [Column(TypeName = "decimal(19,4)")]
    public decimal LineTotal { get; set; } = 0;

    // Account for revenue (default from product or manual)
    public Guid? AccountId { get; set; }

    [ForeignKey("AccountId")]
    public Account? Account { get; set; }

    // Dimensions
    public Guid? CostCenterId { get; set; }
    [ForeignKey("CostCenterId")]
    public CostCenter? CostCenter { get; set; }

    public Guid? ProjectId { get; set; }
    [ForeignKey("ProjectId")]
    public Project? Project { get; set; }
}
