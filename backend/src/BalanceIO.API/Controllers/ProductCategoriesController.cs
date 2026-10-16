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
public class ProductCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ProductCategoriesController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductCategory>>> GetAll()
    {
        return await _context.ProductCategories
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductCategory>> GetById(Guid id)
    {
        var category = await _context.ProductCategories.FindAsync(id);
        if (category == null) return NotFound();
        return category;
    }

    [HttpPost]
    public async Task<ActionResult<ProductCategory>> Create(ProductCategory category)
    {
        if (category.Id == Guid.Empty) category.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        category.CompanyId = _context.CurrentCompanyId.Value;
        _context.ProductCategories.Add(category);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, ProductCategory category)
    {
        if (id != category.Id) return BadRequest();

        var existing = await _context.ProductCategories.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Name = category.Name;
        existing.Description = category.Description;
        existing.IsActive = category.IsActive;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var category = await _context.ProductCategories.FindAsync(id);
        if (category == null) return NotFound();

        // Soft delete
        category.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
