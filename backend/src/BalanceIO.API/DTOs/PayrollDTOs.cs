namespace BalanceIO.API.DTOs;

public class PayrollCompensationDto
{
    public decimal BaseSalary { get; set; }
    public decimal FixedAllowance { get; set; }
    public decimal JkkRate { get; set; }
    public bool BpjsKetenagakerjaan { get; set; }
    public bool BpjsPension { get; set; }
    public bool BpjsKesehatan { get; set; }
    public bool IsActive { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UpsertCompensationRequest
{
    public decimal BaseSalary { get; set; }
    public decimal FixedAllowance { get; set; }
    public decimal JkkRate { get; set; } = 0.24m;
    public bool BpjsKetenagakerjaan { get; set; } = true;
    public bool BpjsPension { get; set; } = true;
    public bool BpjsKesehatan { get; set; } = true;
    public bool IsActive { get; set; } = true;
}

public class PayrollEmployeeDto
{
    public Guid ContactId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Nik { get; set; }
    public string? PtkpStatus { get; set; }
    /// <summary>A, B or C, from the PTKP status; A when the status is missing.</summary>
    public string TerCategory { get; set; } = "A";
    public string? BpjsKetenagakerjaanNumber { get; set; }
    public string? BpjsKesehatanNumber { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public PayrollCompensationDto? Compensation { get; set; }
    /// <summary>What would make this employee's payslip wrong or unpayable.</summary>
    public List<string> Issues { get; set; } = new();
}

public class CreatePayrollRunRequest
{
    public int Year { get; set; }
    public int Month { get; set; }
    /// <summary>Defaults to the last day of the month.</summary>
    public DateOnly? PostingDate { get; set; }
    public string? Notes { get; set; }
}

public class UpdatePayrollLineRequest
{
    public decimal OtherEarnings { get; set; }
}

public class VoidPayrollRunRequest
{
    public string? Reason { get; set; }
}

public class PayrollRunSummaryDto
{
    public Guid Id { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public string Period { get; set; } = string.Empty;
    public DateOnly PostingDate { get; set; }
    /// <summary>Draft, Posted or Void.</summary>
    public string Status { get; set; } = "Draft";
    public int Employees { get; set; }
    public int Warnings { get; set; }
    public decimal TotalGross { get; set; }
    public decimal TotalPph21 { get; set; }
    public decimal TotalEmployeeBpjs { get; set; }
    public decimal TotalEmployerBpjs { get; set; }
    public decimal TotalNetPay { get; set; }
    /// <summary>What the run costs the company: earnings plus employer BPJS.</summary>
    public decimal TotalCost { get; set; }
    public Guid? JournalEntryId { get; set; }
    public string? JournalReference { get; set; }
    public string? Notes { get; set; }
    public string? CreatedBy { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PayrollLineDto
{
    public Guid Id { get; set; }
    public Guid ContactId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? Nik { get; set; }
    public string PtkpStatus { get; set; } = string.Empty;
    public string TerCategory { get; set; } = string.Empty;
    public decimal BaseSalary { get; set; }
    public decimal FixedAllowance { get; set; }
    public decimal OtherEarnings { get; set; }
    public decimal EmployerJkk { get; set; }
    public decimal EmployerJkm { get; set; }
    public decimal EmployerJht { get; set; }
    public decimal EmployerJp { get; set; }
    public decimal EmployerKesehatan { get; set; }
    public decimal EmployeeJht { get; set; }
    public decimal EmployeeJp { get; set; }
    public decimal EmployeeKesehatan { get; set; }
    public decimal TaxableGross { get; set; }
    public decimal? TerRate { get; set; }
    public string Pph21Method { get; set; } = "TER";
    public decimal Pph21 { get; set; }
    public decimal NetPay { get; set; }
    public string? Warning { get; set; }
}

public class PayrollJournalLineDto
{
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

public class PayrollRunDetailDto : PayrollRunSummaryDto
{
    public string Currency { get; set; } = "IDR";
    public List<PayrollLineDto> Lines { get; set; } = new();
    /// <summary>The entry posting will create, or did create.</summary>
    public List<PayrollJournalLineDto> Journal { get; set; } = new();
    /// <summary>Why posting would be refused now. Empty when it would go through.</summary>
    public List<string> Blockers { get; set; } = new();
}

public class PayrollDeadlineDto
{
    public string Label { get; set; } = string.Empty;
    public DateOnly Due { get; set; }
    public int DaysRemaining { get; set; }
}

public class PayrollOverviewDto
{
    public string Currency { get; set; } = "IDR";
    public int Year { get; set; }
    public int Month { get; set; }
    public string Period { get; set; } = string.Empty;
    public int Employees { get; set; }
    public int EmployeesWithoutCompensation { get; set; }
    public int EmployeesWithIssues { get; set; }
    public decimal MonthlyBaseCost { get; set; }
    public PayrollRunSummaryDto? CurrentRun { get; set; }
    public PayrollRunSummaryDto? PreviousRun { get; set; }
    public decimal YearGross { get; set; }
    public decimal YearPph21 { get; set; }
    public decimal YearEmployerBpjs { get; set; }
    public decimal YearEmployeeBpjs { get; set; }
    public decimal YearNetPay { get; set; }
    /// <summary>PPh 21 and BPJS for the last posted month.</summary>
    public List<PayrollDeadlineDto> Deadlines { get; set; } = new();
    public List<PayrollRunSummaryDto> Runs { get; set; } = new();
}
