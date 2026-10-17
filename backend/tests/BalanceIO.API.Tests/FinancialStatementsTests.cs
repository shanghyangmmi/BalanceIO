using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>
/// The bilingual statement set: each statement foots, ties to the others,
/// and reconciles to the ledger, for the period and the comparative.
/// </summary>
public class FinancialStatementsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const decimal M = 1_000_000m;

    private async Task<TestTenant> SeedAsync()
    {
        var t = await factory.CreateTenantAsync("PT Laporan");
        var id = t.CompanyId;
        await factory.AddAccount(id, "1-1102", "Cash in Bank", "Asset");
        await factory.AddAccount(id, "1-1200", "Trade Receivables", "Asset");
        await factory.AddAccount(id, "1-2100", "Equipment", "Asset");
        await factory.AddAccount(id, "1-2200", "Accumulated Depreciation", "Asset");
        await factory.AddAccount(id, "2-1100", "Trade Payables", "Liability");
        await factory.AddAccount(id, "2-1400", "Income Tax Payable", "Liability");
        await factory.AddAccount(id, "2-2100", "Bank Loans", "Liability");
        await factory.AddAccount(id, "3-1000", "Share Capital", "Equity");
        await factory.AddAccount(id, "5-1000", "Cost of Goods Sold", "Expense");
        await factory.AddAccount(id, "6-1600", "Depreciation Expense", "Expense");
        await factory.AddAccount(id, "8-5000", "Tax Expense", "Expense");

        await factory.WithDb(async db =>
        {
            var accounts = await db.Accounts.ToListAsync();
            accounts.Single(a => a.Code == "1-2200").NormalBalance = "Credit";
            accounts.Single(a => a.Code == "1-1102").NameId = "Kas di Bank";
            await db.SaveChangesAsync();
        }, id);

        await Post(t, "2025-06-01", ("1-1102", 500 * M), ("3-1000", -500 * M));
        await Post(t, "2025-09-01", ("1-2100", 120 * M), ("1-1102", -120 * M));
        await Post(t, "2025-12-31", ("1-1102", 80 * M), ("1-1200", 20 * M), ("4-1000", -100 * M));
        await Post(t, "2025-12-31", ("6-1600", 10 * M), ("1-2200", -10 * M));
        await Post(t, "2026-03-01", ("1-1102", 20 * M), ("1-1200", -20 * M));
        await Post(t, "2026-04-01", ("1-1102", 150 * M), ("4-1000", -150 * M));
        await Post(t, "2026-04-01", ("5-1000", 60 * M), ("2-1100", -60 * M));
        await Post(t, "2026-05-01", ("1-1102", 100 * M), ("2-2100", -100 * M));
        await Post(t, "2026-06-01", ("8-5000", 5 * M), ("2-1400", -5 * M));
        await Post(t, "2026-06-30", ("6-1600", 15 * M), ("1-2200", -15 * M));
        return t;
    }

    /// <summary>Positive amounts are debits, negative credits.</summary>
    private Task Post(TestTenant t, string date, params (string Code, decimal Amount)[] lines) =>
        factory.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, Date = DateOnly.Parse(date),
                Status = JournalEntryStatus.Posted,
                Lines = lines.Select(l => new JournalLine
                {
                    Id = Guid.NewGuid(), AccountId = l.Code,
                    Debit = l.Amount > 0 ? l.Amount : 0m, Credit = l.Amount < 0 ? -l.Amount : 0m,
                }).ToList(),
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

    private static JsonElement Statement(JsonElement pack, string key) =>
        pack.GetProperty("statements").EnumerateArray().Single(s => s.GetProperty("key").GetString() == key);

    private static JsonElement Line(JsonElement statement, string labelEn) =>
        statement.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("labelEn").GetString() == labelEn);

    private static decimal Cur(JsonElement line) => line.GetProperty("current").GetDecimal();
    private static decimal Prior(JsonElement line) => line.GetProperty("prior").GetDecimal();

    private async Task<JsonElement> FetchAsync(TestTenant t)
    {
        var res = await t.OwnerClient().GetAsync("/api/Reports/financial-statements?start=2026-01-01&end=2026-06-30&comparative=true");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await res.Json();
    }

    [Fact]
    public async Task Every_statement_passes_its_checks()
    {
        var pack = await FetchAsync(await SeedAsync());

        foreach (var statement in pack.GetProperty("statements").EnumerateArray())
        foreach (var check in statement.GetProperty("checks").EnumerateArray())
        {
            Assert.True(check.GetProperty("passed").GetBoolean(),
                $"{statement.GetProperty("key")}: {check.GetProperty("labelEn")} off by {check.GetProperty("difference")}");
        }

        Assert.Equal("2026", pack.GetProperty("columnCurrent").GetString());
        Assert.Equal("2025", pack.GetProperty("columnPrior").GetString());
    }

    [Fact]
    public async Task Position_carries_unclosed_profit_in_equity()
    {
        var sofp = Statement(await FetchAsync(await SeedAsync()), "sofp");

        Assert.Equal(825 * M, Cur(Line(sofp, "TOTAL ASSETS")));
        Assert.Equal(500 * M, Prior(Line(sofp, "TOTAL ASSETS")));
        Assert.Equal(165 * M, Cur(Line(sofp, "Total liabilities")));
        Assert.Equal(90 * M, Cur(Line(sofp, "Retained earnings")));
        Assert.Equal(70 * M, Cur(Line(sofp, "Profit (loss) for the year")));
        Assert.Equal(-25 * M, Cur(Line(sofp, "Accumulated Depreciation")));

        var bank = Line(sofp, "Cash in Bank");
        Assert.Equal("Kas di Bank", bank.GetProperty("labelId").GetString());
        Assert.Equal(730 * M, Cur(bank));
    }

    [Fact]
    public async Task Profit_or_loss_and_equity_movement_agree()
    {
        var pack = await FetchAsync(await SeedAsync());
        var pl = Statement(pack, "pl");

        Assert.Equal(90 * M, Cur(Line(pl, "GROSS PROFIT")));
        Assert.Equal(-5 * M, Cur(Line(pl, "Income tax expense")));
        Assert.Equal(70 * M, Cur(Line(pl, "PROFIT (LOSS) FOR THE PERIOD")));
        Assert.Equal(0m, Prior(Line(pl, "PROFIT (LOSS) FOR THE PERIOD")));

        var equity = Statement(pack, "equity");
        Assert.Equal(590 * M, Cur(Line(equity, "Balance at beginning of period")));
        Assert.Equal(660 * M, Cur(Line(equity, "Balance at end of period")));
    }

    [Fact]
    public async Task Cash_flows_reconcile_to_the_cash_accounts()
    {
        var cf = Statement(await FetchAsync(await SeedAsync()), "cashflow");

        Assert.Equal(15 * M, Cur(Line(cf, "Depreciation and amortisation")));
        Assert.Equal(170 * M, Cur(Line(cf, "Net cash from operating activities")));
        Assert.Equal(100 * M, Cur(Line(cf, "Net cash from financing activities")));
        Assert.Equal(460 * M, Cur(Line(cf, "Cash and cash equivalents at beginning of period")));
        Assert.Equal(730 * M, Cur(Line(cf, "CASH AND CASH EQUIVALENTS AT END OF PERIOD")));
        Assert.Equal(500 * M, Prior(Line(cf, "CASH AND CASH EQUIVALENTS AT END OF PERIOD")));
    }

    [Fact]
    public async Task Inactive_account_with_a_balance_stays_in_the_statements()
    {
        var t = await SeedAsync();
        await factory.WithDb(async db =>
        {
            (await db.Accounts.SingleAsync(a => a.Code == "2-2100")).IsActive = false;
            await db.SaveChangesAsync();
        }, t.CompanyId);

        var sofp = Statement(await FetchAsync(t), "sofp");
        Assert.Equal(100 * M, Cur(Line(sofp, "Bank Loans")));

        var legacy = await (await t.OwnerClient().GetAsync("/api/Reports/balance-sheet?asOf=2026-06-30")).Json();
        Assert.Equal(165 * M, legacy.GetProperty("liabilities").GetProperty("total").GetDecimal());
    }

    [Fact]
    public async Task Account_code_in_use_cannot_change()
    {
        var t = await SeedAsync();
        var bank = await factory.WithDb(db => db.Accounts.AsNoTracking().SingleAsync(a => a.Code == "1-1102"), t.CompanyId);

        bank.Code = "1-1109";
        var res = await t.OwnerClient().PutAsJsonAsync($"/api/Accounts/{bank.Id}", bank);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("ACCOUNT_CODE_IN_USE", await res.Body());

        var delete = await t.OwnerClient().DeleteAsync($"/api/Accounts/{bank.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, delete.StatusCode);
    }
}
