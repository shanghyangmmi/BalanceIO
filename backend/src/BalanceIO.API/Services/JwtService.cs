using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using BalanceIO.API.Models;
using Microsoft.IdentityModel.Tokens;

namespace BalanceIO.API.Services;

public class JwtService
{
    /// <summary>
    /// Used when <c>Jwt:AccessTokenMinutes</c> is absent. Revoking a session
    /// (logout, refresh-token reuse, password reset) stops renewal only; an
    /// access token already issued stays valid until it expires, so this is
    /// how long a stolen one keeps working.
    /// </summary>
    public const double DefaultAccessTokenMinutes = 15;

    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;

        var minutes = configuration.GetValue("Jwt:AccessTokenMinutes", DefaultAccessTokenMinutes);
        if (minutes <= 0)
            throw new InvalidOperationException($"Jwt:AccessTokenMinutes must be positive (was {minutes}).");
        AccessTokenLifetime = TimeSpan.FromMinutes(minutes);
    }

    /// <summary>Lifetime of the access token and of the cookie that carries it.</summary>
    public TimeSpan AccessTokenLifetime { get; }

    public string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("Name", user.Name)
        };

        if (user.IsAdmin)
        {
             claims.Add(new Claim(ClaimTypes.Role, "SuperAdmin"));
        }

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.Add(AccessTokenLifetime), // renewed through POST /api/auth/refresh
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateTemporaryMfaToken(User user)
    {
        // Short lived token just for MFA verification step
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim("IsPreAuth", "true") // Flag to indicate this is NOT a full session
        };

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(5), // 5 Minutes specifically for entering OTP
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
