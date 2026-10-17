using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
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
public class FixedAssetLocationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public FixedAssetLocationsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<IEnumerable<FixedAssetLocation>>> GetAll()
    {
        return await _context.FixedAssetLocations.OrderBy(l => l.Name).ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<FixedAssetLocation>> GetById(Guid id)
    {
        var location = await _context.FixedAssetLocations.FindAsync(id);
        if (location == null) return NotFound();
        return location;
    }

    [HttpPost]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<ActionResult<FixedAssetLocation>> Create(FixedAssetLocation location)
    {
        if (location.Id == Guid.Empty) location.Id = Guid.NewGuid();
        
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        location.CompanyId = _context.CurrentCompanyId.Value;
        
        location.CreatedAt = DateTime.UtcNow;
        _context.FixedAssetLocations.Add(location);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = location.Id }, location);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<IActionResult> Update(Guid id, FixedAssetLocation location)
    {
        if (id != location.Id) return BadRequest();

        var existing = await _context.FixedAssetLocations.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Name = location.Name;
        existing.Address = location.Address;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.AssetsManage)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var location = await _context.FixedAssetLocations.FindAsync(id);
        if (location == null) return NotFound();

        // Check for usage
        var isUsed = await _context.FixedAssets.AnyAsync(a => a.LocationId == id);
        if (isUsed) return BadRequest("Cannot delete location in use by assets");

        _context.FixedAssetLocations.Remove(location);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
