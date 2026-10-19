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
public class PurchaseBillsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly BalanceIO.API.Services.InventoryLedger _inventory;
    private readonly IDocumentHistoryService _historyService;

    public PurchaseBillsController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        BalanceIO.API.Services.InventoryLedger inventory,
        IDocumentHistoryService historyService)
    {
        _inventory = inventory;
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

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.Identity?.Name 
            ?? "accountant@balanceio.id";
    }

    // GET: api/purchasebills
    [HttpGet]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<IEnumerable<PurchaseBill>>> GetAll(
        [FromQuery] BillStatus? status = null,
        [FromQuery] Guid? contactId = null)
    {
        var query = _context.PurchaseBills
            .Include(b => b.Contact)
            .Include(b => b.Lines)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(b => b.Status == status);

        if (contactId.HasValue)
            query = query.Where(b => b.ContactId == contactId);

        var bills = await query
            .OrderByDescending(b => b.BillDate)
            .ThenByDescending(b => b.CreatedAt)
            .ToListAsync();

        return Ok(bills);
    }

    // GET: api/purchasebills/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<PurchaseBill>> GetById(Guid id)
    {
        var bill = await _context.PurchaseBills
            .Include(b => b.Contact)
            .Include(b => b.Lines)
                .ThenInclude(l => l.Product)
            .Include(b => b.Lines)
                .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (bill == null)
            return NotFound();

        return Ok(bill);
    }

    // POST: api/purchasebills
    [HttpPost]
    [RequiresPermission(Permissions.PurchasesCreate)]
    public async Task<ActionResult<PurchaseBill>> Create(PurchaseBill bill)
    {
        if (bill.Id == Guid.Empty)
            bill.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, bill.BillDate);

        bill.CompanyId = _context.CurrentCompanyId.Value;

        // Generate bill number if not provided
        if (string.IsNullOrEmpty(bill.BillNumber))
        {
            bill.BillNumber = await GenerateBillNumber();
        }

        // Calculate totals
        CalculateTotals(bill);

        var validationError = await ValidateTrackedInventoryLinesAsync(bill.Lines);
        if (validationError != null)
            return BadRequest(new { code = "INVALID_ACCOUNT_FOR_TRACKED_ITEM", message = validationError });

        bill.CreatedAt = DateTime.UtcNow;
        bill.CreatedByUserId = GetCurrentUserId();
        bill.CreatedBy = GetCurrentUserEmail();
        bill.Status = BillStatus.Draft;

        foreach (var line in bill.Lines)
        {
            line.Id = Guid.NewGuid();
            line.PurchaseBillId = bill.Id;
        }

        _context.PurchaseBills.Add(bill);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            bill.CompanyId,
            "PurchaseBill",
            bill.Id,
            "Created",
            bill.CreatedByUserId ?? Guid.Empty,
            bill.CreatedBy ?? "User",
            $"Purchase Bill {bill.BillNumber} created as Draft");

        return CreatedAtAction(nameof(GetById), new { id = bill.Id }, bill);
    }

    // PUT: api/purchasebills/{id}
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.PurchasesEdit)]
    public async Task<IActionResult> Update(Guid id, PurchaseBill bill)
    {
        if (id != bill.Id)
            return BadRequest("ID mismatch");
        
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var existing = await _context.PurchaseBills
            .Include(b => b.Lines)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (existing == null)
            return NotFound();

        // Check Period Lock (Old & New)
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, existing.BillDate);
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, bill.BillDate);

        if (existing.Status == BillStatus.Posted || existing.Status == BillStatus.Void)
            return BadRequest("Cannot edit posted or voided bill");

        var validationError = await ValidateTrackedInventoryLinesAsync(bill.Lines);
        if (validationError != null)
            return BadRequest(new { code = "INVALID_ACCOUNT_FOR_TRACKED_ITEM", message = validationError });

        // Update fields
        existing.VendorInvoiceNumber = bill.VendorInvoiceNumber;
        existing.BillDate = bill.BillDate;
        existing.DueDate = bill.DueDate;
        existing.ContactId = bill.ContactId;
        existing.Currency = bill.Currency;
        existing.ExchangeRate = bill.ExchangeRate;
        existing.Notes = bill.Notes;
        existing.ReferenceNumber = bill.ReferenceNumber;
        existing.TemplateName = bill.TemplateName;
        existing.WithholdingTaxType = bill.WithholdingTaxType;
        existing.WithholdingTaxRate = bill.WithholdingTaxRate;
        existing.WithholdingTaxAmount = bill.WithholdingTaxAmount;
        existing.UpdatedAt = DateTime.UtcNow;

        // Replace lines
        _context.PurchaseBillLines.RemoveRange(existing.Lines);
        foreach (var line in bill.Lines)
        {
            line.Id = Guid.NewGuid();
            line.PurchaseBillId = id;
        }
        existing.Lines = bill.Lines;

        CalculateTotals(existing);

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "PurchaseBill",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserEmail(),
            $"Purchase Bill {existing.BillNumber} updated");

        return NoContent();
    }

    // POST: api/purchasebills/{id}/post
    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.PurchasesApprove)]
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var company = await _context.Companies.FindAsync(_context.CurrentCompanyId.Value);
        var currentUserId = GetCurrentUserId();
        var currentEmail = GetCurrentUserEmail();

        var bill = await _context.PurchaseBills
            .Include(b => b.Contact)
            .Include(b => b.Lines)
                .ThenInclude(l => l.Product)
            .Include(b => b.Lines)
                .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (bill == null)
            return NotFound();

        // ── SEGREGATION OF DUTIES (SoD) GUARD ────────────────────────────────
        // The creator of a purchase bill cannot approve/post it.
        if (company != null && company.EnforceSegregationOfDuties)
        {
            bool isCreator = (bill.CreatedByUserId.HasValue && bill.CreatedByUserId == currentUserId)
                          || (!string.IsNullOrEmpty(bill.CreatedBy) && string.Equals(bill.CreatedBy, currentEmail, StringComparison.OrdinalIgnoreCase));

            if (isCreator)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new 
                { 
                    message = $"Segregation of Duties Violation: You created purchase bill {bill.BillNumber} ({bill.CreatedBy ?? "current user"}). Internal control policy requires a second authorized reviewer to approve this bill.",
                    code = "SEGREGATION_OF_DUTIES_VIOLATION",
                    createdBy = bill.CreatedBy
                });
            }
        }

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, bill.BillDate);

        if (bill.Status != BillStatus.Draft && bill.Status != BillStatus.Pending)
            return BadRequest("Only draft or pending bills can be posted");

        // Goods on a bill raised from a purchase order that was already
        // received entered stock at receipt; adding them again here counted
        // them twice. What the receipt valued them at is what the bill clears
        // from goods received not invoiced, where the receipt was journaled.
        var receivedViaOrder = bill.PurchaseOrderId.HasValue && await _context.PurchaseOrders
            .AnyAsync(o => o.Id == bill.PurchaseOrderId && o.Status == PurchaseOrderStatus.Received);
        var order = bill.PurchaseOrderId.HasValue
            ? await _context.PurchaseOrders.Where(o => o.Id == bill.PurchaseOrderId).Select(o => new { o.WarehouseId, o.OrderNumber }).FirstOrDefaultAsync()
            : null;
        var orderWarehouse = order?.WarehouseId;

        var receiptValue = new Dictionary<Guid, decimal>();
        var clearsGrni = new Dictionary<Guid, decimal>();
        if (receivedViaOrder)
        {
            foreach (var line in bill.Lines.Where(l => l.ProductId.HasValue))
            {
                var product = line.Product ?? await _context.Products.FindAsync(line.ProductId!.Value);
                if (product is not { TrackInventory: true }) continue;
                var (unitCost, journaled) = await ReceiptAsync(order!.OrderNumber, product.Id);
                var value = Math.Round(line.Quantity * unitCost, 2, MidpointRounding.ToEven);
                receiptValue[line.Id] = value;
                if (journaled) clearsGrni[line.Id] = value;
            }
        }

        string? grniCode = null;
        if (clearsGrni.Count > 0)
        {
            var codes = await _context.ResolveAccountCodesAsync(_context.CurrentCompanyId.Value, new[] { PurchaseOrdersController.GrniAccount });
            if (!codes.TryGetValue(PurchaseOrdersController.GrniAccount, out grniCode))
                return BadRequest(new { code = "MISSING_ACCOUNT", message = "Goods Received Not Invoiced (2-1150) is missing from the chart of accounts." });
        }

        // 1. Create and post balanced Journal Entry
        var journalEntry = await CreateJournalEntry(bill, clearsGrni, grniCode);

        bill.JournalEntryId = journalEntry.Id;
        bill.Status = BillStatus.Posted;
        bill.ApprovedByUserId = currentUserId;
        bill.ApprovedBy = currentEmail;
        bill.ApprovedAt = DateTime.UtcNow;
        bill.PostedAt = DateTime.UtcNow;
        bill.AmountDue = Math.Max(0, bill.Total - bill.WithholdingTaxAmount);

        // 2. Track Inventory additions and movements.

        foreach (var line in bill.Lines)
        {
            if (line.ProductId.HasValue)
            {
                var product = line.Product ?? await _context.Products.FindAsync(line.ProductId.Value);
                if (product != null && product.TrackInventory)
                {
                    // Update unit buy price if provided
                    if (line.UnitPrice > 0)
                    {
                        product.BuyPrice = line.UnitPrice;
                    }

                    // The goods enter at what the journal debits to inventory.
                    var netCost = line.LineTotal - line.TaxAmount;
                    if (!receivedViaOrder)
                    {
                        await _inventory.MoveAsync(product, bill.WarehouseId ?? orderWarehouse, line.Quantity, InventoryMovementType.Purchase,
                            bill.BillDate, netCost, bill.BillNumber, journalEntry.Id, $"Purchase Bill {bill.BillNumber}");
                    }
                    else
                    {
                        // Received at the order price; the bill settles the
                        // price. The difference is a value-only movement on
                        // the stock, so the average and the inventory account
                        // both end at the billed amount.
                        var difference = netCost - receiptValue.GetValueOrDefault(line.Id);
                        if (difference != 0m)
                        {
                            await _inventory.MoveAsync(product, orderWarehouse, 0m, InventoryMovementType.Purchase,
                                bill.BillDate, difference, bill.BillNumber, journalEntry.Id,
                                $"Price difference, Purchase Bill {bill.BillNumber} against order {order?.OrderNumber}");
                        }
                    }
                }
            }
        }

        // Create audit log
        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "POST",
            TargetEntity = "PurchaseBill:" + bill.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Posted bill {bill.BillNumber} with total {bill.Total:N2}. Linked to Journal Entry {journalEntry.Id}.",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            bill.CompanyId,
            "PurchaseBill",
            bill.Id,
            "Posted",
            currentUserId ?? Guid.Empty,
            currentEmail,
            $"Purchase Bill {bill.BillNumber} posted to General Ledger (Journal: {journalEntry.ReferenceNumber ?? journalEntry.Id.ToString()})");

        return Ok(new { message = "Bill posted successfully", bill, journalEntryId = journalEntry.Id });
    }

    // POST: api/purchasebills/{id}/void
    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.PurchasesEdit)]
    public async Task<IActionResult> Void(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var bill = await _context.PurchaseBills
            .Include(b => b.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (bill == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, bill.BillDate);

        if (bill.Status == BillStatus.Void)
            return BadRequest("Bill is already voided");

        // 1. Void the associated journal entry if exists
        if (bill.JournalEntryId.HasValue)
        {
            var journalEntry = await _context.JournalEntries.FindAsync(bill.JournalEntryId.Value);
            if (journalEntry != null)
            {
                journalEntry.Status = JournalEntryStatus.Void;
            }
        }

        // 2. Reverse the stock this bill added, from the warehouses it entered.
        // A bill whose goods came in on a received order added none.
        await _inventory.ReverseAsync(_context.CurrentCompanyId!.Value, bill.BillNumber, InventoryMovementType.Purchase,
            DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)), $"VOID-{bill.BillNumber}", $"Void of Purchase Bill {bill.BillNumber}");

        bill.Status = BillStatus.Void;
        bill.VoidedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "VOID",
            TargetEntity = "PurchaseBill:" + bill.Id,
            Timestamp = DateTime.UtcNow,
            Details = $"Voided bill {bill.BillNumber}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            bill.CompanyId,
            "PurchaseBill",
            bill.Id,
            "Voided",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserEmail(),
            $"Purchase Bill {bill.BillNumber} voided");

        return Ok(new { message = "Bill voided successfully" });
    }

    // DELETE: api/purchasebills/{id}
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.PurchasesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var bill = await _context.PurchaseBills
            .Include(b => b.Lines)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (bill == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, bill.BillDate);

        if (bill.Status == BillStatus.Posted)
            return BadRequest("Cannot delete posted bill. Void it instead.");

        _context.PurchaseBillLines.RemoveRange(bill.Lines);
        _context.PurchaseBills.Remove(bill);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private void CalculateTotals(PurchaseBill bill)
    {
        decimal subtotal = 0;
        decimal totalTax = 0;

        // Date-effective standard statutory rate: 12% from 2025-01-01 onwards, 11% before
        var is2025OrLater = bill.BillDate >= new DateOnly(2025, 1, 1);
        var defaultStatutoryRate = is2025OrLater ? 12m : 11m;

        foreach (var line in bill.Lines)
        {
            var lineSubtotal = line.Quantity * line.UnitPrice;
            var lineDiscount = line.DiscountPercent > 0 
                ? lineSubtotal * (line.DiscountPercent / 100) 
                : line.DiscountAmount;
            
            var lineAfterDiscount = lineSubtotal - lineDiscount;

            if (line.IsTaxable)
            {
                if (line.TaxRate <= 0 || (is2025OrLater && line.TaxRate == 11m))
                {
                    line.TaxRate = defaultStatutoryRate;
                }

                if (!is2025OrLater && line.DppScheme == DppScheme.NilaiLain11Over12)
                {
                    line.DppScheme = DppScheme.Standard;
                }

                switch (line.DppScheme)
                {
                    case DppScheme.NilaiLain11Over12:
                        line.DppAmount = Math.Round(lineAfterDiscount * 11m / 12m, 2, MidpointRounding.ToEven);
                        break;
                    case DppScheme.Standard:
                    default:
                        line.DppAmount = lineAfterDiscount;
                        break;
                    case DppScheme.ZeroRated:
                    case DppScheme.Exempt:
                        line.DppAmount = 0;
                        break;
                }

                line.TaxAmount = Math.Round(line.DppAmount * (line.TaxRate / 100m), 2, MidpointRounding.ToEven);
            }
            else
            {
                line.DppAmount = 0;
                line.TaxAmount = 0;
                line.PPnBMAmount = 0;
            }

            line.DiscountAmount = lineDiscount;
            line.LineTotal = lineAfterDiscount + line.TaxAmount + line.PPnBMAmount;

            subtotal += lineAfterDiscount;
            totalTax += line.TaxAmount;
        }

        var billDiscount = bill.DiscountPercent > 0 
            ? subtotal * (bill.DiscountPercent / 100) 
            : bill.DiscountAmount;

        bill.Subtotal = subtotal;
        bill.DiscountAmount = billDiscount;
        bill.TaxAmount = totalTax;
        bill.Total = subtotal - billDiscount + totalTax;

        if (bill.WithholdingTaxRate > 0 && bill.WithholdingTaxAmount == 0)
        {
            bill.WithholdingTaxAmount = Math.Round((bill.Subtotal - bill.DiscountAmount) * (bill.WithholdingTaxRate / 100m), 2, MidpointRounding.ToEven);
        }

        bill.AmountDue = Math.Max(0, (bill.Total - bill.WithholdingTaxAmount) - bill.AmountPaid);
    }

    private async Task<string> GenerateBillNumber()
    {
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        var prefix = $"BILL-{year}{month:D2}";
        
        var count = await _context.PurchaseBills
            .CountAsync(b => b.BillNumber.StartsWith(prefix));
        
        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }

    /// <summary>
    /// Unit value the order's receipt gave the product, and whether the
    /// receipt was journaled to goods received not invoiced. Receipts from
    /// before that journal existed were not.
    /// </summary>
    private async Task<(decimal UnitCost, bool Journaled)> ReceiptAsync(string orderNumber, Guid productId)
    {
        // Summed in memory: SQLite stores decimal(19,4) as REAL.
        var received = await _context.InventoryMovements.AsNoTracking()
            .Where(m => m.ReferenceNumber == orderNumber && m.ProductId == productId && m.Type == InventoryMovementType.Purchase)
            .Select(m => new { m.Quantity, m.TotalCost, m.JournalEntryId })
            .ToListAsync();
        var quantity = received.Sum(m => m.Quantity);
        var unitCost = quantity == 0m ? 0m : received.Sum(m => m.TotalCost) / quantity;
        return (unitCost, received.Count > 0 && received.All(m => m.JournalEntryId != null));
    }

    private async Task<JournalEntry> CreateJournalEntry(PurchaseBill bill, IReadOnlyDictionary<Guid, decimal> clearsGrni, string? grniCode)
    {
        // 1. Resolve Accounts Payable account (Contact's DefaultPayableAccountId or 2-1100 Trade Payables)
        var payableAccountId = bill.Contact?.DefaultPayableAccountId?.ToString();
        if (string.IsNullOrEmpty(payableAccountId))
        {
            var defaultAP = await _context.Accounts
                .FirstOrDefaultAsync(a => a.Code == "2-1100" || a.Code.StartsWith("2100") || (a.Name.Contains("Payable") && !a.IsHeader));
            payableAccountId = defaultAP?.Code ?? "2-1100";
        }

        // 2. Resolve VAT In / PPN Masukan account (1-1700)
        var defaultTaxAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == "1-1700" || a.Code.StartsWith("1170") || (a.Name.Contains("VAT In") && !a.IsHeader) || (a.Name.Contains("PPN Masukan") && !a.IsHeader));
        var taxAccountCode = defaultTaxAccount?.Code ?? "1-1700";

        // 3. Resolve default Inventory account (1-1400)
        var defaultInventoryAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == "1-1400" || a.Code.StartsWith("1140") || (a.Name.Contains("Inventory") && !a.IsHeader));
        var inventoryAccountCode = defaultInventoryAccount?.Code ?? "1-1400";

        // 4. Resolve fallback Expense account (6-1400 Office Supplies / general expense)
        var defaultExpenseAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == "6-1400" || a.Code.StartsWith("6") || (a.AccountGroup == "Expense" && !a.IsHeader));
        var fallbackExpenseCode = defaultExpenseAccount?.Code ?? "6-1400";

        var rate = bill.ExchangeRate > 0 ? bill.ExchangeRate : 1m;

        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            Date = bill.BillDate,
            ReferenceNumber = bill.BillNumber,
            ContactId = bill.ContactId.ToString(),
            Currency = "IDR",
            Notes = $"Purchase Bill {bill.BillNumber} - {bill.Contact?.Name ?? "Vendor"}" + (rate != 1m ? $" (FX {bill.Currency} @ {rate:N2})" : ""),
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        var netPayable = bill.Total - bill.WithholdingTaxAmount;
        var apAmount = Math.Round(netPayable * rate, 2, MidpointRounding.ToEven);
        var discountAmount = bill.DiscountAmount > 0 
            ? Math.Round(bill.DiscountAmount * rate, 2, MidpointRounding.ToEven) 
            : 0m;
        var whtAmount = bill.WithholdingTaxAmount > 0
            ? Math.Round(bill.WithholdingTaxAmount * rate, 2, MidpointRounding.ToEven)
            : 0m;

        // Credit: Trade Payables (net payable to vendor in base currency)
        journalEntry.Lines.Add(new JournalLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = journalEntry.Id,
            AccountId = payableAccountId,
            Description = $"Bill {bill.BillNumber} - {bill.Contact?.Name ?? "Vendor"}",
            Debit = 0,
            Credit = apAmount
        });

        // Credit: Withholding Tax Payable (PPh 21/22/23/4(2))
        if (whtAmount > 0)
        {
            var whtType = (bill.WithholdingTaxType ?? "").Trim().ToUpperInvariant();
            string defaultWhtCode = whtType switch
            {
                var s when s.Contains("21") => "2-1410",
                var s when s.Contains("22") => "2-1422",
                var s when s.Contains("4(2)") || s.Contains("42") || s.Contains("FINAL") => "2-1424",
                _ => "2-1423" // Default PPh 23
            };

            var whtAccount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.Code == defaultWhtCode);
            var whtAccountCode = whtAccount?.Code ?? defaultWhtCode;

            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = whtAccountCode,
                Description = $"{bill.WithholdingTaxType ?? "Withholding Tax"} - Bill {bill.BillNumber}",
                Debit = 0,
                Credit = whtAmount
            });
        }

        // Credit: Purchase Discount if bill carries a discount
        if (discountAmount > 0)
        {
            var defaultDiscount = await _context.Accounts
                .FirstOrDefaultAsync(a => a.Code == "5-5000" || a.Code.StartsWith("5500") || a.Code == "5-9100" || a.Name.Contains("Purchase Discount") || a.Name.Contains("Diskon Pembelian") || a.Code == "5-9000");
            var discountCode = defaultDiscount?.Code ?? "5-5000";

            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = discountCode,
                Description = $"Discount - Bill {bill.BillNumber}",
                Debit = 0,
                Credit = discountAmount
            });
        }

        // Debit: Line item expense / inventory + VAT In
        var debitLines = new List<JournalLine>();
        foreach (var line in bill.Lines)
        {
            string lineDebitAccount;

            if (line.AccountId.HasValue)
            {
                var customAcc = await _context.Accounts.FindAsync(line.AccountId.Value);
                lineDebitAccount = customAcc?.Code ?? line.AccountId.Value.ToString();
            }
            else if (line.ProductId.HasValue)
            {
                var product = line.Product ?? await _context.Products.FindAsync(line.ProductId.Value);
                if (product != null && product.TrackInventory)
                {
                    lineDebitAccount = product.InventoryAccountId.HasValue
                        ? (await _context.Accounts.FindAsync(product.InventoryAccountId.Value))?.Code ?? inventoryAccountCode
                        : inventoryAccountCode;
                }
                else if (product != null && product.ExpenseAccountId.HasValue)
                {
                    lineDebitAccount = (await _context.Accounts.FindAsync(product.ExpenseAccountId.Value))?.Code ?? fallbackExpenseCode;
                }
                else
                {
                    lineDebitAccount = fallbackExpenseCode;
                }
            }
            else
            {
                lineDebitAccount = fallbackExpenseCode;
            }

            var netAmount = line.LineTotal - line.TaxAmount;

            if (clearsGrni.TryGetValue(line.Id, out var received))
            {
                // Received goods: the receipt's value comes off goods received
                // not invoiced; only the price difference touches inventory.
                var convertedReceived = Math.Round(received * rate, 2, MidpointRounding.ToEven);
                var grniLine = new JournalLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = journalEntry.Id,
                    AccountId = grniCode!,
                    Description = $"Received not invoiced - {line.Description}",
                    Debit = convertedReceived,
                    Credit = 0,
                    CostCenterId = line.CostCenterId,
                    ProjectId = line.ProjectId
                };
                debitLines.Add(grniLine);
                journalEntry.Lines.Add(grniLine);

                var difference = Math.Round((netAmount - received) * rate, 2, MidpointRounding.ToEven);
                if (difference != 0m)
                {
                    var diffLine = new JournalLine
                    {
                        Id = Guid.NewGuid(),
                        JournalEntryId = journalEntry.Id,
                        AccountId = lineDebitAccount,
                        Description = $"Price difference - {line.Description}",
                        Debit = difference > 0m ? difference : 0m,
                        Credit = difference < 0m ? -difference : 0m,
                        CostCenterId = line.CostCenterId,
                        ProjectId = line.ProjectId
                    };
                    if (difference > 0m) debitLines.Add(diffLine);
                    journalEntry.Lines.Add(diffLine);
                }
            }
            else
            {
                var convertedNet = Math.Round(netAmount * rate, 2, MidpointRounding.ToEven);
                var netLine = new JournalLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = journalEntry.Id,
                    AccountId = lineDebitAccount,
                    Description = line.Description,
                    Debit = convertedNet,
                    Credit = 0,
                    CostCenterId = line.CostCenterId,
                    ProjectId = line.ProjectId
                };
                debitLines.Add(netLine);
                journalEntry.Lines.Add(netLine);
            }

            // Debit: PPN Masukan (VAT In) if taxable
            if (line.IsTaxable && line.TaxAmount > 0)
            {
                var convertedTax = Math.Round(line.TaxAmount * rate, 2, MidpointRounding.ToEven);
                var taxLine = new JournalLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = journalEntry.Id,
                    AccountId = taxAccountCode,
                    Description = $"PPN Masukan - {line.Description}",
                    Debit = convertedTax,
                    Credit = 0
                };
                debitLines.Add(taxLine);
                journalEntry.Lines.Add(taxLine);
            }
        }

        // Decimal balance check across FX and rounding:
        var totalBillCredits = apAmount + discountAmount + whtAmount;
        var totalBillDebits = journalEntry.Lines.Where(l => l.Debit > 0).Sum(l => l.Debit);
        var balanceDiff = totalBillCredits - totalBillDebits;
        if (balanceDiff != 0m && debitLines.Count > 0)
        {
            debitLines[0].Debit += balanceDiff;
        }

        _context.JournalEntries.Add(journalEntry);
        return journalEntry;
    }

    private async Task<string?> ValidateTrackedInventoryLinesAsync(IEnumerable<PurchaseBillLine> lines)
    {
        foreach (var line in lines)
        {
            if (line.ProductId.HasValue && line.AccountId.HasValue)
            {
                var product = await _context.Products.FindAsync(line.ProductId.Value);
                if (product != null && product.TrackInventory)
                {
                    var customAcc = await _context.Accounts.FindAsync(line.AccountId.Value);
                    var isInventory = customAcc != null && (
                        customAcc.AccountGroup == "Inventory" ||
                        customAcc.Code.StartsWith("1-14") ||
                        customAcc.Code.StartsWith("114") ||
                        (product.InventoryAccountId.HasValue && customAcc.Id == product.InventoryAccountId.Value));

                    if (!isInventory)
                    {
                        return $"Line with tracked item '{product.Name}' must post to an inventory asset account.";
                    }
                }
            }
        }
        return null;
    }
}
