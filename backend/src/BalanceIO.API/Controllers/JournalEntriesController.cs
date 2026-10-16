using BalanceIO.API.Data;
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
    private readonly IConfiguration _configuration;
    private readonly IPeriodLockService _periodLockService;

    public JournalEntriesController(ApplicationDbContext context, IConfiguration configuration, IPeriodLockService periodLockService)
    {
        _context = context;
        _configuration = configuration;
        _periodLockService = periodLockService;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value 
                 ?? User.FindFirst("sub")?.Value 
                 ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.Identity?.Name 
            ?? "accountant@balanceio.id";
    }

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

        try
        {
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
        catch (Exception ex) when (ex.Message.Contains("IsAdjustingEntry") || ex.Message.Contains("no such column"))
        {
            // Auto-patch missing columns in SQLite database file on demand
            try { _context.Database.ExecuteSqlRaw(@"ALTER TABLE ""JournalEntries"" ADD COLUMN ""IsAdjustingEntry"" INTEGER DEFAULT 0;"); } catch { }
            try { _context.Database.ExecuteSqlRaw(@"ALTER TABLE ""JournalEntries"" ADD COLUMN ""ProjectId"" TEXT;"); } catch { }
            try { _context.Database.ExecuteSqlRaw(@"ALTER TABLE ""SalesInvoices"" ADD COLUMN ""ProjectId"" TEXT;"); } catch { }
            try { _context.Database.ExecuteSqlRaw(@"ALTER TABLE ""Companies"" ADD COLUMN ""LockDate"" TEXT;"); } catch { }

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
    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<JournalEntry>> PostJournalEntry(JournalEntry journalEntry)
    {
        // 0. Validation
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        // ── IDEMPOTENCY KEY GUARD (Prevent Double Submission / Network Retries) ──
        string? idempotencyKey = Request.Headers["X-Idempotency-Key"].FirstOrDefault();
        if (string.IsNullOrEmpty(idempotencyKey))
        {
            idempotencyKey = journalEntry.IdempotencyKey;
        }

        if (!string.IsNullOrEmpty(idempotencyKey))
        {
            var existingEntry = await _context.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.CompanyId == _context.CurrentCompanyId.Value && j.IdempotencyKey == idempotencyKey);

            if (existingEntry != null)
            {
                // Request already processed — return existing entry immediately with HTTP 200 OK
                return Ok(existingEntry);
            }

            journalEntry.IdempotencyKey = idempotencyKey;
        }

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, journalEntry.Date);

        if (journalEntry.Lines.Count < 2)
            return BadRequest("Journal Entry must have at least 2 lines.");

        // FREE TIER LIMIT (Configurable)
        var maxJournals = _configuration.GetValue<int>("TierLimits:Free:MaxJournals");
        if (maxJournals == 0) maxJournals = 50; // Increased default limit

        var currentCount = await _context.JournalEntries.CountAsync();
        if (currentCount >= maxJournals)
        {
            return BadRequest($"Free Tier Limit Reached: You can only create up to {maxJournals} Journal Entries. Upgrade for more.");
        }

        // 1. Balance Check - Only Strict for POSTED
        var totalDebit = journalEntry.Lines.Sum(l => l.Debit);
        var totalCredit = journalEntry.Lines.Sum(l => l.Credit);
        
        // If user sends 'Posted' status, we enforce balance.
        // If 'Draft', we allow imbalance (Work In Progress).
        
        // Default to Draft if not specified? No, frontend sends status.
        // If frontend sends nothing, it defaults to Draft (0) usually if enum default.
        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        journalEntry.CreatedByUserId = currentUserId;
        journalEntry.CreatedBy = currentEmail;

        if (journalEntry.Status == JournalEntryStatus.Posted)
        {
            // Exact equality: money is decimal — no tolerance window on a ledger.
            if (totalDebit != totalCredit)
            {
                return BadRequest(new { message = "Journal Entry is not balanced. Cannot Post.", difference = Math.Abs(totalDebit - totalCredit) });
            }

            journalEntry.ApprovedByUserId = currentUserId;
            journalEntry.ApprovedBy = currentEmail;
            journalEntry.ApprovedAt = DateTime.UtcNow;
        }

        _context.JournalEntries.Add(journalEntry);
        await _context.SaveChangesAsync();

        return CreatedAtAction("GetJournalEntry", new { id = journalEntry.Id }, journalEntry);
    }

    // PUT: api/JournalEntries/5
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> PutJournalEntry(Guid id, JournalEntry journalEntry)
    {
        if (id != journalEntry.Id) return BadRequest();
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var existing = await _context.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (existing == null) return NotFound();

        // Check Period Lock (Old Date)
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, existing.Date);
        // Check Period Lock (New Date)
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, journalEntry.Date);

        // ── LEDGER IMMUTABILITY GUARD ──────────────────────────────────────
        // A Posted entry is part of the immutable ledger. NO field or line may
        // be modified. Corrections must go through Void + Reversal:
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

        // A Void entry is a historical record — equally immutable.
        if (existing.Status == JournalEntryStatus.Void)
        {
            return BadRequest(new
            {
                message = "Void entries are historical records and cannot be edited.",
                code = "VOID_IMMUTABLE"
            });
        }

        // From here on, existing.Status == Draft.
        existing.Date = journalEntry.Date;
        existing.ReferenceNumber = journalEntry.ReferenceNumber;
        existing.Notes = journalEntry.Notes;
        existing.Status = journalEntry.Status; // Draft -> Draft or Draft -> Posted
        existing.UpdatedAt = DateTime.UtcNow;

        // Replace lines
        _context.JournalLines.RemoveRange(existing.Lines);
        existing.Lines = journalEntry.Lines;
        foreach(var line in existing.Lines) {
             line.JournalEntryId = existing.Id;
             if(line.Id == Guid.Empty) line.Id = Guid.NewGuid();
        }

        // Validate Balance if Posting (exact equality — no tolerance on a ledger)
        if (existing.Status == JournalEntryStatus.Posted)
        {
             var d = existing.Lines.Sum(l => l.Debit);
             var c = existing.Lines.Sum(l => l.Credit);
             if (d != c) return BadRequest("Journal Entry is not balanced.");
        }

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!JournalEntryExists(id)) return NotFound();
            else throw;
        }

        return NoContent();
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

        _context.JournalEntries.Add(reversal);
        await _context.SaveChangesAsync();

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
        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

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
        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        var entry = await _context.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.Id == id);

        if (entry == null) return NotFound();

        if (entry.Status == JournalEntryStatus.Posted)
            return BadRequest(new { message = "Journal entry is already posted.", code = "ALREADY_POSTED" });

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

        return Ok(new { message = $"Journal {entry.ReferenceNumber ?? entry.Id.ToString()} approved & posted to General Ledger by {currentEmail}.", id = entry.Id });
    }

    // POST: api/JournalEntries/{id}/reject
    // Reject a pending approval entry and return to draft with manager notes
    [HttpPost("{id}/reject")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> RejectJournalEntry(Guid id, [FromBody] string? reason)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var currentEmail = GetCurrentUserEmail();

        var entry = await _context.JournalEntries.FindAsync(id);
        if (entry == null) return NotFound();

        if (entry.Status == JournalEntryStatus.Posted)
            return BadRequest(new { message = "Cannot reject a posted entry. Void it instead.", code = "POSTED_NOT_REJECTABLE" });

        entry.Status = JournalEntryStatus.Draft;
        entry.RejectionReason = reason ?? "Revision requested by manager";
        entry.RejectedBy = currentEmail;
        entry.RejectedAt = DateTime.UtcNow;
        entry.Notes = $"[REJECTED BY {currentEmail}: {reason ?? "Needs revision"}] {entry.Notes}".Trim();
        entry.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Journal entry rejected and returned to draft.", id = entry.Id, rejectionReason = entry.RejectionReason });
    }

    private bool JournalEntryExists(Guid id)
    {
        return _context.JournalEntries.Any(e => e.Id == id);
    }
}
