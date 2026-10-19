using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/company/support-grants")]
public class SupportGrantsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SupportGrantsController(ApplicationDbContext context)
    {
        _context = context;
    }

    public record CreateSupportGrantRequest(
        int DurationHours = 24,
        string Reason = "Customer assistance",
        Guid? GrantedToUserId = null,
        Guid? TicketId = null);

    [HttpGet]
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<IActionResult> GetAll()
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required." });

        var grants = await _context.SupportAccessGrants
            .Include(g => g.GrantedByUser)
            .OrderByDescending(g => g.ValidFrom)
            .Select(g => new
            {
                g.Id,
                g.CompanyId,
                g.ValidFrom,
                g.ValidUntil,
                g.Reason,
                g.IsRevoked,
                g.RevokedAt,
                g.TicketId,
                IsActive = !g.IsRevoked && g.ValidFrom <= DateTime.UtcNow && g.ValidUntil >= DateTime.UtcNow,
                GrantedByName = g.GrantedByUser != null ? g.GrantedByUser.Name : "Unknown",
                GrantedByEmail = g.GrantedByUser != null ? g.GrantedByUser.Email : ""
            })
            .ToListAsync();

        return Ok(grants);
    }

    [HttpGet("active")]
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<IActionResult> GetActive()
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required." });

        var now = DateTime.UtcNow;
        var grant = await _context.SupportAccessGrants
            .Include(g => g.GrantedByUser)
            .Where(g => !g.IsRevoked && g.ValidFrom <= now && g.ValidUntil >= now)
            .OrderByDescending(g => g.ValidUntil)
            .Select(g => new
            {
                g.Id,
                g.CompanyId,
                g.ValidFrom,
                g.ValidUntil,
                g.Reason,
                g.TicketId,
                GrantedByName = g.GrantedByUser != null ? g.GrantedByUser.Name : "Unknown",
                GrantedByEmail = g.GrantedByUser != null ? g.GrantedByUser.Email : ""
            })
            .FirstOrDefaultAsync();

        return Ok(new { hasActiveGrant = grant != null, grant });
    }

    [HttpPost]
    [RequiresPermission(Permissions.SettingsManage)]
    public async Task<IActionResult> Create([FromBody] CreateSupportGrantRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required." });

        if (request.DurationHours < 1 || request.DurationHours > 168)
        {
            return BadRequest(new { error = "INVALID_DURATION", message = "Grant duration must be between 1 hour and 168 hours (7 days)." });
        }

        var userId = GetUserId();
        var now = DateTime.UtcNow;

        var grant = new SupportAccessGrant
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            GrantedByUserId = userId,
            GrantedToUserId = request.GrantedToUserId,
            TicketId = request.TicketId,
            ValidFrom = now,
            ValidUntil = now.AddHours(request.DurationHours),
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Customer technical assistance" : request.Reason.Trim(),
            IsRevoked = false
        };

        _context.SupportAccessGrants.Add(grant);

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            UserId = userId,
            Action = "SUPPORT_GRANT_CREATED",
            TargetEntity = $"SupportAccessGrant:{grant.Id}",
            Details = $"Granted platform support access until {grant.ValidUntil:O}. Reason: {grant.Reason}",
            Timestamp = now
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Support access granted successfully.",
            grant = new
            {
                grant.Id,
                grant.ValidFrom,
                grant.ValidUntil,
                grant.Reason
            }
        });
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.SettingsManage)]
    public async Task<IActionResult> Revoke(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required." });

        var grant = await _context.SupportAccessGrants.FirstOrDefaultAsync(g => g.Id == id);
        if (grant == null)
            return NotFound();

        var userId = GetUserId();
        var now = DateTime.UtcNow;

        grant.IsRevoked = true;
        grant.RevokedAt = now;
        grant.RevokedByUserId = userId;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            UserId = userId,
            Action = "SUPPORT_GRANT_REVOKED",
            TargetEntity = $"SupportAccessGrant:{grant.Id}",
            Details = $"Revoked platform support access.",
            Timestamp = now
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Support access grant revoked." });
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (Guid.TryParse(sub, out var guid)) return guid;
        throw new InvalidOperationException("User ID not found in token claims.");
    }
}
