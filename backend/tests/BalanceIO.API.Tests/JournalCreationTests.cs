using System.Net;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>C1: POST /api/JournalEntries must stamp tenant server-side and validate its input.</summary>
public class JournalCreationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Create_without_company_id_in_body_lands_in_callers_tenant()
    {
        var t = factory.CreateTenant();
        var res = await t.OwnerClient().PostJson("/api/JournalEntries", t.BalancedBody());

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var json = await res.Json();
        Assert.Equal(t.CompanyId, json.GetProperty("companyId").GetGuid());
    }

    [Fact]
    public async Task Client_supplied_company_id_cannot_write_into_another_tenant()
    {
        var mine = factory.CreateTenant("Mine");
        var theirs = factory.CreateTenant("Theirs");

        var body = new
        {
            companyId = theirs.CompanyId,
            date = "2026-03-15",
            lines = new[]
            {
                new { accountId = mine.Cash.Code, debit = 10m, credit = 0m },
                new { accountId = mine.Revenue.Code, debit = 0m, credit = 10m },
            },
        };
        var res = await mine.OwnerClient().PostJson("/api/JournalEntries", body);
        var created = res.IsSuccessStatusCode ? (await res.Json()).GetProperty("id").GetGuid() : (Guid?)null;

        var leaked = await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters()
            .CountAsync(j => j.CompanyId == theirs.CompanyId));
        Assert.Equal(0, leaked);
        if (created is not null)
        {
            var owner = await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters()
                .Where(j => j.Id == created).Select(j => j.CompanyId).SingleAsync());
            Assert.Equal(mine.CompanyId, owner);
        }
    }

    [Fact]
    public async Task Period_lock_is_checked_against_callers_company_not_the_body()
    {
        var mine = factory.CreateTenant("Mine");
        var locked = factory.CreateTenant("Locked");
        await factory.WithDb(async db =>
        {
            (await db.Companies.FindAsync(locked.CompanyId))!.LockDate = new DateOnly(2026, 12, 31);
            await db.SaveChangesAsync();
        });
        var res = await locked.OwnerClient().PostJson("/api/JournalEntries", locked.BalancedBody("2026-03-15"));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("PERIOD_LOCKED", await res.Body());
        Assert.NotEqual(mine.CompanyId, locked.CompanyId);
    }

    [Fact]
    public async Task Account_from_another_tenant_is_rejected()
    {
        var mine = factory.CreateTenant("Mine");
        var theirs = factory.CreateTenant("Theirs");
        await factory.AddAccount(theirs.CompanyId, "9-9999", "Only theirs", "Expense");

        var body = new
        {
            date = "2026-03-15",
            lines = new[]
            {
                new { accountId = "9-9999", debit = 10m, credit = 0m },
                new { accountId = mine.Revenue.Code, debit = 0m, credit = 10m },
            },
        };
        var res = await mine.OwnerClient().PostJson("/api/JournalEntries", body);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("ACCOUNT_NOT_FOUND", await res.Body());
    }

    [Theory]
    [InlineData(-10, 0, 10, 0, "NEGATIVE_AMOUNT")]
    [InlineData(10, 5, 0, 5, "DEBIT_AND_CREDIT")]
    public async Task Malformed_lines_are_rejected(decimal d1, decimal c1, decimal d2, decimal c2, string code)
    {
        var t = factory.CreateTenant();
        var body = new
        {
            date = "2026-03-15",
            lines = new[]
            {
                new { accountId = t.Cash.Code, debit = d1, credit = c1 },
                new { accountId = t.Revenue.Code, debit = d2, credit = c2 },
            },
        };
        var res = await t.OwnerClient().PostJson("/api/JournalEntries", body);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains(code, await res.Body());
    }

    [Fact]
    public async Task Server_owned_fields_in_the_body_are_ignored()
    {
        var t = factory.CreateTenant();
        var forgedId = Guid.NewGuid();
        var body = new
        {
            id = forgedId,
            approvedBy = "someone@else",
            approvedByUserId = Guid.NewGuid(),
            createdBy = "someone@else",
            date = "2026-03-15",
            lines = new[]
            {
                new { accountId = t.Cash.Code, debit = 10m, credit = 0m },
                new { accountId = t.Revenue.Code, debit = 0m, credit = 10m },
            },
        };
        var res = await t.OwnerClient().PostJson("/api/JournalEntries", body);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var json = await res.Json();
        Assert.NotEqual(forgedId, json.GetProperty("id").GetGuid());
        Assert.Null(json.GetProperty("approvedBy").GetString());
        Assert.Equal(t.Owner.Email, json.GetProperty("createdBy").GetString());
    }
}
