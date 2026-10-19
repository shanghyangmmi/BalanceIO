using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace BalanceIO.API.Services.Payments;

/// <summary>
/// Midtrans Snap. Checkout creates a Snap transaction and returns its
/// redirect URL; Midtrans then posts HTTP notifications to
/// /api/payments/webhook/midtrans.
///
/// A notification is trusted only when its signature_key equals
/// SHA512(order_id + status_code + gross_amount + server key). Midtrans
/// recommends confirming with the status API as well; the amount is
/// checked against the stored payment by PaymentService.
///
/// Configuration: Payments:Midtrans:ServerKey (a secret; set it from the
/// environment as Payments__Midtrans__ServerKey) and
/// Payments:Midtrans:IsProduction.
/// </summary>
public sealed class MidtransPaymentGateway(HttpClient http, IConfiguration configuration, ILogger<MidtransPaymentGateway> logger) : IPaymentGateway
{
    public string Name => "midtrans";

    private string? ServerKey => configuration["Payments:Midtrans:ServerKey"];

    private bool IsProduction => configuration.GetValue("Payments:Midtrans:IsProduction", false);

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ServerKey);

    private string SnapUrl => IsProduction
        ? "https://app.midtrans.com/snap/v1/transactions"
        : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    public async Task<CheckoutResult> CreateCheckoutAsync(CheckoutRequest request, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Midtrans is selected but Payments:Midtrans:ServerKey is not set.");

        // IDR amounts go to Midtrans as whole rupiah.
        var gross = decimal.ToInt64(Math.Round(request.Amount, 0, MidpointRounding.ToEven));
        var payload = new Dictionary<string, object?>
        {
            ["transaction_details"] = new { order_id = request.OrderId, gross_amount = gross },
            ["customer_details"] = new { first_name = request.CustomerName, email = request.CustomerEmail },
            ["item_details"] = new[] { new { id = request.OrderId, price = gross, quantity = 1, name = Truncate(request.Description, 50) } },
        };
        if (!string.IsNullOrWhiteSpace(request.ReturnUrl))
            payload["callbacks"] = new { finish = request.ReturnUrl };

        using var message = new HttpRequestMessage(HttpMethod.Post, SnapUrl)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Basic",
            Convert.ToBase64String(Encoding.UTF8.GetBytes(ServerKey + ":")));
        message.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await http.SendAsync(message, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Midtrans Snap refused order {Order}: {Status} {Body}", request.OrderId, (int)response.StatusCode, text);
            throw new InvalidOperationException($"Midtrans refused the checkout ({(int)response.StatusCode}).");
        }

        using var doc = JsonDocument.Parse(text);
        var root = doc.RootElement;
        return new CheckoutResult(
            root.TryGetProperty("redirect_url", out var url) ? url.GetString() : null,
            root.TryGetProperty("token", out var token) ? token.GetString() : null,
            null, null);
    }

    public GatewayNotification? ParseNotification(string body, IReadOnlyDictionary<string, string> headers)
    {
        if (!IsConfigured) return null;

        JsonElement root;
        try
        {
            root = JsonDocument.Parse(body).RootElement;
        }
        catch (JsonException)
        {
            return null;
        }

        string? Read(string name) => root.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

        var orderId = Read("order_id");
        var statusCode = Read("status_code");
        var grossText = Read("gross_amount");
        var signature = Read("signature_key");
        if (orderId is null || statusCode is null || grossText is null || signature is null) return null;

        if (!SignatureMatches(orderId, statusCode, grossText, signature)) return null;
        if (!decimal.TryParse(grossText, NumberStyles.Number, CultureInfo.InvariantCulture, out var gross)) return null;

        var status = (Read("transaction_status"), Read("fraud_status")) switch
        {
            ("capture", "accept") or ("capture", null) or ("settlement", _) => GatewayPaymentStatus.Paid,
            ("capture", _) => GatewayPaymentStatus.Pending, // challenge: wait for review
            ("pending", _) => GatewayPaymentStatus.Pending,
            ("deny", _) => GatewayPaymentStatus.Failed,
            ("cancel", _) => GatewayPaymentStatus.Cancelled,
            ("expire", _) => GatewayPaymentStatus.Expired,
            ("refund", _) or ("partial_refund", _) => GatewayPaymentStatus.Refunded,
            _ => GatewayPaymentStatus.Pending,
        };

        return new GatewayNotification(orderId, status, gross, Read("transaction_id"), Read("payment_type"));
    }

    private bool SignatureMatches(string orderId, string statusCode, string grossAmount, string signature)
    {
        var expected = Convert.ToHexString(SHA512.HashData(Encoding.UTF8.GetBytes(orderId + statusCode + grossAmount + ServerKey))).ToLowerInvariant();
        return CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(signature.ToLowerInvariant()));
    }

    private static string Truncate(string text, int max) => text.Length <= max ? text : text[..max];
}
