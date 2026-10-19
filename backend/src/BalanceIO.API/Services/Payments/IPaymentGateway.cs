namespace BalanceIO.API.Services.Payments;

/// <summary>
/// A payment provider. The product talks to providers only through this,
/// so adding one (Xendit, DOKU, Stripe) is one class and one registration;
/// PaymentService, the webhook route and the subscription logic do not
/// change.
/// </summary>
public interface IPaymentGateway
{
    /// <summary>The key in configuration (Payments:Provider) and in the webhook route.</summary>
    string Name { get; }

    /// <summary>Whether the provider's credentials are configured.</summary>
    bool IsConfigured { get; }

    Task<CheckoutResult> CreateCheckoutAsync(CheckoutRequest request, CancellationToken ct = default);

    /// <summary>
    /// Verifies a notification the provider sent to the webhook and reads it.
    /// Returns null when the notification cannot be verified; the caller
    /// treats that as untrusted and changes nothing.
    /// </summary>
    GatewayNotification? ParseNotification(string body, IReadOnlyDictionary<string, string> headers);
}

public sealed record CheckoutRequest(
    string OrderId,
    decimal Amount,
    string Currency,
    string Description,
    string CustomerName,
    string? CustomerEmail,
    string? ReturnUrl);

/// <summary>
/// What the payer does next: follow <see cref="RedirectUrl"/> (hosted
/// page), use <see cref="Token"/> (embedded widget), or read
/// <see cref="Instructions"/> (manual transfer).
/// </summary>
public sealed record CheckoutResult(string? RedirectUrl, string? Token, string? Instructions, string? GatewayTransactionId);

public enum GatewayPaymentStatus
{
    Pending,
    Paid,
    Failed,
    Expired,
    Cancelled,
    Refunded,
}

public sealed record GatewayNotification(
    string OrderId,
    GatewayPaymentStatus Status,
    decimal GrossAmount,
    string? TransactionId,
    string? Method);
