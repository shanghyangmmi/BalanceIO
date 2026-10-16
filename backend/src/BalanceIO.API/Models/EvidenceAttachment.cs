using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Evidence Attachment - Represents verifiable physical or digital evidence
/// attached to financial documents (JournalEntry, PurchaseBill, SalesInvoice, PaymentVoucher, ReceiptVoucher, Expense)
/// </summary>
public class EvidenceAttachment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(50)]
    public string EntityType { get; set; } = string.Empty; // "JournalEntry", "PurchaseBill", "SalesInvoice", "PaymentVoucher", "ReceiptVoucher", "Expense"

    [Required]
    public Guid EntityId { get; set; } // Foreign key to the document

    [Required]
    [MaxLength(50)]
    public string AttachmentType { get; set; } = "Receipt"; // "Receipt", "VendorInvoice", "Contract", "TaxSlip", "DeliveryNote", "BankSlip", "SupportingDoc"

    [Required]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [MaxLength(20)]
    public string FileExtension { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string ContentType { get; set; } = string.Empty;

    public long FileSize { get; set; } // In Bytes

    [Required]
    [MaxLength(500)]
    public string FileUrl { get; set; } = string.Empty;

    [MaxLength(500)]
    public string StoragePath { get; set; } = string.Empty; // Disk path or S3 key

    [MaxLength(500)]
    public string? Notes { get; set; }

    // Upload Audit
    [MaxLength(100)]
    public string? UploadedBy { get; set; }
    public Guid? UploadedByUserId { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // Verification by Auditor/Approver
    public bool IsVerified { get; set; } = false;

    [MaxLength(100)]
    public string? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
}
