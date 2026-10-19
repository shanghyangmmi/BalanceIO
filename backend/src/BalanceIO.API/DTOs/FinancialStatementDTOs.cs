namespace BalanceIO.API.DTOs;

/// <summary>
/// A set of financial statements with every label in Bahasa Indonesia and
/// English. The Indonesian text is the primary version (UU 24/2009); the
/// English is its translation.
/// </summary>
public class FinancialStatementPack
{
    public string CompanyName { get; set; } = string.Empty;
    public string? CompanyAddress { get; set; }
    public string? CompanyTaxId { get; set; }
    public string Currency { get; set; } = "IDR";

    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }
    public bool Comparative { get; set; }
    public DateOnly? PriorStart { get; set; }
    public DateOnly? PriorEnd { get; set; }

    /// <summary>Column headings, e.g. "2026" and "2025".</summary>
    public string ColumnCurrent { get; set; } = string.Empty;
    public string? ColumnPrior { get; set; }

    /// <summary>True when any figure has a fraction of a rupiah, so the page shows two decimals.</summary>
    public bool HasFractions { get; set; }

    public DateTime GeneratedAt { get; set; }
    public string? GeneratedBy { get; set; }

    public List<FinancialStatement> Statements { get; set; } = new();
}

public class FinancialStatement
{
    /// <summary>sofp | pl | equity | cashflow | tb</summary>
    public string Key { get; set; } = string.Empty;
    public string TitleId { get; set; } = string.Empty;
    public string TitleEn { get; set; } = string.Empty;
    public string BasisId { get; set; } = string.Empty;
    public string BasisEn { get; set; } = string.Empty;
    public List<StatementLine> Lines { get; set; } = new();
    /// <summary>Arithmetic the statement must satisfy. A failed check is printed on the statement.</summary>
    public List<StatementCheck> Checks { get; set; } = new();
}

public class StatementLine
{
    /// <summary>section | heading | item | subtotal | total</summary>
    public string Kind { get; set; } = "item";
    public string LabelId { get; set; } = string.Empty;
    public string LabelEn { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int Indent { get; set; }
    public decimal? Current { get; set; }
    public decimal? Prior { get; set; }
    /// <summary>Trial balance only: the credit column. <see cref="Current"/> holds the debit.</summary>
    public decimal? Credit { get; set; }
}

public class StatementCheck
{
    public string LabelId { get; set; } = string.Empty;
    public string LabelEn { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public decimal Difference { get; set; }
}

/// <summary>Cash and cash equivalent accounts (codes 1-11xx) over a period.</summary>
public class CashPositionResponse
{
    public string Currency { get; set; } = "IDR";
    public DateOnly Start { get; set; }
    public DateOnly End { get; set; }
    public decimal Opening { get; set; }
    public decimal Inflow { get; set; }
    public decimal Outflow { get; set; }
    public decimal Closing { get; set; }
    public List<CashAccountPosition> Accounts { get; set; } = new();
    /// <summary>Closing balance at the end of each week of the period (the last point is the period end).</summary>
    public List<CashBalancePoint> Series { get; set; } = new();
}

public class CashAccountPosition
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string NameId { get; set; } = string.Empty;
    public decimal Opening { get; set; }
    public decimal Inflow { get; set; }
    public decimal Outflow { get; set; }
    public decimal Closing { get; set; }
}

public class CashBalancePoint
{
    public DateOnly Date { get; set; }
    public decimal Balance { get; set; }
}
