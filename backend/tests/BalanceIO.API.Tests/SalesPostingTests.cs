using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>
/// Related to C1/C5: a system posting path (sales invoice) must write a tenant-owned
/// entry whose lines the reports can see, and must keep the trial balance in balance.
/// </summary>
public class SalesPostingTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(TestTenant t, Guid contact)> Setup()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "1-1130", "Accounts Receivable", "Asset");
        await factory.AddAccount(t.CompanyId, "2-1400", "PPN Tax Payable", "Liability");
        var contact = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact { Id = contact, CompanyId = t.CompanyId, Code = "C-1", Name = "Pelanggan", IsCustomer = true });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return (t, contact);
    }

    private static object Invoice(Guid contact, decimal invoiceDiscountPercent = 0) => new
    {
        invoiceNumber = "INV-" + Guid.NewGuid().ToString("N")[..6], invoiceDate = "2026-03-15", dueDate = "2026-04-15", contactId = contact, currency = "IDR",
        discountPercent = invoiceDiscountPercent,
        lines = new[] { new { description = "Jasa", quantity = 1m, unitPrice = 1_000_000m, isTaxable = true, taxRate = 12m, dppScheme = 1 } },
    };

    private async Task<Guid> PostInvoice(TestTenant t, Guid contact, decimal discount = 0)
    {
        var created = await t.OwnerClient().PostJson("/api/SalesInvoices", Invoice(contact, discount));
        Assert.True(created.StatusCode == HttpStatusCode.Created, await created.Body());
        var id = (await created.Json()).GetProperty("id").GetGuid();
        var posted = await t.OwnerClient().PostJson($"/api/SalesInvoices/{id}/post", new { });
        Assert.True(posted.IsSuccessStatusCode, await posted.Body());
        return (await posted.Json()).GetProperty("journalEntryId").GetGuid();
    }

    [Fact]
    public async Task Posted_invoice_journal_belongs_to_the_tenant_and_is_visible_in_the_trial_balance()
    {
        var (t, contact) = await Setup();
        var journalId = await PostInvoice(t, contact);

        var owner = await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters().Where(j => j.Id == journalId).Select(j => j.CompanyId).SingleAsync());
        Assert.Equal(t.CompanyId, owner);

        var tb = await (await t.OwnerClient().GetAsync("/api/Reports/trial-balance?asOf=2026-12-31")).Json();
        var debit = tb.GetProperty("totalDebit").GetDecimal();
        var credit = tb.GetProperty("totalCredit").GetDecimal();
        Assert.Equal(1_120_000m, debit);
        Assert.Equal(debit, credit);
    }

    /// <summary>
    /// Known defect, reported as Needs owner decision: the journal credits revenue before the
    /// invoice-level discount but debits receivables after it. Until the allocation of the
    /// discount (and its effect on the PPN base) is decided, the ledger guard must refuse it.
    /// </summary>
    [Fact]
    public async Task Invoice_level_discount_is_refused_rather_than_posted_unbalanced()
    {
        var (t, contact) = await Setup();
        var created = await t.OwnerClient().PostJson("/api/SalesInvoices", Invoice(contact, 10));
        var id = (await created.Json()).GetProperty("id").GetGuid();

        var posted = await t.OwnerClient().PostJson($"/api/SalesInvoices/{id}/post", new { });
        Assert.Equal(HttpStatusCode.BadRequest, posted.StatusCode);
        Assert.Contains("UNBALANCED", await posted.Body());

        var posted2 = await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters().CountAsync(j => j.CompanyId == t.CompanyId), t.CompanyId);
        Assert.Equal(0, posted2);
    }
}
