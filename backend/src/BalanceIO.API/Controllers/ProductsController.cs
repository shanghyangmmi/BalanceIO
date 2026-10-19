using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Authorization was missing from this controller entirely. Nothing public
/// calls it - the marketing site only talks to /auth - so requiring a token
/// changes nothing for a signed-in user and closes the endpoint to everyone
/// else. Tenant scoping still comes from the global query filters; this is
/// the layer in front of them, not a replacement for it.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly BalanceIO.API.Services.IPeriodLockService _periodLock;

    private readonly BalanceIO.API.Services.InventoryLedger _inventory;

    public ProductsController(ApplicationDbContext context, BalanceIO.API.Services.IPeriodLockService periodLock, BalanceIO.API.Services.InventoryLedger inventory)
    {
        _inventory = inventory;
        _context = context;
        _periodLock = periodLock;
    }

    // GET: api/products
    [HttpGet]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<IEnumerable<Product>>> GetAll([FromQuery] ProductType? type = null, [FromQuery] bool? active = null)
    {
        var query = _context.Products.AsQueryable();

        if (type.HasValue)
            query = query.Where(p => p.Type == type);

        if (active.HasValue)
            query = query.Where(p => p.IsActive == active);

        var products = await query
            .Include(p => p.IncomeAccount)
            .Include(p => p.ExpenseAccount)
            .OrderBy(p => p.Name)
            .ToListAsync();

        return Ok(products);
    }

    // GET: api/products/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<Product>> GetById(Guid id)
    {
        var product = await _context.Products
            .Include(p => p.IncomeAccount)
            .Include(p => p.ExpenseAccount)
            .Include(p => p.InventoryAccount)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (product == null)
            return NotFound();

        return Ok(product);
    }

    // POST: api/products
    [HttpPost]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<ActionResult<Product>> Create(Product product)
    {
        if (product.Id == Guid.Empty)
            product.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        product.CompanyId = _context.CurrentCompanyId.Value;

        // Generate code if not provided
        if (string.IsNullOrEmpty(product.Code))
        {
            product.Code = await GenerateCode(product.Type);
        }

        product.CreatedAt = DateTime.UtcNow;

        // Opening stock entered with the product is a movement into the
        // default warehouse, so the warehouses add up to the total.
        var opening = product.TrackInventory ? product.StockOnHand : 0m;
        product.StockOnHand = 0m;
        product.InventoryValue = 0m;
        product.AverageCost = 0m;
        _context.Products.Add(product);
        if (opening != 0m)
        {
            var totalValue = Math.Round(opening * product.BuyPrice, 2, MidpointRounding.ToEven);
            Guid? journalEntryId = null;

            if (opening > 0m && totalValue > 0m)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
                if (_context.CurrentCompanyId.HasValue)
                {
                    await _periodLock.ValidateTransactionDate(_context.CurrentCompanyId.Value, today);
                }

                var defaultInv = await _context.Accounts
                    .FirstOrDefaultAsync(a => a.Code == "1-1400" || a.Code.StartsWith("1140") || (a.Name.Contains("Inventory") && !a.IsHeader));
                var inventoryAccount = product.InventoryAccountId.HasValue
                    ? (await _context.Accounts.FindAsync(product.InventoryAccountId.Value))?.Code ?? defaultInv?.Code ?? "1-1400"
                    : defaultInv?.Code ?? "1-1400";

                var defaultEquity = await _context.Accounts
                    .FirstOrDefaultAsync(a => a.Code == "3-9000" || a.Code == "3-2000" || (a.AccountGroup == "Equity" && a.NormalBalance == "Credit" && !a.IsHeader));
                var equityAccount = defaultEquity?.Code ?? "3-9000";

                var journal = new JournalEntry
                {
                    Id = Guid.NewGuid(),
                    CompanyId = _context.CurrentCompanyId ?? Guid.Empty,
                    Date = today,
                    ReferenceNumber = $"OPEN-{product.Code}",
                    Notes = $"Opening stock for {product.Name} ({opening} {product.Unit} @ {product.BuyPrice:N2})",
                    Status = JournalEntryStatus.Posted,
                    CreatedAt = DateTime.UtcNow,
                    Lines = new List<JournalLine>
                    {
                        new JournalLine
                        {
                            Id = Guid.NewGuid(),
                            AccountId = inventoryAccount,
                            Description = $"Opening stock - {product.Name}",
                            Debit = totalValue,
                            Credit = 0m
                        },
                        new JournalLine
                        {
                            Id = Guid.NewGuid(),
                            AccountId = equityAccount,
                            Description = $"Opening stock equity - {product.Name}",
                            Debit = 0m,
                            Credit = totalValue
                        }
                    }
                };
                _context.JournalEntries.Add(journal);
                journalEntryId = journal.Id;
            }

            await _inventory.MoveAsync(product, null, opening, InventoryMovementType.OpeningBalance,
                DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)), totalValue, $"OPEN-{product.Code}", journalEntryId,
                "Opening stock entered with the product");
        }
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT: api/products/{id}
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<IActionResult> Update(Guid id, Product product)
    {
        if (id != product.Id)
            return BadRequest("ID mismatch");

        var existing = await _context.Products.FindAsync(id);
        if (existing == null)
            return NotFound();

        // Update fields
        existing.Name = product.Name;
        existing.Description = product.Description;
        existing.Type = product.Type;
        existing.SellPrice = product.SellPrice;
        existing.BuyPrice = product.BuyPrice;
        existing.IsTaxable = product.IsTaxable;
        existing.TaxRate = product.TaxRate;
        existing.Unit = product.Unit;
        existing.TrackInventory = product.TrackInventory;
        existing.ReorderLevel = product.ReorderLevel;
        existing.IncomeAccountId = product.IncomeAccountId;
        existing.ExpenseAccountId = product.ExpenseAccountId;
        existing.InventoryAccountId = product.InventoryAccountId;
        existing.IsActive = product.IsActive;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return NoContent();
    }

    // DELETE: api/products/{id}
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound();

        // Check if product is used in invoice lines
        var hasInvoiceLines = await _context.SalesInvoiceLines.AnyAsync(l => l.ProductId == id);
        if (hasInvoiceLines)
            return BadRequest("Product is used in invoices and cannot be deleted");

        _context.Products.Remove(product);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/products/{id}/adjust-stock
    // A manual stock correction. It changes the quantity, records the
    // movement, and posts the value to the ledger against inventory
    // variance (5-9000), so stock on hand and the inventory account move
    // together. Same accounts as a stock opname.
    [HttpPost("{id}/adjust-stock")]
    [RequiresPermission(Permissions.InventoryOpname)]
    public async Task<IActionResult> AdjustStock(Guid id, [FromBody] StockAdjustment adjustment)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });
        var companyId = _context.CurrentCompanyId.Value;

        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound();

        if (!product.TrackInventory)
            return BadRequest(new { code = "NOT_TRACKED", message = "This product does not track inventory." });
        if (adjustment.Quantity == 0m)
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Quantity cannot be zero." });
        if (string.IsNullOrWhiteSpace(adjustment.Reason))
            return BadRequest(new { code = "VALIDATION_FAILED", message = "A reason is required for a stock adjustment." });
        var warehouseId = await _inventory.ResolveAsync(companyId, adjustment.WarehouseId);
        var inWarehouse = await _inventory.QuantityAsync(companyId, product.Id, warehouseId);
        if (inWarehouse + adjustment.Quantity < 0m)
            return BadRequest(new { code = "NEGATIVE_STOCK", message = $"Only {inWarehouse:0.####} {product.Unit} in that warehouse; the adjustment would leave it negative." });
        adjustment.WarehouseId = warehouseId;

        var date = adjustment.Date ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        await _periodLock.ValidateTransactionDate(companyId, date);

        // Stock found is valued at the cost given, or the average; stock
        // lost always leaves at the average, as an issue does.
        if (adjustment.UnitCost < 0m)
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Unit cost cannot be negative." });
        decimal? enteredValue = adjustment.Quantity > 0m && adjustment.UnitCost.HasValue
            ? Math.Round(adjustment.Quantity * adjustment.UnitCost.Value, 2, MidpointRounding.ToEven)
            : null;
        var value = Math.Abs(enteredValue ?? BalanceIO.API.Services.InventoryLedger.AtAverage(product, adjustment.Quantity));

        var inventoryKey = product.InventoryAccountId?.ToString() ?? "1-1400";
        var codes = await _context.ResolveAccountCodesAsync(companyId, new[] { inventoryKey, "5-9000" });
        if (value > 0m && (!codes.ContainsKey(inventoryKey) || !codes.ContainsKey("5-9000")))
            return BadRequest(new { code = "MISSING_ACCOUNT", message = "The inventory account or Inventory Variance (5-9000) is missing from the chart of accounts." });

        var reference = $"ADJ-{date:yyyyMMdd}-{product.Code}";
        var reason = adjustment.Reason.Trim();
        Guid? entryId = null;

        if (value > 0m)
        {
            var increase = adjustment.Quantity > 0m;
            var entry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Date = date,
                ReferenceNumber = reference,
                Currency = "IDR",
                Notes = $"Stock adjustment, {product.Name}: {reason}",
                Status = JournalEntryStatus.Posted,
                CreatedAt = DateTime.UtcNow,
                Lines =
                [
                    new JournalLine { Id = Guid.NewGuid(), AccountId = codes[inventoryKey], Description = $"{product.Name} {adjustment.Quantity:+0.####;-0.####} {product.Unit}", Debit = increase ? value : 0m, Credit = increase ? 0m : value },
                    new JournalLine { Id = Guid.NewGuid(), AccountId = codes["5-9000"], Description = $"Inventory variance, {product.Name}", Debit = increase ? 0m : value, Credit = increase ? value : 0m },
                ],
            };
            _context.JournalEntries.Add(entry);
            entryId = entry.Id;
        }

        await _inventory.MoveAsync(product, adjustment.WarehouseId, adjustment.Quantity, InventoryMovementType.ManualAdjustment,
            date, adjustment.Quantity > 0m ? value : -value, reference, entryId, reason);

        await _context.SaveChangesAsync();

        return Ok(new { stockOnHand = product.StockOnHand, journalEntryId = entryId, value });
    }

    private async Task<string> GenerateCode(ProductType type)
    {
        var prefix = type == ProductType.Service ? "SVC" : "PRD";
        var count = await _context.Products.CountAsync(p => p.Code.StartsWith(prefix));
        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }
}

public class StockAdjustment
{
    /// <summary>Signed: positive adds stock, negative removes it.</summary>
    public decimal Quantity { get; set; }
    public string? Reason { get; set; }
    /// <summary>Defaults to today (WIB).</summary>
    public DateOnly? Date { get; set; }
    /// <summary>Cost of stock found. Defaults to the moving average; ignored when stock is removed.</summary>
    public decimal? UnitCost { get; set; }
    /// <summary>Defaults to the company's default warehouse.</summary>
    public Guid? WarehouseId { get; set; }
}
