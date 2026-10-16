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

    public AssetsController(ApplicationDbContext context, AssetChargeService assetCharge)
    {
        _assetCharge = assetCharge;
        _context = context;
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
    [HttpPost("{id}/dispose")]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<IActionResult> Dispose(Guid id, [FromBody] DisposeRequest request)
    {
        var asset = await _context.FixedAssets.FindAsync(id);
        if (asset == null)
            return NotFound();

        if (asset.Status == AssetStatus.Disposed || asset.Status == AssetStatus.Sold)
            return BadRequest("Asset already disposed");

        asset.Status = request.IsSale ? AssetStatus.Sold : AssetStatus.Disposed;
        asset.DisposalDate = request.Date;
        asset.DisposalAmount = request.Amount;
        asset.DisposalReason = request.Reason;
        asset.UpdatedAt = DateTime.UtcNow;

        // Audit log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = request.IsSale ? "SELL" : "DISPOSE",
            TargetEntity = "FixedAsset:" + id,
            Timestamp = DateTime.UtcNow,
            Details = $"Asset disposed. Amount: {request.Amount:N2}. Reason: {request.Reason}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Asset disposed successfully" });
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
}
