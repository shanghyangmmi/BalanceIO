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
public class ProductUnitsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ProductUnitsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductUnit>>> GetAll()
    {
        return await _context.ProductUnits
            .Where(u => u.IsActive)
            .OrderBy(u => u.Name)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ProductUnit>> GetById(Guid id)
    {
        var unit = await _context.ProductUnits.FindAsync(id);
        if (unit == null) return NotFound();
        return unit;
    }

    [HttpPost]
    public async Task<ActionResult<ProductUnit>> Create(ProductUnit unit)
    {
        if (unit.Id == Guid.Empty) unit.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        unit.CompanyId = _context.CurrentCompanyId.Value;
        _context.ProductUnits.Add(unit);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = unit.Id }, unit);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, ProductUnit unit)
    {
        if (id != unit.Id) return BadRequest();

        var existing = await _context.ProductUnits.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Initials = unit.Initials;
        existing.Name = unit.Name;
        existing.Description = unit.Description;
        existing.IsActive = unit.IsActive;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var unit = await _context.ProductUnits.FindAsync(id);
        if (unit == null) return NotFound();

        // Soft delete
        unit.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
