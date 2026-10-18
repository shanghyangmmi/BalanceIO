using BalanceIO.API.Models;

namespace BalanceIO.API.Services;

/// <summary>
/// Tax depreciation under UU PPh Pasal 11 and 11A as amended by UU HPP.
///
/// Useful lives: Kelompok 1 four years, 2 eight, 3 sixteen, 4 twenty;
/// permanent buildings twenty (or a longer actual life, PMK 72/2023),
/// non-permanent buildings ten. Straight line spreads cost evenly; declining
/// balance applies twice the straight-line rate (50, 25, 12.5, 10 %) to the
/// opening book value and charges what remains in the year the useful life
/// ends. Buildings are straight line only. Depreciation starts in the month
/// of acquisition, there is no residual value, and the first year is
/// prorated by months.
///
/// Amounts are whole rupiah, rounded to even. Straight line rounds the
/// cumulative charge, so the years add up to cost exactly.
///
/// A disposed asset is depreciated through the month before disposal; the
/// rest of its book value is the fiscal gain or loss. Starting depreciation
/// when the asset first produces income (Pasal 11 ayat 3, with DJP
/// approval) is not modelled. Needs practitioner review before reliance.
/// </summary>
public static class FiscalDepreciation
{
    public static int? LifeMonths(FiscalGroup group, int? buildingLifeMonths = null) => group switch
    {
        FiscalGroup.Group1 => 48,
        FiscalGroup.Group2 => 96,
        FiscalGroup.Group3 => 192,
        FiscalGroup.Group4 => 240,
        FiscalGroup.PermanentBuilding => buildingLifeMonths is > 240 ? buildingLifeMonths : 240,
        FiscalGroup.NonPermanentBuilding => 120,
        _ => null,
    };

    public static bool IsBuilding(FiscalGroup group) =>
        group is FiscalGroup.PermanentBuilding or FiscalGroup.NonPermanentBuilding;

    public static FiscalMethod EffectiveMethod(FiscalGroup group, FiscalMethod method) =>
        IsBuilding(group) ? FiscalMethod.StraightLine : method;

    public static string Label(FiscalGroup group) => group switch
    {
        FiscalGroup.Group1 => "Kelompok 1",
        FiscalGroup.Group2 => "Kelompok 2",
        FiscalGroup.Group3 => "Kelompok 3",
        FiscalGroup.Group4 => "Kelompok 4",
        FiscalGroup.PermanentBuilding => "Bangunan permanen",
        FiscalGroup.NonPermanentBuilding => "Bangunan tidak permanen",
        FiscalGroup.NotDepreciable => "Tidak disusutkan",
        _ => "Belum diklasifikasikan",
    };

    public sealed record YearCharge(int Year, int Months, decimal Opening, decimal Charge, decimal Closing);

    private static decimal Rupiah(decimal value) => Math.Round(value, 0, MidpointRounding.ToEven);

    /// <summary>
    /// Every year from acquisition until the asset is fully depreciated or
    /// disposed of. Empty for unclassified and non-depreciable assets.
    /// </summary>
    public static List<YearCharge> Schedule(FixedAsset asset)
    {
        var result = new List<YearCharge>();
        var life = LifeMonths(asset.FiscalGroup, asset.FiscalUsefulLifeMonths);
        if (life is null || asset.AcquisitionCost <= 0m) return result;

        var cost = asset.AcquisitionCost;
        var method = EffectiveMethod(asset.FiscalGroup, asset.FiscalMethod);
        var start = new DateOnly(asset.AcquisitionDate.Year, asset.AcquisitionDate.Month, 1);

        // Month offsets from the acquisition month that are depreciated: [0, end).
        var end = life.Value;
        if (asset.DisposalDate is { } disposed)
        {
            var disposalOffset = (disposed.Year - start.Year) * 12 + disposed.Month - start.Month;
            end = Math.Clamp(disposalOffset, 0, end);
        }
        var lifeEndsWithinSchedule = end == life.Value;

        var opening = cost;
        var monthsBefore = 0;
        for (var year = start.Year; monthsBefore < end; year++)
        {
            var firstOffset = (year - start.Year) * 12 - (start.Month - 1);
            var from = Math.Max(firstOffset, 0);
            var to = Math.Min(firstOffset + 12, end);
            var months = to - from;

            decimal charge;
            if (method == FiscalMethod.StraightLine)
            {
                charge = Rupiah(cost * to / life.Value) - Rupiah(cost * monthsBefore / life.Value);
            }
            else if (lifeEndsWithinSchedule && to == life.Value)
            {
                // The year the useful life ends takes what remains.
                charge = opening;
            }
            else
            {
                var rate = 2m * 12m / life.Value;
                charge = Math.Min(opening, Rupiah(opening * rate * months / 12m));
            }

            result.Add(new YearCharge(year, months, opening, charge, opening - charge));
            opening -= charge;
            monthsBefore = to;
        }

        return result;
    }

    /// <summary>Fiscal book value at the start of a year, and the charge in it.</summary>
    public static (decimal Opening, decimal Charge, decimal Closing) ForYear(FixedAsset asset, int year)
    {
        var schedule = Schedule(asset);
        var hit = schedule.FirstOrDefault(y => y.Year == year);
        if (hit is not null) return (hit.Opening, hit.Charge, hit.Closing);

        if (asset.FiscalGroup == FiscalGroup.NotDepreciable || schedule.Count == 0 || year < schedule[0].Year)
        {
            var value = year < asset.AcquisitionDate.Year ? 0m : asset.AcquisitionCost;
            return (value, 0m, value);
        }
        var last = schedule[^1].Closing;
        return (last, 0m, last);
    }
}
