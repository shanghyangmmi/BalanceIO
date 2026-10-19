using BalanceIO.API.Services.Payments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Notifications from payment gateways. Anonymous because the provider
/// cannot sign in; trusted only after the gateway verifies the
/// notification's signature, and applied only when it matches a payment
/// this product created, for the same amount.
/// </summary>
[ApiController]
[Route("api/payments/webhook")]
[AllowAnonymous]
public class PaymentWebhooksController(PaymentService payments) : ControllerBase
{
    [HttpPost("{provider}")]
    public async Task<IActionResult> Receive(string provider, CancellationToken ct)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(ct);
        var headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString(), StringComparer.OrdinalIgnoreCase);

        // 401 tells the provider the notification was not accepted; it retries.
        return await payments.ApplyNotificationAsync(provider, body, headers, ct) ? Ok() : Unauthorized();
    }
}
