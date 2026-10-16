using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BalanceIO.API.Models;
using BalanceIO.API.Data;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace BalanceIO.API.Tests;

/// <summary>
/// Boots the real pipeline against a throwaway SQLite file. The connection
/// string travels through the environment because SecretsBootstrap reads it
/// before the host's configuration is final.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private static readonly object EnvLock = new();
    private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"balanceio-test-{Guid.NewGuid():N}.db");

    public ApiFactory()
    {
        lock (EnvLock)
        {
            Environment.SetEnvironmentVariable("BALANCEIO_DB_CONNECTION", $"Data Source={_dbPath}");
            _ = Server; // build the host while the variable still points at this file
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        foreach (var f in Directory.GetFiles(Path.GetDirectoryName(_dbPath)!, Path.GetFileName(_dbPath) + "*"))
        {
            try { File.Delete(f); } catch (IOException) { /* sqlite may still hold the handle on exit */ }
        }
    }

    public async Task<T> WithDb<T>(Func<ApplicationDbContext, Task<T>> action, Guid? companyId = null)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.CurrentCompanyId = companyId;
        return await action(db);
    }

    public Task WithDb(Func<ApplicationDbContext, Task> action, Guid? companyId = null) =>
        WithDb<int>(async db => { await action(db); return 0; }, companyId);

    public TestTenant CreateTenant(string name = "PT Uji") =>
        CreateTenantAsync(name).GetAwaiter().GetResult();

    public async Task<TestTenant> CreateTenantAsync(string name)
    {
        var tenant = new TestTenant(this, Guid.NewGuid());
        await WithDb(async db =>
        {
            db.Companies.Add(new Company { Id = tenant.CompanyId, Name = name });
            await db.SaveChangesAsync();
        });
        tenant.Cash = await AddAccount(tenant.CompanyId, "1-1000", "Cash", "Asset");
        tenant.Revenue = await AddAccount(tenant.CompanyId, "4-1000", "Revenue", "Revenue");
        tenant.Owner = await AddMember(tenant.CompanyId, "owner");
        tenant.Reviewer = await AddMember(tenant.CompanyId, "reviewer");
        return tenant;
    }

    public async Task<Account> AddAccount(Guid companyId, string code, string name, string type)
    {
        var account = new Account
        {
            Id = Guid.NewGuid(), CompanyId = companyId, Code = code, Name = name,
            Type = type, AccountGroup = type, NormalBalance = type == "Asset" ? "Debit" : "Credit",
        };
        await WithDb(async db => { db.Accounts.Add(account); await db.SaveChangesAsync(); }, companyId);
        return account;
    }

    public async Task<TestUser> AddMember(Guid companyId, string label, string role = "Owner")
    {
        var user = new User
        {
            Id = Guid.NewGuid(), Name = label, Email = $"{label}-{Guid.NewGuid():N}@test.local",
            IsEmailVerified = true,
        };
        await WithDb(async db =>
        {
            db.Users.Add(user);
            db.UserCompanies.Add(new UserCompany { UserId = user.Id, CompanyId = companyId, Role = role });
            await db.SaveChangesAsync();
        });
        using var scope = Services.CreateScope();
        var token = scope.ServiceProvider.GetRequiredService<JwtService>().GenerateToken(user);
        return new TestUser(user.Id, user.Email, token);
    }

    public HttpClient ClientFor(Guid companyId, TestUser user)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", user.Token);
        client.DefaultRequestHeaders.Add("X-Company-Id", companyId.ToString());
        return client;
    }
}

public sealed record TestUser(Guid Id, string Email, string Token);

public sealed class TestTenant(ApiFactory factory, Guid companyId)
{
    public Guid CompanyId { get; } = companyId;
    public Account Cash { get; set; } = null!;
    public Account Revenue { get; set; } = null!;
    public TestUser Owner { get; set; } = null!;
    public TestUser Reviewer { get; set; } = null!;

    public HttpClient OwnerClient() => factory.ClientFor(CompanyId, Owner);
    public HttpClient ReviewerClient() => factory.ClientFor(CompanyId, Reviewer);

    public object BalancedBody(string? date = null, decimal amount = 100_000m) => new
    {
        date = date ?? "2026-03-15",
        referenceNumber = "T-" + Guid.NewGuid().ToString("N")[..8],
        currency = "IDR",
        lines = new[]
        {
            new { accountId = Cash.Code, description = "dr", debit = amount, credit = 0m },
            new { accountId = Revenue.Code, description = "cr", debit = 0m, credit = amount },
        },
    };
}

public static class HttpExtensions
{
    public static async Task<JsonElement> Json(this HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.Clone();
    }

    public static async Task<string> Body(this HttpResponseMessage response) =>
        await response.Content.ReadAsStringAsync();

    public static Task<HttpResponseMessage> PostJson<T>(this HttpClient c, string url, T body, string? idempotencyKey = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = JsonContent.Create(body) };
        if (idempotencyKey != null) request.Headers.Add("X-Idempotency-Key", idempotencyKey);
        return c.SendAsync(request);
    }
}

public static class JournalHelpers
{
    public static async Task<Guid> CreateDraft(this TestTenant t, HttpClient? client = null, string date = "2026-03-15")
    {
        var res = await (client ?? t.OwnerClient()).PostJson("/api/JournalEntries", t.BalancedBody(date));
        Assert.Equal(System.Net.HttpStatusCode.Created, res.StatusCode);
        return (await res.Json()).GetProperty("id").GetGuid();
    }

    /// <summary>Writes a Posted entry straight to the database, the way a system posting path would.</summary>
    public static async Task<Guid> SeedPosted(this ApiFactory f, TestTenant t, string date = "2026-03-15", decimal amount = 100m)
    {
        var id = Guid.NewGuid();
        await f.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = id, CompanyId = t.CompanyId, Date = DateOnly.Parse(date), ReferenceNumber = "SEED-" + id.ToString("N")[..6],
                Status = JournalEntryStatus.Posted,
                Lines =
                [
                    new JournalLine { Id = Guid.NewGuid(), AccountId = t.Cash.Code, Debit = amount },
                    new JournalLine { Id = Guid.NewGuid(), AccountId = t.Revenue.Code, Credit = amount },
                ],
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return id;
    }
}
