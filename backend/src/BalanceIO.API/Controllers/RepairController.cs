using BalanceIO.API.Services;
using BalanceIO.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/repair")]
[Authorize(Roles = "SuperAdmin")]
public class RepairController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<RepairController> _logger;
    private readonly IEmailService _emailService;
    private readonly IWebHostEnvironment _env;

    public RepairController(
        ApplicationDbContext context,
        ILogger<RepairController> logger,
        IEmailService emailService,
        IWebHostEnvironment env)
    {
        _context = context;
        _logger = logger;
        _emailService = emailService;
        _env = env;
    }

    [HttpGet("check-schema")]
    public IActionResult CheckSchema()
    {
        if (_env.IsProduction())
            return NotFound("Repair utilities are disabled in production.");

        try
        {
            var logs = new List<string>();
            
            // 1. Try to Add Columns for "Users" (Quoted - Case Sensitive)
            logs.Add("--- Attempting Patch on \"Users\" ---");
            try {
                _context.Database.ExecuteSqlRaw(@"
                    ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailVerificationToken"" text;
                    ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""IsEmailVerified"" boolean DEFAULT false;
                    ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""TwoFactorEnabled"" boolean DEFAULT false;
                    ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""TwoFactorSecret"" text;
                ");
                logs.Add("SUCCESS: Patched \"Users\" table.");
            } catch (Exception ex) {
                logs.Add($"FAILED \"Users\": {ex.Message}");
            }

            // 2. Try to Add Columns for users (Lowercase - Default)
            logs.Add("--- Attempting Patch on users (lowercase) ---");
            try {
                 _context.Database.ExecuteSqlRaw(@"
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS ""EmailVerificationToken"" text;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS ""IsEmailVerified"" boolean DEFAULT false;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS ""TwoFactorEnabled"" boolean DEFAULT false;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS ""TwoFactorSecret"" text;
                ");
                logs.Add("SUCCESS: Patched users (lowercase) table.");
            } catch (Exception ex) {
                logs.Add($"FAILED users: {ex.Message}");
            }

            return Ok(new { 
                message = "Repair Attempt Complete", 
                logs = logs,
                check = "Try Registering again!" 
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message, trace = ex.StackTrace });
        }
    }


    [HttpGet("test-email")]
    public async Task<IActionResult> TestEmail([FromQuery] string toEmail)
    {
        if (_env.IsProduction())
            return NotFound("Repair utilities are disabled in production.");
        
        try
        {
            if (string.IsNullOrEmpty(toEmail)) return BadRequest("toEmail is required");

            await _emailService.SendEmailAsync(toEmail, "Test Email from BalanceIO Repair Tool", "<h1>It Works!</h1><p>Your SMTP settings are correct.</p>");
            
            return Ok(new { message = $"Email successfully sent to {toEmail}" });
        }
        catch (Exception ex)
        {
             return StatusCode(500, new { error = ex.Message, trace = ex.StackTrace, inner = ex.InnerException?.Message });
        }
    }
}
