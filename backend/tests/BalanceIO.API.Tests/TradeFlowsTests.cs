using System.Net;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BalanceIO.API.Tests;

public class TradeFlowsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task CreditNote_PostsToLedger_ReversesRevenueAndVat_AndRestocksInventory()
    {
        var t = factory.CreateTenant();
        var (warehouse, customer, product) = await SetupSalesDataAsync(t);

        // 1. Create a draft Credit Note linked to a customer
        var cnBody = new
        {
            companyId = t.CompanyId,
            creditNoteNumber = "CN-" + Guid.NewGuid().ToString("N")[..6],
            issueDate = "2026-05-15",
            contactId = customer,
            warehouseId = warehouse,
            returnToInventory = true,
            reason = "Customer returned damaged goods",
            currency = "IDR",
            exchangeRate = 1m,
            lines = new[]
            {
                new
                {
                    productId = product,
                    description = "Barang Retur",
                    quantity = 2m,
                    unit = "pcs",
                    unitPrice = 1_000_000m,
                    isTaxable = true,
                    taxRate = 12m
                }
            }
        };

        var createRes = await t.OwnerClient().PostJson("/api/CreditNotes", cnBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var cnId = created.GetProperty("id").GetGuid();

        Assert.Equal(2_000_000m, created.GetProperty("subtotal").GetDecimal());
        Assert.Equal(240_000m, created.GetProperty("taxAmount").GetDecimal());
        Assert.Equal(2_240_000m, created.GetProperty("total").GetDecimal());

        // 2. Creator cannot post their own credit note (Segregation of Duties)
        var selfApproveRes = await t.OwnerClient().PostJson($"/api/CreditNotes/{cnId}/post", new { });
        Assert.Equal(HttpStatusCode.Forbidden, selfApproveRes.StatusCode);

        // 3. Independent reviewer posts the credit note
        var approveRes = await t.ReviewerClient().PostJson($"/api/CreditNotes/{cnId}/post", new { });
        Assert.True(approveRes.IsSuccessStatusCode);

        // 4. Verify Double-Entry Journal Entry
        var postedCn = await (await t.OwnerClient().GetAsync($"/api/CreditNotes/{cnId}")).Json();
        var journalId = postedCn.GetProperty("journalEntryId").GetGuid();

        await factory.WithDb(async db =>
        {
            var journal = await db.JournalEntries
                .Include(j => j.Lines)
                .FirstAsync(j => j.Id == journalId);

            var totalDebit = journal.Lines.Sum(l => l.Debit);
            var totalCredit = journal.Lines.Sum(l => l.Credit);

            Assert.Equal(totalDebit, totalCredit);
            Assert.Equal(2_240_000m, totalDebit);

            // Dr 4-1000 Sales Revenue (2.000.000)
            var revLine = journal.Lines.First(l => l.AccountId == "4-1000" || (l.Description != null && l.Description.Contains("Sales Return")));
            Assert.Equal(2_000_000m, revLine.Debit);

            // Dr 2-1300 PPN Keluaran (240.000)
            var vatLine = journal.Lines.First(l => l.AccountId == "2-1300" || (l.Description != null && l.Description.Contains("PPN Keluaran")));
            Assert.Equal(240_000m, vatLine.Debit);

            // Cr 1-1130 Accounts Receivable (2.240.000)
            var arLine = journal.Lines.First(l => l.AccountId == "1-1130" || l.Credit > 0);
            Assert.Equal(2_240_000m, arLine.Credit);

            // Stock was restocked: product stock increased by 2
            var prod = await db.Products.FindAsync(product);
            Assert.Equal(12m, prod!.StockOnHand); // Initial 10 + 2 = 12
        }, t.CompanyId);
    }

    [Fact]
    public async Task DebitNote_PostsToLedger_ReducesTradePayables_AndReducesInventory()
    {
        var t = factory.CreateTenant();
        var (warehouse, vendor, product) = await SetupPurchaseDataAsync(t);

        // 1. Create a draft Debit Note to return goods to vendor
        var dnBody = new
        {
            companyId = t.CompanyId,
            debitNoteNumber = "DN-" + Guid.NewGuid().ToString("N")[..6],
            issueDate = "2026-05-20",
            contactId = vendor,
            warehouseId = warehouse,
            returnToInventory = true,
            reason = "Returned defective raw materials to vendor",
            currency = "IDR",
            exchangeRate = 1m,
            lines = new[]
            {
                new
                {
                    productId = product,
                    description = "Retur Barang Cacat",
                    quantity = 3m,
                    unit = "pcs",
                    unitPrice = 500_000m,
                    isTaxable = true,
                    taxRate = 12m
                }
            }
        };

        var createRes = await t.OwnerClient().PostJson("/api/DebitNotes", dnBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var dnId = created.GetProperty("id").GetGuid();

        Assert.Equal(1_500_000m, created.GetProperty("subtotal").GetDecimal());
        Assert.Equal(180_000m, created.GetProperty("taxAmount").GetDecimal());
        Assert.Equal(1_680_000m, created.GetProperty("total").GetDecimal());

        // 2. Creator cannot post their own debit note
        var selfApproveRes = await t.OwnerClient().PostJson($"/api/DebitNotes/{dnId}/post", new { });
        Assert.Equal(HttpStatusCode.Forbidden, selfApproveRes.StatusCode);

        // 3. Independent reviewer posts the debit note
        var approveRes = await t.ReviewerClient().PostJson($"/api/DebitNotes/{dnId}/post", new { });
        Assert.True(approveRes.IsSuccessStatusCode);

        // 4. Verify Double-Entry Journal Entry
        var postedDn = await (await t.OwnerClient().GetAsync($"/api/DebitNotes/{dnId}")).Json();
        var journalId = postedDn.GetProperty("journalEntryId").GetGuid();

        await factory.WithDb(async db =>
        {
            var journal = await db.JournalEntries
                .Include(j => j.Lines)
                .FirstAsync(j => j.Id == journalId);

            var totalDebit = journal.Lines.Sum(l => l.Debit);
            var totalCredit = journal.Lines.Sum(l => l.Credit);

            Assert.Equal(totalDebit, totalCredit);
            Assert.Equal(1_680_000m, totalDebit);

            // Dr 2-1100 Trade Payables (1.680.000)
            var apLine = journal.Lines.First(l => l.AccountId == "2-1100" || l.Debit > 0);
            Assert.Equal(1_680_000m, apLine.Debit);

            // Cr 1-1700 PPN Masukan (180.000)
            var vatLine = journal.Lines.First(l => l.AccountId == "1-1700" || (l.Description != null && l.Description.Contains("PPN Masukan")));
            Assert.Equal(180_000m, vatLine.Credit);

            // Cr 5-1000 Inventory / Expense (1.500.000)
            var expLine = journal.Lines.First(l => l.AccountId == "5-1000" || (l.Description != null && l.Description.Contains("Purchase Return")));
            Assert.Equal(1_500_000m, expLine.Credit);

            // Stock was reduced: initial 10 - 3 = 7
            var prod = await db.Products.FindAsync(product);
            Assert.Equal(7m, prod!.StockOnHand);
        }, t.CompanyId);
    }

    [Fact]
    public async Task FundTransfer_PostsToLedger_MovesCashBetweenAccounts()
    {
        var t = factory.CreateTenant();
        var bankA = await factory.AddAccount(t.CompanyId, "1-1110", "Bank BCA", "Asset");
        var bankB = await factory.AddAccount(t.CompanyId, "1-1120", "Bank Mandiri", "Asset");

        var transferBody = new
        {
            companyId = t.CompanyId,
            transferNumber = "TRF-" + Guid.NewGuid().ToString("N")[..6],
            transferDate = "2026-05-25",
            fromAccountId = bankA.Id,
            toAccountId = bankB.Id,
            amount = 5_000_000m,
            reference = "MDR-BCA-001",
            description = "Intercompany liquidity rebalancing"
        };

        var createRes = await t.OwnerClient().PostJson("/api/FundTransfers", transferBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var transferId = created.GetProperty("id").GetGuid();

        // Segregation of duties: Creator cannot approve
        var selfApprove = await t.OwnerClient().PostJson($"/api/FundTransfers/{transferId}/post", new { });
        Assert.Equal(HttpStatusCode.Forbidden, selfApprove.StatusCode);

        // Reviewer approves
        var approveRes = await t.ReviewerClient().PostJson($"/api/FundTransfers/{transferId}/post", new { });
        Assert.True(approveRes.IsSuccessStatusCode);

        // Verify Journal Entry
        var postedTrf = await (await t.OwnerClient().GetAsync($"/api/FundTransfers/{transferId}")).Json();
        var journalId = postedTrf.GetProperty("journalEntryId").GetGuid();

        await factory.WithDb(async db =>
        {
            var journal = await db.JournalEntries
                .Include(j => j.Lines)
                .FirstAsync(j => j.Id == journalId);

            var totalDebit = journal.Lines.Sum(l => l.Debit);
            var totalCredit = journal.Lines.Sum(l => l.Credit);

            Assert.Equal(totalDebit, totalCredit);
            Assert.Equal(5_000_000m, totalDebit);

            // Dr Bank Mandiri (1-1120) 5.000.000
            var drLine = journal.Lines.First(l => l.Debit > 0);
            Assert.Equal("1-1120", drLine.AccountId);
            Assert.Equal(5_000_000m, drLine.Debit);

            // Cr Bank BCA (1-1110) 5.000.000
            var crLine = journal.Lines.First(l => l.Credit > 0);
            Assert.Equal("1-1110", crLine.AccountId);
            Assert.Equal(5_000_000m, crLine.Credit);
        }, t.CompanyId);
    }

    [Fact]
    public async Task DeliveryOrder_ShipsGoods_DeductsWarehouseStock()
    {
        var t = factory.CreateTenant();
        var (warehouse, customer, product) = await SetupSalesDataAsync(t);

        var doBody = new
        {
            companyId = t.CompanyId,
            deliveryNumber = "DO-" + Guid.NewGuid().ToString("N")[..6],
            deliveryDate = "2026-05-26",
            contactId = customer,
            warehouseId = warehouse,
            shippingAddress = "Jl. Thamrin No. 12, Jakarta",
            shippingMethod = "Kurir Internal",
            lines = new[]
            {
                new
                {
                    productId = product,
                    description = "Pengiriman Barang Jadi",
                    quantity = 4m,
                    unit = "pcs"
                }
            }
        };

        var createRes = await t.OwnerClient().PostJson("/api/DeliveryOrders", doBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var doId = created.GetProperty("id").GetGuid();

        // Ship the goods
        var shipRes = await t.ReviewerClient().PostJson($"/api/DeliveryOrders/{doId}/ship", new { });
        Assert.True(shipRes.IsSuccessStatusCode);

        // Verify stock deducted: 10 - 4 = 6
        await factory.WithDb(async db =>
        {
            var prod = await db.Products.FindAsync(product);
            Assert.Equal(6m, prod!.StockOnHand);

            var movement = await db.InventoryMovements
                .FirstAsync(m => m.CompanyId == t.CompanyId && m.ProductId == product && m.Quantity < 0);
            Assert.Equal(-4m, movement.Quantity);
        }, t.CompanyId);
    }

    [Fact]
    public async Task GoodsReceipt_ReceivesGoods_IncreasesWarehouseStock()
    {
        var t = factory.CreateTenant();
        var (warehouse, vendor, product) = await SetupPurchaseDataAsync(t);

        var grBody = new
        {
            companyId = t.CompanyId,
            receiptNumber = "GR-" + Guid.NewGuid().ToString("N")[..6],
            receiptDate = "2026-05-27",
            contactId = vendor,
            warehouseId = warehouse,
            vendorDeliveryNote = "SJ-VENDOR-998",
            lines = new[]
            {
                new
                {
                    productId = product,
                    description = "Penerimaan Bahan Baku",
                    quantityOrdered = 5m,
                    quantityReceived = 5m,
                    unit = "pcs"
                }
            }
        };

        var createRes = await t.OwnerClient().PostJson("/api/GoodsReceipts", grBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var grId = created.GetProperty("id").GetGuid();

        // Receive the goods
        var receiveRes = await t.ReviewerClient().PostJson($"/api/GoodsReceipts/{grId}/receive", new { });
        Assert.True(receiveRes.IsSuccessStatusCode);

        // Verify stock increased: 10 + 5 = 15
        await factory.WithDb(async db =>
        {
            var prod = await db.Products.FindAsync(product);
            Assert.Equal(15m, prod!.StockOnHand);

            var movement = await db.InventoryMovements
                .FirstAsync(m => m.CompanyId == t.CompanyId && m.ProductId == product && m.Quantity == 5m);
            Assert.Equal(5m, movement.Quantity);
        }, t.CompanyId);
    }

    [Fact]
    public async Task MultiTenancy_TradeFlows_FailsClosed()
    {
        var tenantA = factory.CreateTenant();
        var tenantB = factory.CreateTenant();

        var (warehouseA, customerA, productA) = await SetupSalesDataAsync(tenantA);

        // Tenant A creates Credit Note
        var cnBody = new
        {
            companyId = tenantA.CompanyId,
            creditNoteNumber = "CN-ISO-" + Guid.NewGuid().ToString("N")[..4],
            issueDate = "2026-05-28",
            contactId = customerA,
            warehouseId = warehouseA,
            lines = new[]
            {
                new { productId = productA, description = "Item", quantity = 1m, unit = "pcs", unitPrice = 100_000m, isTaxable = false }
            }
        };

        var createRes = await tenantA.OwnerClient().PostJson("/api/CreditNotes", cnBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var cnId = (await createRes.Json()).GetProperty("id").GetGuid();

        // Tenant B attempts to fetch Tenant A's Credit Note -> 404 NotFound
        var crossTenantGet = await tenantB.OwnerClient().GetAsync($"/api/CreditNotes/{cnId}");
        Assert.Equal(HttpStatusCode.NotFound, crossTenantGet.StatusCode);

        // Tenant B lists credit notes -> 0 results
        var tenantBList = await (await tenantB.OwnerClient().GetAsync("/api/CreditNotes")).Json();
        Assert.Equal(0, tenantBList.GetArrayLength());
    }

    [Fact]
    public async Task SalesOrder_Lifecycle_CanCreateAndApprove()
    {
        var t = factory.CreateTenant();
        var (_, customer, product) = await SetupSalesDataAsync(t);

        var soBody = new
        {
            companyId = t.CompanyId,
            orderNumber = "SO-" + Guid.NewGuid().ToString("N")[..6],
            orderDate = "2026-05-29",
            contactId = customer,
            currency = "IDR",
            exchangeRate = 1m,
            discountPercent = 5m,
            lines = new[]
            {
                new
                {
                    productId = product,
                    description = "Pesanan Komputer",
                    quantity = 2m,
                    unit = "pcs",
                    unitPrice = 1_000_000m,
                    isTaxable = true,
                    taxRate = 12m
                }
            }
        };

        var createRes = await t.OwnerClient().PostJson("/api/SalesOrders", soBody);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var soId = created.GetProperty("id").GetGuid();

        // 2m - 100k discount = 1.9m subtotal; 12% tax = 228k; total = 2.128.000
        Assert.Equal(1_900_000m, created.GetProperty("subtotal").GetDecimal());
        Assert.Equal(228_000m, created.GetProperty("taxAmount").GetDecimal());
        Assert.Equal(2_128_000m, created.GetProperty("total").GetDecimal());

        // Approve Sales Order
        var approveRes = await t.ReviewerClient().PostJson($"/api/SalesOrders/{soId}/approve", new { });
        Assert.True(approveRes.IsSuccessStatusCode);

        var approved = await (await t.OwnerClient().GetAsync($"/api/SalesOrders/{soId}")).Json();
        Assert.Equal((int)SalesOrderStatus.Approved, approved.GetProperty("status").GetInt32());
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private async Task<(Guid WarehouseId, Guid CustomerId, Guid ProductId)> SetupSalesDataAsync(TestTenant t)
    {
        await factory.AddAccount(t.CompanyId, "1-1130", "Accounts Receivable", "Asset");
        await factory.AddAccount(t.CompanyId, "4-1000", "Sales Revenue", "Revenue");
        await factory.AddAccount(t.CompanyId, "2-1300", "PPN Keluaran", "Liability");
        await factory.AddAccount(t.CompanyId, "1-1400", "Inventory", "Asset");
        await factory.AddAccount(t.CompanyId, "5-1000", "Cost of Goods Sold", "Expense");

        var warehouseId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        await factory.WithDb(async db =>
        {
            db.Warehouses.Add(new Warehouse
            {
                Id = warehouseId,
                CompanyId = t.CompanyId,
                Code = "WH-" + Guid.NewGuid().ToString("N")[..4].ToUpperInvariant(),
                Name = "Gudang Penjualan",
                IsDefault = true,
                IsActive = true
            });

            db.Contacts.Add(new Contact
            {
                Id = customerId,
                CompanyId = t.CompanyId,
                Code = "CUST-" + Guid.NewGuid().ToString("N")[..4].ToUpperInvariant(),
                Name = "PT Klien Retail",
                IsCustomer = true
            });

            db.Products.Add(new Product
            {
                Id = productId,
                CompanyId = t.CompanyId,
                Code = "PROD-A",
                Name = "Laptop ThinkPad",
                TrackInventory = true,
                StockOnHand = 10m,
                BuyPrice = 800_000m,
                SellPrice = 1_000_000m,
                AverageCost = 800_000m,
                InventoryValue = 8_000_000m
            });

            await db.SaveChangesAsync();
        }, t.CompanyId);

        return (warehouseId, customerId, productId);
    }

    private async Task<(Guid WarehouseId, Guid VendorId, Guid ProductId)> SetupPurchaseDataAsync(TestTenant t)
    {
        await factory.AddAccount(t.CompanyId, "2-1100", "Trade Payables", "Liability");
        await factory.AddAccount(t.CompanyId, "1-1700", "PPN Masukan", "Asset");
        await factory.AddAccount(t.CompanyId, "5-1000", "Inventory / Expense", "Expense");

        var warehouseId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        await factory.WithDb(async db =>
        {
            db.Warehouses.Add(new Warehouse
            {
                Id = warehouseId,
                CompanyId = t.CompanyId,
                Code = "WH-" + Guid.NewGuid().ToString("N")[..4].ToUpperInvariant(),
                Name = "Gudang Pembelian",
                IsDefault = true,
                IsActive = true
            });

            db.Contacts.Add(new Contact
            {
                Id = vendorId,
                CompanyId = t.CompanyId,
                Code = "VEND-" + Guid.NewGuid().ToString("N")[..4].ToUpperInvariant(),
                Name = "CV Supplier Elektronik",
                IsVendor = true
            });

            db.Products.Add(new Product
            {
                Id = productId,
                CompanyId = t.CompanyId,
                Code = "PROD-B",
                Name = "Motherboard Asus",
                TrackInventory = true,
                StockOnHand = 10m,
                BuyPrice = 500_000m,
                AverageCost = 500_000m,
                InventoryValue = 5_000_000m
            });

            await db.SaveChangesAsync();
        }, t.CompanyId);

        return (warehouseId, vendorId, productId);
    }
}
