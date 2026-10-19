using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

public class AccountingCorrectnessTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<TestTenant> SetupTenantWithAccounts(string name)
    {
        var tenant = await factory.CreateTenantAsync(name);

        // Seed essential accounts for testing posting paths
        await factory.AddAccount(tenant.CompanyId, "1-1200", "Trade Receivables", "Asset");
        await factory.AddAccount(tenant.CompanyId, "1-1400", "Inventory", "Asset");
        await factory.AddAccount(tenant.CompanyId, "2-1100", "Trade Payables", "Liability");
        await factory.AddAccount(tenant.CompanyId, "2-1300", "VAT Out", "Liability");
        await factory.AddAccount(tenant.CompanyId, "1-1700", "VAT In", "Asset");
        await factory.AddAccount(tenant.CompanyId, "4-4000", "Sales Discounts", "Revenue");
        await factory.AddAccount(tenant.CompanyId, "5-1000", "Cost of Goods Sold", "Expense");
        await factory.AddAccount(tenant.CompanyId, "5-5000", "Purchase Discounts", "Expense");
        await factory.AddAccount(tenant.CompanyId, "6-1400", "Office Supplies", "Expense");
        await factory.AddAccount(tenant.CompanyId, "3-9000", "Opening Balance Equity", "Equity");
        await factory.AddAccount(tenant.CompanyId, "1-2104", "Office Equipment", "Asset");

        return tenant;
    }

    [Fact]
    public async Task SalesInvoice_WithInvoiceLevelDiscount_PostsBalancedJournalEntry()
    {
        var tenant = await SetupTenantWithAccounts("PT Sales Discount Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        // 1. Create a customer contact
        var contact = new Contact
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "Customer Discount PT",
            Type = ContactType.Customer
        };
        await factory.WithDb(async db => { db.Contacts.Add(contact); await db.SaveChangesAsync(); }, tenant.CompanyId);

        // 2. Create invoice with discount
        var invoice = new SalesInvoice
        {
            CompanyId = tenant.CompanyId,
            ContactId = contact.Id,
            InvoiceDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            Currency = "IDR",
            ExchangeRate = 1m,
            DiscountPercent = 10m, // 10% discount
            Lines = new List<SalesInvoiceLine>
            {
                new()
                {
                    Description = "Service Line",
                    Quantity = 1,
                    UnitPrice = 1_000_000m,
                    IsTaxable = false
                }
            }
        };

        var createRes = await client.PostAsJsonAsync("/api/salesinvoices", invoice);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var invoiceId = created.GetProperty("id").GetGuid();

        // 3. Post the invoice
        var postRes = await client.PostAsync($"/api/salesinvoices/{invoiceId}/post", null);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        // 4. Verify balanced journal in DB
        await factory.WithDb(async db =>
        {
            var postedInv = await db.SalesInvoices.Include(i => i.JournalEntry).ThenInclude(j => j!.Lines).FirstAsync(i => i.Id == invoiceId);
            Assert.Equal(InvoiceStatus.Sent, postedInv.Status);
            Assert.NotNull(postedInv.JournalEntry);

            var lines = postedInv.JournalEntry.Lines;
            var totalDebit = lines.Sum(l => l.Debit);
            var totalCredit = lines.Sum(l => l.Credit);

            // Subtotal 1,000,000 - 100,000 discount = 900,000 total AR.
            // Debit: AR 900,000 + Discount 100,000 = 1,000,000
            // Credit: Revenue 1,000,000
            Assert.Equal(totalDebit, totalCredit);
            Assert.Equal(1_000_000m, totalDebit);
            Assert.Contains(lines, l => l.AccountId == "4-4000" && l.Debit == 100_000m);
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task PurchaseBill_WithBillLevelDiscount_PostsBalancedJournalEntry()
    {
        var tenant = await SetupTenantWithAccounts("PT Purchase Discount Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        // 1. Create a vendor contact
        var contact = new Contact
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "Vendor PT",
            Type = ContactType.Vendor
        };
        await factory.WithDb(async db => { db.Contacts.Add(contact); await db.SaveChangesAsync(); }, tenant.CompanyId);

        // 2. Create bill with discount
        var bill = new PurchaseBill
        {
            CompanyId = tenant.CompanyId,
            ContactId = contact.Id,
            BillDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
            Currency = "IDR",
            ExchangeRate = 1m,
            DiscountAmount = 200_000m,
            Lines = new List<PurchaseBillLine>
            {
                new()
                {
                    Description = "Office Supplies Line",
                    Quantity = 2,
                    UnitPrice = 1_000_000m,
                    IsTaxable = false
                }
            }
        };

        var createRes = await client.PostAsJsonAsync("/api/purchasebills", bill);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var billId = created.GetProperty("id").GetGuid();

        // 3. Post the bill using Reviewer (Segregation of Duties requires non-creator approval)
        var reviewerClient = factory.ClientFor(tenant.CompanyId, tenant.Reviewer);
        var postRes = await reviewerClient.PostAsync($"/api/purchasebills/{billId}/post", null);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        // 4. Verify balanced journal in DB
        await factory.WithDb(async db =>
        {
            var postedBill = await db.PurchaseBills.Include(b => b.JournalEntry).ThenInclude(j => j!.Lines).FirstAsync(b => b.Id == billId);
            Assert.Equal(BillStatus.Posted, postedBill.Status);
            Assert.NotNull(postedBill.JournalEntry);

            var lines = postedBill.JournalEntry.Lines;
            var totalDebit = lines.Sum(l => l.Debit);
            var totalCredit = lines.Sum(l => l.Credit);

            // Subtotal 2,000,000 - 200,000 discount = 1,800,000 total AP.
            // Credit: AP 1,800,000 + Purchase Discount 200,000 = 2,000,000
            // Debit: Line Expense 2,000,000
            Assert.Equal(totalDebit, totalCredit);
            Assert.Equal(2_000_000m, totalCredit);
            Assert.Contains(lines, l => l.AccountId == "5-5000" && l.Credit == 200_000m);
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task ProductCreate_WithOpeningStock_PostsInventoryAndEquityJournal()
    {
        var tenant = await SetupTenantWithAccounts("PT Opening Stock Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        var product = new Product
        {
            CompanyId = tenant.CompanyId,
            Name = "Tracked Item Opening",
            Code = $"PRD-{Guid.NewGuid():N}"[..12],
            Type = ProductType.Product,
            TrackInventory = true,
            StockOnHand = 25m,
            BuyPrice = 80_000m,
            SellPrice = 120_000m,
            IsActive = true
        };

        var res = await client.PostAsJsonAsync("/api/products", product);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        // Verify Journal entry OPEN-PRD... exists and matches 25 * 80,000 = 2,000,000
        await factory.WithDb(async db =>
        {
            var journal = await db.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.ReferenceNumber == $"OPEN-{product.Code}");

            Assert.NotNull(journal);
            Assert.Equal(JournalEntryStatus.Posted, journal.Status);

            var totalDebit = journal.Lines.Sum(l => l.Debit);
            var totalCredit = journal.Lines.Sum(l => l.Credit);

            Assert.Equal(2_000_000m, totalDebit);
            Assert.Equal(2_000_000m, totalCredit);

            var invLine = Assert.Single(journal.Lines, l => l.Debit > 0);
            Assert.Equal("1-1400", invLine.AccountId);
            Assert.Equal(2_000_000m, invLine.Debit);

            var eqLine = Assert.Single(journal.Lines, l => l.Credit > 0);
            Assert.Equal("3-9000", eqLine.AccountId);
            Assert.Equal(2_000_000m, eqLine.Credit);

            // Verify inventory ledger movement is linked to the journal entry
            var movement = await db.InventoryMovements
                .FirstOrDefaultAsync(m => m.ReferenceNumber == $"OPEN-{product.Code}");
            Assert.NotNull(movement);
            Assert.Equal(journal.Id, movement.JournalEntryId);
            Assert.Equal(2_000_000m, movement.TotalCost);
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task PurchaseBill_TrackedItem_WithCustomExpenseAccount_IsRefused()
    {
        var tenant = await SetupTenantWithAccounts("PT Tracked Bill Check");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        var product = new Product
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "Tracked Widget",
            Code = "WIDGET-01",
            TrackInventory = true,
            BuyPrice = 50_000m
        };
        var expenseAcc = await factory.WithDb(db => db.Accounts.FirstAsync(a => a.Code == "6-1400"), tenant.CompanyId);
        await factory.WithDb(async db => { db.Products.Add(product); await db.SaveChangesAsync(); }, tenant.CompanyId);

        var contact = new Contact
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "Vendor Tracked",
            Type = ContactType.Vendor
        };
        await factory.WithDb(async db => { db.Contacts.Add(contact); await db.SaveChangesAsync(); }, tenant.CompanyId);

        var bill = new PurchaseBill
        {
            CompanyId = tenant.CompanyId,
            ContactId = contact.Id,
            BillDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            Lines = new List<PurchaseBillLine>
            {
                new()
                {
                    ProductId = product.Id,
                    AccountId = expenseAcc.Id, // Expense account on tracked inventory item!
                    Description = "Tracked widget line",
                    Quantity = 10,
                    UnitPrice = 50_000m
                }
            }
        };

        var res = await client.PostAsJsonAsync("/api/purchasebills", bill);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var json = await res.Json();
        Assert.Equal("INVALID_ACCOUNT_FOR_TRACKED_ITEM", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task SalesInvoice_InUSD_PostsLedgerInConvertedBaseCurrency()
    {
        var tenant = await SetupTenantWithAccounts("PT FX Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        var contact = new Contact
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "US Client Corp",
            Type = ContactType.Customer
        };
        await factory.WithDb(async db => { db.Contacts.Add(contact); await db.SaveChangesAsync(); }, tenant.CompanyId);

        var invoice = new SalesInvoice
        {
            CompanyId = tenant.CompanyId,
            ContactId = contact.Id,
            InvoiceDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
            Currency = "USD",
            ExchangeRate = 16_000m,
            Lines = new List<SalesInvoiceLine>
            {
                new()
                {
                    Description = "Consulting Fee",
                    Quantity = 1,
                    UnitPrice = 500m, // 500 USD @ 16,000 = 8,000,000 IDR
                    IsTaxable = false
                }
            }
        };

        var createRes = await client.PostAsJsonAsync("/api/salesinvoices", invoice);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var invoiceId = (await createRes.Json()).GetProperty("id").GetGuid();

        var postRes = await client.PostAsync($"/api/salesinvoices/{invoiceId}/post", null);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        await factory.WithDb(async db =>
        {
            var postedInv = await db.SalesInvoices.Include(i => i.JournalEntry).ThenInclude(j => j!.Lines).FirstAsync(i => i.Id == invoiceId);
            Assert.NotNull(postedInv.JournalEntry);
            Assert.Equal("IDR", postedInv.JournalEntry.Currency);

            var totalDebit = postedInv.JournalEntry.Lines.Sum(l => l.Debit);
            var totalCredit = postedInv.JournalEntry.Lines.Sum(l => l.Credit);

            Assert.Equal(8_000_000m, totalDebit);
            Assert.Equal(8_000_000m, totalCredit);
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task FixedAsset_InitialBookValue_EqualsAcquisitionCost_AndPostAcquisitionSucceeds()
    {
        var tenant = await SetupTenantWithAccounts("PT Fixed Asset Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        var assetAcc = await factory.AddAccount(tenant.CompanyId, "1-2104", "Office Equipment", "Asset");
        var deprAcc = await factory.AddAccount(tenant.CompanyId, "6-1600", "Depreciation Expense", "Expense");
        var accDeprAcc = await factory.AddAccount(tenant.CompanyId, "1-2203", "Acc. Depr. Equipment", "Asset");

        var category = new FixedAssetCategory
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Name = "Office Equipment Category",
            CodePrefix = "EQP"
        };
        await factory.WithDb(async db => { db.FixedAssetCategories.Add(category); await db.SaveChangesAsync(); }, tenant.CompanyId);

        var asset = new FixedAsset
        {
            CompanyId = tenant.CompanyId,
            CategoryId = category.Id,
            Name = "Server Rack",
            AcquisitionDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            AcquisitionCost = 150_000_000m,
            ResidualValue = 15_000_000m, // Residual value must NOT be subtracted from initial book value!
            AssetAccountId = assetAcc.Id,
            DepreciationAccountId = deprAcc.Id,
            AccumulatedDepreciationAccountId = accDeprAcc.Id
        };

        var createRes = await client.PostAsJsonAsync("/api/assets", asset);
        Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);
        var created = await createRes.Json();
        var assetId = created.GetProperty("id").GetGuid();

        // 1. Verify initial BookValue == AcquisitionCost (150,000,000, not 135,000,000)
        Assert.Equal(150_000_000m, created.GetProperty("bookValue").GetDecimal());

        // 2. Post acquisition journal
        var postRes = await client.PostAsJsonAsync($"/api/assets/{assetId}/post-acquisition", new
        {
            date = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            paymentAccountId = "1-1000",
            notes = "Purchased server rack via Cash"
        });
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        // 3. Verify acquisition journal created and balanced
        await factory.WithDb(async db =>
        {
            var savedAsset = await db.FixedAssets.FindAsync(assetId);
            Assert.NotNull(savedAsset);
            Assert.NotNull(savedAsset.AcquisitionJournalEntryId);

            var journal = await db.JournalEntries.Include(j => j.Lines).FirstOrDefaultAsync(j => j.Id == savedAsset.AcquisitionJournalEntryId);
            Assert.NotNull(journal);
            Assert.Equal(JournalEntryStatus.Posted, journal.Status);

            var totalDebit = journal.Lines.Sum(l => l.Debit);
            var totalCredit = journal.Lines.Sum(l => l.Credit);

            Assert.Equal(150_000_000m, totalDebit);
            Assert.Equal(150_000_000m, totalCredit);

            var drLine = Assert.Single(journal.Lines, l => l.Debit > 0);
            Assert.Equal(assetAcc.Code, drLine.AccountId);
            Assert.Equal(150_000_000m, drLine.Debit);

            var crLine = Assert.Single(journal.Lines, l => l.Credit > 0);
            Assert.Equal("1-1000", crLine.AccountId);
            Assert.Equal(150_000_000m, crLine.Credit);
        }, tenant.CompanyId);

        // 4. Duplicate acquisition attempt is refused
        var dupRes = await client.PostAsJsonAsync($"/api/assets/{assetId}/post-acquisition", new { });
        Assert.Equal(HttpStatusCode.BadRequest, dupRes.StatusCode);
        var dupJson = await dupRes.Json();
        Assert.Equal("ALREADY_ACQUIRED", dupJson.GetProperty("code").GetString());
    }
}
