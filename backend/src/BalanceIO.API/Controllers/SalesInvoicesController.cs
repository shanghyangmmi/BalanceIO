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
public class SalesInvoicesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly IPeriodLockService _periodLockService;

    private readonly BalanceIO.API.Services.InventoryLedger _inventory;

    public SalesInvoicesController(ApplicationDbContext context, INotificationService notificationService, IPeriodLockService periodLockService, BalanceIO.API.Services.InventoryLedger inventory)
    {
        _inventory = inventory;
        _context = context;
        _notificationService = notificationService;
        _periodLockService = periodLockService;
    }


    // GET: api/salesinvoices
    [HttpGet]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<IEnumerable<SalesInvoice>>> GetAll([FromQuery] Guid? contactId = null)
    {
        var invoices = await _context.SalesInvoices
            .Include(i => i.Contact)
            .Include(i => i.Lines)
            .Where(i => !contactId.HasValue || i.ContactId == contactId)
            .OrderByDescending(i => i.InvoiceDate)
            .ThenByDescending(i => i.CreatedAt)
            .ToListAsync();

        return Ok(invoices);
    }

    // GET: api/salesinvoices/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<SalesInvoice>> GetById(Guid id)
    {
        var invoice = await _context.SalesInvoices
            .Include(i => i.Contact)
            .Include(i => i.Lines)
                .ThenInclude(l => l.Product)
            .Include(i => i.Lines)
                .ThenInclude(l => l.Account)
            .Include(i => i.JournalEntry)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invoice == null)
            return NotFound();

        return Ok(invoice);
    }

    // POST: api/salesinvoices
    [HttpPost]
    [RequiresPermission(Permissions.SalesCreate)]
    public async Task<ActionResult<SalesInvoice>> Create(SalesInvoice invoice)
    {
        if (invoice.Id == Guid.Empty)
            invoice.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, invoice.InvoiceDate);

        invoice.CompanyId = _context.CurrentCompanyId.Value;

        // Generate invoice number if not provided
        if (string.IsNullOrEmpty(invoice.InvoiceNumber))
        {
            invoice.InvoiceNumber = await GenerateInvoiceNumber();
        }

        // Calculate totals
        CalculateTotals(invoice);

        invoice.CreatedAt = DateTime.UtcNow;
        invoice.Status = InvoiceStatus.Draft;

        _context.SalesInvoices.Add(invoice);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
    }

    // PUT: api/salesinvoices/{id}
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.SalesEdit)]
    public async Task<IActionResult> Update(Guid id, SalesInvoice invoice)
    {
        if (id != invoice.Id)
            return BadRequest("ID mismatch");

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var existing = await _context.SalesInvoices
            .Include(i => i.Lines)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (existing == null)
            return NotFound();

        // Check Period Lock (Old & New)
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, existing.InvoiceDate);
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, invoice.InvoiceDate);

        // Don't allow editing posted invoices
        if (existing.Status != InvoiceStatus.Draft)
            return BadRequest("Cannot edit a posted invoice");

        // Update fields
        existing.InvoiceDate = invoice.InvoiceDate;
        existing.DueDate = invoice.DueDate;
        existing.ContactId = invoice.ContactId;
        existing.BillingAddress = invoice.BillingAddress;
        existing.Currency = invoice.Currency;
        existing.ExchangeRate = invoice.ExchangeRate;
        existing.DiscountPercent = invoice.DiscountPercent;
        existing.DiscountAmount = invoice.DiscountAmount;
        existing.ReferenceNumber = invoice.ReferenceNumber;
        existing.Notes = invoice.Notes;
        existing.Terms = invoice.Terms;
        existing.TemplateName = invoice.TemplateName;

        // Replace lines
        _context.SalesInvoiceLines.RemoveRange(existing.Lines);
        existing.Lines = invoice.Lines;

        // Recalculate
        CalculateTotals(existing);

        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/salesinvoices/{id}/post
    [HttpPost("{id}/post")]
    [RequiresPermission(Permissions.SalesApprove)] // Treating Post as Approval
    public async Task<IActionResult> Post(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
             return BadRequest("Company context is required");

        var invoice = await _context.SalesInvoices
            .Include(i => i.Contact)
            .Include(i => i.Lines)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invoice == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, invoice.InvoiceDate);

        if (invoice.Status != InvoiceStatus.Draft)
            return BadRequest("Invoice is already posted");

        // Create Journal Entry
        var journalEntry = await CreateJournalEntry(invoice);

        invoice.JournalEntryId = journalEntry.Id;
        invoice.Status = InvoiceStatus.Sent;
        invoice.PostedAt = DateTime.UtcNow;
        invoice.UpdatedAt = DateTime.UtcNow;

        // Stock left with the journal entry; warn on what is now low.
        foreach (var line in invoice.Lines)
        {
            if (line.ProductId.HasValue)
            {
                var product = await _context.Products.FindAsync(line.ProductId.Value);
                if (product != null && product.TrackInventory)
                {
                    if (product.StockOnHand <= product.ReorderLevel)
                    {
                        await _notificationService.CreateAsync(
                            title: "Low Stock Alert",
                            message: $"Product '{product.Name}' is low on stock ({product.StockOnHand} {product.Unit} remaining).",
                            type: "warning",
                            relatedEntityId: product.Id.ToString(),
                            relatedEntityType: "Product"
                        );
                    }
                }
            }
        }

        await _context.SaveChangesAsync();

        // Create Notification
        await _notificationService.CreateAsync(
            title: "Invoice Posted",
            message: $"Invoice {invoice.InvoiceNumber} for {invoice.Contact?.Name ?? "Unknown"} has been posted successfully.",
            type: "success",
            relatedEntityId: invoice.Id.ToString(),
            relatedEntityType: "SalesInvoice"
        );

        return Ok(new { message = "Invoice posted successfully", journalEntryId = journalEntry.Id });
    }

    // POST: api/salesinvoices/{id}/void
    [HttpPost("{id}/void")]
    [RequiresPermission(Permissions.SalesDelete)]
    public async Task<IActionResult> Void(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
             return BadRequest("Company context is required");

        var invoice = await _context.SalesInvoices
            .Include(i => i.Lines)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (invoice == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, invoice.InvoiceDate);

        if (invoice.Status == InvoiceStatus.Void)
            return BadRequest("Invoice is already voided");

        // Void the associated journal entry if exists
        if (invoice.JournalEntryId.HasValue)
        {
            var journalEntry = await _context.JournalEntries.FindAsync(invoice.JournalEntryId.Value);
            if (journalEntry != null)
            {
                journalEntry.Status = JournalEntryStatus.Void;
            }
        }

        // Return the stock this invoice took, to the warehouses it left.
        await _inventory.ReverseAsync(_context.CurrentCompanyId.Value, invoice.InvoiceNumber, InventoryMovementType.Sale,
            DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)), $"VOID-{invoice.InvoiceNumber}",
            $"Void of Sales Invoice {invoice.InvoiceNumber}");

        invoice.Status = InvoiceStatus.Void;
        invoice.VoidedAt = DateTime.UtcNow;
        invoice.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Invoice voided successfully" });
    }

    // DELETE: api/salesinvoices/{id}
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.SalesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
             return BadRequest("Company context is required");

        var invoice = await _context.SalesInvoices.FindAsync(id);

        if (invoice == null)
            return NotFound();

        // Check Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, invoice.InvoiceDate);

        if (invoice.Status != InvoiceStatus.Draft)
            return BadRequest("Can only delete draft invoices");

        _context.SalesInvoices.Remove(invoice);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    #region Private Methods

    private void CalculateTotals(SalesInvoice invoice)
    {
        decimal subtotal = 0;
        decimal taxAmount = 0;

        // Date-effective standard statutory rate: 12% from 2025-01-01 onwards, 11% before
        var effectiveYear = invoice.InvoiceDate.Year;
        var is2025OrLater = invoice.InvoiceDate >= new DateOnly(2025, 1, 1);
        var defaultStatutoryRate = is2025OrLater ? 12m : 11m;

        foreach (var line in invoice.Lines)
        {
            // Calculate line totals
            var lineNet = line.Quantity * line.UnitPrice;

            // Apply line discount
            if (line.DiscountPercent > 0)
                line.DiscountAmount = lineNet * (line.DiscountPercent / 100);

            lineNet -= line.DiscountAmount;

            // Calculate tax
            if (line.IsTaxable)
            {
                // If tax rate not explicitly customized or pre-filled, use date-effective statutory rate
                if (line.TaxRate <= 0 || (is2025OrLater && line.TaxRate == 11m))
                {
                    line.TaxRate = defaultStatutoryRate;
                }

                // If prior to 2025, DPP scheme is always Standard (100%)
                if (!is2025OrLater && line.DppScheme == DppScheme.NilaiLain11Over12)
                {
                    line.DppScheme = DppScheme.Standard;
                }

                // Calculate DPP (Dasar Pengenaan Pajak)
                switch (line.DppScheme)
                {
                    case DppScheme.NilaiLain11Over12:
                        // PMK 131/2024: DPP = 11/12 * Net
                        line.DppAmount = Math.Round(lineNet * 11m / 12m, 2, MidpointRounding.ToEven);
                        break;
                    case DppScheme.Standard:
                    default:
                        line.DppAmount = lineNet;
                        break;
                    case DppScheme.ZeroRated:
                    case DppScheme.Exempt:
                        line.DppAmount = 0;
                        break;
                }

                // Compute PPN from DPP * Rate
                line.TaxAmount = Math.Round(line.DppAmount * (line.TaxRate / 100m), 2, MidpointRounding.ToEven);
            }
            else
            {
                line.DppAmount = 0;
                line.TaxAmount = 0;
                line.PPnBMAmount = 0;
            }

            line.LineTotal = lineNet + line.TaxAmount + line.PPnBMAmount;

            subtotal += lineNet;
            taxAmount += line.TaxAmount;
        }

        invoice.Subtotal = subtotal;

        // Apply invoice-level discount
        if (invoice.DiscountPercent > 0)
            invoice.DiscountAmount = subtotal * (invoice.DiscountPercent / 100);

        invoice.TaxAmount = taxAmount;
        invoice.Total = subtotal - invoice.DiscountAmount + taxAmount;
        invoice.AmountDue = invoice.Total - invoice.AmountPaid;
    }

    private async Task<string> GenerateInvoiceNumber()
    {
        var sequence = await _context.DocumentNumberSequences
            .FirstOrDefaultAsync(s => s.DocumentType == DocumentType.SalesInvoice);

        if (sequence == null)
        {
            // Create default sequence
            sequence = new DocumentNumberSequence
            {
                Id = Guid.NewGuid(),
                DocumentType = DocumentType.SalesInvoice,
                Prefix = "INV",
                NextNumber = 1,
                NumberLength = 4,
                IncludeYear = true,
                IncludeMonth = false,
                Separator = "-",
                ResetYearly = true
            };
            _context.DocumentNumberSequences.Add(sequence);
        }

        var number = sequence.GenerateNextNumber();
        await _context.SaveChangesAsync();

        return number;
    }

    private async Task<JournalEntry> CreateJournalEntry(SalesInvoice invoice)
    {
        // Get default accounts
        var receivableAccountId = invoice.Contact?.DefaultReceivableAccountId;
        
        // Fallback to first receivable account if not set
        if (receivableAccountId == null)
        {
            var defaultAR = await _context.Accounts
                .FirstOrDefaultAsync(a => a.Code.StartsWith("1130") || a.Name.Contains("Receivable"));
            receivableAccountId = defaultAR?.Id;
        }

        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            Date = invoice.InvoiceDate,
            ReferenceNumber = invoice.InvoiceNumber,
            ContactId = invoice.ContactId.ToString(),
            Currency = invoice.Currency,
            Notes = $"Sales Invoice {invoice.InvoiceNumber}",
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            ProjectId = invoice.ProjectId,
            Lines = new List<JournalLine>()
        };

        // Debit: Accounts Receivable
        journalEntry.Lines.Add(new JournalLine
        {
            Id = Guid.NewGuid(),
            JournalEntryId = journalEntry.Id,
            AccountId = (receivableAccountId ?? Guid.Empty).ToString(),
            Description = $"Invoice {invoice.InvoiceNumber} - {invoice.Contact?.Name}",
            Debit = invoice.Total,
            Credit = 0
        });

        // Credit: Revenue accounts (from line items)
        foreach (var line in invoice.Lines)
        {
            var revenueAccountId = line.AccountId ?? line.Product?.IncomeAccountId;
            
            if (revenueAccountId == null)
            {
                var defaultRevenue = await _context.Accounts
                    .FirstOrDefaultAsync(a => a.Code.StartsWith("4100") || a.Name.Contains("Revenue"));
                revenueAccountId = defaultRevenue?.Id;
            }

            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = (revenueAccountId ?? Guid.Empty).ToString(),
                Description = line.Description,
                Debit = 0,
                Credit = line.LineTotal - line.TaxAmount
            });

            // Credit: Tax payable (if taxable)
            if (line.IsTaxable && line.TaxAmount > 0)
            {
                var taxAccount = await _context.Accounts
                    .FirstOrDefaultAsync(a => a.Code.StartsWith("2140") || a.Name.Contains("Tax Payable") || a.Name.Contains("PPN"));

                journalEntry.Lines.Add(new JournalLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = journalEntry.Id,
                    AccountId = (taxAccount?.Id ?? Guid.Empty).ToString(),
                    Description = $"PPN - {line.Description}",
                    Debit = 0,
                    Credit = line.TaxAmount
                });
            }

            // Debit: COGS (5-1000) & Credit: Inventory (1-1400) for tracked inventory products.
            // The stock leaves here at moving-average cost, and COGS is
            // exactly the value the movement took off the inventory.
            if (line.ProductId.HasValue)
            {
                var product = await _context.Products.FindAsync(line.ProductId.Value);
                if (product != null && product.TrackInventory)
                {
                    var issue = await _inventory.MoveAsync(product, invoice.WarehouseId, -line.Quantity, InventoryMovementType.Sale,
                        invoice.InvoiceDate, null, invoice.InvoiceNumber, journalEntry.Id,
                        $"Sales Invoice {invoice.InvoiceNumber}");
                    var unitCost = issue.UnitCost;
                    var cogsAmount = -issue.TotalCost;

                    if (cogsAmount > 0)
                    {
                        // Resolve COGS account (product's ExpenseAccountId or 5-1000)
                        var cogsAccountId = product.ExpenseAccountId?.ToString();
                        if (string.IsNullOrEmpty(cogsAccountId))
                        {
                            var defaultCogs = await _context.Accounts
                                .FirstOrDefaultAsync(a => a.Code == "5-1000" || a.Code.StartsWith("5100") || (a.AccountGroup == "CostOfSales" && !a.IsHeader));
                            cogsAccountId = defaultCogs?.Code ?? "5-1000";
                        }

                        // Resolve Inventory account (product's InventoryAccountId or 1-1400)
                        var inventoryAccountId = product.InventoryAccountId?.ToString();
                        if (string.IsNullOrEmpty(inventoryAccountId))
                        {
                            var defaultInventory = await _context.Accounts
                                .FirstOrDefaultAsync(a => a.Code == "1-1400" || a.Code.StartsWith("1140") || (a.Name.Contains("Inventory") && !a.IsHeader));
                            inventoryAccountId = defaultInventory?.Code ?? "1-1400";
                        }

                        // Debit COGS
                        journalEntry.Lines.Add(new JournalLine
                        {
                            Id = Guid.NewGuid(),
                            JournalEntryId = journalEntry.Id,
                            AccountId = cogsAccountId,
                            Description = $"COGS - {product.Name} ({line.Quantity} {product.Unit} @ {unitCost:N0})",
                            Debit = cogsAmount,
                            Credit = 0
                        });

                        // Credit Inventory
                        journalEntry.Lines.Add(new JournalLine
                        {
                            Id = Guid.NewGuid(),
                            JournalEntryId = journalEntry.Id,
                            AccountId = inventoryAccountId,
                            Description = $"Inventory Relief - {product.Name} ({line.Quantity} {product.Unit})",
                            Debit = 0,
                            Credit = cogsAmount
                        });
                    }
                }
            }
        }

        _context.JournalEntries.Add(journalEntry);

        return journalEntry;
    }

    #endregion
}
