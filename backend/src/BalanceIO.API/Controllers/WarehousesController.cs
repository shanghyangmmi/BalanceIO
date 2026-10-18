using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>Warehouse master data for the inventory module.</summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class WarehousesController : ControllerBase, IAsyncActionFilter
{
    private const string Module = "inventory";

    private readonly ApplicationDbContext _context;
    private readonly ModuleEntitlementService _entitlement;
    private readonly InventoryLedger _inventory;

    public WarehousesController(ApplicationDbContext context, ModuleEntitlementService entitlement, InventoryLedger inventory)
    {
        _context = context;
        _entitlement = entitlement;
        _inventory = inventory;
    }

    [NonAction]
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            context.Result = BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
            return;
        }

        if (!await _entitlement.HasAsync(_context.CurrentCompanyId.Value, Module))
        {
            context.Result = StatusCode(StatusCodes.Status402PaymentRequired, new
            {
                error = "MODULE_NOT_ENTITLED",
                module = Module,
                message = "This module is not included in the company's current plan.",
            });
            return;
        }

        await next();
    }

    public class WarehouseRequest
    {
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? City { get; set; }
        public WarehouseType Type { get; set; }
        public bool IsActive { get; set; } = true;
        public bool IsDefault { get; set; }
    }

    public class TransferRequest
    {
        public Guid ProductId { get; set; }
        public Guid FromWarehouseId { get; set; }
        public Guid ToWarehouseId { get; set; }
        public decimal Quantity { get; set; }
        public DateOnly? Date { get; set; }
        public string? Notes { get; set; }
    }

    [HttpGet]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<List<Warehouse>>> GetAll()
    {
        // Every company that keeps stock has a default warehouse; make sure
        // one exists before anyone is asked to pick from the list.
        var companyId = _context.CurrentCompanyId!.Value;
        if (!await _context.Warehouses.AnyAsync(w => w.IsDefault))
        {
            await _inventory.DefaultWarehouseAsync(companyId);
            await _context.SaveChangesAsync();
        }

        return await _context.Warehouses.AsNoTracking()
            .OrderByDescending(w => w.IsDefault).ThenBy(w => w.Code).ToListAsync();
    }

    /// <summary>
    /// Stock per warehouse and product, from the movements, with value at
    /// the product's buy price. The warehouse totals add up to each
    /// product's stock on hand.
    /// </summary>
    [HttpGet("stock")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<object>> GetStock([FromQuery] Guid? warehouseId = null)
    {
        var warehouses = await _context.Warehouses.AsNoTracking().ToListAsync();

        // Grouped in memory: SQLite stores decimal(19,4) as REAL.
        var movements = await _context.InventoryMovements.AsNoTracking()
            .Where(m => m.WarehouseId != null && (!warehouseId.HasValue || m.WarehouseId == warehouseId))
            .Select(m => new { m.WarehouseId, m.ProductId, m.Quantity })
            .ToListAsync();

        var productIds = movements.Select(m => m.ProductId).Distinct().ToList();
        var products = await _context.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Code, p.Name, p.Unit, p.BuyPrice })
            .ToDictionaryAsync(p => p.Id);

        var rows = movements
            .GroupBy(m => new { WarehouseId = m.WarehouseId!.Value, m.ProductId })
            .Select(g => new { g.Key.WarehouseId, g.Key.ProductId, Quantity = g.Sum(m => m.Quantity) })
            .Where(r => r.Quantity != 0m && products.ContainsKey(r.ProductId))
            .Select(r =>
            {
                var p = products[r.ProductId];
                var w = warehouses.FirstOrDefault(x => x.Id == r.WarehouseId);
                return new
                {
                    r.WarehouseId,
                    WarehouseCode = w?.Code,
                    WarehouseName = w?.Name,
                    r.ProductId,
                    ProductCode = p.Code,
                    ProductName = p.Name,
                    p.Unit,
                    r.Quantity,
                    UnitCost = p.BuyPrice,
                    Value = Math.Round(r.Quantity * p.BuyPrice, 2, MidpointRounding.ToEven),
                };
            })
            .OrderBy(r => r.WarehouseCode).ThenBy(r => r.ProductCode)
            .ToList();

        var summary = warehouses
            .Where(w => !warehouseId.HasValue || w.Id == warehouseId)
            .OrderByDescending(w => w.IsDefault).ThenBy(w => w.Code)
            .Select(w => new
            {
                w.Id, w.Code, w.Name, w.IsDefault, w.IsActive,
                Items = rows.Count(r => r.WarehouseId == w.Id),
                Value = rows.Where(r => r.WarehouseId == w.Id).Sum(r => r.Value),
                Negative = rows.Count(r => r.WarehouseId == w.Id && r.Quantity < 0m),
            })
            .ToList();

        return Ok(new { warehouses = summary, rows });
    }

    /// <summary>Movements in or out of a warehouse, newest first.</summary>
    [HttpGet("{id:guid}/movements")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<object>> GetMovements(Guid id, [FromQuery] Guid? productId = null, [FromQuery] int take = 200)
    {
        if (!await _context.Warehouses.AnyAsync(w => w.Id == id)) return NotFound();

        var rows = await _context.InventoryMovements.AsNoTracking()
            .Where(m => m.WarehouseId == id && (!productId.HasValue || m.ProductId == productId))
            .OrderByDescending(m => m.MovementDate).ThenByDescending(m => m.CreatedAt)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(m => new
            {
                m.Id, m.MovementDate, Type = m.Type.ToString(), m.Quantity, m.UnitCost,
                m.ReferenceNumber, m.Notes, m.ProductId,
                ProductCode = m.Product!.Code, ProductName = m.Product.Name, m.Product.Unit,
            })
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>
    /// Moves stock from one warehouse to another. No journal entry: the
    /// company holds the same goods at the same cost.
    /// </summary>
    [HttpPost("transfers")]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<ActionResult<object>> Transfer([FromBody] TransferRequest request)
    {
        var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == request.ProductId);
        if (product is null) return NotFound(new { code = "PRODUCT_NOT_FOUND", message = "Product not found." });

        var date = request.Date ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var reference = $"TRF-{date:yyyyMMdd}-{product.Code}";
        await _inventory.TransferAsync(product, request.FromWarehouseId, request.ToWarehouseId, request.Quantity, date, reference,
            string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());
        await _context.SaveChangesAsync();

        return Ok(new
        {
            reference,
            from = await _inventory.QuantityAsync(product.CompanyId, product.Id, request.FromWarehouseId),
            to = await _inventory.QuantityAsync(product.CompanyId, product.Id, request.ToWarehouseId),
        });
    }

    [HttpPost]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<ActionResult<Warehouse>> Create([FromBody] WarehouseRequest request)
    {
        var invalid = await ValidateAsync(request, null);
        if (invalid is not null) return invalid;

        var warehouse = new Warehouse { Id = Guid.NewGuid(), CompanyId = _context.CurrentCompanyId!.Value };
        Apply(warehouse, request);
        // The first warehouse a company records is its default.
        var hasDefault = await _context.Warehouses.AnyAsync(w => w.IsDefault);
        if (request.IsDefault || !hasDefault) await MakeDefaultAsync(warehouse);
        _context.Warehouses.Add(warehouse);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { id = warehouse.Id }, warehouse);
    }

    [HttpPut("{id:guid}")]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<ActionResult<Warehouse>> Update(Guid id, [FromBody] WarehouseRequest request)
    {
        var warehouse = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();

        var invalid = await ValidateAsync(request, id);
        if (invalid is not null) return invalid;

        if (warehouse.IsDefault && !request.IsActive)
            return BadRequest(new { code = "DEFAULT_WAREHOUSE", message = "The default warehouse cannot be deactivated. Make another warehouse the default first." });
        if (warehouse.IsDefault && !request.IsDefault)
            return BadRequest(new { code = "DEFAULT_WAREHOUSE", message = "Choose the new default warehouse instead; a company always has one." });

        Apply(warehouse, request);
        if (request.IsDefault && !warehouse.IsDefault) await MakeDefaultAsync(warehouse);
        warehouse.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Ok(warehouse);
    }

    [HttpDelete("{id:guid}")]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var warehouse = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == id);
        if (warehouse is null) return NotFound();
        if (warehouse.IsDefault)
            return BadRequest(new { code = "DEFAULT_WAREHOUSE", message = "The default warehouse cannot be deleted." });
        if (await _context.InventoryMovements.AnyAsync(m => m.WarehouseId == id))
            return BadRequest(new { code = "WAREHOUSE_IN_USE", message = "Stock has moved through this warehouse; deactivate it instead." });
        _context.Warehouses.Remove(warehouse);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task<ActionResult?> ValidateAsync(WarehouseRequest request, Guid? id)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Code and name are required." });

        if (!Enum.IsDefined(request.Type))
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Unknown warehouse type." });

        var code = request.Code.Trim();
        if (await _context.Warehouses.AnyAsync(w => w.Code == code && w.Id != id))
            return Conflict(new { code = "WAREHOUSE_CODE_EXISTS", message = $"A warehouse with code {code} already exists." });

        return null;
    }

    private async Task MakeDefaultAsync(Warehouse warehouse)
    {
        foreach (var other in await _context.Warehouses.Where(w => w.IsDefault && w.Id != warehouse.Id).ToListAsync())
            other.IsDefault = false;
        warehouse.IsDefault = true;
        warehouse.IsActive = true;
    }

    private static void Apply(Warehouse w, WarehouseRequest r)
    {
        w.Code = r.Code.Trim();
        w.Name = r.Name.Trim();
        w.Address = string.IsNullOrWhiteSpace(r.Address) ? null : r.Address.Trim();
        w.City = string.IsNullOrWhiteSpace(r.City) ? null : r.City.Trim();
        w.Type = r.Type;
        w.IsActive = r.IsActive;
    }
}
