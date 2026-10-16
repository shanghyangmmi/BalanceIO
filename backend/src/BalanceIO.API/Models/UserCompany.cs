using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BalanceIO.API.Models;

public class UserCompany
{
    public Guid UserId { get; set; }
    
    [ForeignKey("UserId")]
    [JsonIgnore]
    public User? User { get; set; }

    public Guid CompanyId { get; set; }
    
    [ForeignKey("CompanyId")]
    [JsonIgnore] // Avoid circular ref in main fetch, but might need DTO later
    public Company? Company { get; set; }

    [Required]
    [MaxLength(50)]
    public string Role { get; set; } = "Staff"; // Owner, Manager, Staff

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
