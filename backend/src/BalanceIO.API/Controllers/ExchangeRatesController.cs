using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Exchange Rates Controller:
/// - Daily Bank Indonesia JISDOR & Middle Rates
/// - Weekly Kurs Pajak (KMK Kemenkeu) with Decree Numbers & Validity Date Spans
/// - Dual Rate single-call lookup for Invoices & Faktur Pajak
/// - PSAK 221 Period-End Monetary Retranslation Engine
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExchangeRatesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IExchangeRateService _exchangeRateService;
    private readonly IPeriodLockService _periodLockService;

    public ExchangeRatesController(
        ApplicationDbContext context,
        IExchangeRateService exchangeRateService,
        IPeriodLockService periodLockService)
    {
        _context = context;
        _exchangeRateService = exchangeRateService;
        _periodLockService = periodLockService;
    }

    private Guid? GetCurrentCompanyId()
    {
        var companyIdClaim = User.FindFirst("CompanyId")?.Value 
                          ?? User.FindFirst("company_id")?.Value
                          ?? Request.Headers["X-Company-Id"].FirstOrDefault();
        return Guid.TryParse(companyIdClaim, out var id) ? id : null;
    }

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.Identity?.Name 
            ?? "user@balanceio.id";
    }

    /// <summary>
    /// Get all exchange rates, optionally filtered by date, currency, and rate type
    /// </summary>
    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<ExchangeRate>>> GetRates(
        [FromQuery] DateOnly? date = null,
        [FromQuery] string? currency = null,
        [FromQuery] ExchangeRateType? rateType = null,
        [FromQuery] int limit = 100)
    {
        var query = _context.ExchangeRates.AsQueryable();

        if (date.HasValue)
        {
            if (rateType == ExchangeRateType.KursPajak_KMK)
            {
                query = query.Where(r => r.RateDate == date.Value || (r.ValidFrom <= date.Value && r.ValidTo >= date.Value));
            }
            else
            {
                query = query.Where(r => r.RateDate == date.Value);
            }
        }

        if (rateType.HasValue)
        {
            query = query.Where(r => r.RateType == rateType.Value);
        }

        if (!string.IsNullOrEmpty(currency) && currency != "all")
        {
            query = query.Where(r => r.FromCurrency == currency.ToUpper());
        }

        var rates = await query
            .OrderByDescending(r => r.RateDate)
            .ThenBy(r => r.FromCurrency)
            .Take(limit)
            .ToListAsync();

        return Ok(rates);
    }

    /// <summary>
    /// Get exchange rate for specific date, currency, and optional rate type
    /// </summary>
    [HttpGet("{date}/{currency}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<ExchangeRate>> GetRate(DateOnly date, string currency, [FromQuery] ExchangeRateType? rateType = null)
    {
        var rate = await _exchangeRateService.GetRateAsync(date, currency, "IDR", rateType);
        if (rate == null)
            return NotFound($"No rate found for {currency}/IDR on {date}");

        return Ok(rate);
    }

    /// <summary>
    /// Dual rate lookup: returns both Kurs BI (JISDOR) and Kurs Pajak (KMK) in one payload
    /// </summary>
    [HttpGet("dual/{date}/{currency}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<DualExchangeRateDto>> GetDualRates(DateOnly date, string currency)
    {
        var dual = await _exchangeRateService.GetDualRatesAsync(date, currency);
        return Ok(dual);
    }

    /// <summary>
    /// List historical KMK weekly decrees
    /// </summary>
    [HttpGet("kmk-decrees")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<List<KmkDecreeDto>>> GetKmkDecrees()
    {
        var decrees = await _exchangeRateService.GetKmkDecreesAsync();
        return Ok(decrees);
    }

    /// <summary>
    /// Get middle rate for accounting calculations
    /// </summary>
    [HttpGet("middle/{date}/{currency}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<decimal>> GetMiddleRate(DateOnly date, string currency)
    {
        try
        {
            var rate = await _exchangeRateService.GetMiddleRateAsync(date, currency);
            return Ok(rate);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Sync official Bank Indonesia rates (JISDOR / Middle Series)
    /// </summary>
    [HttpPost("sync/bi")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult<SyncResult>> SyncBIRates([FromQuery] DateOnly? date = null)
    {
        var result = await _exchangeRateService.SyncRatesFromBIAsync(date);
        
        if (result.Success)
            return Ok(result);
        
        return StatusCode(503, result);
    }

    /// <summary>
    /// Sync weekly Kurs Pajak from Kemenkeu (KMK)
    /// </summary>
    [HttpPost("sync/kmk")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult<SyncResult>> SyncKMKRates([FromQuery] DateOnly? date = null)
    {
        var result = await _exchangeRateService.SyncRatesFromKMKAsync(date);
        
        if (result.Success)
            return Ok(result);
        
        return StatusCode(503, result);
    }

    /// <summary>
    /// Sync all exchange rates (both BI and KMK)
    /// </summary>
    [HttpPost("sync")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult> SyncAllRates([FromQuery] DateOnly? date = null)
    {
        var biResult = await _exchangeRateService.SyncRatesFromBIAsync(date);
        var kmkResult = await _exchangeRateService.SyncRatesFromKMKAsync(date);
        
        return Ok(new { 
            bi = biResult,
            kmk = kmkResult,
            success = biResult.Success || kmkResult.Success
        });
    }

    /// <summary>
    /// Manually create or update an exchange rate with provenance
    /// </summary>
    [HttpPost]
    [RequiresPermission(Permissions.FinanceEdit)]
    [HttpPost("manual")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult<ExchangeRate>> CreateManualRate([FromBody] ExchangeRateDto dto)
    {
        var user = GetCurrentUserEmail();
        var rate = new ExchangeRate
        {
            RateDate = dto.RateDate,
            FromCurrency = dto.FromCurrency.ToUpper(),
            ToCurrency = dto.ToCurrency?.ToUpper() ?? "IDR",
            BuyRate = dto.BuyRate,
            SellRate = dto.SellRate,
            MiddleRate = dto.MiddleRate > 0 ? dto.MiddleRate : (dto.BuyRate + dto.SellRate) / 2m,
            RateType = dto.RateType,
            Notes = dto.Notes,
            Provenance = $"Manual Entry by {user}",
            CreatedBy = user
        };

        try
        {
            var result = await _exchangeRateService.UpsertManualRateAsync(rate);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing exchange rate manually
    /// </summary>
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult<ExchangeRate>> UpdateRate(Guid id, [FromBody] ExchangeRateDto dto)
    {
        var existing = await _context.ExchangeRates.FindAsync(id);
        if (existing == null)
            return NotFound();

        if (existing.IsLockedByPostedEntry)
        {
            return BadRequest(new { message = "Cannot edit an exchange rate that has been referenced by posted transactions." });
        }

        var user = GetCurrentUserEmail();
        existing.BuyRate = dto.BuyRate;
        existing.SellRate = dto.SellRate;
        existing.MiddleRate = dto.MiddleRate > 0 ? dto.MiddleRate : (dto.BuyRate + dto.SellRate) / 2m;
        existing.RateType = dto.RateType;
        existing.Notes = dto.Notes;
        existing.Source = ExchangeRateSource.Manual;
        existing.Provenance = $"Manual edit by {user}";
        existing.UpdatedAt = DateTime.UtcNow;
        existing.UpdatedBy = user;

        await _context.SaveChangesAsync();
        return Ok(existing);
    }

    /// <summary>
    /// Delete an exchange rate
    /// </summary>
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult> DeleteRate(Guid id)
    {
        var rate = await _context.ExchangeRates.FindAsync(id);
        if (rate == null)
            return NotFound();

        if (rate.IsLockedByPostedEntry)
        {
            return BadRequest(new { message = "Cannot delete an exchange rate locked by posted entries." });
        }

        _context.ExchangeRates.Remove(rate);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    /// <summary>
    /// Previews PSAK 221 period-end monetary balance retranslation
    /// </summary>
    [HttpPost("retranslate/preview")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<RetranslationPreviewDto>> PreviewRetranslation([FromBody] RetranslationPreviewRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var preview = await _exchangeRateService.PreviewRetranslationAsync(companyId.Value, request.AsOfDate, request.Currency);
        return Ok(preview);
    }

    /// <summary>
    /// Posts PSAK 221 period-end revaluation journal entry to General Ledger
    /// </summary>
    [HttpPost("retranslate/post")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<RetranslationPostResult>> PostRetranslation([FromBody] RetranslationPostRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        try
        {
            await _periodLockService.ValidateTransactionDate(companyId.Value, request.AsOfDate);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var result = await _exchangeRateService.PostRetranslationJournalAsync(companyId.Value, request, GetCurrentUserEmail());
        if (!result.Success)
        {
            return BadRequest(new { message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get supported currencies
    /// </summary>
    [HttpGet("currencies")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<Currency>>> GetCurrencies()
    {
        var currencies = await _context.Currencies
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Code)
            .ToListAsync();

        return Ok(currencies);
    }
}

public class ExchangeRateDto
{
    public DateOnly RateDate { get; set; }
    public string FromCurrency { get; set; } = "USD";
    public string? ToCurrency { get; set; } = "IDR";
    public decimal BuyRate { get; set; }
    public decimal SellRate { get; set; }
    public decimal MiddleRate { get; set; }
    public ExchangeRateType RateType { get; set; } = ExchangeRateType.Manual;
    public string? Notes { get; set; }
}

public class RetranslationPreviewRequest
{
    public DateOnly AsOfDate { get; set; }
    public string Currency { get; set; } = "USD";
}
