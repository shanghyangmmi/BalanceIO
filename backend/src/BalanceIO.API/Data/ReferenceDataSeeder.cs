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
        await BackfillIndonesianNamesAsync(db, logger, ct);
        await AssignStockToWarehousesAsync(db, logger, ct);
        await ValueStockAtAverageAsync(db, logger, ct);
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
                    Description = spec.Description, NameId = spec.Description, IsActive = true, IsSystemDefault = true,
                    ParentAccountId = have.TryGetValue(spec.ParentCode, out var parentId) ? parentId : null,
                });
                added++;
            }

            if (added == 0) continue;
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded account {Code} for {Count} company(ies).", spec.Code, added);
        }
    }

    /// <summary>
    /// The default chart kept each account's Indonesian name in Description.
    /// Bilingual statements read NameId, so system accounts that predate it
    /// take it from there. User accounts are left for their owners to name.
    /// </summary>
    private static async Task BackfillIndonesianNamesAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct)
    {
        var updated = await db.Accounts.IgnoreQueryFilters()
            .Where(a => a.IsSystemDefault && a.NameId == null && a.Description != null && a.Description.Length <= 100)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.NameId, a => a.Description), ct);

        if (updated > 0)
            logger.LogInformation("Set the Indonesian name on {Count} default account(s).", updated);
    }

    /// <summary>
    /// Stock per warehouse is the sum of movements per warehouse, which holds
    /// only if every movement names one and every unit of stock has a
    /// movement. Before warehouses held stock neither was true: movements had
    /// no warehouse, and purchase order receipts and product creation changed
    /// stock without one. For each company that keeps stock this creates the
    /// default warehouse, assigns the unassigned movements to it, and records
    /// an OpeningBalance movement for any difference between the movements
    /// and stock on hand. Idempotent: a company already aligned is untouched.
    /// </summary>
    private static async Task AssignStockToWarehousesAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct)
    {
        var companies = await db.Products.IgnoreQueryFilters()
            .Where(p => p.TrackInventory)
            .Select(p => p.CompanyId)
            .Union(db.InventoryMovements.IgnoreQueryFilters().Select(m => m.CompanyId))
            .Distinct()
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        foreach (var companyId in companies)
        {
            var warehouse = await db.Warehouses.IgnoreQueryFilters()
                .FirstOrDefaultAsync(w => w.CompanyId == companyId && w.IsDefault, ct);
            if (warehouse is null)
            {
                var code = await db.Warehouses.IgnoreQueryFilters().AnyAsync(w => w.CompanyId == companyId && w.Code == "MAIN", ct)
                    ? $"MAIN-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}"
                    : "MAIN";
                warehouse = new Warehouse { Id = Guid.NewGuid(), CompanyId = companyId, Code = code, Name = "Gudang Utama", IsDefault = true, IsActive = true };
                db.Warehouses.Add(warehouse);
                await db.SaveChangesAsync(ct);
            }

            var assigned = await db.InventoryMovements.IgnoreQueryFilters()
                .Where(m => m.CompanyId == companyId && m.WarehouseId == null)
                .ExecuteUpdateAsync(s => s.SetProperty(m => m.WarehouseId, warehouse.Id), ct);

            // Summed in memory: SQLite stores decimal(19,4) as REAL.
            var moved = (await db.InventoryMovements.IgnoreQueryFilters().AsNoTracking()
                    .Where(m => m.CompanyId == companyId)
                    .Select(m => new { m.ProductId, m.Quantity })
                    .ToListAsync(ct))
                .GroupBy(m => m.ProductId)
                .ToDictionary(g => g.Key, g => g.Sum(m => m.Quantity));

            var products = await db.Products.IgnoreQueryFilters().AsNoTracking()
                .Where(p => p.CompanyId == companyId && p.TrackInventory)
                .Select(p => new { p.Id, p.Code, p.StockOnHand, p.BuyPrice })
                .ToListAsync(ct);

            var aligned = 0;
            foreach (var p in products)
            {
                var gap = p.StockOnHand - (moved.TryGetValue(p.Id, out var q) ? q : 0m);
                if (gap == 0m) continue;
                db.InventoryMovements.Add(new InventoryMovement
                {
                    Id = Guid.NewGuid(), CompanyId = companyId, ProductId = p.Id, WarehouseId = warehouse.Id,
                    MovementDate = today, Type = InventoryMovementType.OpeningBalance,
                    Quantity = gap, UnitCost = p.BuyPrice, TotalCost = gap * p.BuyPrice,
                    ReferenceNumber = $"OPEN-{p.Code}",
                    Notes = "Stock on hand recorded before warehouses held stock",
                });
                aligned++;
            }

            if (aligned > 0) await db.SaveChangesAsync(ct);
            if (assigned > 0 || aligned > 0)
                logger.LogInformation("Company {Company}: {Assigned} movement(s) assigned to {Warehouse}, {Aligned} product(s) aligned.",
                    companyId, assigned, warehouse.Code, aligned);
        }
    }

    /// <summary>
    /// Moving-average costing starts from a carrying value. Stock held before
    /// it existed had none, and its cost of sales had been taken at buy
    /// price, so the buy price is the opening average. Only products never
    /// valued are touched.
    /// </summary>
    private static async Task ValueStockAtAverageAsync(ApplicationDbContext db, ILogger logger, CancellationToken ct)
    {
        var unvalued = await db.Products.IgnoreQueryFilters()
            .Where(p => p.TrackInventory && p.StockOnHand != 0m && p.InventoryValue == 0m && p.AverageCost == 0m && p.BuyPrice != 0m)
            .ToListAsync(ct);
        if (unvalued.Count == 0) return;

        foreach (var p in unvalued)
        {
            p.InventoryValue = Math.Round(p.StockOnHand * p.BuyPrice, 2, MidpointRounding.ToEven);
            p.AverageCost = p.BuyPrice;
        }
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Opened the moving average at buy price on {Count} product(s).", unvalued.Count);
    }
}
