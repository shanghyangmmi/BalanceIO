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
public class PlansController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public PlansController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get all active plans (public endpoint)
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetPlans()
    {
        var plans = await _context.Plans
            .Where(p => p.IsActive)
            .OrderBy(p => p.SortOrder)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.PriceMonthly,
                p.PriceYearly,
                p.Features,
                p.MaxUsers,
                p.MaxCompanies,
                p.IsPopular
            })
            .ToListAsync();

        // Seed default plans if none exist
        if (!plans.Any())
        {
            await SeedDefaultPlans();
            return await GetPlans();
        }

        return Ok(plans);
    }

    /// <summary>
    /// Get plan by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<Plan>> GetPlan(Guid id)
    {
        var plan = await _context.Plans.FindAsync(id);
        if (plan == null) return NotFound();
        return Ok(plan);
    }

    /// <summary>
    /// Seed default pricing plans
    /// </summary>
    /// <remarks>
    /// The Modules values are a placeholder for a commercial decision, not a
    /// recommendation. What is fixed is the shape: "accounting" is the main
    /// door and is in every plan, and each further module is something the
    /// customer adds. Which module belongs to which tier is yours to set,
    /// here or from the admin plans screen.
    /// </remarks>
    private async Task SeedDefaultPlans()
    {
        var plans = new List<Plan>
        {
            new Plan
            {
                Id = Guid.NewGuid(),
                Name = "Free",
                Description = "Starter plan for small businesses",
                PriceMonthly = 0,
                PriceYearly = 0,
                Features = "[\"1 User\", \"1 Company\", \"Basic Reports (No Export)\", \"10 Transactions Total\", \"10MB Storage Limit\", \"Email Support\"]",
                Modules = "[\"accounting\"]",
                MaxUsers = 1,
                MaxCompanies = 1,
                SortOrder = 1,
                IsActive = true,
                IsPopular = false
            },
            new Plan
            {
                Id = Guid.NewGuid(),
                Name = "Pro",
                Description = "For growing businesses that need more power",
                PriceMonthly = 199000, // Rp 199,000
                PriceYearly = 1990000, // Rp 1,990,000 (save 2 months)
                Features = "[\"5 Users\", \"3 Companies\", \"All Reports\", \"Unlimited Transactions\", \"Multi-Currency\", \"Priority Support\", \"Data Export\"]",
                Modules = "[\"accounting\",\"tax\",\"inventory\"]",
                MaxUsers = 5,
                MaxCompanies = 3,
                SortOrder = 2,
                IsActive = true,
                IsPopular = true
            },
            new Plan
            {
                Id = Guid.NewGuid(),
                Name = "Enterprise",
                Description = "For large organizations with advanced needs",
                PriceMonthly = 499000, // Rp 499,000
                PriceYearly = 4990000, // Rp 4,990,000
                Features = "[\"Unlimited Users\", \"Unlimited Companies\", \"All Reports\", \"Unlimited Transactions\", \"Multi-Currency\", \"API Access\", \"Dedicated Support\", \"Custom Branding\", \"Advanced Analytics\"]",
                Modules = "[\"accounting\",\"tax\",\"inventory\",\"fixedAssets\",\"payroll\"]",
                MaxUsers = 999,
                MaxCompanies = 99,
                SortOrder = 3,
                IsActive = true,
                IsPopular = false
            }
        };

        _context.Plans.AddRange(plans);
        await _context.SaveChangesAsync();
    }
}
