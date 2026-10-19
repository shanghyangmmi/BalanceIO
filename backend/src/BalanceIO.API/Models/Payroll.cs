using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// What an employee is paid each month. The employee is a Contact with
/// IsEmployee set; NIK, PTKP status and the BPJS numbers live there, so
/// this holds only the figures a payroll run reads.
/// </summary>
public class EmployeeCompensation
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [Required]
    public Guid ContactId { get; set; }

    [ForeignKey("ContactId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Contact? Contact { get; set; }

    /// <summary>Gaji pokok.</summary>
    [Column(TypeName = "decimal(19,4)")]
    public decimal BaseSalary { get; set; }

    /// <summary>Tunjangan tetap. Part of the wage BPJS is computed on.</summary>
    [Column(TypeName = "decimal(19,4)")]
    public decimal FixedAllowance { get; set; }

    /// <summary>
    /// JKK premium as a percentage of wage, set by the workplace risk class
    /// (0.24, 0.54, 0.89, 1.27 or 1.74).
    /// </summary>
    [Column(TypeName = "decimal(5,2)")]
    public decimal JkkRate { get; set; } = 0.24m;

    /// <summary>JKK, JKM and JHT.</summary>
    public bool BpjsKetenagakerjaan { get; set; } = true;

    /// <summary>Jaminan Pensiun. Not every employee participates (e.g. past pension age).</summary>
    public bool BpjsPension { get; set; } = true;

    public bool BpjsKesehatan { get; set; } = true;

    public bool IsActive { get; set; } = true;

    // Dimension
    public Guid? CostCenterId { get; set; }
    [ForeignKey("CostCenterId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public CostCenter? CostCenter { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public enum PayrollRunStatus
{
    Draft = 0,
    Posted = 1,
    Void = 2,
}

/// <summary>
/// One month's payroll. Calculated as a Draft, posted to the ledger by a
/// second person when segregation of duties is on, and voided rather than
/// edited once posted.
/// </summary>
public class PayrollRun
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>The journal date. Defaults to the last day of the month.</summary>
    public DateOnly PostingDate { get; set; }

    public PayrollRunStatus Status { get; set; } = PayrollRunStatus.Draft;

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalGross { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalPph21 { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalEmployeeBpjs { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalEmployerBpjs { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalNetPay { get; set; }

    public Guid? JournalEntryId { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }

    public Guid? CreatedByUserId { get; set; }
    [MaxLength(100)]
    public string? CreatedBy { get; set; }

    public Guid? ApprovedByUserId { get; set; }
    [MaxLength(100)]
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public List<PayrollLine> Lines { get; set; } = new();
}

/// <summary>
/// One employee in one run. Every figure is stored as calculated, so the
/// payslip and the bukti potong can be reproduced after the compensation
/// or the rates change.
/// </summary>
public class PayrollLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid PayrollRunId { get; set; }

    [ForeignKey("PayrollRunId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public PayrollRun? PayrollRun { get; set; }

    [Required]
    public Guid ContactId { get; set; }

    [MaxLength(200)]
    public string EmployeeName { get; set; } = string.Empty;

    [MaxLength(16)]
    public string? Nik { get; set; }

    [MaxLength(10)]
    public string PtkpStatus { get; set; } = "TK/0";

    /// <summary>A, B or C.</summary>
    [MaxLength(1)]
    public string TerCategory { get; set; } = "A";

    [Column(TypeName = "decimal(19,4)")] public decimal BaseSalary { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal FixedAllowance { get; set; }

    /// <summary>Overtime, bonus, THR: taxable, outside the BPJS wage.</summary>
    [Column(TypeName = "decimal(19,4)")] public decimal OtherEarnings { get; set; }

    [Column(TypeName = "decimal(19,4)")] public decimal EmployerJkk { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal EmployerJkm { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal EmployerJht { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal EmployerJp { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal EmployerKesehatan { get; set; }

    [Column(TypeName = "decimal(19,4)")] public decimal EmployeeJht { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal EmployeeJp { get; set; }
    [Column(TypeName = "decimal(19,4)")] public decimal EmployeeKesehatan { get; set; }

    /// <summary>Penghasilan bruto for PPh 21: earnings plus the JKK, JKM and Kesehatan premiums the employer pays.</summary>
    [Column(TypeName = "decimal(19,4)")] public decimal TaxableGross { get; set; }

    /// <summary>The TER percentage applied, or null when the month was settled on the annual calculation.</summary>
    [Column(TypeName = "decimal(5,2)")] public decimal? TerRate { get; set; }

    /// <summary>TER for January to November, Annual for the December settlement.</summary>
    [MaxLength(10)]
    public string Pph21Method { get; set; } = "TER";

    /// <summary>Negative in December when TER over-withheld during the year; the excess is returned in net pay.</summary>
    [Column(TypeName = "decimal(19,4)")] public decimal Pph21 { get; set; }

    [Column(TypeName = "decimal(19,4)")] public decimal NetPay { get; set; }

    /// <summary>Why a figure here may be wrong, e.g. a missing PTKP status. Null when nothing is in doubt.</summary>
    [MaxLength(300)]
    public string? Warning { get; set; }
}
