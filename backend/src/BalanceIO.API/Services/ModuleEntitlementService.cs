using System.Text.Json;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Which module doors a company's plan opens.
///
/// The hub is a list of doors and each door beyond the first is something
/// to buy, so this has to be decided on the server. A lock drawn only in
/// the UI is not a paywall; it is a suggestion, and the endpoint behind it
/// still answers to anyone who types the URL.
///
/// Two rules that are deliberate rather than incidental:
///
///   Accounting is never locked. It is the product. A subscription that
///   withheld it would be accounting software you cannot keep books in,
///   and every other module posts into it anyway.
///
///   An unconfigured plan resolves to the core set, not to everything.
///   Reading null as "all modules" would mean any plan someone forgot to
///   price hands over the whole product.
///
/// Entitlement now arrives from three places, and they are additive:
/// the plan's own module list, the features the plan includes, and the
/// features the company bought separately. A door opens if any of them
/// opens it - which is what "dia mau akses pintu lain? bayar tambahannya"
/// has to mean in code. A feature keyed "module.tax" is the door itself;
/// every other key is a capability inside a door.
/// </summary>
public class ModuleEntitlementService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ModuleEntitlementService> _logger;

    public ModuleEntitlementService(
        ApplicationDbContext context,
        ILogger<ModuleEntitlementService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>The door that is always open.</summary>
    public const string CoreModule = "accounting";

    /// <summary>
    /// Catalogue keys under this prefix name a module door rather than a
    /// capability, so that a door can be priced and sold through the same
    /// catalogue as everything else instead of a second parallel one.
    /// </summary>
    public const string ModuleFeaturePrefix = "module.";

    /// <summary>Every door the hub knows about, in the order it shows them.</summary>
    public static readonly string[] AllModules =
        { "accounting", "tax", "inventory", "fixedAssets", "payroll" };

    /// <summary>
    /// Modules with no implementation behind them. Never entitled, whatever
    /// a plan claims - selling a door that opens onto nothing is worse than
    /// not listing it. Empty while every listed module is built.
    /// </summary>
    public static readonly string[] UnbuiltModules = Array.Empty<string>();

    public async Task<ModuleEntitlement> GetAsync(Guid companyId)
    {
        var subscription = await _context.Subscriptions
            .AsNoTracking()
            .Where(s => s.CompanyId == companyId && s.Status == SubscriptionStatus.Active)
            .OrderByDescending(s => s.StartDate)
            .Select(s => new
            {
                SubscriptionId = s.Id,
                s.PlanId,
                s.EndDate,
                PlanName = s.Plan!.Name,
                s.Plan.Modules,
            })
            .FirstOrDefaultAsync();

        // An expired subscription is not an active one. Checked here rather
        // than trusting Status alone, because nothing in this codebase sweeps
        // subscriptions to Expired on a schedule.
        var live = subscription is not null && subscription.EndDate >= DateTime.UtcNow;

        var granted  = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { CoreModule };
        var features = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (live)
        {
            foreach (var key in Parse(subscription!.Modules))
            {
                granted.Add(key);
            }

            // What the tier includes.
            var planFeatures = await _context.PlanFeatures
                .AsNoTracking()
                .Where(pf => pf.PlanId == subscription.PlanId && pf.Included)
                .Select(pf => pf.FeatureKey)
                .ToListAsync();

            // What was bought on top of it. An add-on outlives nothing: it
            // ends when it says it ends, or with the subscription.
            var now = DateTime.UtcNow;
            var addOns = await _context.SubscriptionAddOns
                .AsNoTracking()
                .Where(a => a.SubscriptionId == subscription.SubscriptionId
                         && a.IsActive
                         && a.StartsAt <= now
                         && (a.EndsAt == null || a.EndsAt >= now))
                .Select(a => a.FeatureKey)
                .ToListAsync();

            foreach (var key in planFeatures.Concat(addOns))
            {
                features.Add(key);

                // A feature key of the form "module.tax" is the door, not
                // something behind it.
                if (key.StartsWith(ModuleFeaturePrefix, StringComparison.OrdinalIgnoreCase))
                {
                    granted.Add(key[ModuleFeaturePrefix.Length..]);
                }
            }
        }

        foreach (var unbuilt in UnbuiltModules)
        {
            granted.Remove(unbuilt);
        }

        return new ModuleEntitlement
        {
            PlanName = live ? subscription!.PlanName : null,
            Granted  = granted,
            Features = features,
        };
    }

    /// <summary>
    /// Whether one named capability is available to this company.
    ///
    /// Unlike a module door, an unlisted feature is permitted. Most of the
    /// product is not metered, and a check that defaulted to "no" would
    /// switch off every screen the moment the catalogue was introduced -
    /// including for the customers already paying for them. Only features
    /// that exist in the catalogue and are marked active are gated.
    /// </summary>
    public async Task<bool> HasFeatureAsync(Guid companyId, string featureKey)
    {
        var known = await _context.PlatformFeatures
            .AsNoTracking()
            .AnyAsync(f => f.Key == featureKey && f.IsActive);

        if (!known) return true;

        var entitlement = await GetAsync(companyId);
        return entitlement.Features.Contains(featureKey);
    }

    public async Task<bool> HasAsync(Guid companyId, string moduleKey)
    {
        var entitlement = await GetAsync(companyId);
        return entitlement.Granted.Contains(moduleKey);
    }

    /// <summary>
    /// A malformed Modules value locks the add-ons rather than opening them.
    /// Failing closed on a billing decision is the only safe direction.
    /// </summary>
    private IEnumerable<string> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return Array.Empty<string>();

        try
        {
            return JsonSerializer.Deserialize<string[]>(json) ?? Array.Empty<string>();
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Plan.Modules is not a JSON array; granting the core module only.");
            return Array.Empty<string>();
        }
    }
}

public class ModuleEntitlement
{
    /// <summary>Null when there is no live subscription.</summary>
    public string? PlanName { get; set; }

    public HashSet<string> Granted { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Catalogue keys this company holds, from the plan and from anything
    /// bought on top of it. Empty is normal: it means nothing is metered
    /// for them, not that everything is switched off.
    /// </summary>
    public HashSet<string> Features { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public bool Has(string moduleKey) => Granted.Contains(moduleKey);
}
