using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public enum InventoryMovementType
{
    Purchase,
    Sale,
    OpnameAdjustment,
    ManualAdjustment
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
