using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

public class SessionService
{
    public const string TenantAccessTokenCookie = "balanceio_token";
    public const string TenantRefreshTokenCookie = "balanceio_refresh";
    public const string AdminAccessTokenCookie = "admin_token";
    public const string AdminRefreshTokenCookie = "admin_refresh";

    private readonly ApplicationDbContext _context;
    private readonly JwtService _jwtService;
    private readonly IWebHostEnvironment _env;

    public SessionService(ApplicationDbContext context, JwtService jwtService, IWebHostEnvironment env)
    {
        _context = context;
        _jwtService = jwtService;
        _env = env;
    }

    public static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    public async Task<(UserSession Session, string RawRefreshToken, string AccessToken)> CreateSessionAsync(
        User user, HttpContext httpContext)
    {
        var rawRefreshToken = GenerateSecureToken();
        var hash = HashToken(rawRefreshToken);

        var ip = httpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();
        if (userAgent.Length > 300) userAgent = userAgent[..300];

        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            RefreshTokenHash = hash,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            LastSeenAt = DateTime.UtcNow,
            IpAddress = ip,
            UserAgent = userAgent,
            IsRevoked = false
        };

        _context.UserSessions.Add(session);
        await _context.SaveChangesAsync();

        var accessToken = _jwtService.GenerateToken(user);

        // Attach cookies to response
        AttachAuthCookies(httpContext.Response, accessToken, rawRefreshToken, user.IsAdmin);

        return (session, rawRefreshToken, accessToken);
    }

    public async Task<(string AccessToken, string NewRefreshToken)?> RefreshSessionAsync(
        string rawRefreshToken, HttpContext httpContext)
    {
        if (string.IsNullOrWhiteSpace(rawRefreshToken))
            return null;

        var hash = HashToken(rawRefreshToken);

        // Ignore query filter so we can detect reuse of revoked tokens
        var session = await _context.UserSessions
            .IgnoreQueryFilters()
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.RefreshTokenHash == hash);

        if (session == null)
            return null;

        // Reuse detection: if a revoked token is presented, compromise is assumed.
        // Invalidate all active sessions for this user.
        if (session.IsRevoked)
        {
            var activeSessions = await _context.UserSessions
                .Where(s => s.UserId == session.UserId && !s.IsRevoked)
                .ToListAsync();

            foreach (var s in activeSessions)
            {
                s.IsRevoked = true;
                s.RevokedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return null;
        }

        if (session.ExpiresAt <= DateTime.UtcNow || session.User == null || session.User.IsSuspended)
        {
            session.IsRevoked = true;
            session.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return null;
        }

        // Rotate refresh token: revoke old token so subsequent presentation triggers reuse detection
        session.IsRevoked = true;
        session.RevokedAt = DateTime.UtcNow;

        var ip = httpContext.Connection.RemoteIpAddress?.ToString();
        var ua = httpContext.Request.Headers.UserAgent.ToString();

        var newRawRefreshToken = GenerateSecureToken();
        var newSession = new UserSession
        {
            UserId = session.UserId,
            RefreshTokenHash = HashToken(newRawRefreshToken),
            CreatedAt = session.CreatedAt,
            ExpiresAt = DateTime.UtcNow.AddDays(30),
            LastSeenAt = DateTime.UtcNow,
            IpAddress = !string.IsNullOrEmpty(ip) ? ip : session.IpAddress,
            UserAgent = !string.IsNullOrEmpty(ua) ? (ua.Length > 300 ? ua[..300] : ua) : session.UserAgent,
            IsRevoked = false
        };

        _context.UserSessions.Add(newSession);
        await _context.SaveChangesAsync();

        var newAccessToken = _jwtService.GenerateToken(session.User);
        AttachAuthCookies(httpContext.Response, newAccessToken, newRawRefreshToken, session.User.IsAdmin);

        return (newAccessToken, newRawRefreshToken);
    }

    public async Task RevokeSessionAsync(Guid sessionId, Guid userId)
    {
        var session = await _context.UserSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session != null)
        {
            session.IsRevoked = true;
            session.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task RevokeAllSessionsAsync(Guid userId, Guid? exceptSessionId = null)
    {
        var sessions = await _context.UserSessions
            .Where(s => s.UserId == userId && !s.IsRevoked && (exceptSessionId == null || s.Id != exceptSessionId))
            .ToListAsync();

        foreach (var s in sessions)
        {
            s.IsRevoked = true;
            s.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    public void AttachAuthCookies(HttpResponse response, string accessToken, string refreshToken, bool isAdmin)
    {
        var isSecure = _env.IsProduction();

        var accessCookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        };

        var refreshCookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = isSecure,
            SameSite = SameSiteMode.Lax,
            Path = "/api",
            Expires = DateTimeOffset.UtcNow.AddDays(30)
        };

        response.Cookies.Append(TenantAccessTokenCookie, accessToken, accessCookieOptions);
        response.Cookies.Append(TenantRefreshTokenCookie, refreshToken, refreshCookieOptions);

        if (isAdmin)
        {
            response.Cookies.Append(AdminAccessTokenCookie, accessToken, accessCookieOptions);
            response.Cookies.Append(AdminRefreshTokenCookie, refreshToken, refreshCookieOptions);
        }
    }

    public void ClearAuthCookies(HttpResponse response)
    {
        var deleteOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = _env.IsProduction(),
            SameSite = SameSiteMode.Lax,
            Path = "/",
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        var apiDeleteOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = _env.IsProduction(),
            SameSite = SameSiteMode.Lax,
            Path = "/api",
            Expires = DateTimeOffset.UtcNow.AddDays(-1)
        };

        response.Cookies.Delete(TenantAccessTokenCookie, deleteOptions);
        response.Cookies.Delete(TenantRefreshTokenCookie, apiDeleteOptions);
        response.Cookies.Delete(AdminAccessTokenCookie, deleteOptions);
        response.Cookies.Delete(AdminRefreshTokenCookie, apiDeleteOptions);
    }
}
