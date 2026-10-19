using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// File attachment uploaded in association with a support ticket message.
/// </summary>
public class SupportTicketAttachment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid TicketMessageId { get; set; }

    [ForeignKey(nameof(TicketMessageId))]
    public SupportTicketMessage? TicketMessage { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company? Company { get; set; }

    [Required]
    public Guid StoredFileId { get; set; }

    [ForeignKey(nameof(StoredFileId))]
    public StoredFile? StoredFile { get; set; }

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    public long FileSize { get; set; }

    [Required]
    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
