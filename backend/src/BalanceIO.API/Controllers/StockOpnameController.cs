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
public class StockOpnameController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;

    private readonly BalanceIO.API.Services.InventoryLedger _inventory;

    public StockOpnameController(ApplicationDbContext context, IPeriodLockService periodLockService, BalanceIO.API.Services.InventoryLedger inventory)
    {
        _inventory = inventory;
        _context = context;
        _periodLockService = periodLockService;
    }

    [HttpGet]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<IEnumerable<StockOpname>>> GetAll()
    {
        return await _context.StockOpnames
            .OrderByDescending(o => o.OpnameDate)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<StockOpname>> GetById(Guid id)
    {
        var opname = await _context.StockOpnames
            .Include(o => o.Lines)
            .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (opname == null) return NotFound();
        return opname;
    }

    [HttpPost]
    [RequiresPermission(Permissions.InventoryOpname)]
    public async Task<ActionResult<StockOpname>> Create(StockOpname opname)
    {
        if (opname.Id == Guid.Empty) opname.Id = Guid.NewGuid();
        
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        opname.CompanyId = _context.CurrentCompanyId.Value;
        
        // Generate Number if empty
        if (string.IsNullOrEmpty(opname.OpnameNumber))
        {
            var count = await _context.StockOpnames.CountAsync();
            opname.OpnameNumber = $"SO-{DateTime.Now:yyyyMM}-{count + 1:0000}";
        }

        opname.CreatedAt = DateTime.UtcNow;
        opname.Status = StockOpnameStatus.Draft;

        _context.StockOpnames.Add(opname);
        await _context.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetById), new { id = opname.Id }, opname);
    }

    // Initialize/Populate Lines from current stock
    [HttpPost("{id}/initialize")]
    [RequiresPermission(Permissions.InventoryOpname)]
    public async Task<IActionResult> Initialize(Guid id)
    {
        var opname = await _context.StockOpnames
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (opname == null) return NotFound();
        if (opname.Status != StockOpnameStatus.Draft) return BadRequest("Can only initialize Draft opname");

        // Clear existing lines if any (?) or just add missing?
        // Let's clear for simplicity to full reset
        if (opname.Lines.Any())
        {
            _context.StockOpnameLines.RemoveRange(opname.Lines);
        }

        var products = await _context.Products
            .Where(p => p.TrackInventory && p.IsActive)
            .ToListAsync();

        // A count of one warehouse compares against that warehouse's stock;
        // a count with no warehouse compares against the company total.
        foreach (var p in products)
        {
            var system = await SystemQuantityAsync(opname, p);
            // Added to the set, not through the navigation: a new line with
            // its Id already set, attached through a tracked parent, is taken
            // for an existing row and saved as an UPDATE of nothing. EF puts
            // it in opname.Lines itself.
            var line = new StockOpnameLine
            {
                Id = Guid.NewGuid(),
                StockOpnameId = opname.Id,
                ProductId = p.Id,
                SystemQty = system,
                PhysicalQty = system, // Default to matching
                Difference = 0
            };
            _context.StockOpnameLines.Add(line);
        }

        await _context.SaveChangesAsync();
        return Ok(opname); // Return updated object
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.InventoryOpname)]
    public async Task<IActionResult> Update(Guid id, StockOpname updateDto)
    {
        if (id != updateDto.Id) return BadRequest();

        var existing = await _context.StockOpnames
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (existing == null) return NotFound();
        if (existing.Status != StockOpnameStatus.Draft) return BadRequest("Cannot edit processed opname");

        existing.OpnameDate = updateDto.OpnameDate;
        existing.Description = updateDto.Description;
        existing.UpdatedAt = DateTime.UtcNow;

        // Update Lines
        // For simplicity, we assume frontend sends back all lines or we handle per-line updates.
        // If the DTO contains lines, let's update them.
        
        foreach (var updateLine in updateDto.Lines)
        {
            var existingLine = existing.Lines.FirstOrDefault(l => l.Id == updateLine.Id);
            if (existingLine != null)
            {
                existingLine.PhysicalQty = updateLine.PhysicalQty;
                existingLine.Notes = updateLine.Notes;
                existingLine.Difference = existingLine.PhysicalQty - existingLine.SystemQty;
            }
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<decimal> SystemQuantityAsync(StockOpname opname, Product product) =>
        opname.WarehouseId.HasValue
            ? await _inventory.QuantityAsync(product.CompanyId, product.Id, await _inventory.ResolveAsync(product.CompanyId, opname.WarehouseId))
            : product.StockOnHand;

    [HttpPost("{id}/process")]
    [RequiresPermission(Permissions.InventoryOpname)]
    public async Task<IActionResult> Process(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var opname = await _context.StockOpnames
            .Include(o => o.Lines)
            .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (opname == null) return NotFound();
        if (opname.Status != StockOpnameStatus.Draft) return BadRequest("Already processed");

        // Validate Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, opname.OpnameDate);

        var journalLines = new List<JournalLine>();
        var journalEntryId = Guid.NewGuid();

        // Resolve Default Inventory Account (1-1400)
        var defaultInventoryAcc = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == "1-1400" || a.Code.StartsWith("1140") || (a.Name.Contains("Inventory") && !a.IsHeader));
        var defaultInventoryCode = defaultInventoryAcc?.Code ?? "1-1400";

        // Resolve Default Variance Account (5-9000)
        var defaultVarianceAcc = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == "5-9000" || a.Name.Contains("Variance") || a.Name.Contains("Selisih"));
        var defaultVarianceCode = defaultVarianceAcc?.Code ?? "5-9000";

        // Apply adjustments and calculate journal lines
        foreach (var line in opname.Lines)
        {
            // Stock may have moved since the sheet was printed. The variance
            // is against what the system holds now, so the count lands
            // exactly on the physical quantity.
            var counted = line.Product ?? await _context.Products.FindAsync(line.ProductId);
            if (counted != null) line.SystemQty = await SystemQuantityAsync(opname, counted);
            line.Difference = line.PhysicalQty - line.SystemQty;

            if (line.Difference != 0)
            {
                var product = line.Product ?? await _context.Products.FindAsync(line.ProductId);
                if (product != null)
                {
                    var unitCost = product.BuyPrice;
                    var varianceAmount = Math.Abs(line.Difference) * unitCost;

                    var invAccountCode = product.InventoryAccountId.HasValue 
                        ? (await _context.Accounts.FindAsync(product.InventoryAccountId.Value))?.Code ?? defaultInventoryCode
                        : defaultInventoryCode;

                    if (varianceAmount > 0)
                    {
                        if (line.Difference > 0)
                        {
                            // Physical > System (Surplus): Debit Inventory, Credit Variance Gain (5-9000 Credit reduces cost)
                            journalLines.Add(new JournalLine
                            {
                                Id = Guid.NewGuid(),
                                JournalEntryId = journalEntryId,
                                AccountId = invAccountCode,
                                Description = $"Opname Surplus - {product.Name} (+{line.Difference} {product.Unit})",
                                Debit = varianceAmount,
                                Credit = 0
                            });

                            journalLines.Add(new JournalLine
                            {
                                Id = Guid.NewGuid(),
                                JournalEntryId = journalEntryId,
                                AccountId = defaultVarianceCode,
                                Description = $"Inventory Variance - {product.Name}",
                                Debit = 0,
                                Credit = varianceAmount
                            });
                        }
                        else
                        {
                            // Physical < System (Shortage): Debit Variance Loss (5-9000 Debit increases cost), Credit Inventory
                            journalLines.Add(new JournalLine
                            {
                                Id = Guid.NewGuid(),
                                JournalEntryId = journalEntryId,
                                AccountId = defaultVarianceCode,
                                Description = $"Inventory Variance (Shrinkage) - {product.Name}",
                                Debit = varianceAmount,
                                Credit = 0
                            });

                            journalLines.Add(new JournalLine
                            {
                                Id = Guid.NewGuid(),
                                JournalEntryId = journalEntryId,
                                AccountId = invAccountCode,
                                Description = $"Opname Shortage - {product.Name} ({line.Difference} {product.Unit})",
                                Debit = 0,
                                Credit = varianceAmount
                            });
                        }
                    }

                    // Record Inventory Movement
                    await _inventory.MoveAsync(product, opname.WarehouseId, line.Difference, InventoryMovementType.OpnameAdjustment,
                        opname.OpnameDate, unitCost, opname.OpnameNumber, varianceAmount > 0 ? journalEntryId : null,
                        $"Stock Opname {opname.OpnameNumber} adjustment");
                }
            }
        }

        // If any variances produced financial values, post the balanced journal entry
        if (journalLines.Any())
        {
            var journalEntry = new JournalEntry
            {
                Id = journalEntryId,
                Date = opname.OpnameDate,
                ReferenceNumber = opname.OpnameNumber,
                Currency = "IDR",
                Notes = $"Stock Opname Adjustment - {opname.OpnameNumber}",
                Status = JournalEntryStatus.Posted,
                CreatedAt = DateTime.UtcNow,
                Lines = journalLines
            };

            _context.JournalEntries.Add(journalEntry);
        }

        opname.Status = StockOpnameStatus.Processed;
        opname.ProcessedAt = DateTime.UtcNow;
        opname.ProcessedBy = User.Identity?.Name ?? "User";

        await _context.SaveChangesAsync();
        return Ok(new { message = "Stock Opname Processed", status = opname.Status, journalEntryId = journalLines.Any() ? journalEntryId : (Guid?)null });
    }
}
