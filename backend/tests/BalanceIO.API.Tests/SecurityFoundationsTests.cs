using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BalanceIO.API.Tests;

public class SecurityFoundationsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<User> SeedUser(string email, string password, bool isAdmin = false)
    {
        var hasher = factory.Services.GetRequiredService<Argon2PasswordHasher>();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            Email = email,
            PasswordHash = hasher.HashPassword(password),
            IsEmailVerified = true,
            IsAdmin = isAdmin
        };

        await factory.WithDb(async db =>
        {
            db.Users.Add(user);
            await db.SaveChangesAsync();
        });

        return user;
    }

    [Fact]
    public async Task Login_issues_refresh_token_and_sets_httponly_cookies()
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        var password = "Password123!";
        await SeedUser(email, password);

        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Json();

        Assert.True(json.TryGetProperty("token", out var tokenProp));
        Assert.False(string.IsNullOrEmpty(tokenProp.GetString()));

        Assert.True(json.TryGetProperty("refreshToken", out var refreshProp));
        var refreshToken = refreshProp.GetString();
        Assert.False(string.IsNullOrEmpty(refreshToken));

        // Verify Set-Cookie header contains HttpOnly cookies
        Assert.True(response.Headers.Contains("Set-Cookie"));
        var cookies = string.Join(";", response.Headers.GetValues("Set-Cookie"));
        Assert.Contains("balanceio_token=", cookies);
        Assert.Contains("balanceio_refresh=", cookies);
        Assert.Contains("HttpOnly", cookies, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RefreshToken_rotates_token_and_updates_session()
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        var password = "Password123!";
        await SeedUser(email, password);

        var client = factory.CreateClient();
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        var loginJson = await loginRes.Json();
        var originalRefreshToken = loginJson.GetProperty("refreshToken").GetString()!;

        // Refresh using the refresh token
        var refreshRes = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = originalRefreshToken });
        Assert.Equal(HttpStatusCode.OK, refreshRes.StatusCode);
        var refreshJson = await refreshRes.Json();

        var newAccessToken = refreshJson.GetProperty("token").GetString()!;
        var newRefreshToken = refreshJson.GetProperty("refreshToken").GetString()!;

        Assert.False(string.IsNullOrEmpty(newAccessToken));
        Assert.False(string.IsNullOrEmpty(newRefreshToken));
        Assert.NotEqual(originalRefreshToken, newRefreshToken);

        // Verify the new token can access protected self-service endpoints
        var authClient = factory.CreateClient();
        authClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", newAccessToken);
        var sessionsRes = await authClient.GetAsync("/api/users/me/sessions");
        Assert.Equal(HttpStatusCode.OK, sessionsRes.StatusCode);
    }

    [Fact]
    public async Task Reusing_old_refresh_token_revokes_all_sessions_for_user()
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        var password = "Password123!";
        var user = await SeedUser(email, password);

        var client = factory.CreateClient();
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        var originalRefreshToken = (await loginRes.Json()).GetProperty("refreshToken").GetString()!;

        // First rotation: valid
        var firstRotate = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = originalRefreshToken });
        Assert.Equal(HttpStatusCode.OK, firstRotate.StatusCode);

        // Attacker attempts to reuse originalRefreshToken: must be refused
        var reuseAttempt = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = originalRefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, reuseAttempt.StatusCode);

        // Breach detection: all sessions for this user should now be revoked
        var activeSessionsCount = await factory.WithDb(async db =>
            await db.UserSessions.CountAsync(s => s.UserId == user.Id && !s.IsRevoked));
        Assert.Equal(0, activeSessionsCount);
    }

    [Fact]
    public async Task Password_reset_revokes_existing_refresh_tokens()
    {
        var email = $"user-{Guid.NewGuid():N}@test.local";
        var oldPassword = "Password123!";
        var newPassword = "NewPassword456!";
        var user = await SeedUser(email, oldPassword);

        // The session someone else holds
        var client = factory.CreateClient();
        var loginRes = await client.PostAsJsonAsync("/api/auth/login", new { email, password = oldPassword });
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
        var oldRefreshToken = (await loginRes.Json()).GetProperty("refreshToken").GetString()!;

        // The token the forgot-password email carries
        string resetToken;
        using (var scope = factory.Services.CreateScope())
        {
            var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
            resetToken = (await auth.GeneratePasswordResetTokenAsync(email))!.PasswordResetToken!;
        }

        var resetRes = await factory.CreateClient().PostAsJsonAsync("/api/auth/reset-password",
            new { token = resetToken, password = newPassword });
        Assert.Equal(HttpStatusCode.OK, resetRes.StatusCode);

        // Revoked by the reset itself, before any reuse detection could run
        var activeSessions = await factory.WithDb(async db =>
            await db.UserSessions.CountAsync(s => s.UserId == user.Id && !s.IsRevoked));
        Assert.Equal(0, activeSessions);

        var refreshRes = await client.PostAsJsonAsync("/api/auth/refresh", new { refreshToken = oldRefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, refreshRes.StatusCode);
        Assert.Equal("INVALID_REFRESH_TOKEN", (await refreshRes.Json()).GetProperty("code").GetString());

        var audit = await factory.WithDb(async db => await db.AuditLogs.IgnoreQueryFilters()
            .SingleAsync(a => a.UserId == user.Id && a.Action == "PASSWORD_RESET"));
        Assert.Contains("revoked 1 active session", audit.Details);

        // The password changed along with the revocation
        var fresh = factory.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest,
            (await fresh.PostAsJsonAsync("/api/auth/login", new { email, password = oldPassword })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await fresh.PostAsJsonAsync("/api/auth/login", new { email, password = newPassword })).StatusCode);
    }

    [Fact]
    public async Task Platform_admin_without_support_grant_is_refused_tenant_scope()
    {
        var tenant = factory.CreateTenant("Target Company");
        var admin = await SeedUser($"admin-{Guid.NewGuid():N}@test.local", "AdminPass123!", isAdmin: true);

        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Add("X-Company-Id", tenant.CompanyId.ToString());

        var res = await client.GetAsync("/api/Accounts");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);

        var body = await res.Json();
        Assert.Equal("SUPPORT_ACCESS_CONSENT_REQUIRED", body.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Platform_admin_with_active_support_grant_can_scope_to_tenant()
    {
        var tenant = factory.CreateTenant("Target Company");
        var admin = await SeedUser($"admin-{Guid.NewGuid():N}@test.local", "AdminPass123!", isAdmin: true);

        // Owner grants support access
        var grantRes = await tenant.OwnerClient().PostAsJsonAsync("/api/company/support-grants", new
        {
            durationHours = 24,
            reason = "Debugging chart of accounts"
        });
        Assert.Equal(HttpStatusCode.OK, grantRes.StatusCode);

        // Admin scopes to the tenant company
        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Add("X-Company-Id", tenant.CompanyId.ToString());

        var res = await client.GetAsync("/api/Accounts");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Platform_admin_with_break_glass_header_can_access_tenant()
    {
        var tenant = factory.CreateTenant("Target Company");
        var admin = await SeedUser($"admin-{Guid.NewGuid():N}@test.local", "AdminPass123!", isAdmin: true);

        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Add("X-Company-Id", tenant.CompanyId.ToString());
        client.DefaultRequestHeaders.Add("X-Break-Glass-Reason", "Emergency database migration failure inspection");

        var res = await client.GetAsync("/api/Accounts");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Revoking_support_grant_immediately_terminates_admin_access()
    {
        var tenant = factory.CreateTenant("Target Company");
        var admin = await SeedUser($"admin-{Guid.NewGuid():N}@test.local", "AdminPass123!", isAdmin: true);

        // Owner creates grant
        var grantRes = await tenant.OwnerClient().PostAsJsonAsync("/api/company/support-grants", new
        {
            durationHours = 24,
            reason = "Temporary assistance"
        });
        var grantId = (await grantRes.Json()).GetProperty("grant").GetProperty("id").GetGuid();

        // Admin can access
        var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        client.DefaultRequestHeaders.Add("X-Company-Id", tenant.CompanyId.ToString());

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Accounts")).StatusCode);

        // Owner revokes grant
        var revokeRes = await tenant.OwnerClient().DeleteAsync($"/api/company/support-grants/{grantId}");
        Assert.Equal(HttpStatusCode.OK, revokeRes.StatusCode);

        // Admin is now refused
        var deniedRes = await client.GetAsync("/api/Accounts");
        Assert.Equal(HttpStatusCode.Forbidden, deniedRes.StatusCode);
        Assert.Equal("SUPPORT_ACCESS_CONSENT_REQUIRED", (await deniedRes.Json()).GetProperty("error").GetString());
    }
}
