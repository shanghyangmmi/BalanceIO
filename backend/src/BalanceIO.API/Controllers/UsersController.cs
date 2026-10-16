using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly AuditService _auditService;

    private readonly ILogger<UsersController> _logger;

    public UsersController(ApplicationDbContext context, AuditService auditService, ILogger<UsersController> logger)
    {
        _context = context;
        _auditService = auditService;
        _logger = logger;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        
        if (user == null) return NotFound();

        return Ok(user);
    }

    [HttpGet("me/companies")]
    public async Task<IActionResult> GetMyCompanies()
    {
        try
        {
            var userId = GetUserId();
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound();

            // 2. Get companies linked to this user
            var userCompanies = await _context.UserCompanies
                .Include(uc => uc.Company)
                .Where(uc => uc.UserId == userId)
                .Select(uc => new 
                {
                    Id = uc.Company != null ? uc.Company.Id : Guid.Empty,
                    Name = uc.Company != null ? uc.Company.Name : "Unknown",
                    Currency = uc.Company != null ? uc.Company.Currency : "IDR",
                    uc.Role
                })
                .ToListAsync();

            // 3. A user with no company gets a company of their own. They are
            // never attached to an existing one: membership is granted by an
            // invitation from that company, not by being first in the table.
            if (!userCompanies.Any())
            {
                var company = new Company
                {
                    Name = $"{user.Name}'s company",
                    Currency = "IDR",
                };
                _context.Companies.Add(company);
                _context.UserCompanies.Add(new UserCompany { UserId = user.Id, CompanyId = company.Id, Role = RolePermissions.RoleOwner });
                await _context.SaveChangesAsync();

                return Ok(new[]
                {
                    new { company.Id, company.Name, company.Currency, Role = RolePermissions.RoleOwner },
                });
            }

            return Ok(userCompanies);
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Failed to load companies for the current user.");
             return StatusCode(500, new { message = "Could not load companies." });
        }
    }

    [HttpGet("company-users/{companyId}")]
    [RequiresPermission(Permissions.UsersView)]
    public async Task<IActionResult> GetCompanyUsers(Guid companyId)
    {
        // The permission was checked for the company in scope, so that is the
        // only company whose members may be listed.
        if (companyId != _context.CurrentCompanyId) return Forbid();

        var users = await _context.UserCompanies
            .Include(uc => uc.User)
            .Where(uc => uc.CompanyId == companyId)
            .Select(uc => new
            {
                uc.UserId,
                Name = uc.User != null ? uc.User.Name : "Unknown",
                Email = uc.User != null ? uc.User.Email : "Unknown",
                Role = uc.Role,
                JoinedAt = uc.JoinedAt,
                TwoFactorEnabled = uc.User != null && uc.User.TwoFactorEnabled
            })
            .ToListAsync();
        return Ok(users);
    }

    [HttpPut("update-mfa-status")]
    [RequiresPermission(Permissions.UsersManage)]
    public async Task<IActionResult> UpdateMfaStatus([FromBody] UpdateMfaStatusDTO request)
    {
        // 1. Verify Requesting User (Must be Owner/Manager)
        var requesterId = GetUserId();
        var requesterLink = await _context.UserCompanies
            .FirstOrDefaultAsync(uc => uc.UserId == requesterId && uc.CompanyId == request.CompanyId);

        if (requesterLink == null || (!requesterLink.Role.Equals("Owner") && !requesterLink.Role.Equals("Manager")))
        {
            return Forbid();
        }

        // 2. Get Target User
        var targetUser = await _context.Users.FindAsync(request.UserId);
        if (targetUser == null) return NotFound("User not found");

        // 3. Update Status
        targetUser.TwoFactorEnabled = request.Enabled;
        
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(requesterId, "MFA_UPDATE", targetUser.Id.ToString(), $"Changed 2FA status to {request.Enabled}");

        return Ok(new { message = $"2FA {(request.Enabled ? "Enabled" : "Disabled")} for {targetUser.Name}" });
    }

    [HttpPut("update-role")]
    [RequiresPermission(Permissions.UsersManage)]
    public async Task<IActionResult> UpdateRole([FromBody] UserRoleUpdateDTO request)
    {
        // Validate role - cannot assign "Owner" via this endpoint
        if (request.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot assign Owner role directly. Use transfer-ownership endpoint." });
        }

        var uc = await _context.UserCompanies
            .FirstOrDefaultAsync(x => x.UserId == request.UserId && x.CompanyId == request.CompanyId);

        if (uc == null) return NotFound();

        // Cannot change role of current Owner - must transfer first
        if (uc.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot change Owner's role. Transfer ownership first." });
        }

        uc.Role = request.Role;
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(GetUserId(), "ROLE_UPDATE", request.UserId.ToString(), $"Updated role to {request.Role}");

        return Ok(new { message = "Role updated successfully" });
    }

    [HttpPost("transfer-ownership")]
    [RequiresPermission(Permissions.UsersManage)]
    public async Task<IActionResult> TransferOwnership([FromBody] TransferOwnershipDTO request)
    {
        // Get current owner
        var currentOwner = await _context.UserCompanies
            .FirstOrDefaultAsync(x => x.CompanyId == request.CompanyId && x.Role == "Owner");

        if (currentOwner == null)
            return NotFound(new { message = "Current owner not found" });

        // Verify requester is the current owner (in production, check JWT claims)
        // For dev, we assume the request comes from owner

        // Get new owner's UserCompany record
        var newOwner = await _context.UserCompanies
            .FirstOrDefaultAsync(x => x.UserId == request.NewOwnerId && x.CompanyId == request.CompanyId);

        if (newOwner == null)
            return NotFound(new { message = "New owner must be an existing member of the company" });

        if (newOwner.UserId == currentOwner.UserId)
            return BadRequest(new { message = "User is already the owner" });

        // Transfer ownership
        currentOwner.Role = "Manager"; // Demote old owner to Manager
        newOwner.Role = "Owner";

        await _context.SaveChangesAsync();

        await _auditService.LogAsync(currentOwner.UserId, "OWNERSHIP_TRANSFER", request.CompanyId.ToString(), $"Transferred ownership to {request.NewOwnerId}");

        return Ok(new { message = "Ownership transferred successfully" });
    }

    [HttpPost("invite")]
    [RequiresPermission(Permissions.UsersManage)]
    public async Task<IActionResult> InviteUser([FromBody] InviteUserRequest request)
    {
        // Cannot invite as Owner
        if (request.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot invite user as Owner. Invite as Staff/Manager, then transfer ownership." });
        }

        var requesterId = GetUserId(); // Assuming logged in user invites (dev auth fix needed for real prod logic here if calling from non-auth context?)
        // Actually this endpoint is protected so GetUserId works.

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (user == null)
        {
            user = new User { Name = request.Name, Email = request.Email };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }

        var exists = await _context.UserCompanies.AnyAsync(uc => uc.UserId == user.Id && uc.CompanyId == request.CompanyId);
        if (!exists)
        {
            _context.UserCompanies.Add(new UserCompany { UserId = user.Id, CompanyId = request.CompanyId, Role = request.Role });
            await _context.SaveChangesAsync();
        }

        await _auditService.LogAsync(requesterId, "USER_INVITE", user.Id.ToString(), $"Invited {request.Email} as {request.Role}");

        return Ok(new { message = "User invited successfully" });
    }

    [HttpPost("remove-user")]
    [RequiresPermission(Permissions.UsersManage)]
    public async Task<IActionResult> RemoveUser([FromBody] RemoveUserRequest request)
    {
        var uc = await _context.UserCompanies
            .FirstOrDefaultAsync(x => x.UserId == request.UserId && x.CompanyId == request.CompanyId);

        if (uc == null) return NotFound("User not found in this company");

        if (uc.Role.Equals("Owner", StringComparison.OrdinalIgnoreCase) || uc.Role.Equals("Superadmin", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Cannot remove company Owner or Superadmin." });
        }

        _context.UserCompanies.Remove(uc);
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(GetUserId(), "USER_REMOVED", request.UserId.ToString(), $"Removed user from company");

        return Ok(new { message = "User removed from company successfully" });
    }

    private Guid GetUserId()
    {
        var idClaim = User.FindFirst(JwtRegisteredClaimNames.Sub) 
                      ?? User.FindFirst(ClaimTypes.NameIdentifier);
        
        if (idClaim == null) throw new UnauthorizedAccessException();
        return Guid.Parse(idClaim.Value);
    }
}

public class UserRoleUpdateDTO
{
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }
    public string Role { get; set; } = "Finance";
}

public class InviteUserRequest
{
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public Guid CompanyId { get; set; }
    public string Role { get; set; } = "Finance";
}

public class RemoveUserRequest
{
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }
}

public class TransferOwnershipDTO
{
    public Guid CompanyId { get; set; }
    public Guid NewOwnerId { get; set; }
}

public class UpdateMfaStatusDTO
{
    public Guid UserId { get; set; }
    public Guid CompanyId { get; set; }
    public bool Enabled { get; set; }
}
