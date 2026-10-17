using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

public enum WarehouseType
{
    Warehouse = 0,
    Store = 1,
    DistributionCenter = 2,
}

/// <summary>
/// A place stock is kept. Master data only: stock quantities and valuation
/// are company-wide, not held per warehouse.
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

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
