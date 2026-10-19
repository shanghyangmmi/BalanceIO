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
public class DebitNotesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly InventoryLedger _inventory;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;
    private readonly INotificationService _notificationService;

    public DebitNotesController(
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
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<IEnumerable<DebitNote>>> GetAll(
        [FromQuery] Guid? contactId = null,
        [FromQuery] DebitNoteStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _context.DebitNotes
            .Include(d => d.Contact)
            .Include(d => d.PurchaseBill)
            .Include(d => d.Warehouse)
            .AsQueryable();

        if (contactId.HasValue)
            query = query.Where(d => d.ContactId == contactId.Value);

        if (status.HasValue)
            query = query.Where(d => d.Status == status.Value);

        if (from.HasValue)
            query = query.Where(d => d.IssueDate >= from.Value);

        if (to.HasValue)
            query = query.Where(d => d.IssueDate <= to.Value);

        return await query.OrderByDescending(d => d.IssueDate).ThenByDescending(d => d.CreatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<DebitNote>> GetById(Guid id)
    {
        var debitNote = await _context.DebitNotes
            .Include(d => d.Contact)
            .Include(d => d.PurchaseBill)
            .Include(d => d.Warehouse)
            .Include(d => d.Lines)
                .ThenInclude(l => l.Product)
            .Include(d => d.Lines)
                .ThenInclude(l => l.CostCenter)
            .Include(d => d.JournalEntry)
                .ThenInclude(j => j!.Lines)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (debitNote == null)
            return NotFound();

        return debitNote;
    }

    [HttpPost]
    [RequiresPermission(Permissions.PurchasesCreate)]
    public async Task<ActionResult<DebitNote>> Create(DebitNote debitNote)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, debitNote.IssueDate);

        if (debitNote.Id == Guid.Empty)
            debitNote.Id = Guid.NewGuid();

        debitNote.CompanyId = _context.CurrentCompanyId.Value;
        debitNote.CreatedAt = DateTime.UtcNow;
        debitNote.CreatedByUserId = GetCurrentUserId();
        debitNote.CreatedBy = GetCurrentUserEmail();
        debitNote.Status = DebitNoteStatus.Draft;

        if (string.IsNullOrWhiteSpace(debitNote.DebitNoteNumber))
        {
            debitNote.DebitNoteNumber = await GenerateDebitNoteNumber();
        }

        CalculateTotals(debitNote);

        _context.DebitNotes.Add(debitNote);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            debitNote.CompanyId,
            "DebitNote",
            debitNote.Id,
            "Created",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Debit note {debitNote.DebitNoteNumber} created as draft");

        return CreatedAtAction(nameof(GetById), new { id = debitNote.Id }, debitNote);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.PurchasesEdit)]
    public async Task<IActionResult> Update(Guid id, DebitNote debitNote)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var existing = await _context.DebitNotes
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (existing == null)
            return NotFound();

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, existing.IssueDate);
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, debitNote.IssueDate);

        if (existing.Status != DebitNoteStatus.Draft)
            return BadRequest("Cannot edit a posted or voided debit note");

        existing.IssueDate = debitNote.IssueDate;
        existing.ContactId = debitNote.ContactId;
        existing.PurchaseBillId = debitNote.PurchaseBillId;
        existing.WarehouseId = debitNote.WarehouseId;
        existing.ReturnToInventory = debitNote.ReturnToInventory;
        existing.Reason = debitNote.Reason;
        existing.Currency = debitNote.Currency;
        existing.ExchangeRate = debitNote.ExchangeRate;
        existing.Notes = debitNote.Notes;
        existing.TemplateName = debitNote.TemplateName;

        _context.DebitNoteLines.RemoveRange(existing.Lines);
        existing.Lines = debitNote.Lines;

        CalculateTotals(existing);
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "DebitNote",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Debit note {existing.DebitNoteNumber} updated");

        return NoContent();
    }

    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.PurchasesApprove)]
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var debitNote = await _context.DebitNotes
            .Include(d => d.Contact)
            .Include(d => d.PurchaseBill)
            .Include(d => d.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (debitNote == null)
            return NotFound();

        if (debitNote.Status != DebitNoteStatus.Draft && debitNote.Status != DebitNoteStatus.Pending)
            return BadRequest("Only draft debit notes can be posted");

        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        if (debitNote.CreatedByUserId.HasValue && currentUserId.HasValue &&
            debitNote.CreatedByUserId.Value == currentUserId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "SEGREGATION_OF_DUTIES_VIOLATION",
                message = $"Segregation of Duties Violation: You created debit note {debitNote.DebitNoteNumber}. Internal controls require an independent reviewer to approve and post it."
            });
        }

        await _periodLockService.ValidateTransactionDate(companyId, debitNote.IssueDate);

        // Create Journal Entry (Dr Trade Payables, Cr PPN Masukan, Cr Inventory/Expense)
        var journalEntry = await CreateJournalEntryAsync(debitNote);
        debitNote.JournalEntryId = journalEntry.Id;

        // Process Inventory Return to vendor if requested
        if (debitNote.ReturnToInventory)
        {
            var warehouseId = await _inventory.ResolveAsync(companyId, debitNote.WarehouseId);
            debitNote.WarehouseId = warehouseId;

            foreach (var line in debitNote.Lines)
            {
                if (line.ProductId.HasValue && line.Product != null && line.Product.TrackInventory)
                {
                    await _inventory.MoveAsync(
                        product: line.Product,
                        warehouseId: warehouseId,
                        quantity: -line.Quantity, // Negative: removes stock to return to vendor
                        type: InventoryMovementType.Purchase,
                        date: debitNote.IssueDate,
                        totalCost: -line.LineTotal, // Signed cost deduction
                        reference: debitNote.DebitNoteNumber,
                        journalEntryId: journalEntry.Id,
                        notes: $"Stock returned to vendor via Debit Note {debitNote.DebitNoteNumber}",
                        reversal: true);
                }
            }
        }

        // Adjust Purchase Bill balance if linked
        if (debitNote.PurchaseBillId.HasValue && debitNote.PurchaseBill != null)
        {
            debitNote.PurchaseBill.AmountDue = Math.Max(0m, debitNote.PurchaseBill.AmountDue - debitNote.Total);
            if (debitNote.PurchaseBill.AmountDue == 0m)
            {
                debitNote.PurchaseBill.Status = BillStatus.Paid;
            }
            debitNote.PurchaseBill.UpdatedAt = DateTime.UtcNow;
        }

        debitNote.Status = DebitNoteStatus.Posted;
        debitNote.ApprovedByUserId = currentUserId;
        debitNote.ApprovedBy = currentEmail;
        debitNote.ApprovedAt = DateTime.UtcNow;
        debitNote.PostedAt = DateTime.UtcNow;
        debitNote.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            debitNote.CompanyId,
            "DebitNote",
            debitNote.Id,
            "Posted",
            currentUserId ?? Guid.Empty,
            currentEmail ?? "reviewer",
            $"Debit note {debitNote.DebitNoteNumber} posted for Rp {debitNote.Total:N0}");

        return Ok(debitNote);
    }

    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.PurchasesApprove)]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidRequest? request = null)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var debitNote = await _context.DebitNotes
            .Include(d => d.PurchaseBill)
            .Include(d => d.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (debitNote == null)
            return NotFound();

        if (debitNote.Status != DebitNoteStatus.Posted)
            return BadRequest("Only posted debit notes can be voided");

        await _periodLockService.ValidateTransactionDate(companyId, debitNote.IssueDate);

        // Void Journal Entry
        if (debitNote.JournalEntryId.HasValue)
        {
            var je = await _context.JournalEntries.FindAsync(debitNote.JournalEntryId.Value);
            if (je != null) je.Status = JournalEntryStatus.Void;
        }

        // Reverse stock return if stock was removed
        if (debitNote.ReturnToInventory && debitNote.WarehouseId.HasValue)
        {
            foreach (var line in debitNote.Lines)
            {
                if (line.ProductId.HasValue && line.Product != null && line.Product.TrackInventory)
                {
                    await _inventory.MoveAsync(
                        product: line.Product,
                        warehouseId: debitNote.WarehouseId.Value,
                        quantity: line.Quantity, // Add back stock
                        type: InventoryMovementType.Purchase,
                        date: DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
                        totalCost: line.LineTotal,
                        reference: $"VOID-{debitNote.DebitNoteNumber}",
                        journalEntryId: debitNote.JournalEntryId,
                        notes: $"Void of stock return from Debit Note {debitNote.DebitNoteNumber}",
                        reversal: false);
                }
            }
        }

        // Restore Purchase Bill balance
        if (debitNote.PurchaseBillId.HasValue && debitNote.PurchaseBill != null)
        {
            debitNote.PurchaseBill.AmountDue += debitNote.Total;
            if (debitNote.PurchaseBill.Status == BillStatus.Paid && debitNote.PurchaseBill.AmountDue > 0)
            {
                debitNote.PurchaseBill.Status = BillStatus.Posted;
            }
            debitNote.PurchaseBill.UpdatedAt = DateTime.UtcNow;
        }

        debitNote.Status = DebitNoteStatus.Void;
        debitNote.VoidedAt = DateTime.UtcNow;
        debitNote.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            debitNote.Notes = string.IsNullOrWhiteSpace(debitNote.Notes)
                ? $"Void reason: {request.Reason}"
                : $"{debitNote.Notes}\nVoid reason: {request.Reason}";
        }

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            debitNote.CompanyId,
            "DebitNote",
            debitNote.Id,
            "Voided",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Debit note {debitNote.DebitNoteNumber} voided. Reason: {request?.Reason ?? "N/A"}");

        return Ok(new { message = "Debit note voided successfully", status = debitNote.Status });
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.PurchasesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var debitNote = await _context.DebitNotes.FindAsync(id);
        if (debitNote == null)
            return NotFound();

        if (debitNote.Status != DebitNoteStatus.Draft)
            return BadRequest("Can only delete draft debit notes");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, debitNote.IssueDate);

        _context.DebitNotes.Remove(debitNote);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private void CalculateTotals(DebitNote debitNote)
    {
        decimal subtotal = 0;
        decimal taxAmount = 0;
        int lineNum = 1;

        foreach (var line in debitNote.Lines)
        {
            if (line.Id == Guid.Empty)
                line.Id = Guid.NewGuid();

            line.DebitNoteId = debitNote.Id;
            line.LineNumber = lineNum++;

            var lineSubtotal = line.Quantity * line.UnitPrice;
            line.TaxAmount = line.IsTaxable ? Math.Round(lineSubtotal * (line.TaxRate / 100m), 2, MidpointRounding.ToEven) : 0m;
            line.LineTotal = lineSubtotal + line.TaxAmount;

            subtotal += lineSubtotal;
            taxAmount += line.TaxAmount;
        }

        debitNote.Subtotal = subtotal;
        debitNote.TaxAmount = taxAmount;
        debitNote.Total = subtotal + taxAmount;
    }

    private async Task<JournalEntry> CreateJournalEntryAsync(DebitNote debitNote)
    {
        var companyId = debitNote.CompanyId;
        var rate = debitNote.ExchangeRate > 0 ? debitNote.ExchangeRate : 1m;

        // 1. Resolve Accounts
        // AP Account: 2-1100 Trade Payables
        var apAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == "2-1100" || a.Code.StartsWith("2110") || a.Name.Contains("Payable") || a.Name.Contains("Utang Usaha")));
        var apAccountId = apAcc?.Code ?? "2-1100";

        // Expense / Inventory Account: 5-1000 or 1-1400 or line AccountId
        var defaultExpAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == "5-1000" || a.Code.StartsWith("5100") || (a.Code.StartsWith("5") && !a.IsHeader)));
        var defaultExpenseCode = defaultExpAcc?.Code ?? "5-1000";

        // VAT In (PPN Masukan): 1-1700
        var vatInAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == "1-1700" || a.Code.StartsWith("1170") || a.Name.Contains("Masukan")));
        var vatInCode = vatInAcc?.Code ?? "1-1700";

        var journal = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = debitNote.IssueDate,
            ReferenceNumber = debitNote.DebitNoteNumber,
            ContactId = debitNote.ContactId.ToString(),
            Currency = "IDR",
            Notes = $"Debit Note {debitNote.DebitNoteNumber} - {debitNote.Contact?.Name}",
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        var totalApDebit = Math.Round(debitNote.Total * rate, 2, MidpointRounding.ToEven);
        var totalVatCredit = Math.Round(debitNote.TaxAmount * rate, 2, MidpointRounding.ToEven);
        var totalExpCredit = Math.Round(debitNote.Subtotal * rate, 2, MidpointRounding.ToEven);

        // Debit: Trade Payables (reduces vendor AP liability)
        journal.Lines.Add(new JournalLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = journal.Id,
            AccountId = apAccountId,
            Description = $"Debit Note {debitNote.DebitNoteNumber} - {debitNote.Contact?.Name}",
            Debit = totalApDebit,
            Credit = 0m
        });

        // Credit: PPN Masukan (reduces input VAT claimable)
        if (totalVatCredit > 0)
        {
            journal.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journal.Id,
                AccountId = vatInCode,
                Description = $"PPN Masukan Return - {debitNote.DebitNoteNumber}",
                Debit = 0m,
                Credit = totalVatCredit
            });
        }

        // Credit: Cost of Goods / Inventory / Expense (reverses purchase cost)
        var expenseGroups = debitNote.Lines.GroupBy(l => l.CostCenterId).ToList();
        if (expenseGroups.Count > 1)
        {
            foreach (var grp in expenseGroups)
            {
                var grpSubtotal = grp.Sum(l => l.Quantity * l.UnitPrice);
                var grpAmount = Math.Round(grpSubtotal * rate, 2, MidpointRounding.ToEven);
                if (grpAmount > 0)
                {
                    journal.Lines.Add(new JournalLine
                    {
                        Id = Guid.NewGuid(),
                        JournalEntryId = journal.Id,
                        AccountId = defaultExpenseCode,
                        Description = $"Purchase Return - {debitNote.DebitNoteNumber}",
                        Debit = 0m,
                        Credit = grpAmount,
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
                AccountId = defaultExpenseCode,
                Description = $"Purchase Return - {debitNote.DebitNoteNumber}",
                Debit = 0m,
                Credit = totalExpCredit,
                CostCenterId = debitNote.Lines.FirstOrDefault()?.CostCenterId
            });
        }

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

    private async Task<string> GenerateDebitNoteNumber()
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = $"DN-{yearMonth}-";

        var lastNumber = await _context.DebitNotes
            .Where(d => d.DebitNoteNumber.StartsWith(prefix))
            .OrderByDescending(d => d.DebitNoteNumber)
            .Select(d => d.DebitNoteNumber)
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
