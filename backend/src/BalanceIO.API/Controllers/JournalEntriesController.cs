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
public class JournalEntriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;

    public JournalEntriesController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        IDocumentHistoryService historyService)
    {
        _context = context;
        _periodLockService = periodLockService;
        _historyService = historyService;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value 
                 ?? User.FindFirst("sub")?.Value 
                 ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    /// <summary>
    /// The caller's identity for stamping and segregation of duties. There is
    /// no fallback address: two callers without an email claim must never
    /// compare as the same person.
    /// </summary>
    private bool TryGetActor(out Guid id, out string label)
    {
        id = GetCurrentUserId() ?? Guid.Empty;
        label = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
             ?? User.FindFirst("email")?.Value
             ?? id.ToString();
        return id != Guid.Empty;
    }

    private IActionResult Rejected(string code, string message) => BadRequest(new { code, message });

    // GET: api/JournalEntries
    // Backward compatible: without ?page= returns the full list (legacy shape).
    // With ?page=1&pageSize=50 returns a paged envelope { items, total, page, pageSize }.
    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> GetJournalEntries(
        [FromQuery] int? page,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] JournalEntryStatus? status = null)
    {
        var query = _context.JournalEntries
            .Include(j => j.Lines)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(j => j.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(j =>
                (j.ReferenceNumber != null && EF.Functions.Like(j.ReferenceNumber, $"%{term}%")) ||
                (j.Notes != null && EF.Functions.Like(j.Notes, $"%{term}%")));
        }

        query = query
            .OrderByDescending(j => j.Date)
            .ThenByDescending(j => j.CreatedAt);

        if (!page.HasValue)
        {
            return Ok(await query.AsNoTracking().ToListAsync());
        }

        pageSize = Math.Clamp(pageSize, 1, 200);
        var currentPage = Math.Max(page.Value, 1);

        var total = await query.CountAsync();
        var items = await query
            .AsNoTracking()
            .Skip((currentPage - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { items, total, page = currentPage, pageSize });
    }

    // GET: api/JournalEntries/5
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<JournalEntry>> GetJournalEntry(Guid id)
    {
        var journalEntry = await _context.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (journalEntry == null)
        {
            return NotFound();
        }

        return journalEntry;
    }

    // POST: api/JournalEntries
    // Always creates a Draft. Posting goes through POST /{id}/post, where
    // segregation of duties is enforced.
    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> PostJournalEntry([FromBody] JournalEntryRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue) return Rejected("COMPANY_REQUIRED", "Company context is required");
        var companyId = _context.CurrentCompanyId.Value;
        if (!TryGetActor(out var actorId, out var actorLabel)) return Unauthorized();

        var idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
        if (idempotencyKey is { Length: > 100 })
            return Rejected("IDEMPOTENCY_KEY_TOO_LONG", "X-Idempotency-Key is limited to 100 characters.");

        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var existing = await FindByIdempotencyKey(idempotencyKey);
            if (existing != null) return Ok(existing);
        }

        var invalid = await ValidateRequest(request, companyId);
        if (invalid != null) return invalid;

        await _periodLockService.ValidateTransactionDate(companyId, request.Date);

        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            IdempotencyKey = string.IsNullOrEmpty(idempotencyKey) ? null : idempotencyKey,
            CreatedByUserId = actorId,
            CreatedBy = actorLabel,
            Status = JournalEntryStatus.Draft,
        };
        await ApplyRequest(journalEntry, request, companyId);

        _context.JournalEntries.Add(journalEntry);
        try
        {
            await _context.SaveChangesAsync();
            await _historyService.RecordEventAsync(companyId, "JournalEntry", journalEntry.Id, "Created", actorId, actorLabel, "Draft entry created");
        }
        catch (DbUpdateException) when (journalEntry.IdempotencyKey != null)
        {
            // Lost a race against a concurrent request with the same key; the
            // unique index on (CompanyId, IdempotencyKey) decided the winner.
            _context.ChangeTracker.Clear();
            var winner = await FindByIdempotencyKey(journalEntry.IdempotencyKey);
            if (winner != null) return Ok(winner);
            throw;
        }

        return CreatedAtAction("GetJournalEntry", new { id = journalEntry.Id }, journalEntry);
    }

    private Task<JournalEntry?> FindByIdempotencyKey(string key) =>
        _context.JournalEntries.AsNoTracking().Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.CompanyId == _context.CurrentCompanyId && j.IdempotencyKey == key);

    // PUT: api/JournalEntries/5
    // Edits a Draft. Status cannot be changed here.
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> PutJournalEntry(Guid id, [FromBody] JournalEntryRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue) return Rejected("COMPANY_REQUIRED", "Company context is required");
        var companyId = _context.CurrentCompanyId.Value;

        var existing = await _context.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (existing == null) return NotFound();

        // ── LEDGER IMMUTABILITY GUARD ──────────────────────────────────────
        // A Posted entry is part of the immutable ledger and a Void entry is a
        // historical record. Corrections go through Void + Reversal:
        //   POST api/JournalEntries/{id}/void
        //   POST api/JournalEntries/{id}/reverse
        if (existing.Status == JournalEntryStatus.Posted)
        {
            return BadRequest(new
            {
                message = "Posted entries are immutable and cannot be edited. " +
                          "To correct this entry: Void it, then create a Reversal entry.",
                code = "POSTED_IMMUTABLE"
            });
        }

        if (existing.Status == JournalEntryStatus.Void)
        {
            return BadRequest(new
            {
                message = "Void entries are historical records and cannot be edited.",
                code = "VOID_IMMUTABLE"
            });
        }

        var invalid = await ValidateRequest(request, companyId);
        if (invalid != null) return invalid;

        await _periodLockService.ValidateTransactionDate(companyId, existing.Date);
        await _periodLockService.ValidateTransactionDate(companyId, request.Date);

        var oldLines = existing.Lines.ToList();
        _context.JournalLines.RemoveRange(oldLines);
        existing.Lines = new List<JournalLine>();
        await ApplyRequest(existing, request, companyId);
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        if (TryGetActor(out var putActorId, out var putActorLabel))
        {
            await _historyService.RecordEventAsync(companyId, "JournalEntry", existing.Id, "Updated", putActorId, putActorLabel, "Draft entry updated");
        }
        return NoContent();
    }

    /// <summary>Everything a Draft's content may carry. Returns null when valid.</summary>
    private async Task<IActionResult?> ValidateRequest(JournalEntryRequest request, Guid companyId)
    {
        if (request.Status is not (null or 0))
        {
            return request.Status == 1
                ? Rejected("USE_POST_ENDPOINT", "Journal entries are saved as Draft. Post with POST /api/JournalEntries/{id}/post.")
                : Rejected("INVALID_STATUS", "Status cannot be set on create or update.");
        }

        if (request.Date == default) return Rejected("DATE_REQUIRED", "Date is required.");
        if (request.Lines.Count < 2) return Rejected("TOO_FEW_LINES", "Journal Entry must have at least 2 lines.");
        if (request.ReferenceNumber is { Length: > 50 }) return Rejected("FIELD_TOO_LONG", "ReferenceNumber is limited to 50 characters.");
        if (request.Tags is { Length: > 200 }) return Rejected("FIELD_TOO_LONG", "Tags is limited to 200 characters.");
        if (request.ContactId is { Length: > 100 }) return Rejected("FIELD_TOO_LONG", "ContactId is limited to 100 characters.");
        if (request.Notes is { Length: > 4000 }) return Rejected("FIELD_TOO_LONG", "Notes is limited to 4000 characters.");
        if (request.Currency is { } cur && !(cur.Length == 3 && cur.All(char.IsAsciiLetter)))
            return Rejected("INVALID_CURRENCY", "Currency must be a 3-letter ISO code.");

        foreach (var line in request.Lines)
        {
            if (string.IsNullOrWhiteSpace(line.AccountId) || line.AccountId.Length > 100)
                return Rejected("ACCOUNT_REQUIRED", "Every line needs an account.");
            if (line.Description is { Length: > 255 }) return Rejected("FIELD_TOO_LONG", "Line description is limited to 255 characters.");
            if (line.Tax is { Length: > 50 }) return Rejected("FIELD_TOO_LONG", "Line tax is limited to 50 characters.");
            if (line.Debit < 0 || line.Credit < 0)
                return Rejected("NEGATIVE_AMOUNT", "Debit and credit amounts cannot be negative.");
            if (line.Debit > 0 && line.Credit > 0)
                return Rejected("DEBIT_AND_CREDIT", "A line carries either a debit or a credit, not both.");
            if (line.Debit == 0 && line.Credit == 0)
                return Rejected("ZERO_LINE", "Every line needs a debit or a credit amount.");
            // The column is decimal(19,4): anything finer would be rounded by
            // the database, silently unbalancing an entry that balanced here.
            if (line.Debit != Math.Round(line.Debit, 4) || line.Credit != Math.Round(line.Credit, 4)
                || line.Debit >= 1e15m || line.Credit >= 1e15m)
                return Rejected("AMOUNT_OUT_OF_RANGE", "Amounts support at most 4 decimal places and less than 1e15.");
        }

        var codes = await _context.ResolveAccountCodesAsync(companyId, request.Lines.Select(l => l.AccountId));
        var unknown = request.Lines.Select(l => l.AccountId).Distinct().Where(a => !codes.ContainsKey(a)).ToList();
        if (unknown.Count > 0)
            return Rejected("ACCOUNT_NOT_FOUND", $"Unknown account(s) for this company: {string.Join(", ", unknown)}.");

        if (request.ProjectId.HasValue && !await _context.Projects.AnyAsync(p => p.Id == request.ProjectId))
            return Rejected("PROJECT_NOT_FOUND", "Project does not exist in this company.");

        return null;
    }

    private async Task ApplyRequest(JournalEntry entry, JournalEntryRequest request, Guid companyId)
    {
        var codes = await _context.ResolveAccountCodesAsync(companyId, request.Lines.Select(l => l.AccountId));

        entry.Date = request.Date;
        entry.ReferenceNumber = request.ReferenceNumber;
        entry.Tags = request.Tags;
        entry.ContactId = string.IsNullOrWhiteSpace(request.ContactId) ? null : request.ContactId;
        entry.Currency = request.Currency?.ToUpperInvariant() ?? "IDR";
        entry.Notes = request.Notes;
        entry.ProjectId = request.ProjectId;
        entry.IsAdjustingEntry = request.IsAdjustingEntry;

        foreach (var line in request.Lines)
        {
            var journalLine = new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = entry.Id,
                AccountId = codes[line.AccountId],
                Description = line.Description,
                Debit = line.Debit,
                Credit = line.Credit,
                Tax = line.Tax,
            };
            entry.Lines.Add(journalLine);
            _context.JournalLines.Add(journalLine);
        }
    }

    // DELETE: api/JournalEntries/5
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> DeleteJournalEntry(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var journalEntry = await _context.JournalEntries.FindAsync(id);
        if (journalEntry == null) return NotFound();

        // Only Drafts may be deleted. Posted/Void entries are part of the
        // permanent audit trail — they can never be physically removed.
        if (journalEntry.Status != JournalEntryStatus.Draft)
        {
            return BadRequest(new
            {
                message = "Only Draft entries can be deleted. Posted entries must be Voided (the record is retained for audit).",
                code = "LEDGER_DELETE_FORBIDDEN"
            });
        }

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, journalEntry.Date);

        _context.JournalEntries.Remove(journalEntry);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/JournalEntries/{id}/void
    // Marks a Posted entry as Void. The record and its lines are retained
    // untouched for the audit trail; only the status changes.
    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> VoidJournalEntry(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var entry = await _context.JournalEntries.FindAsync(id);
        if (entry == null) return NotFound();

        if (entry.Status == JournalEntryStatus.Void)
            return BadRequest(new { message = "Entry is already Void.", code = "ALREADY_VOID" });

        if (entry.Status == JournalEntryStatus.Draft)
            return BadRequest(new { message = "Draft entries should be deleted, not voided.", code = "DRAFT_NOT_VOIDABLE" });

        // Voiding affects reported balances of the entry's period.
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, entry.Date);

        entry.Status = JournalEntryStatus.Void;
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        if (TryGetActor(out var voidActorId, out var voidActorLabel))
        {
            await _historyService.RecordEventAsync(entry.CompanyId, "JournalEntry", entry.Id, "Voided", voidActorId, voidActorLabel, "Entry voided");
        }

        return Ok(new { message = "Entry voided.", id = entry.Id });
    }

    // POST: api/JournalEntries/{id}/reverse
    // Creates a NEW Draft entry that mirrors the source with Debits/Credits
    // swapped. The correct Big-4 flow: Void the wrong entry (period open) or
    // keep it and post a reversal in the current open period.
    [HttpPost("{id}/reverse")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<JournalEntry>> ReverseJournalEntry(Guid id, [FromQuery] DateOnly? date)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var source = await _context.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (source == null) return NotFound();

        if (source.Status == JournalEntryStatus.Draft)
            return BadRequest(new { message = "Draft entries can be edited directly — reversal is unnecessary.", code = "DRAFT_NOT_REVERSIBLE" });

        if (source.Status == JournalEntryStatus.Void)
            return BadRequest(new { message = "Void entries no longer affect the ledger and cannot be reversed.", code = "VOID_NOT_REVERSIBLE" });

        var reversalDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, reversalDate);

        var reversal = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = source.CompanyId,
            Date = reversalDate,
            ReferenceNumber = $"REV-{source.ReferenceNumber ?? source.Id.ToString()[..8]}",
            Tags = source.Tags,
            ContactId = source.ContactId,
            Currency = source.Currency,
            ProjectId = source.ProjectId,
            Notes = $"Reversal of {source.ReferenceNumber ?? source.Id.ToString()} — {source.Notes}".Trim(),
            Status = JournalEntryStatus.Draft, // reviewed & posted explicitly
            IsAdjustingEntry = true,
            Lines = source.Lines.Select(l => new JournalLine
            {
                Id = Guid.NewGuid(),
                AccountId = l.AccountId,
                Description = l.Description,
                Debit = l.Credit,   // swapped
                Credit = l.Debit,   // swapped
                Tax = l.Tax
            }).ToList()
        };

        if (TryGetActor(out var reverserId, out var reverserLabel))
        {
            reversal.CreatedByUserId = reverserId;
            reversal.CreatedBy = reverserLabel;
        }

        _context.JournalEntries.Add(reversal);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(source.CompanyId, "JournalEntry", source.Id, "Reversed", reverserId, reverserLabel, "Entry reversed", reversalDocumentId: reversal.Id);
        await _historyService.RecordEventAsync(reversal.CompanyId, "JournalEntry", reversal.Id, "Created", reverserId, reverserLabel, $"Reversal entry for {source.ReferenceNumber ?? source.Id.ToString()}");

        return CreatedAtAction("GetJournalEntry", new { id = reversal.Id }, reversal);
    }
    
    // Batch Post
    [HttpPost("batch-post")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> BatchPost([FromBody] List<Guid> ids)
    {
        if (ids == null || !ids.Any()) return BadRequest("No entries selected");
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var company = await _context.Companies.FindAsync(_context.CurrentCompanyId.Value);
        if (!TryGetActor(out var currentUserId, out var currentEmail)) return Unauthorized();

        var entries = await _context.JournalEntries
            .Include(j => j.Lines) // Include lines for balance check
            .Where(j => ids.Contains(j.Id) && j.Status == JournalEntryStatus.Draft)
            .ToListAsync();

        if (!entries.Any()) return BadRequest("No valid draft entries found to post");

        var postedCount = 0;
        var errors = new List<string>();

        foreach (var entry in entries)
        {
            // ── SEGREGATION OF DUTIES (SoD) GUARD ────────────────────────────────
            // The creator of an entry cannot approve or post it.
            if (company != null && company.EnforceSegregationOfDuties)
            {
                bool isCreator = (entry.CreatedByUserId.HasValue && entry.CreatedByUserId == currentUserId)
                              || (!string.IsNullOrEmpty(entry.CreatedBy) && string.Equals(entry.CreatedBy, currentEmail, StringComparison.OrdinalIgnoreCase));

                if (isCreator)
                {
                    errors.Add($"Journal {entry.ReferenceNumber ?? entry.Id.ToString()} was created by you (SoD: requires second reviewer approval).");
                    continue;
                }
            }

            try
            {
                await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, entry.Date);
            }
            catch (PeriodLockedException ex)
            {
                errors.Add($"Journal {entry.ReferenceNumber ?? entry.Id.ToString()}: {ex.Message}");
                continue;
            }

            // Validate Balance
            var totalDebit = entry.Lines.Sum(l => l.Debit);
            var totalCredit = entry.Lines.Sum(l => l.Credit);

            if (totalDebit != totalCredit)
            {
                errors.Add($"Journal {entry.ReferenceNumber ?? entry.Id.ToString()} is unbalanced (Diff: {Math.Abs(totalDebit - totalCredit):N2})");
                continue; // Skip posting this one
            }

            entry.Status = JournalEntryStatus.Posted;
            entry.ApprovedByUserId = currentUserId;
            entry.ApprovedBy = currentEmail;
            entry.ApprovedAt = DateTime.UtcNow;
            entry.UpdatedAt = DateTime.UtcNow;
            postedCount++;
        }

        if (postedCount > 0)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(new { 
            message = $"{postedCount} entries approved and posted successfully.", 
            failedCount = errors.Count,
            errors = errors 
        });
    }

    // POST: api/JournalEntries/{id}/post
    // Approve and post a specific journal entry to the General Ledger
    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> PostSingleJournalEntry(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var company = await _context.Companies.FindAsync(_context.CurrentCompanyId.Value);
        if (!TryGetActor(out var currentUserId, out var currentEmail)) return Unauthorized();

        var entry = await _context.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (entry == null) return NotFound();

        if (entry.Status == JournalEntryStatus.Posted)
            return BadRequest(new { message = "Journal entry is already posted.", code = "ALREADY_POSTED" });

        if (entry.Status == JournalEntryStatus.Void)
            return BadRequest(new { message = "Void entries cannot be posted again.", code = "VOID_NOT_POSTABLE" });

        // ── SEGREGATION OF DUTIES (SoD) GUARD ────────────────────────────────
        // The creator of an entry cannot approve or post it.
        if (company != null && company.EnforceSegregationOfDuties)
        {
            bool isCreator = (entry.CreatedByUserId.HasValue && entry.CreatedByUserId == currentUserId)
                          || (!string.IsNullOrEmpty(entry.CreatedBy) && string.Equals(entry.CreatedBy, currentEmail, StringComparison.OrdinalIgnoreCase));

            if (isCreator)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new 
                { 
                    message = $"Segregation of Duties Violation: You created this journal entry ({entry.CreatedBy ?? "current user"}). Internal controls require a second authorized reviewer to approve and post it to the General Ledger.", 
                    code = "SEGREGATION_OF_DUTIES_VIOLATION",
                    createdBy = entry.CreatedBy
                });
            }
        }

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, entry.Date);

        var totalDebit = entry.Lines.Sum(l => l.Debit);
        var totalCredit = entry.Lines.Sum(l => l.Credit);

        if (totalDebit != totalCredit)
        {
            return BadRequest(new { message = "Journal Entry is not balanced. Cannot Post.", difference = Math.Abs(totalDebit - totalCredit), code = "UNBALANCED" });
        }

        entry.Status = JournalEntryStatus.Posted;
        entry.ApprovedByUserId = currentUserId;
        entry.ApprovedBy = currentEmail;
        entry.ApprovedAt = DateTime.UtcNow;
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(entry.CompanyId, "JournalEntry", entry.Id, "Posted", currentUserId, currentEmail, "Entry approved & posted to General Ledger");

        return Ok(new { message = $"Journal {entry.ReferenceNumber ?? entry.Id.ToString()} approved & posted to General Ledger by {currentEmail}.", id = entry.Id });
    }

    // POST: api/JournalEntries/{id}/reject
    // Reject a pending approval entry and return to draft with manager notes
    [HttpPost("{id}/reject")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> RejectJournalEntry(Guid id, [FromBody] string? reason)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        if (!TryGetActor(out _, out var currentEmail)) return Unauthorized();

        var entry = await _context.JournalEntries.FindAsync(id);
        if (entry == null) return NotFound();

        // Only a Draft can be sent back for revision. A Void entry is a
        // closed record and must not be reopened into something deletable.
        if (entry.Status == JournalEntryStatus.Posted)
            return BadRequest(new { message = "Cannot reject a posted entry. Void it instead.", code = "POSTED_NOT_REJECTABLE" });
        if (entry.Status == JournalEntryStatus.Void)
            return BadRequest(new { message = "Void entries are historical records and cannot be rejected.", code = "VOID_NOT_REJECTABLE" });

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, entry.Date);

        entry.Status = JournalEntryStatus.Draft;
        entry.RejectionReason = reason ?? "Revision requested by manager";
        entry.RejectedBy = currentEmail;
        entry.RejectedAt = DateTime.UtcNow;
        entry.Notes = $"[REJECTED BY {currentEmail}: {reason ?? "Needs revision"}] {entry.Notes}".Trim();
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        if (TryGetActor(out var rejectActorId, out var rejectActorLabel))
        {
            await _historyService.RecordEventAsync(entry.CompanyId, "JournalEntry", entry.Id, "Rejected", rejectActorId, rejectActorLabel, entry.RejectionReason);
        }

        return Ok(new { message = "Journal entry rejected and returned to draft.", id = entry.Id, rejectionReason = entry.RejectionReason });
    }

    private bool JournalEntryExists(Guid id)
    {
        return _context.JournalEntries.Any(e => e.Id == id);
    }
}
