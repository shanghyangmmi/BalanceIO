using BalanceIO.API.Data;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

/// <summary>
/// The activity log, across every tenant.
///
/// This is the one place where reading past the company filter is the
/// intent rather than a bug - a platform administrator investigating a
/// support case or an abuse report needs to see what happened, and what
/// happened is spread across tenants. IgnoreQueryFilters is therefore
/// deliberate here and nowhere else.
///
/// The tenant-facing log at /api/audit-logs is a different screen with a
/// different rule, and it stays scoped to one company. The two must not be
/// confused: an ordinary user reading this endpoint would be reading
/// everybody's book-keeping.
///
/// Paged rather than returned whole. The table grows without bound and is
/// the first thing to reach six figures on a busy instance.
/// </summary>
[ApiController]
[Route("api/admin/activity")]
[Authorize(Roles = "SuperAdmin")]
public class AdminActivityController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminActivityController(ApplicationDbContext context) => _context = context;

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] string? action = null,
        [FromQuery] Guid? userId = null,
        [FromQuery] Guid? companyId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.AuditLogs.IgnoreQueryFilters().AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);

        if (userId is not null)
            query = query.Where(a => a.UserId == userId);

        if (companyId is not null)
            query = query.Where(a => a.CompanyId == companyId);

        if (from is not null)
            query = query.Where(a => a.Timestamp >= from);

        if (to is not null)
            query = query.Where(a => a.Timestamp <= to);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(a =>
                a.Action.Contains(term) ||
                (a.TargetEntity != null && a.TargetEntity.Contains(term)) ||
                (a.Details != null && a.Details.Contains(term)) ||
                (a.IpAddress != null && a.IpAddress.Contains(term)));
        }

        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.Timestamp,
                a.Action,
                a.TargetEntity,
                a.Details,
                a.IpAddress,
                a.Device,
                a.OperatingSystem,
                a.UserId,
                UserName = a.User != null ? a.User.Name : null,
                UserEmail = a.User != null ? a.User.Email : null,
                a.CompanyId,
                CompanyName = a.Company != null ? a.Company.Name : null,
            })
            .ToListAsync();

        return Ok(new
        {
            page,
            pageSize,
            total,
            totalPages = (int)Math.Ceiling(total / (double)pageSize),
            rows,
        });
    }

    /// <summary>
    /// The distinct action names, for the filter. Read from the data rather
    /// than from a hard-coded list, because the set grows every time
    /// somebody adds an audited operation and a stale list would quietly
    /// hide the newest ones.
    /// </summary>
    [HttpGet("actions")]
    public async Task<IActionResult> Actions()
    {
        var actions = await _context.AuditLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .GroupBy(a => a.Action)
            .Select(g => new { action = g.Key, count = g.Count() })
            .OrderByDescending(a => a.count)
            .Take(100)
            .ToListAsync();

        return Ok(actions);
    }

    /// <summary>
    /// Sign-in activity, which is what an abuse or account-sharing question
    /// actually turns on: how many distinct addresses, and from where.
    /// </summary>
    [HttpGet("sign-ins")]
    public async Task<IActionResult> SignIns([FromQuery] int days = 7)
    {
        var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 90));

        var rows = await _context.AuditLogs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(a => a.Timestamp >= since && a.Action.Contains("LOGIN"))
            .GroupBy(a => new { a.UserId, a.Action })
            .Select(g => new
            {
                g.Key.UserId,
                g.Key.Action,
                Count = g.Count(),
                DistinctAddresses = g.Select(a => a.IpAddress).Distinct().Count(),
                LastAt = g.Max(a => a.Timestamp),
            })
            .OrderByDescending(g => g.LastAt)
            .Take(200)
            .ToListAsync();

        var userIds = rows.Where(r => r.UserId != null).Select(r => r.UserId!.Value).Distinct().ToList();

        var users = await _context.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Name, u.Email })
            .ToListAsync();

        return Ok(new { since, rows, users });
    }
}
