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
public class SalesOrdersController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;

    public SalesOrdersController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        IDocumentHistoryService historyService)
    {
        _context = context;
        _periodLockService = periodLockService;
        _historyService = historyService;
    }

    [HttpGet]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<IEnumerable<SalesOrder>>> GetAll(
        [FromQuery] Guid? contactId = null,
        [FromQuery] SalesOrderStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _context.SalesOrders
            .Include(o => o.Contact)
            .AsQueryable();

        if (contactId.HasValue)
            query = query.Where(o => o.ContactId == contactId.Value);

        if (status.HasValue)
            query = query.Where(o => o.Status == status.Value);

        if (from.HasValue)
            query = query.Where(o => o.OrderDate >= from.Value);

        if (to.HasValue)
            query = query.Where(o => o.OrderDate <= to.Value);

        return await query.OrderByDescending(o => o.OrderDate).ThenByDescending(o => o.CreatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult<SalesOrder>> GetById(Guid id)
    {
        var order = await _context.SalesOrders
            .Include(o => o.Contact)
            .Include(o => o.Lines)
                .ThenInclude(l => l.Product)
            .Include(o => o.Lines)
                .ThenInclude(l => l.CostCenter)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null)
            return NotFound();

        return order;
    }

    [HttpPost]
    [RequiresPermission(Permissions.SalesCreate)]
    public async Task<ActionResult<SalesOrder>> Create(SalesOrder order)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        await _periodLockService.ValidateTransactionDate(companyId, order.OrderDate);

        if (order.Id == Guid.Empty)
            order.Id = Guid.NewGuid();

        order.CompanyId = companyId;
        order.CreatedAt = DateTime.UtcNow;
        order.CreatedByUserId = GetCurrentUserId();
        order.CreatedBy = GetCurrentUserEmail();
        order.Status = SalesOrderStatus.Draft;

        if (string.IsNullOrWhiteSpace(order.OrderNumber))
        {
            order.OrderNumber = await GenerateOrderNumber();
        }

        CalculateTotals(order);

        _context.SalesOrders.Add(order);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            order.CompanyId,
            "SalesOrder",
            order.Id,
            "Created",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Sales order {order.OrderNumber} created as draft");

        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.SalesEdit)]
    public async Task<IActionResult> Update(Guid id, SalesOrder order)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var existing = await _context.SalesOrders
            .Include(o => o.Lines)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (existing == null)
            return NotFound();

        if (existing.Status != SalesOrderStatus.Draft)
            return BadRequest("Cannot edit a confirmed or delivered sales order");

        await _periodLockService.ValidateTransactionDate(companyId, existing.OrderDate);
        await _periodLockService.ValidateTransactionDate(companyId, order.OrderDate);

        existing.OrderDate = order.OrderDate;
        existing.ExpectedDeliveryDate = order.ExpectedDeliveryDate;
        existing.ContactId = order.ContactId;
        existing.ShippingAddress = order.ShippingAddress;
        existing.Currency = order.Currency;
        existing.ExchangeRate = order.ExchangeRate;
        existing.DiscountAmount = order.DiscountAmount;
        existing.DiscountPercent = order.DiscountPercent;
        existing.ReferenceNumber = order.ReferenceNumber;
        existing.Notes = order.Notes;
        existing.Terms = order.Terms;
        existing.TemplateName = order.TemplateName;

        _context.SalesOrderLines.RemoveRange(existing.Lines);
        existing.Lines = order.Lines;
        CalculateTotals(existing);
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "SalesOrder",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Sales order {existing.OrderNumber} updated");

        return NoContent();
    }

    [HttpPost("{id}/approve")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Approve(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var order = await _context.SalesOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        if (order.Status != SalesOrderStatus.Draft && order.Status != SalesOrderStatus.Pending)
            return BadRequest("Only draft sales orders can be approved");

        order.Status = SalesOrderStatus.Approved;
        order.ApprovedAt = DateTime.UtcNow;
        order.ApprovedByUserId = GetCurrentUserId();
        order.ApprovedBy = GetCurrentUserEmail();
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            order.CompanyId,
            "SalesOrder",
            order.Id,
            "Approved",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Sales order {order.OrderNumber} approved");

        return Ok(order);
    }

    [HttpPost("{id}/cancel")]
    [RequiresPermission(Permissions.SalesApprove)]
    public async Task<IActionResult> Cancel(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var order = await _context.SalesOrders.FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();

        if (order.Status == SalesOrderStatus.Delivered || order.Status == SalesOrderStatus.Invoiced)
            return BadRequest("Cannot cancel an already delivered or invoiced order");

        order.Status = SalesOrderStatus.Cancelled;
        order.CancelledAt = DateTime.UtcNow;
        order.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            order.CompanyId,
            "SalesOrder",
            order.Id,
            "Cancelled",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Sales order {order.OrderNumber} cancelled");

        return Ok(order);
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.SalesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var order = await _context.SalesOrders.FindAsync(id);
        if (order == null) return NotFound();

        if (order.Status != SalesOrderStatus.Draft)
            return BadRequest("Can only delete draft sales orders");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, order.OrderDate);

        _context.SalesOrders.Remove(order);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private void CalculateTotals(SalesOrder order)
    {
        decimal grossSubtotal = 0;
        int lineNum = 1;

        foreach (var line in order.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.SalesOrderId = order.Id;
            line.LineNumber = lineNum++;

            var lineSubtotal = line.Quantity * line.UnitPrice;
            if (line.DiscountPercent > 0)
            {
                line.DiscountAmount = Math.Round(lineSubtotal * (line.DiscountPercent / 100m), 2, MidpointRounding.ToEven);
            }
            var netLine = lineSubtotal - line.DiscountAmount;
            grossSubtotal += netLine;
        }

        var orderDiscount = order.DiscountPercent > 0
            ? Math.Round(grossSubtotal * (order.DiscountPercent / 100m), 2, MidpointRounding.ToEven)
            : order.DiscountAmount;

        order.DiscountAmount = orderDiscount;
        var netSubtotal = grossSubtotal - orderDiscount;
        order.Subtotal = netSubtotal;

        decimal taxAmount = 0;
        decimal discountRatio = grossSubtotal > 0 ? (netSubtotal / grossSubtotal) : 1m;

        foreach (var line in order.Lines)
        {
            var netLine = (line.Quantity * line.UnitPrice) - line.DiscountAmount;
            var lineDpp = Math.Round(netLine * discountRatio, 2, MidpointRounding.ToEven);
            line.TaxAmount = line.IsTaxable ? Math.Round(lineDpp * (line.TaxRate / 100m), 2, MidpointRounding.ToEven) : 0m;
            line.LineTotal = lineDpp + line.TaxAmount;
            taxAmount += line.TaxAmount;
        }

        order.TaxAmount = taxAmount;
        order.Total = netSubtotal + taxAmount;
    }

    private async Task<string> GenerateOrderNumber()
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = $"SO-{yearMonth}-";

        var lastNumber = await _context.SalesOrders
            .Where(o => o.OrderNumber.StartsWith(prefix))
            .OrderByDescending(o => o.OrderNumber)
            .Select(o => o.OrderNumber)
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
