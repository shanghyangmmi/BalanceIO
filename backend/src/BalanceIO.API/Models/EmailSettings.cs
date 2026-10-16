using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

public class EmailSettings
{
    public Guid Id { get; set; }

    [Required]
    public string SmtpHost { get; set; } = string.Empty;

    [Required]
    public int SmtpPort { get; set; } = 587;

    [Required]
    public string SmtpUsername { get; set; } = string.Empty;

    public string SmtpPassword { get; set; } = string.Empty; // Should be encrypted in real app

    [Required]
    public string SenderEmail { get; set; } = string.Empty;

    [Required]
    public string SenderName { get; set; } = string.Empty;

    public bool EnableSsl { get; set; } = true;

    // To ensure only one settings record exists
    public bool IsActive { get; set; } = true;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
