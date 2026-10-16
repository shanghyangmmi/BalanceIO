using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Data;

/// <summary>
/// Rows the application expects to exist. Idempotent: each row is added only
/// when absent, so it is safe on every boot, on either provider. Schema never
/// changes here; that is the migrations' job.
/// </summary>
public static class ReferenceDataSeeder
{
    private const string VarianceCode = "5-9000";

    public static async Task SeedAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct = default)
    {
        await SeedTaxRatesAsync(db, ct);
        await SeedInventoryVarianceAccountsAsync(db, logger, ct);
    }

    private static async Task SeedTaxRatesAsync(ApplicationDbContext db, CancellationToken ct)
    {
        var standard = new[]
        {
            new TaxRate { Name = "PPN 11% (UU HPP)", Rate = 11m, DppScheme = DppScheme.Standard, EffectiveFrom = new DateOnly(2022, 4, 1), EffectiveTo = new DateOnly(2024, 12, 31) },
            new TaxRate { Name = "PPN 12% (PMK 131/2024)", Rate = 12m, DppScheme = DppScheme.NilaiLain11Over12, EffectiveFrom = new DateOnly(2025, 1, 1) },
            new TaxRate { Name = "PPN 12% Luxury (Standard DPP)", Rate = 12m, DppScheme = DppScheme.Standard, EffectiveFrom = new DateOnly(2025, 1, 1) },
        };

        var existing = await db.TaxRates.IgnoreQueryFilters().Where(t => t.CompanyId == null).Select(t => t.Name).ToListAsync(ct);
        foreach (var rate in standard.Where(r => !existing.Contains(r.Name)))
        {
            rate.IsActive = true;
            rate.IsSystemDefault = true;
            db.TaxRates.Add(rate);
        }
        await db.SaveChangesAsync(ct);
    }

    private static async Task SeedInventoryVarianceAccountsAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct)
    {
        var companies = await db.Companies.AsNoTracking().Select(c => c.Id).ToListAsync(ct);
        var have = (await db.Accounts.IgnoreQueryFilters().Where(a => a.Code == VarianceCode).Select(a => a.CompanyId).ToListAsync(ct)).ToHashSet();

        var added = 0;
        foreach (var companyId in companies.Where(c => !have.Contains(c)))
        {
            db.Accounts.Add(new Account
            {
                Id = Guid.NewGuid(), CompanyId = companyId, Code = VarianceCode, Name = "Inventory Variance",
                Type = "Expense", AccountGroup = "CostOfSales", Level = 2, NormalBalance = "Debit",
                Description = "Selisih Persediaan", IsActive = true, IsSystemDefault = true,
            });
            added++;
        }
        if (added == 0) return;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded account {Code} for {Count} company(ies).", VarianceCode, added);
    }
}
