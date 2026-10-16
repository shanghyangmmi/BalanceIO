namespace BalanceIO.API.DTOs;

/// <summary>
/// Ekualisasi PPN — the revenue in the ledger set against the DPP reported
/// on faktur pajak, month by month.
///
/// This is the check a pemeriksa runs first: total peredaran usaha in the
/// financial statements against the sum of the DPP across twelve SPT Masa
/// PPN. A gap is not automatically an error — non-taxable revenue, revenue
/// booked by journal without an invoice, and timing between the invoice
/// date and the posting date all produce legitimate differences — but an
/// unexplained gap is where an assessment starts.
///
/// The product reconciles and shows the gap. It does not decide whether a
/// difference is acceptable, and it does not file anything.
/// </summary>
public class TaxEqualisationResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    public int Year { get; set; }

    /// <summary>Years that carry either revenue or an invoice, newest first.</summary>
    public List<int> AvailableYears { get; set; } = new();

    /// <summary>January to December, always twelve rows.</summary>
    public List<EqualisationRow> Months { get; set; } = new();

    public EqualisationTotals Totals { get; set; } = new();

    /// <summary>
    /// The revenue accounts this reconciliation reads. Named so the reader
    /// can check the basis rather than trust it.
    /// </summary>
    public List<string> RevenueAccounts { get; set; } = new();
}

public class EqualisationRow
{
    /// <summary>1-12.</summary>
    public int Month { get; set; }

    /// <summary>"January".</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>
    /// Revenue recognised in the ledger: credits less debits on the revenue
    /// accounts, from posted entries dated in this month.
    /// </summary>
    public decimal LedgerRevenue { get; set; }

    /// <summary>
    /// Dasar Pengenaan Pajak on issued sales invoices dated in this month:
    /// the invoice total less its PPN. Draft and Void are excluded.
    /// </summary>
    public decimal InvoiceDpp { get; set; }

    /// <summary>PPN Keluaran on the same invoices.</summary>
    public decimal OutputTax { get; set; }

    /// <summary>Ledger revenue less invoice DPP. Zero is the clean case.</summary>
    public decimal Difference { get; set; }

    public int InvoiceCount { get; set; }
}

public class EqualisationTotals
{
    public decimal LedgerRevenue { get; set; }
    public decimal InvoiceDpp { get; set; }
    public decimal OutputTax { get; set; }
    public decimal Difference { get; set; }
    public int InvoiceCount { get; set; }

    /// <summary>Months whose difference is not exactly zero.</summary>
    public int MonthsWithDifference { get; set; }
}
