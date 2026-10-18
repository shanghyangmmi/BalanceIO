using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/audit-logs")]
public class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AuditLogsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequiresPermission(Permissions.AuditView)]
    public async Task<ActionResult<object>> GetLogs(
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 20)
    {
        var query = _context.AuditLogs
            .Include(l => l.User)
            .AsQueryable();

        var totalCount = await query.CountAsync();

        var logs = await query
            .OrderByDescending(l => l.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new 
            {
                l.Id,
                l.Action,
                l.TargetEntity,
                l.Details,
                l.IpAddress,
                l.Timestamp,
                UserName = l.User != null ? l.User.Name : "System",
                UserEmail = l.User != null ? l.User.Email : "",
                l.UserId
            })
            .ToListAsync();

        return Ok(new
        {
            data = logs,
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
    /// Searches and filters high-level document lifecycle audit events.
    /// Gated by Permissions.AuditView.
    /// </summary>
    [HttpGet("events")]
    [RequiresPermission(Permissions.AuditView)]
    public async Task<ActionResult<object>> GetEvents(
        [FromQuery] string? documentType = null,
        [FromQuery] Guid? documentId = null,
        [FromQuery] string? action = null,
        [FromQuery] Guid? actorUserId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        page = Math.Max(1, page);

        var query = _context.DocumentHistoryEvents.AsQueryable();

        if (!string.IsNullOrWhiteSpace(documentType))
            query = query.Where(e => e.DocumentType == documentType.Trim());

        if (documentId.HasValue)
            query = query.Where(e => e.DocumentId == documentId.Value);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(e => e.Action == action.Trim());

        if (actorUserId.HasValue)
            query = query.Where(e => e.ActorUserId == actorUserId.Value);

        if (from.HasValue)
            query = query.Where(e => e.Timestamp >= from.Value);

        if (to.HasValue)
            query = query.Where(e => e.Timestamp <= to.Value);

        var totalCount = await query.CountAsync();

        var events = await query
            .OrderByDescending(e => e.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.Id,
                e.CompanyId,
                e.DocumentType,
                e.DocumentId,
                e.Action,
                e.ActorUserId,
                e.ActorName,
                e.Timestamp,
                e.Reason,
                e.ReversalDocumentId,
                e.DiffSummaryJson,
                e.RowHash,
                e.PreviousHash
            })
            .ToListAsync();

        return Ok(new
        {
            data = events,
            pagination = new
            {
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            }
        });
    }
}
