using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

public class Notification
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string Message { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string Type { get; set; } = "info"; // info, success, warning, error

    public bool IsRead { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Optional link to entity
    public string? RelatedEntityId { get; set; }
    public string? RelatedEntityType { get; set; }
}
