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
}
