using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class ProductUnit
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(20)]
    public string Initials { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}
