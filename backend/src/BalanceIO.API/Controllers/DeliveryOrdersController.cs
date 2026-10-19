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
public class DeliveryOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly InventoryLedger _inventory;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;

    public DeliveryOrdersController(
        ApplicationDbContext context,
        InventoryLedger inventory,
        IPeriodLockService periodLockService,
        IDocumentHistoryService historyService)
    {
        _context = context;
        _inventory = inventory;
        _periodLockService = periodLockService;
        _historyService = historyService;
    }

    [HttpGet]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<IEnumerable<DeliveryOrder>>> GetAll(
        [FromQuery] Guid? contactId = null,
        [FromQuery] DeliveryOrderStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _context.DeliveryOrders
            .Include(d => d.Contact)
            .Include(d => d.SalesOrder)
            .Include(d => d.Warehouse)
            .AsQueryable();

        if (contactId.HasValue)
            query = query.Where(d => d.ContactId == contactId.Value);

        if (status.HasValue)
            query = query.Where(d => d.Status == status.Value);

        if (from.HasValue)
            query = query.Where(d => d.DeliveryDate >= from.Value);

        if (to.HasValue)
            query = query.Where(d => d.DeliveryDate <= to.Value);

        return await query.OrderByDescending(d => d.DeliveryDate).ThenByDescending(d => d.CreatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<DeliveryOrder>> GetById(Guid id)
    {
        var order = await _context.DeliveryOrders
            .Include(d => d.Contact)
            .Include(d => d.SalesOrder)
            .Include(d => d.Warehouse)
            .Include(d => d.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (order == null)
            return NotFound();

        return order;
    }

    [HttpPost]
    [RequiresPermission(Permissions.SalesCreate)]
    public async Task<ActionResult<DeliveryOrder>> Create(DeliveryOrder deliveryOrder)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        await _periodLockService.ValidateTransactionDate(companyId, deliveryOrder.DeliveryDate);

        if (deliveryOrder.Id == Guid.Empty)
            deliveryOrder.Id = Guid.NewGuid();

        deliveryOrder.CompanyId = companyId;
        deliveryOrder.WarehouseId = await _inventory.ResolveAsync(companyId, deliveryOrder.WarehouseId);
        deliveryOrder.CreatedAt = DateTime.UtcNow;
        deliveryOrder.CreatedByUserId = GetCurrentUserId();
        deliveryOrder.CreatedBy = GetCurrentUserEmail();
        deliveryOrder.Status = DeliveryOrderStatus.Draft;

        if (string.IsNullOrWhiteSpace(deliveryOrder.DeliveryNumber))
        {
            deliveryOrder.DeliveryNumber = await GenerateDeliveryNumber();
        }

        int lineNum = 1;
        foreach (var line in deliveryOrder.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.DeliveryOrderId = deliveryOrder.Id;
            line.LineNumber = lineNum++;
        }

        _context.DeliveryOrders.Add(deliveryOrder);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            deliveryOrder.CompanyId,
            "DeliveryOrder",
            deliveryOrder.Id,
            "Created",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Delivery order {deliveryOrder.DeliveryNumber} created as draft");

        return CreatedAtAction(nameof(GetById), new { id = deliveryOrder.Id }, deliveryOrder);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.SalesEdit)]
    public async Task<IActionResult> Update(Guid id, DeliveryOrder deliveryOrder)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var existing = await _context.DeliveryOrders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (existing == null)
            return NotFound();

        if (existing.Status != DeliveryOrderStatus.Draft)
            return BadRequest("Cannot edit a shipped or delivered order");

        await _periodLockService.ValidateTransactionDate(companyId, existing.DeliveryDate);
        await _periodLockService.ValidateTransactionDate(companyId, deliveryOrder.DeliveryDate);

        existing.DeliveryDate = deliveryOrder.DeliveryDate;
        existing.ContactId = deliveryOrder.ContactId;
        existing.SalesOrderId = deliveryOrder.SalesOrderId;
        existing.WarehouseId = await _inventory.ResolveAsync(companyId, deliveryOrder.WarehouseId);
        existing.ShippingAddress = deliveryOrder.ShippingAddress;
        existing.ShippingMethod = deliveryOrder.ShippingMethod;
        existing.TrackingNumber = deliveryOrder.TrackingNumber;
        existing.Notes = deliveryOrder.Notes;

        _context.DeliveryOrderLines.RemoveRange(existing.Lines);
        int lineNum = 1;
        foreach (var line in deliveryOrder.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.DeliveryOrderId = existing.Id;
            line.LineNumber = lineNum++;
        }
        existing.Lines = deliveryOrder.Lines;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "DeliveryOrder",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Delivery order {existing.DeliveryNumber} updated");

        return NoContent();
    }

    [HttpPost("{id}/ship")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Ship(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var order = await _context.DeliveryOrders
            .Include(d => d.Lines)
                .ThenInclude(l => l.Product)
            .Include(d => d.SalesOrder)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (order == null)
            return NotFound();

        if (order.Status != DeliveryOrderStatus.Draft && order.Status != DeliveryOrderStatus.Pending)
            return BadRequest("Only draft or pending delivery orders can be shipped");

        await _periodLockService.ValidateTransactionDate(companyId, order.DeliveryDate);
        var warehouseId = await _inventory.ResolveAsync(companyId, order.WarehouseId);
        order.WarehouseId = warehouseId;

        // Process stock deduction in inventory
        foreach (var line in order.Lines)
        {
            if (line.ProductId.HasValue && line.Product != null && line.Product.TrackInventory)
            {
                await _inventory.MoveAsync(
                    product: line.Product,
                    warehouseId: warehouseId,
                    quantity: -line.Quantity, // Decreases stock
                    type: InventoryMovementType.Sale,
                    date: order.DeliveryDate,
                    totalCost: null,
                    reference: order.DeliveryNumber,
                    journalEntryId: null,
                    notes: $"Shipment for Delivery Order {order.DeliveryNumber}",
                    reversal: false);
            }
        }

        order.Status = DeliveryOrderStatus.Shipped;
        order.ShippedAt = DateTime.UtcNow;
        order.ApprovedByUserId = GetCurrentUserId();
        order.ApprovedBy = GetCurrentUserEmail();
        order.ApprovedAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        if (order.SalesOrderId.HasValue && order.SalesOrder != null)
        {
            order.SalesOrder.Status = SalesOrderStatus.Delivered;
            order.SalesOrder.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            order.CompanyId,
            "DeliveryOrder",
            order.Id,
            "Shipped",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Delivery order {order.DeliveryNumber} marked as shipped");

        return Ok(order);
    }

    [HttpPost("{id}/deliver")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Deliver(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var order = await _context.DeliveryOrders.FirstOrDefaultAsync(d => d.Id == id);
        if (order == null) return NotFound();

        if (order.Status != DeliveryOrderStatus.Shipped)
            return BadRequest("Only shipped orders can be marked as delivered");

        order.Status = DeliveryOrderStatus.Delivered;
        order.DeliveredAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            order.CompanyId,
            "DeliveryOrder",
            order.Id,
            "Delivered",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Delivery order {order.DeliveryNumber} marked as delivered");

        return Ok(order);
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.SalesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var order = await _context.DeliveryOrders.FindAsync(id);
        if (order == null) return NotFound();

        if (order.Status != DeliveryOrderStatus.Draft)
            return BadRequest("Can only delete draft delivery orders");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, order.DeliveryDate);

        _context.DeliveryOrders.Remove(order);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<string> GenerateDeliveryNumber()
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = $"DO-{yearMonth}-";

        var lastNumber = await _context.DeliveryOrders
            .Where(d => d.DeliveryNumber.StartsWith(prefix))
            .OrderByDescending(d => d.DeliveryNumber)
            .Select(d => d.DeliveryNumber)
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
}
