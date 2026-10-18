using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;
    private readonly AuditService _auditService;
    private readonly IEmailService _emailService;
    private readonly SessionService _sessionService;
    private readonly ApplicationDbContext _context;

    public AuthController(
        AuthService authService,
        AuditService auditService,
        IEmailService emailService,
        SessionService sessionService,
        ApplicationDbContext context)
    {
        _authService = authService;
        _auditService = auditService;
        _emailService = emailService;
        _sessionService = sessionService;
        _context = context;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try 
        {
            var user = await _authService.RegisterAsync(request.Name, request.Email, request.Password);
            if (user == null)
                return BadRequest(new { message = "Email already in use" });

            await _auditService.LogAsync(user.Id, "USER_REGISTER", user.Id.ToString(), $"Registered via email {request.Email}");

            // Send Verification Email
            try 
            {
                var clientUrl = "https://balanceio.id"; 
                // if (Request.Host.Host.Contains("localhost")) clientUrl = "http://localhost:3000";

                var verifyUrl = $"{clientUrl}/verify-email?token={user.EmailVerificationToken}";

                var emailBody = $@"
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }}
                            .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                            .header {{ background-color: #0d9488; padding: 30px; text-align: center; }}
                            .header h1 {{ color: white; margin: 0; font-size: 24px; letter-spacing: 1px; }}
                            .content {{ padding: 40px; color: #333333; line-height: 1.6; }}
                            .btn {{ display: inline-block; padding: 12px 30px; background-color: #0d9488; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }}
                            .footer {{ background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
                            .link {{ color: #0d9488; word-break: break-all; }}
                        </style>
                    </head>
                    <body>
                        <div class='container'>
                            <div class='header'>
                                <h1>BalanceIO</h1>
                            </div>
                            <div class='content'>
                                <h2 style='margin-top: 0;'>Welcome, {user.Name}!</h2>
                                <p>Thank you for signing up with BalanceIO. To access your dashboard and start managing your business, please verify your email address.</p>
                                <div style='text-align: center; margin: 30px 0;'>
                                    <a href='{verifyUrl}' class='btn'>Verify My Account</a>
                                </div>
                                <p>If the button doesn't work, you can copy and paste the link below:</p>
                                <p><a href='{verifyUrl}' class='link'>{verifyUrl}</a></p>
                                <br>
                                <p>Best Regards,<br>The BalanceIO Team</p>
                            </div>
                            <div class='footer'>
                                <p>&copy; {DateTime.Now.Year} BalanceIO. All rights reserved.</p>
                                <p>You verify this email because you registered on balanceio.id.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                ";

                await _emailService.SendEmailAsync(user.Email, "Activate your BalanceIO Account", emailBody);
            }
            catch (Exception emailEx)
            {
                // Log email failure but don't fail registration completely? 
                // Alternatively, fail it so they try again. For now, let's fail it so we know.
                Console.WriteLine($"[Email Error]: {emailEx.Message}");
                throw; // Re-throw to be caught by outer block
            }

            return Ok(new { message = "Registration successful. Please check your email to verify your account." });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Register Error]: {ex.Message}");
            var innerMessage = ex.InnerException?.Message ?? ex.Message;
            return StatusCode(500, new { message = $"Internal Server Error: {innerMessage}" });
        }
    }

    [HttpGet("verify_email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
        var success = await _authService.VerifyEmailAsync(token);
        if (!success)
            return BadRequest(new { message = "Invalid or expired verification token." });

        return Ok(new { message = "Email verified successfully. You can now login." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request.Email, request.Password);

        if (result.Status == AuthResultStatus.InvalidCredentials || result.Status == AuthResultStatus.Error)
        {
            return BadRequest(new { message = result.Message ?? "Invalid credentials" });
        }

        if (result.Status == AuthResultStatus.RequiresTwoFactor)
        {
            return Accepted(new 
            { 
                message = "MFA Required", 
                requiresMFA = true, 
                tempToken = result.Token 
            });
        }

        if (string.IsNullOrEmpty(result.Token))
        {
            return BadRequest(new { message = "Authentication failed" });
        }

        // Parse token to get UserId for logging
        var p = new JwtSecurityTokenHandler().ReadJwtToken(result.Token);
        var sub = p.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value;
        var userGuid = Guid.Parse(sub);
        
        await _auditService.LogAsync(userGuid, "LOGIN_SUCCESS", null, "Logged in via Password");

        var user = await _authService.GetUserByIdAsync(userGuid);
        string? refreshToken = null;
        if (user != null)
        {
            var (_, rawRefresh, _) = await _sessionService.CreateSessionAsync(user, HttpContext);
            refreshToken = rawRefresh;
        }

        return Ok(new { token = result.Token, refreshToken });
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest? request)
    {
        var rawToken = request?.RefreshToken;
        if (string.IsNullOrEmpty(rawToken))
        {
            Request.Cookies.TryGetValue(SessionService.TenantRefreshTokenCookie, out rawToken);
        }

        if (string.IsNullOrEmpty(rawToken))
        {
            return Unauthorized(new { code = "REFRESH_TOKEN_REQUIRED", message = "Refresh token is missing." });
        }

        var result = await _sessionService.RefreshSessionAsync(rawToken, HttpContext);
        if (result == null)
        {
            return Unauthorized(new { code = "INVALID_REFRESH_TOKEN", message = "Invalid or expired refresh token." });
        }

        return Ok(new { token = result.Value.AccessToken, refreshToken = result.Value.NewRefreshToken });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest? request)
    {
        var rawToken = request?.RefreshToken;
        if (string.IsNullOrEmpty(rawToken))
        {
            Request.Cookies.TryGetValue(SessionService.TenantRefreshTokenCookie, out rawToken);
        }

        if (!string.IsNullOrEmpty(rawToken))
        {
            var hash = SessionService.HashToken(rawToken);
            var session = await _context.UserSessions.FirstOrDefaultAsync(s => s.RefreshTokenHash == hash);
            if (session != null)
            {
                session.IsRevoked = true;
                session.RevokedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        _sessionService.ClearAuthCookies(Response);
        return Ok(new { message = "Logged out successfully" });
    }

    [Authorize]
    [HttpPost("mfa/setup")]
    public async Task<IActionResult> SetupMfa()
    {
        var userId = GetUserId();
        var (secret, qrCodeUri) = await _authService.GenerateMfaSecretAsync(userId);
        
        // In real app, maybe don't return secret to client, just the URI or QR Image
        return Ok(new { secret, qrCodeUri });
    }

    [Authorize]
    [HttpPost("mfa/enable")]
    public async Task<IActionResult> EnableMfa([FromBody] MfaVerifyRequest request)
    {
        var userId = GetUserId();
        var success = await _authService.EnableMfaAsync(userId, request.Code);

        if (!success) return BadRequest(new { message = "Invalid Code" });

        await _auditService.LogAsync(userId, "MFA_ENABLE", userId.ToString(), "Enabled 2FA via Setup");

        return Ok(new { message = "MFA Enabled Successfully" });
    }
    
    [Authorize] // Requires the Temporary Token from Login response
    [HttpPost("mfa/verify")]
    public async Task<IActionResult> VerifyMfaLogin([FromBody] MfaVerifyRequest request)
    {
        var userId = GetUserId();
        
        // Verify code
        var result = await _authService.VerifyTopAndLoginAsync(userId, request.Code);
        
        if (result.Status == AuthResultStatus.Success)
        {
            await _auditService.LogAsync(userId, "LOGIN_MFA_SUCCESS", null, "Logged in via 2FA");

            var user = await _authService.GetUserByIdAsync(userId);
            string? refreshToken = null;
            if (user != null)
            {
                var (_, rawRefresh, _) = await _sessionService.CreateSessionAsync(user, HttpContext);
                refreshToken = rawRefresh;
            }

            return Ok(new { token = result.Token, refreshToken });
        }
        
        return Unauthorized(new { message = "Invalid MFA Code" });
    }

    public record RefreshTokenRequest(string? RefreshToken);

    private Guid GetUserId()
    {
        var sub = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                  
        if (Guid.TryParse(sub, out var guid)) return guid;
        throw new Exception("User ID not found in token");
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var user = await _authService.GeneratePasswordResetTokenAsync(request.Email);
        if (user == null)
        {
            // Don't reveal if user exists
            return Ok(new { message = "If your email is registered, you will receive a password reset link." });
        }

        try
        {
            var clientUrl = "https://balanceio.id"; 
            // if (Request.Host.Host.Contains("localhost")) clientUrl = "http://localhost:3000";

            var resetUrl = $"{clientUrl}/reset-password?token={user.PasswordResetToken}";

            var emailBody = $@"
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }}
                        .container {{ max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                        .header {{ background-color: #0d9488; padding: 30px; text-align: center; }}
                        .header h1 {{ color: white; margin: 0; font-size: 24px; letter-spacing: 1px; }}
                        .content {{ padding: 40px; color: #333333; line-height: 1.6; }}
                        .btn {{ display: inline-block; padding: 12px 30px; background-color: #0d9488; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }}
                        .footer {{ background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
                        .link {{ color: #0d9488; word-break: break-all; }}
                    </style>
                </head>
                <body>
                    <div class='container'>
                        <div class='header'>
                            <h1>BalanceIO</h1>
                        </div>
                        <div class='content'>
                            <h2 style='margin-top: 0;'>Reset Your Password</h2>
                            <p>We received a request to reset your password. Click the button below to create a new password.</p>
                            <div style='text-align: center; margin: 30px 0;'>
                                <a href='{resetUrl}' class='btn'>Reset Password</a>
                            </div>
                            <p>If you didn't request this, you can safely ignore this email.</p>
                            <p>This link will expire in 1 hour.</p>
                            <br>
                            <p>Best Regards,<br>The BalanceIO Team</p>
                        </div>
                        <div class='footer'>
                            <p>&copy; {DateTime.Now.Year} BalanceIO. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            ";

            await _emailService.SendEmailAsync(user.Email, "Reset Your BalanceIO Password", emailBody);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Email Error]: {ex.Message}");
            // Log but still return OK to avoid enumeration
        }

        return Ok(new { message = "If your email is registered, you will receive a password reset link." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var success = await _authService.ResetPasswordAsync(request.Token, request.Password);
        if (!success)
        {
            return BadRequest(new { message = "Invalid or expired password reset token." });
        }

        return Ok(new { message = "Password reset successfully. You can now login with your new password." });
    }
}

public class ForgotPasswordRequest
{
    public required string Email { get; set; }
}

public class ResetPasswordRequest
{
    public required string Token { get; set; }
    public required string Password { get; set; }
}
