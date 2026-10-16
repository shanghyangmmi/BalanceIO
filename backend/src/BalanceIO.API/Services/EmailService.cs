using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BalanceIO.API.Services;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string body);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string body)
    {
        var smtpSettings = _configuration.GetSection("SmtpSettings");
        var host = smtpSettings["Host"];
        var port = int.Parse(smtpSettings["Port"] ?? "465");
        var user = smtpSettings["User"];
        var password = smtpSettings["Password"];
        var fromEmail = smtpSettings["FromEmail"] ?? user ?? "noreply@balanceio.id";
        var fromName = smtpSettings["FromName"] ?? "BalanceIO Support";

        try
        {
            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromEmail));
            message.To.Add(new MailboxAddress("", toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder { HtmlBody = body };
            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient();
            // Connect using Implicit SSL on port 465
            // Use SecureSocketOptions.SslOnConnect for Port 465
            // Use SecureSocketOptions.StartTls for Port 587
            var useSsl = port == 465;
            await client.ConnectAsync(host, port, useSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls);
            
            await client.AuthenticateAsync(user, password);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            _logger.LogInformation($"Email sent to {toEmail} via MailKit ({host}:{port})");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send email to {toEmail}");
            throw; // Re-throw to handle in controller
        }
    }
}
