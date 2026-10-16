using BalanceIO.API.Services;
using BalanceIO.API.Security; // For Permissions constants if needed, though service handles resolution
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PermissionsController : ControllerBase
{
    private readonly IPermissionService _permissionService;

    public PermissionsController(IPermissionService permissionService)
    {
        _permissionService = permissionService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<IEnumerable<string>>> GetMyPermissions([FromQuery] Guid companyId)
    {
        if (companyId == Guid.Empty) return BadRequest("CompanyId is required");

        var userId = GetUserId();
        var permissions = await _permissionService.GetPermissionsAsync(userId, companyId);
        
        return Ok(permissions);
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                  
        if (Guid.TryParse(sub, out var guid)) return guid;
        throw new Exception("User ID not found in token");
    }
}
