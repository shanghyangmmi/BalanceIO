using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Payment Voucher - Record of payment made to vendor or for expenses
/// </summary>
public class PaymentVoucher
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
    public DateOnly PaymentDate { get; set; }

    public PaymentType PaymentType { get; set; } = PaymentType.Vendor;

    // Contact (for vendor payments)
    public Guid? ContactId { get; set; }
    public Contact? Contact { get; set; }

    // Payment Method
    public PaymentMethod PaymentMethod { get; set; } = PaymentMethod.BankTransfer;

    [MaxLength(100)]
    public string? PaymentReference { get; set; } // Check number, transfer ref, etc.

    // Bank/Cash Account used for payment
    [Required]
    public Guid PaymentAccountId { get; set; }
    public Account? PaymentAccount { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    [Column(TypeName = "decimal(19,6)")]
    public decimal ExchangeRate { get; set; } = 1;

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalAmount { get; set; }

    public PaymentVoucherStatus Status { get; set; } = PaymentVoucherStatus.Draft;

    public string? Description { get; set; }

    public string? Notes { get; set; }

    [MaxLength(100)]
    public string TemplateName { get; set; } = "classic";

    // Journal Entry generated when posted
    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    // Navigation - Payment allocations
    public List<PaymentVoucherLine> Lines { get; set; } = new();

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

public class PaymentVoucherLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid PaymentVoucherId { get; set; }
    public PaymentVoucher? PaymentVoucher { get; set; }

    public int LineNumber { get; set; }

    // Either reference a bill or direct expense
    public Guid? PurchaseBillId { get; set; }
    public PurchaseBill? PurchaseBill { get; set; }

    // For direct expenses (not linked to a bill)
    public Guid? AccountId { get; set; }
    public Account? Account { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Amount { get; set; }

    [Column(TypeName = "decimal(5,2)")]
    public decimal TaxRate { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TotalAmount { get; set; }
}

public enum PaymentType
{
    Vendor,      // Payment to vendor (Bill payment)
    Expense,     // Direct expense payment
    Refund,      // Customer refund
    Other
}

public enum PaymentMethod
{
    Cash,
    BankTransfer,
    Check,
    CreditCard,
    DebitCard,
    EWallet,
    Other
}

public enum PaymentVoucherStatus
{
    Draft,
    Pending,
    Posted,
    Void
}
