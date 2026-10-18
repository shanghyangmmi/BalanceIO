using BalanceIO.API.Models;

namespace BalanceIO.API.Tests;

/// <summary>
/// Sales and purchases by party and product: posted documents in the
/// period only, totalled exactly, with cost of sales from the stock the
/// invoices issued.
/// </summary>
public class TradeReportsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record Setup(TestTenant T, Guid Product, Guid Vendor, Guid Customer, Guid Other);

    private async Task<Setup> SeedAsync()
    {
        var t = await factory.CreateTenantAsync("PT Dagang");
        foreach (var (code, name, type) in new[]
        {
            ("1-1130", "Accounts Receivable", "Asset"), ("1-1400", "Inventory", "Asset"), ("1-1700", "VAT In", "Asset"),
            ("2-1100", "Trade Payables", "Liability"), ("2-1400", "PPN Payable", "Liability"),
            ("4-1000", "Revenue", "Revenue"), ("5-1000", "Cost of Goods Sold", "Expense"),
        })
            await factory.AddAccount(t.CompanyId, code, name, type);

        var product = Guid.NewGuid();
        var vendor = Guid.NewGuid();
        var customer = Guid.NewGuid();
        var other = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Products.Add(new Product { Id = product, CompanyId = t.CompanyId, Code = "PRD-1", Name = "Kardus", Type = ProductType.Product, TrackInventory = true, BuyPrice = 1_000m, Unit = "pcs" });
            db.Contacts.Add(new Contact { Id = vendor, CompanyId = t.CompanyId, Code = "V-1", Name = "Pemasok", IsVendor = true, IsCustomer = false });
            db.Contacts.Add(new Contact { Id = customer, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true });
            db.Contacts.Add(new Contact { Id = other, CompanyId = t.CompanyId, Code = "C-2", Name = "Lainnya", IsCustomer = true });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return new Setup(t, product, vendor, customer, other);
    }

    private static async Task Ok(HttpResponseMessage res) => Assert.True(res.IsSuccessStatusCode, await res.Body());

    private async Task<Guid> Invoice(Setup s, Guid contact, string date, decimal qty, decimal price, bool post = true, Guid? product = null)
    {
        var res = await s.T.OwnerClient().PostJson("/api/SalesInvoices", new
        {
            invoiceNumber = "INV-" + Guid.NewGuid().ToString("N")[..6], invoiceDate = date, dueDate = date,
            contactId = contact, currency = "IDR",
            lines = new[] { new { productId = product, description = product.HasValue ? "Kardus" : "Jasa kirim", quantity = qty, unitPrice = price, isTaxable = false, taxRate = 0m, dppScheme = 1 } },
        });
        await Ok(res);
        var id = (await res.Json()).GetProperty("id").GetGuid();
        if (post) await Ok(await s.T.OwnerClient().PostJson($"/api/SalesInvoices/{id}/post", new { }));
        return id;
    }

    private async Task Bill(Setup s, string date, decimal qty, decimal price)
    {
        var res = await s.T.OwnerClient().PostJson("/api/PurchaseBills", new
        {
            billNumber = "BILL-" + Guid.NewGuid().ToString("N")[..6], billDate = date, dueDate = date,
            contactId = s.Vendor, currency = "IDR",
            lines = new[] { new { productId = s.Product, description = "Kardus", quantity = qty, unitPrice = price, taxRate = 0m } },
        });
        await Ok(res);
        await Ok(await s.T.ReviewerClient().PostJson($"/api/PurchaseBills/{(await res.Json()).GetProperty("id").GetGuid()}/post", new { }));
    }

    [Fact]
    public async Task Sales_by_customer_totals_posted_invoices_in_the_period_exactly()
    {
        var s = await SeedAsync();
        await Invoice(s, s.Customer, "2026-03-01", 3m, 0.1m);          // 0.3, which floats get wrong
        await Invoice(s, s.Customer, "2026-03-02", 1m, 0.2m);
        await Invoice(s, s.Other, "2026-03-03", 1m, 500m);
        await Invoice(s, s.Customer, "2026-03-04", 1m, 9_999m, post: false);
        var voided = await Invoice(s, s.Customer, "2026-03-05", 1m, 7_777m);
        await Ok(await s.T.OwnerClient().PostJson($"/api/SalesInvoices/{voided}/void", new { }));
        await Invoice(s, s.Customer, "2026-04-01", 1m, 1_000m);         // outside the period

        var report = await (await s.T.OwnerClient().GetAsync("/api/Reports/sales-by-customer?start=2026-03-01&end=2026-03-31")).Json();
        var rows = report.GetProperty("rows").EnumerateArray().ToList();
        var customer = rows.Single(r => r.GetProperty("contactId").GetGuid() == s.Customer);
        Assert.Equal(2, customer.GetProperty("documents").GetInt32());
        Assert.Equal(0.5m, customer.GetProperty("net").GetDecimal());
        Assert.Equal(500.5m, report.GetProperty("totals").EnumerateArray().Single().GetProperty("net").GetDecimal());
    }

    [Fact]
    public async Task Sales_by_product_carries_the_cost_the_invoices_posted()
    {
        var s = await SeedAsync();
        await Bill(s, "2026-03-01", 10m, 1_000m);
        await Bill(s, "2026-03-02", 10m, 1_300m);
        await Invoice(s, s.Customer, "2026-03-10", 5m, 2_000m, product: s.Product);
        await Invoice(s, s.Customer, "2026-03-11", 1m, 250m);           // service line, no cost

        var res = await s.T.OwnerClient().GetAsync("/api/Reports/sales-by-product?start=2026-03-01&end=2026-03-31");
        await Ok(res);
        var report = await res.Json();
        var rows = report.GetProperty("rows").EnumerateArray().ToList();
        var kardus = rows.Single(r => r.GetProperty("code").GetString() == "PRD-1");
        Assert.Equal(10_000m, kardus.GetProperty("net").GetDecimal());
        Assert.Equal(5_750m, kardus.GetProperty("costOfSales").GetDecimal());
        Assert.Equal(4_250m, kardus.GetProperty("grossProfit").GetDecimal());
        var service = rows.Single(r => r.GetProperty("name").GetString() == "Jasa kirim");
        Assert.Equal(System.Text.Json.JsonValueKind.Null, service.GetProperty("costOfSales").ValueKind);

        var purchases = await (await s.T.OwnerClient().GetAsync("/api/Reports/purchases-by-product?start=2026-03-01&end=2026-03-31")).Json();
        var bought = purchases.GetProperty("rows").EnumerateArray().Single();
        Assert.Equal(20m, bought.GetProperty("quantity").GetDecimal());
        Assert.Equal(1_150m, bought.GetProperty("averageCost").GetDecimal());

        var vendors = await (await s.T.OwnerClient().GetAsync("/api/Reports/purchases-by-vendor?start=2026-03-01&end=2026-03-31")).Json();
        Assert.Equal(2, vendors.GetProperty("rows").EnumerateArray().Single().GetProperty("documents").GetInt32());
    }
}
