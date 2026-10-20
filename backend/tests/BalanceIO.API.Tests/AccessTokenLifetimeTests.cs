using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Net.Http.Headers;

namespace BalanceIO.API.Tests;

/// <summary>
/// Revoking a session (logout, refresh-token reuse, password reset) stops
/// renewal only: an access token already issued works until it expires. These
/// pin that window at 15 minutes and check that the browser's way back in, a
/// refresh with nothing but the refresh cookie, restores access.
/// </summary>
public class AccessTokenLifetimeTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string Password = "Password123!";
    private static readonly TimeSpan Fifteen = TimeSpan.FromMinutes(15);

    [Fact]
    public async Task Login_access_token_and_its_cookie_expire_within_fifteen_minutes()
    {
        var user = await SeedUser();
        var issuedFrom = DateTime.UtcNow;

        var login = await Login(factory.CreateClient(), user);

        var bodyToken = Jwt((await login.Json()).GetProperty("token").GetString()!);
        AssertExpiresWithin(bodyToken.ValidTo, issuedFrom, Fifteen);

        var cookie = Cookie(login, SessionService.TenantAccessTokenCookie);
        Assert.True(cookie.HttpOnly);
        AssertExpiresWithin(cookie.Expires!.Value.UtcDateTime, issuedFrom, Fifteen);
        AssertExpiresWithin(Jwt(cookie.Value.Value!).ValidTo, issuedFrom, Fifteen);
    }

    [Fact]
    public async Task Lifetime_comes_from_one_setting_for_token_and_cookie()
    {
        using var host = factory.WithSettings(("Jwt:AccessTokenMinutes", "5"));
        var user = await SeedUser();
        var issuedFrom = DateTime.UtcNow;

        var login = await Login(host.CreateClient(), user);

        var five = TimeSpan.FromMinutes(5);
        AssertExpiresWithin(Jwt((await login.Json()).GetProperty("token").GetString()!).ValidTo, issuedFrom, five);
        AssertExpiresWithin(Cookie(login, SessionService.TenantAccessTokenCookie).Expires!.Value.UtcDateTime, issuedFrom, five);
    }

    [Fact]
    public async Task Expired_access_token_is_refused_and_refresh_cookie_restores_access()
    {
        var user = await SeedUser();
        // A browser: cookies travel only as the Cookie header set here.
        var browser = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var refreshCookie = Cookie(await Login(browser, user), SessionService.TenantRefreshTokenCookie).Value.Value!;

        // Past its expiry and past the clock skew the validator allows.
        var expired = Forge(user, expires: DateTime.UtcNow.AddMinutes(-2));
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.SendAsync(Sessions(bearer: expired))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.SendAsync(Sessions(accessCookie: expired))).StatusCode);

        // What api-client.ts does on that 401: no token in the body, only the refresh cookie.
        var refreshFrom = DateTime.UtcNow;
        var refresh = new HttpRequestMessage(HttpMethod.Post, "/api/auth/refresh") { Content = JsonContent.Create(new { }) };
        refresh.Headers.Add("Cookie", $"{SessionService.TenantRefreshTokenCookie}={refreshCookie}");
        var refreshed = await browser.SendAsync(refresh);
        Assert.Equal(HttpStatusCode.OK, refreshed.StatusCode);

        var newToken = (await refreshed.Json()).GetProperty("token").GetString()!;
        AssertExpiresWithin(Jwt(newToken).ValidTo, refreshFrom, Fifteen);
        var newCookie = Cookie(refreshed, SessionService.TenantAccessTokenCookie);
        AssertExpiresWithin(newCookie.Expires!.Value.UtcDateTime, refreshFrom, Fifteen);
        Assert.NotEqual(refreshCookie, Cookie(refreshed, SessionService.TenantRefreshTokenCookie).Value.Value);

        // The repeated call succeeds, whichever way the token travels.
        Assert.Equal(HttpStatusCode.OK, (await browser.SendAsync(Sessions(bearer: newToken))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await browser.SendAsync(Sessions(accessCookie: newCookie.Value.Value!))).StatusCode);
    }

    [Fact]
    public async Task Authorization_header_wins_over_a_leftover_access_cookie()
    {
        var leftover = await SeedUser();
        var current = await SeedUser();
        var browser = factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        var leftoverCookie = Cookie(await Login(browser, leftover), SessionService.TenantAccessTokenCookie).Value.Value!;

        using var scope = factory.Services.CreateScope();
        var currentToken = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(current);

        var me = new HttpRequestMessage(HttpMethod.Get, "/api/users/me");
        me.Headers.Authorization = new AuthenticationHeaderValue("Bearer", currentToken);
        me.Headers.Add("Cookie", $"{SessionService.TenantAccessTokenCookie}={leftoverCookie}");
        var res = await browser.SendAsync(me);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(current.Id, (await res.Json()).GetProperty("id").GetGuid());
    }

    private async Task<User> SeedUser()
    {
        var hasher = factory.Services.GetRequiredService<Argon2PasswordHasher>();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Lifetime User",
            Email = $"lifetime-{Guid.NewGuid():N}@test.local",
            PasswordHash = hasher.HashPassword(Password),
            IsEmailVerified = true,
        };
        await factory.WithDb(async db =>
        {
            db.Users.Add(user);
            await db.SaveChangesAsync();
        });
        return user;
    }

    private static async Task<HttpResponseMessage> Login(HttpClient client, User user)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = Password });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return res;
    }

    private static HttpRequestMessage Sessions(string? bearer = null, string? accessCookie = null)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/users/me/sessions");
        if (bearer != null) req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        if (accessCookie != null) req.Headers.Add("Cookie", $"{SessionService.TenantAccessTokenCookie}={accessCookie}");
        return req;
    }

    private static SetCookieHeaderValue Cookie(HttpResponseMessage res, string name) =>
        SetCookieHeaderValue.ParseList(res.Headers.GetValues("Set-Cookie").ToList()).Single(c => c.Name == name);

    private static JwtSecurityToken Jwt(string token) => new JwtSecurityTokenHandler().ReadJwtToken(token);

    /// <summary>JWT and cookie expiry carry whole seconds, hence the one-second allowance.</summary>
    private static void AssertExpiresWithin(DateTime expiresUtc, DateTime issuedFromUtc, TimeSpan lifetime)
    {
        Assert.True(expiresUtc > DateTime.UtcNow, $"already expired at {expiresUtc:O}");
        Assert.True(expiresUtc <= DateTime.UtcNow.Add(lifetime).AddSeconds(1), $"expires at {expiresUtc:O}, beyond {lifetime}");
        Assert.True(expiresUtc >= issuedFromUtc.Add(lifetime).AddSeconds(-1), $"expires at {expiresUtc:O}, short of {lifetime}");
    }

    /// <summary>A token signed with the API's key, as JwtService would sign it, but already expired.</summary>
    private string Forge(User user, DateTime expires)
    {
        var config = factory.Services.GetRequiredService<IConfiguration>();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Key"]!));
        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: [new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new Claim(JwtRegisteredClaimNames.Email, user.Email)],
            notBefore: expires.AddMinutes(-15),
            expires: expires,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
