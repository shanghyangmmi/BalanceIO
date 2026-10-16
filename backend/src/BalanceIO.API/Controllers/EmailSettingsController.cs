using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Mail;

using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmailSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public EmailSettingsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<ActionResult<EmailSettings>> GetSettings()
    {
        var settings = await _context.EmailSettings.FirstOrDefaultAsync();
        if (settings == null)
        {
            return Ok(new EmailSettings()); // Return empty default
        }
        return Ok(settings);
    }

    [HttpPost]
    [RequiresPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<EmailSettings>> SaveSettings(EmailSettings settings)
    {
        var existing = await _context.EmailSettings.FirstOrDefaultAsync();
        
        if (existing == null)
        {
            settings.Id = Guid.NewGuid();
            settings.UpdatedAt = DateTime.UtcNow;
            _context.EmailSettings.Add(settings);
        }
        else
        {
            existing.SmtpHost = settings.SmtpHost;
            existing.SmtpPort = settings.SmtpPort;
            existing.SmtpUsername = settings.SmtpUsername;
            // Only update password if provided (not empty)
            if (!string.IsNullOrEmpty(settings.SmtpPassword))
            {
                existing.SmtpPassword = settings.SmtpPassword;
            }
            existing.SenderEmail = settings.SenderEmail;
            existing.SenderName = settings.SenderName;
            existing.EnableSsl = settings.EnableSsl;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(existing ?? settings);
    }

    [HttpPost("test")]
    [RequiresPermission(Permissions.SettingsManage)]
    public async Task<IActionResult> TestConnection([FromBody] EmailSettings testSettings)
    {
        try
        {
            using var client = new SmtpClient(testSettings.SmtpHost, testSettings.SmtpPort);
            client.EnableSsl = testSettings.EnableSsl;
            client.Credentials = new NetworkCredential(testSettings.SmtpUsername, testSettings.SmtpPassword);
            
            // Try to send a test email to self
            var mailMessage = new MailMessage
            {
                From = new MailAddress(testSettings.SenderEmail, testSettings.SenderName),
                Subject = "FidaCount SMTP Test",
                Body = "This is a test email from FidaCount to verify your SMTP settings.",
                IsBodyHtml = false
            };
            mailMessage.To.Add(testSettings.SenderEmail);

            await client.SendMailAsync(mailMessage);
            
            return Ok(new { message = "Connection successful. Test email sent." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = $"Connection failed: {ex.Message}" });
        }
    }
}
