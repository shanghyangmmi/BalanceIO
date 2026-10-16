using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Receipt Voucher - Record of payment received from customer
/// </summary>
public class ReceiptVoucher
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(50)]
    public string VoucherNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly ReceiptDate { get; set; }

    public ReceiptType ReceiptType { get; set; } = ReceiptType.Customer;

    // Contact (for customer payments)
    public Guid? ContactId { get; set; }
    public Contact? Contact { get; set; }

    // Deposit Account (bank/cash)
    [Required]
    public Guid DepositAccountId { get; set; }
    public Account? DepositAccount { get; set; }

    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.BankTransfer;

    [MaxLength(100)]
    public string? PaymentReference { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    [Column(TypeName = "decimal(19,6)")]
    public decimal ExchangeRate { get; set; } = 1;

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalAmount { get; set; }

    public ReceiptVoucherStatus Status { get; set; } = ReceiptVoucherStatus.Draft;

    public string? Description { get; set; }

    public string? Notes { get; set; }

    [MaxLength(100)]
    public string TemplateName { get; set; } = "classic";

    // Journal Entry generated when posted
    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    // Navigation
    public List<ReceiptVoucherLine> Lines { get; set; } = new();

    // Audit & Segregation of Duties
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    public DateTime? VoidedAt { get; set; }

    public Guid? CreatedByUserId { get; set; }
    [MaxLength(100)]
    public string? CreatedBy { get; set; }

    public Guid? ApprovedByUserId { get; set; }
    [MaxLength(100)]
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    [MaxLength(500)]
    public string? RejectionReason { get; set; }
}

public class ReceiptVoucherLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid ReceiptVoucherId { get; set; }
    public ReceiptVoucher? ReceiptVoucher { get; set; }

    public int LineNumber { get; set; }

    // Either reference an invoice or direct income
    public Guid? SalesInvoiceId { get; set; }
    public SalesInvoice? SalesInvoice { get; set; }

    // For direct income (not linked to invoice)
    public Guid? AccountId { get; set; }
    public Account? Account { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Amount { get; set; }
}

public enum ReceiptType
{
    Customer,    // Payment from customer (Invoice payment)
    Income,      // Direct income receipt
    Refund,      // Vendor refund
    Other
}

public enum ReceiptVoucherStatus
{
    Draft,
    Pending,
    Posted,
    Void
}
