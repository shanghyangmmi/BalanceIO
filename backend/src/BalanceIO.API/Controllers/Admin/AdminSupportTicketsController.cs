using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

[ApiController]
[Route("api/admin/support/tickets")]
[Authorize(Roles = "SuperAdmin")]
public class AdminSupportTicketsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ISupportTicketService _ticketService;

    public AdminSupportTicketsController(ApplicationDbContext context, ISupportTicketService ticketService)
    {
        _context = context;
        _ticketService = ticketService;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string GetCurrentUserName()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value
            ?? "Admin";
    }

    /// <summary>
    /// Lists all support tickets across all tenants with company metadata and SLA indicators.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllTickets(
        [FromQuery] SupportTicketStatus? status = null,
        [FromQuery] SupportTicketPriority? priority = null,
        [FromQuery] SupportTicketCategory? category = null,
        [FromQuery] Guid? companyId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);
        page = Math.Max(1, page);

        var query = _context.SupportTickets
            .IgnoreQueryFilters()
            .Include(t => t.Company)
            .Include(t => t.CreatedByUser)
            .Include(t => t.AssignedAdminUser)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        if (priority.HasValue)
            query = query.Where(t => t.Priority == priority.Value);

        if (category.HasValue)
            query = query.Where(t => t.Category == category.Value);

        if (companyId.HasValue)
            query = query.Where(t => t.CompanyId == companyId.Value);

        var totalCount = await query.CountAsync();

        var tickets = await query
            .OrderByDescending(t => t.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.CompanyId,
                CompanyName = t.Company != null ? t.Company.Name : "Unknown",
                t.TicketNumber,
                t.Subject,
                t.Category,
                t.Priority,
                t.Status,
                CreatedByName = t.CreatedByUser != null ? t.CreatedByUser.Name : "User",
                CreatedByEmail = t.CreatedByUser != null ? t.CreatedByUser.Email : "",
                AssignedAdminName = t.AssignedAdminUser != null ? t.AssignedAdminUser.Name : null,
                t.CreatedAt,
                t.UpdatedAt,
                t.ResolvedAt
            })
            .ToListAsync();

        return Ok(new
        {
            data = tickets,
            pagination = new
            {
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            }
        });
    }

    /// <summary>
    /// Gets ticket detail and complete message thread (including internal admin notes).
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetTicket(Guid id)
    {
        var ticket = await _context.SupportTickets
            .IgnoreQueryFilters()
            .Include(t => t.Company)
            .Include(t => t.CreatedByUser)
            .Include(t => t.AssignedAdminUser)
            .Include(t => t.Messages)
                .ThenInclude(m => m.Attachments)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });

        return Ok(new
        {
            ticket.Id,
            ticket.CompanyId,
            CompanyName = ticket.Company != null ? ticket.Company.Name : "Unknown",
            ticket.TicketNumber,
            ticket.Subject,
            ticket.Category,
            ticket.Priority,
            ticket.Status,
            ticket.DiagnosticContextJson,
            CreatedByName = ticket.CreatedByUser != null ? ticket.CreatedByUser.Name : "User",
            CreatedByEmail = ticket.CreatedByUser != null ? ticket.CreatedByUser.Email : "",
            AssignedAdminId = ticket.AssignedAdminUserId,
            AssignedAdminName = ticket.AssignedAdminUser != null ? ticket.AssignedAdminUser.Name : null,
            ticket.CreatedAt,
            ticket.UpdatedAt,
            ticket.ResolvedAt,
            Messages = ticket.Messages
                .OrderBy(m => m.CreatedAt)
                .Select(m => new
                {
                    m.Id,
                    m.SenderUserId,
                    m.SenderName,
                    m.IsInternalAdminNote,
                    m.MessageText,
                    m.CreatedAt,
                    Attachments = m.Attachments.Select(a => new
                    {
                        a.Id,
                        a.StoredFileId,
                        a.FileName,
                        a.FileSize,
                        a.ContentType
                    })
                })
        });
    }

    /// <summary>
    /// Assigns ticket to an administrative user.
    /// </summary>
    [HttpPost("{id}/assign")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignTicketDto dto)
    {
        try
        {
            var ticket = await _ticketService.AssignAdminAsync(id, dto.AdminUserId);
            return Ok(new { ticket.Id, ticket.AssignedAdminUserId });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });
        }
    }

    /// <summary>
    /// Posts a platform operator reply (public or internal admin note).
    /// </summary>
    [HttpPost("{id}/messages")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddTicketMessageDto dto)
    {
        var adminId = GetCurrentUserId();
        if (!adminId.HasValue) return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.MessageText))
            return BadRequest(new { code = "VALIDATION_FAILED", message = "MessageText is required." });

        try
        {
            var message = await _ticketService.AddMessageAsync(
                id,
                companyId: Guid.Empty, // Admin crosses tenant
                adminId.Value,
                GetCurrentUserName(),
                dto,
                isAdmin: true);

            return Ok(message);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });
        }
    }

    /// <summary>
    /// Updates ticket status (e.g. InProgress, WaitingOnCustomer, Resolved, Closed).
    /// </summary>
    [HttpPost("{id}/status")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateTicketStatusDto dto)
    {
        try
        {
            var ticket = await _ticketService.UpdateStatusAsync(id, dto.Status);
            return Ok(new { ticket.Id, ticket.Status, ticket.ResolvedAt });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });
        }
    }
}
