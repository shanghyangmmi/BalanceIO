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
public class GoodsReceiptsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly InventoryLedger _inventory;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;

    public GoodsReceiptsController(
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
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<IEnumerable<GoodsReceipt>>> GetAll(
        [FromQuery] Guid? contactId = null,
        [FromQuery] GoodsReceiptStatus? status = null,
        [FromQuery] DateOnly? from = null,
        [FromQuery] DateOnly? to = null)
    {
        var query = _context.GoodsReceipts
            .Include(g => g.Contact)
            .Include(g => g.PurchaseOrder)
            .Include(g => g.Warehouse)
            .AsQueryable();

        if (contactId.HasValue)
            query = query.Where(g => g.ContactId == contactId.Value);

        if (status.HasValue)
            query = query.Where(g => g.Status == status.Value);

        if (from.HasValue)
            query = query.Where(g => g.ReceiptDate >= from.Value);

        if (to.HasValue)
            query = query.Where(g => g.ReceiptDate <= to.Value);

        return await query.OrderByDescending(g => g.ReceiptDate).ThenByDescending(g => g.CreatedAt).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.PurchasesView)]
    public async Task<ActionResult<GoodsReceipt>> GetById(Guid id)
    {
        var receipt = await _context.GoodsReceipts
            .Include(g => g.Contact)
            .Include(g => g.PurchaseOrder)
            .Include(g => g.Warehouse)
            .Include(g => g.Lines)
                .ThenInclude(l => l.Product)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (receipt == null)
            return NotFound();

        return receipt;
    }

    [HttpPost]
    [RequiresPermission(Permissions.PurchasesCreate)]
    public async Task<ActionResult<GoodsReceipt>> Create(GoodsReceipt receipt)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        await _periodLockService.ValidateTransactionDate(companyId, receipt.ReceiptDate);

        if (receipt.Id == Guid.Empty)
            receipt.Id = Guid.NewGuid();

        receipt.CompanyId = companyId;
        receipt.WarehouseId = await _inventory.ResolveAsync(companyId, receipt.WarehouseId);
        receipt.CreatedAt = DateTime.UtcNow;
        receipt.CreatedByUserId = GetCurrentUserId();
        receipt.CreatedBy = GetCurrentUserEmail();
        receipt.Status = GoodsReceiptStatus.Draft;

        if (string.IsNullOrWhiteSpace(receipt.ReceiptNumber))
        {
            receipt.ReceiptNumber = await GenerateReceiptNumber();
        }

        int lineNum = 1;
        foreach (var line in receipt.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.GoodsReceiptId = receipt.Id;
            line.LineNumber = lineNum++;
        }

        _context.GoodsReceipts.Add(receipt);
        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            receipt.CompanyId,
            "GoodsReceipt",
            receipt.Id,
            "Created",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Goods receipt {receipt.ReceiptNumber} created as draft");

        return CreatedAtAction(nameof(GetById), new { id = receipt.Id }, receipt);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.PurchasesEdit)]
    public async Task<IActionResult> Update(Guid id, GoodsReceipt receipt)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var existing = await _context.GoodsReceipts
            .Include(g => g.Lines)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (existing == null)
            return NotFound();

        if (existing.Status != GoodsReceiptStatus.Draft)
            return BadRequest("Cannot edit a received or cancelled goods receipt");

        await _periodLockService.ValidateTransactionDate(companyId, existing.ReceiptDate);
        await _periodLockService.ValidateTransactionDate(companyId, receipt.ReceiptDate);

        existing.ReceiptDate = receipt.ReceiptDate;
        existing.ContactId = receipt.ContactId;
        existing.PurchaseOrderId = receipt.PurchaseOrderId;
        existing.WarehouseId = await _inventory.ResolveAsync(companyId, receipt.WarehouseId);
        existing.VendorDeliveryNote = receipt.VendorDeliveryNote;
        existing.Notes = receipt.Notes;

        _context.GoodsReceiptLines.RemoveRange(existing.Lines);
        int lineNum = 1;
        foreach (var line in receipt.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.GoodsReceiptId = existing.Id;
            line.LineNumber = lineNum++;
        }
        existing.Lines = receipt.Lines;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            existing.CompanyId,
            "GoodsReceipt",
            existing.Id,
            "Updated",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Goods receipt {existing.ReceiptNumber} updated");

        return NoContent();
    }

    [HttpPost("{id}/receive")]
    [RequiresPermission(Permissions.PurchasesApprove)]
    public async Task<IActionResult> Receive(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var receipt = await _context.GoodsReceipts
            .Include(g => g.Lines)
                .ThenInclude(l => l.Product)
            .Include(g => g.PurchaseOrder)
            .FirstOrDefaultAsync(g => g.Id == id);

        if (receipt == null)
            return NotFound();

        if (receipt.Status != GoodsReceiptStatus.Draft && receipt.Status != GoodsReceiptStatus.Pending)
            return BadRequest("Only draft or pending goods receipts can be received");

        await _periodLockService.ValidateTransactionDate(companyId, receipt.ReceiptDate);
        var warehouseId = await _inventory.ResolveAsync(companyId, receipt.WarehouseId);
        receipt.WarehouseId = warehouseId;

        // Process stock addition in inventory
        foreach (var line in receipt.Lines)
        {
            if (line.ProductId.HasValue && line.Product != null && line.Product.TrackInventory)
            {
                var qty = line.QuantityReceived > 0 ? line.QuantityReceived : line.QuantityOrdered;
                await _inventory.MoveAsync(
                    product: line.Product,
                    warehouseId: warehouseId,
                    quantity: qty, // Increases stock
                    type: InventoryMovementType.Purchase,
                    date: receipt.ReceiptDate,
                    totalCost: null, // Follows buy price / average cost
                    reference: receipt.ReceiptNumber,
                    journalEntryId: null,
                    notes: $"Receipt for Goods Receipt {receipt.ReceiptNumber}",
                    reversal: false);
            }
        }

        receipt.Status = GoodsReceiptStatus.Posted;
        receipt.PostedAt = DateTime.UtcNow;
        receipt.ApprovedByUserId = GetCurrentUserId();
        receipt.ApprovedBy = GetCurrentUserEmail();
        receipt.ApprovedAt = DateTime.UtcNow;
        receipt.UpdatedAt = DateTime.UtcNow;

        if (receipt.PurchaseOrderId.HasValue && receipt.PurchaseOrder != null)
        {
            receipt.PurchaseOrder.Status = PurchaseOrderStatus.Received;
            receipt.PurchaseOrder.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        await _historyService.RecordEventAsync(
            receipt.CompanyId,
            "GoodsReceipt",
            receipt.Id,
            "Received",
            GetCurrentUserId() ?? Guid.Empty,
            GetCurrentUserName(),
            $"Goods receipt {receipt.ReceiptNumber} marked as received");

        return Ok(receipt);
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.PurchasesDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var receipt = await _context.GoodsReceipts.FindAsync(id);
        if (receipt == null) return NotFound();

        if (receipt.Status != GoodsReceiptStatus.Draft)
            return BadRequest("Can only delete draft goods receipts");

        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, receipt.ReceiptDate);

        _context.GoodsReceipts.Remove(receipt);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private async Task<string> GenerateReceiptNumber()
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = $"GR-{yearMonth}-";

        var lastNumber = await _context.GoodsReceipts
            .Where(g => g.ReceiptNumber.StartsWith(prefix))
            .OrderByDescending(g => g.ReceiptNumber)
            .Select(g => g.ReceiptNumber)
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
