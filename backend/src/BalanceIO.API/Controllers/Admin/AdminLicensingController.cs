using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

/// <summary>
/// What is sold, what it costs, and which plans include it.
///
/// The matrix endpoint returns plans and features together rather than
/// making the screen assemble them from two calls. Pricing is a grid and it
/// is read as one: whether Pro includes Ekualisasi is only meaningful
/// beside what Starter does, and two round trips can disagree about which
/// plans exist.
/// </summary>
[ApiController]
[Route("api/admin/licensing")]
[Authorize(Roles = "SuperAdmin")]
public class AdminLicensingController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly AuditService _audit;

    public AdminLicensingController(ApplicationDbContext context, AuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    // ── The grid ─────────────────────────────────────────────────────────

    [HttpGet("matrix")]
    public async Task<IActionResult> GetMatrix()
    {
        // Ordered by price in memory, for the same reason the dashboard
        // sums in memory: SQLite stores decimal as TEXT, so ORDER BY on it
        // would sort "1000000" before "90000". EF refuses to translate it
        // rather than sorting wrongly, which is the right call.
        var plans = (await _context.Plans
            .AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Description,
                p.PriceMonthly,
                p.PriceYearly,
                p.MaxUsers,
                p.MaxCompanies,
                p.MaxStorageMB,
                p.MaxJournalEntries,
                p.Modules,
                p.IsActive,
                p.IsPopular,
                p.SortOrder,
                Subscribers = _context.Subscriptions.Count(s =>
                    s.PlanId == p.Id && s.Status == SubscriptionStatus.Active),
            })
            .ToListAsync())
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.PriceMonthly)
            .ToList();

        var features = await _context.PlatformFeatures
            .AsNoTracking()
            .OrderBy(f => f.Module).ThenBy(f => f.SortOrder).ThenBy(f => f.Name)
            .ToListAsync();

        var pairings = await _context.PlanFeatures
            .AsNoTracking()
            .Select(pf => new { pf.PlanId, pf.FeatureKey, pf.Included, pf.Quota })
            .ToListAsync();

        var addOnCounts = await _context.SubscriptionAddOns
            .AsNoTracking()
            .Where(a => a.IsActive)
            .GroupBy(a => a.FeatureKey)
            .Select(g => new { FeatureKey = g.Key, Count = g.Count() })
            .ToListAsync();

        var counts = addOnCounts.ToDictionary(a => a.FeatureKey, a => a.Count);

        return Ok(new
        {
            plans,
            features = features.Select(f => new
            {
                f.Key,
                f.Name,
                f.Description,
                f.Module,
                f.PriceMonthly,
                f.PriceYearly,
                f.IsAddOn,
                f.IsActive,
                f.SortOrder,
                // Whether this key names a module door rather than something
                // inside one. The screen groups differently for the two.
                IsModuleDoor = f.Key.StartsWith(ModuleEntitlementService.ModuleFeaturePrefix),
                PurchasedBy = counts.TryGetValue(f.Key, out var c) ? c : 0,
            }),
            pairings,
            modules = ModuleEntitlementService.AllModules,
            unbuiltModules = ModuleEntitlementService.UnbuiltModules,
            coreModule = ModuleEntitlementService.CoreModule,
        });
    }

    // ── Features ─────────────────────────────────────────────────────────

    public record FeatureRequest(
        string Key,
        string Name,
        string? Description,
        string? Module,
        decimal PriceMonthly,
        decimal PriceYearly,
        bool IsAddOn,
        bool IsActive,
        int SortOrder);

    [HttpPost("features")]
    public async Task<IActionResult> CreateFeature([FromBody] FeatureRequest request)
    {
        var key = (request.Key ?? string.Empty).Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(key))
            return BadRequest(new { error = "A key is required." });

        if (key.Any(c => !char.IsLetterOrDigit(c) && c != '.' && c != '-' && c != '_'))
            return BadRequest(new { error = "A key may contain letters, digits, dots, hyphens and underscores only." });

        if (await _context.PlatformFeatures.AnyAsync(f => f.Key == key))
            return Conflict(new { error = $"The feature \"{key}\" already exists." });

        var feature = new PlatformFeature
        {
            Key = key,
            Name = request.Name?.Trim() ?? key,
            Description = request.Description,
            Module = string.IsNullOrWhiteSpace(request.Module) ? "platform" : request.Module,
            PriceMonthly = request.PriceMonthly,
            PriceYearly = request.PriceYearly,
            IsAddOn = request.IsAddOn,
            IsActive = request.IsActive,
            SortOrder = request.SortOrder,
        };

        _context.PlatformFeatures.Add(feature);
        await _context.SaveChangesAsync();
        await Audit("FEATURE_CREATED", key, feature.Name);

        return Ok(feature);
    }

    [HttpPut("features/{key}")]
    public async Task<IActionResult> UpdateFeature(string key, [FromBody] FeatureRequest request)
    {
        var feature = await _context.PlatformFeatures.FindAsync(key);
        if (feature is null) return NotFound();

        // The key is the contract. Renaming it would silently revoke access
        // for every company that bought this, because the entitlement check
        // tests the old string.
        feature.Name = request.Name?.Trim() ?? feature.Name;
        feature.Description = request.Description;
        feature.Module = string.IsNullOrWhiteSpace(request.Module) ? feature.Module : request.Module;
        feature.PriceMonthly = request.PriceMonthly;
        feature.PriceYearly = request.PriceYearly;
        feature.IsAddOn = request.IsAddOn;
        feature.IsActive = request.IsActive;
        feature.SortOrder = request.SortOrder;
        feature.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await Audit("FEATURE_UPDATED", key, feature.Name);

        return Ok(feature);
    }

    [HttpDelete("features/{key}")]
    public async Task<IActionResult> RetireFeature(string key)
    {
        var feature = await _context.PlatformFeatures.FindAsync(key);
        if (feature is null) return NotFound();

        var sold = await _context.SubscriptionAddOns.AnyAsync(a => a.FeatureKey == key);

        // Retired, not deleted, once anyone has bought it. Removing the row
        // would strip the meaning from their purchase record and from every
        // historical pairing.
        if (sold)
        {
            feature.IsActive = false;
            feature.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await Audit("FEATURE_RETIRED", key, "Deactivated; purchases exist.");

            return Ok(new
            {
                message = "This feature has been sold, so it was deactivated rather than deleted.",
                retired = true,
            });
        }

        _context.PlatformFeatures.Remove(feature);
        await _context.SaveChangesAsync();
        await Audit("FEATURE_DELETED", key, feature.Name);

        return Ok(new { message = "Feature deleted.", retired = false });
    }

    // ── Which plans include what ─────────────────────────────────────────

    public record PairingRequest(Guid PlanId, string FeatureKey, bool Included, int? Quota);

    [HttpPut("pairings")]
    public async Task<IActionResult> SetPairing([FromBody] PairingRequest request)
    {
        if (!await _context.Plans.AnyAsync(p => p.Id == request.PlanId))
            return NotFound(new { error = "No such plan." });

        if (!await _context.PlatformFeatures.AnyAsync(f => f.Key == request.FeatureKey))
            return NotFound(new { error = "No such feature." });

        var pairing = await _context.PlanFeatures
            .FirstOrDefaultAsync(pf => pf.PlanId == request.PlanId && pf.FeatureKey == request.FeatureKey);

        if (pairing is null)
        {
            pairing = new PlanFeature
            {
                PlanId = request.PlanId,
                FeatureKey = request.FeatureKey,
            };
            _context.PlanFeatures.Add(pairing);
        }

        pairing.Included = request.Included;
        pairing.Quota = request.Quota;

        await _context.SaveChangesAsync();
        await Audit("PLAN_FEATURE_SET", $"{request.PlanId}/{request.FeatureKey}",
            request.Included ? "Included" : "Excluded");

        return Ok(pairing);
    }

    // ── What a company bought on top of its plan ─────────────────────────

    [HttpGet("add-ons")]
    public async Task<IActionResult> ListAddOns([FromQuery] Guid? companyId)
    {
        var query = _context.SubscriptionAddOns.AsNoTracking().AsQueryable();

        if (companyId is not null)
        {
            var subscriptionIds = await _context.Subscriptions
                .Where(s => s.CompanyId == companyId)
                .Select(s => s.Id)
                .ToListAsync();

            query = query.Where(a => subscriptionIds.Contains(a.SubscriptionId));
        }

        var addOns = await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(500)
            .Select(a => new
            {
                a.Id,
                a.SubscriptionId,
                a.FeatureKey,
                FeatureName = _context.PlatformFeatures
                    .Where(f => f.Key == a.FeatureKey).Select(f => f.Name).FirstOrDefault(),
                CompanyName = _context.Subscriptions
                    .Where(s => s.Id == a.SubscriptionId)
                    .Select(s => s.Company!.Name).FirstOrDefault(),
                a.PricePaid,
                a.BillingCycle,
                a.StartsAt,
                a.EndsAt,
                a.IsActive,
                a.Note,
            })
            .ToListAsync();

        return Ok(addOns);
    }

    public record GrantAddOnRequest(
        Guid SubscriptionId,
        string FeatureKey,
        decimal? PricePaid,
        string? BillingCycle,
        DateTime? EndsAt,
        string? Note);

    [HttpPost("add-ons")]
    public async Task<IActionResult> GrantAddOn([FromBody] GrantAddOnRequest request)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.Company)
            .FirstOrDefaultAsync(s => s.Id == request.SubscriptionId);

        if (subscription is null) return NotFound(new { error = "No such subscription." });

        var feature = await _context.PlatformFeatures.FindAsync(request.FeatureKey);
        if (feature is null) return NotFound(new { error = "No such feature." });

        if (!feature.IsActive)
            return BadRequest(new { error = "That feature has been retired and cannot be sold." });

        var existing = await _context.SubscriptionAddOns
            .FirstOrDefaultAsync(a => a.SubscriptionId == request.SubscriptionId
                                   && a.FeatureKey == request.FeatureKey
                                   && a.IsActive);

        if (existing is not null)
            return Conflict(new { error = "This subscription already holds that add-on." });

        var cycle = string.IsNullOrWhiteSpace(request.BillingCycle) ? "Monthly" : request.BillingCycle;

        var addOn = new SubscriptionAddOn
        {
            SubscriptionId = request.SubscriptionId,
            FeatureKey = request.FeatureKey,
            // The list price is a default, not a rule: a negotiated price is
            // the ordinary case in B2B, and it has to survive a later change
            // to the catalogue.
            PricePaid = request.PricePaid
                     ?? (cycle == "Yearly" ? feature.PriceYearly : feature.PriceMonthly),
            BillingCycle = cycle,
            EndsAt = request.EndsAt,
            Note = request.Note,
        };

        _context.SubscriptionAddOns.Add(addOn);
        await _context.SaveChangesAsync();
        await Audit("ADDON_GRANTED", request.FeatureKey,
            $"{subscription.Company?.Name} at {addOn.PricePaid:N0} ({cycle}).");

        return Ok(addOn);
    }

    [HttpDelete("add-ons/{id}")]
    public async Task<IActionResult> RevokeAddOn(Guid id)
    {
        var addOn = await _context.SubscriptionAddOns.FindAsync(id);
        if (addOn is null) return NotFound();

        // Ended, not deleted. What a company was entitled to last quarter is
        // part of the billing record.
        addOn.IsActive = false;
        addOn.EndsAt ??= DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await Audit("ADDON_REVOKED", addOn.FeatureKey, $"Subscription {addOn.SubscriptionId}.");

        return Ok(new { message = "Add-on ended." });
    }

    // ── Headroom ─────────────────────────────────────────────────────────

    /// <summary>
    /// What one company is allowed and what it has spent.
    ///
    /// Worth having on its own screen because the limits only started being
    /// enforced with this work. A tenant who has been on the free plan for
    /// months may already be past a ceiling that was never applied, and the
    /// answer to that is a conversation, not a wall that appears on their
    /// next journal.
    /// </summary>
    [HttpGet("usage/{companyId}")]
    public async Task<IActionResult> GetUsage(
        Guid companyId,
        [FromServices] PlanLimitService limits,
        CancellationToken ct)
    {
        var company = await _context.Companies.IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.Id == companyId)
            .Select(c => new { c.Id, c.Name })
            .FirstOrDefaultAsync(ct);

        if (company is null) return NotFound();

        var usage = await limits.GetUsageAsync(companyId, ct);

        return Ok(new { company, usage });
    }

    /// <summary>
    /// Every company that is at or past a ceiling, so the free tier can be
    /// priced against what people actually do rather than against a guess.
    /// </summary>
    [HttpGet("usage")]
    public async Task<IActionResult> GetAllUsage(
        [FromServices] PlanLimitService limits,
        CancellationToken ct)
    {
        var window = await limits.GetWindowAsync(ct);
        var from = PlanLimitService.WindowStart(window, DateTime.UtcNow);

        var rows = await _context.Companies
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.IsSuspended,
                Plan = _context.Subscriptions
                    .Where(s => s.CompanyId == c.Id && s.Status == SubscriptionStatus.Active)
                    .OrderByDescending(s => s.StartDate)
                    .Select(s => new { s.Plan!.Name, s.Plan.MaxJournalEntries, s.Plan.MaxUsers })
                    .FirstOrDefault(),
                JournalEntries = _context.JournalEntries
                    .IgnoreQueryFilters()
                    .Count(j => j.CompanyId == c.Id && (from == null || j.CreatedAt >= from)),
                Users = _context.UserCompanies.Count(uc => uc.CompanyId == c.Id),
            })
            .ToListAsync(ct);

        return Ok(new
        {
            window,
            windowStart = from,
            rows = rows.OrderByDescending(r => r.JournalEntries),
        });
    }

    // ── Seeding the catalogue ────────────────────────────────────────────

    /// <summary>
    /// Fills an empty catalogue with the doors and the metered capabilities
    /// that exist today, so the grid opens on something real. Never
    /// overwrites a row: pricing somebody set is not ours to reset.
    /// </summary>
    [HttpPost("features/seed")]
    public async Task<IActionResult> SeedCatalogue()
    {
        var seeds = new List<PlatformFeature>
        {
            new() { Key = "module.tax",         Name = "Tax module",        Module = "tax",         SortOrder = 10, Description = "SPT Masa PPN, withholding, ekualisasi, rekonsiliasi fiskal and the debt to equity test." },
            new() { Key = "module.inventory",   Name = "Inventory module",  Module = "inventory",   SortOrder = 20, Description = "Items, stock opname, adjustments and the COGS they post." },
            new() { Key = "module.fixedAssets", Name = "Assets module",     Module = "fixedAssets", SortOrder = 30, Description = "Asset register, depreciation, amortisation, disposal and revaluation." },
            new() { Key = "module.payroll",     Name = "Payroll module",    Module = "payroll",     SortOrder = 35, Description = "Compensation, monthly runs, PPh 21 TER and BPJS, posted as salary expense." },

            new() { Key = "tax.equalisation",    Name = "Ekualisasi",              Module = "tax", SortOrder = 40, Description = "PPN Keluaran against sales and PPN Masukan against purchases." },
            new() { Key = "tax.reconciliation",  Name = "Rekonsiliasi fiskal",     Module = "tax", SortOrder = 41, Description = "Commercial profit reconciled to fiscal profit." },
            new() { Key = "tax.debtToEquity",    Name = "Debt to equity",          Module = "tax", SortOrder = 42, Description = "The 4:1 test under PMK-169, on average balances." },

            new() { Key = "accounting.bankReconciliation", Name = "Bank reconciliation", Module = "accounting", SortOrder = 50 },
            new() { Key = "accounting.budgets",            Name = "Budgets and RKAP",    Module = "accounting", SortOrder = 51 },
            new() { Key = "accounting.approvals",          Name = "Approval workflow",   Module = "accounting", SortOrder = 52 },
            new() { Key = "accounting.recurring",          Name = "Recurring entries",   Module = "accounting", SortOrder = 53 },

            new() { Key = "platform.multiCompany", Name = "Multiple companies", Module = "platform", SortOrder = 60 },
            new() { Key = "platform.api",          Name = "API access",         Module = "platform", SortOrder = 61 },
            new() { Key = "platform.auditLog",     Name = "Audit log access",   Module = "platform", SortOrder = 62 },
        };

        var existing = await _context.PlatformFeatures.Select(f => f.Key).ToListAsync();
        var added = 0;

        foreach (var seed in seeds.Where(s => !existing.Contains(s.Key)))
        {
            _context.PlatformFeatures.Add(seed);
            added++;
        }

        await _context.SaveChangesAsync();
        await Audit("FEATURE_CATALOGUE_SEEDED", "PlatformFeatures", $"{added} added.");

        return Ok(new
        {
            added,
            message = added == 0
                ? "The catalogue already covers everything in the seed set."
                : $"{added} feature(s) added. Pricing and plan inclusion are yours to set.",
        });
    }

    private Task Audit(string action, string target, string details) =>
        _audit.LogAsync(
            CurrentUserId(), action, target, details,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"].ToString());

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirst("UserId")?.Value
               ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
