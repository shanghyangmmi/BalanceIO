using System.Globalization;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The periodic charge against the asset register, and the journal entry
/// it produces. Depreciation for tangible assets, amortisation for
/// intangible ones — one machine, two configurations.
///
/// Depreciation used to be a different machine: AssetsController updated
/// the register and stopped, so the charge never reached the ledger. A
/// module whose claim to a place in this product is that it posts to the
/// general ledger has to post. Both classes now run through here.
///
/// Straight line only, and deliberately so. A declining balance without
/// the reporting to support it would be a trap; this reads the useful life
/// rather than the method on the category.
///
/// Every posting is exact decimal arithmetic with Bankers rounding, the
/// final period takes the remainder so the asset lands exactly on its
/// residual value, and the entry balances to the cent before it is saved.
/// </summary>
public class AssetChargeService
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLock;

    public AssetChargeService(ApplicationDbContext context, IPeriodLockService periodLock)
    {
        _context = context;
        _periodLock = periodLock;
    }

    /// <summary>
    /// The two words, kept in one place. Everything a reader sees — the
    /// entry reference, the line descriptions, the audit row, the reason a
    /// run refused — comes from here, so the two classes cannot drift into
    /// describing themselves differently.
    /// </summary>
    private sealed record Vocabulary(
        string Kind, string Noun, string Verb, string Adjective, string Prefix);

    private static Vocabulary Words(bool intangible) => intangible
        ? new("amortisation", "Amortisation", "Amortised", "intangible", "AMT")
        : new("depreciation", "Depreciation", "Depreciated", "tangible", "DEP");

    /// <summary>The charge posts on the last day of the period.</summary>
    private static DateOnly PostingDateFor(DateOnly today) =>
        new DateOnly(today.Year, today.Month, 1).AddMonths(1).AddDays(-1);

    public async Task<AssetChargeOverviewResponse> GetAsync(Guid companyId, DateOnly today, bool intangible)
    {
        var currency = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.Currency)
            .FirstOrDefaultAsync() ?? "IDR";

        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var postingDate = PostingDateFor(today);

        var words = Words(intangible);

        var hasIntangibleCategories = await _context.FixedAssetCategories
            .AsNoTracking()
            .AnyAsync(c => c.CompanyId == companyId && c.IsIntangible);

        var rows = await LoadAsync(companyId, intangible);

        var response = new AssetChargeOverviewResponse
        {
            CompanyId               = companyId,
            Currency                = currency,
            GeneratedAt             = DateTime.UtcNow,
            Period                  = today.ToString("MMMM yyyy", CultureInfo.InvariantCulture),
            PostingDate             = postingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            HasIntangibleCategories = hasIntangibleCategories,
            Kind                    = words.Kind,
        };

        foreach (var row in rows)
        {
            var charge = MonthlyCharge(row.Asset);
            var due    = row.Asset.LastDepreciationDate is null
                      || row.Asset.LastDepreciationDate < periodStart;

            response.Assets.Add(new ChargeableAsset
            {
                Id                      = row.Asset.Id,
                Code                    = string.IsNullOrWhiteSpace(row.Asset.Code) ? null : row.Asset.Code,
                Name                    = row.Asset.Name,
                Category                = row.CategoryName,
                UsefulLifeMonths        = row.Asset.UsefulLifeMonths,
                AcquisitionCost         = row.Asset.AcquisitionCost,
                AccumulatedCharge = row.Asset.AccumulatedDepreciation,
                CarryingAmount          = row.Asset.BookValue,
                MonthlyCharge           = charge,
                LastChargedDate       = row.Asset.LastDepreciationDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Due                     = due && charge > 0m,
                Blocker                 = BlockerFor(row.Asset, charge, words),
            });
        }

        response.Totals = new AssetChargeTotals
        {
            Assets                  = response.Assets.Count,
            Due                     = response.Assets.Count(a => a.Due && a.Blocker is null),
            AcquisitionCost         = response.Assets.Sum(a => a.AcquisitionCost),
            AccumulatedCharge = response.Assets.Sum(a => a.AccumulatedCharge),
            CarryingAmount          = response.Assets.Sum(a => a.CarryingAmount),
            DueThisPeriod           = response.Assets.Where(a => a.Due && a.Blocker is null).Sum(a => a.MonthlyCharge),
        };

        // ── would a run refuse? ───────────────────────────────────────
        if (intangible && !hasIntangibleCategories)
        {
            response.Blockers.Add("No asset category is marked as intangible, so there is nothing to amortise.");
        }
        else if (response.Assets.Count == 0)
        {
            response.Blockers.Add($"No active {words.Adjective} asset is on the register.");
        }
        else if (response.Totals.Due == 0)
        {
            // "Every asset is charged through August" is false while assets
            // sit blocked: those are not charged, they are unchargeable. The
            // first version of this said it anyway, because Due excludes
            // blocked assets and the message only read the count.
            var blocked = response.Assets.Count(a => a.Blocker is not null);

            if (blocked > 0)
            {
                response.Blockers.Add(blocked == 1
                    ? $"1 {words.Adjective} asset cannot be charged at all — see the reason against it below."
                    : $"{blocked} {words.Adjective} assets cannot be charged at all — see the reasons against them below.");

                var chargeable = response.Assets.Count - blocked;
                if (chargeable > 0)
                {
                    response.Blockers.Add(
                        $"The other {chargeable} {(chargeable == 1 ? "is" : "are")} {words.Verb.ToLowerInvariant()} through {response.Period}.");
                }
            }
            else
            {
                response.Blockers.Add(
                    $"Nothing is due. Every {words.Adjective} asset is {words.Verb.ToLowerInvariant()} through {response.Period}.");
            }
        }

        var lockDate = await _context.Companies
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => c.LockDate)
            .FirstOrDefaultAsync();

        if (lockDate.HasValue && postingDate <= lockDate.Value)
        {
            response.Blockers.Add(string.Format(CultureInfo.InvariantCulture,
                "{0:d MMM yyyy} falls inside the locked period, which ends {1:d MMM yyyy}.",
                postingDate, lockDate.Value));
        }

        return response;
    }

    public async Task<AssetChargeRunResult> RunAsync(Guid companyId, DateOnly today, bool intangible, Guid? onlyAssetId = null)
    {
        var words       = Words(intangible);
        var periodStart = new DateOnly(today.Year, today.Month, 1);
        var postingDate = PostingDateFor(today);

        // Throws ValidationException, which the controller turns into a 400.
        // Amortisation is a posting like any other and does not get to walk
        // into a closed period.
        await _periodLock.ValidateTransactionDate(companyId, postingDate);

        var result = new AssetChargeRunResult
        {
            Period      = today.ToString("MMMM yyyy", CultureInfo.InvariantCulture),
            PostingDate = postingDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        };

        var rows = await LoadAsync(companyId, intangible, tracked: true);

        if (onlyAssetId.HasValue)
        {
            rows = rows.Where(r => r.Asset.Id == onlyAssetId.Value).ToList();
        }

        // Account codes, because JournalLine.AccountId holds the code rather
        // than the id. Resolved once for every account the run touches.
        var accountIds = rows
            .SelectMany(r => new[] { r.Asset.DepreciationAccountId, r.Asset.AccumulatedDepreciationAccountId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var codeById = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId && accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.Code);

        var lines = new List<JournalLine>();
        var postings = new List<AssetDepreciation>();
        decimal total = 0m;

        foreach (var row in rows)
        {
            var asset  = row.Asset;
            var charge = MonthlyCharge(asset);

            var blocker = BlockerFor(asset, charge, words);
            if (blocker is not null)
            {
                result.Skipped.Add($"{Label(asset)}: {blocker}");
                continue;
            }

            if (asset.LastDepreciationDate is not null && asset.LastDepreciationDate >= periodStart)
            {
                result.Skipped.Add($"{Label(asset)}: {words.Verb.ToLowerInvariant()} for {result.Period} already.");
                continue;
            }

            // The last period takes whatever is left, so the carrying amount
            // lands exactly on the residual value instead of a rounding tail.
            var remaining = asset.AcquisitionCost - asset.ResidualValue - asset.AccumulatedDepreciation;
            if (charge > remaining) charge = remaining;

            asset.AccumulatedDepreciation += charge;
            asset.BookValue = asset.AcquisitionCost - asset.AccumulatedDepreciation;
            asset.LastDepreciationDate = postingDate;
            asset.UpdatedAt = DateTime.UtcNow;

            if (asset.AccumulatedDepreciation >= asset.AcquisitionCost - asset.ResidualValue)
            {
                asset.Status = AssetStatus.FullyDepreciated;
            }

            postings.Add(new AssetDepreciation
            {
                Id                 = Guid.NewGuid(),
                FixedAssetId       = asset.Id,
                DepreciationDate   = postingDate,
                DepreciationAmount = charge,
                AccumulatedAmount  = asset.AccumulatedDepreciation,
                BookValueAfter     = asset.BookValue,
                CreatedAt          = DateTime.UtcNow,
            });

            lines.Add(new JournalLine
            {
                Id          = Guid.NewGuid(),
                AccountId   = codeById[asset.DepreciationAccountId!.Value],
                Description = $"{words.Noun} — {Label(asset)}",
                Debit       = charge,
                Credit      = 0m,
            });

            lines.Add(new JournalLine
            {
                Id          = Guid.NewGuid(),
                AccountId   = codeById[asset.AccumulatedDepreciationAccountId!.Value],
                Description = $"Accumulated {words.Kind} — {Label(asset)}",
                Debit       = 0m,
                Credit      = charge,
            });

            total += charge;
            result.AssetsCharged++;
        }

        if (result.AssetsCharged == 0)
        {
            return result;
        }

        // Exact, never a tolerance. If this ever trips, the run is abandoned
        // rather than posting an unbalanced entry.
        if (lines.Sum(l => l.Debit) != lines.Sum(l => l.Credit))
        {
            throw new InvalidOperationException(
                $"{words.Noun} run produced an unbalanced entry; nothing was posted.");
        }

        var entry = new JournalEntry
        {
            Id              = Guid.NewGuid(),
            CompanyId       = companyId,
            Date            = postingDate,
            ReferenceNumber = $"{words.Prefix}-{postingDate:yyyyMM}",
            Notes           = $"{words.Noun} of {words.Adjective} assets for {result.Period}.",
            Currency        = "IDR",
            Status          = JournalEntryStatus.Posted,
            IsAdjustingEntry = true,
            CreatedAt       = DateTime.UtcNow,
            Lines           = lines,
        };

        foreach (var posting in postings) posting.JournalEntryId = entry.Id;

        _context.JournalEntries.Add(entry);
        _context.AssetDepreciations.AddRange(postings);

        _context.AuditLogs.Add(new AuditLog
        {
            Id           = Guid.NewGuid(),
            Action       = intangible ? "AMORTISE" : "DEPRECIATE",
            TargetEntity = $"JournalEntry:{entry.Id}",
            Timestamp    = DateTime.UtcNow,
            Details      = $"{words.Verb} {result.AssetsCharged} {words.Adjective} asset(s) for {result.Period}, total {total:N2}.",
        });

        await _context.SaveChangesAsync();

        result.TotalCharge      = total;
        result.JournalEntryId   = entry.Id;
        result.JournalReference = entry.ReferenceNumber;

        return result;
    }

    // ── shared ────────────────────────────────────────────────────────

    private record AssetRow(FixedAsset Asset, string? CategoryName);

    private async Task<List<AssetRow>> LoadAsync(Guid companyId, bool intangible, bool tracked = false)
    {
        // An asset with no category is tangible by default. That is the
        // conservative reading: amortisation is the exception and has to be
        // declared, so an uncategorised asset never silently amortises.
        var query = _context.FixedAssets
            .Where(a => a.CompanyId == companyId
                     && a.Status == AssetStatus.Active
                     && (intangible
                            ? a.CategoryId != null && a.Category!.IsIntangible
                            : a.CategoryId == null || !a.Category!.IsIntangible));

        if (!tracked) query = query.AsNoTracking();

        var assets = await query
            .Include(a => a.Category)
            .OrderBy(a => a.Code)
            .ToListAsync();

        return assets.Select(a => new AssetRow(a, a.Category?.Name)).ToList();
    }

    /// <summary>
    /// Straight line over the useful life, to the rupiah, Bankers rounding.
    /// </summary>
    private static decimal MonthlyCharge(FixedAsset asset)
    {
        if (asset.UsefulLifeMonths <= 0) return 0m;

        var amortisable = asset.AcquisitionCost - asset.ResidualValue;
        if (amortisable <= 0m) return 0m;

        var remaining = amortisable - asset.AccumulatedDepreciation;
        if (remaining <= 0m) return 0m;

        var monthly = Math.Round(
            amortisable / asset.UsefulLifeMonths, 2, MidpointRounding.ToEven);

        return monthly > remaining ? remaining : monthly;
    }

    private static string? BlockerFor(FixedAsset asset, decimal charge, Vocabulary words)
    {
        if (asset.DepreciationAccountId is null || asset.AccumulatedDepreciationAccountId is null)
            return $"no {words.Kind} account set, so the entry has nowhere to post";

        if (asset.UsefulLifeMonths <= 0)
            return "useful life is zero";

        if (charge <= 0m)
            return "already written down to its residual value";

        return null;
    }

    private static string Label(FixedAsset asset) =>
        string.IsNullOrWhiteSpace(asset.Code) ? asset.Name : $"{asset.Code} {asset.Name}";
}
