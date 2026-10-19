using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

public enum WarehouseType
{
    Warehouse = 0,
    Store = 1,
    DistributionCenter = 2,
}

/// <summary>
/// A place stock is kept. Stock per warehouse is the sum of the inventory
/// movements recorded against it; Product.StockOnHand is the company-wide
/// total of the same movements. Every company with stock has exactly one
/// default warehouse, which receives movements that name none.
/// </summary>
public class Warehouse
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(300)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    public WarehouseType Type { get; set; } = WarehouseType.Warehouse;

    public bool IsActive { get; set; } = true;

    /// <summary>Receives movements that name no warehouse. One per company.</summary>
    public bool IsDefault { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
