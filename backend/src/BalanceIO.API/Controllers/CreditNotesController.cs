using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CreditNotesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly InventoryLedger _inventory;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;
    private readonly INotificationService _notificationService;

    public CreditNotesController(
        ApplicationDbContext context,
        InventoryLedger inventory,
        IPeriodLockService periodLockService,
        IDocumentHistoryService historyService,
        INotificationService notificationService)
    {
        _context = context;
        _inventory = inventory;
        _periodLockService = periodLockService;
        _historyService = historyService;
        _notificationService = notificationService;
    }

    [HttpGet]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<IEnumerable<CreditNote>>> GetAll(
        [FromQuery] Guid? contactId = null,
        [FromQuery] CreditNoteStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _context.CreditNotes
            .Include(c => c.Contact)
            .Include(c => c.SalesInvoice)
            .Include(c => c.Warehouse)
            .AsQueryable();

        if (contactId.HasValue)
            query = query.Where(c => c.ContactId == contactId.Value);

        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);

        if (from.HasValue)
            query = query.Where(c => c.IssueDate >= from.Value);

        if (to.HasValue)
            query = query.Where(c => c.IssueDate <= to.Value);

        return await query.OrderByDescending(c => c.IssueDate).ThenByDescending(c => c.CreatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<CreditNote>> GetById(Guid id)
    {
        var creditNote = await _context.CreditNotes
            .Include(c => c.Contact)
            .Include(c => c.SalesInvoice)
            .Include(c => c.Warehouse)
            .Include(c => c.Lines)
                .ThenInclude(l => l.Product)
            .Include(c => c.Lines)
                .ThenInclude(l => l.CostCenter)
            .Include(c => c.JournalEntry)
                .ThenInclude(j => j!.Lines)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (creditNote == null)
            return NotFound();

        return creditNote;
    }

    [HttpPost]
    [RequiresPermission(Permissions.SalesCreate)]
    public async Task<ActionResult<CreditNote>> Create(CreditNote creditNote)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, creditNote.IssueDate);

        if (creditNote.Id == Guid.Empty)
            creditNote.Id = Guid.NewGuid();

        creditNote.CompanyId = _context.CurrentCompanyId.Value;
        creditNote.CreatedAt = DateTime.UtcNow;
        creditNote.CreatedByUserId = GetCurrentUserId();
        creditNote.CreatedBy = GetCurrentUserEmail();
        creditNote.Status = CreditNoteStatus.Draft;

        if (string.IsNullOrWhiteSpace(creditNote.CreditNoteNumber))
        {
            creditNote.CreditNoteNumber = await GenerateCreditNoteNumber();
        }

        CalculateTotals(creditNote);

        _context.CreditNotes.Add(creditNote);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            creditNote.CompanyId,
            "CreditNote",
            creditNote.Id,
            "Created",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Credit note {creditNote.CreditNoteNumber} created as draft");

        return CreatedAtAction(nameof(GetById), new { id = creditNote.Id }, creditNote);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.SalesEdit)]
    public async Task<IActionResult> Update(Guid id, CreditNote creditNote)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var existing = await _context.CreditNotes
            .Include(c => c.Lines)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (existing == null)
            return NotFound();

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, existing.IssueDate);
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, creditNote.IssueDate);

        if (existing.Status != CreditNoteStatus.Draft)
            return BadRequest("Cannot edit a posted or voided credit note");

        existing.IssueDate = creditNote.IssueDate;
        existing.ContactId = creditNote.ContactId;
        existing.SalesInvoiceId = creditNote.SalesInvoiceId;
        existing.WarehouseId = creditNote.WarehouseId;
        existing.ReturnToInventory = creditNote.ReturnToInventory;
        existing.Reason = creditNote.Reason;
        existing.Currency = creditNote.Currency;
        existing.ExchangeRate = creditNote.ExchangeRate;
        existing.Notes = creditNote.Notes;
        existing.TemplateName = creditNote.TemplateName;

        _context.CreditNoteLines.RemoveRange(existing.Lines);
        existing.Lines = creditNote.Lines;

        CalculateTotals(existing);
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "CreditNote",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Credit note {existing.CreditNoteNumber} updated");

        return NoContent();
    }

    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var creditNote = await _context.CreditNotes
            .Include(c => c.Contact)
            .Include(c => c.SalesInvoice)
            .Include(c => c.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (creditNote == null)
            return NotFound();

        if (creditNote.Status != CreditNoteStatus.Draft && creditNote.Status != CreditNoteStatus.Pending)
            return BadRequest("Only draft credit notes can be posted");

        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        if (creditNote.CreatedByUserId.HasValue && currentUserId.HasValue &&
            creditNote.CreatedByUserId.Value == currentUserId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "SEGREGATION_OF_DUTIES_VIOLATION",
                message = $"Segregation of Duties Violation: You created credit note {creditNote.CreditNoteNumber}. Internal controls require an independent reviewer to approve and post it."
            });
        }

        await _periodLockService.ValidateTransactionDate(companyId, creditNote.IssueDate);

        // Create Journal Entry (Dr Revenue, Dr PPN Keluaran, Cr Accounts Receivable)
        var journalEntry = await CreateJournalEntryAsync(creditNote);
        creditNote.JournalEntryId = journalEntry.Id;

        // Process Inventory Return if requested
        if (creditNote.ReturnToInventory)
        {
            var warehouseId = await _inventory.ResolveAsync(companyId, creditNote.WarehouseId);
            creditNote.WarehouseId = warehouseId;

            foreach (var line in creditNote.Lines)
            {
                if (line.ProductId.HasValue && line.Product != null && line.Product.TrackInventory)
                {
                    await _inventory.MoveAsync(
                        product: line.Product,
                        warehouseId: warehouseId,
                        quantity: line.Quantity, // Positive: returns stock into warehouse
                        type: InventoryMovementType.Sale, // Inverted sales movement
                        date: creditNote.IssueDate,
                        totalCost: null, // At moving average cost
                        reference: creditNote.CreditNoteNumber,
                        journalEntryId: journalEntry.Id,
                        notes: $"Stock return from Credit Note {creditNote.CreditNoteNumber}",
                        reversal: true);
                }
            }
        }

        // Adjust Sales Invoice balance if linked
        if (creditNote.SalesInvoiceId.HasValue && creditNote.SalesInvoice != null)
        {
            creditNote.SalesInvoice.AmountDue = Math.Max(0m, creditNote.SalesInvoice.AmountDue - creditNote.Total);
            if (creditNote.SalesInvoice.AmountDue == 0m)
            {
                creditNote.SalesInvoice.Status = InvoiceStatus.Paid;
            }
            creditNote.SalesInvoice.UpdatedAt = DateTime.UtcNow;
        }

        creditNote.Status = CreditNoteStatus.Posted;
        creditNote.ApprovedByUserId = currentUserId;
        creditNote.ApprovedBy = currentEmail;
        creditNote.ApprovedAt = DateTime.UtcNow;
        creditNote.PostedAt = DateTime.UtcNow;
        creditNote.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            creditNote.CompanyId,
            "CreditNote",
            creditNote.Id,
            "Posted",
            currentUserId ?? Guid.Empty,
            currentEmail ?? "reviewer",
            $"Credit note {creditNote.CreditNoteNumber} posted for Rp {creditNote.Total:N0}");

        return Ok(creditNote);
    }

    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidRequest? request = null)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var creditNote = await _context.CreditNotes
            .Include(c => c.SalesInvoice)
            .Include(c => c.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (creditNote == null)
            return NotFound();

        if (creditNote.Status != CreditNoteStatus.Posted)
            return BadRequest("Only posted credit notes can be voided");

        await _periodLockService.ValidateTransactionDate(companyId, creditNote.IssueDate);

        // Void Journal Entry
        if (creditNote.JournalEntryId.HasValue)
        {
            var je = await _context.JournalEntries.FindAsync(creditNote.JournalEntryId.Value);
            if (je != null) je.Status = JournalEntryStatus.Void;
        }

        // Reverse stock if goods were returned
        if (creditNote.ReturnToInventory && creditNote.WarehouseId.HasValue)
        {
            foreach (var line in creditNote.Lines)
            {
                if (line.ProductId.HasValue && line.Product != null && line.Product.TrackInventory)
                {
                    await _inventory.MoveAsync(
                        product: line.Product,
                        warehouseId: creditNote.WarehouseId.Value,
                        quantity: -line.Quantity, // Remove the returned stock
                        type: InventoryMovementType.Sale,
                        date: DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
                        totalCost: null,
                        reference: $"VOID-{creditNote.CreditNoteNumber}",
                        journalEntryId: creditNote.JournalEntryId,
                        notes: $"Void of stock return from Credit Note {creditNote.CreditNoteNumber}",
                        reversal: false);
                }
            }
        }

        // Restore Sales Invoice balance
        if (creditNote.SalesInvoiceId.HasValue && creditNote.SalesInvoice != null)
        {
            creditNote.SalesInvoice.AmountDue += creditNote.Total;
            if (creditNote.SalesInvoice.Status == InvoiceStatus.Paid && creditNote.SalesInvoice.AmountDue > 0)
            {
                creditNote.SalesInvoice.Status = InvoiceStatus.Sent;
            }
            creditNote.SalesInvoice.UpdatedAt = DateTime.UtcNow;
        }

        creditNote.Status = CreditNoteStatus.Void;
        creditNote.VoidedAt = DateTime.UtcNow;
        creditNote.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            creditNote.Notes = string.IsNullOrWhiteSpace(creditNote.Notes)
                ? $"Void reason: {request.Reason}"
                : $"{creditNote.Notes}\nVoid reason: {request.Reason}";
        }

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            creditNote.CompanyId,
            "CreditNote",
            creditNote.Id,
            "Voided",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Credit note {creditNote.CreditNoteNumber} voided. Reason: {request?.Reason ?? "N/A"}");

        return Ok(new { message = "Credit note voided successfully", status = creditNote.Status });
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.SalesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var creditNote = await _context.CreditNotes.FindAsync(id);
        if (creditNote == null)
            return NotFound();

        if (creditNote.Status != CreditNoteStatus.Draft)
            return BadRequest("Can only delete draft credit notes");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, creditNote.IssueDate);

        _context.CreditNotes.Remove(creditNote);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private void CalculateTotals(CreditNote creditNote)
    {
        decimal subtotal = 0;
        decimal taxAmount = 0;
        int lineNum = 1;

        foreach (var line in creditNote.Lines)
        {
            if (line.Id == Guid.Empty)
                line.Id = Guid.NewGuid();

            line.CreditNoteId = creditNote.Id;
            line.LineNumber = lineNum++;

            var lineSubtotal = line.Quantity * line.UnitPrice;
            line.TaxAmount = line.IsTaxable ? Math.Round(lineSubtotal * (line.TaxRate / 100m), 2, MidpointRounding.ToEven) : 0m;
            line.LineTotal = lineSubtotal + line.TaxAmount;

            subtotal += lineSubtotal;
            taxAmount += line.TaxAmount;
        }

        creditNote.Subtotal = subtotal;
        creditNote.TaxAmount = taxAmount;
        creditNote.Total = subtotal + taxAmount;
    }

    private async Task<JournalEntry> CreateJournalEntryAsync(CreditNote creditNote)
    {
        var companyId = creditNote.CompanyId;
        var rate = creditNote.ExchangeRate > 0 ? creditNote.ExchangeRate : 1m;

        // 1. Resolve Accounts
        // AR Account: 1-1130 or 1-1200 or contact's default
        var arAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == "1-1130" || a.Code == "1-1200" || a.Name.Contains("Receivable") || a.Name.Contains("Piutang")));
        var arAccountId = arAcc?.Code ?? "1-1130";

        // Revenue Account: 4-1000
        var revAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == "4-1000" || (a.Code.StartsWith("4") && !a.IsHeader)));
        var defaultRevenueCode = revAcc?.Code ?? "4-1000";

        // VAT Out (PPN Keluaran): 2-1300
        var vatOutAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == "2-1300" || a.Code.StartsWith("2130") || a.Name.Contains("Keluaran")));
        var vatOutCode = vatOutAcc?.Code ?? "2-1300";

        var journal = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = creditNote.IssueDate,
            ReferenceNumber = creditNote.CreditNoteNumber,
            ContactId = creditNote.ContactId.ToString(),
            Currency = "IDR",
            Notes = $"Credit Note {creditNote.CreditNoteNumber} - {creditNote.Contact?.Name}",
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        var totalArCredit = Math.Round(creditNote.Total * rate, 2, MidpointRounding.ToEven);
        var totalVatDebit = Math.Round(creditNote.TaxAmount * rate, 2, MidpointRounding.ToEven);
        var totalRevDebit = Math.Round(creditNote.Subtotal * rate, 2, MidpointRounding.ToEven);

        // Debit: Sales Revenue (reduces sales)
        // Group by cost center if any lines specify it
        var revenueGroups = creditNote.Lines.GroupBy(l => l.CostCenterId).ToList();
        if (revenueGroups.Count > 1)
        {
            foreach (var grp in revenueGroups)
            {
                var grpSubtotal = grp.Sum(l => l.Quantity * l.UnitPrice);
                var grpAmount = Math.Round(grpSubtotal * rate, 2, MidpointRounding.ToEven);
                if (grpAmount > 0)
                {
                    journal.Lines.Add(new JournalLine
                    {
                        Id = Guid.NewGuid(),
                        JournalEntryId = journal.Id,
                        AccountId = defaultRevenueCode,
                        Description = $"Sales Return - {creditNote.CreditNoteNumber}",
                        Debit = grpAmount,
                        Credit = 0m,
                        CostCenterId = grp.Key
                    });
                }
            }
        }
        else
        {
            journal.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journal.Id,
                AccountId = defaultRevenueCode,
                Description = $"Sales Return - {creditNote.CreditNoteNumber}",
                Debit = totalRevDebit,
                Credit = 0m,
                CostCenterId = creditNote.Lines.FirstOrDefault()?.CostCenterId
            });
        }

        // Debit: PPN Keluaran (reduces output VAT payable)
        if (totalVatDebit > 0)
        {
            journal.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journal.Id,
                AccountId = vatOutCode,
                Description = $"PPN Keluaran Return - {creditNote.CreditNoteNumber}",
                Debit = totalVatDebit,
                Credit = 0m
            });
        }

        // Credit: Accounts Receivable (reduces customer AR balance)
        journal.Lines.Add(new JournalLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = journal.Id,
            AccountId = arAccountId,
            Description = $"Credit Note {creditNote.CreditNoteNumber} - {creditNote.Contact?.Name}",
            Debit = 0m,
            Credit = totalArCredit
        });

        // Balance guard: Ensure exact penny balance
        var debitSum = journal.Lines.Sum(l => l.Debit);
        var creditSum = journal.Lines.Sum(l => l.Credit);
        if (debitSum != creditSum && journal.Lines.Count > 0)
        {
            var diff = debitSum - creditSum;
            journal.Lines.First(l => l.Credit > 0).Credit += diff;
        }

        _context.JournalEntries.Add(journal);
        return journal;
    }

    private async Task<string> GenerateCreditNoteNumber()
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = $"CN-{yearMonth}-";

        var lastNumber = await _context.CreditNotes
            .Where(c => c.CreditNoteNumber.StartsWith(prefix))
            .OrderByDescending(c => c.CreditNoteNumber)
            .Select(c => c.CreditNoteNumber)
            .FirstOrDefaultAsync();

        var seq = 1;
        if (!string.IsNullOrEmpty(lastNumber) && lastNumber.Length >= prefix.Length + 4)
        {
            if (int.TryParse(lastNumber.Substring(prefix.Length, 4), out var lastSeq))
            {
                seq = lastSeq + 1;
            }
        }

        return $"{prefix}{seq:D4}";
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value
                 ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string? GetCurrentUserEmail() =>
        User.FindFirst("email")?.Value
     ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
     ?? User.Identity?.Name;

    private string GetCurrentUserName() =>
        User.FindFirst("name")?.Value
     ?? GetCurrentUserEmail()
     ?? "System";

    public record VoidRequest(string? Reason);
}
