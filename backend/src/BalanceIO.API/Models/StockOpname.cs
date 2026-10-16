using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class StockOpname
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
    public string OpnameNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly OpnameDate { get; set; }

    public string? Description { get; set; }

    public StockOpnameStatus Status { get; set; } = StockOpnameStatus.Draft;

    // Navigation
    public List<StockOpnameLine> Lines { get; set; } = new();

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ProcessedAt { get; set; }
    public string? ProcessedBy { get; set; }
}

public class StockOpnameLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid StockOpnameId { get; set; }
    public StockOpname? StockOpname { get; set; }

    [Required]
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal SystemQty { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal PhysicalQty { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Difference { get; set; } // Physical - System

    public string? Notes { get; set; }
}

public enum StockOpnameStatus
{
    Draft,
    Processed, // Adjustments created
    Cancelled
}
