using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/documents")]
public class DocumentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IDocumentHistoryService _historyService;
    private readonly IPermissionService _permissionService;

    public DocumentsController(
        ApplicationDbContext context,
        IDocumentHistoryService historyService,
        IPermissionService permissionService)
    {
        _context = context;
        _historyService = historyService;
        _permissionService = permissionService;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    /// <summary>
    /// Retrieves chronological, tamper-evident history events for the target document.
    /// Gated by the document type's corresponding view permission or general AuditView permission.
    /// </summary>
    [HttpGet("{documentType}/{id}/history")]
    public async Task<IActionResult> GetDocumentHistory(string documentType, Guid id)
    {
        var companyId = _context.CurrentCompanyId;
        if (!companyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "X-Company-Id context required." });

        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        // 1. Resolve required permission for document type
        var normalizedType = documentType.Trim();
        var requiredPermission = normalizedType.ToLowerInvariant() switch
        {
            "journalentry" or "journal" => Permissions.FinanceView,
            "salesinvoice" or "invoice" => Permissions.SalesView,
            "purchasebill" or "bill" => Permissions.PurchasesView,
            "fixedasset" or "asset" => Permissions.AssetsView,
            "payrollrun" or "payroll" => Permissions.PayrollView,
            _ => null
        };

        if (requiredPermission == null)
        {
            return BadRequest(new { code = "INVALID_DOCUMENT_TYPE", message = $"Document type '{documentType}' is not supported." });
        }

        // 2. Validate user permission (either document view permission or AuditView)
        var hasDocPerm = await _permissionService.HasPermissionAsync(userId.Value, companyId.Value, requiredPermission);
        var hasAuditPerm = await _permissionService.HasPermissionAsync(userId.Value, companyId.Value, Permissions.AuditView);

        if (!hasDocPerm && !hasAuditPerm)
        {
            return StatusCode(403, new { code = "PERMISSION_DENIED", message = $"Requires {requiredPermission} or {Permissions.AuditView}." });
        }

        // 3. Verify document exists in this company
        bool exists = normalizedType.ToLowerInvariant() switch
        {
            "journalentry" or "journal" => await _context.JournalEntries.AnyAsync(e => e.Id == id),
            "salesinvoice" or "invoice" => await _context.SalesInvoices.AnyAsync(e => e.Id == id),
            "purchasebill" or "bill" => await _context.PurchaseBills.AnyAsync(e => e.Id == id),
            "fixedasset" or "asset" => await _context.FixedAssets.AnyAsync(e => e.Id == id),
            "payrollrun" or "payroll" => await _context.PayrollRuns.AnyAsync(e => e.Id == id),
            _ => false
        };

        if (!exists)
        {
            return NotFound(new { code = "DOCUMENT_NOT_FOUND", message = $"{documentType} {id} not found." });
        }

        var history = await _historyService.GetDocumentHistoryAsync(companyId.Value, normalizedType, id);
        return Ok(history);
    }
}
