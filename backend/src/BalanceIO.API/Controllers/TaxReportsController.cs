using System.Security.Claims;
using System.Text;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Indonesian Tax Reports & Statutory Filings Controller:
/// - SPT Masa PPN 1111 (Induk, Form AB, Form A2, Form B2/B3)
/// - Potput Withholding Taxes (PPh 21 TER, PPh 23, PPh 4(2), PPh 22)
/// - e-Faktur DJP CSV Export
/// - e-Bupot Unifikasi CSV / XML Export
/// - Period PPN Settlement Journal Posting
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TaxReportsController : ControllerBase
{
    private readonly TaxReportsService _taxReportsService;
    private readonly ApplicationDbContext _context;

    public TaxReportsController(TaxReportsService taxReportsService, ApplicationDbContext context)
    {
        _taxReportsService = taxReportsService;
        _context = context;
    }

    private Guid? GetCurrentCompanyId() => _context.CurrentCompanyId;

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? "unknown";
    }

    /// <summary>
    /// Get SPT Masa PPN 1111 (Induk, Form AB, Form A2, Form B2/B3)
    /// </summary>
    [HttpGet("spt-ppn-1111")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<SptPpn1111Response>> GetSptPpn1111(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GetSptPpn1111Async(companyId.Value, y, m);
        return Ok(result);
    }

    /// <summary>
    /// Get Withholding Tax Summaries (PPh 21 TER, PPh 23, PPh 4(2), PPh 22)
    /// </summary>
    [HttpGet("withholding-summary")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<WithholdingSummaryResponse>> GetWithholdingSummary(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] string? taxType = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GetWithholdingSummaryAsync(companyId.Value, y, m, taxType);
        return Ok(result);
    }

    /// <summary>
    /// Download DJP e-Faktur CSV import file format
    /// </summary>
    [HttpGet("efaktur-csv")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<IActionResult> DownloadEFakturCsv(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateEFakturCsvAsync(companyId.Value, y, m);
        var bytes = Encoding.UTF8.GetBytes(result.CsvContent);

        return File(bytes, "text/csv", result.FileName);
    }

    /// <summary>
    /// Get e-Faktur CSV preview payload
    /// </summary>
    [HttpGet("efaktur-preview")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<EFakturCsvExportResponse>> GetEFakturPreview(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateEFakturCsvAsync(companyId.Value, y, m);
        return Ok(result);
    }

    /// <summary>
    /// Download DJP e-Bupot Unifikasi CSV / XML export file format
    /// </summary>
    [HttpGet("ebupot-export")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<IActionResult> DownloadEBupotExport(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] string taxType = "pph23")
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateEBupotExportAsync(companyId.Value, y, m, taxType);
        var bytes = Encoding.UTF8.GetBytes(result.ExportContent);

        return File(bytes, result.ContentType, result.FileName);
    }

    /// <summary>
    /// Get e-Bupot export preview payload
    /// </summary>
    [HttpGet("ebupot-preview")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<EBupotExportResponse>> GetEBupotPreview(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] string taxType = "pph23")
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateEBupotExportAsync(companyId.Value, y, m, taxType);
        return Ok(result);
    }

    /// <summary>
    /// Post the monthly PPN settlement journal entry (Closes period PPN Keluaran & PPN Masukan)
    /// </summary>
    [HttpPost("settle-ppn")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<PpnSettlementResult>> PostPpnSettlement([FromBody] PpnSettlementPostRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var result = await _taxReportsService.PostPpnSettlementJournalAsync(companyId.Value, request, GetCurrentUserEmail());
        if (!result.Success)
        {
            return BadRequest(new { message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Get allocated NSFP ranges for company
    /// </summary>
    [HttpGet("nsfp-ranges")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<List<TaxInvoiceNumberRangeDto>>> GetNsfpRanges([FromQuery] int? year = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var ranges = await _taxReportsService.GetNsfpRangesAsync(companyId.Value, year);
        return Ok(ranges);
    }

    /// <summary>
    /// Add allocated NSFP range from DJP Online / e-Nofa
    /// </summary>
    [HttpPost("nsfp-ranges")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<TaxInvoiceNumberRangeDto>> CreateNsfpRange([FromBody] CreateTaxInvoiceNumberRangeRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        try
        {
            var range = await _taxReportsService.CreateNsfpRangeAsync(companyId.Value, request);
            return Ok(range);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete NSFP range
    /// </summary>
    [HttpDelete("nsfp-ranges/{id}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> DeleteNsfpRange(Guid id)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var deleted = await _taxReportsService.DeleteNsfpRangeAsync(companyId.Value, id);
        if (!deleted) return NotFound();

        return NoContent();
    }

    /// <summary>
    /// Get Coretax XML / CSV export preview
    /// </summary>
    [HttpGet("coretax-export")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<CoretaxExportResponse>> GetCoretaxExport(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateCoretaxExportAsync(companyId.Value, y, m);
        return Ok(result);
    }

    /// <summary>
    /// Download Coretax XML bulk upload file
    /// </summary>
    [HttpGet("coretax-export/download-xml")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<IActionResult> DownloadCoretaxXml(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateCoretaxExportAsync(companyId.Value, y, m);
        var bytes = Encoding.UTF8.GetBytes(result.XmlContent);

        return File(bytes, "application/xml", $"{result.FileName}.xml");
    }

    /// <summary>
    /// Download Coretax CSV bulk upload file
    /// </summary>
    [HttpGet("coretax-export/download-csv")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<IActionResult> DownloadCoretaxCsv(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var y = year ?? today.Year;
        var m = month ?? today.Month;

        var result = await _taxReportsService.GenerateCoretaxExportAsync(companyId.Value, y, m);
        var bytes = Encoding.UTF8.GetBytes(result.CsvContent);

        return File(bytes, "text/csv", $"{result.FileName}.csv");
    }
}
