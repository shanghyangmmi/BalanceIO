using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Bank Statement Batch - Represents an imported bank statement file
/// </summary>
public class BankStatement
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [Required]
    public Guid AccountId { get; set; } // Cash / Bank GL Account (e.g. 1-1102)

    [ForeignKey("AccountId")]
    public Account? Account { get; set; }

    [Required]
    public DateOnly StatementDate { get; set; }

    public DateOnly PeriodStart { get; set; }
    public DateOnly PeriodEnd { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal OpeningBalance { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal ClosingBalance { get; set; }

    public BankStatementFormat Format { get; set; } = BankStatementFormat.GenericCsv;

    [MaxLength(255)]
    public string? FileName { get; set; }

    [MaxLength(64)]
    public string? Checksum { get; set; } // MD5 hash for de-duplication

    public int TotalLines { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalDebits { get; set; } // Money out (Bank DB)

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalCredits { get; set; } // Money in (Bank CR)

    public BankStatementStatus Status { get; set; } = BankStatementStatus.Draft;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReconciledAt { get; set; }

    public List<BankStatementLine> Lines { get; set; } = new();
}

/// <summary>
/// Bank Statement Line - Individual transaction line from imported statement
/// </summary>
public class BankStatementLine
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid BankStatementId { get; set; }

    [ForeignKey("BankStatementId")]
    public BankStatement? BankStatement { get; set; }

    [Required]
    public DateOnly TransactionDate { get; set; }

    public DateOnly? ValueDate { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty; // Narration / Details (e.g., TRSF E-BANKING CR, VA 12345)

    [MaxLength(100)]
    public string? ReferenceNumber { get; set; } // Cheque/Ref/Trace number

    [Column(TypeName = "decimal(19,4)")]
    public decimal Debit { get; set; } // Bank Debit (Withdrawal)

    [Column(TypeName = "decimal(19,4)")]
    public decimal Credit { get; set; } // Bank Credit (Deposit)

    [Column(TypeName = "decimal(19,4)")]
    public decimal Amount { get; set; } // Signed amount: + for Credit (Deposit), - for Debit (Withdrawal)

    [Column(TypeName = "decimal(19,4)")]
    public decimal RunningBalance { get; set; }

    public StatementLineStatus Status { get; set; } = StatementLineStatus.Unmatched;

    // Matching details
    public Guid? MatchedJournalLineId { get; set; }

    [ForeignKey("MatchedJournalLineId")]
    public JournalLine? MatchedJournalLine { get; set; }

    [MaxLength(50)]
    public string? MatchedDocumentType { get; set; } // "ReceiptVoucher", "PaymentVoucher", "Expense", "JournalEntry"

    public Guid? MatchedDocumentId { get; set; }

    public MatchConfidence MatchConfidence { get; set; } = MatchConfidence.None;

    [Column(TypeName = "decimal(19,4)")]
    public decimal BankFeeAmount { get; set; } = 0; // Deducted transfer fee (e.g. Rp 6.500 / 2.500)

    public Guid? CreatedJournalEntryId { get; set; } // If created directly from statement line (adjustment/fee)

    [ForeignKey("CreatedJournalEntryId")]
    public JournalEntry? CreatedJournalEntry { get; set; }

    [MaxLength(64)]
    public string? LineHash { get; set; } // MD5 of Date+Amount+Desc+Balance for item-level de-duplication

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Bank Reconciliation Session - Formal reconciliation report & lock session
/// </summary>
public class BankReconciliationSession
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [Required]
    public Guid AccountId { get; set; }

    [ForeignKey("AccountId")]
    public Account? Account { get; set; }

    [Required]
    public DateOnly ReconciliationDate { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal StatementEndingBalance { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal LedgerEndingBalance { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal OutstandingDeposits { get; set; } // In ledger, not on statement

    [Column(TypeName = "decimal(19,4)")]
    public decimal OutstandingPayments { get; set; } // In ledger, not on statement

    [Column(TypeName = "decimal(19,4)")]
    public decimal UnrecordedBankCredits { get; set; } // On statement, not in ledger (e.g. interest)

    [Column(TypeName = "decimal(19,4)")]
    public decimal UnrecordedBankDebits { get; set; } // On statement, not in ledger (e.g. fees)

    [Column(TypeName = "decimal(19,4)")]
    public decimal AdjustedBankBalance { get; set; } // Statement + Deposits - Payments

    [Column(TypeName = "decimal(19,4)")]
    public decimal AdjustedLedgerBalance { get; set; } // Ledger + UnrecordedCredits - UnrecordedDebits

    [Column(TypeName = "decimal(19,4)")]
    public decimal Difference { get; set; } // AdjustedBank - AdjustedLedger

    public bool IsBalanced => Math.Abs(Difference) < 0.01m;

    public ReconciliationStatus Status { get; set; } = ReconciliationStatus.Draft;

    [MaxLength(500)]
    public string? Notes { get; set; }

    [MaxLength(100)]
    public string? ReconciledBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinalizedAt { get; set; }
}

public enum BankStatementFormat
{
    GenericCsv = 1,
    BcaKlikBca = 2,
    MandiriMcm = 3,
    Bri = 4,
    Bni = 5,
    Permata = 6
}

public enum BankStatementStatus
{
    Draft = 0,
    InProgress = 1,
    Reconciled = 2
}

public enum StatementLineStatus
{
    Unmatched = 0,
    Matched = 1,
    ManuallyMatched = 2,
    CreatedFromStatement = 3,
    Excluded = 9
}

public enum MatchConfidence
{
    None = 0,
    Fuzzy = 1, // 70%
    High = 2,  // 90% (Timing difference ±3 days)
    Exact = 3, // 100% (Exact date, amount, ref)
    Manual = 4
}

public enum ReconciliationStatus
{
    Draft = 0,
    Finalized = 1,
    Locked = 2
}
