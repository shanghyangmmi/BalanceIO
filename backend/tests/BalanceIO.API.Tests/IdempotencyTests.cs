using System.Net;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>C6: one idempotency key, one entry, even under concurrency.</summary>
public class IdempotencyTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private Task<int> CountWithKey(TestTenant t, string key) =>
        factory.WithDb(db => db.JournalEntries.IgnoreQueryFilters().CountAsync(j => j.CompanyId == t.CompanyId && j.IdempotencyKey == key));

    [Fact]
    public async Task Retry_with_the_same_key_returns_the_original_entry()
    {
        var t = factory.CreateTenant();
        var key = Guid.NewGuid().ToString();
        var first = await t.OwnerClient().PostJson("/api/JournalEntries", t.BalancedBody(), key);
        var second = await t.OwnerClient().PostJson("/api/JournalEntries", t.BalancedBody(), key);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal((await first.Json()).GetProperty("id").GetGuid(), (await second.Json()).GetProperty("id").GetGuid());
        Assert.Equal(1, await CountWithKey(t, key));
    }

    [Fact]
    public async Task Concurrent_requests_with_one_key_create_exactly_one_entry()
    {
        var t = factory.CreateTenant();
        var key = Guid.NewGuid().ToString();
        var results = await Task.WhenAll(Enumerable.Range(0, 8)
            .Select(_ => t.OwnerClient().PostJson("/api/JournalEntries", t.BalancedBody(), key)));

        Assert.All(results, r => Assert.True(r.StatusCode is HttpStatusCode.Created or HttpStatusCode.OK, $"got {r.StatusCode}"));
        Assert.Equal(1, await CountWithKey(t, key));
    }

    [Fact]
    public async Task Same_key_in_two_companies_is_two_entries()
    {
        var a = factory.CreateTenant();
        var b = factory.CreateTenant();
        var key = Guid.NewGuid().ToString();
        Assert.Equal(HttpStatusCode.Created, (await a.OwnerClient().PostJson("/api/JournalEntries", a.BalancedBody(), key)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await b.OwnerClient().PostJson("/api/JournalEntries", b.BalancedBody(), key)).StatusCode);
    }

    [Fact]
    public async Task Database_refuses_a_duplicate_key_within_a_company()
    {
        var t = factory.CreateTenant();
        JournalEntry Make() => new() { Id = Guid.NewGuid(), CompanyId = t.CompanyId, Date = new DateOnly(2026, 1, 1), IdempotencyKey = "dup" };
        await factory.WithDb(async db => { db.JournalEntries.Add(Make()); await db.SaveChangesAsync(); }, t.CompanyId);
        await Assert.ThrowsAsync<DbUpdateException>(() =>
            factory.WithDb(async db => { db.JournalEntries.Add(Make()); await db.SaveChangesAsync(); }, t.CompanyId));
    }
}
