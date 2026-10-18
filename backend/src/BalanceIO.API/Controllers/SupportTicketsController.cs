using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/support/tickets")]
public class SupportTicketsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ISupportTicketService _ticketService;

    public SupportTicketsController(ApplicationDbContext context, ISupportTicketService ticketService)
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
            ?? "User";
    }

    /// <summary>
    /// Creates a new support ticket with optional support access consent grant.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateTicket([FromBody] CreateSupportTicketDto dto)
    {
        var companyId = _context.CurrentCompanyId;
        if (!companyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "X-Company-Id context required." });

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.Subject) || string.IsNullOrWhiteSpace(dto.Message))
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Subject and Message are required." });

        var ticket = await _ticketService.CreateTicketAsync(
            companyId.Value,
            userId.Value,
            GetCurrentUserName(),
            dto);

        return CreatedAtAction(nameof(GetTicket), new { id = ticket.Id }, ticket);
    }

    /// <summary>
    /// Lists all support tickets for the active company.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetTickets(
        [FromQuery] SupportTicketStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = _context.SupportTickets
            .Include(t => t.CreatedByUser)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        var totalCount = await query.CountAsync();

        var tickets = await query
            .OrderByDescending(t => t.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.CompanyId,
                t.TicketNumber,
                t.Subject,
                t.Category,
                t.Priority,
                t.Status,
                CreatedByName = t.CreatedByUser != null ? t.CreatedByUser.Name : "User",
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
    /// Gets a support ticket and its message history.
    /// Strips internal admin notes to ensure confidentiality.
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetTicket(Guid id)
    {
        var ticket = await _context.SupportTickets
            .Include(t => t.CreatedByUser)
            .Include(t => t.Messages.Where(m => !m.IsInternalAdminNote))
                .ThenInclude(m => m.Attachments)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket == null)
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });

        return Ok(new
        {
            ticket.Id,
            ticket.CompanyId,
            ticket.TicketNumber,
            ticket.Subject,
            ticket.Category,
            ticket.Priority,
            ticket.Status,
            ticket.DiagnosticContextJson,
            CreatedByName = ticket.CreatedByUser != null ? ticket.CreatedByUser.Name : "User",
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
    /// Submits a reply to an existing support ticket.
    /// </summary>
    [HttpPost("{id}/messages")]
    public async Task<IActionResult> AddMessage(Guid id, [FromBody] AddTicketMessageDto dto)
    {
        var companyId = _context.CurrentCompanyId;
        if (!companyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "X-Company-Id context required." });

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        if (string.IsNullOrWhiteSpace(dto.MessageText))
            return BadRequest(new { code = "VALIDATION_FAILED", message = "MessageText is required." });

        try
        {
            var message = await _ticketService.AddMessageAsync(
                id,
                companyId.Value,
                userId.Value,
                GetCurrentUserName(),
                dto,
                isAdmin: false);

            return Ok(message);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });
        }
    }

    /// <summary>
    /// Allows the customer to close their support ticket.
    /// </summary>
    [HttpPost("{id}/close")]
    public async Task<IActionResult> CloseTicket(Guid id)
    {
        var companyId = _context.CurrentCompanyId;
        if (!companyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "X-Company-Id context required." });

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        try
        {
            var ticket = await _ticketService.CloseTicketAsync(id, companyId.Value, userId.Value);
            return Ok(new { ticket.Id, ticket.Status, ticket.ResolvedAt });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { code = "TICKET_NOT_FOUND", message = $"Ticket {id} not found." });
        }
    }
}
