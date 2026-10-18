using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// The Inventory module dashboard.
///
/// Inventory earns a card in the hub because it produces COGS. That is also
/// what makes it dangerous: a book quantity nobody has counted against
/// still posts to the ledger, and the resulting cost of sales looks exactly
/// as authoritative as one that was verified.
/// </summary>
public class StockOverviewResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    /// <summary>The hub's own card for this module, unedited.</summary>
    public ModuleHealth Module { get; set; } = new();

    public StockPosition Position { get; set; } = new();
    public CountingState Counting { get; set; } = new();

    public List<OutstandingItem> Outstanding { get; set; } = new();

    /// <summary>The five most recent stock opnames, newest first.</summary>
    public List<RecentOpname> Recent { get; set; } = new();
}

public class StockPosition
{
    /// <summary>Active products with inventory tracking switched on.</summary>
    public int Tracked { get; set; }

    /// <summary>Tracked items whose book quantity is below zero.</summary>
    public int Negative { get; set; }

    /// <summary>Tracked items at or under their reorder level, where one is set.</summary>
    public int LowStock { get; set; }

    /// <summary>Carrying value of tracked stock at moving-average cost.</summary>
    public decimal StockValue { get; set; }

    /// <summary>
    /// Posted balance of the inventory accounts. It differs from StockValue
    /// by goods received on an order and not yet billed, opening stock
    /// entered without a journal, and anything posted to the account by hand.
    /// </summary>
    public decimal InventoryAccountBalance { get; set; }

    /// <summary>
    /// Tracked items with no inventory account set. Their movements have
    /// nowhere to post.
    /// </summary>
    public int WithoutInventoryAccount { get; set; }
}

public class CountingState
{
    /// <summary>ISO date of the last processed opname, or null.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? LastCountDate { get; set; }

    /// <summary>Days since that count. Null when there has never been one.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? DaysSinceCount { get; set; }

    /// <summary>Opnames still in Draft.</summary>
    public int OpenOpnames { get; set; }

    /// <summary>Draft opname lines with a non-zero difference.</summary>
    public int UnprocessedVariances { get; set; }
}

public class RecentOpname
{
    public Guid Id { get; set; }
    public string Number { get; set; } = string.Empty;

    /// <summary>ISO date.</summary>
    public string Date { get; set; } = string.Empty;

    /// <summary>Draft | Processed | Cancelled.</summary>
    public string Status { get; set; } = string.Empty;

    public int Lines { get; set; }

    /// <summary>Lines on this opname whose difference is not zero.</summary>
    public int Variances { get; set; }
}
