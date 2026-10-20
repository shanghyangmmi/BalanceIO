using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BalanceIO.API.Tests;

/// <summary>
/// Plan prices as an administrator sets them and a visitor sees them: the
/// promotional price is charged only while it runs, the public pricing
/// endpoint needs no sign-in and prints what checkout would charge, and the
/// admin update refuses a promotion or module list that cannot be honoured.
/// </summary>
public class PlanPricingTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<Guid> SeedPlanAsync(decimal? promo, DateTime? promoEnds, bool active = true)
    {
        var id = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Plans.Add(new Plan
            {
                Id = id,
                Name = "Pro",
                PriceMonthly = 199_000m,
                PriceYearly = 1_990_000m,
                PromoPriceMonthly = promo,
                PromoEndsAt = promoEnds,
                Modules = "[\"accounting\",\"tax\"]",
                Features = "[\"Tax records\"]",
                IsActive = active,
            });
            await db.SaveChangesAsync();
        });
        return id;
    }

    private async Task<HttpClient> AdminClient()
    {
        var admin = new User { Id = Guid.NewGuid(), Name = "Platform", Email = $"admin-{Guid.NewGuid():N}@test.local", IsAdmin = true, IsEmailVerified = true };
        await factory.WithDb(async db => { db.Users.Add(admin); await db.SaveChangesAsync(); });
        using var scope = factory.Services.CreateScope();
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(admin));
        return client;
    }

    private static async Task<decimal> CheckoutAmount(TestTenant t, Guid plan, string cycle)
    {
        var response = await t.OwnerClient().PostJson("/api/Subscriptions/upgrade", new { companyId = t.CompanyId, planId = plan, billingCycle = cycle });
        Assert.True(response.IsSuccessStatusCode, await response.Body());
        return (await response.Json()).GetProperty("amount").GetDecimal();
    }

    [Fact]
    public async Task Promotional_price_is_charged_monthly_until_it_ends()
    {
        var running = await SeedPlanAsync(49_000m, DateTime.UtcNow.AddDays(30));
        var ended = await SeedPlanAsync(49_000m, DateTime.UtcNow.AddDays(-1));

        Assert.Equal(49_000m, await CheckoutAmount(await factory.CreateTenantAsync("PT Promo"), running, "monthly"));
        // Yearly billing is never discounted by the monthly promotion.
        Assert.Equal(1_990_000m, await CheckoutAmount(await factory.CreateTenantAsync("PT Tahunan"), running, "yearly"));
        Assert.Equal(199_000m, await CheckoutAmount(await factory.CreateTenantAsync("PT Telat"), ended, "monthly"));
    }

    [Fact]
    public async Task Public_pricing_needs_no_sign_in_and_shows_a_promotion_only_while_it_runs()
    {
        var running = await SeedPlanAsync(49_000m, DateTime.UtcNow.AddDays(30));
        var ended = await SeedPlanAsync(49_000m, DateTime.UtcNow.AddDays(-1));
        var hidden = await SeedPlanAsync(null, null, active: false);

        var response = await factory.CreateClient().GetAsync("/api/Plans/public");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Json();
        Assert.Equal("IDR", body.GetProperty("currency").GetString());

        var plans = body.GetProperty("plans").EnumerateArray().ToList();
        JsonElement Find(Guid id) => plans.Single(p => p.GetProperty("id").GetGuid() == id);

        var live = Find(running);
        Assert.Equal(49_000m, live.GetProperty("effectivePriceMonthly").GetDecimal());
        Assert.Equal(49_000m, live.GetProperty("promoPriceMonthly").GetDecimal());
        Assert.NotEqual(JsonValueKind.Null, live.GetProperty("promoEndsAt").ValueKind);
        Assert.Equal("Tax records", Assert.Single(live.GetProperty("highlights").EnumerateArray()).GetString());

        var over = Find(ended);
        Assert.Equal(199_000m, over.GetProperty("effectivePriceMonthly").GetDecimal());
        Assert.Equal(JsonValueKind.Null, over.GetProperty("promoPriceMonthly").ValueKind);
        Assert.Equal(JsonValueKind.Null, over.GetProperty("promoEndsAt").ValueKind);

        Assert.DoesNotContain(plans, p => p.GetProperty("id").GetGuid() == hidden);
    }

    [Fact]
    public async Task Admin_update_refuses_promotions_and_modules_that_cannot_be_honoured()
    {
        var plan = await SeedPlanAsync(null, null);
        var admin = await AdminClient();
        object Body(decimal? promo = null, DateTime? ends = null, string? modules = null) => new
        {
            id = plan,
            name = "Pro",
            priceMonthly = 199_000m,
            priceYearly = 1_990_000m,
            promoPriceMonthly = promo,
            promoEndsAt = ends,
            modules,
            features = "[\"Tax records\"]",
            maxUsers = 5,
            maxCompanies = 3,
            maxStorageMB = 100,
            maxJournalEntries = 0,
            isActive = true,
            isPopular = true,
        };
        async Task<string?> Code(object body)
        {
            var r = await admin.PutAsJsonAsync($"/api/admin/plans/{plan}", body);
            return r.IsSuccessStatusCode ? null : (await r.Json()).GetProperty("code").GetString();
        }

        var later = DateTime.UtcNow.AddDays(14);
        Assert.Equal("PROMO_INCOMPLETE", await Code(Body(promo: 49_000m)));
        Assert.Equal("PROMO_PRICE_INVALID", await Code(Body(promo: 199_000m, ends: later)));
        Assert.Equal("PROMO_ENDED", await Code(Body(promo: 49_000m, ends: DateTime.UtcNow.AddDays(-1))));
        Assert.Equal("PLAN_MODULES_INVALID", await Code(Body(modules: "[\"crm\"]")));

        Assert.Null(await Code(Body(promo: 49_000m, ends: later, modules: "[\"tax\",\"payroll\"]")));
        var saved = await factory.WithDb(db => db.Plans.AsNoTracking().SingleAsync(p => p.Id == plan));
        Assert.Equal(49_000m, saved.PromoPriceMonthly);
        Assert.NotNull(saved.PromoEndsAt);
        // Accounting is the core door and is added when it is left out.
        Assert.Equal(new[] { "accounting", "tax", "payroll" }, JsonSerializer.Deserialize<string[]>(saved.Modules!));

        // Clearing the promotion is a valid update.
        Assert.Null(await Code(Body(modules: "[\"accounting\",\"tax\",\"payroll\"]")));
        saved = await factory.WithDb(db => db.Plans.AsNoTracking().SingleAsync(p => p.Id == plan));
        Assert.Null(saved.PromoPriceMonthly);
        Assert.Null(saved.PromoEndsAt);
    }
}
