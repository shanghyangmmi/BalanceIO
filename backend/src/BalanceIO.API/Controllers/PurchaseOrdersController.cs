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

    public PurchaseOrdersController(ApplicationDbContext context)
    {
        _context = context;
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

    [HttpPost("{id}/receive")]
    [RequiresPermission(Permissions.InventoryManage)] // Receiving creates stock
    public async Task<IActionResult> Receive(Guid id)
    {
        var order = await _context.PurchaseOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        if (order.Status != PurchaseOrderStatus.Approved)
            return BadRequest("Order must be Approved before receiving");

        // Simple full receive logic
        order.Status = PurchaseOrderStatus.Received;
        order.UpdatedAt = DateTime.UtcNow;

        // Update Stock
        foreach (var line in order.Lines)
        {
            var product = await _context.Products.FindAsync(line.ProductId);
            if (product != null && product.TrackInventory)
            {
                product.StockOnHand += line.Quantity;
                product.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();
        return Ok(order);
    }
}
