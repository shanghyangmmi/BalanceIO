using System.Net.Http.Json;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace BalanceIO.API.Tests;

/// <summary>
/// Moving-average costing: receipts set the average, issues leave at it,
/// emptying the stock takes the whole carrying value, voids restore the
/// value they removed, and the inventory account always equals the stock's
/// carrying value when every movement is journaled.
/// </summary>
public class MovingAverageTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record Setup(TestTenant T, Guid Product, Guid Vendor, Guid Customer);

    private async Task<Setup> SeedAsync()
    {
        var t = await factory.CreateTenantAsync("PT Rata");
        foreach (var (code, name, type) in new[]
        {
            ("1-1130", "Accounts Receivable", "Asset"), ("1-1400", "Inventory", "Asset"), ("1-1700", "VAT In", "Asset"),
            ("2-1100", "Trade Payables", "Liability"), ("2-1150", "Goods Received Not Invoiced", "Liability"), ("2-1400", "PPN Payable", "Liability"),
            ("5-1000", "Cost of Goods Sold", "Expense"), ("5-9000", "Inventory Variance", "Expense"),
        })
            await factory.AddAccount(t.CompanyId, code, name, type);

        var product = Guid.NewGuid();
        var vendor = Guid.NewGuid();
        var customer = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            var plan = new Plan { Id = Guid.NewGuid(), Name = "Inv", Modules = "[\"accounting\",\"inventory\"]" };
            db.Plans.Add(plan);
            db.Subscriptions.Add(new Subscription { Id = Guid.NewGuid(), CompanyId = t.CompanyId, PlanId = plan.Id, Status = SubscriptionStatus.Active, EndDate = DateTime.UtcNow.AddYears(1) });
            db.Products.Add(new Product { Id = product, CompanyId = t.CompanyId, Code = "PRD-1", Name = "Kardus", Type = ProductType.Product, TrackInventory = true, BuyPrice = 900m, SellPrice = 2_000m, Unit = "pcs" });
            db.Contacts.Add(new Contact { Id = vendor, CompanyId = t.CompanyId, Code = "V-1", Name = "Pemasok", IsVendor = true, IsCustomer = false });
            db.Contacts.Add(new Contact { Id = customer, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return new Setup(t, product, vendor, customer);
    }

    private static async Task Ok(HttpResponseMessage res) => Assert.True(res.IsSuccessStatusCode, await res.Body());

    private async Task<Guid> PostBill(Setup s, decimal qty, decimal unitPrice, Guid? order = null)
    {
        var bill = await s.T.OwnerClient().PostJson("/api/PurchaseBills", new
        {
            billNumber = "BILL-" + Guid.NewGuid().ToString("N")[..6], billDate = "2026-03-01", dueDate = "2026-03-31",
            contactId = s.Vendor, currency = "IDR", purchaseOrderId = order,
            lines = new[] { new { productId = s.Product, description = "Kardus", quantity = qty, unitPrice, taxRate = 0m } },
        });
        await Ok(bill);
        var id = (await bill.Json()).GetProperty("id").GetGuid();
        await Ok(await s.T.ReviewerClient().PostJson($"/api/PurchaseBills/{id}/post", new { }));
        return id;
    }

    private async Task<Guid> PostInvoice(Setup s, decimal qty)
    {
        var invoice = await s.T.OwnerClient().PostJson("/api/SalesInvoices", new
        {
            invoiceNumber = "INV-" + Guid.NewGuid().ToString("N")[..6], invoiceDate = "2026-03-10", dueDate = "2026-04-10",
            contactId = s.Customer, currency = "IDR",
            lines = new[] { new { productId = s.Product, description = "Kardus", quantity = qty, unitPrice = 2_000m, isTaxable = false, taxRate = 0m, dppScheme = 1 } },
        });
        await Ok(invoice);
        var id = (await invoice.Json()).GetProperty("id").GetGuid();
        await Ok(await s.T.OwnerClient().PostJson($"/api/SalesInvoices/{id}/post", new { }));
        return id;
    }

    private Task<Product> Product(Setup s) =>
        factory.WithDb(db => db.Products.AsNoTracking().SingleAsync(p => p.Id == s.Product), s.T.CompanyId);

    /// <summary>Posted Dr − Cr on one account.</summary>
    private async Task<decimal> Balance(Setup s, string code)
    {
        var lines = await factory.WithDb(db => db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == s.T.CompanyId && l.JournalEntry.Status == JournalEntryStatus.Posted && l.AccountId == code)
            .Select(l => new { l.Debit, l.Credit })
            .ToListAsync(), s.T.CompanyId);
        return lines.Sum(l => l.Debit - l.Credit);
    }

    [Fact]
    public async Task Sales_cost_the_average_of_the_receipts()
    {
        var s = await SeedAsync();
        await PostBill(s, 10m, 1_000m);
        await PostBill(s, 10m, 1_300m);

        var p = await Product(s);
        Assert.Equal(1_150m, p.AverageCost);
        Assert.Equal(23_000m, p.InventoryValue);

        await PostInvoice(s, 5m);
        Assert.Equal(5_750m, await Balance(s, "5-1000"));
        p = await Product(s);
        Assert.Equal(17_250m, p.InventoryValue);
        Assert.Equal(p.InventoryValue, await Balance(s, "1-1400"));

        // The average holds while stock only leaves.
        await PostBill(s, 5m, 1_450m);
        p = await Product(s);
        Assert.Equal(1_225m, p.AverageCost);
        Assert.Equal(p.InventoryValue, await Balance(s, "1-1400"));
    }

    [Fact]
    public async Task Stock_card_rolls_from_opening_to_the_carrying_value()
    {
        var s = await SeedAsync();
        await PostBill(s, 10m, 1_000m);            // 2026-03-01
        await PostBill(s, 10m, 1_300m);
        await PostInvoice(s, 5m);                  // 2026-03-10

        var card = await (await s.T.OwnerClient().GetAsync("/api/Reports/inventory-movements?start=2026-03-05&end=2026-03-31")).Json();
        var product = card.GetProperty("products").EnumerateArray().Single();
        Assert.Equal(20m, product.GetProperty("openingQuantity").GetDecimal());
        Assert.Equal(23_000m, product.GetProperty("openingValue").GetDecimal());
        Assert.Equal(5_750m, product.GetProperty("valueOut").GetDecimal());
        Assert.Equal(15m, product.GetProperty("closingQuantity").GetDecimal());
        Assert.Equal((await Product(s)).InventoryValue, product.GetProperty("closingValue").GetDecimal());
        Assert.Single(product.GetProperty("movements").EnumerateArray());
    }

    [Fact]
    public async Task Aging_attributes_stock_to_the_latest_receipts()
    {
        var s = await SeedAsync();
        await PostBill(s, 10m, 1_000m);            // 2026-03-01
        await PostInvoice(s, 4m);                  // 2026-03-10

        var aging = await (await s.T.OwnerClient().GetAsync("/api/Reports/inventory-aging?asOf=2026-04-15")).Json();
        var row = aging.GetProperty("rows").EnumerateArray().Single();
        var buckets = row.GetProperty("buckets").EnumerateArray().ToList();
        Assert.Equal(6m, buckets[1].GetProperty("quantity").GetDecimal());   // 45 days old
        Assert.Equal(6_000m, buckets.Sum(b => b.GetProperty("value").GetDecimal()));
        Assert.Equal(36, row.GetProperty("daysSinceLastSale").GetInt32());
    }

    [Fact]
    public async Task Emptying_the_stock_takes_the_whole_value_with_no_rounding_left()
    {
        var s = await SeedAsync();
        await PostBill(s, 3m, 333.33m);           // 999.99 for three

        await PostInvoice(s, 1m);
        await PostInvoice(s, 1m);
        await PostInvoice(s, 1m);

        var p = await Product(s);
        Assert.Equal(0m, p.StockOnHand);
        Assert.Equal(0m, p.InventoryValue);
        Assert.Equal(999.99m, await Balance(s, "5-1000"));
        Assert.Equal(0m, await Balance(s, "1-1400"));
    }

    [Fact]
    public async Task Voids_restore_exactly_the_value_they_removed()
    {
        var s = await SeedAsync();
        await PostBill(s, 10m, 1_000m);
        var second = await PostBill(s, 10m, 1_300m);
        var invoice = await PostInvoice(s, 4m);

        await Ok(await s.T.OwnerClient().PostJson($"/api/SalesInvoices/{invoice}/void", new { }));
        var p = await Product(s);
        Assert.Equal(20m, p.StockOnHand);
        Assert.Equal(23_000m, p.InventoryValue);

        await Ok(await s.T.ReviewerClient().PostJson($"/api/PurchaseBills/{second}/void", new { }));
        p = await Product(s);
        Assert.Equal(10m, p.StockOnHand);
        Assert.Equal(10_000m, p.InventoryValue);
        Assert.Equal(1_000m, p.AverageCost);
        Assert.Equal(p.InventoryValue, await Balance(s, "1-1400"));
    }

    [Fact]
    public async Task Bill_for_a_received_order_settles_the_price()
    {
        var s = await SeedAsync();
        var order = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.PurchaseOrders.Add(new PurchaseOrder
            {
                Id = order, CompanyId = s.T.CompanyId, OrderNumber = "PO-MA-1", ContactId = s.Vendor,
                OrderDate = new DateOnly(2026, 2, 20), Status = PurchaseOrderStatus.Approved,
                Lines = [new PurchaseOrderLine { Id = Guid.NewGuid(), ProductId = s.Product, Description = "Kardus", Quantity = 10m, UnitPrice = 1_000m, LineTotal = 10_000m }],
            });
            await db.SaveChangesAsync();
        }, s.T.CompanyId);

        await Ok(await s.T.OwnerClient().PostJson($"/api/PurchaseOrders/{order}/receive", new { }));
        Assert.Equal(10_000m, (await Product(s)).InventoryValue);
        Assert.Equal(10_000m, await Balance(s, "1-1400"));
        Assert.Equal(-10_000m, await Balance(s, "2-1150"));   // received, not yet invoiced

        var bill = await PostBill(s, 10m, 1_050m, order);
        var p = await Product(s);
        Assert.Equal(10m, p.StockOnHand);
        Assert.Equal(10_500m, p.InventoryValue);
        Assert.Equal(1_050m, p.AverageCost);
        Assert.Equal(p.InventoryValue, await Balance(s, "1-1400"));
        Assert.Equal(0m, await Balance(s, "2-1150"));

        // Voiding the bill puts the receipt back in goods received not invoiced.
        await Ok(await s.T.ReviewerClient().PostJson($"/api/PurchaseBills/{bill}/void", new { }));
        Assert.Equal(-10_000m, await Balance(s, "2-1150"));
        Assert.Equal(10_000m, (await Product(s)).InventoryValue);
        Assert.Equal(10_000m, await Balance(s, "1-1400"));
    }

    [Fact]
    public async Task Bill_for_an_order_received_before_the_journal_debits_inventory()
    {
        var s = await SeedAsync();
        var order = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.PurchaseOrders.Add(new PurchaseOrder
            {
                Id = order, CompanyId = s.T.CompanyId, OrderNumber = "PO-OLD-1", ContactId = s.Vendor,
                OrderDate = new DateOnly(2026, 1, 5), Status = PurchaseOrderStatus.Received,
                Lines = [new PurchaseOrderLine { Id = Guid.NewGuid(), ProductId = s.Product, Description = "Kardus", Quantity = 10m, UnitPrice = 1_000m }],
            });
            // The receipt as it was recorded: stock and value, no journal.
            db.InventoryMovements.Add(new InventoryMovement { Id = Guid.NewGuid(), CompanyId = s.T.CompanyId, ProductId = s.Product, MovementDate = new DateOnly(2026, 1, 6), Type = InventoryMovementType.Purchase, Quantity = 10m, UnitCost = 1_000m, TotalCost = 10_000m, ReferenceNumber = "PO-OLD-1" });
            var product = await db.Products.SingleAsync(p => p.Id == s.Product);
            product.StockOnHand = 10m; product.InventoryValue = 10_000m; product.AverageCost = 1_000m;
            await db.SaveChangesAsync();
        }, s.T.CompanyId);

        await PostBill(s, 10m, 1_000m, order);
        Assert.Equal(10_000m, await Balance(s, "1-1400"));
        Assert.Equal(0m, await Balance(s, "2-1150"));
        Assert.Equal(10_000m, (await Product(s)).InventoryValue);
    }

    [Fact]
    public async Task Adjustments_and_opname_move_value_at_the_average()
    {
        var s = await SeedAsync();
        await PostBill(s, 10m, 1_000m);
        await PostBill(s, 10m, 1_300m);

        var loss = await s.T.OwnerClient().PostAsJsonAsync($"/api/Products/{s.Product}/adjust-stock",
            new { quantity = -2m, reason = "Rusak", date = "2026-03-15", unitCost = 1m });
        await Ok(loss);
        Assert.Equal(2_300m, (await loss.Json()).GetProperty("value").GetDecimal());

        var created = await s.T.OwnerClient().PostAsJsonAsync("/api/StockOpname",
            new { opnameNumber = "SO-MA-1", opnameDate = "2026-03-20", description = "Hitung" });
        await Ok(created);
        var opname = (await created.Json()).GetProperty("id").GetGuid();
        var initialized = await (await s.T.OwnerClient().PostJson($"/api/StockOpname/{opname}/initialize", new { })).Json();
        var line = initialized.GetProperty("lines").EnumerateArray().Single();
        await Ok(await s.T.OwnerClient().PutAsJsonAsync($"/api/StockOpname/{opname}", new
        {
            id = opname, opnameNumber = "SO-MA-1", opnameDate = "2026-03-20", description = "Hitung",
            lines = new[] { new { id = line.GetProperty("id").GetGuid(), physicalQty = 20m } },
        }));
        await Ok(await s.T.OwnerClient().PostJson($"/api/StockOpname/{opname}/process", new { }));

        var p = await Product(s);
        Assert.Equal(20m, p.StockOnHand);
        Assert.Equal(1_150m, p.AverageCost);
        Assert.Equal(23_000m, p.InventoryValue);
        Assert.Equal(p.InventoryValue, await Balance(s, "1-1400"));
        Assert.Equal(0m, await Balance(s, "5-9000"));
    }

    [Fact]
    public async Task Seeder_opens_the_average_at_buy_price_once()
    {
        var t = await factory.CreateTenantAsync("PT Awal");
        var product = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Products.Add(new Product { Id = product, CompanyId = t.CompanyId, Code = "OLD-MA", Name = "Lama", Type = ProductType.Product, TrackInventory = true, StockOnHand = 3m, BuyPrice = 333.335m });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await ReferenceDataSeeder.SeedAsync(db, NullLogger.Instance);
            await ReferenceDataSeeder.SeedAsync(db, NullLogger.Instance);
        }

        var p = await factory.WithDb(db => db.Products.AsNoTracking().SingleAsync(x => x.Id == product), t.CompanyId);
        Assert.Equal(1_000m, p.InventoryValue);
        Assert.Equal(333.335m, p.AverageCost);
    }
}
