using System.Text.Json.Serialization;

namespace BalanceIO.API.DTOs;

/// <summary>
/// The Tax module dashboard.
///
/// Everything here is a record of what was entered, reconciled and left
/// open. Nothing here decides how a transaction should be taxed - that is
/// professional judgement, and a product that guessed at it would be
/// handing its users a liability dressed as a feature.
///
/// The verbs this module is allowed: track, record, reconcile, organise,
/// export. Not: determine, decide, file.
/// </summary>
public class TaxOverviewResponse
{
    public Guid CompanyId { get; set; }
    public string Currency { get; set; } = "IDR";
    public DateTime GeneratedAt { get; set; }

    /// <summary>The hub's own card for this module, unedited.</summary>
    public ModuleHealth Module { get; set; } = new();

    /// <summary>The month being accumulated now.</summary>
    public VatPeriod Period { get; set; } = new();

    public FilingDeadline Filing { get; set; } = new();

    public List<OutstandingItem> Outstanding { get; set; } = new();

    /// <summary>Six months including the current one, newest first.</summary>
    public List<VatPeriod> History { get; set; } = new();

    public TaxCoverage Coverage { get; set; } = new();
}

/// <summary>
/// PPN keluaran against PPN masukan for one month.
///
/// Draft and Void documents are excluded from both sides. A draft invoice
/// has not been issued, so its PPN is not yet output tax.
/// </summary>
public class VatPeriod
{
    /// <summary>"August 2026".</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>ISO date of the first day of the month.</summary>
    public string Start { get; set; } = string.Empty;

    /// <summary>ISO date of the last day of the month.</summary>
    public string End { get; set; } = string.Empty;

    public decimal OutputTax { get; set; }
    public decimal InputTax { get; set; }

    /// <summary>Output minus input. Positive is kurang bayar.</summary>
    public decimal Net { get; set; }

    public int OutputDocuments { get; set; }
    public int InputDocuments { get; set; }
}

/// <summary>
/// When the SPT Masa PPN for the previous month is due.
///
/// The product does not record whether a return was actually filed, and
/// <see cref="StatusRecorded"/> says so out loud rather than letting the
/// UI imply otherwise. Inferring "overdue" from a calendar date alone would
/// put a permanent red flag on every company that files on time.
/// </summary>
public class FilingDeadline
{
    /// <summary>"July 2026" - the month being reported.</summary>
    public string Period { get; set; } = string.Empty;

    /// <summary>ISO date. End of the month following the period.</summary>
    public string Deadline { get; set; } = string.Empty;

    /// <summary>Negative once the deadline has passed.</summary>
    public int DaysRemaining { get; set; }

    /// <summary>Always false. BalanceIO tracks the deadline, not the filing.</summary>
    public bool StatusRecorded { get; set; }
}

/// <summary>
/// What is missing before this period's PPN could be reported anywhere.
/// Gaps in the record, not opinions about the tax.
/// </summary>
public class TaxCoverage
{
    /// <summary>The company NPWP, or null when none is recorded.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? CompanyTaxId { get; set; }

    /// <summary>
    /// Counterparties carrying PPN on an issued document this period with no
    /// NPWP recorded against them.
    /// </summary>
    public int CounterpartiesWithoutTaxId { get; set; }

    /// <summary>Taxed sales invoices still sitting in Draft this period.</summary>
    public int DraftTaxedInvoices { get; set; }

    /// <summary>Taxed purchase bills still sitting in Draft this period.</summary>
    public int DraftTaxedBills { get; set; }
}
