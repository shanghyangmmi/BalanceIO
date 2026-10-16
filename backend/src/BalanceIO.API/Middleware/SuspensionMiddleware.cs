using System.Security.Claims;
using BalanceIO.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace BalanceIO.API.Middleware;

/// <summary>
/// Stops a suspended user or a suspended company at the door.
///
/// Suspension has to be checked per request, not at sign-in. The token is
/// a JWT: nothing revokes it, and nothing on the server knows it exists.
/// Suspending an account that had signed in an hour earlier would
/// otherwise do nothing at all until the token expired - which is to say,
/// the button in the admin panel would lie.
///
/// The cost is one indexed lookup per request, cached briefly. Thirty
/// seconds is the compromise: short enough that "suspend" means suspended
/// now rather than eventually, long enough that a busy tenant is not
/// re-reading the same two rows on every call. Caching for the token's
/// lifetime would put us back where we started.
///
/// A suspended account still gets 403 and an explanation rather than a
/// blank 401. Someone who has been suspended is usually about to contact
/// support, and "Unauthorized" sends them to reset a password that works.
/// </summary>
public class SuspensionMiddleware
{
    private const string CompanyHeader = "X-Company-Id";
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);

    private readonly RequestDelegate _next;

    public SuspensionMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext db, IMemoryCache cache)
    {
        if (context.User?.Identity?.IsAuthenticated != true)
        {
            await _next(context);
            return;
        }

        // Sign-out must keep working while suspended, or the session sits
        // there with no way to end it.
        var path = context.Request.Path.Value ?? string.Empty;
        if (path.StartsWith("/api/auth/logout", StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var userId = ResolveUserId(context.User);
        if (userId is not null)
        {
            var suspension = await cache.GetOrCreateAsync($"suspend:user:{userId}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;
                return await db.Users
                    .AsNoTracking()
                    .Where(u => u.Id == userId)
                    .Select(u => new Suspension(u.IsSuspended, u.SuspensionReason))
                    .FirstOrDefaultAsync();
            });

            if (suspension is { IsSuspended: true })
            {
                await Refuse(context, "ACCOUNT_SUSPENDED",
                    "This account has been suspended.", suspension.Reason);
                return;
            }
        }

        if (context.Request.Headers.TryGetValue(CompanyHeader, out var raw) &&
            Guid.TryParse(raw, out var companyId))
        {
            var suspension = await cache.GetOrCreateAsync($"suspend:company:{companyId}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheFor;
                return await db.Companies
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(c => c.Id == companyId)
                    .Select(c => new Suspension(c.IsSuspended, c.SuspensionReason))
                    .FirstOrDefaultAsync();
            });

            if (suspension is { IsSuspended: true })
            {
                await Refuse(context, "COMPANY_SUSPENDED",
                    "This company has been suspended.", suspension.Reason);
                return;
            }
        }

        await _next(context);
    }

    private static async Task Refuse(HttpContext context, string code, string message, string? reason)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = code, message, reason });
    }

    private static Guid? ResolveUserId(ClaimsPrincipal user)
    {
        var raw = user.FindFirst("UserId")?.Value
               ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? user.FindFirst("sub")?.Value;

        return Guid.TryParse(raw, out var id) ? id : null;
    }

    private sealed record Suspension(bool IsSuspended, string? Reason);
}
