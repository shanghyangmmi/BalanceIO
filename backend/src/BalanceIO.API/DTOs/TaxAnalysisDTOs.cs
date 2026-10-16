using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

// ── Rekonsiliasi fiskal ───────────────────────────────────────────────

/// <summary>
/// Commercial profit reconciled to fiscal profit.
///
/// The arithmetic is the product's job; the classification is not. Which
/// costs are non-deductible turns on documentation and circumstance —
/// entertainment without a nominatif list, natura, tax penalties, a
/// donation to the wrong recipient — and a product that assumed would hand
/// its user a correction they never made. So corrections come from what
/// the accountant marked on each account, and an unclassified chart
/// reconciles to itself, loudly.
/// </summary>
public class FiscalReconciliationResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    public int Year { get; set; }
    public List<int> AvailableYears { get; set; } = new();

    public decimal Revenue { get; set; }
    public decimal Expenses { get; set; }

    /// <summary>Revenue less expenses, straight from the ledger.</summary>
    public decimal CommercialProfit { get; set; }

    /// <summary>Non-deductible costs added back.</summary>
    public decimal PositiveCorrections { get; set; }

    /// <summary>Income taken out — already taxed finally, or not taxable.</summary>
    public decimal NegativeCorrections { get; set; }

    /// <summary>Commercial profit plus positive less negative corrections.</summary>
    public decimal FiscalProfit { get; set; }

    public List<FiscalCorrectionLine> Corrections { get; set; } = new();

    /// <summary>How many accounts carry a classification at all.</summary>
    public int ClassifiedAccounts { get; set; }

    /// <summary>Accounts in the profit and loss that could carry one.</summary>
    public int ClassifiableAccounts { get; set; }
}

public class FiscalCorrectionLine
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    /// <summary>"positive" or "negative".</summary>
    public string Direction { get; set; } = string.Empty;

    public decimal Amount { get; set; }
}

// ── Debt to equity ────────────────────────────────────────────────────

/// <summary>
/// Debt to equity under PMK-169/PMK.010/2015, which caps the ratio at 4:1
/// for interest deductibility.
///
/// Two things this gets right that a naive version would not. The ratio is
/// built from average balances across the year, not the closing position —
/// a loan repaid in December would otherwise vanish. And debt means
/// interest-bearing borrowings, not every liability; trade payables and
/// tax payable are not debt, and counting them would disallow interest
/// that is perfectly deductible.
/// </summary>
public class DebtToEquityResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    public int Year { get; set; }
    public List<int> AvailableYears { get; set; } = new();

    /// <summary>The cap in PMK-169. Four to one.</summary>
    public decimal MaximumRatio { get; set; } = 4m;

    public decimal AverageDebt { get; set; }
    public decimal AverageEquity { get; set; }

    /// <summary>Null when average equity is zero or negative — see Note.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Ratio { get; set; }

    public bool WithinLimit { get; set; }

    /// <summary>Interest expense recorded for the year.</summary>
    public decimal InterestExpense { get; set; }

    /// <summary>
    /// The share of interest that falls outside the 4:1 cap. Zero when the
    /// ratio is within the limit.
    /// </summary>
    public decimal DisallowedInterest { get; set; }

    /// <summary>Month-end averages the ratio was built from.</summary>
    public List<DebtEquityMonth> Months { get; set; } = new();

    /// <summary>Accounts counted as interest-bearing debt.</summary>
    public List<string> DebtAccounts { get; set; } = new();

    /// <summary>Accounts counted as interest expense.</summary>
    public List<string> InterestAccounts { get; set; } = new();

    /// <summary>
    /// What the reader needs to know before trusting the number: no debt
    /// classified, negative equity, no interest recorded.
    /// </summary>
    public List<string> Notes { get; set; } = new();
}

public class DebtEquityMonth
{
    public int Month { get; set; }
    public string Label { get; set; } = string.Empty;

    /// <summary>Closing balance at month end.</summary>
    public decimal Debt { get; set; }
    public decimal Equity { get; set; }
}
