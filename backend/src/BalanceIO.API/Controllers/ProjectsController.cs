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
public class ProjectsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ProjectsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Project>>> GetAll()
    {
        return await _context.Projects
            .Where(p => p.Status == ProjectStatus.Active)
            .OrderBy(p => p.Name)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Project>> GetById(Guid id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null) return NotFound();
        return project;
    }

    [HttpPost]
    public async Task<ActionResult<Project>> Create(Project project)
    {
        if (project.Id == Guid.Empty) project.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        project.CompanyId = _context.CurrentCompanyId.Value;
        project.CreatedAt = DateTime.UtcNow;
        project.Status = ProjectStatus.Active;

        _context.Projects.Add(project);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, Project project)
    {
        if (id != project.Id) return BadRequest();

        var existing = await _context.Projects.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Name = project.Name;
        existing.Code = project.Code;
        existing.Description = project.Description;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var project = await _context.Projects.FindAsync(id);
        if (project == null) return NotFound();

        // Soft delete
        project.Status = ProjectStatus.Archived;
        project.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
