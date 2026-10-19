using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;

namespace BalanceIO.API.Tests;

public class WarehouseAndCashTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task Entitle(TestTenant t, string modules)
    {
        await factory.WithDb(async db =>
        {
            var plan = new Plan { Id = Guid.NewGuid(), Name = "Test", Modules = modules };
            db.Plans.Add(plan);
            db.Subscriptions.Add(new Subscription
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, PlanId = plan.Id,
                Status = SubscriptionStatus.Active, EndDate = DateTime.UtcNow.AddYears(1),
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);
    }

    [Fact]
    public async Task Warehouses_are_per_company_and_need_the_inventory_module()
    {
        var a = await factory.CreateTenantAsync("PT Gudang A");
        var b = await factory.CreateTenantAsync("PT Gudang B");

        Assert.Equal(HttpStatusCode.PaymentRequired, (await a.OwnerClient().GetAsync("/api/Warehouses")).StatusCode);

        await Entitle(a, "[\"accounting\",\"inventory\"]");
        await Entitle(b, "[\"accounting\",\"inventory\"]");

        var body = new { code = "WH-01", name = "Gudang Cikarang", city = "Bekasi", type = 0, isActive = true };
        Assert.Equal(HttpStatusCode.Created, (await a.OwnerClient().PostAsJsonAsync("/api/Warehouses", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await a.OwnerClient().PostAsJsonAsync("/api/Warehouses", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await b.OwnerClient().PostAsJsonAsync("/api/Warehouses", body)).StatusCode);

        var list = await (await a.OwnerClient().GetAsync("/api/Warehouses")).Json();
        Assert.Equal(1, list.GetArrayLength());
    }

    [Fact]
    public async Task Cash_position_nets_transfers_between_cash_accounts()
    {
        var t = await factory.CreateTenantAsync("PT Kas");
        await factory.AddAccount(t.CompanyId, "1-1101", "Petty Cash", "Asset");
        await factory.AddAccount(t.CompanyId, "1-1102", "Cash in Bank", "Asset");

        await Post(t, "2026-01-31", ("1-1102", 100m), (t.Revenue.Code, -100m));
        await Post(t, "2026-02-05", ("1-1102", 50m), (t.Revenue.Code, -50m));
        await Post(t, "2026-02-10", ("1-1101", 20m), ("1-1102", -20m));
        await Post(t, "2026-02-20", (t.Revenue.Code, 30m), ("1-1102", -30m));

        var cash = await (await t.OwnerClient().GetAsync("/api/Reports/cash-position?start=2026-02-01&end=2026-02-28")).Json();
        Assert.Equal(100m, cash.GetProperty("opening").GetDecimal());
        Assert.Equal(50m, cash.GetProperty("inflow").GetDecimal());
        Assert.Equal(30m, cash.GetProperty("outflow").GetDecimal());
        Assert.Equal(120m, cash.GetProperty("closing").GetDecimal());
        Assert.Equal(120m, cash.GetProperty("series").EnumerateArray().Last().GetProperty("balance").GetDecimal());
    }

    private Task Post(TestTenant t, string date, params (string Code, decimal Amount)[] lines) =>
        factory.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, Date = DateOnly.Parse(date), Status = JournalEntryStatus.Posted,
                Lines = lines.Select(l => new JournalLine
                {
                    Id = Guid.NewGuid(), AccountId = l.Code,
                    Debit = l.Amount > 0 ? l.Amount : 0m, Credit = l.Amount < 0 ? -l.Amount : 0m,
                }).ToList(),
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);
}
