using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The fiscal depreciation schedule for a tax year and its difference from
/// the commercial charge. Commercial depreciation is what the register
/// posted (AssetDepreciation rows dated in the year); on disposal, the
/// difference in book value written off is part of the correction, because
/// the proceeds are the same on both sides.
/// </summary>
public class FiscalDepreciationService
{
    private readonly ApplicationDbContext _context;

    public FiscalDepreciationService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<FiscalDepreciationResponse> ForYearAsync(Guid companyId, int year)
    {
        var start = new DateOnly(year, 1, 1);
        var end = new DateOnly(year, 12, 31);

        var assets = await _context.FixedAssets.AsNoTracking()
            .Where(a => a.CompanyId == companyId && a.AcquisitionDate <= end
                     && (a.DisposalDate == null || a.DisposalDate >= start))
            .OrderBy(a => a.Code)
            .ToListAsync();
        var ids = assets.Select(a => a.Id).ToList();

        // Summed in memory: SQLite stores decimal(19,4) as REAL.
        var charges = (await _context.AssetDepreciations.AsNoTracking()
                .Where(d => ids.Contains(d.FixedAssetId) && d.DepreciationDate >= start && d.DepreciationDate <= end)
                .Select(d => new { d.FixedAssetId, d.DepreciationAmount })
                .ToListAsync())
            .GroupBy(d => d.FixedAssetId)
            .ToDictionary(g => g.Key, g => g.Sum(d => d.DepreciationAmount));

        var response = new FiscalDepreciationResponse
        {
            Year = year,
            Currency = await _context.Companies.AsNoTracking().Where(c => c.Id == companyId).Select(c => c.Currency).FirstOrDefaultAsync() ?? "IDR",
        };

        foreach (var asset in assets)
        {
            if (asset.FiscalGroup == FiscalGroup.NotSet)
            {
                response.Unclassified++;
                continue;
            }

            var (opening, charge, closing) = FiscalDepreciation.ForYear(asset, year);
            var commercial = charges.GetValueOrDefault(asset.Id);
            var lifeMonths = FiscalDepreciation.LifeMonths(asset.FiscalGroup, asset.FiscalUsefulLifeMonths);
            var row = new FiscalDepreciationRow
            {
                AssetId = asset.Id,
                Code = asset.Code,
                Name = asset.Name,
                Group = asset.FiscalGroup.ToString(),
                GroupLabel = FiscalDepreciation.Label(asset.FiscalGroup),
                Method = asset.FiscalGroup == FiscalGroup.NotDepreciable ? "" : FiscalDepreciation.EffectiveMethod(asset.FiscalGroup, asset.FiscalMethod).ToString(),
                LifeYears = lifeMonths / 12,
                AcquisitionDate = asset.AcquisitionDate,
                Cost = asset.AcquisitionCost,
                FiscalOpening = opening,
                FiscalCharge = charge,
                FiscalClosing = closing,
                CommercialCharge = commercial,
                Correction = commercial - charge,
            };

            if (asset.DisposalDate is { } disposed && disposed.Year == year)
            {
                var proceeds = asset.DisposalAmount ?? 0m;
                var commercialBookValue = asset.AcquisitionCost - asset.AccumulatedDepreciation;
                row.DisposalDate = disposed;
                row.Proceeds = proceeds;
                row.FiscalGainLoss = proceeds - closing;
                row.CommercialGainLoss = proceeds - commercialBookValue;
                row.Correction += commercialBookValue - closing;
                row.FiscalClosing = 0m;
            }

            response.Rows.Add(row);
        }

        response.Groups = response.Rows
            .GroupBy(r => new { r.Group, r.GroupLabel })
            .OrderBy(g => Enum.Parse<FiscalGroup>(g.Key.Group))
            .Select(g => new FiscalDepreciationGroup
            {
                Group = g.Key.Group,
                GroupLabel = g.Key.GroupLabel,
                Assets = g.Count(),
                Cost = g.Sum(r => r.Cost),
                FiscalCharge = g.Sum(r => r.FiscalCharge),
                FiscalClosing = g.Sum(r => r.FiscalClosing),
                CommercialCharge = g.Sum(r => r.CommercialCharge),
                Correction = g.Sum(r => r.Correction),
            })
            .ToList();

        response.FiscalCharge = response.Rows.Sum(r => r.FiscalCharge);
        response.CommercialCharge = response.Rows.Sum(r => r.CommercialCharge);
        response.Correction = response.Rows.Sum(r => r.Correction);
        return response;
    }
}
