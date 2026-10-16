using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class JournalEntry
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    public DateOnly Date { get; set; }

    [MaxLength(50)]
    public string? ReferenceNumber { get; set; }

    [MaxLength(200)]
    public string? Tags { get; set; }

    [MaxLength(100)]
    public string? IdempotencyKey { get; set; }

    [MaxLength(100)]
    public string? ContactId { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    public string? Notes { get; set; }

    public Guid? ProjectId { get; set; }
    [System.ComponentModel.DataAnnotations.Schema.ForeignKey("ProjectId")]
    public Project? Project { get; set; }


    // Navigation Property
    public List<JournalLine> Lines { get; set; } = new();

    // Audit & Segregation of Duties (SoD) Fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Guid? CreatedByUserId { get; set; }
    [MaxLength(100)]
    public string? CreatedBy { get; set; } // Email / username of the creator

    public Guid? ApprovedByUserId { get; set; }
    [MaxLength(100)]
    public string? ApprovedBy { get; set; } // Email / username of the approver
    public DateTime? ApprovedAt { get; set; }

    [MaxLength(500)]
    public string? RejectionReason { get; set; }
    [MaxLength(100)]
    public string? RejectedBy { get; set; }
    public DateTime? RejectedAt { get; set; }

    public JournalEntryStatus Status { get; set; } = JournalEntryStatus.Draft;

    public bool IsAdjustingEntry { get; set; } = false;
}

public enum JournalEntryStatus
{
    Draft,
    Posted,
    Void
}
