using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

public class BudgetingService
{
    private readonly ApplicationDbContext _context;

    public BudgetingService(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Generates a real-time Actual vs Budget Variance Report with dynamic GL aggregation
    /// </summary>
    public async Task<BudgetVarianceReportDto> GetVarianceReportAsync(
        Guid companyId,
        int fiscalYear,
        int? month = null,
        int? quarter = null,
        Guid? projectId = null,
        Guid? budgetId = null)
    {
        // 1. Locate Budget
        Budget? budget = null;
        if (budgetId.HasValue)
        {
            budget = await _context.Budgets
                .Include(b => b.Lines)
                    .ThenInclude(l => l.Account)
                .Include(b => b.Project)
                .FirstOrDefaultAsync(b => b.Id == budgetId.Value && b.CompanyId == companyId);
        }
        else
        {
            // Default to first approved budget for the fiscal year, or latest draft
            budget = await _context.Budgets
                .Include(b => b.Lines)
                    .ThenInclude(l => l.Account)
                .Include(b => b.Project)
                .Where(b => b.CompanyId == companyId && b.FiscalYear == fiscalYear && (projectId == null || b.ProjectId == projectId))
                .OrderByDescending(b => b.Status) // Approved first
                .ThenByDescending(b => b.CreatedAt)
                .FirstOrDefaultAsync();
        }

        // Period Label
        string periodLabel = $"Tahun {fiscalYear}";
        if (month.HasValue && month.Value >= 1 && month.Value <= 12)
        {
            string[] monthNames = { "", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember" };
            periodLabel = $"{monthNames[month.Value]} {fiscalYear}";
        }
        else if (quarter.HasValue && quarter.Value >= 1 && quarter.Value <= 4)
        {
            periodLabel = $"Kuartal {quarter.Value} (Q{quarter.Value}) {fiscalYear}";
        }

        var report = new BudgetVarianceReportDto
        {
            BudgetId = budget?.Id,
            BudgetName = budget?.Name ?? $"Anggaran RKAP {fiscalYear}",
            FiscalYear = fiscalYear,
            Month = month,
            Quarter = quarter,
            PeriodLabel = periodLabel,
            ProjectId = projectId ?? budget?.ProjectId,
            ProjectName = budget?.Project?.Name
        };

        // 2. Fetch all Accounts for Company
        var accounts = await _context.Accounts
            .Where(a => a.CompanyId == companyId)
            .OrderBy(a => a.Code)
            .ToListAsync();

        // Determine Start & End Date for Actuals from GL
        var startDate = new DateOnly(fiscalYear, 1, 1);
        var endDate = new DateOnly(fiscalYear, 12, 31);

        if (month.HasValue && month.Value >= 1 && month.Value <= 12)
        {
            int m = month.Value;
            startDate = new DateOnly(fiscalYear, m, 1);
            endDate = new DateOnly(fiscalYear, m, DateTime.DaysInMonth(fiscalYear, m));
        }
        else if (quarter.HasValue && quarter.Value >= 1 && quarter.Value <= 4)
        {
            int startM = (quarter.Value - 1) * 3 + 1;
            int endM = startM + 2;
            startDate = new DateOnly(fiscalYear, startM, 1);
            endDate = new DateOnly(fiscalYear, endM, DateTime.DaysInMonth(fiscalYear, endM));
        }

        // 3. Aggregate Actual Posted GL journal lines
        var glLinesQuery = _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry != null 
                     && l.JournalEntry.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && l.JournalEntry.Date >= startDate 
                     && l.JournalEntry.Date <= endDate);

        if (projectId.HasValue)
        {
            glLinesQuery = glLinesQuery.Where(l => l.JournalEntry!.ProjectId == projectId.Value);
        }

        var glLines = await glLinesQuery.ToListAsync();

        var glAggregates = glLines
            .GroupBy(l => l.AccountId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    TotalDebit = g.Sum(x => x.Debit),
                    TotalCredit = g.Sum(x => x.Credit)
                }
            );

        // 4. Map Budget lines
        var budgetLinesByAccount = new Dictionary<Guid, List<BudgetLine>>();
        if (budget != null)
        {
            foreach (var line in budget.Lines)
            {
                // Filter line based on month/quarter selection
                bool include = true;
                if (month.HasValue)
                {
                    include = line.Month == month.Value;
                }
                else if (quarter.HasValue)
                {
                    int q = ((line.Month - 1) / 3) + 1;
                    include = q == quarter.Value;
                }

                if (include)
                {
                    if (!budgetLinesByAccount.ContainsKey(line.AccountId))
                        budgetLinesByAccount[line.AccountId] = new List<BudgetLine>();
                    budgetLinesByAccount[line.AccountId].Add(line);
                }
            }
        }

        // 5. Build Variance Lines
        foreach (var acc in accounts)
        {
            string accIdStr = acc.Id.ToString();
            string accCode = acc.Code;

            bool hasBudget = budgetLinesByAccount.ContainsKey(acc.Id);
            bool hasActual = glAggregates.ContainsKey(accCode) || glAggregates.ContainsKey(accIdStr);

            string typeStr = acc.Type;
            bool isRevenue = string.Equals(acc.Type, "Revenue", StringComparison.OrdinalIgnoreCase) 
                          || acc.Code.StartsWith("4");
            bool isExpense = string.Equals(acc.Type, "Expense", StringComparison.OrdinalIgnoreCase)
                          || acc.Code.StartsWith("5") 
                          || acc.Code.StartsWith("6") 
                          || acc.Code.StartsWith("7") 
                          || acc.Code.StartsWith("8") 
                          || acc.Code.StartsWith("9");

            if (!hasBudget && !hasActual && !isRevenue && !isExpense)
                continue;

            decimal budgeted = 0;
            decimal warningThreshold = 80m;
            decimal criticalThreshold = 100m;

            if (hasBudget)
            {
                var lines = budgetLinesByAccount[acc.Id];
                budgeted = lines.Sum(l => l.Amount);
                if (lines.Any())
                {
                    warningThreshold = lines.First().WarningThresholdPercentage;
                    criticalThreshold = lines.First().CriticalThresholdPercentage;
                }
            }

            decimal actual = 0;
            if (hasActual)
            {
                decimal debit = 0;
                decimal credit = 0;
                if (glAggregates.ContainsKey(accCode))
                {
                    debit += glAggregates[accCode].TotalDebit;
                    credit += glAggregates[accCode].TotalCredit;
                }
                if (glAggregates.ContainsKey(accIdStr))
                {
                    debit += glAggregates[accIdStr].TotalDebit;
                    credit += glAggregates[accIdStr].TotalCredit;
                }

                if (isRevenue)
                {
                    actual = credit - debit; // Normal Credit
                }
                else
                {
                    actual = debit - credit; // Normal Debit
                }
            }

            if (budgeted == 0 && actual == 0)
                continue;

            decimal variance = actual - budgeted;
            decimal variancePct = budgeted != 0 ? ((actual - budgeted) / Math.Abs(budgeted)) * 100m : 0;
            decimal utilization = budgeted > 0 ? (actual / budgeted) * 100m : (actual > 0 ? 100m : 0);

            // Favorable / Unfavorable logic
            string varianceStatus = "Favorable";
            string alertLevel = "Normal";

            if (isRevenue)
            {
                varianceStatus = actual >= budgeted ? "Favorable" : "Unfavorable";
                alertLevel = utilization < warningThreshold ? "Warning" : "Normal";
            }
            else
            {
                // Expense
                varianceStatus = actual <= budgeted ? "Favorable" : "Unfavorable";
                if (utilization > criticalThreshold)
                {
                    alertLevel = "OverBudget";
                    report.OverBudgetCount++;
                }
                else if (utilization >= warningThreshold)
                {
                    alertLevel = "Warning";
                    report.WarningCount++;
                }
                else
                {
                    report.NormalCount++;
                }
            }

            var lineDto = new BudgetVarianceLineDto
            {
                AccountId = acc.Id,
                AccountCode = acc.Code,
                AccountName = acc.Name,
                AccountType = typeStr,
                BudgetAmount = budgeted,
                ActualAmount = actual,
                VarianceAmount = variance,
                VariancePercentage = Math.Round(variancePct, 2),
                UtilizationPercentage = Math.Round(utilization, 2),
                VarianceStatus = varianceStatus,
                AlertLevel = alertLevel,
                WarningThresholdPercentage = warningThreshold,
                CriticalThresholdPercentage = criticalThreshold
            };

            if (isRevenue)
            {
                report.RevenueLines.Add(lineDto);
                report.TotalBudgetedRevenue += budgeted;
                report.TotalActualRevenue += actual;
            }
            else if (isExpense)
            {
                report.ExpenseLines.Add(lineDto);
                report.TotalBudgetedExpense += budgeted;
                report.TotalActualExpense += actual;
            }
            else
            {
                report.OtherLines.Add(lineDto);
            }
        }

        // Summary Calculations
        report.RevenueVariance = report.TotalActualRevenue - report.TotalBudgetedRevenue;
        report.ExpenseVariance = report.TotalActualExpense - report.TotalBudgetedExpense;
        report.TotalBudget = report.TotalBudgetedExpense;
        report.TotalActual = report.TotalActualExpense;
        report.TotalVariance = report.ExpenseVariance;
        report.OverallUtilizationPercentage = report.TotalBudget > 0 
            ? Math.Round((report.TotalActual / report.TotalBudget) * 100m, 2) 
            : 0;

        return report;
    }
}
