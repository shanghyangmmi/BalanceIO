namespace BalanceIO.API.Services.Payments;

/// <summary>
/// Bank transfer to the platform's account, confirmed by a platform admin
/// (POST /api/admin/payments/{id}/confirm). Works with no gateway
/// contract, and is the default until one is configured.
/// </summary>
public sealed class ManualPaymentGateway(IConfiguration configuration) : IPaymentGateway
{
    public string Name => "manual";

    public bool IsConfigured => true;

    public Task<CheckoutResult> CreateCheckoutAsync(CheckoutRequest request, CancellationToken ct = default)
    {
        var instructions = configuration["Payments:Manual:Instructions"];
        if (string.IsNullOrWhiteSpace(instructions))
            instructions = "Transfer the amount to the account BalanceIO gave you and quote the order number. The plan activates when the transfer is confirmed.";

        return Task.FromResult(new CheckoutResult(null, null,
            $"{instructions.Trim()} Order {request.OrderId}, {request.Currency} {request.Amount:N0}.", null));
    }

    /// <summary>Manual payments have no notifications; an admin confirms them.</summary>
    public GatewayNotification? ParseNotification(string body, IReadOnlyDictionary<string, string> headers) => null;
}
