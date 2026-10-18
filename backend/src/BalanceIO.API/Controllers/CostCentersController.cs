using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Cost Centre Master Data and Hierarchical Organization (Division -> Department -> Sub-unit).
/// Supports budgeting, expense allocation, and dimensional P&L reporting.
/// </summary>
[ApiController]
[Route("api/cost-centers")]
[Authorize]
public class CostCentersController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CostCentersController(ApplicationDbContext context)
    {
        _context = context;
    }

    private Guid CompanyId => _context.CurrentCompanyId
        ?? throw new InvalidOperationException("Company context is required. Send the X-Company-Id header.");

    // GET: api/cost-centers
    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<List<CostCenterDto>>> GetAll(
        [FromQuery] bool hierarchy = false,
        [FromQuery] bool includeInactive = false)
    {
        var companyId = CompanyId;

        var query = _context.CostCenters
            .Include(c => c.Parent)
            .Include(c => c.ManagerContact)
            .Where(c => c.CompanyId == companyId);

        if (!includeInactive)
        {
            query = query.Where(c => c.IsActive);
        }

        var allItems = await query
            .OrderBy(c => c.Code)
            .ToListAsync();

        var dtos = allItems.Select(c => new CostCenterDto
        {
            Id = c.Id,
            CompanyId = c.CompanyId,
            Code = c.Code,
            Name = c.Name,
            Description = c.Description,
            ParentId = c.ParentId,
            ParentName = c.Parent?.Name,
            ManagerContactId = c.ManagerContactId,
            ManagerName = c.ManagerContact?.Name,
            IsActive = c.IsActive,
            IsDiscontinued = c.IsDiscontinued,
            DiscontinuedDate = c.DiscontinuedDate,
            CreatedAt = c.CreatedAt,
            UpdatedAt = c.UpdatedAt
        }).ToList();

        if (!hierarchy)
        {
            return Ok(dtos);
        }

        // Build hierarchical tree
        var map = dtos.ToDictionary(d => d.Id);
        var roots = new List<CostCenterDto>();

        foreach (var item in dtos)
        {
            if (item.ParentId.HasValue && map.TryGetValue(item.ParentId.Value, out var parent))
            {
                parent.Children.Add(item);
            }
            else
            {
                roots.Add(item);
            }
        }

        return Ok(roots);
    }

    // GET: api/cost-centers/{id}
    [HttpGet("{id:guid}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<CostCenterDto>> GetById(Guid id)
    {
        var companyId = CompanyId;

        var item = await _context.CostCenters
            .Include(c => c.Parent)
            .Include(c => c.ManagerContact)
            .Include(c => c.Children)
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Id == id);

        if (item == null)
            return NotFound();

        var dto = new CostCenterDto
        {
            Id = item.Id,
            CompanyId = item.CompanyId,
            Code = item.Code,
            Name = item.Name,
            Description = item.Description,
            ParentId = item.ParentId,
            ParentName = item.Parent?.Name,
            ManagerContactId = item.ManagerContactId,
            ManagerName = item.ManagerContact?.Name,
            IsActive = item.IsActive,
            IsDiscontinued = item.IsDiscontinued,
            DiscontinuedDate = item.DiscontinuedDate,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt,
            Children = item.Children.Select(ch => new CostCenterDto
            {
                Id = ch.Id,
                CompanyId = ch.CompanyId,
                Code = ch.Code,
                Name = ch.Name,
                Description = ch.Description,
                ParentId = ch.ParentId,
                IsActive = ch.IsActive,
                IsDiscontinued = ch.IsDiscontinued,
                DiscontinuedDate = ch.DiscontinuedDate
            }).ToList()
        };

        return Ok(dto);
    }

    // POST: api/cost-centers
    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<CostCenterDto>> Create([FromBody] CreateCostCenterRequest request)
    {
        var companyId = CompanyId;

        var cleanCode = request.Code.Trim();
        var cleanName = request.Name.Trim();

        var exists = await _context.CostCenters.AnyAsync(c => c.CompanyId == companyId && c.Code == cleanCode);
        if (exists)
        {
            return BadRequest(new { code = "DUPLICATE_CODE", message = $"Cost center code '{cleanCode}' already exists." });
        }

        if (request.ParentId.HasValue)
        {
            var validParent = await _context.CostCenters.AnyAsync(c => c.CompanyId == companyId && c.Id == request.ParentId.Value);
            if (!validParent)
            {
                return BadRequest(new { code = "INVALID_PARENT", message = "Parent cost center not found." });
            }
        }

        if (request.ManagerContactId.HasValue)
        {
            var validManager = await _context.Contacts.AnyAsync(c => c.CompanyId == companyId && c.Id == request.ManagerContactId.Value);
            if (!validManager)
            {
                return BadRequest(new { code = "INVALID_MANAGER", message = "Manager contact not found." });
            }
        }

        var costCenter = new CostCenter
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Code = cleanCode,
            Name = cleanName,
            Description = request.Description?.Trim(),
            ParentId = request.ParentId,
            ManagerContactId = request.ManagerContactId,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        _context.CostCenters.Add(costCenter);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = costCenter.Id }, new CostCenterDto
        {
            Id = costCenter.Id,
            CompanyId = costCenter.CompanyId,
            Code = costCenter.Code,
            Name = costCenter.Name,
            Description = costCenter.Description,
            ParentId = costCenter.ParentId,
            ManagerContactId = costCenter.ManagerContactId,
            IsActive = costCenter.IsActive,
            CreatedAt = costCenter.CreatedAt
        });
    }

    // PUT: api/cost-centers/{id}
    [HttpPut("{id:guid}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<ActionResult<CostCenterDto>> Update(Guid id, [FromBody] UpdateCostCenterRequest request)
    {
        var companyId = CompanyId;

        var costCenter = await _context.CostCenters
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Id == id);

        if (costCenter == null)
            return NotFound();

        var cleanCode = request.Code.Trim();
        var cleanName = request.Name.Trim();

        var duplicate = await _context.CostCenters.AnyAsync(c => c.CompanyId == companyId && c.Id != id && c.Code == cleanCode);
        if (duplicate)
        {
            return BadRequest(new { code = "DUPLICATE_CODE", message = $"Cost center code '{cleanCode}' already exists." });
        }

        if (request.ParentId.HasValue)
        {
            if (request.ParentId.Value == id)
            {
                return BadRequest(new { code = "CIRCULAR_HIERARCHY", message = "A cost center cannot be its own parent." });
            }

            var parent = await _context.CostCenters.FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Id == request.ParentId.Value);
            if (parent == null)
            {
                return BadRequest(new { code = "INVALID_PARENT", message = "Parent cost center not found." });
            }

            // Cycle detection: traverse parent hierarchy up to ensure id is not an ancestor
            var currParentId = parent.ParentId;
            while (currParentId.HasValue)
            {
                if (currParentId.Value == id)
                {
                    return BadRequest(new { code = "CIRCULAR_HIERARCHY", message = "Setting this parent would cause a circular hierarchy." });
                }
                var ancestor = await _context.CostCenters
                    .Where(c => c.CompanyId == companyId && c.Id == currParentId.Value)
                    .Select(c => c.ParentId)
                    .FirstOrDefaultAsync();
                currParentId = ancestor;
            }
        }

        if (request.ManagerContactId.HasValue)
        {
            var validManager = await _context.Contacts.AnyAsync(c => c.CompanyId == companyId && c.Id == request.ManagerContactId.Value);
            if (!validManager)
            {
                return BadRequest(new { code = "INVALID_MANAGER", message = "Manager contact not found." });
            }
        }

        costCenter.Code = cleanCode;
        costCenter.Name = cleanName;
        costCenter.Description = request.Description?.Trim();
        costCenter.ParentId = request.ParentId;
        costCenter.ManagerContactId = request.ManagerContactId;
        costCenter.IsActive = request.IsActive;
        costCenter.IsDiscontinued = request.IsDiscontinued;
        costCenter.DiscontinuedDate = request.IsDiscontinued
            ? (request.DiscontinuedDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)))
            : null;
        costCenter.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new CostCenterDto
        {
            Id = costCenter.Id,
            CompanyId = costCenter.CompanyId,
            Code = costCenter.Code,
            Name = costCenter.Name,
            Description = costCenter.Description,
            ParentId = costCenter.ParentId,
            ManagerContactId = costCenter.ManagerContactId,
            IsActive = costCenter.IsActive,
            IsDiscontinued = costCenter.IsDiscontinued,
            DiscontinuedDate = costCenter.DiscontinuedDate,
            CreatedAt = costCenter.CreatedAt,
            UpdatedAt = costCenter.UpdatedAt
        });
    }

    // DELETE: api/cost-centers/{id}
    [HttpDelete("{id:guid}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var companyId = CompanyId;

        var costCenter = await _context.CostCenters
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Id == id);

        if (costCenter == null)
            return NotFound();

        // Check if cost center has child cost centers
        var hasChildren = await _context.CostCenters.AnyAsync(c => c.CompanyId == companyId && c.ParentId == id);
        if (hasChildren)
        {
            return BadRequest(new { code = "HAS_CHILDREN", message = "Cannot delete cost center with sub-units. Reassign or delete sub-units first." });
        }

        // Check if referenced by journal lines
        var inUseInJournals = await _context.JournalLines.AnyAsync(l => l.CostCenterId == id);
        if (inUseInJournals)
        {
            return BadRequest(new { code = "COST_CENTER_IN_USE", message = "Cannot delete cost center that is referenced by journal lines. Deactivate or discontinue it instead." });
        }

        // Check if assigned to employee compensation or fixed assets
        var inUseInEmployees = await _context.EmployeeCompensations.AnyAsync(e => e.CostCenterId == id);
        if (inUseInEmployees)
        {
            return BadRequest(new { code = "COST_CENTER_IN_USE", message = "Cannot delete cost center assigned to active employee compensation." });
        }

        var inUseInAssets = await _context.FixedAssets.AnyAsync(a => a.CostCenterId == id);
        if (inUseInAssets)
        {
            return BadRequest(new { code = "COST_CENTER_IN_USE", message = "Cannot delete cost center assigned to fixed assets." });
        }

        _context.CostCenters.Remove(costCenter);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
