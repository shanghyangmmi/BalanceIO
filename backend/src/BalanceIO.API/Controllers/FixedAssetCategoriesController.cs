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
public class FixedAssetCategoriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FixedAssetCategoriesController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FixedAssetCategory>>> GetAll()
    {
        return await _context.FixedAssetCategories.OrderBy(c => c.Name).ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<FixedAssetCategory>> GetById(Guid id)
    {
        var category = await _context.FixedAssetCategories.FindAsync(id);
        if (category == null) return NotFound();
        return category;
    }

    [HttpPost]
    public async Task<ActionResult<FixedAssetCategory>> Create(FixedAssetCategory category)
    {
        if (category.Id == Guid.Empty) category.Id = Guid.NewGuid();
        
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        category.CompanyId = _context.CurrentCompanyId.Value;
        
        category.CreatedAt = DateTime.UtcNow;
        _context.FixedAssetCategories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, FixedAssetCategory category)
    {
        if (id != category.Id) return BadRequest();

        var existing = await _context.FixedAssetCategories.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Name = category.Name;
        existing.Description = category.Description;
        existing.CodePrefix = category.CodePrefix;
        existing.DefaultUsefulLifeMonths = category.DefaultUsefulLifeMonths;
        existing.DefaultDepreciationMethod = category.DefaultDepreciationMethod;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var category = await _context.FixedAssetCategories.FindAsync(id);
        if (category == null) return NotFound();

        // Check for usage
        var isUsed = await _context.FixedAssets.AnyAsync(a => a.CategoryId == id);
        if (isUsed) return BadRequest("Cannot delete category in use by assets");

        _context.FixedAssetCategories.Remove(category);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
