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
public class ReceiptVouchersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;

    public ReceiptVouchersController(ApplicationDbContext context, IPeriodLockService periodLockService)
    {
        _context = context;
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

    // GET: api/receiptvouchers
    [HttpGet]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<IEnumerable<ReceiptVoucher>>> GetAll(
        [FromQuery] ReceiptVoucherStatus? status = null,
        [FromQuery] Guid? contactId = null)
    {
        var query = _context.ReceiptVouchers
            .Include(r => r.Contact)
            .Include(r => r.DepositAccount)
            .Include(r => r.Lines)
                .ThenInclude(l => l.SalesInvoice)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(r => r.Status == status);

        if (contactId.HasValue)
            query = query.Where(r => r.ContactId == contactId);

        var vouchers = await query
            .OrderByDescending(r => r.ReceiptDate)
            .ThenByDescending(r => r.CreatedAt)
            .ToListAsync();

        return Ok(vouchers);
    }

    // GET: api/receiptvouchers/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<ReceiptVoucher>> GetById(Guid id)
    {
        var voucher = await _context.ReceiptVouchers
            .Include(r => r.Contact)
            .Include(r => r.DepositAccount)
            .Include(r => r.JournalEntry)
            .Include(r => r.Lines)
                .ThenInclude(l => l.SalesInvoice)
            .Include(r => r.Lines)
                .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (voucher == null)
            return NotFound();

        return Ok(voucher);
    }

    // POST: api/receiptvouchers
    [HttpPost]
    [RequiresPermission(Permissions.SalesCreate)]
    public async Task<ActionResult<ReceiptVoucher>> Create(ReceiptVoucher voucher)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        // Period lock check
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, voucher.ReceiptDate);

        if (voucher.Id == Guid.Empty)
            voucher.Id = Guid.NewGuid();

        voucher.CompanyId = _context.CurrentCompanyId.Value;
        voucher.CreatedAt = DateTime.UtcNow;
        voucher.CreatedByUserId = GetCurrentUserId();
        voucher.CreatedBy = GetCurrentUserEmail();
        voucher.Status = ReceiptVoucherStatus.Draft;

        if (string.IsNullOrWhiteSpace(voucher.VoucherNumber))
        {
            voucher.VoucherNumber = await GenerateVoucherNumber();
        }

        // Calculate total amount from lines
        decimal total = 0;
        int lineNum = 1;
        foreach (var line in voucher.Lines)
        {
            if (line.Id == Guid.Empty)
                line.Id = Guid.NewGuid();

            line.ReceiptVoucherId = voucher.Id;
            line.LineNumber = lineNum++;
            total += line.Amount;
        }

        voucher.TotalAmount = total;

        _context.ReceiptVouchers.Add(voucher);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = voucher.Id }, voucher);
    }

    // POST: api/receiptvouchers/{id}/post
    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var company = await _context.Companies.FindAsync(_context.CurrentCompanyId.Value);
        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        var voucher = await _context.ReceiptVouchers
            .Include(r => r.Contact)
            .Include(r => r.DepositAccount)
            .Include(r => r.Lines)
                .ThenInclude(l => l.SalesInvoice)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (voucher == null)
            return NotFound();

        // ── SEGREGATION OF DUTIES (SoD) GUARD ────────────────────────────────
        // The creator of a receipt voucher cannot approve/post it.
        if (company != null && company.EnforceSegregationOfDuties)
        {
            bool isCreator = (voucher.CreatedByUserId.HasValue && voucher.CreatedByUserId == currentUserId)
                          || (!string.IsNullOrEmpty(voucher.CreatedBy) && string.Equals(voucher.CreatedBy, currentEmail, StringComparison.OrdinalIgnoreCase));

            if (isCreator)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new 
                { 
                    message = $"Segregation of Duties Violation: You created receipt voucher {voucher.VoucherNumber} ({voucher.CreatedBy ?? "current user"}). Internal control policy requires a second authorized reviewer to approve this receipt.",
                    code = "SEGREGATION_OF_DUTIES_VIOLATION",
                    createdBy = voucher.CreatedBy
                });
            }
        }

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, voucher.ReceiptDate);

        if (voucher.Status != ReceiptVoucherStatus.Draft && voucher.Status != ReceiptVoucherStatus.Pending)
            return BadRequest("Only draft or pending receipt vouchers can be posted");

        // 1. Create and post balanced Journal Entry
        var journalEntry = await CreateJournalEntry(voucher);

        voucher.JournalEntryId = journalEntry.Id;
        voucher.Status = ReceiptVoucherStatus.Posted;
        voucher.ApprovedByUserId = currentUserId;
        voucher.ApprovedBy = currentEmail;
        voucher.ApprovedAt = DateTime.UtcNow;
        voucher.PostedAt = DateTime.UtcNow;

        // 2. Settle customer invoice(s)
        foreach (var line in voucher.Lines)
        {
            if (line.SalesInvoiceId.HasValue)
            {
                var invoice = line.SalesInvoice ?? await _context.SalesInvoices.FindAsync(line.SalesInvoiceId.Value);
                if (invoice != null && invoice.Status != InvoiceStatus.Void)
                {
                    invoice.AmountPaid += line.Amount;
                    invoice.AmountDue = Math.Max(0, invoice.Total - invoice.AmountPaid);

                    if (invoice.AmountDue <= 0)
                        invoice.Status = InvoiceStatus.Paid;
                    else
                        invoice.Status = InvoiceStatus.PartiallyPaid;

                    invoice.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            Action = "POST",
            TargetEntity = "ReceiptVoucher:" + voucher.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Posted receipt voucher {voucher.VoucherNumber} for {voucher.TotalAmount:N2}. Settled AR.",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Receipt voucher posted successfully", voucher, journalEntryId = journalEntry.Id });
    }

    // POST: api/receiptvouchers/{id}/void
    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.SalesEdit)]
    public async Task<IActionResult> Void(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var voucher = await _context.ReceiptVouchers
            .Include(r => r.Lines)
                .ThenInclude(l => l.SalesInvoice)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (voucher == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, voucher.ReceiptDate);

        if (voucher.Status == ReceiptVoucherStatus.Void)
            return BadRequest("Voucher is already voided");

        // 1. Void Journal Entry
        if (voucher.JournalEntryId.HasValue)
        {
            var journalEntry = await _context.JournalEntries.FindAsync(voucher.JournalEntryId.Value);
            if (journalEntry != null)
            {
                journalEntry.Status = JournalEntryStatus.Void;
            }
        }

        // 2. Reverse Invoice Settlement
        if (voucher.Status == ReceiptVoucherStatus.Posted)
        {
            foreach (var line in voucher.Lines)
            {
                if (line.SalesInvoiceId.HasValue)
                {
                    var invoice = line.SalesInvoice ?? await _context.SalesInvoices.FindAsync(line.SalesInvoiceId.Value);
                    if (invoice != null)
                    {
                        invoice.AmountPaid = Math.Max(0, invoice.AmountPaid - line.Amount);
                        invoice.AmountDue = invoice.Total - invoice.AmountPaid;

                        if (invoice.AmountDue >= invoice.Total)
                            invoice.Status = InvoiceStatus.Sent; // Or Posted
                        else
                            invoice.Status = InvoiceStatus.PartiallyPaid;

                        invoice.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }
        }

        voucher.Status = ReceiptVoucherStatus.Void;
        voucher.VoidedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            Action = "VOID",
            TargetEntity = "ReceiptVoucher:" + voucher.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Voided receipt voucher {voucher.VoucherNumber}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Receipt voucher voided successfully" });
    }

    #region Helpers

    private async Task<string> GenerateVoucherNumber()
    {
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        var prefix = $"RCV-{year}{month:D2}";

        var count = await _context.ReceiptVouchers
            .CountAsync(r => r.VoucherNumber.StartsWith(prefix));

        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }

    private async Task<JournalEntry> CreateJournalEntry(ReceiptVoucher voucher)
    {
        var companyId = _context.CurrentCompanyId!.Value;
        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = voucher.ReceiptDate,
            ReferenceNumber = voucher.VoucherNumber,
            ContactId = voucher.ContactId?.ToString(),
            Currency = "IDR",
            Notes = $"Receipt Voucher {voucher.VoucherNumber} - {voucher.Contact?.Name ?? voucher.Description ?? "Payment Receipt"}",
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        var depositAccount = voucher.DepositAccount ?? await _context.Accounts.FindAsync(voucher.DepositAccountId);
        var depositAccountIdStr = (depositAccount?.Id ?? voucher.DepositAccountId).ToString();

        var voucherRate = (voucher.Currency != "IDR" && voucher.ExchangeRate > 0) ? voucher.ExchangeRate : 1m;
        decimal totalSettlementBankIdr = 0;
        decimal totalBookedArIdr = 0;

        var arLines = new List<JournalLine>();

        // 1. Calculate AR lines and booked carrying IDR
        foreach (var line in voucher.Lines)
        {
            var lineInvoice = line.SalesInvoice;
            if (lineInvoice == null && line.SalesInvoiceId.HasValue)
            {
                lineInvoice = await _context.SalesInvoices.FindAsync(line.SalesInvoiceId.Value);
            }

            var invoiceRate = (lineInvoice != null && lineInvoice.Currency != "IDR" && lineInvoice.ExchangeRate > 0)
                ? lineInvoice.ExchangeRate
                : voucherRate;

            var bookedAmountIdr = line.Amount * invoiceRate;
            var settlementAmountIdr = line.Amount * voucherRate;

            totalBookedArIdr += bookedAmountIdr;
            totalSettlementBankIdr += settlementAmountIdr;

            var arAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "1-1200");

            if (line.AccountId.HasValue)
            {
                var directAcc = await _context.Accounts.FindAsync(line.AccountId.Value);
                if (directAcc != null) arAccount = directAcc;
            }
            else if (voucher.Contact?.DefaultReceivableAccountId.HasValue == true)
            {
                var contactAr = await _context.Accounts.FindAsync(voucher.Contact.DefaultReceivableAccountId.Value);
                if (contactAr != null) arAccount = contactAr;
            }

            var arAccountIdStr = (arAccount?.Id ?? Guid.Empty).ToString();

            arLines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = arAccountIdStr,
                Debit = 0,
                Credit = bookedAmountIdr,
                Description = line.Description ?? $"Payment applied to {lineInvoice?.InvoiceNumber ?? "AR"}"
            });
        }

        // 2. Debit Deposit Account (Cash / Bank) for settlement IDR
        journalEntry.Lines.Add(new JournalLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = journalEntry.Id,
            AccountId = depositAccountIdStr,
            Debit = totalSettlementBankIdr,
            Credit = 0,
            Description = $"Receipt {voucher.VoucherNumber} to {depositAccount?.Name ?? "Bank"}"
        });

        // 3. Add AR credit lines
        journalEntry.Lines.AddRange(arLines);

        // 4. Realised Foreign Exchange Difference
        var delta = totalSettlementBankIdr - totalBookedArIdr;
        if (delta > 0)
        {
            // Received more IDR than carrying AR -> Credit FX Gain (7-2000)
            var fxGainAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "7-2000")
                ?? await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Name.Contains("Gain"));

            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = (fxGainAccount?.Id ?? Guid.Empty).ToString(),
                Debit = 0,
                Credit = delta,
                Description = $"Realised FX Gain on {voucher.VoucherNumber}"
            });
        }
        else if (delta < 0)
        {
            // Received less IDR than carrying AR -> Debit FX Loss (8-3000)
            var fxLossAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "8-3000")
                ?? await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Name.Contains("Loss"));

            var lossVal = Math.Abs(delta);
            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = (fxLossAccount?.Id ?? Guid.Empty).ToString(),
                Debit = lossVal,
                Credit = 0,
                Description = $"Realised FX Loss on {voucher.VoucherNumber}"
            });
        }

        _context.JournalEntries.Add(journalEntry);
        return journalEntry;
    }

    #endregion
}
