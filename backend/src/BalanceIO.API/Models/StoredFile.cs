using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

public class StoredFile
{
    [Key]
    public Guid Id { get; set; }
    
    [Required]
    public string FileName { get; set; } = string.Empty;
    
    [Required]
    public string ContentType { get; set; } = string.Empty;
    
    public long Size { get; set; } // In Bytes
    
    [Required]
    public string Url { get; set; } = string.Empty;
    
    public Guid UserId { get; set; } // Owner
    
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
