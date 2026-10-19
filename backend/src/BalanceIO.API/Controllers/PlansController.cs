using System.Text.Json;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
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
///
/// The one exception is <see cref="GetPublicPlans"/>, which the pricing page
/// reads before anyone has signed in. It is a separate, deliberately narrow
/// projection: the same figures a visitor would see on the page, and
/// nothing a plan row holds that the page does not print.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlansController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly PlanLimitService _limits;

    public PlansController(ApplicationDbContext context, PlanLimitService limits)
    {
        _context = context;
        _limits = limits;
    }

    /// <summary>
    /// Get all active plans
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetPlans()
    {
        await EnsureSeededAsync();

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

        return Ok(plans);
    }

    /// <summary>
    /// What the public pricing page prints: active plans with the price a
    /// monthly checkout would be charged right now, and the feature
    /// checklist from the licensing catalogue (the same rows the API
    /// enforces, not marketing copy).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("public")]
    public async Task<ActionResult<PublicPricingDto>> GetPublicPlans(CancellationToken ct)
    {
        await EnsureSeededAsync();

        var now = DateTime.UtcNow;
        var plans = await _context.Plans
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.SortOrder)
            .ToListAsync(ct);

        var planIds = plans.Select(p => p.Id).ToHashSet();

        var features = await _context.PlatformFeatures
            .AsNoTracking()
            .Where(f => f.IsActive)
            .OrderBy(f => f.Module).ThenBy(f => f.SortOrder).ThenBy(f => f.Name)
            .Select(f => new
            {
                f.Key,
                f.Name,
                f.Description,
                f.Module,
                PlanIds = f.PlanFeatures.Select(pf => pf.PlanId).ToList()
            })
            .ToListAsync(ct);

        var window = await _limits.GetWindowAsync(ct);

        return Ok(new PublicPricingDto(
            Currency: "IDR",
            JournalLimitWindow: window,
            Plans: plans.Select(p =>
            {
                var promo = p.IsPromoActive(now);
                return new PublicPlanDto(
                    p.Id,
                    p.Name,
                    p.Description,
                    p.PriceMonthly,
                    p.PriceYearly,
                    promo ? p.PromoPriceMonthly : null,
                    promo ? p.PromoEndsAt : null,
                    p.EffectivePriceMonthly(now),
                    ParseList(p.Features),
                    ParseList(p.Modules),
                    p.MaxUsers,
                    p.MaxCompanies,
                    p.MaxJournalEntries,
                    p.IsPopular);
            }).ToList(),
            Features: features
                .Select(f => new PublicFeatureDto(
                    f.Key, f.Name, f.Description, f.Module,
                    f.PlanIds.Where(planIds.Contains).ToList()))
                .ToList()));
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

    private static List<string> ParseList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    /// <summary>
    /// Seeds only into an empty table. It used to seed whenever no plan was
    /// active, so an administrator who switched every plan off to pause
    /// sales got a fresh duplicate set the next time anyone loaded prices.
    /// </summary>
    private async Task EnsureSeededAsync()
    {
        if (await _context.Plans.AnyAsync()) return;
        await SeedDefaultPlans();
    }

    /// <summary>
    /// Seed default pricing plans
    /// </summary>
    /// <remarks>
    /// One free plan to try the product on, one paid plan with every module.
    /// Enterprise is seeded switched off: it exists so it can be priced and
    /// switched on from the admin plans screen later, not to be sold today.
    /// The promotion is left empty on purpose - its price and end date are
    /// a commercial decision made in admin, not a default.
    /// </remarks>
    private async Task SeedDefaultPlans()
    {
        var plans = new List<Plan>
        {
            new Plan
            {
                Id = Guid.NewGuid(),
                Name = "Free",
                Description = "For trying BalanceIO on real books",
                PriceMonthly = 0,
                PriceYearly = 0,
                Features = "[\"General ledger, journals and period lock\",\"Sales invoices and purchase bills\",\"Financial statements\"]",
                Modules = "[\"accounting\"]",
                MaxUsers = 1,
                MaxCompanies = 1,
                MaxJournalEntries = 50,
                SortOrder = 1,
                IsActive = true,
                IsPopular = false
            },
            new Plan
            {
                Id = Guid.NewGuid(),
                Name = "Pro",
                Description = "Every module on one ledger",
                PriceMonthly = 199000,
                PriceYearly = 1990000,
                Features = "[\"Tax records, SPT Masa PPN and e-Faktur export\",\"Inventory with moving-average cost\",\"Fixed assets with fiscal depreciation\",\"Payroll with PPh 21 and BPJS\",\"Unlimited journal entries\"]",
                Modules = "[\"accounting\",\"tax\",\"inventory\",\"fixedAssets\",\"payroll\"]",
                MaxUsers = 5,
                MaxCompanies = 3,
                MaxJournalEntries = 0,
                SortOrder = 2,
                IsActive = true,
                IsPopular = true
            },
            new Plan
            {
                Id = Guid.NewGuid(),
                Name = "Enterprise",
                Description = "For groups with several entities",
                PriceMonthly = 499000,
                PriceYearly = 4990000,
                Features = "[\"Everything in Pro\",\"More users and companies\"]",
                Modules = "[\"accounting\",\"tax\",\"inventory\",\"fixedAssets\",\"payroll\"]",
                MaxUsers = 999,
                MaxCompanies = 99,
                MaxJournalEntries = 0,
                SortOrder = 3,
                IsActive = false,
                IsPopular = false
            }
        };

        _context.Plans.AddRange(plans);
        await _context.SaveChangesAsync();
    }
}

public sealed record PublicPricingDto(
    string Currency,
    string JournalLimitWindow,
    List<PublicPlanDto> Plans,
    List<PublicFeatureDto> Features);

public sealed record PublicPlanDto(
    Guid Id,
    string Name,
    string? Description,
    decimal PriceMonthly,
    decimal PriceYearly,
    decimal? PromoPriceMonthly,
    DateTime? PromoEndsAt,
    decimal EffectivePriceMonthly,
    List<string> Highlights,
    List<string> Modules,
    int MaxUsers,
    int MaxCompanies,
    int MaxJournalEntries,
    bool IsPopular);

public sealed record PublicFeatureDto(
    string Key,
    string Name,
    string? Description,
    string Module,
    List<Guid> PlanIds);
