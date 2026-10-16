using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
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

    public ProductsController(ApplicationDbContext context)
    {
        _context = context;
    }

    // GET: api/products
    [HttpGet]
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

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    // PUT: api/products/{id}
    [HttpPut("{id}")]
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
    [HttpPost("{id}/adjust-stock")]
    public async Task<IActionResult> AdjustStock(Guid id, [FromBody] StockAdjustment adjustment)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null)
            return NotFound();

        if (!product.TrackInventory)
            return BadRequest("This product does not track inventory");

        product.StockOnHand += adjustment.Quantity;
        product.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { stockOnHand = product.StockOnHand });
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
    public decimal Quantity { get; set; }
    public string? Reason { get; set; }
}
