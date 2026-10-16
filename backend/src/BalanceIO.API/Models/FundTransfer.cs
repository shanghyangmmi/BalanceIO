using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Fund Transfer - Transfer between bank/cash accounts
/// </summary>
public class FundTransfer
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string TransferNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly TransferDate { get; set; }

    // Source Account (From)
    [Required]
    public Guid FromAccountId { get; set; }
    public Account? FromAccount { get; set; }

    // Destination Account (To)
    [Required]
    public Guid ToAccountId { get; set; }
    public Account? ToAccount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Amount { get; set; }

    [MaxLength(100)]
    public string? Reference { get; set; }

    public string? Description { get; set; }

    public FundTransferStatus Status { get; set; } = FundTransferStatus.Draft;

    // Journal Entry generated when posted
    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    public DateTime? VoidedAt { get; set; }
}

public enum FundTransferStatus
{
    Draft,
    Pending,
    Posted,
    Void
}

/// <summary>
/// Journal Voucher - Manual journal entry document
/// </summary>
public class JournalVoucher
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string VoucherNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly VoucherDate { get; set; }

    [MaxLength(100)]
    public string? Reference { get; set; }

    public string? Description { get; set; }

    public JournalVoucherType VoucherType { get; set; } = JournalVoucherType.General;

    public JournalVoucherStatus Status { get; set; } = JournalVoucherStatus.Draft;

    // Journal Entry generated when posted
    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    // Navigation
    public List<JournalVoucherLine> Lines { get; set; } = new();

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    public DateTime? VoidedAt { get; set; }
}

public class JournalVoucherLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid JournalVoucherId { get; set; }
    public JournalVoucher? JournalVoucher { get; set; }

    public int LineNumber { get; set; }

    [Required]
    public Guid AccountId { get; set; }
    public Account? Account { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal DebitAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal CreditAmount { get; set; }
}

public enum JournalVoucherType
{
    General,
    OpeningBalance,
    ClosingEntry,
    Adjustment,
    Depreciation,
    Accrual,
    Reversal
}

public enum JournalVoucherStatus
{
    Draft,
    Pending,
    Posted,
    Void
}
