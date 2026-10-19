using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>A manual stock adjustment moves the quantity and the ledger together.</summary>
public class StockAdjustmentTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(TestTenant, Guid)> SeedAsync()
    {
        var t = await factory.CreateTenantAsync("PT Stok");
        await factory.AddAccount(t.CompanyId, "1-1400", "Inventory", "Asset");
        await factory.AddAccount(t.CompanyId, "5-9000", "Inventory Variance", "Expense");
        var product = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Products.Add(new Product
            {
                Id = product, CompanyId = t.CompanyId, Code = "PRD-0001", Name = "Kertas A4",
                Type = ProductType.Product, TrackInventory = true, BuyPrice = 10_000m, StockOnHand = 4m, InventoryValue = 40_000m, AverageCost = 10_000m, Unit = "rim",
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return (t, product);
    }

    private async Task<decimal> InventoryBalance(TestTenant t) =>
        (await factory.WithDb(db => db.JournalLines
            .Where(l => l.AccountId == "1-1400" && l.JournalEntry!.Status == JournalEntryStatus.Posted)
            .Select(l => new { l.Debit, l.Credit }).ToListAsync(), t.CompanyId))
        .Sum(l => l.Debit - l.Credit);

    [Fact]
    public async Task Adjustment_posts_value_and_records_movement()
    {
        var (t, product) = await SeedAsync();

        var up = await t.OwnerClient().PostAsJsonAsync($"/api/Products/{product}/adjust-stock", new { quantity = 5m, reason = "Found in back room", date = "2026-05-10" });
        Assert.Equal(HttpStatusCode.OK, up.StatusCode);
        Assert.Equal(50_000m, await InventoryBalance(t));

        var down = await t.OwnerClient().PostAsJsonAsync($"/api/Products/{product}/adjust-stock", new { quantity = -3m, reason = "Water damage", date = "2026-05-11" });
        Assert.Equal(HttpStatusCode.OK, down.StatusCode);
        Assert.Equal(20_000m, await InventoryBalance(t));

        var stock = await factory.WithDb(db => db.Products.Where(p => p.Id == product).Select(p => p.StockOnHand).SingleAsync(), t.CompanyId);
        Assert.Equal(6m, stock);
        Assert.Equal(2, await factory.WithDb(db => db.InventoryMovements.CountAsync(), t.CompanyId));
    }

    [Fact]
    public async Task Adjustment_refuses_negative_stock_missing_reason_and_locked_period()
    {
        var (t, product) = await SeedAsync();

        var negative = await t.OwnerClient().PostAsJsonAsync($"/api/Products/{product}/adjust-stock", new { quantity = -9m, reason = "x" });
        Assert.Contains("NEGATIVE_STOCK", await negative.Body());

        var noReason = await t.OwnerClient().PostAsJsonAsync($"/api/Products/{product}/adjust-stock", new { quantity = 1m });
        Assert.Equal(HttpStatusCode.BadRequest, noReason.StatusCode);

        await factory.WithDb(async db =>
        {
            (await db.Companies.SingleAsync(c => c.Id == t.CompanyId)).LockDate = new DateOnly(2026, 6, 30);
            await db.SaveChangesAsync();
        });
        var locked = await t.OwnerClient().PostAsJsonAsync($"/api/Products/{product}/adjust-stock", new { quantity = 1m, reason = "late", date = "2026-06-15" });
        Assert.Contains("PERIOD_LOCKED", await locked.Body());
        Assert.Equal(0m, await InventoryBalance(t));
    }
}
