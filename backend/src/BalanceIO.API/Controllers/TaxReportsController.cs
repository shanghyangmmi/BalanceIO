using System.Security.Claims;
using System.Text;
using BalanceIO.API.DTOs;
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

    public TaxReportsController(TaxReportsService taxReportsService)
    {
        _taxReportsService = taxReportsService;
    }

    private Guid? GetCurrentCompanyId()
    {
        var claim = User.FindFirst("CompanyId")?.Value 
                 ?? User.FindFirst("company_id")?.Value
                 ?? Request.Headers["X-Company-Id"].FirstOrDefault();
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.Identity?.Name 
            ?? "tax@balanceio.id";
    }

    /// <summary>
    /// Get SPT Masa PPN 1111 (Induk, Form AB, Form A2, Form B2/B3)
    /// </summary>
    [HttpGet("spt-ppn-1111")]
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
}
