namespace BalanceIO.API.DTOs;

/// <summary>
/// Fiscal depreciation for a tax year beside the commercial charge, per
/// asset and per group, in the shape of SPT Tahunan Badan Lampiran 1A.
/// The correction is what the fiscal reconciliation adds back (positive) or
/// takes off (negative).
/// </summary>
public class FiscalDepreciationResponse
{
    public int Year { get; set; }
    public string Currency { get; set; } = "IDR";
    public List<FiscalDepreciationRow> Rows { get; set; } = new();
    public List<FiscalDepreciationGroup> Groups { get; set; } = new();

    public decimal FiscalCharge { get; set; }
    public decimal CommercialCharge { get; set; }

    /// <summary>Commercial less fiscal: depreciation and book value written off on disposal.</summary>
    public decimal Correction { get; set; }

    /// <summary>Assets in use during the year that have no fiscal group, and are left out.</summary>
    public int Unclassified { get; set; }
}

public class FiscalDepreciationRow
{
    public Guid AssetId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string GroupLabel { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public int? LifeYears { get; set; }
    public DateOnly AcquisitionDate { get; set; }
    public decimal Cost { get; set; }

    public decimal FiscalOpening { get; set; }
    public decimal FiscalCharge { get; set; }
    public decimal FiscalClosing { get; set; }
    public decimal CommercialCharge { get; set; }

    public DateOnly? DisposalDate { get; set; }
    public decimal? Proceeds { get; set; }
    public decimal? FiscalGainLoss { get; set; }
    public decimal? CommercialGainLoss { get; set; }

    public decimal Correction { get; set; }
}

public class FiscalDepreciationGroup
{
    public string Group { get; set; } = string.Empty;
    public string GroupLabel { get; set; } = string.Empty;
    public int Assets { get; set; }
    public decimal Cost { get; set; }
    public decimal FiscalCharge { get; set; }
    public decimal FiscalClosing { get; set; }
    public decimal CommercialCharge { get; set; }
    public decimal Correction { get; set; }
}
