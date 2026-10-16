using BalanceIO.API.Models;

namespace BalanceIO.API.DTOs;

/// <summary>
/// Data Transfer Objects for Bank Reconciliation workspace, statement imports,
/// auto-matching rules, manual linkings, and mathematical reconciliation reports.
/// </summary>

public class BankAccountSummaryDto
{
    public Guid AccountId { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? AccountGroup { get; set; }
    public string Currency { get; set; } = "IDR";
    public decimal GeneralLedgerBalance { get; set; }
    public decimal? LatestStatementBalance { get; set; }
    public DateOnly? LatestStatementDate { get; set; }
    public int UnmatchedStatementLinesCount { get; set; }
    public int UnreconciledLedgerLinesCount { get; set; }
    public bool IsReconciled { get; set; }
}

public class BankReconciliationWorkspaceResponse
{
    public Guid CompanyId { get; set; }
    public Guid AccountId { get; set; }
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string Currency { get; set; } = "IDR";
    public DateOnly AsOfDate { get; set; }

    // ── Formal Reconciliation Equation ──
    public decimal StatementEndingBalance { get; set; }
    public decimal GeneralLedgerEndingBalance { get; set; }
    public decimal DepositsInTransit { get; set; } // In books, not on bank statement
    public decimal OutstandingPayments { get; set; } // In books, not on bank statement
    public decimal UnrecordedBankCredits { get; set; } // On statement, not in books
    public decimal UnrecordedBankDebits { get; set; } // On statement, not in books
    public decimal AdjustedBankBalance { get; set; } // Statement + Deposits - Payments
    public decimal AdjustedLedgerBalance { get; set; } // Ledger + UnrecordedCredits - UnrecordedDebits
    public decimal Difference { get; set; } // AdjustedBank - AdjustedLedger
    public bool IsBalanced => Math.Abs(Difference) < 0.01m;

    // Statement Side
    public List<BankStatementLineDto> StatementLines { get; set; } = new();

    // Ledger Side
    public List<LedgerReconciliationLineDto> LedgerLines { get; set; } = new();

    // Summary Stats
    public int TotalStatementLines { get; set; }
    public int MatchedStatementLines { get; set; }
    public int UnmatchedStatementLines { get; set; }
    public int TotalLedgerLines { get; set; }
    public int MatchedLedgerLines { get; set; }
    public int UnmatchedLedgerLines { get; set; }
}

public class BankStatementLineDto
{
    public Guid Id { get; set; }
    public Guid BankStatementId { get; set; }
    public DateOnly TransactionDate { get; set; }
    public DateOnly? ValueDate { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? ReferenceNumber { get; set; }
    public decimal Debit { get; set; } // Money out
    public decimal Credit { get; set; } // Money in
    public decimal Amount { get; set; } // Signed amount
    public decimal RunningBalance { get; set; }
    public StatementLineStatus Status { get; set; }
    public string StatusLabel => Status.ToString();
    public Guid? MatchedJournalLineId { get; set; }
    public string? MatchedDocumentType { get; set; }
    public Guid? MatchedDocumentId { get; set; }
    public MatchConfidence MatchConfidence { get; set; }
    public string MatchConfidenceLabel => MatchConfidence.ToString();
    public decimal BankFeeAmount { get; set; }
    public Guid? CreatedJournalEntryId { get; set; }
    public string? ExtractedVirtualAccount { get; set; }
}

public class LedgerReconciliationLineDto
{
    public Guid JournalLineId { get; set; }
    public Guid JournalEntryId { get; set; }
    public string JournalNumber { get; set; } = string.Empty;
    public string? ReferenceNumber { get; set; }
    public DateOnly Date { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Debit { get; set; } // Money in (Book Dr)
    public decimal Credit { get; set; } // Money out (Book Cr)
    public decimal NetAmount => Debit - Credit;
    public bool IsReconciled { get; set; }
    public Guid? MatchedStatementLineId { get; set; }
    public string? DocumentType { get; set; } // "ReceiptVoucher", "PaymentVoucher", "Expense", "Journal"
}

public class StatementImportRequest
{
    public Guid AccountId { get; set; }
    public BankStatementFormat Format { get; set; } = BankStatementFormat.GenericCsv;
    public string CsvContent { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public decimal? InitialOpeningBalance { get; set; }
}

public class StatementImportResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public Guid? BankStatementId { get; set; }
    public int TotalLinesParsed { get; set; }
    public int ImportedLinesCount { get; set; }
    public int DuplicateLinesSkipped { get; set; }
    public decimal OpeningBalance { get; set; }
    public decimal ClosingBalance { get; set; }
    public decimal TotalDebits { get; set; }
    public decimal TotalCredits { get; set; }
}

public class AutoMatchRequest
{
    public Guid AccountId { get; set; }
    public int DateToleranceDays { get; set; } = 3; // Default 3 days for clearing timing differences
    public bool AutoSplitBankFees { get; set; } = true;
}

public class AutoMatchResponse
{
    public int ExactMatchesFound { get; set; }
    public int TimingMatchesFound { get; set; }
    public int VirtualAccountMatchesFound { get; set; }
    public int TotalMatched => ExactMatchesFound + TimingMatchesFound + VirtualAccountMatchesFound;
    public decimal TotalMatchedAmount { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class ManualMatchRequest
{
    public Guid StatementLineId { get; set; }
    public Guid JournalLineId { get; set; }
}

public class UnmatchRequest
{
    public Guid StatementLineId { get; set; }
}

public class PostBankAdjustmentRequest
{
    public Guid StatementLineId { get; set; }
    public string AdjustmentType { get; set; } = "BankCharge"; // "BankCharge" (6-1900) or "InterestIncome" (7-1000)
    public string? AccountCode { get; set; } // Optional custom override
    public string? Notes { get; set; }
}

public class PostBankAdjustmentResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public Guid JournalEntryId { get; set; }
    public string JournalNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

public class FinalizeReconciliationRequest
{
    public Guid AccountId { get; set; }
    public DateOnly ReconciliationDate { get; set; }
    public string? Notes { get; set; }
}

public class FinalizeReconciliationResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public Guid SessionId { get; set; }
    public decimal ReconciledBalance { get; set; }
}
