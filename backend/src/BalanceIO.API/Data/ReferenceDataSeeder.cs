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
        await SeedRequiredAccountsAsync(db, logger, ct);
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

    /// <summary>
    /// Accounts that a posting path depends on and that companies created
    /// before the path existed do not have. Added to every company missing
    /// them; existing accounts with the code are left alone.
    /// </summary>
    private static readonly (string Code, string Name, string Type, string Group, int Level, string NormalBalance, string Description, string ParentCode)[] RequiredAccounts =
    {
        (VarianceCode, "Inventory Variance", "Expense", "CostOfSales", 2, "Debit", "Selisih Persediaan", "5-0000"),
        ("2-1410", "PPh 21 Payable", "Liability", "Liability", 3, "Credit", "Utang PPh 21", "2-1000"),
        ("2-1510", "BPJS Payable", "Liability", "Liability", 3, "Credit", "Utang BPJS", "2-1000"),
        ("6-1110", "Employee Benefits (BPJS)", "Expense", "Expense", 3, "Debit", "Beban BPJS", "6-1000"),
    };

    private static async Task SeedRequiredAccountsAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct)
    {
        var companies = await db.Companies.AsNoTracking().Select(c => c.Id).ToListAsync(ct);
        var codes = RequiredAccounts.Select(a => a.Code).Concat(RequiredAccounts.Select(a => a.ParentCode)).Distinct().ToList();

        var existing = await db.Accounts.IgnoreQueryFilters()
            .Where(a => codes.Contains(a.Code))
            .Select(a => new { a.CompanyId, a.Code, a.Id })
            .ToListAsync(ct);

        var byCompany = existing
            .GroupBy(a => a.CompanyId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(a => a.Code, a => a.Id));

        foreach (var spec in RequiredAccounts)
        {
            var added = 0;
            foreach (var companyId in companies)
            {
                var have = byCompany.TryGetValue(companyId, out var accounts) ? accounts : new Dictionary<string, Guid>();
                if (have.ContainsKey(spec.Code)) continue;

                db.Accounts.Add(new Account
                {
                    Id = Guid.NewGuid(), CompanyId = companyId, Code = spec.Code, Name = spec.Name,
                    Type = spec.Type, AccountGroup = spec.Group, Level = spec.Level, NormalBalance = spec.NormalBalance,
                    Description = spec.Description, IsActive = true, IsSystemDefault = true,
                    ParentAccountId = have.TryGetValue(spec.ParentCode, out var parentId) ? parentId : null,
                });
                added++;
            }

            if (added == 0) continue;
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded account {Code} for {Count} company(ies).", spec.Code, added);
        }
    }
}
