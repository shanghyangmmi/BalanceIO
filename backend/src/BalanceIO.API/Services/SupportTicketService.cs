using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

public interface ISupportTicketService
{
    Task<SupportTicket> CreateTicketAsync(Guid companyId, Guid userId, string userName, CreateSupportTicketDto dto, CancellationToken ct = default);
    Task<SupportTicketMessage> AddMessageAsync(Guid ticketId, Guid companyId, Guid senderUserId, string senderName, AddTicketMessageDto dto, bool isAdmin, CancellationToken ct = default);
    Task<SupportTicket> CloseTicketAsync(Guid ticketId, Guid companyId, Guid userId, CancellationToken ct = default);
    Task<SupportTicket> UpdateStatusAsync(Guid ticketId, SupportTicketStatus newStatus, CancellationToken ct = default);
    Task<SupportTicket> AssignAdminAsync(Guid ticketId, Guid adminUserId, CancellationToken ct = default);
}

public class SupportTicketService : ISupportTicketService
{
    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;
    private readonly IEmailService _email;
    private readonly ILogger<SupportTicketService> _logger;

    public SupportTicketService(
        ApplicationDbContext db,
        INotificationService notifications,
        IEmailService email,
        ILogger<SupportTicketService> logger)
    {
        _db = db;
        _notifications = notifications;
        _email = email;
        _logger = logger;
    }

    public async Task<SupportTicket> CreateTicketAsync(Guid companyId, Guid userId, string userName, CreateSupportTicketDto dto, CancellationToken ct = default)
    {
        // 1. Generate human-readable ticket number (e.g. TICK-202610-0001)
        var monthPrefix = $"TICK-{DateTime.UtcNow:yyyyMM}-";
        var count = await _db.SupportTickets
            .IgnoreQueryFilters()
            .Where(t => t.TicketNumber.StartsWith(monthPrefix))
            .CountAsync(ct);

        var ticketNumber = $"{monthPrefix}{count + 1:D4}";

        var ticket = new SupportTicket
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            CreatedByUserId = userId,
            TicketNumber = ticketNumber,
            Category = dto.Category,
            Priority = dto.Priority,
            Status = SupportTicketStatus.Open,
            Subject = dto.Subject.Trim(),
            DiagnosticContextJson = dto.DiagnosticContextJson,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var initialMessage = new SupportTicketMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            CompanyId = companyId,
            SenderUserId = userId,
            SenderName = userName,
            IsInternalAdminNote = false,
            MessageText = dto.Message.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        ticket.Messages.Add(initialMessage);
        _db.SupportTickets.Add(ticket);

        // 2. Customer support access consent gate
        if (dto.GrantSupportAccess)
        {
            var hours = Math.Clamp(dto.SupportAccessHours ?? 24, 1, 168);
            var grant = new SupportAccessGrant
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                TicketId = ticket.Id,
                GrantedByUserId = userId,
                ValidFrom = DateTime.UtcNow,
                ValidUntil = DateTime.UtcNow.AddHours(hours),
                Reason = $"Support consent grant for ticket {ticketNumber}"
            };
            _db.SupportAccessGrants.Add(grant);
        }

        await _db.SaveChangesAsync(ct);

        // 3. Notify platform staff
        try
        {
            await _notifications.CreateAsync(
                title: $"New Support Ticket: {ticket.TicketNumber}",
                message: $"[{ticket.Category}] {ticket.Subject} from {userName}",
                type: "info",
                relatedEntityId: ticket.Id.ToString(),
                relatedEntityType: "SupportTicket");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create support ticket notification.");
        }

        return ticket;
    }

    public async Task<SupportTicketMessage> AddMessageAsync(
        Guid ticketId,
        Guid companyId,
        Guid senderUserId,
        string senderName,
        AddTicketMessageDto dto,
        bool isAdmin,
        CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket == null || (!isAdmin && ticket.CompanyId != companyId))
        {
            throw new KeyNotFoundException("Ticket not found.");
        }

        var isInternal = isAdmin && dto.IsInternalAdminNote;

        var message = new SupportTicketMessage
        {
            Id = Guid.NewGuid(),
            TicketId = ticket.Id,
            CompanyId = ticket.CompanyId,
            SenderUserId = senderUserId,
            SenderName = senderName,
            IsInternalAdminNote = isInternal,
            MessageText = dto.MessageText.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        // Attachments
        if (dto.AttachmentFileIds != null && dto.AttachmentFileIds.Count > 0)
        {
            var storedFiles = await _db.StoredFiles
                .Where(f => dto.AttachmentFileIds.Contains(f.Id))
                .ToListAsync(ct);

            foreach (var file in storedFiles)
            {
                message.Attachments.Add(new SupportTicketAttachment
                {
                    Id = Guid.NewGuid(),
                    TicketMessageId = message.Id,
                    CompanyId = ticket.CompanyId,
                    StoredFileId = file.Id,
                    FileName = file.FileName,
                    FileSize = file.Size,
                    ContentType = file.ContentType,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        _db.SupportTicketMessages.Add(message);

        // Status transitions on replies
        if (!isInternal)
        {
            if (isAdmin)
            {
                // Admin replied to customer
                ticket.Status = SupportTicketStatus.WaitingOnCustomer;
            }
            else
            {
                // Customer replied to admin
                if (ticket.Status == SupportTicketStatus.WaitingOnCustomer)
                {
                    ticket.Status = SupportTicketStatus.InProgress;
                }
            }
        }

        ticket.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Notify counterparty
        try
        {
            if (isAdmin && !isInternal)
            {
                var customer = await _db.Users.FindAsync(new object[] { ticket.CreatedByUserId }, ct);
                if (customer != null)
                {
                    await _notifications.CreateAsync(
                        title: $"Support Reply on {ticket.TicketNumber}",
                        message: $"Agent {senderName} replied to your support ticket.",
                        type: "info",
                        relatedEntityId: ticket.Id.ToString(),
                        relatedEntityType: "SupportTicket");

                    if (!string.IsNullOrEmpty(customer.Email))
                    {
                        await _email.SendEmailAsync(
                            customer.Email,
                            $"[BalanceIO Support] Reply on {ticket.TicketNumber}: {ticket.Subject}",
                            $"<p>Hello {customer.Name},</p><p>A support representative has replied to your ticket <strong>{ticket.TicketNumber}</strong>:</p><blockquote>{message.MessageText}</blockquote><p>You can respond directly within your BalanceIO dashboard.</p>");
                    }
                }
            }
            else if (!isAdmin)
            {
                await _notifications.CreateAsync(
                    title: $"Customer Reply on {ticket.TicketNumber}",
                    message: $"{senderName} replied to ticket {ticket.TicketNumber}.",
                    type: "info",
                    relatedEntityId: ticket.Id.ToString(),
                    relatedEntityType: "SupportTicket");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to send notification on ticket reply.");
        }

        return message;
    }

    public async Task<SupportTicket> CloseTicketAsync(Guid ticketId, Guid companyId, Guid userId, CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .FirstOrDefaultAsync(t => t.Id == ticketId && t.CompanyId == companyId, ct);

        if (ticket == null)
            throw new KeyNotFoundException("Ticket not found.");

        ticket.Status = SupportTicketStatus.Closed;
        ticket.ResolvedAt = DateTime.UtcNow;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ticket;
    }

    public async Task<SupportTicket> UpdateStatusAsync(Guid ticketId, SupportTicketStatus newStatus, CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket == null)
            throw new KeyNotFoundException("Ticket not found.");

        ticket.Status = newStatus;
        if (newStatus == SupportTicketStatus.Resolved || newStatus == SupportTicketStatus.Closed)
        {
            ticket.ResolvedAt = DateTime.UtcNow;
        }
        ticket.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        // Notify customer
        try
        {
            var customer = await _db.Users.FindAsync(new object[] { ticket.CreatedByUserId }, ct);
            if (customer != null)
            {
                await _notifications.CreateAsync(
                    title: $"Ticket Status Updated: {ticket.TicketNumber}",
                    message: $"Your ticket status is now {newStatus}.",
                    type: "info",
                    relatedEntityId: ticket.Id.ToString(),
                    relatedEntityType: "SupportTicket");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to notify customer of ticket status update.");
        }

        return ticket;
    }

    public async Task<SupportTicket> AssignAdminAsync(Guid ticketId, Guid adminUserId, CancellationToken ct = default)
    {
        var ticket = await _db.SupportTickets
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == ticketId, ct);

        if (ticket == null)
            throw new KeyNotFoundException("Ticket not found.");

        ticket.AssignedAdminUserId = adminUserId;
        ticket.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return ticket;
    }
}
