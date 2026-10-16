namespace BalanceIO.API.DTOs;

public class LifecyclePhaseResultDto
{
    public int PhaseNumber { get; set; }
    public string PhaseName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status { get; set; } = "Passed"; // "Passed", "Failed", "Warning"
    public long DurationMs { get; set; }
    public List<string> Assertions { get; set; } = new();
    public Dictionary<string, string> Metrics { get; set; } = new();
    public string? ErrorMessage { get; set; }
}

public class BalanceSheetSnapshotDto
{
    public decimal TotalAssets { get; set; }
    public decimal TotalLiabilities { get; set; }
    public decimal TotalEquity { get; set; }
    public decimal Discrepancy { get; set; }
    public bool IsBalanced { get; set; }
}

public class ProfitLossSnapshotDto
{
    public decimal TotalRevenue { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal RealizedFxGain { get; set; }
    public decimal NetIncome { get; set; }
}

public class TaxSnapshotDto
{
    public decimal PpnMasukan { get; set; }
    public decimal PpnKeluaran { get; set; }
    public decimal NetPpnPayable { get; set; }
    public decimal Pph23Withheld { get; set; }
}

public class TrialBalanceSnapshotDto
{
    public decimal TotalDebit { get; set; }
    public decimal TotalCredit { get; set; }
    public decimal Difference { get; set; }
    public bool IsBalanced { get; set; }
}

public class E2ELifecycleValidationResultDto
{
    public string ExecutionId { get; set; } = Guid.NewGuid().ToString();
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
    public string ExecutedBy { get; set; } = string.Empty;
    public long TotalDurationMs { get; set; }
    public int TotalPhases { get; set; } = 12;
    public int PassedPhases { get; set; }
    public int FailedPhases { get; set; }
    public string OverallStatus { get; set; } = "PASSED"; // "PASSED", "FAILED"

    public List<LifecyclePhaseResultDto> Phases { get; set; } = new();

    // Financial Statements & Statutory Snapshots
    public BalanceSheetSnapshotDto BalanceSheet { get; set; } = new();
    public ProfitLossSnapshotDto ProfitLoss { get; set; } = new();
    public TaxSnapshotDto TaxSummary { get; set; } = new();
    public TrialBalanceSnapshotDto TrialBalance { get; set; } = new();
}
