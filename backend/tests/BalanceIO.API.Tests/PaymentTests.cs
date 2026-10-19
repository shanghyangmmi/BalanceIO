using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BalanceIO.API.Tests;

/// <summary>
/// Paying for a plan: checkout records the payment first, only a verified
/// notification for the right amount (or an admin confirming a transfer)
/// makes it Success, and Success activates the plan exactly once.
/// </summary>
public class PaymentTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string ServerKey = "SB-Mid-server-test-key";

    private async Task<(TestTenant T, Guid Plan)> SeedAsync(decimal price = 199_000m)
    {
        var t = await factory.CreateTenantAsync("PT Bayar");
        var plan = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Plans.Add(new Plan { Id = plan, Name = "Pro", PriceMonthly = price, PriceYearly = price * 10, Modules = "[\"accounting\",\"tax\"]", IsActive = true });
            await db.SaveChangesAsync();
        });
        return (t, plan);
    }

    private Task<Subscription?> ActiveSubscription(Guid company) =>
        factory.WithDb(db => db.Subscriptions.Where(s => s.CompanyId == company && s.Status == SubscriptionStatus.Active).FirstOrDefaultAsync());

    private async Task<HttpClient> AdminClient()
    {
        var admin = new User { Id = Guid.NewGuid(), Name = "Platform", Email = $"admin-{Guid.NewGuid():N}@test.local", IsAdmin = true, IsEmailVerified = true };
        await factory.WithDb(async db => { db.Users.Add(admin); await db.SaveChangesAsync(); });
        using var scope = factory.Services.CreateScope();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin));
        return client;
    }

    [Fact]
    public async Task Manual_transfer_activates_the_plan_when_an_admin_confirms_it()
    {
        var (t, plan) = await SeedAsync();

        var checkout = await t.OwnerClient().PostJson("/api/Subscriptions/upgrade", new { companyId = t.CompanyId, planId = plan, billingCycle = "monthly" });
        Assert.True(checkout.IsSuccessStatusCode, await checkout.Body());
        var body = await checkout.Json();
        Assert.Equal("manual", body.GetProperty("provider").GetString());
        Assert.Equal("Pending", body.GetProperty("status").GetString());
        Assert.Contains(body.GetProperty("orderId").GetString()!, body.GetProperty("instructions").GetString());
        Assert.Null(await ActiveSubscription(t.CompanyId));

        var paymentId = body.GetProperty("paymentId").GetGuid();
        var admin = await AdminClient();
        Assert.Equal(HttpStatusCode.OK, (await admin.PostJson($"/api/admin/payments/{paymentId}/confirm", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostJson($"/api/admin/payments/{paymentId}/confirm", new { })).StatusCode);

        var subscriptions = await factory.WithDb(db => db.Subscriptions.Where(s => s.CompanyId == t.CompanyId).ToListAsync());
        var active = Assert.Single(subscriptions);
        Assert.Equal(plan, active.PlanId);

        // A company member cannot confirm their own transfer.
        Assert.Equal(HttpStatusCode.Forbidden, (await t.OwnerClient().PostJson($"/api/admin/payments/{paymentId}/confirm", new { })).StatusCode);
    }

    [Fact]
    public async Task Free_plan_activates_without_a_gateway()
    {
        var (t, plan) = await SeedAsync(price: 0m);
        var checkout = await (await t.OwnerClient().PostJson("/api/Subscriptions/upgrade", new { companyId = t.CompanyId, planId = plan })).Json();
        Assert.Equal("Success", checkout.GetProperty("status").GetString());
        Assert.Equal(plan, (await ActiveSubscription(t.CompanyId))!.PlanId);
    }

    private static string Signed(string orderId, string statusCode, string gross, string transactionStatus, string? key = null)
    {
        var signature = Convert.ToHexString(SHA512.HashData(Encoding.UTF8.GetBytes(orderId + statusCode + gross + (key ?? ServerKey)))).ToLowerInvariant();
        return $$"""{"order_id":"{{orderId}}","status_code":"{{statusCode}}","gross_amount":"{{gross}}","signature_key":"{{signature}}","transaction_status":"{{transactionStatus}}","fraud_status":"accept","transaction_id":"tx-1","payment_type":"bank_transfer"}""";
    }

    [Fact]
    public async Task Midtrans_notification_is_applied_only_when_signed_and_for_the_right_amount()
    {
        using var midtrans = factory.WithSettings(("Payments:Midtrans:ServerKey", ServerKey));
        var (t, plan) = await SeedAsync();
        var orderId = "SUB-TEST-" + Guid.NewGuid().ToString("N")[..8];
        await factory.WithDb(async db =>
        {
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, PlanId = plan, BillingCycle = "monthly", Amount = 199_000m,
                Currency = "IDR", GatewayOrderId = orderId, Provider = "midtrans", Status = PaymentStatus.Pending,
            });
            await db.SaveChangesAsync();
        });
        var client = midtrans.CreateClient();
        StringContent Json(string s) => new(s, Encoding.UTF8, "application/json");

        var forged = await client.PostAsync("/api/payments/webhook/midtrans", Json(Signed(orderId, "200", "199000.00", "settlement", key: "wrong-key")));
        Assert.Equal(HttpStatusCode.Unauthorized, forged.StatusCode);

        var underpaid = await client.PostAsync("/api/payments/webhook/midtrans", Json(Signed(orderId, "200", "1000.00", "settlement")));
        Assert.Equal(HttpStatusCode.Unauthorized, underpaid.StatusCode);
        Assert.Null(await ActiveSubscription(t.CompanyId));

        var pending = await client.PostAsync("/api/payments/webhook/midtrans", Json(Signed(orderId, "201", "199000.00", "pending")));
        Assert.Equal(HttpStatusCode.OK, pending.StatusCode);
        Assert.Null(await ActiveSubscription(t.CompanyId));

        var settled = await client.PostAsync("/api/payments/webhook/midtrans", Json(Signed(orderId, "200", "199000.00", "settlement")));
        Assert.Equal(HttpStatusCode.OK, settled.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/payments/webhook/midtrans", Json(Signed(orderId, "200", "199000.00", "settlement")))).StatusCode);

        var subscription = await ActiveSubscription(t.CompanyId);
        Assert.Equal(plan, subscription!.PlanId);
        Assert.Equal(1, await factory.WithDb(db => db.Subscriptions.CountAsync(s => s.CompanyId == t.CompanyId)));
        var payment = await factory.WithDb(db => db.Payments.SingleAsync(p => p.GatewayOrderId == orderId));
        Assert.Equal(PaymentStatus.Success, payment.Status);
        Assert.Equal("tx-1", payment.GatewayTransactionId);
    }

    [Fact]
    public async Task Unconfigured_provider_falls_back_to_manual()
    {
        using var configured = factory.WithSettings(("Payments:Provider", "midtrans"));
        var (t, plan) = await SeedAsync();
        var client = configured.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", t.Owner.Token);
        client.DefaultRequestHeaders.Add("X-Company-Id", t.CompanyId.ToString());

        var checkout = await (await client.PostJson("/api/Subscriptions/upgrade", new { companyId = t.CompanyId, planId = plan })).Json();
        Assert.Equal("manual", checkout.GetProperty("provider").GetString());
    }
}
