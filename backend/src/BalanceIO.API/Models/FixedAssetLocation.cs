using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class FixedAssetLocation
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty; // e.g. "Main Office", "Warehouse A"

    public string? Address { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
