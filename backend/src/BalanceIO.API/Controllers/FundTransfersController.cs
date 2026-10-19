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
public class FundTransfersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;

    public FundTransfersController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        IDocumentHistoryService historyService)
    {
        _context = context;
        _periodLockService = periodLockService;
        _historyService = historyService;
    }

    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<FundTransfer>>> GetAll(
        [FromQuery] FundTransferStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _context.FundTransfers
            .Include(t => t.FromAccount)
            .Include(t => t.ToAccount)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(t => t.Status == status.Value);

        if (from.HasValue)
            query = query.Where(t => t.TransferDate >= from.Value);

        if (to.HasValue)
            query = query.Where(t => t.TransferDate <= to.Value);

        return await query.OrderByDescending(t => t.TransferDate).ThenByDescending(t => t.CreatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<FundTransfer>> GetById(Guid id)
    {
        var transfer = await _context.FundTransfers
            .Include(t => t.FromAccount)
            .Include(t => t.ToAccount)
            .Include(t => t.JournalEntry)
                .ThenInclude(j => j!.Lines)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (transfer == null)
            return NotFound();

        return transfer;
    }

    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<FundTransfer>> Create(FundTransfer transfer)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;

        if (transfer.Amount <= 0)
            return BadRequest("Transfer amount must be greater than zero");

        if (transfer.FromAccountId == transfer.ToAccountId)
            return BadRequest("Source and destination accounts must be different");

        // Validate accounts belong to company
        var fromAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Id == transfer.FromAccountId);
        var toAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Id == transfer.ToAccountId);

        if (fromAccount == null || toAccount == null)
            return BadRequest("Source or destination account was not found in this company");

        await _periodLockService.ValidateTransactionDate(companyId, transfer.TransferDate);

        if (transfer.Id == Guid.Empty)
            transfer.Id = Guid.NewGuid();

        transfer.CompanyId = companyId;
        transfer.CreatedAt = DateTime.UtcNow;
        transfer.CreatedByUserId = GetCurrentUserId();
        transfer.CreatedBy = GetCurrentUserEmail();
        transfer.Status = FundTransferStatus.Draft;

        if (string.IsNullOrWhiteSpace(transfer.TransferNumber))
        {
            transfer.TransferNumber = await GenerateTransferNumber();
        }

        _context.FundTransfers.Add(transfer);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            transfer.CompanyId,
            "FundTransfer",
            transfer.Id,
            "Created",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Fund transfer {transfer.TransferNumber} created (Rp {transfer.Amount:N0} from {fromAccount.Name} to {toAccount.Name})");

        return CreatedAtAction(nameof(GetById), new { id = transfer.Id }, transfer);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> Update(Guid id, FundTransfer transfer)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var existing = await _context.FundTransfers.FirstOrDefaultAsync(t => t.Id == id);

        if (existing == null)
            return NotFound();

        if (existing.Status != FundTransferStatus.Draft)
            return BadRequest("Cannot edit a posted or voided transfer");

        if (transfer.Amount <= 0)
            return BadRequest("Transfer amount must be greater than zero");

        if (transfer.FromAccountId == transfer.ToAccountId)
            return BadRequest("Source and destination accounts must be different");

        await _periodLockService.ValidateTransactionDate(companyId, existing.TransferDate);
        await _periodLockService.ValidateTransactionDate(companyId, transfer.TransferDate);

        existing.TransferDate = transfer.TransferDate;
        existing.FromAccountId = transfer.FromAccountId;
        existing.ToAccountId = transfer.ToAccountId;
        existing.Amount = transfer.Amount;
        existing.Reference = transfer.Reference;
        existing.Description = transfer.Description;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "FundTransfer",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Fund transfer {existing.TransferNumber} updated");

        return NoContent();
    }

    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var transfer = await _context.FundTransfers
            .Include(t => t.FromAccount)
            .Include(t => t.ToAccount)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (transfer == null)
            return NotFound();

        if (transfer.Status != FundTransferStatus.Draft && transfer.Status != FundTransferStatus.Pending)
            return BadRequest("Only draft transfers can be posted");

        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        if (transfer.CreatedByUserId.HasValue && currentUserId.HasValue &&
            transfer.CreatedByUserId.Value == currentUserId.Value)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                code = "SEGREGATION_OF_DUTIES_VIOLATION",
                message = $"Segregation of Duties Violation: You created fund transfer {transfer.TransferNumber}. Internal controls require an independent reviewer to approve and post it."
            });
        }

        await _periodLockService.ValidateTransactionDate(companyId, transfer.TransferDate);

        // Create Journal Entry
        // Dr: ToAccount (Bank B / Destination)
        // Cr: FromAccount (Bank A / Source)
        var fromAccountCode = transfer.FromAccount?.Code ?? (await _context.Accounts.FindAsync(transfer.FromAccountId))?.Code ?? "1-1100";
        var toAccountCode = transfer.ToAccount?.Code ?? (await _context.Accounts.FindAsync(transfer.ToAccountId))?.Code ?? "1-1110";

        var journal = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = transfer.TransferDate,
            ReferenceNumber = transfer.TransferNumber,
            Currency = "IDR",
            Notes = $"Fund Transfer {transfer.TransferNumber}: {transfer.FromAccount?.Name} -> {transfer.ToAccount?.Name}" + (!string.IsNullOrWhiteSpace(transfer.Reference) ? $" (Ref: {transfer.Reference})" : ""),
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>
            {
                new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = toAccountCode,
                    Description = $"Transfer in from {transfer.FromAccount?.Name ?? transfer.FromAccountId.ToString()} ({transfer.TransferNumber})",
                    Debit = transfer.Amount,
                    Credit = 0m
                },
                new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = fromAccountCode,
                    Description = $"Transfer out to {transfer.ToAccount?.Name ?? transfer.ToAccountId.ToString()} ({transfer.TransferNumber})",
                    Debit = 0m,
                    Credit = transfer.Amount
                }
            }
        };

        _context.JournalEntries.Add(journal);
        transfer.JournalEntryId = journal.Id;
        transfer.Status = FundTransferStatus.Posted;
        transfer.ApprovedByUserId = currentUserId;
        transfer.ApprovedBy = currentEmail;
        transfer.ApprovedAt = DateTime.UtcNow;
        transfer.PostedAt = DateTime.UtcNow;
        transfer.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            transfer.CompanyId,
            "FundTransfer",
            transfer.Id,
            "Posted",
            currentUserId ?? Guid.Empty,
            currentEmail ?? "reviewer",
            $"Fund transfer {transfer.TransferNumber} posted for Rp {transfer.Amount:N0}");

        return Ok(transfer);
    }

    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> Void(Guid id, [FromBody] VoidRequest? request = null)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var transfer = await _context.FundTransfers.FirstOrDefaultAsync(t => t.Id == id);

        if (transfer == null)
            return NotFound();

        if (transfer.Status != FundTransferStatus.Posted)
            return BadRequest("Only posted transfers can be voided");

        await _periodLockService.ValidateTransactionDate(companyId, transfer.TransferDate);

        if (transfer.JournalEntryId.HasValue)
        {
            var je = await _context.JournalEntries.FindAsync(transfer.JournalEntryId.Value);
            if (je != null) je.Status = JournalEntryStatus.Void;
        }

        transfer.Status = FundTransferStatus.Void;
        transfer.VoidedAt = DateTime.UtcNow;
        transfer.UpdatedAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            transfer.Description = string.IsNullOrWhiteSpace(transfer.Description)
                ? $"Void reason: {request.Reason}"
                : $"{transfer.Description}\nVoid reason: {request.Reason}";
        }

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            transfer.CompanyId,
            "FundTransfer",
            transfer.Id,
            "Voided",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Fund transfer {transfer.TransferNumber} voided. Reason: {request?.Reason ?? "N/A"}");

        return Ok(new { message = "Fund transfer voided successfully", status = transfer.Status });
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var transfer = await _context.FundTransfers.FindAsync(id);
        if (transfer == null)
            return NotFound();

        if (transfer.Status != FundTransferStatus.Draft)
            return BadRequest("Can only delete draft fund transfers");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, transfer.TransferDate);

        _context.FundTransfers.Remove(transfer);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<string> GenerateTransferNumber()
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = $"TRF-{yearMonth}-";

        var lastNumber = await _context.FundTransfers
            .Where(t => t.TransferNumber.StartsWith(prefix))
            .OrderByDescending(t => t.TransferNumber)
            .Select(t => t.TransferNumber)
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
