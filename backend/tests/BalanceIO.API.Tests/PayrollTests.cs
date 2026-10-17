using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>PPh 21 TER, BPJS, the December settlement, and posting a run to the ledger.</summary>
public class PayrollCalculatorTests
{
    private static readonly PayrollRates Rates = new(12_000_000m, 10_547_400m);

    private static PayrollInput Salary(decimal wage, string? ptkp = "TK/0", decimal other = 0m) =>
        new(wage, 0m, other, ptkp, 0.24m, true, true, true);

    [Fact]
    public void Ter_month_withholds_on_gross_including_employer_premiums()
    {
        var r = PayrollCalculator.Calculate(Salary(10_000_000m), 3, PayrollYearToDate.None, Rates);

        Assert.Equal(24_000m, r.EmployerJkk);
        Assert.Equal(30_000m, r.EmployerJkm);
        Assert.Equal(370_000m, r.EmployerJht);
        Assert.Equal(200_000m, r.EmployerJp);
        Assert.Equal(400_000m, r.EmployerKesehatan);
        Assert.Equal(400_000m, r.EmployeeBpjs);

        // 10.000.000 + JKK + JKM + Kesehatan = 10.454.000, TER A 2.5%.
        Assert.Equal(10_454_000m, r.TaxableGross);
        Assert.Equal(2.5m, r.TerRate);
        Assert.Equal(261_350m, r.Pph21);
        Assert.Equal(9_338_650m, r.NetPay);
    }

    [Theory]
    [InlineData("TK/0", "A")]
    [InlineData("K/0", "A")]
    [InlineData("TK/2", "B")]
    [InlineData("K/2", "B")]
    [InlineData("K/3", "C")]
    [InlineData("k/1", "B")]
    public void Ptkp_maps_to_ter_category(string ptkp, string category)
    {
        var (_, actual, warning) = PayrollCalculator.ReadPtkp(ptkp);
        Assert.Equal(category, actual);
        Assert.Null(warning);
    }

    [Fact]
    public void Missing_ptkp_withholds_as_tk0_and_says_so()
    {
        var r = PayrollCalculator.Calculate(Salary(10_000_000m, null), 3, PayrollYearToDate.None, Rates);
        Assert.Equal("TK/0", r.PtkpStatus);
        Assert.Equal("A", r.TerCategory);
        Assert.NotNull(r.Warning);
    }

    [Fact]
    public void Kesehatan_and_pension_stop_at_their_wage_caps()
    {
        var r = PayrollCalculator.Calculate(Salary(20_000_000m), 3, PayrollYearToDate.None, Rates);

        Assert.Equal(480_000m, r.EmployerKesehatan);
        Assert.Equal(120_000m, r.EmployeeKesehatan);
        Assert.Equal(210_948m, r.EmployerJp);
        Assert.Equal(105_474m, r.EmployeeJp);
        Assert.Equal(400_000m, r.EmployeeJht); // JHT has no cap
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(60_000_000, 3_000_000)]
    [InlineData(100_000_000, 9_000_000)]
    [InlineData(300_000_000, 44_000_000)]
    public void Pasal_17_brackets(decimal pkp, decimal tax) =>
        Assert.Equal(tax, PayrollCalculator.Pasal17(pkp));

    [Fact]
    public void December_settles_the_year_against_ter_withheld()
    {
        var ytd = new PayrollYearToDate(11, 11 * 10_454_000m, 11 * 300_000m, 11 * 261_350m);
        var r = PayrollCalculator.Calculate(Salary(10_000_000m), 12, ytd, Rates);

        // Gross 125.448.000, biaya jabatan capped at 6.000.000, JHT+JP
        // 3.600.000, PTKP 54.000.000: PKP 61.848.000, tax 3.277.200.
        Assert.Equal("Annual", r.Pph21Method);
        Assert.Null(r.TerRate);
        Assert.Equal(3_277_200m - 2_874_850m, r.Pph21);
    }

    [Fact]
    public void December_returns_over_withholding_in_net_pay()
    {
        var ytd = new PayrollYearToDate(11, 11 * 10_454_000m, 11 * 300_000m, 5_000_000m);
        var r = PayrollCalculator.Calculate(Salary(10_000_000m), 12, ytd, Rates);

        Assert.True(r.Pph21 < 0m);
        Assert.Equal(10_000_000m - r.Pph21 - r.EmployeeBpjs, r.NetPay);
    }
}

public class PayrollRunTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<(TestTenant Tenant, Guid Employee)> PayrollTenantAsync()
    {
        var t = await factory.CreateTenantAsync("PT Gaji");
        await factory.AddAccount(t.CompanyId, PayrollService.SalaryAccount, "Salaries & Wages", "Expense");
        await factory.AddAccount(t.CompanyId, PayrollService.BenefitsAccount, "Employee Benefits (BPJS)", "Expense");
        await factory.AddAccount(t.CompanyId, PayrollService.Pph21Account, "PPh 21 Payable", "Liability");
        await factory.AddAccount(t.CompanyId, PayrollService.BpjsAccount, "BPJS Payable", "Liability");
        await factory.AddAccount(t.CompanyId, PayrollService.NetPayAccount, "Employee Payable", "Liability");

        var employee = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            var plan = new Plan { Id = Guid.NewGuid(), Name = "Enterprise", Modules = "[\"accounting\",\"payroll\"]" };
            db.Plans.Add(plan);
            db.Subscriptions.Add(new Subscription
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, PlanId = plan.Id,
                Status = SubscriptionStatus.Active, EndDate = DateTime.UtcNow.AddYears(1),
            });
            db.Contacts.Add(new Contact
            {
                Id = employee, CompanyId = t.CompanyId, Code = "E-0001", Name = "Siti Rahma",
                IsEmployee = true, IsCustomer = false, PtkpStatus = "TK/0", Nik = "3171000000000001",
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        var comp = await t.OwnerClient().PutAsJsonAsync($"/api/Payroll/employees/{employee}/compensation",
            new { baseSalary = 10_000_000m, fixedAllowance = 0m, jkkRate = 0.24m, bpjsKetenagakerjaan = true, bpjsPension = true, bpjsKesehatan = true, isActive = true });
        Assert.Equal(HttpStatusCode.OK, comp.StatusCode);

        return (t, employee);
    }

    private static async Task<Guid> CreateRunAsync(TestTenant t, int month = 3)
    {
        var res = await t.OwnerClient().PostJson("/api/Payroll/runs", new { year = 2026, month });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Json()).GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Module_is_refused_without_entitlement()
    {
        var t = await factory.CreateTenantAsync("PT Tanpa Gaji");
        var res = await t.OwnerClient().GetAsync("/api/Payroll/overview");
        Assert.Equal(HttpStatusCode.PaymentRequired, res.StatusCode);
    }

    [Fact]
    public async Task Posted_run_journals_salary_tax_and_bpjs_in_balance()
    {
        var (t, _) = await PayrollTenantAsync();
        var runId = await CreateRunAsync(t);

        var selfPost = await t.OwnerClient().PostJson($"/api/Payroll/runs/{runId}/post", new { });
        Assert.Equal(HttpStatusCode.Forbidden, selfPost.StatusCode);
        Assert.Equal("SEGREGATION_OF_DUTIES_VIOLATION", (await selfPost.Json()).GetProperty("code").GetString());

        var post = await t.ReviewerClient().PostJson($"/api/Payroll/runs/{runId}/post", new { });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);

        var lines = await factory.WithDb(db => db.PayrollRuns
            .Where(r => r.Id == runId)
            .Join(db.JournalLines, r => r.JournalEntryId, l => l.JournalEntryId, (r, l) => l)
            .ToListAsync(), t.CompanyId);

        decimal Dr(string code) => lines.Where(l => l.AccountId == code).Sum(l => l.Debit);
        decimal Cr(string code) => lines.Where(l => l.AccountId == code).Sum(l => l.Credit);

        Assert.Equal(10_000_000m, Dr(PayrollService.SalaryAccount));
        Assert.Equal(1_024_000m, Dr(PayrollService.BenefitsAccount));
        Assert.Equal(261_350m, Cr(PayrollService.Pph21Account));
        Assert.Equal(1_424_000m, Cr(PayrollService.BpjsAccount));
        Assert.Equal(9_338_650m, Cr(PayrollService.NetPayAccount));
        Assert.Equal(lines.Sum(l => l.Debit), lines.Sum(l => l.Credit));

        var withholding = await t.OwnerClient().GetAsync("/api/TaxReports/withholding-summary?year=2026&month=3");
        Assert.Equal(HttpStatusCode.OK, withholding.StatusCode);
        Assert.Equal(261_350m, (await withholding.Json()).GetProperty("totalPph21Withheld").GetDecimal());
    }

    [Fact]
    public async Task One_live_run_per_month_and_void_releases_it()
    {
        var (t, _) = await PayrollTenantAsync();
        var runId = await CreateRunAsync(t);
        Assert.Equal(HttpStatusCode.OK, (await t.ReviewerClient().PostJson($"/api/Payroll/runs/{runId}/post", new { })).StatusCode);

        var duplicate = await t.OwnerClient().PostJson("/api/Payroll/runs", new { year = 2026, month = 3 });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var edit = await t.OwnerClient().PostJson($"/api/Payroll/runs/{runId}/recalculate", new { });
        Assert.Equal("POSTED_IMMUTABLE", (await edit.Json()).GetProperty("code").GetString());

        var voided = await t.ReviewerClient().PostJson($"/api/Payroll/runs/{runId}/void", new { reason = "wrong salary" });
        Assert.Equal(HttpStatusCode.OK, voided.StatusCode);

        var entryStatus = await factory.WithDb(db => db.PayrollRuns.Where(r => r.Id == runId)
            .Join(db.JournalEntries, r => r.JournalEntryId, e => e.Id, (r, e) => e.Status).SingleAsync(), t.CompanyId);
        Assert.Equal(JournalEntryStatus.Void, entryStatus);

        await CreateRunAsync(t);
    }

    [Fact]
    public async Task Earlier_month_cannot_be_voided_under_a_later_posted_month()
    {
        var (t, _) = await PayrollTenantAsync();
        var march = await CreateRunAsync(t, 3);
        Assert.Equal(HttpStatusCode.OK, (await t.ReviewerClient().PostJson($"/api/Payroll/runs/{march}/post", new { })).StatusCode);
        var april = await CreateRunAsync(t, 4);
        Assert.Equal(HttpStatusCode.OK, (await t.ReviewerClient().PostJson($"/api/Payroll/runs/{april}/post", new { })).StatusCode);

        var res = await t.ReviewerClient().PostJson($"/api/Payroll/runs/{march}/void", new { });
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        Assert.Equal("LATER_RUN_POSTED", (await res.Json()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Draft_goes_stale_when_compensation_changes()
    {
        var (t, employee) = await PayrollTenantAsync();
        var runId = await CreateRunAsync(t);

        await t.OwnerClient().PutAsJsonAsync($"/api/Payroll/employees/{employee}/compensation",
            new { baseSalary = 12_000_000m, fixedAllowance = 0m, jkkRate = 0.24m, bpjsKetenagakerjaan = true, bpjsPension = true, bpjsKesehatan = true, isActive = true });

        var stale = await t.ReviewerClient().PostJson($"/api/Payroll/runs/{runId}/post", new { });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal("RUN_STALE", (await stale.Json()).GetProperty("code").GetString());

        Assert.Equal(HttpStatusCode.OK, (await t.OwnerClient().PostJson($"/api/Payroll/runs/{runId}/recalculate", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await t.ReviewerClient().PostJson($"/api/Payroll/runs/{runId}/post", new { })).StatusCode);
    }

    [Fact]
    public async Task Posting_respects_the_period_lock()
    {
        var (t, _) = await PayrollTenantAsync();
        var runId = await CreateRunAsync(t);

        await factory.WithDb(async db =>
        {
            var company = await db.Companies.SingleAsync(c => c.Id == t.CompanyId);
            company.LockDate = new DateOnly(2026, 3, 31);
            await db.SaveChangesAsync();
        });

        var res = await t.ReviewerClient().PostJson($"/api/Payroll/runs/{runId}/post", new { });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Equal("PERIOD_LOCKED", (await res.Json()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task Viewer_reads_payroll_but_cannot_run_it()
    {
        var (t, _) = await PayrollTenantAsync();
        var viewer = await factory.AddMember(t.CompanyId, "viewer", "Viewer");
        var client = factory.ClientFor(t.CompanyId, viewer);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Payroll/runs")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostJson("/api/Payroll/runs", new { year = 2026, month = 5 })).StatusCode);
    }
}
