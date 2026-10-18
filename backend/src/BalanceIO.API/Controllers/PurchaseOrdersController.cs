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
public class PurchaseOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    private readonly BalanceIO.API.Services.InventoryLedger _inventory;
    private readonly IPeriodLockService _periodLock;

    /// <summary>Goods received not invoiced: the liability a receipt creates until the bill arrives.</summary>
    public const string GrniAccount = "2-1150";

    public PurchaseOrdersController(ApplicationDbContext context, BalanceIO.API.Services.InventoryLedger inventory, IPeriodLockService periodLock)
    {
        _inventory = inventory;
        _context = context;
        _periodLock = periodLock;
    }

    [HttpGet]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<IEnumerable<PurchaseOrder>>> GetAll()
    {
        return await _context.PurchaseOrders
            .Include(o => o.Contact)
            .OrderByDescending(o => o.OrderDate)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<PurchaseOrder>> GetById(Guid id)
    {
        var order = await _context.PurchaseOrders
            .Include(o => o.Contact)
            .Include(o => o.Lines)
            .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();
        return order;
    }

    [HttpPost]
    [RequiresPermission(Permissions.PurchasesCreate)]
    public async Task<ActionResult<PurchaseOrder>> Create(PurchaseOrder order)
    {
        if (order.Id == Guid.Empty) order.Id = Guid.NewGuid();
        
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        order.CompanyId = _context.CurrentCompanyId.Value;
        
        // Generate Number if empty
        if (string.IsNullOrEmpty(order.OrderNumber))
        {
            var count = await _context.PurchaseOrders.CountAsync();
            order.OrderNumber = $"PO-{DateTime.Now:yyyy}-{count + 1:0000}";
        }

        order.CreatedAt = DateTime.UtcNow;
        order.Status = PurchaseOrderStatus.Draft;

        // Ensure lines have IDs
        foreach (var line in order.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.PurchaseOrderId = order.Id;
        }

        _context.PurchaseOrders.Add(order);
        await _context.SaveChangesAsync();
        
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.PurchasesEdit)]
    public async Task<IActionResult> Update(Guid id, PurchaseOrder order)
    {
        if (id != order.Id) return BadRequest();

        var existing = await _context.PurchaseOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (existing == null) return NotFound();
        
        if (existing.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Only Draft orders can be modified");

        existing.OrderDate = order.OrderDate;
        existing.ExpectedDeliveryDate = order.ExpectedDeliveryDate; 
        existing.ContactId = order.ContactId;
        existing.ReferenceNumber = order.ReferenceNumber;
        existing.Notes = order.Notes;
        existing.TotalAmount = order.TotalAmount; // Or recalculate?
        existing.Currency = order.Currency;
        existing.UpdatedAt = DateTime.UtcNow;

        // Update Lines (Simple: Remove all, Add new)
        _context.PurchaseOrderLines.RemoveRange(existing.Lines);
        
        foreach (var line in order.Lines)
        {
            line.Id = Guid.NewGuid();
            line.PurchaseOrderId = existing.Id;
            _context.PurchaseOrderLines.Add(line);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.PurchasesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var order = await _context.PurchaseOrders.FindAsync(id);
        if (order == null) return NotFound();
        
        if (order.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Only Draft orders can be deleted");

        _context.PurchaseOrders.Remove(order);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/approve")]
    [RequiresPermission(Permissions.PurchasesApprove)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var order = await _context.PurchaseOrders.FindAsync(id);
        if (order == null) return NotFound();

        if (order.Status != PurchaseOrderStatus.Draft)
            return BadRequest("Order must be in Draft state");

        order.Status = PurchaseOrderStatus.Approved;
        order.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        return Ok(order);
    }

    /// <summary>
    /// Receives the whole order: tracked goods enter stock at the order price
    /// net of line discount, and the value is posted Dr inventory, Cr goods
    /// received not invoiced (2-1150). The bill later clears 2-1150 and
    /// settles any price difference.
    /// </summary>
    [HttpPost("{id}/receive")]
    [RequiresPermission(Permissions.InventoryManage)] // Receiving creates stock
    public async Task<IActionResult> Receive(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });
        var companyId = _context.CurrentCompanyId.Value;

        var order = await _context.PurchaseOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        if (order.Status != PurchaseOrderStatus.Approved)
            return BadRequest("Order must be Approved before receiving");

        var date = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        await _periodLock.ValidateTransactionDate(companyId, date);

        var received = new List<(Product Product, PurchaseOrderLine Line, decimal Value)>();
        foreach (var line in order.Lines)
        {
            var product = await _context.Products.FindAsync(line.ProductId);
            if (product == null || !product.TrackInventory) continue;
            // Computed here because the order's own totals come from the client.
            var gross = line.Quantity * line.UnitPrice;
            var discount = line.DiscountAmount > 0m ? line.DiscountAmount : gross * line.DiscountPercent / 100m;
            received.Add((product, line, Math.Round(gross - discount, 2, MidpointRounding.ToEven)));
        }

        var inventoryKeys = received.Select(r => r.Product.InventoryAccountId?.ToString() ?? "1-1400").Distinct().ToList();
        var codes = await _context.ResolveAccountCodesAsync(companyId, inventoryKeys.Append(GrniAccount));
        if (received.Any(r => r.Value != 0m) && inventoryKeys.Append(GrniAccount).Any(k => !codes.ContainsKey(k)))
            return BadRequest(new { code = "MISSING_ACCOUNT", message = "The inventory account or Goods Received Not Invoiced (2-1150) is missing from the chart of accounts." });

        JournalEntry? entry = null;
        if (received.Any(r => r.Value != 0m))
        {
            entry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Date = date,
                ReferenceNumber = order.OrderNumber,
                ContactId = order.ContactId.ToString(),
                Currency = "IDR",
                Notes = $"Goods received on purchase order {order.OrderNumber}",
                Status = JournalEntryStatus.Posted,
                CreatedAt = DateTime.UtcNow,
                Lines = new List<JournalLine>(),
            };
            foreach (var r in received.Where(r => r.Value != 0m))
            {
                var inventory = codes[r.Product.InventoryAccountId?.ToString() ?? "1-1400"];
                entry.Lines.Add(new JournalLine { Id = Guid.NewGuid(), AccountId = inventory, Description = $"{r.Product.Name} {r.Line.Quantity:0.####} {r.Product.Unit}", Debit = r.Value, Credit = 0m });
                entry.Lines.Add(new JournalLine { Id = Guid.NewGuid(), AccountId = codes[GrniAccount], Description = $"Received not invoiced, {order.OrderNumber}", Debit = 0m, Credit = r.Value });
            }
            _context.JournalEntries.Add(entry);
        }

        foreach (var r in received)
        {
            await _inventory.MoveAsync(r.Product, order.WarehouseId, r.Line.Quantity, InventoryMovementType.Purchase,
                date, r.Value, order.OrderNumber, entry?.Id,
                $"Received on purchase order {order.OrderNumber}");
        }

        order.Status = PurchaseOrderStatus.Received;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(order);
    }
}
