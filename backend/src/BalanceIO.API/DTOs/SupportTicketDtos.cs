using System.ComponentModel.DataAnnotations;
using BalanceIO.API.Models;

namespace BalanceIO.API.DTOs;

public class CreateSupportTicketDto
{
    [Required]
    [MaxLength(200)]
    public string Subject { get; set; } = string.Empty;

    public SupportTicketCategory Category { get; set; } = SupportTicketCategory.General;

    public SupportTicketPriority Priority { get; set; } = SupportTicketPriority.Medium;

    [Required]
    public string Message { get; set; } = string.Empty;

    public string? DiagnosticContextJson { get; set; }

    /// <summary>
    /// When checked, grants BalanceIO platform support operators read-only access
    /// to company data for the specified duration (default 24h) to diagnose the issue.
    /// </summary>
    public bool GrantSupportAccess { get; set; }

    public int? SupportAccessHours { get; set; } = 24;
}

public class AddTicketMessageDto
{
    [Required]
    public string MessageText { get; set; } = string.Empty;

    public bool IsInternalAdminNote { get; set; }

    public List<Guid>? AttachmentFileIds { get; set; }
}

public class UpdateTicketStatusDto
{
    [Required]
    public SupportTicketStatus Status { get; set; }
}

public class AssignTicketDto
{
    [Required]
    public Guid AdminUserId { get; set; }
}
