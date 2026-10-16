using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BalanceIO.API.Data;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Middleware;

/// <summary>
/// Establishes the tenant scope for the request from the
/// <c>X-Company-Id</c> header, after verifying the caller is actually a
/// member of that company.
///
/// This used to trust the header outright. Because
/// <see cref="ApplicationDbContext.CurrentCompanyId"/> drives every global
/// query filter, any authenticated user could read - and write - another
/// company's books by editing one header. No repository access, no
/// privilege escalation, one line of curl.
///
/// The check is a single lookup against the UserCompanies composite
/// primary key. It runs on every request that carries the header; an
/// indexed key probe is the right price for an authorisation decision,
/// and caching it would open a window where a revoked member still had
/// access.
/// </summary>
public class CompanyScopeMiddleware
{
    private const string HeaderName = "X-Company-Id";

    private readonly RequestDelegate _next;
    private readonly ILogger<CompanyScopeMiddleware> _logger;

    public CompanyScopeMiddleware(RequestDelegate next, ILogger<CompanyScopeMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext dbContext)
    {
        if (!context.Request.Headers.TryGetValue(HeaderName, out var raw) ||
            !Guid.TryParse(raw, out var companyId))
        {
            // No usable header. Scope stays unset and the endpoint decides
            // whether it can work without one.
            await _next(context);
            return;
        }

        // An anonymous request has no membership to check, and nothing it
        // can reach is tenant-scoped. Leave the scope unset rather than
        // granting it.
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        var userId = ResolveUserId(context.User);
        if (userId is null)
        {
            _logger.LogWarning(
                "Company scope denied: authenticated principal carries no usable subject claim.");
            await DenyAsync(context, companyId);
            return;
        }

        if (!await HasAccessAsync(dbContext, userId.Value, companyId))
        {
            // Worth a warning rather than information: a mismatch is either
            // a stale company selection in the client, or someone probing
            // another tenant. Both are worth seeing in the log.
            _logger.LogWarning(
                "Company scope denied: user {UserId} is not a member of company {CompanyId}.",
                userId, companyId);
            await DenyAsync(context, companyId);
            return;
        }

        dbContext.CurrentCompanyId = companyId;
        await _next(context);
    }

    /// <summary>
    /// JwtBearer maps <c>sub</c> onto <see cref="ClaimTypes.NameIdentifier"/>
    /// by default, so both spellings have to be tried - the same pair the
    /// controllers check.
    /// </summary>
    private static Guid? ResolveUserId(ClaimsPrincipal principal)
    {
        var value = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                    ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return Guid.TryParse(value, out var id) ? id : null;
    }

    private static async Task<bool> HasAccessAsync(
        ApplicationDbContext db, Guid userId, Guid companyId)
    {
        // The ordinary path: an explicit membership row.
        var isMember = await db.UserCompanies
            .AsNoTracking()
            .AnyAsync(uc => uc.UserId == userId && uc.CompanyId == companyId);

        if (isMember) return true;

        // Platform administrators may scope to any company. This is how
        // support works, and PermissionService already grants IsAdmin every
        // permission - refusing them here would only be inconsistent, not
        // safer. The lookup is second so the common path costs one query.
        return await db.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == userId && u.IsAdmin);
    }

    private static async Task DenyAsync(HttpContext context, Guid companyId)
    {
        // 403 rather than falling through with the scope unset. Unset
        // scope disables the global query filters entirely, so silently
        // continuing would turn a refused request into a cross-tenant
        // read - strictly worse than the hole being closed.
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new
        {
            error = "COMPANY_FORBIDDEN",
            message = "You do not have access to this company.",
            companyId,
        });
    }
}
