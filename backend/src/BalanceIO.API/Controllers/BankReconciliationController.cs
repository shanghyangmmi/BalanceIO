using System.Security.Claims;
using System.Text;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Bank Reconciliation Workspace Controller:
/// - Statement import (BCA, Mandiri, BRI, BNI, Generic CSV)
/// - Multi-pass automated matching & sign inversion
/// - 2-pane interactive matching workspace
/// - 1-click adjusting journal entry generation
/// - Formal statement of reconciliation finalization
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BankReconciliationController : ControllerBase
{
    private readonly BankReconciliationService _reconciliationService;

    public BankReconciliationController(BankReconciliationService reconciliationService)
    {
        _reconciliationService = reconciliationService;
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
            ?? "accountant@balanceio.id";
    }

    /// <summary>
    /// List all Cash & Bank accounts with GL balances and reconciliation status
    /// </summary>
    [HttpGet("accounts")]
    public async Task<ActionResult<List<BankAccountSummaryDto>>> GetAccountsSummary()
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var accounts = await _reconciliationService.GetAccountsSummaryAsync(companyId.Value);
        return Ok(accounts);
    }

    /// <summary>
    /// Load 2-pane reconciliation workspace for a specific bank account
    /// </summary>
    [HttpGet("workspace/{accountId}")]
    public async Task<ActionResult<BankReconciliationWorkspaceResponse>> GetWorkspace(
        Guid accountId, 
        [FromQuery] DateOnly? asOfDate = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        try
        {
            var workspace = await _reconciliationService.GetWorkspaceAsync(companyId.Value, accountId, asOfDate);
            return Ok(workspace);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Import and parse a bank statement CSV
    /// </summary>
    [HttpPost("import")]
    public async Task<ActionResult<StatementImportResponse>> ImportStatement([FromBody] StatementImportRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var result = await _reconciliationService.ImportStatementCsvAsync(companyId.Value, request);
        if (!result.Success)
        {
            return BadRequest(new { message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Run multi-pass automated matching against unmatched ledger entries
    /// </summary>
    [HttpPost("auto-match")]
    public async Task<ActionResult<AutoMatchResponse>> RunAutoMatch([FromBody] AutoMatchRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var result = await _reconciliationService.RunAutoMatchAsync(companyId.Value, request);
        return Ok(result);
    }

    /// <summary>
    /// Manually link a statement line to a GL journal line
    /// </summary>
    [HttpPost("match")]
    public async Task<ActionResult> ManualMatch([FromBody] ManualMatchRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        try
        {
            await _reconciliationService.ManualMatchAsync(companyId.Value, request);
            return Ok(new { success = true, message = "Line matched successfully." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Unlink a previously matched statement line
    /// </summary>
    [HttpPost("unmatch")]
    public async Task<ActionResult> Unmatch([FromBody] UnmatchRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        try
        {
            await _reconciliationService.UnmatchAsync(companyId.Value, request);
            return Ok(new { success = true, message = "Line unmatched successfully." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// 1-Click GL adjustment posting for unrecorded bank fee or interest income
    /// </summary>
    [HttpPost("post-adjustment")]
    public async Task<ActionResult<PostBankAdjustmentResponse>> PostBankAdjustment([FromBody] PostBankAdjustmentRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        try
        {
            var result = await _reconciliationService.PostBankAdjustmentAsync(companyId.Value, request, GetCurrentUserEmail());
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Finalize and lock formal bank reconciliation session
    /// </summary>
    [HttpPost("finalize")]
    public async Task<ActionResult<FinalizeReconciliationResponse>> FinalizeReconciliation([FromBody] FinalizeReconciliationRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var result = await _reconciliationService.FinalizeReconciliationAsync(companyId.Value, request, GetCurrentUserEmail());
        if (!result.Success)
        {
            return BadRequest(new { message = result.Message });
        }

        return Ok(result);
    }

    /// <summary>
    /// Download sample statement CSV templates (Generic, BCA, Mandiri)
    /// </summary>
    [HttpGet("sample-template")]
    public IActionResult DownloadSampleTemplate([FromQuery] string format = "generic")
    {
        var sb = new StringBuilder();

        if (format.ToLowerInvariant() == "bca")
        {
            sb.AppendLine("Tanggal,Keterangan,Cabang,Jumlah,Tipe,Saldo");
            sb.AppendLine("01/08/2026,\"TRSF E-BANKING CR 0108/FTSCY/WS95011 1234567890 SAMUEL\",0000,\"15.000.000,00\",CR,\"65.000.000,00\"");
            sb.AppendLine("02/08/2026,\"BIAYA ADM\",0000,\"15.000,00\",DB,\"64.985.000,00\"");
            sb.AppendLine("05/08/2026,\"BI-FAST DB KE 00812345678 PT MAJU JAYA\",0000,\"5.500.000,00\",DB,\"59.485.000,00\"");
            sb.AppendLine("31/08/2026,\"BUNGA JASA GIRO\",0000,\"250.000,00\",CR,\"59.735.000,00\"");
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "sample_statement_bca.csv");
        }
        else if (format.ToLowerInvariant() == "mandiri")
        {
            sb.AppendLine("Posting Date,Value Date,Reference No,Description,Debit,Credit,Balance");
            sb.AppendLine("01/08/2026,01/08/2026,REF001,\"TRANSFER DARI PT BERKAH\",0,\"25.000.000,00\",\"75.000.000,00\"");
            sb.AppendLine("03/08/2026,03/08/2026,REF002,\"PEMBAYARAN VENDOR ABC\",\"10.000.000,00\",0,\"65.000.000,00\"");
            sb.AppendLine("31/08/2026,31/08/2026,REF003,\"ADMIN BULANAN\",\"25.000,00\",0,\"64.975.000,00\"");
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "sample_statement_mandiri.csv");
        }
        else
        {
            sb.AppendLine("Date,Description,Reference,Debit,Credit,Balance");
            sb.AppendLine("2026-08-01,\"Customer Receipt VA 9882345678\",REC-001,0,\"12.500.000,00\",\"50.000.000,00\"");
            sb.AppendLine("2026-08-05,\"Supplier Payment\",PAY-001,\"4.200.000,00\",0,\"45.800.000,00\"");
            sb.AppendLine("2026-08-10,\"Monthly Bank Administration Fee\",BANK-FEE,\"15.000,00\",0,\"45.785.000,00\"");
            sb.AppendLine("2026-08-31,\"Interest Earned\",INT-001,0,\"185.000,00\",\"45.970.000,00\"");
            return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "sample_statement_generic.csv");
        }
    }
}
