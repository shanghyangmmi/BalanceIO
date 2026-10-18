using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AssetsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly AssetChargeService _assetCharge;
    private readonly FiscalDepreciationService _fiscal;
    private readonly IPeriodLockService _periodLock;

    public const string GainOnDisposalAccount = "7-3000";
    public const string LossOnDisposalAccount = "8-4000";

    public AssetsController(ApplicationDbContext context, AssetChargeService assetCharge, FiscalDepreciationService fiscal, IPeriodLockService periodLock)
    {
        _assetCharge = assetCharge;
        _context = context;
        _fiscal = fiscal;
        _periodLock = periodLock;
    }

    /// <summary>Buildings are straight line only; a longer life applies to permanent buildings only.</summary>
    private static void NormaliseFiscal(FixedAsset asset)
    {
        if (FiscalDepreciation.IsBuilding(asset.FiscalGroup)) asset.FiscalMethod = FiscalMethod.StraightLine;
        if (asset.FiscalGroup != FiscalGroup.PermanentBuilding) asset.FiscalUsefulLifeMonths = null;
    }

    // GET: api/assets/fiscal-depreciation?year=
    /// <summary>Tax depreciation for the year beside the commercial charge (Lampiran 1A).</summary>
    [HttpGet("fiscal-depreciation")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<FiscalDepreciationResponse>> GetFiscalDepreciation([FromQuery] int? year)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });
        return await _fiscal.ForYearAsync(_context.CurrentCompanyId.Value, year ?? DateTime.UtcNow.AddHours(7).Year);
    }

    // GET: api/assets/{id}/fiscal-schedule
    [HttpGet("{id}/fiscal-schedule")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<IActionResult> GetFiscalSchedule(Guid id)
    {
        var asset = await _context.FixedAssets.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (asset == null) return NotFound();
        return Ok(new
        {
            asset.FiscalGroup,
            GroupLabel = FiscalDepreciation.Label(asset.FiscalGroup),
            Method = FiscalDepreciation.EffectiveMethod(asset.FiscalGroup, asset.FiscalMethod),
            LifeYears = FiscalDepreciation.LifeMonths(asset.FiscalGroup, asset.FiscalUsefulLifeMonths) / 12,
            Years = FiscalDepreciation.Schedule(asset),
        });
    }

    // GET: api/assets
    [HttpGet]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<IEnumerable<FixedAsset>>> GetAll(
        [FromQuery] AssetStatus? status = null,
        [FromQuery] string? category = null)
    {
        var query = _context.FixedAssets
            .Include(a => a.AssetAccount)
            .Include(a => a.Category)
            .Include(a => a.Location)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(a => a.Status == status);

        if (!string.IsNullOrEmpty(category))
            query = query.Where(a => a.Category != null && a.Category.Name == category);

        var assets = await query
            .OrderBy(a => a.Code)
            .ToListAsync();

        return Ok(assets);
    }

    // GET: api/assets/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<FixedAsset>> GetById(Guid id)
    {
        var asset = await _context.FixedAssets
            .Include(a => a.AssetAccount)
            .Include(a => a.DepreciationAccount)
            .Include(a => a.AccumulatedDepreciationAccount)
            .Include(a => a.Category)
            .Include(a => a.Location)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asset == null)
            return NotFound();

        return Ok(asset);
    }

    // GET: api/assets/{id}/depreciation-schedule
    [HttpGet("{id}/depreciation-schedule")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<IEnumerable<AssetDepreciation>>> GetDepreciationSchedule(Guid id)
    {
        var schedule = await _context.AssetDepreciations
            .Where(d => d.FixedAssetId == id)
            .OrderBy(d => d.DepreciationDate)
            .ToListAsync();

        return Ok(schedule);
    }

    // GET: api/assets/categories
    [HttpGet("categories")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<IEnumerable<FixedAssetCategory>>> GetCategories()
    {
         // This endpoint might be redundant with FixedAssetCategoriesController, 
         // but keeping it for backward compatibility or simple lists if needed (returning entities now)
        var categories = await _context.FixedAssetCategories
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(categories);
    }

    // GET: api/assets/summary
    [HttpGet("summary")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<object>> GetSummary()
    {
        var assets = await _context.FixedAssets.ToListAsync();

        var summary = new
        {
            TotalAssets = assets.Count,
            ActiveAssets = assets.Count(a => a.Status == AssetStatus.Active),
            TotalAcquisitionCost = assets.Sum(a => a.AcquisitionCost),
            TotalAccumulatedDepreciation = assets.Sum(a => a.AccumulatedDepreciation),
            TotalBookValue = assets.Sum(a => a.BookValue),
            FullyDepreciated = assets.Count(a => a.Status == AssetStatus.FullyDepreciated),
            DisposedThisYear = assets.Count(a => 
                a.Status == AssetStatus.Disposed && 
                a.DisposalDate.HasValue && 
                a.DisposalDate.Value.Year == DateTime.UtcNow.Year)
        };

        return Ok(summary);
    }

    // POST: api/assets
    [HttpPost]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<ActionResult<FixedAsset>> Create(FixedAsset asset)
    {
        if (asset.Id == Guid.Empty)
            asset.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        asset.CompanyId = _context.CurrentCompanyId.Value;

        // Validate Category
        if (asset.CategoryId == null)
             return BadRequest("Category is required");

        var category = await _context.FixedAssetCategories.FindAsync(asset.CategoryId);
        if (category == null) return BadRequest("Invalid Category");

        // Generate code if not provided
        if (string.IsNullOrEmpty(asset.Code))
        {
            asset.Code = await GenerateAssetCode(category.CodePrefix);
        }

        if (asset.FiscalGroup == FiscalGroup.NotSet)
        {
            asset.FiscalGroup = category.DefaultFiscalGroup;
            asset.FiscalMethod = category.DefaultFiscalMethod;
        }
        NormaliseFiscal(asset);
        asset.DisposalJournalEntryId = null;

        // Initialize book value
        asset.BookValue = asset.AcquisitionCost - asset.ResidualValue;
        asset.AccumulatedDepreciation = 0;
        asset.CreatedAt = DateTime.UtcNow;
        asset.Status = AssetStatus.Active;

        _context.FixedAssets.Add(asset);

        // Audit log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "CREATE",
            TargetEntity = "FixedAsset:" + asset.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Created asset {asset.Code}: {asset.Name} with cost {asset.AcquisitionCost:N2}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = asset.Id }, asset);
    }

    // PUT: api/assets/{id}
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<IActionResult> Update(Guid id, FixedAsset asset)
    {
        if (id != asset.Id)
            return BadRequest("ID mismatch");

        var existing = await _context.FixedAssets.FindAsync(id);
        if (existing == null)
            return NotFound();

        if (existing.Status == AssetStatus.Disposed || existing.Status == AssetStatus.Sold)
            return BadRequest("Cannot edit disposed asset");

        existing.Name = asset.Name;
        existing.Description = asset.Description;
        existing.CategoryId = asset.CategoryId;
        existing.LocationId = asset.LocationId;
        existing.SerialNumber = asset.SerialNumber;
        existing.ResidualValue = asset.ResidualValue;
        existing.UsefulLifeMonths = asset.UsefulLifeMonths;
        existing.DepreciationMethod = asset.DepreciationMethod;
        existing.AssetAccountId = asset.AssetAccountId;
        existing.DepreciationAccountId = asset.DepreciationAccountId;
        existing.DepreciationAccountId = asset.DepreciationAccountId;
        existing.AccumulatedDepreciationAccountId = asset.AccumulatedDepreciationAccountId;
        existing.FiscalGroup = asset.FiscalGroup;
        existing.FiscalMethod = asset.FiscalMethod;
        existing.FiscalUsefulLifeMonths = asset.FiscalUsefulLifeMonths;
        NormaliseFiscal(existing);
        
        // Allow updating cost/valuation
        if (asset.AcquisitionCost != existing.AcquisitionCost)
        {
            existing.AcquisitionCost = asset.AcquisitionCost;
            // Recalculate Book Value: Cost - Accumulated
            existing.BookValue = existing.AcquisitionCost - existing.AccumulatedDepreciation;
        }

        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/assets/{id}/depreciate
    /// <summary>
    /// Depreciate one asset for the current period.
    ///
    /// This used to update the register and stop: no journal entry, no
    /// period lock. The charge never reached the ledger, which is how a
    /// module that exists to produce depreciation ended up producing none
    /// of it in the books.
    ///
    /// It now delegates to the same engine the period run uses, so a single
    /// asset and a whole run post identically.
    /// </summary>
    [HttpPost("{id}/depreciate")]
    [RequiresPermission(Permissions.AssetsDepreciate)]
    public async Task<ActionResult<AssetChargeRunResult>> RecordDepreciation(
        Guid id, [FromBody] DepreciateRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required." });

        // An arbitrary amount cannot be reconciled against the schedule, and
        // a charge that does not follow the useful life is a manual journal
        // entry wearing a depreciation label. Refused rather than honoured
        // quietly.
        if (request?.Amount is not null)
        {
            return BadRequest(new
            {
                error = "AMOUNT_NOT_ACCEPTED",
                message = "The charge is derived from the asset's useful life. Post a manual journal entry if you need a different amount.",
            });
        }

        var asset = await _context.FixedAssets
            .AsNoTracking()
            .Include(a => a.Category)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (asset == null) return NotFound();

        if (asset.Status != AssetStatus.Active)
            return BadRequest(new { error = "NOT_ACTIVE", message = "Only active assets carry a charge." });

        var intangible = asset.Category?.IsIntangible ?? false;
        var today = request?.Date ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        try
        {
            var result = await _assetCharge.RunAsync(
                _context.CurrentCompanyId.Value, today, intangible, onlyAssetId: id);

            return Ok(result);
        }
        catch (System.ComponentModel.DataAnnotations.ValidationException ex)
        {
            return BadRequest(new { error = "PERIOD_LOCKED", message = ex.Message });
        }
    }

    // POST: api/assets/{id}/dispose
    /// <summary>
    /// Takes the asset off the books: Dr accumulated depreciation, Dr the
    /// proceeds account for what was received, Cr the asset at cost, and the
    /// difference to Gain (7-3000) or Loss (8-4000) on Asset Disposal. It
    /// used to change the asset's status and post nothing, so cost and
    /// accumulated depreciation stayed in the ledger after the asset left.
    /// Depreciation must be charged up to the disposal first.
    /// </summary>
    [HttpPost("{id}/dispose")]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<IActionResult> Dispose(Guid id, [FromBody] DisposeRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });
        var companyId = _context.CurrentCompanyId.Value;

        var asset = await _context.FixedAssets.FindAsync(id);
        if (asset == null)
            return NotFound();

        if (asset.Status == AssetStatus.Disposed || asset.Status == AssetStatus.Sold || asset.Status == AssetStatus.WrittenOff)
            return BadRequest(new { code = "ALREADY_DISPOSED", message = "The asset has already been disposed of." });
        if (request.Amount < 0m)
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Proceeds cannot be negative." });
        if (request.Date < asset.AcquisitionDate)
            return BadRequest(new { code = "VALIDATION_FAILED", message = "The disposal date is before the acquisition date." });
        if (asset.LastDepreciationDate is { } charged && charged > request.Date)
            return BadRequest(new { code = "DEPRECIATED_PAST_DISPOSAL", message = $"Depreciation has been charged to {charged:yyyy-MM-dd}, after the disposal date. Reverse that charge first." });

        await _periodLock.ValidateTransactionDate(companyId, request.Date);

        var keys = new List<string> { GainOnDisposalAccount, LossOnDisposalAccount };
        if (asset.AssetAccountId is { } assetAccount) keys.Add(assetAccount.ToString());
        if (asset.AccumulatedDepreciationAccountId is { } accumulatedAccount) keys.Add(accumulatedAccount.ToString());
        if (!string.IsNullOrWhiteSpace(request.ProceedsAccountId)) keys.Add(request.ProceedsAccountId);
        var codes = await _context.ResolveAccountCodesAsync(companyId, keys);
        string? Code(string? key) => key is not null && codes.TryGetValue(key, out var code) ? code : null;

        var assetCode = Code(asset.AssetAccountId?.ToString());
        if (assetCode is null)
            return BadRequest(new { code = "MISSING_ACCOUNT", message = "The asset has no asset account; set it before disposing." });
        var accumulatedCode = Code(asset.AccumulatedDepreciationAccountId?.ToString());
        if (asset.AccumulatedDepreciation != 0m && accumulatedCode is null)
            return BadRequest(new { code = "MISSING_ACCOUNT", message = "The asset has accumulated depreciation but no accumulated depreciation account." });
        var proceedsCode = Code(request.ProceedsAccountId);
        if (request.Amount > 0m && proceedsCode is null)
            return BadRequest(new { code = "MISSING_ACCOUNT", message = "Choose the account that received the proceeds." });

        var bookValue = asset.AcquisitionCost - asset.AccumulatedDepreciation;
        var gain = request.Amount - bookValue;
        var gainCode = Code(gain > 0m ? GainOnDisposalAccount : LossOnDisposalAccount);
        if (gain != 0m && gainCode is null)
            return BadRequest(new { code = "MISSING_ACCOUNT", message = $"{(gain > 0m ? "Gain (7-3000)" : "Loss (8-4000)")} on Asset Disposal is missing from the chart of accounts." });

        var label = string.IsNullOrWhiteSpace(asset.Code) ? asset.Name : $"{asset.Code} {asset.Name}";
        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = request.Date,
            ReferenceNumber = $"DSP-{asset.Code}",
            Currency = "IDR",
            Notes = $"{(request.IsSale ? "Sale" : "Disposal")} of {label}{(string.IsNullOrWhiteSpace(request.Reason) ? "" : ": " + request.Reason.Trim())}",
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>(),
        };
        void Line(string account, string description, decimal debit, decimal credit) =>
            entry.Lines.Add(new JournalLine { Id = Guid.NewGuid(), AccountId = account, Description = description, Debit = debit, Credit = credit });

        if (asset.AccumulatedDepreciation != 0m)
            Line(accumulatedCode!, $"Accumulated depreciation, {label}", asset.AccumulatedDepreciation, 0m);
        if (request.Amount > 0m)
            Line(proceedsCode!, $"Proceeds, {label}", request.Amount, 0m);
        if (gain < 0m)
            Line(gainCode!, $"Loss on disposal, {label}", -gain, 0m);
        if (gain > 0m)
            Line(gainCode!, $"Gain on disposal, {label}", 0m, gain);
        Line(assetCode, $"Cost, {label}", 0m, asset.AcquisitionCost);
        _context.JournalEntries.Add(entry);

        asset.Status = request.IsSale ? AssetStatus.Sold : AssetStatus.Disposed;
        asset.DisposalDate = request.Date;
        asset.DisposalAmount = request.Amount;
        asset.DisposalReason = request.Reason;
        asset.DisposalJournalEntryId = entry.Id;
        asset.BookValue = 0m;
        asset.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.IsSale ? "SELL" : "DISPOSE",
            TargetEntity = "FixedAsset:" + id,
            Timestamp = DateTime.UtcNow,
            Details = $"Asset disposed. Proceeds {request.Amount:N2}, book value {bookValue:N2}, {(gain >= 0m ? "gain" : "loss")} {Math.Abs(gain):N2}. Reason: {request.Reason}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Asset disposed", journalEntryId = entry.Id, bookValue, gainOrLoss = gain });
    }

    // DELETE: api/assets/{id}
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var asset = await _context.FixedAssets.FindAsync(id);
        if (asset == null)
            return NotFound();

        // Check if has depreciation records
        var hasDepreciation = await _context.AssetDepreciations.AnyAsync(d => d.FixedAssetId == id);
        if (hasDepreciation)
            return BadRequest("Cannot delete asset with depreciation history. Dispose instead.");

        _context.FixedAssets.Remove(asset);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private decimal CalculateMonthlyDepreciation(FixedAsset asset)
    {
        var depreciableAmount = asset.AcquisitionCost - asset.ResidualValue;
        
        return asset.DepreciationMethod switch
        {
            DepreciationMethod.StraightLine => depreciableAmount / asset.UsefulLifeMonths,
            DepreciationMethod.DecliningBalance => asset.BookValue * (2m / asset.UsefulLifeMonths),
            DepreciationMethod.DoubleDecliningBalance => asset.BookValue * (2m / asset.UsefulLifeMonths) * 2,
            _ => depreciableAmount / asset.UsefulLifeMonths
        };
    }

    private async Task<string> GenerateAssetCode(string? category)
    {
        var prefix = category?.Length >= 3 ? category[..3].ToUpper() : "AST";
        var count = await _context.FixedAssets
            .CountAsync(a => a.Code.StartsWith(prefix));
        
        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }
}

public class DepreciateRequest
{
    public DateOnly Date { get; set; }
    public decimal? Amount { get; set; } // Optional, will calculate if not provided
}

public class DisposeRequest
{
    public DateOnly Date { get; set; }
    public decimal Amount { get; set; }
    public string? Reason { get; set; }
    public bool IsSale { get; set; }
    /// <summary>Account (Id or code) that received the proceeds; required when Amount is above zero.</summary>
    public string? ProceedsAccountId { get; set; }
}
