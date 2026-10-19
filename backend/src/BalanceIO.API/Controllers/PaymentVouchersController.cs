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
public class PaymentVouchersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;

    public PaymentVouchersController(ApplicationDbContext context, IPeriodLockService periodLockService)
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

    // GET: api/paymentvouchers
    [HttpGet]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<IEnumerable<PaymentVoucher>>> GetAll(
        [FromQuery] PaymentVoucherStatus? status = null,
        [FromQuery] Guid? contactId = null)
    {
        var query = _context.PaymentVouchers
            .Include(p => p.Contact)
            .Include(p => p.PaymentAccount)
            .Include(p => p.Lines)
                .ThenInclude(l => l.PurchaseBill)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(p => p.Status == status);

        if (contactId.HasValue)
            query = query.Where(p => p.ContactId == contactId);

        var vouchers = await query
            .OrderByDescending(p => p.PaymentDate)
            .ThenByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(vouchers);
    }

    // GET: api/paymentvouchers/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<PaymentVoucher>> GetById(Guid id)
    {
        var voucher = await _context.PaymentVouchers
            .Include(p => p.Contact)
            .Include(p => p.PaymentAccount)
            .Include(p => p.JournalEntry)
            .Include(p => p.Lines)
                .ThenInclude(l => l.PurchaseBill)
            .Include(p => p.Lines)
                .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (voucher == null)
            return NotFound();

        return Ok(voucher);
    }

    // POST: api/paymentvouchers
    [HttpPost]
    [RequiresPermission(Permissions.PurchasesCreate)]
    public async Task<ActionResult<PaymentVoucher>> Create(PaymentVoucher voucher)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        // Period lock check
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, voucher.PaymentDate);

        if (voucher.Id == Guid.Empty)
            voucher.Id = Guid.NewGuid();

        voucher.CompanyId = _context.CurrentCompanyId.Value;
        voucher.CreatedAt = DateTime.UtcNow;
        voucher.CreatedByUserId = GetCurrentUserId();
        voucher.CreatedBy = GetCurrentUserEmail();
        voucher.Status = PaymentVoucherStatus.Draft;

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

            line.PaymentVoucherId = voucher.Id;
            line.LineNumber = lineNum++;
            line.TotalAmount = line.Amount;
            total += line.Amount;
        }

        voucher.TotalAmount = total;

        _context.PaymentVouchers.Add(voucher);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = voucher.Id }, voucher);
    }

    // POST: api/paymentvouchers/{id}/post
    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.PurchasesApprove)]
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var company = await _context.Companies.FindAsync(_context.CurrentCompanyId.Value);
        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        var voucher = await _context.PaymentVouchers
            .Include(p => p.Contact)
            .Include(p => p.PaymentAccount)
            .Include(p => p.Lines)
                .ThenInclude(l => l.PurchaseBill)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (voucher == null)
            return NotFound();

        // ── SEGREGATION OF DUTIES (SoD) GUARD ────────────────────────────────
        // The creator of a payment voucher cannot approve/post it.
        if (company != null && company.EnforceSegregationOfDuties)
        {
            bool isCreator = (voucher.CreatedByUserId.HasValue && voucher.CreatedByUserId == currentUserId)
                          || (!string.IsNullOrEmpty(voucher.CreatedBy) && string.Equals(voucher.CreatedBy, currentEmail, StringComparison.OrdinalIgnoreCase));

            if (isCreator)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new 
                { 
                    message = $"Segregation of Duties Violation: You created payment voucher {voucher.VoucherNumber} ({voucher.CreatedBy ?? "current user"}). Internal control policy requires a second authorized reviewer to approve this payment.",
                    code = "SEGREGATION_OF_DUTIES_VIOLATION",
                    createdBy = voucher.CreatedBy
                });
            }
        }

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, voucher.PaymentDate);

        if (voucher.Status != PaymentVoucherStatus.Draft && voucher.Status != PaymentVoucherStatus.Pending)
            return BadRequest("Only draft or pending payment vouchers can be posted");

        // 1. Create and post balanced Journal Entry
        var journalEntry = await CreateJournalEntry(voucher);

        voucher.JournalEntryId = journalEntry.Id;
        voucher.Status = PaymentVoucherStatus.Posted;
        voucher.ApprovedByUserId = currentUserId;
        voucher.ApprovedBy = currentEmail;
        voucher.ApprovedAt = DateTime.UtcNow;
        voucher.PostedAt = DateTime.UtcNow;

        // 2. Settle vendor bill(s)
        foreach (var line in voucher.Lines)
        {
            if (line.PurchaseBillId.HasValue)
            {
                var bill = line.PurchaseBill ?? await _context.PurchaseBills.FindAsync(line.PurchaseBillId.Value);
                if (bill != null && bill.Status != BillStatus.Void)
                {
                    bill.AmountPaid += line.Amount;
                    var netPayable = bill.Total - bill.WithholdingTaxAmount;
                    bill.AmountDue = Math.Max(0, netPayable - bill.AmountPaid);

                    if (bill.AmountDue <= 0)
                        bill.Status = BillStatus.Paid;
                    else
                        bill.Status = BillStatus.PartiallyPaid;

                    bill.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            Action = "POST",
            TargetEntity = "PaymentVoucher:" + voucher.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Posted payment voucher {voucher.VoucherNumber} for {voucher.TotalAmount:N2}. Settled AP.",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Payment voucher posted successfully", voucher, journalEntryId = journalEntry.Id });
    }

    // POST: api/paymentvouchers/{id}/void
    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.PurchasesEdit)]
    public async Task<IActionResult> Void(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var voucher = await _context.PaymentVouchers
            .Include(p => p.Lines)
                .ThenInclude(l => l.PurchaseBill)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (voucher == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, voucher.PaymentDate);

        if (voucher.Status == PaymentVoucherStatus.Void)
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

        // 2. Reverse Bill Settlement
        if (voucher.Status == PaymentVoucherStatus.Posted)
        {
            foreach (var line in voucher.Lines)
            {
                if (line.PurchaseBillId.HasValue)
                {
                    var bill = line.PurchaseBill ?? await _context.PurchaseBills.FindAsync(line.PurchaseBillId.Value);
                    if (bill != null)
                    {
                        bill.AmountPaid = Math.Max(0, bill.AmountPaid - line.Amount);
                        var netPayable = bill.Total - bill.WithholdingTaxAmount;
                        bill.AmountDue = Math.Max(0, netPayable - bill.AmountPaid);

                        if (bill.AmountDue >= netPayable)
                            bill.Status = BillStatus.Posted;
                        else
                            bill.Status = BillStatus.PartiallyPaid;

                        bill.UpdatedAt = DateTime.UtcNow;
                    }
                }
            }
        }

        voucher.Status = PaymentVoucherStatus.Void;
        voucher.VoidedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            Action = "VOID",
            TargetEntity = "PaymentVoucher:" + voucher.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Voided payment voucher {voucher.VoucherNumber}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Payment voucher voided successfully" });
    }

    #region Helpers

    private async Task<string> GenerateVoucherNumber()
    {
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        var prefix = $"PMT-{year}{month:D2}";

        var count = await _context.PaymentVouchers
            .CountAsync(p => p.VoucherNumber.StartsWith(prefix));

        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }

    private async Task<JournalEntry> CreateJournalEntry(PaymentVoucher voucher)
    {
        var companyId = _context.CurrentCompanyId!.Value;
        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = voucher.PaymentDate,
            ReferenceNumber = voucher.VoucherNumber,
            ContactId = voucher.ContactId?.ToString(),
            Currency = "IDR",
            Notes = $"Payment Voucher {voucher.VoucherNumber} - {voucher.Contact?.Name ?? voucher.Description ?? "Payment to Vendor"}",
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        var paymentAccount = voucher.PaymentAccount ?? await _context.Accounts.FindAsync(voucher.PaymentAccountId);
        var paymentAccountIdStr = (paymentAccount?.Id ?? voucher.PaymentAccountId).ToString();

        var voucherRate = (voucher.Currency != "IDR" && voucher.ExchangeRate > 0) ? voucher.ExchangeRate : 1m;
        decimal totalSettlementBankIdr = 0;
        decimal totalBookedApIdr = 0;

        var apLines = new List<JournalLine>();

        // 1. Calculate AP lines and booked carrying IDR
        foreach (var line in voucher.Lines)
        {
            var lineBill = line.PurchaseBill;
            if (lineBill == null && line.PurchaseBillId.HasValue)
            {
                lineBill = await _context.PurchaseBills.FindAsync(line.PurchaseBillId.Value);
            }

            var billRate = (lineBill != null && lineBill.Currency != "IDR" && lineBill.ExchangeRate > 0)
                ? lineBill.ExchangeRate
                : voucherRate;

            var bookedAmountIdr = line.Amount * billRate;
            var settlementAmountIdr = line.Amount * voucherRate;

            totalBookedApIdr += bookedAmountIdr;
            totalSettlementBankIdr += settlementAmountIdr;

            var apAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "2-1100");

            if (line.AccountId.HasValue)
            {
                var directAcc = await _context.Accounts.FindAsync(line.AccountId.Value);
                if (directAcc != null) apAccount = directAcc;
            }
            else if (voucher.Contact?.DefaultPayableAccountId.HasValue == true)
            {
                var contactAp = await _context.Accounts.FindAsync(voucher.Contact.DefaultPayableAccountId.Value);
                if (contactAp != null) apAccount = contactAp;
            }

            var apAccountIdStr = (apAccount?.Id ?? Guid.Empty).ToString();

            apLines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = apAccountIdStr,
                Debit = bookedAmountIdr,
                Credit = 0,
                Description = line.Description ?? $"Payment applied to {lineBill?.BillNumber ?? "AP"}"
            });
        }

        // 2. Add AP debit lines
        journalEntry.Lines.AddRange(apLines);

        // 3. Credit Payment Account (Cash / Bank) for settlement IDR
        journalEntry.Lines.Add(new JournalLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = journalEntry.Id,
            AccountId = paymentAccountIdStr,
            Debit = 0,
            Credit = totalSettlementBankIdr,
            Description = $"Payment {voucher.VoucherNumber} from {paymentAccount?.Name ?? "Bank"}"
        });

        // 4. Realised Foreign Exchange Difference
        var delta = totalSettlementBankIdr - totalBookedApIdr;
        if (delta > 0)
        {
            // Paid more IDR to clear foreign debt -> Debit FX Loss (8-3000)
            var fxLossAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "8-3000")
                ?? await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Name.Contains("Loss"));

            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = (fxLossAccount?.Id ?? Guid.Empty).ToString(),
                Debit = delta,
                Credit = 0,
                Description = $"Realised FX Loss on {voucher.VoucherNumber}"
            });
        }
        else if (delta < 0)
        {
            // Paid less IDR to clear foreign debt -> Credit FX Gain (7-2000)
            var fxGainAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "7-2000")
                ?? await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Name.Contains("Gain"));

            var gainVal = Math.Abs(delta);
            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = (fxGainAccount?.Id ?? Guid.Empty).ToString(),
                Debit = 0,
                Credit = gainVal,
                Description = $"Realised FX Gain on {voucher.VoucherNumber}"
            });
        }

        _context.JournalEntries.Add(journalEntry);
        return journalEntry;
    }

    #endregion
}
