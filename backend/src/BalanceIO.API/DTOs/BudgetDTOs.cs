using BalanceIO.API.Models;

namespace BalanceIO.API.DTOs;

public class BudgetLineInputDto
{
    public Guid? Id { get; set; }
    public Guid AccountId { get; set; }
    public int Month { get; set; } = 1;
    public int? Quarter { get; set; }
    public decimal Amount { get; set; }
    public decimal WarningThresholdPercentage { get; set; } = 80.00m;
    public decimal CriticalThresholdPercentage { get; set; } = 100.00m;
    public string? Notes { get; set; }
}

public class CreateBudgetDto
{
    public string Name { get; set; } = string.Empty;
    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;
    public BudgetPeriodType PeriodType { get; set; } = BudgetPeriodType.Monthly;
    public Guid? ProjectId { get; set; }
    public string? Notes { get; set; }
    public List<BudgetLineInputDto> Lines { get; set; } = new();
}

public class UpdateBudgetDto
{
    public string Name { get; set; } = string.Empty;
    public int FiscalYear { get; set; }
    public BudgetPeriodType PeriodType { get; set; }
    public Guid? ProjectId { get; set; }
    public string? Notes { get; set; }
    public List<BudgetLineInputDto> Lines { get; set; } = new();
}

public class BudgetSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int FiscalYear { get; set; }
    public string PeriodType { get; set; } = "Monthly";
    public string Status { get; set; } = "Draft";
    public string? ProjectName { get; set; }
    public Guid? ProjectId { get; set; }
    public decimal TotalBudgetAmount { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public int TotalAllocatedAccounts { get; set; }
}

public class BudgetVarianceLineDto
{
    public Guid AccountId { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string AccountType { get; set; } = string.Empty; // Revenue, Expense, COGS, Asset
    public decimal BudgetAmount { get; set; }
    public decimal ActualAmount { get; set; }
    public decimal VarianceAmount { get; set; } // Actual - Budget (or vice versa)
    public decimal VariancePercentage { get; set; } // % variance
    public decimal UtilizationPercentage { get; set; } // (Actual / Budget) * 100
    public string VarianceStatus { get; set; } = "Favorable"; // "Favorable" (F) vs "Unfavorable" (U)
    public string AlertLevel { get; set; } = "Normal"; // "Normal", "Warning" (>=80%), "OverBudget" (>100%)
    public decimal WarningThresholdPercentage { get; set; } = 80.00m;
    public decimal CriticalThresholdPercentage { get; set; } = 100.00m;
}

public class BudgetVarianceReportDto
{
    public Guid? BudgetId { get; set; }
    public string BudgetName { get; set; } = string.Empty;
    public int FiscalYear { get; set; }
    public int? Month { get; set; }
    public int? Quarter { get; set; }
    public string PeriodLabel { get; set; } = string.Empty; // e.g. "Januari 2026", "Kuartal 1 2026", "Tahun 2026"
    public string? ProjectName { get; set; }
    public Guid? ProjectId { get; set; }

    // Summary Totals
    public decimal TotalBudgetedRevenue { get; set; }
    public decimal TotalActualRevenue { get; set; }
    public decimal RevenueVariance { get; set; }

    public decimal TotalBudgetedExpense { get; set; }
    public decimal TotalActualExpense { get; set; }
    public decimal ExpenseVariance { get; set; }

    public decimal TotalBudget { get; set; }
    public decimal TotalActual { get; set; }
    public decimal TotalVariance { get; set; }
    public decimal OverallUtilizationPercentage { get; set; }

    public int NormalCount { get; set; }
    public int WarningCount { get; set; }
    public int OverBudgetCount { get; set; }

    public List<BudgetVarianceLineDto> RevenueLines { get; set; } = new();
    public List<BudgetVarianceLineDto> ExpenseLines { get; set; } = new();
    public List<BudgetVarianceLineDto> OtherLines { get; set; } = new();
}
