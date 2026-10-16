using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace BalanceIO.API.Models;

public enum BudgetStatus
{
    Draft = 0,
    Approved = 1,
    Closed = 2
}

public enum BudgetPeriodType
{
    Monthly = 0,
    Quarterly = 1,
    Annual = 2
}

/// <summary>
/// Rencana Kerja & Anggaran Perusahaan (RKAP) / Corporate Budget Header
/// </summary>
public class Budget
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty; // e.g. "RKAP Operasional 2026"

    public int FiscalYear { get; set; } = DateTime.UtcNow.Year;

    public BudgetPeriodType PeriodType { get; set; } = BudgetPeriodType.Monthly;

    public BudgetStatus Status { get; set; } = BudgetStatus.Draft;

    public Guid? ProjectId { get; set; } // Optional cost center / project

    [ForeignKey("ProjectId")]
    public Project? Project { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal TotalBudgetAmount { get; set; }

    // Audit Attribution
    [MaxLength(100)]
    public string? CreatedBy { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [MaxLength(100)]
    public string? ApprovedBy { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public ICollection<BudgetLine> Lines { get; set; } = new List<BudgetLine>();
}

/// <summary>
/// Budget Allocation Line per Account and Period
/// </summary>
public class BudgetLine
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid BudgetId { get; set; }

    [ForeignKey("BudgetId")]
    [JsonIgnore]
    public Budget? Budget { get; set; }

    [Required]
    public Guid AccountId { get; set; }

    [ForeignKey("AccountId")]
    public Account? Account { get; set; }

    public int Month { get; set; } = 1; // 1 to 12

    public int? Quarter { get; set; } // 1 to 4

    [Column(TypeName = "decimal(18,2)")]
    public decimal Amount { get; set; } // Budgeted Target (IDR)

    [Column(TypeName = "decimal(5,2)")]
    public decimal WarningThresholdPercentage { get; set; } = 80.00m; // Alert at 80%

    [Column(TypeName = "decimal(5,2)")]
    public decimal CriticalThresholdPercentage { get; set; } = 100.00m; // Alert at 100%

    [MaxLength(250)]
    public string? Notes { get; set; }
}
