using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Product/Service entity for invoice line items.
/// </summary>
public class Product
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
    public string Code { get; set; } = string.Empty; // SKU

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    public ProductType Type { get; set; } = ProductType.Product;

    // Pricing
    [Column(TypeName = "decimal(19,4)")]
    public decimal SellPrice { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal BuyPrice { get; set; } = 0;

    // Tax
    public bool IsTaxable { get; set; } = true;

    [Column(TypeName = "decimal(5,2)")]
    public decimal TaxRate { get; set; } = 12; // PPN 12% (PMK 131/2024)

    public DppScheme DppScheme { get; set; } = DppScheme.NilaiLain11Over12;

    public bool IsLuxuryGood { get; set; } = false;

    [Column(TypeName = "decimal(5,2)")]
    public decimal PPnBMRate { get; set; } = 0;

    // Unit
    [MaxLength(20)]
    public string Unit { get; set; } = "pcs";

    // Inventory (for products only)
    public bool TrackInventory { get; set; } = false;

    [Column(TypeName = "decimal(19,4)")]
    public decimal StockOnHand { get; set; } = 0;

    [Column(TypeName = "decimal(19,4)")]
    public decimal ReorderLevel { get; set; } = 0;

    // Default Accounts
    public Guid? IncomeAccountId { get; set; }
    public Guid? ExpenseAccountId { get; set; }
    public Guid? InventoryAccountId { get; set; }

    // Navigation
    [ForeignKey("IncomeAccountId")]
    public Account? IncomeAccount { get; set; }

    [ForeignKey("ExpenseAccountId")]
    public Account? ExpenseAccount { get; set; }

    [ForeignKey("InventoryAccountId")]
    public Account? InventoryAccount { get; set; }

    // Status
    public bool IsActive { get; set; } = true;

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public enum ProductType
{
    Product,
    Service
}
