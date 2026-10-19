using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace BalanceIO.API.Tests;

/// <summary>
/// Stock per warehouse: every writer records a movement against a warehouse,
/// the warehouse balances add up to stock on hand, and transfers, voids,
/// opname and purchase orders move the right stock in the right place.
/// </summary>
public class WarehouseStockTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record Setup(TestTenant T, Guid Product, Guid Vendor, Guid Customer, Guid Main, Guid Second);

    private async Task<Setup> SeedAsync()
    {
        var t = await factory.CreateTenantAsync("PT Gudang");
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
            db.Products.Add(new Product { Id = product, CompanyId = t.CompanyId, Code = "PRD-1", Name = "Kardus", Type = ProductType.Product, TrackInventory = true, BuyPrice = 1_000m, SellPrice = 2_000m, Unit = "pcs" });
            db.Contacts.Add(new Contact { Id = vendor, CompanyId = t.CompanyId, Code = "V-1", Name = "Pemasok", IsVendor = true, IsCustomer = false });
            db.Contacts.Add(new Contact { Id = customer, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        var list = await (await t.OwnerClient().GetAsync("/api/Warehouses")).Json();
        var main = list.EnumerateArray().Single(w => w.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid();

        var created = await t.OwnerClient().PostAsJsonAsync("/api/Warehouses", new { code = "SBY", name = "Gudang Surabaya", type = 0, isActive = true });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var second = (await created.Json()).GetProperty("id").GetGuid();

        return new Setup(t, product, vendor, customer, main, second);
    }

    private static async Task Ok(HttpResponseMessage res) => Assert.True(res.IsSuccessStatusCode, await res.Body());

    private async Task PostBill(Setup s, decimal qty, Guid? warehouse = null, Guid? order = null)
    {
        var bill = await s.T.OwnerClient().PostJson("/api/PurchaseBills", new
        {
            billNumber = "BILL-" + Guid.NewGuid().ToString("N")[..6], billDate = "2026-03-01", dueDate = "2026-03-31",
            contactId = s.Vendor, currency = "IDR", warehouseId = warehouse, purchaseOrderId = order,
            lines = new[] { new { productId = s.Product, description = "Kardus", quantity = qty, unitPrice = 1_000m, taxRate = 0m } },
        });
        await Ok(bill);
        // Segregation of duties: the creator cannot post.
        await Ok(await s.T.ReviewerClient().PostJson($"/api/PurchaseBills/{(await bill.Json()).GetProperty("id").GetGuid()}/post", new { }));
    }

    private async Task<Guid> PostInvoice(Setup s, decimal qty, Guid? warehouse)
    {
        var invoice = await s.T.OwnerClient().PostJson("/api/SalesInvoices", new
        {
            invoiceNumber = "INV-" + Guid.NewGuid().ToString("N")[..6], invoiceDate = "2026-03-10", dueDate = "2026-04-10",
            contactId = s.Customer, currency = "IDR", warehouseId = warehouse,
            lines = new[] { new { productId = s.Product, description = "Kardus", quantity = qty, unitPrice = 2_000m, isTaxable = false, taxRate = 0m, dppScheme = 1 } },
        });
        await Ok(invoice);
        var id = (await invoice.Json()).GetProperty("id").GetGuid();
        await Ok(await s.T.OwnerClient().PostJson($"/api/SalesInvoices/{id}/post", new { }));
        return id;
    }

    private async Task<Dictionary<Guid, decimal>> Stock(Setup s)
    {
        var json = await (await s.T.OwnerClient().GetAsync("/api/Warehouses/stock")).Json();
        return json.GetProperty("rows").EnumerateArray()
            .Where(r => r.GetProperty("productId").GetGuid() == s.Product)
            .ToDictionary(r => r.GetProperty("warehouseId").GetGuid(), r => r.GetProperty("quantity").GetDecimal());
    }

    private Task<decimal> OnHand(Setup s) =>
        factory.WithDb(db => db.Products.Where(p => p.Id == s.Product).Select(p => p.StockOnHand).SingleAsync(), s.T.CompanyId);

    [Fact]
    public async Task Purchases_sales_and_transfers_land_in_their_warehouses()
    {
        var s = await SeedAsync();

        await PostBill(s, 10m);                         // default warehouse
        await PostBill(s, 4m, s.Second);
        var transfer = await s.T.OwnerClient().PostAsJsonAsync("/api/Warehouses/transfers",
            new { productId = s.Product, fromWarehouseId = s.Main, toWarehouseId = s.Second, quantity = 3m });
        await Ok(transfer);
        await PostInvoice(s, 5m, s.Second);

        var stock = await Stock(s);
        Assert.Equal(7m, stock[s.Main]);
        Assert.Equal(2m, stock[s.Second]);
        Assert.Equal(9m, await OnHand(s));

        var tooMuch = await s.T.OwnerClient().PostAsJsonAsync("/api/Warehouses/transfers",
            new { productId = s.Product, fromWarehouseId = s.Second, toWarehouseId = s.Main, quantity = 5m });
        Assert.Contains("INSUFFICIENT_STOCK", await tooMuch.Body());
    }

    [Fact]
    public async Task Voided_invoice_returns_stock_to_the_warehouse_it_left()
    {
        var s = await SeedAsync();
        await PostBill(s, 6m, s.Second);
        var invoice = await PostInvoice(s, 4m, s.Second);

        await Ok(await s.T.OwnerClient().PostJson($"/api/SalesInvoices/{invoice}/void", new { }));

        var stock = await Stock(s);
        Assert.Equal(6m, stock[s.Second]);
        Assert.False(stock.ContainsKey(s.Main));
        Assert.Equal(6m, await OnHand(s));
    }

    [Fact]
    public async Task Bill_for_a_received_order_does_not_count_the_goods_twice()
    {
        var s = await SeedAsync();
        var order = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.PurchaseOrders.Add(new PurchaseOrder
            {
                Id = order, CompanyId = s.T.CompanyId, OrderNumber = "PO-1", ContactId = s.Vendor,
                OrderDate = new DateOnly(2026, 2, 20), Status = PurchaseOrderStatus.Approved, WarehouseId = s.Second,
                Lines = [new PurchaseOrderLine { Id = Guid.NewGuid(), ProductId = s.Product, Description = "Kardus", Quantity = 8m, UnitPrice = 1_000m }],
            });
            await db.SaveChangesAsync();
        }, s.T.CompanyId);

        await Ok(await s.T.OwnerClient().PostJson($"/api/PurchaseOrders/{order}/receive", new { }));
        await PostBill(s, 8m, order: order);

        Assert.Equal(8m, await OnHand(s));
        Assert.Equal(8m, (await Stock(s))[s.Second]);
    }

    [Fact]
    public async Task Opname_of_one_warehouse_adjusts_only_that_warehouse()
    {
        var s = await SeedAsync();
        await PostBill(s, 5m);
        await PostBill(s, 5m, s.Second);

        var created = await s.T.OwnerClient().PostAsJsonAsync("/api/StockOpname",
            new { opnameNumber = "SO-T-1", opnameDate = "2026-03-20", description = "Hitung Surabaya", warehouseId = s.Second });
        await Ok(created);
        var opname = (await created.Json()).GetProperty("id").GetGuid();
        var initRes = await s.T.OwnerClient().PostJson($"/api/StockOpname/{opname}/initialize", new { });
        await Ok(initRes);
        var initialized = await initRes.Json();
        var line = initialized.GetProperty("lines").EnumerateArray().Single();
        Assert.Equal(5m, line.GetProperty("systemQty").GetDecimal());

        var update = await s.T.OwnerClient().PutAsJsonAsync($"/api/StockOpname/{opname}", new
        {
            id = opname, opnameNumber = "SO-T-1", opnameDate = "2026-03-20", description = "Hitung Surabaya",
            lines = new[] { new { id = line.GetProperty("id").GetGuid(), physicalQty = 3m } },
        });
        await Ok(update);
        await Ok(await s.T.OwnerClient().PostJson($"/api/StockOpname/{opname}/process", new { }));

        var stock = await Stock(s);
        Assert.Equal(5m, stock[s.Main]);
        Assert.Equal(3m, stock[s.Second]);
        Assert.Equal(8m, await OnHand(s));
    }

    [Fact]
    public async Task Default_warehouse_and_warehouses_in_use_are_protected()
    {
        var s = await SeedAsync();
        await PostBill(s, 1m, s.Second);

        Assert.Contains("DEFAULT_WAREHOUSE", await (await s.T.OwnerClient().DeleteAsync($"/api/Warehouses/{s.Main}")).Body());
        Assert.Contains("WAREHOUSE_IN_USE", await (await s.T.OwnerClient().DeleteAsync($"/api/Warehouses/{s.Second}")).Body());

        var makeDefault = await s.T.OwnerClient().PutAsJsonAsync($"/api/Warehouses/{s.Second}",
            new { code = "SBY", name = "Gudang Surabaya", type = 0, isActive = true, isDefault = true });
        await Ok(makeDefault);
        var list = await (await s.T.OwnerClient().GetAsync("/api/Warehouses")).Json();
        Assert.Equal(s.Second, list.EnumerateArray().Single(w => w.GetProperty("isDefault").GetBoolean()).GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Seeder_assigns_old_movements_and_aligns_unrecorded_stock()
    {
        var t = await factory.CreateTenantAsync("PT Lama");
        var product = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Products.Add(new Product { Id = product, CompanyId = t.CompanyId, Code = "OLD-1", Name = "Barang lama", Type = ProductType.Product, TrackInventory = true, StockOnHand = 12m, BuyPrice = 500m });
            db.InventoryMovements.Add(new InventoryMovement { Id = Guid.NewGuid(), CompanyId = t.CompanyId, ProductId = product, MovementDate = new DateOnly(2025, 1, 1), Type = InventoryMovementType.Purchase, Quantity = 5m, UnitCost = 500m, TotalCost = 2_500m });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await ReferenceDataSeeder.SeedAsync(db, NullLogger.Instance);
            await ReferenceDataSeeder.SeedAsync(db, NullLogger.Instance); // idempotent
        }

        var movements = await factory.WithDb(db => db.InventoryMovements.Where(m => m.ProductId == product).ToListAsync(), t.CompanyId);
        Assert.All(movements, m => Assert.NotNull(m.WarehouseId));
        Assert.Equal(2, movements.Count);
        Assert.Equal(12m, movements.Sum(m => m.Quantity));
    }
}

public class DocumentNumberTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    /// <summary>
    /// The invoice and bill forms send no number; the server generates it.
    /// Validation used to reject the empty number before the controller ran,
    /// so neither document could be created from the UI.
    /// </summary>
    [Fact]
    public async Task Invoice_bill_and_opname_are_numbered_by_the_server()
    {
        var t = await factory.CreateTenantAsync("PT Nomor");
        var contact = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact { Id = contact, CompanyId = t.CompanyId, Code = "C-1", Name = "Pihak", IsCustomer = true, IsVendor = true });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        var invoice = await t.OwnerClient().PostJson("/api/SalesInvoices", new
        {
            invoiceDate = "2026-03-01", dueDate = "2026-03-31", contactId = contact, currency = "IDR",
            lines = new[] { new { description = "Jasa", quantity = 1m, unitPrice = 100m, taxRate = 0m, isTaxable = false } },
        });
        Assert.Equal(HttpStatusCode.Created, invoice.StatusCode);
        Assert.False(string.IsNullOrEmpty((await invoice.Json()).GetProperty("invoiceNumber").GetString()));

        var bill = await t.OwnerClient().PostJson("/api/PurchaseBills", new
        {
            billDate = "2026-03-01", dueDate = "2026-03-31", contactId = contact, currency = "IDR",
            lines = new[] { new { description = "Sewa", quantity = 1m, unitPrice = 100m, taxRate = 0m } },
        });
        Assert.True(bill.IsSuccessStatusCode, await bill.Body());

        var opname = await t.OwnerClient().PostJson("/api/StockOpname", new { opnameDate = "2026-03-01" });
        Assert.True(opname.IsSuccessStatusCode, await opname.Body());
    }
}
