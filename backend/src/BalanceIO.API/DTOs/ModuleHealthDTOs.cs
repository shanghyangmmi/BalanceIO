using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// Every module answers the same question - is this in balance? - so every
/// module returns the same shape. The hub can render a card without knowing
/// anything about the module behind it.
/// </summary>
public class ModuleHealthResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";

    /// <summary>UTC. The figures are a snapshot, not a live feed.</summary>
    public DateTime GeneratedAt { get; set; }

    /// <summary>
    /// The worst status among the active modules. Inactive modules are
    /// excluded - a module that was never built is not a problem with the
    /// books.
    /// </summary>
    public string Overall { get; set; } = ModuleHealthStatus.Balanced;

    public List<ModuleHealth> Modules { get; set; } = new();
}

public class ModuleHealth
{
    /// <summary>Stable identifier: accounting, tax, inventory, fixedAssets, payroll.</summary>
    public string Key { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    /// <summary>One of <see cref="ModuleHealthStatus"/>.</summary>
    public string Status { get; set; } = ModuleHealthStatus.Balanced;

    /// <summary>
    /// False when the module has no implementation behind it. The hub uses
    /// this to disable the card rather than inferring it from the status,
    /// because "inactive" also means "built but unused".
    /// </summary>
    public bool Implemented { get; set; } = true;

    /// <summary>Where the card navigates to. Null when not implemented.</summary>
    public string? Href { get; set; }

    /// <summary>The single sentence that justifies the status.</summary>
    public string Headline { get; set; } = string.Empty;

    /// <summary>Optional second line with the supporting fact.</summary>
    public string? Detail { get; set; }

    /// <summary>Never more than two. A card that needs three is a report.</summary>
    public List<ModuleFigure> Figures { get; set; } = new();
}

public class ModuleFigure
{
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Always decimal. Counts arrive as whole decimals rather than a second
    /// numeric field, so the frontend has one code path for every figure.
    /// </summary>
    public decimal Value { get; set; }

    /// <summary>money | count | days | date</summary>
    public string Format { get; set; } = ModuleFigureFormat.Count;

    /// <summary>Set for money figures only.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Currency { get; set; }

    /// <summary>ISO date, for figures whose format is <c>date</c>.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? IsoDate { get; set; }
}

/// <summary>
/// Four states, in ascending severity. These are the UI's colour vocabulary:
/// emerald, amber, red, muted.
/// </summary>
public static class ModuleHealthStatus
{
    public const string Balanced = "balanced";
    public const string Attention = "attention";
    public const string Overdue   = "overdue";
    public const string Inactive  = "inactive";

    /// <summary>
    /// Severity ranking used to roll the modules up into <see
    /// cref="ModuleHealthResponse.Overall"/>. Inactive sits below balanced:
    /// an unbuilt module never drags the headline down.
    /// </summary>
    public static int Rank(string status) => status switch
    {
        Overdue   => 3,
        Attention => 2,
        Balanced  => 1,
        _         => 0,
    };

    public static string Worst(IEnumerable<string> statuses)
    {
        var worst = Balanced;
        foreach (var s in statuses)
        {
            if (Rank(s) > Rank(worst)) worst = s;
        }
        return worst;
    }
}

/// <summary>
/// One piece of outstanding work. Deliberately shaped like an instruction
/// rather than a metric: a module page that lists numbers leaves the reader
/// to work out what to do about them.
/// </summary>
public class OutstandingItem
{
    public string Key { get; set; } = string.Empty;

    /// <summary>One of <see cref="ModuleHealthStatus"/> - the same colour vocabulary.</summary>
    public string Severity { get; set; } = ModuleHealthStatus.Attention;

    public string Title { get; set; } = string.Empty;

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Detail { get; set; }

    /// <summary>Null when the item is a state rather than a quantity.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? Count { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Href { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ActionLabel { get; set; }
}

public static class ModuleFigureFormat
{
    public const string Money = "money";
    public const string Count = "count";
    public const string Days  = "days";
    public const string Date  = "date";
}
