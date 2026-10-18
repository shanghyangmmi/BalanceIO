using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public enum SupportTicketCategory
{
    General = 0,
    Accounting = 1,
    Tax = 2,
    Billing = 3,
    Bug = 4
}

public enum SupportTicketPriority
{
    Low = 0,
    Medium = 1,
    High = 2,
    Urgent = 3
}

public enum SupportTicketStatus
{
    Open = 0,
    InProgress = 1,
    WaitingOnCustomer = 2,
    Resolved = 3,
    Closed = 4
}

/// <summary>
/// In-app support request raised by a tenant user.
///
/// Can link to a customer-consented SupportAccessGrant to permit read-only diagnostic
/// tenant inspection by platform support operators.
/// </summary>
public class SupportTicket
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company? Company { get; set; }

    [Required]
    public Guid CreatedByUserId { get; set; }

    [ForeignKey(nameof(CreatedByUserId))]
    public User? CreatedByUser { get; set; }

    public Guid? AssignedAdminUserId { get; set; }

    [ForeignKey(nameof(AssignedAdminUserId))]
    public User? AssignedAdminUser { get; set; }

    [Required]
    [MaxLength(50)]
    public string TicketNumber { get; set; } = string.Empty;

    public SupportTicketCategory Category { get; set; } = SupportTicketCategory.General;

    public SupportTicketPriority Priority { get; set; } = SupportTicketPriority.Medium;

    public SupportTicketStatus Status { get; set; } = SupportTicketStatus.Open;

    [Required]
    [MaxLength(200)]
    public string Subject { get; set; } = string.Empty;

    public string? DiagnosticContextJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ResolvedAt { get; set; }

    public ICollection<SupportTicketMessage> Messages { get; set; } = new List<SupportTicketMessage>();
}
