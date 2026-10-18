using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public enum InventoryMovementType
{
    Purchase,
    Sale,
    OpnameAdjustment,
    ManualAdjustment,
    /// <summary>One leg of a move between warehouses: out of one, into the other. No value moves.</summary>
    Transfer,
    /// <summary>Aligns the movement record with stock that was recorded without one.</summary>
    OpeningBalance,
}

/// <summary>
/// Immutable record of stock movements and unit costs.
/// Required by PSAK 202 for calculating Cost of Goods Sold (COGS) and inventory valuation.
/// </summary>
public class InventoryMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    public Guid ProductId { get; set; }

    [ForeignKey("ProductId")]
    public Product? Product { get; set; }

    /// <summary>Where the stock moved. Null only on rows written before warehouses held stock.</summary>
    public Guid? WarehouseId { get; set; }

    [ForeignKey("WarehouseId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Warehouse? Warehouse { get; set; }

    [Required]
    public DateOnly MovementDate { get; set; }

    [Required]
    public InventoryMovementType Type { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Quantity { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal UnitCost { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalCost { get; set; }

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; }

    public Guid? JournalEntryId { get; set; }

    [ForeignKey("JournalEntryId")]
    public JournalEntry? JournalEntry { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
