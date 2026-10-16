using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// The hub: a list of doors, and nothing else.
///
/// Deliberately thin. The hub is not a dashboard - it does not carry
/// figures, balances or status, because a door that also reports is two
/// screens fighting over one page. The figures live one floor down, inside
/// whichever module you walked into.
/// </summary>
public class ModuleDoorsResponse
{
    public Guid CompanyId { get; set; }
    public DateTime GeneratedAt { get; set; }

    /// <summary>The live plan's name, or null when there is no subscription.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? PlanName { get; set; }

    public List<ModuleDoor> Doors { get; set; } = new();
}

public class ModuleDoor
{
    /// <summary>accounting | tax | inventory | fixedAssets | payroll.</summary>
    public string Key { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>One line. What is behind the door, not how it is going.</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// What is inside, named. Still "what is behind the door" rather than
    /// "how it is going" - a card with nothing under its description reads
    /// as unfinished, and the honest way to fill it is to say what the
    /// module contains, not to smuggle figures onto the hub.
    /// </summary>
    public List<string> Contents { get; set; } = new();

    /// <summary>
    /// True for the one door that is the product rather than an addition to
    /// it. The hub gives it more weight; nothing else depends on this.
    /// </summary>
    public bool Primary { get; set; }

    /// <summary>False when the module has no implementation behind it.</summary>
    public bool Implemented { get; set; } = true;

    /// <summary>
    /// Whether this company's plan opens the door. Decided on the server;
    /// the matching module endpoint refuses independently, so the lock is
    /// not merely drawn.
    /// </summary>
    public bool Entitled { get; set; }

    /// <summary>Where the door leads. Null when it does not open.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Href { get; set; }

    /// <summary>Why it does not open, when it does not.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LockedReason { get; set; }
}
