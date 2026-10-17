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

    public WarehousesController(ApplicationDbContext context, ModuleEntitlementService entitlement)
    {
        _context = context;
        _entitlement = entitlement;
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
    }

    [HttpGet]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<List<Warehouse>>> GetAll() =>
        await _context.Warehouses.AsNoTracking().OrderBy(w => w.Code).ToListAsync();

    [HttpPost]
    [RequiresPermission(Permissions.InventoryManage)]
    public async Task<ActionResult<Warehouse>> Create([FromBody] WarehouseRequest request)
    {
        var invalid = await ValidateAsync(request, null);
        if (invalid is not null) return invalid;

        var warehouse = new Warehouse { Id = Guid.NewGuid(), CompanyId = _context.CurrentCompanyId!.Value };
        Apply(warehouse, request);
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

        Apply(warehouse, request);
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
