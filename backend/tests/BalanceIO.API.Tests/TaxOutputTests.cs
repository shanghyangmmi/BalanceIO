using System.Net;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>T1/T3: tax outputs must not contain identities or amounts the system invented.</summary>
public class TaxOutputTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(TestTenant t, Guid contact)> TenantWithCustomer()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "1-1130", "Accounts Receivable", "Asset");
        await factory.AddAccount(t.CompanyId, "2-1400", "PPN Tax Payable", "Liability");
        var contact = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact { Id = contact, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true, TaxId = "01.234.567.8-901.000" });
            db.Contacts.Add(new Contact { Id = Guid.NewGuid(), CompanyId = t.CompanyId, Code = "E-1", Name = "Pegawai Satu", IsEmployee = true, PtkpStatus = "TK/0" });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return (t, contact);
    }

    private static async Task PostInvoice(TestTenant t, Guid contact, string? faktur)
    {
        var body = new
        {
            invoiceNumber = "INV-" + Guid.NewGuid().ToString("N")[..6], referenceNumber = faktur,
            invoiceDate = "2026-03-15", dueDate = "2026-04-15", contactId = contact, currency = "IDR",
            lines = new[] { new { description = "Jasa", quantity = 1m, unitPrice = 1_000_000m, isTaxable = true, taxRate = 12m, dppScheme = 1 } },
        };
        var created = await t.OwnerClient().PostJson("/api/SalesInvoices", body);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await created.Json()).GetProperty("id").GetGuid();
        Assert.True((await t.OwnerClient().PostJson($"/api/SalesInvoices/{id}/post", new { })).IsSuccessStatusCode);
    }

    [Fact]
    public async Task Invoice_without_a_faktur_number_is_reported_without_one()
    {
        var (t, contact) = await TenantWithCustomer();
        await PostInvoice(t, contact, faktur: null);

        var spt = await (await t.OwnerClient().GetAsync("/api/TaxReports/spt-ppn-1111?year=2026&month=3")).Json();
        var line = spt.GetProperty("formA2Lines")[0];
        Assert.Equal(System.Text.Json.JsonValueKind.Null, line.GetProperty("fakturPajakNumber").ValueKind);
        Assert.Equal(1, spt.GetProperty("missingNsfpCount").GetInt32());

        var preview = await (await t.OwnerClient().GetAsync("/api/TaxReports/efaktur-preview?year=2026&month=3")).Json();
        Assert.False(preview.GetProperty("isReadyToUpload").GetBoolean());
        Assert.Equal(1, preview.GetProperty("missingNsfpCount").GetInt32());
    }

    [Fact]
    public async Task Invoice_with_a_faktur_number_is_ready_to_upload()
    {
        var (t, contact) = await TenantWithCustomer();
        await PostInvoice(t, contact, faktur: "010.000-26.00000001");

        var preview = await (await t.OwnerClient().GetAsync("/api/TaxReports/efaktur-preview?year=2026&month=3")).Json();
        Assert.True(preview.GetProperty("isReadyToUpload").GetBoolean());
    }

    [Fact]
    public async Task Withholding_summary_does_not_invent_a_salary_for_employee_contacts()
    {
        var (t, _) = await TenantWithCustomer();
        var summary = await (await t.OwnerClient().GetAsync("/api/TaxReports/withholding-summary?year=2026&month=3")).Json();
        Assert.Equal(0, summary.GetProperty("pph21Lines").GetArrayLength());
        Assert.Equal(0m, summary.GetProperty("totalPph21Withheld").GetDecimal());
        Assert.False(string.IsNullOrWhiteSpace(summary.GetProperty("pph21Note").GetString()));
    }

    [Fact]
    public async Task Withholding_lines_carry_no_bukti_potong_number_the_system_made_up()
    {
        var (t, _) = await TenantWithCustomer();
        var vendor = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact { Id = vendor, CompanyId = t.CompanyId, Code = "V-1", Name = "Vendor Jasa", IsVendor = true, WithholdingType = "PPh 23", WithholdingRate = 2m, TaxId = "02.345.678.9-012.000" });
            db.PurchaseBills.Add(new PurchaseBill
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, BillNumber = "BILL-1", BillDate = new DateOnly(2026, 3, 10), DueDate = new DateOnly(2026, 4, 10),
                ContactId = vendor, Currency = "IDR", Status = BillStatus.Posted, Subtotal = 1_000_000m, Total = 1_000_000m,
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        var summary = await (await t.OwnerClient().GetAsync("/api/TaxReports/withholding-summary?year=2026&month=3")).Json();
        var line = summary.GetProperty("pph23Lines")[0];
        Assert.Equal(20_000m, line.GetProperty("taxWithheldAmount").GetDecimal());
        Assert.Equal(System.Text.Json.JsonValueKind.Null, line.GetProperty("buktiPotongNumber").ValueKind);
    }

    [Fact]
    public async Task Ppn_settlement_closes_input_vat_not_inventory()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "1-1130", "Accounts Receivable", "Asset");
        await factory.AddAccount(t.CompanyId, "1-1400", "Inventory", "Asset");
        await factory.AddAccount(t.CompanyId, "1-1700", "VAT In", "Asset");
        await factory.AddAccount(t.CompanyId, "2-1300", "PPN VAT Out", "Liability");
        await factory.AddAccount(t.CompanyId, "2-1400", "Income Tax Payable", "Liability");
        var customer = Guid.NewGuid(); var vendor = Guid.NewGuid(); var bill = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact { Id = customer, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true });
            db.Contacts.Add(new Contact { Id = vendor, CompanyId = t.CompanyId, Code = "V-1", Name = "Pemasok", IsVendor = true });
            db.PurchaseBills.Add(new PurchaseBill
            {
                Id = bill, CompanyId = t.CompanyId, BillNumber = "BILL-1", BillDate = new DateOnly(2026, 3, 5), DueDate = new DateOnly(2026, 4, 5),
                ContactId = vendor, Currency = "IDR", Status = BillStatus.Posted, Subtotal = 100_000m, TaxAmount = 12_000m, Total = 112_000m,
                Lines = [new PurchaseBillLine { Id = Guid.NewGuid(), Description = "Barang", Quantity = 1, UnitPrice = 100_000m, IsTaxable = true, DppAmount = 100_000m, TaxRate = 12m, TaxAmount = 12_000m, LineTotal = 112_000m }],
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        await PostInvoice(t, customer, faktur: "010.000-26.00000002");

        var res = await t.OwnerClient().PostJson("/api/TaxReports/settle-ppn", new { year = 2026, month = 3, settlementDate = "2026-03-31" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var accounts = await factory.WithDb(db => db.JournalLines
            .Where(l => l.JournalEntry!.ReferenceNumber == "PPN-CLEAR-202603").Select(l => l.AccountId).ToListAsync(), t.CompanyId);
        Assert.Contains("1-1700", accounts);
        Assert.DoesNotContain("1-1400", accounts);
    }

    [Fact]
    public async Task Ppn_settlement_names_the_missing_account_instead_of_posting_an_orphan_line()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "1-1130", "Accounts Receivable", "Asset");
        await factory.AddAccount(t.CompanyId, "2-1300", "PPN VAT Out", "Liability");
        var customer = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact { Id = customer, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        await PostInvoice(t, customer, faktur: "010.000-26.00000003");

        var res = await t.OwnerClient().PostJson("/api/TaxReports/settle-ppn", new { year = 2026, month = 3, settlementDate = "2026-03-31" });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("2-1400", await res.Body());
    }
}
