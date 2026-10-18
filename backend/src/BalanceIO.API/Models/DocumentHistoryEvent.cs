using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Append-only, tamper-evident audit record of high-level document lifecycle events.
///
/// Under UU KUP Pasal 28, accounting records and audit trails must be retained for at least 10 years.
/// Each event contains a cryptographic SHA-256 hash chaining to the preceding event for that document,
/// guaranteeing tamper evidence.
/// </summary>
public class DocumentHistoryEvent
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey(nameof(CompanyId))]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(50)]
    public string DocumentType { get; set; } = string.Empty; // e.g. "JournalEntry", "SalesInvoice", "PurchaseBill", "PayrollRun", "FixedAsset"

    [Required]
    public Guid DocumentId { get; set; }

    [Required]
    [MaxLength(50)]
    public string Action { get; set; } = string.Empty; // e.g. "Created", "Updated", "Submitted", "Approved", "Rejected", "Posted", "Voided", "Reversed"

    [Required]
    public Guid ActorUserId { get; set; }

    [Required]
    [MaxLength(100)]
    public string ActorName { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    [MaxLength(500)]
    public string? Reason { get; set; }

    public Guid? ReversalDocumentId { get; set; }

    public string? DiffSummaryJson { get; set; }

    [Required]
    [MaxLength(64)]
    public string RowHash { get; set; } = string.Empty;

    [MaxLength(64)]
    public string PreviousHash { get; set; } = string.Empty;
}
