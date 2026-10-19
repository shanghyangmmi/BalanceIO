using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>C2 (reject), C3 (status and segregation of duties), C4 (quota).</summary>
public class JournalWorkflowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<JournalEntryStatus> StatusOf(Guid id) =>
        await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters().Where(j => j.Id == id).Select(j => j.Status).SingleAsync());

    private async Task<Guid> SeedVoid(TestTenant t)
    {
        var id = await factory.SeedPosted(t);
        var res = await t.OwnerClient().PostJson($"/api/JournalEntries/{id}/void", new { });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return id;
    }

    // ── C2 ───────────────────────────────────────────────────────────────
    [Fact]
    public async Task Void_entry_cannot_be_rejected_back_to_draft_and_deleted()
    {
        var t = factory.CreateTenant();
        var id = await SeedVoid(t);

        var reject = await t.OwnerClient().PostJson($"/api/JournalEntries/{id}/reject", "no");
        Assert.Equal(HttpStatusCode.BadRequest, reject.StatusCode);
        Assert.Equal(JournalEntryStatus.Void, await StatusOf(id));

        var delete = await t.OwnerClient().DeleteAsync($"/api/JournalEntries/{id}");
        Assert.Equal(HttpStatusCode.BadRequest, delete.StatusCode);
    }

    [Fact]
    public async Task Reject_respects_the_period_lock()
    {
        var t = factory.CreateTenant();
        var id = await t.CreateDraft(date: "2026-03-15");
        await factory.WithDb(async db =>
        {
            (await db.Companies.FindAsync(t.CompanyId))!.LockDate = new DateOnly(2026, 6, 30);
            await db.SaveChangesAsync();
        });

        var res = await t.OwnerClient().PostJson($"/api/JournalEntries/{id}/reject", "late");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("PERIOD_LOCKED", await res.Body());
    }

    // ── C3 ───────────────────────────────────────────────────────────────
    [Fact]
    public async Task Create_with_posted_status_is_refused_and_nothing_is_stored()
    {
        var t = factory.CreateTenant();
        var body = new
        {
            status = 1, date = "2026-03-15",
            lines = new[]
            {
                new { accountId = t.Cash.Code, debit = 10m, credit = 0m },
                new { accountId = t.Revenue.Code, debit = 0m, credit = 10m },
            },
        };
        var res = await t.OwnerClient().PostJson("/api/JournalEntries", body);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(0, await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters().CountAsync(j => j.CompanyId == t.CompanyId)));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task Update_cannot_change_status(int status)
    {
        var t = factory.CreateTenant();
        var id = await t.CreateDraft();
        var body = new
        {
            status, date = "2026-03-15",
            lines = new[]
            {
                new { accountId = t.Cash.Code, debit = 10m, credit = 0m },
                new { accountId = t.Revenue.Code, debit = 0m, credit = 10m },
            },
        };
        var res = await t.OwnerClient().PutAsJsonAsync($"/api/JournalEntries/{id}", body);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(JournalEntryStatus.Draft, await StatusOf(id));
    }

    [Fact]
    public async Task Creator_cannot_post_own_entry_but_a_second_user_can()
    {
        var t = factory.CreateTenant();
        var id = await t.CreateDraft();

        var own = await t.OwnerClient().PostJson($"/api/JournalEntries/{id}/post", new { });
        Assert.Equal(HttpStatusCode.Forbidden, own.StatusCode);
        Assert.Contains("SEGREGATION_OF_DUTIES_VIOLATION", await own.Body());

        var other = await t.ReviewerClient().PostJson($"/api/JournalEntries/{id}/post", new { });
        Assert.Equal(HttpStatusCode.OK, other.StatusCode);
        var approver = await factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters().Where(j => j.Id == id).Select(j => j.ApprovedByUserId).SingleAsync());
        Assert.Equal(t.Reviewer.Id, approver);
    }

    [Fact]
    public async Task Batch_post_enforces_segregation_of_duties()
    {
        var t = factory.CreateTenant();
        var id = await t.CreateDraft();
        var res = await t.OwnerClient().PostJson("/api/JournalEntries/batch-post", new[] { id });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(1, (await res.Json()).GetProperty("failedCount").GetInt32());
        Assert.Equal(JournalEntryStatus.Draft, await StatusOf(id));
    }

    [Fact]
    public async Task Batch_post_respects_the_period_lock()
    {
        var t = factory.CreateTenant();
        var id = await t.CreateDraft(date: "2026-03-15");
        await factory.WithDb(async db =>
        {
            (await db.Companies.FindAsync(t.CompanyId))!.LockDate = new DateOnly(2026, 6, 30);
            await db.SaveChangesAsync();
        });
        var res = await t.ReviewerClient().PostJson("/api/JournalEntries/batch-post", new[] { id });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Equal(JournalEntryStatus.Draft, await StatusOf(id));
    }

    [Fact]
    public async Task Void_entry_cannot_be_posted_again()
    {
        var t = factory.CreateTenant();
        var id = await SeedVoid(t);
        var res = await t.ReviewerClient().PostJson($"/api/JournalEntries/{id}/post", new { });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal(JournalEntryStatus.Void, await StatusOf(id));
    }

    [Fact]
    public async Task Posted_entry_rejects_put_with_the_documented_code()
    {
        var t = factory.CreateTenant();
        var id = await factory.SeedPosted(t);
        var res = await t.OwnerClient().PutAsJsonAsync($"/api/JournalEntries/{id}", t.BalancedBody());
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("POSTED_IMMUTABLE", await res.Body());
    }

    // ── C4 ───────────────────────────────────────────────────────────────
    [Fact]
    public async Task Company_without_a_plan_limit_is_not_capped_at_fifty_entries()
    {
        var t = factory.CreateTenant();
        await factory.WithDb(async db =>
        {
            for (var i = 0; i < 55; i++)
                db.JournalEntries.Add(new JournalEntry { Id = Guid.NewGuid(), CompanyId = t.CompanyId, Date = new DateOnly(2026, 1, 1), ReferenceNumber = $"B{i}" });
            await db.SaveChangesAsync();
        });
        var res = await t.OwnerClient().PostJson("/api/JournalEntries", t.BalancedBody());
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
    }
}
