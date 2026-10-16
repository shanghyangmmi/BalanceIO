using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

/// <summary>
/// Admin Users Management - View and manage all users
/// Requires Superadmin role
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "SuperAdmin")]
public class AdminUsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly Argon2PasswordHasher _passwordHasher;
    private readonly AuditService _auditService;

    public AdminUsersController(
        ApplicationDbContext context,
        Argon2PasswordHasher passwordHasher,
        AuditService auditService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _auditService = auditService;
    }

    /// <summary>
    /// Get all users in the system
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetAllUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var query = _context.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(u => 
                u.Name.Contains(search) || 
                u.Email.Contains(search));
        }

        var totalCount = await query.CountAsync();
        
        var users = await query
            .OrderByDescending(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.Name,
                u.Email,
                u.IsAdmin,
                u.TwoFactorEnabled,
                u.IsEmailVerified,
                u.CreatedAt,
                u.IsSuspended,
                u.SuspendedAt,
                u.SuspensionReason,
                CompanyCount = u.UserCompanies.Count,
                Companies = u.UserCompanies.Select(uc => new
                {
                    uc.CompanyId,
                    CompanyName = uc.Company != null ? uc.Company.Name : "N/A",
                    uc.Role,
                    uc.JoinedAt
                })
            })
            .ToListAsync();

        return Ok(new
        {
            data = users,
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
    /// Get user details by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetUserById(Guid id)
    {
        var user = await _context.Users
            .Include(u => u.UserCompanies)
            .ThenInclude(uc => uc.Company)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound();

        return Ok(new
        {
            user.Id,
            user.Name,
            user.Email,
            user.IsAdmin,
            user.TwoFactorEnabled,
            Companies = user.UserCompanies.Select(uc => new
            {
                uc.CompanyId,
                CompanyName = uc.Company?.Name,
                uc.Role,
                uc.JoinedAt
            })
        });
    }

    /// <summary>
    /// Update User Details (Email, Password)
    /// </summary>
    public class UpdateUserRequest
    {
        public string? Email { get; set; }
        public string? Password { get; set; }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateUser(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            // Check for duplicate email
            if (await _context.Users.AnyAsync(u => u.Email == request.Email && u.Id != id))
            {
                return BadRequest("Email already in use by another user.");
            }
            user.Email = request.Email;
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            // Hash password
            user.PasswordHash = _passwordHasher.HashPassword(request.Password);
        }

        await _context.SaveChangesAsync();

        return Ok(new { message = "User updated successfully" });
    }

    /// <summary>
    /// Set user as Superadmin
    /// </summary>
    [HttpPost("{id}/make-superadmin")]
    public async Task<ActionResult> MakeSuperadmin(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.IsAdmin = true;
        await _context.SaveChangesAsync();
        
        return Ok(new { message = "Superadmin role assigned", userId = id });
    }

    /// <summary>
    /// Reset MFA for a user (Emergency Access)
    /// </summary>
    [HttpPost("{id}/reset-mfa")]
    public async Task<ActionResult> ResetMfa(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.TwoFactorEnabled = false;
        user.TwoFactorSecret = null;
        await _context.SaveChangesAsync();
        
        return Ok(new { message = "MFA has been disabled for this user.", userId = id });
    }

    public record SuspensionRequest(string? Reason);

    /// <summary>
    /// Suspend a user. Takes effect on their next request, not on their
    /// next sign-in: the middleware checks this on every call, because the
    /// token they are already holding cannot be revoked.
    /// </summary>
    [HttpPost("{id}/suspend")]
    public async Task<ActionResult> SuspendUser(Guid id, [FromBody] SuspensionRequest? request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Suspending the last administrator locks everyone out of this
        // panel, including whoever is pressing the button.
        if (user.IsAdmin)
        {
            var otherAdmins = await _context.Users
                .CountAsync(u => u.IsAdmin && !u.IsSuspended && u.Id != id);

            if (otherAdmins == 0)
                return BadRequest(new { error = "This is the last active administrator." });
        }

        user.IsSuspended = true;
        user.SuspendedAt = DateTime.UtcNow;
        user.SuspensionReason = request?.Reason;

        await _context.SaveChangesAsync();
        await Audit("USER_SUSPENDED", user.Email, request?.Reason ?? "No reason given.");

        return Ok(new { message = "User suspended.", effectiveWithinSeconds = 30 });
    }

    [HttpPost("{id}/restore")]
    public async Task<ActionResult> RestoreUser(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.IsSuspended = false;
        user.SuspendedAt = null;
        user.SuspensionReason = null;

        await _context.SaveChangesAsync();
        await Audit("USER_RESTORED", user.Email, "Suspension lifted.");

        return Ok(new { message = "User restored." });
    }

    /// <summary>
    /// Delete a user permanently.
    ///
    /// Guarded twice over, because it was guarded not at all: one click
    /// removed the row and every company membership with it, and a user who
    /// had authored journal entries left those entries pointing at nobody.
    /// Suspension is what the panel should reach for; this exists for a
    /// signup that was never used and for erasure requests.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteUser(Guid id, [FromQuery] string? confirm)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (confirm != user.Email)
            return BadRequest(new
            {
                error = "Pass the user's own email address as confirm to delete them. " +
                        "Suspending is almost always what you want instead.",
            });

        if (user.IsAdmin)
        {
            var otherAdmins = await _context.Users.CountAsync(u => u.IsAdmin && u.Id != id);
            if (otherAdmins == 0)
                return BadRequest(new { error = "This is the last administrator." });
        }

        // Authorship is the usual reason a user cannot be removed. An entry
        // that says who posted it is worth more than a tidy table.
        var authored = await _context.JournalEntries
            .IgnoreQueryFilters()
            .CountAsync(j => j.CreatedByUserId == id);

        if (authored > 0)
            return Conflict(new
            {
                error = $"This user authored {authored:N0} journal entries. Deleting them " +
                        "would leave those entries without an author. Suspend instead.",
                authored,
            });

        var email = user.Email;

        var userCompanies = await _context.UserCompanies
            .Where(uc => uc.UserId == id)
            .ToListAsync();

        _context.UserCompanies.RemoveRange(userCompanies);
        _context.Users.Remove(user);

        await _context.SaveChangesAsync();
        await Audit("USER_DELETED", email, "Permanently removed.");

        return Ok(new { message = "User deleted." });
    }

    private Task Audit(string action, string target, string details) =>
        _auditService.LogAsync(
            CurrentUserId(), action, target, details,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"].ToString());

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirst("UserId")?.Value
               ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
