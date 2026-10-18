using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Cost Centre for multi-department budgeting, expense allocation, and dimensional P&L reporting.
/// Supports hierarchical organization (Division -> Department -> Sub-unit).
/// </summary>
public class CostCenter
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
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    // Hierarchy (Parent-child tree)
    public Guid? ParentId { get; set; }

    [ForeignKey("ParentId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public CostCenter? Parent { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public ICollection<CostCenter> Children { get; set; } = new List<CostCenter>();

    // Manager / Lead
    public Guid? ManagerContactId { get; set; }

    [ForeignKey("ManagerContactId")]
    public Contact? ManagerContact { get; set; }

    public bool IsActive { get; set; } = true;

    public bool IsDiscontinued { get; set; } = false;

    public DateOnly? DiscontinuedDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }
}
