using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

[ApiController]
[Route("api/admin/auth")]
public class AdminAuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly Argon2PasswordHasher _passwordHasher;
    private readonly JwtService _jwtService;
    private readonly AuditService _auditService;
    private readonly ILogger<AdminAuthController> _logger;

    /// <summary>
    /// One message for every way a sign-in can fail.
    ///
    /// The previous version answered "User not found", "User is not an
    /// admin" and "Password Mismatch" separately, which let anyone with the
    /// login form enumerate who holds an account and which of them are
    /// administrators - the exact list worth attacking. The reason still
    /// reaches the audit log, where only an administrator can read it.
    /// </summary>
    private const string InvalidCredentials = "Invalid credentials.";

    public AdminAuthController(ApplicationDbContext context, Argon2PasswordHasher passwordHasher, JwtService jwtService, AuditService auditService, ILogger<AdminAuthController> logger)
    {
        _logger = logger;
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
        _auditService = auditService;
    }

    public record AdminLoginRequest(string Email, string Password);

    [HttpGet("version")]
    public IActionResult GetVersion()
    {
        return Ok(new { version = "v1.1.2-adminfix", message = "SuperAdmin Role Fix Applied" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] AdminLoginRequest request)
    {
        try
        {
            // Capture Request Context
            var userAgent = Request.Headers["User-Agent"].ToString();
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            // 1. Find User
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null)
            {
                 await _auditService.LogAsync(null, "ADMIN_LOGIN_FAILED", $"Email:{request.Email}", "User Not Found", ip, userAgent);
                 return Unauthorized(new { message = InvalidCredentials });
            }

            if (!user.IsAdmin)
            {
                 await _auditService.LogAsync(user.Id, "ADMIN_LOGIN_FAILED", $"Email:{request.Email}", "Not Admin", ip, userAgent);
                 return Unauthorized(new { message = InvalidCredentials });
            }

            if (string.IsNullOrEmpty(user.PasswordHash) || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
            {
                // Log Failure
                await _auditService.LogAsync(user.Id, "ADMIN_LOGIN_FAILED", $"Email:{request.Email}", "Password Mismatch", ip, userAgent);
                return Unauthorized(new { message = InvalidCredentials });
            }

            // 3. Security Check (Optional: Enforce MFA for Admin here if needed later)

            // 4. Generate Token
            var token = _jwtService.GenerateToken(user);

            // 5. Log Success
            await _auditService.LogAsync(user.Id, "ADMIN_LOGIN_SUCCESS", "AdminPanel", "Super Admin Logged In", ip, userAgent);

            return Ok(new { token, user = new { user.Id, user.Name, user.Email, user.IsAdmin } });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Admin login failed for {Email}", request.Email);
            return StatusCode(500, new { error = "LOGIN_FAILED" });
        }
    }
}
