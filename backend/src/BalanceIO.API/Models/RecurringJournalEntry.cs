using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class RecurringJournalEntry
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(200)]
    public string Description { get; set; } = string.Empty;

    [Required]
    public RecurringFrequency Frequency { get; set; } = RecurringFrequency.Monthly;

    public DateTime NextRunDate { get; set; }

    public DateTime? EndDate { get; set; }

    public DateTime? LastPostedDate { get; set; }

    [MaxLength(50)]
    public string Reference { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Amount { get; set; }

    // Storing lines as JSON simplicity for now or relation?
    // Let's use relation for proper data integrity, consistent with JournalEntry
    public ICollection<RecurringJournalEntryLine> Lines { get; set; } = new List<RecurringJournalEntryLine>();

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class RecurringJournalEntryLine
{
    public Guid Id { get; set; }
    public Guid RecurringJournalEntryId { get; set; }

    [ForeignKey("RecurringJournalEntryId")]
    public RecurringJournalEntry RecurringJournalEntry { get; set; } = null!;

    public Guid AccountId { get; set; }

    [ForeignKey("AccountId")]
    public Account Account { get; set; } = null!;

    [MaxLength(200)]
    public string? Description { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Debit { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Credit { get; set; }
}

public enum RecurringFrequency
{
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly
}
