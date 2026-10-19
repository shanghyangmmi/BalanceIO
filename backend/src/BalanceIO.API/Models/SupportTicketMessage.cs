using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// A message in a support ticket thread.
///
/// Internal admin notes (IsInternalAdminNote == true) are only accessible to
/// platform administrators and are stripped from tenant-facing responses.
/// </summary>
public class SupportTicketMessage
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid TicketId { get; set; }

    [ForeignKey(nameof(TicketId))]
    public SupportTicket? Ticket { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company? Company { get; set; }

    [Required]
    public Guid SenderUserId { get; set; }

    [ForeignKey(nameof(SenderUserId))]
    public User? SenderUser { get; set; }

    [Required]
    [MaxLength(100)]
    public string SenderName { get; set; } = string.Empty;

    public bool IsInternalAdminNote { get; set; }

    [Required]
    public string MessageText { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<SupportTicketAttachment> Attachments { get; set; } = new List<SupportTicketAttachment>();
}
