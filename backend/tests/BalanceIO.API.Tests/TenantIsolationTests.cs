using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>Related to C1: other endpoints that resolved "the company" without using the caller's scope.</summary>
public class TenantIsolationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(TestUser user, HttpClient client)> LoneUser()
    {
        var tenant = await factory.CreateTenantAsync("scratch");
        var user = await factory.AddMember(tenant.CompanyId, "lone");
        await factory.WithDb(async db =>
        {
            db.UserCompanies.RemoveRange(db.UserCompanies.Where(uc => uc.UserId == user.Id));
            await db.SaveChangesAsync();
        });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", user.Token);
        return (user, client);
    }

    [Fact]
    public async Task User_without_a_company_is_not_made_owner_of_somebody_elses()
    {
        var existing = factory.CreateTenant("Existing customer");
        var (user, client) = await LoneUser();

        var res = await client.GetAsync("/api/Users/me/companies");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Whatever the user was given, nobody else may be a member of it.
        var shared = await factory.WithDb(async db =>
        {
            var companies = await db.UserCompanies.Where(uc => uc.UserId == user.Id).Select(uc => uc.CompanyId).ToListAsync();
            return await db.UserCompanies.CountAsync(uc => companies.Contains(uc.CompanyId) && uc.UserId != user.Id);
        });
        Assert.Equal(0, shared);
        Assert.NotEmpty(await factory.WithDb(db => db.UserCompanies.Where(uc => uc.UserId == user.Id).ToListAsync()));
        Assert.NotEqual(Guid.Empty, existing.CompanyId);
    }

    [Fact]
    public async Task Company_profile_is_the_callers_company_not_the_first_row()
    {
        var first = factory.CreateTenant("First tenant");
        var mine = factory.CreateTenant("My tenant");

        var json = await (await mine.OwnerClient().GetAsync("/api/Company")).Json();
        Assert.Equal(mine.CompanyId, json.GetProperty("id").GetGuid());

        var put = await mine.OwnerClient().PutAsJsonAsync("/api/Company", new { name = "Renamed" });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var names = await factory.WithDb(db => db.Companies.Where(c => c.Id == first.CompanyId || c.Id == mine.CompanyId)
            .ToDictionaryAsync(c => c.Id, c => c.Name));
        Assert.Equal("First tenant", names[first.CompanyId]);
        Assert.Equal("Renamed", names[mine.CompanyId]);
    }

    [Fact]
    public async Task Member_list_of_another_company_is_refused()
    {
        var mine = factory.CreateTenant("Mine");
        var theirs = factory.CreateTenant("Theirs");

        var res = await mine.OwnerClient().GetAsync($"/api/Users/company-users/{theirs.CompanyId}");
        Assert.True(res.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound, $"got {res.StatusCode}");
    }

    [Fact]
    public async Task Viewer_cannot_post_the_ppn_settlement_journal()
    {
        var t = factory.CreateTenant();
        var viewer = await factory.AddMember(t.CompanyId, "viewer", role: "Viewer");
        var res = await factory.ClientFor(t.CompanyId, viewer)
            .PostJson("/api/TaxReports/settle-ppn", new { year = 2026, month = 3, settlementDate = "2026-03-31" });
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }
}
