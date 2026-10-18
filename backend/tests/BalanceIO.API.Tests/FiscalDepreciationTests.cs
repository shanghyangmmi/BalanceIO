using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>The fiscal schedule under UU PPh Pasal 11 as amended by UU HPP.</summary>
public class FiscalDepreciationScheduleTests
{
    private static FixedAsset Asset(FiscalGroup group, FiscalMethod method, decimal cost, DateOnly acquired, DateOnly? disposed = null) => new()
    {
        Code = "A", Name = "A", AcquisitionCost = cost, AcquisitionDate = acquired,
        FiscalGroup = group, FiscalMethod = method, DisposalDate = disposed,
    };

    private static decimal[] Charges(FixedAsset asset) => FiscalDepreciation.Schedule(asset).Select(y => y.Charge).ToArray();

    [Fact]
    public void Straight_line_prorates_the_first_year_by_month_and_ends_after_the_useful_life()
    {
        var asset = Asset(FiscalGroup.Group1, FiscalMethod.StraightLine, 48_000_000m, new DateOnly(2024, 7, 15));
        Assert.Equal(new[] { 6_000_000m, 12_000_000m, 12_000_000m, 12_000_000m, 6_000_000m }, Charges(asset));
        Assert.Equal(2028, FiscalDepreciation.Schedule(asset)[^1].Year);
    }

    [Fact]
    public void Declining_balance_doubles_the_rate_and_charges_the_remainder_in_the_last_year()
    {
        var january = Asset(FiscalGroup.Group1, FiscalMethod.DecliningBalance, 100_000_000m, new DateOnly(2024, 1, 10));
        Assert.Equal(new[] { 50_000_000m, 25_000_000m, 12_500_000m, 12_500_000m }, Charges(january));

        var july = Asset(FiscalGroup.Group1, FiscalMethod.DecliningBalance, 100_000_000m, new DateOnly(2024, 7, 1));
        Assert.Equal(new[] { 25_000_000m, 37_500_000m, 18_750_000m, 9_375_000m, 9_375_000m }, Charges(july));
    }

    [Fact]
    public void Buildings_are_straight_line_whatever_the_method_and_may_use_a_longer_life()
    {
        var building = Asset(FiscalGroup.PermanentBuilding, FiscalMethod.DecliningBalance, 2_000_000_000m, new DateOnly(2024, 1, 1));
        var charges = Charges(building);
        Assert.Equal(20, charges.Length);
        Assert.All(charges, c => Assert.Equal(100_000_000m, c));

        building.FiscalUsefulLifeMonths = 30 * 12;
        Assert.Equal(30, Charges(building).Length);
    }

    [Fact]
    public void Disposal_stops_depreciation_at_the_month_before()
    {
        var asset = Asset(FiscalGroup.Group2, FiscalMethod.StraightLine, 96_000_000m, new DateOnly(2024, 1, 5), new DateOnly(2025, 4, 10));
        var schedule = FiscalDepreciation.Schedule(asset);
        Assert.Equal(new[] { 12_000_000m, 3_000_000m }, schedule.Select(y => y.Charge));
        Assert.Equal(81_000_000m, schedule[^1].Closing);
    }

    [Fact]
    public void Whole_rupiah_years_add_up_to_cost()
    {
        var asset = Asset(FiscalGroup.Group3, FiscalMethod.StraightLine, 1_000_003m, new DateOnly(2023, 11, 20));
        Assert.Equal(1_000_003m, Charges(asset).Sum());
        Assert.All(Charges(asset), c => Assert.Equal(decimal.Truncate(c), c));

        var land = Asset(FiscalGroup.NotDepreciable, FiscalMethod.StraightLine, 500_000_000m, new DateOnly(2023, 1, 1));
        Assert.Empty(FiscalDepreciation.Schedule(land));
        Assert.Equal((500_000_000m, 0m, 500_000_000m), FiscalDepreciation.ForYear(land, 2026));
    }
}

/// <summary>Fiscal report, reconciliation correction and the disposal journal through the API.</summary>
public class FiscalDepreciationApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private sealed record Setup(TestTenant T, Guid Asset, Dictionary<string, Guid> Accounts);

    private async Task<Setup> SeedAsync()
    {
        var t = await factory.CreateTenantAsync("PT Aset");
        var accounts = new Dictionary<string, Guid>();
        foreach (var (code, name, type) in new[]
        {
            ("1-1102", "Cash in Bank", "Asset"), ("1-2103", "Vehicles", "Asset"), ("1-2202", "Acc. Depr. - Vehicles", "Asset"),
            ("6-1600", "Depreciation Expense", "Expense"), ("7-3000", "Gain on Asset Disposal", "Revenue"), ("8-4000", "Loss on Asset Disposal", "Expense"),
        })
            accounts[code] = (await factory.AddAccount(t.CompanyId, code, name, type)).Id;

        var asset = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            var plan = new Plan { Id = Guid.NewGuid(), Name = "Aset", Modules = "[\"accounting\",\"tax\",\"fixedAssets\"]" };
            db.Plans.Add(plan);
            db.Subscriptions.Add(new Subscription { Id = Guid.NewGuid(), CompanyId = t.CompanyId, PlanId = plan.Id, Status = SubscriptionStatus.Active, EndDate = DateTime.UtcNow.AddYears(1) });
            var category = new FixedAssetCategory { Id = Guid.NewGuid(), CompanyId = t.CompanyId, Name = "Kendaraan", CodePrefix = "VEH", DefaultFiscalGroup = FiscalGroup.Group2 };
            db.FixedAssetCategories.Add(category);
            // Commercial: five years straight line, 1,000,000 a month; fiscal: Kelompok 2 declining balance, 25 %.
            db.FixedAssets.Add(new FixedAsset
            {
                Id = asset, CompanyId = t.CompanyId, Code = "VEH-0001", Name = "Mobil boks", CategoryId = category.Id,
                AcquisitionDate = new DateOnly(2025, 1, 2), AcquisitionCost = 60_000_000m, UsefulLifeMonths = 60,
                AccumulatedDepreciation = 12_000_000m, BookValue = 48_000_000m, LastDepreciationDate = new DateOnly(2025, 12, 31),
                FiscalGroup = FiscalGroup.Group2, FiscalMethod = FiscalMethod.DecliningBalance,
                AssetAccountId = accounts["1-2103"], DepreciationAccountId = accounts["6-1600"], AccumulatedDepreciationAccountId = accounts["1-2202"],
            });
            for (var m = 1; m <= 12; m++)
                db.AssetDepreciations.Add(new AssetDepreciation { Id = Guid.NewGuid(), FixedAssetId = asset, DepreciationDate = new DateOnly(2025, m, 1).AddMonths(1).AddDays(-1), DepreciationAmount = 1_000_000m, AccumulatedAmount = m * 1_000_000m, BookValueAfter = 60_000_000m - m * 1_000_000m });
            await db.SaveChangesAsync();
        }, t.CompanyId);
        return new Setup(t, asset, accounts);
    }

    private async Task<decimal> Balance(Setup s, string code)
    {
        var lines = await factory.WithDb(db => db.JournalLines.AsNoTracking()
            .Where(l => l.JournalEntry!.CompanyId == s.T.CompanyId && l.JournalEntry.Status == JournalEntryStatus.Posted && l.AccountId == code)
            .Select(l => new { l.Debit, l.Credit }).ToListAsync(), s.T.CompanyId);
        return lines.Sum(l => l.Debit - l.Credit);
    }

    [Fact]
    public async Task Fiscal_report_sets_the_tax_charge_beside_the_commercial_one()
    {
        var s = await SeedAsync();
        var res = await s.T.OwnerClient().GetAsync("/api/Assets/fiscal-depreciation?year=2025");
        Assert.True(res.IsSuccessStatusCode, await res.Body());
        var report = await res.Json();
        var row = report.GetProperty("rows").EnumerateArray().Single();
        Assert.Equal(15_000_000m, row.GetProperty("fiscalCharge").GetDecimal());       // 60m × 25 %
        Assert.Equal(12_000_000m, row.GetProperty("commercialCharge").GetDecimal());
        Assert.Equal(-3_000_000m, report.GetProperty("correction").GetDecimal());
        Assert.Equal("Kelompok 2", row.GetProperty("groupLabel").GetString());
    }

    [Fact]
    public async Task Disposal_posts_the_journal_and_the_book_value_difference_reaches_the_reconciliation()
    {
        var s = await SeedAsync();
        var res = await s.T.OwnerClient().PostJson($"/api/Assets/{s.Asset}/dispose", new
        {
            date = "2026-03-15", amount = 50_000_000m, isSale = true, reason = "Dijual", proceedsAccountId = "1-1102",
        });
        Assert.True(res.IsSuccessStatusCode, await res.Body());

        // Book value 48m, proceeds 50m: gain 2m.
        Assert.Equal(50_000_000m, await Balance(s, "1-1102"));
        Assert.Equal(12_000_000m, await Balance(s, "1-2202"));
        Assert.Equal(-60_000_000m, await Balance(s, "1-2103"));
        Assert.Equal(-2_000_000m, await Balance(s, "7-3000"));

        // Fiscal: 45m at the start of 2026, two months at 25 % = 1,875,000, book value 43,125,000.
        var report = await (await s.T.OwnerClient().GetAsync("/api/Assets/fiscal-depreciation?year=2026")).Json();
        var row = report.GetProperty("rows").EnumerateArray().Single();
        Assert.Equal(1_875_000m, row.GetProperty("fiscalCharge").GetDecimal());
        Assert.Equal(6_875_000m, row.GetProperty("fiscalGainLoss").GetDecimal());
        Assert.Equal(2_000_000m, row.GetProperty("commercialGainLoss").GetDecimal());
        // Commercial expense 0 + book value 48m, fiscal 1,875,000 + 43,125,000: 3m more commercial expense.
        Assert.Equal(3_000_000m, report.GetProperty("correction").GetDecimal());

        var recon = await s.T.OwnerClient().GetAsync("/api/Dashboard/tax/reconciliation?year=2026");
        Assert.True(recon.IsSuccessStatusCode, await recon.Body());
        var line = (await recon.Json()).GetProperty("corrections").EnumerateArray().Single(c => c.GetProperty("code").GetString() == "ASET");
        Assert.Equal("positive", line.GetProperty("direction").GetString());
        Assert.Equal(3_000_000m, line.GetProperty("amount").GetDecimal());

        var again = await s.T.OwnerClient().PostJson($"/api/Assets/{s.Asset}/dispose", new { date = "2026-03-16", amount = 0m, isSale = false });
        Assert.Contains("ALREADY_DISPOSED", await again.Body());
    }

    [Fact]
    public async Task Disposal_before_the_last_depreciation_is_refused()
    {
        var s = await SeedAsync();
        var res = await s.T.OwnerClient().PostJson($"/api/Assets/{s.Asset}/dispose", new { date = "2025-06-30", amount = 0m, isSale = false });
        Assert.Contains("DEPRECIATED_PAST_DISPOSAL", await res.Body());
    }
}
