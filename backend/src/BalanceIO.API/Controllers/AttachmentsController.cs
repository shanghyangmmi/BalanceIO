using System.Security.Claims;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Evidence Attachment Controller:
/// - Receipts, vendor invoices, contracts, bank slips, and tax withholding slips
/// - Attached to JournalEntry, PurchaseBill, SalesInvoice, PaymentVoucher, ReceiptVoucher, Expense
/// - Supports PDF and image inline previews, auditor verification stamps, and ledger immutability guards
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttachmentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly BlobStorageService _blobStorageService;

    public AttachmentsController(ApplicationDbContext context, BlobStorageService blobStorageService)
    {
        _context = context;
        _blobStorageService = blobStorageService;
    }

    private Guid? GetCurrentCompanyId()
    {
        var claim = User.FindFirst("CompanyId")?.Value 
                 ?? User.FindFirst("company_id")?.Value
                 ?? Request.Headers["X-Company-Id"].FirstOrDefault();
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value 
                 ?? User.FindFirst("sub")?.Value 
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
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
    /// List all evidence attachments for a specific financial document
    /// </summary>
    [HttpGet("{entityType}/{entityId}")]
    public async Task<ActionResult<List<EvidenceAttachment>>> GetAttachments(string entityType, Guid entityId)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var attachments = await _context.EvidenceAttachments
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId.Value 
                     && a.EntityType.ToLower() == entityType.ToLower() 
                     && a.EntityId == entityId)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync();

        return Ok(attachments);
    }

    /// <summary>
    /// Upload evidence document attached to an entity
    /// </summary>
    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<EvidenceAttachment>> UploadAttachment([FromForm] UploadAttachmentRequest request)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var file = request.File;
        if (file == null || file.Length == 0)
            return BadRequest("File cannot be empty.");

        // 15 MB limit per document
        if (file.Length > 15 * 1024 * 1024)
            return BadRequest("File size exceeds maximum allowed limit of 15MB.");

        var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".pdf", ".xlsx", ".xls", ".csv", ".doc", ".docx" };
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExtensions.Contains(ext))
            return BadRequest($"File format {ext} is not supported. Allowed formats: JPG, PNG, PDF, Excel, CSV, Word.");

        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        using var stream = file.OpenReadStream();
        var (storageKey, publicUrl) = await _blobStorageService.UploadFileAsync(stream, file.FileName, file.ContentType);

        var attachment = new EvidenceAttachment
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId.Value,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            AttachmentType = request.AttachmentType ?? "Receipt",
            FileName = file.FileName,
            FileExtension = ext,
            ContentType = file.ContentType,
            FileSize = file.Length,
            FileUrl = publicUrl,
            StoragePath = storageKey,
            Notes = request.Notes,
            UploadedBy = currentEmail,
            UploadedByUserId = currentUserId,
            UploadedAt = DateTime.UtcNow,
            IsVerified = false
        };

        _context.EvidenceAttachments.Add(attachment);
        await _context.SaveChangesAsync();

        return Ok(attachment);
    }

    /// <summary>
    /// Verify an evidence attachment as approved supporting documentation
    /// </summary>
    [HttpPost("{id}/verify")]
    public async Task<IActionResult> VerifyAttachment(Guid id)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var attachment = await _context.EvidenceAttachments
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == companyId.Value);

        if (attachment == null) return NotFound();

        attachment.IsVerified = true;
        attachment.VerifiedBy = GetCurrentUserEmail();
        attachment.VerifiedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { success = true, message = "Evidence attachment verified.", attachment });
    }

    /// <summary>
    /// Delete an attachment (subject to ledger immutability rules)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteAttachment(Guid id)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return Unauthorized("Company context is required.");

        var attachment = await _context.EvidenceAttachments
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == companyId.Value);

        if (attachment == null) return NotFound();

        // ── LEDGER IMMUTABILITY GUARD ────────────────────────────────────────
        // Check if the parent entity is Posted. If so, only Admins can remove evidence.
        if (attachment.EntityType.Equals("JournalEntry", StringComparison.OrdinalIgnoreCase))
        {
            var journal = await _context.JournalEntries.FindAsync(attachment.EntityId);
            if (journal != null && journal.Status == JournalEntryStatus.Posted)
            {
                var isAdmin = User.IsInRole("Admin") || User.HasClaim("role", "Admin");
                if (!isAdmin)
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Evidence linked to a Posted journal entry cannot be deleted by standard users to protect audit trail integrity.",
                        code = "EVIDENCE_IMMUTABLE"
                    });
                }
            }
        }
        else if (attachment.EntityType.Equals("PurchaseBill", StringComparison.OrdinalIgnoreCase))
        {
            var bill = await _context.PurchaseBills.FindAsync(attachment.EntityId);
            if (bill != null && bill.Status == BillStatus.Posted)
            {
                var isAdmin = User.IsInRole("Admin") || User.HasClaim("role", "Admin");
                if (!isAdmin)
                {
                    return StatusCode(StatusCodes.Status403Forbidden, new
                    {
                        message = "Evidence linked to a Posted purchase bill cannot be deleted to protect audit trail integrity.",
                        code = "EVIDENCE_IMMUTABLE"
                    });
                }
            }
        }

        await _blobStorageService.DeleteFileAsync(attachment.StoragePath);
        _context.EvidenceAttachments.Remove(attachment);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Attachment removed successfully." });
    }

    /// <summary>
    /// Stream an attachment for inline preview.
    ///
    /// This was [AllowAnonymous], with a comment saying it allowed viewing
    /// "via authenticated tokens or safe URLs". There was neither a token
    /// nor a signature: anyone holding an id could read any company's
    /// evidence - scanned invoices, bank statements, contracts. Ids do not
    /// stay secret. They travel in browser history, referrer headers,
    /// screenshots and proxy logs.
    ///
    /// It was anonymous for a reason, and the reason was real: an
    /// &lt;img src&gt; carries no Authorization header. The answer is for the
    /// browser to fetch it with credentials and render a blob URL, which is
    /// what the evidence panel now does - not to open the endpoint.
    /// </summary>
    [HttpGet("{id}/preview")]
    public async Task<IActionResult> PreviewAttachment(Guid id)
    {
        return await StreamAsync(id, inline: true);
    }

    /// <summary>
    /// Download an attachment.
    ///
    /// The tenant check was missing here too. It mattered less than on
    /// preview only because this one at least required a sign-in - any
    /// authenticated user of any company could still read another
    /// company's evidence by id.
    /// </summary>
    [HttpGet("{id}/download")]
    public async Task<IActionResult> DownloadAttachment(Guid id)
    {
        return await StreamAsync(id, inline: false);
    }

    private async Task<IActionResult> StreamAsync(Guid id, bool inline)
    {
        var companyId = GetCurrentCompanyId();
        if (companyId == null) return BadRequest(new { error = "No company scope." });

        // EvidenceAttachment carries a CompanyId but has no global query
        // filter, so the scope has to be written out. Not found rather than
        // forbidden: whether an id exists in another tenant is itself
        // something this caller should not learn.
        var attachment = await _context.EvidenceAttachments
            .FirstOrDefaultAsync(a => a.Id == id && a.CompanyId == companyId.Value);

        if (attachment == null) return NotFound();

        var fileResult = await _blobStorageService.GetFileStreamAsync(
            attachment.StoragePath, attachment.ContentType);

        if (fileResult == null) return NotFound("Attachment file stream not available.");

        var disposition = inline ? "inline" : "attachment";

        // Quoted and stripped of anything that would end the header value.
        // A filename is user-supplied, and a newline in one is a response
        // splitting bug rather than a naming problem.
        var safeName = attachment.FileName.Replace("\"", string.Empty)
                                          .Replace("\r", string.Empty)
                                          .Replace("\n", string.Empty);

        Response.Headers.Append("Content-Disposition", $"{disposition}; filename=\"{safeName}\"");
        return File(fileResult.Value.stream, fileResult.Value.contentType);
    }
}

public class UploadAttachmentRequest
{
    public IFormFile File { get; set; } = null!;
    public string EntityType { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string? AttachmentType { get; set; } = "Receipt";
    public string? Notes { get; set; }
}

