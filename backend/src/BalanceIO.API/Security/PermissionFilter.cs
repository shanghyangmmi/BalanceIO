using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace BalanceIO.API.Security;

public class PermissionFilter : IAsyncAuthorizationFilter
{
    private readonly string _requiredPermission;
    private readonly IPermissionService _permissionService;
    private readonly ApplicationDbContext _dbContext;

    public PermissionFilter(string permission, IPermissionService permissionService, ApplicationDbContext dbContext)
    {
        _requiredPermission = permission;
        _permissionService = permissionService;
        _dbContext = dbContext;
    }

    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        // 1. Check if user is authenticated
        if (context.HttpContext.User.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // 2. Get User ID
        var userIdStr = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId))
        {
            context.Result = new UnauthorizedResult();
            return;
        }

        // 3. Get Company Context
        // The CompanyScopeMiddleware runs BEFORE this filter, so _dbContext.CurrentCompanyId SHOULD be set.
        // However, Middleware pipeline -> Mvc pipeline (Filter). 
        // Need to ensure Middleware actually ran. It should have if registered in Program.cs.
        
        var companyId = _dbContext.CurrentCompanyId;

        // If no company context implies either:
        // a) X-Company-Id header missing
        // b) Header invalid
        // c) Endpoint doesn't require company context (unlikely if annotated with RequiresPermission)
        
        if (!companyId.HasValue)
        {
            // Try to fallback to header directly if DbContext not updated yet (sanity check)
             if (context.HttpContext.Request.Headers.TryGetValue("X-Company-Id", out var headerVal) 
                 && Guid.TryParse(headerVal, out var headerCid))
             {
                 companyId = headerCid;
             }
             else
             {
                 context.Result = new BadRequestObjectResult("Company Context Required for this action.");
                 return;
             }
        }

        // 4. Check Permission
        var hasPermission = await _permissionService.HasPermissionAsync(userId, companyId.Value, _requiredPermission);

        if (!hasPermission)
        {
            context.Result = new ForbidResult(); // 403 Forbidden
        }
    }
}
