using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

using BalanceIO.API.Services;

namespace BalanceIO.API.Services.Payments;

/// <summary>
/// Paying for a plan, independent of the gateway.
///
/// Checkout records a Pending payment before the gateway is called, so a
/// notification can never arrive for a payment the product does not know.
/// A payment becomes Success once: from a verified gateway notification
/// whose amount matches, or from an admin confirming a manual transfer.
/// Success activates the plan; repeating it changes nothing.
/// </summary>
public class PaymentService
{
    private readonly ApplicationDbContext _context;
    private readonly IEnumerable<IPaymentGateway> _gateways;
    private readonly IConfiguration _configuration;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(ApplicationDbContext context, IEnumerable<IPaymentGateway> gateways, IConfiguration configuration, ILogger<PaymentService> logger)
    {
        _context = context;
        _gateways = gateways;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>The gateway named by Payments:Provider; manual when unset or unconfigured.</summary>
    public IPaymentGateway Active()
    {
        var name = _configuration["Payments:Provider"];
        var chosen = _gateways.FirstOrDefault(g => string.Equals(g.Name, name, StringComparison.OrdinalIgnoreCase));
        if (chosen is { IsConfigured: true }) return chosen;
        if (chosen is not null)
            _logger.LogWarning("Payment provider {Provider} is selected but not configured; using manual transfer.", chosen.Name);
        return _gateways.First(g => g.Name == "manual");
    }

    public IPaymentGateway? ByName(string name) =>
        _gateways.FirstOrDefault(g => string.Equals(g.Name, name, StringComparison.OrdinalIgnoreCase));

    public sealed record CheckoutResponse(Guid PaymentId, string OrderId, string Provider, decimal Amount, string Status,
        string? RedirectUrl, string? Token, string? Instructions);

    public async Task<CheckoutResponse> StartCheckoutAsync(Guid companyId, Guid planId, string billingCycle, string? payerEmail, CancellationToken ct = default)
    {
        var cycle = string.Equals(billingCycle, "yearly", StringComparison.OrdinalIgnoreCase) ? "yearly" : "monthly";
        var plan = await _context.Plans.FirstOrDefaultAsync(p => p.Id == planId && p.IsActive, ct)
            ?? throw new PaymentRuleException("PLAN_NOT_FOUND", "Plan not found.", StatusCodes.Status404NotFound);
        var company = await _context.Companies.AsNoTracking().FirstAsync(c => c.Id == companyId, ct);

        var amount = cycle == "yearly" ? plan.PriceYearly : plan.PriceMonthly;
        var orderId = $"SUB-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..10].ToUpperInvariant()}";

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            PlanId = plan.Id,
            BillingCycle = cycle,
            Amount = amount,
            Currency = "IDR",
            GatewayOrderId = orderId,
            InvoiceNumber = orderId,
            Status = PaymentStatus.Pending,
            Description = $"{plan.Name} ({cycle}) for {company.Name}",
            ExpiredAt = DateTime.UtcNow.AddDays(1),
        };

        // A free plan needs no gateway.
        if (amount <= 0m)
        {
            payment.Provider = "none";
            _context.Payments.Add(payment);
            await MarkPaidAsync(payment, null, "free", ct);
            return Response(payment, null);
        }

        var gateway = Active();
        payment.Provider = gateway.Name;
        _context.Payments.Add(payment);
        await _context.SaveChangesAsync(ct);

        CheckoutResult result;
        try
        {
            result = await gateway.CreateCheckoutAsync(new CheckoutRequest(orderId, amount, payment.Currency, payment.Description!,
                company.Name, payerEmail, _configuration["Payments:ReturnUrl"]), ct);
        }
        catch (Exception ex) when (ex is InvalidOperationException or HttpRequestException or TaskCanceledException)
        {
            payment.Status = PaymentStatus.Failed;
            await _context.SaveChangesAsync(ct);
            throw new PaymentRuleException("GATEWAY_UNAVAILABLE", $"The payment provider could not start the checkout: {ex.Message}", StatusCodes.Status502BadGateway);
        }

        payment.CheckoutUrl = result.RedirectUrl;
        payment.GatewayTransactionId = result.GatewayTransactionId;
        await _context.SaveChangesAsync(ct);
        return Response(payment, result);
    }

    /// <summary>
    /// Applies a gateway notification. Returns false when the notification
    /// cannot be verified or does not match a payment; nothing changes then.
    /// </summary>
    public async Task<bool> ApplyNotificationAsync(string provider, string body, IReadOnlyDictionary<string, string> headers, CancellationToken ct = default)
    {
        var gateway = ByName(provider);
        var notification = gateway?.ParseNotification(body, headers);
        if (gateway is null || notification is null)
        {
            _logger.LogWarning("Rejected an unverifiable {Provider} payment notification.", provider);
            return false;
        }

        var payment = await _context.Payments.FirstOrDefaultAsync(p => p.GatewayOrderId == notification.OrderId && p.Provider == gateway.Name, ct);
        if (payment is null)
        {
            _logger.LogWarning("{Provider} notification for unknown order {Order}.", provider, notification.OrderId);
            return false;
        }

        // The amount paid is the amount asked; a mismatch is not a payment for this plan.
        if (notification.GrossAmount != payment.Amount)
        {
            _logger.LogWarning("{Provider} order {Order}: paid {Paid} against {Expected}; not applied.", provider, payment.GatewayOrderId, notification.GrossAmount, payment.Amount);
            return false;
        }

        payment.WebhookPayload = body.Length > 8000 ? body[..8000] : body;
        payment.GatewayTransactionId = notification.TransactionId ?? payment.GatewayTransactionId;

        switch (notification.Status)
        {
            case GatewayPaymentStatus.Paid:
                await MarkPaidAsync(payment, notification.Method, notification.Method, ct);
                return true;
            case GatewayPaymentStatus.Refunded:
                payment.Status = PaymentStatus.Refunded;
                payment.RefundedAt = DateTime.UtcNow;
                break;
            case GatewayPaymentStatus.Failed when payment.Status == PaymentStatus.Pending:
                payment.Status = PaymentStatus.Failed;
                break;
            case GatewayPaymentStatus.Expired when payment.Status == PaymentStatus.Pending:
                payment.Status = PaymentStatus.Expired;
                break;
            case GatewayPaymentStatus.Cancelled when payment.Status == PaymentStatus.Pending:
                payment.Status = PaymentStatus.Cancelled;
                break;
        }

        await _context.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>A platform admin confirms a manual transfer.</summary>
    public async Task<Payment> ConfirmManualAsync(Guid paymentId, string confirmedBy, CancellationToken ct = default)
    {
        var payment = await _context.Payments.FirstOrDefaultAsync(p => p.Id == paymentId, ct)
            ?? throw new PaymentRuleException("PAYMENT_NOT_FOUND", "Payment not found.", StatusCodes.Status404NotFound);
        if (payment.Provider != "manual")
            throw new PaymentRuleException("NOT_MANUAL", "Only manual transfers are confirmed by hand; gateway payments confirm themselves.");
        if (payment.Status is not (PaymentStatus.Pending or PaymentStatus.Success))
            throw new PaymentRuleException("NOT_PENDING", $"The payment is {payment.Status}.");

        await MarkPaidAsync(payment, "bank_transfer", $"confirmed by {confirmedBy}", ct);
        return payment;
    }

    /// <summary>Success once, and the plan with it. Repeating is a no-op.</summary>
    private async Task MarkPaidAsync(Payment payment, string? method, string? note, CancellationToken ct)
    {
        if (payment.Status == PaymentStatus.Success)
        {
            await _context.SaveChangesAsync(ct);
            return;
        }

        payment.Status = PaymentStatus.Success;
        payment.PaidAt = DateTime.UtcNow;
        payment.PaymentMethod = method ?? payment.PaymentMethod;
        payment.SubscriptionId = await ActivateAsync(payment, ct);
        _logger.LogInformation("Payment {Order} succeeded ({Note}).", payment.GatewayOrderId, note);
        await _context.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The paid plan becomes the company's subscription. Paying again for the
    /// plan already held extends it from its end date; a different plan
    /// replaces the old subscription from today.
    /// </summary>
    private async Task<Guid> ActivateAsync(Payment payment, CancellationToken ct)
    {
        var companyId = payment.CompanyId ?? throw new InvalidOperationException("Payment has no company.");
        var planId = payment.PlanId ?? throw new InvalidOperationException("Payment has no plan.");
        var yearly = payment.BillingCycle == "yearly";
        var now = DateTime.UtcNow;

        var current = await _context.Subscriptions
            .Where(s => s.CompanyId == companyId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .FirstOrDefaultAsync(ct);

        if (current is not null && current.PlanId == planId && current.EndDate > now)
        {
            current.EndDate = yearly ? current.EndDate.AddYears(1) : current.EndDate.AddMonths(1);
            current.UpdatedAt = now;
            return current.Id;
        }

        if (current is not null)
        {
            current.Status = SubscriptionStatus.Cancelled;
            current.CancelledAt = now;
            current.UpdatedAt = now;
        }

        var subscription = new Subscription
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            PlanId = planId,
            Status = SubscriptionStatus.Active,
            StartDate = now,
            EndDate = yearly ? now.AddYears(1) : now.AddMonths(1),
            BillingCycle = yearly ? BillingCycle.Yearly : BillingCycle.Monthly,
            AutoRenew = false,
        };
        _context.Subscriptions.Add(subscription);
        return subscription.Id;
    }

    private static CheckoutResponse Response(Payment p, CheckoutResult? r) =>
        new(p.Id, p.GatewayOrderId!, p.Provider!, p.Amount, p.Status.ToString(), r?.RedirectUrl, r?.Token, r?.Instructions);
}
