using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Tracks migration import batches for auditability and 1-click reversal.
/// </summary>
public class ImportBatch
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(50)]
    public string BatchNumber { get; set; } = string.Empty;

    [Required]
    public ImportType Type { get; set; }

    [MaxLength(255)]
    public string? FileName { get; set; }

    [Required]
    public DateOnly ConversionDate { get; set; }

    public int TotalRecords { get; set; }

    public int SuccessfulRecords { get; set; }

    public ImportBatchStatus Status { get; set; } = ImportBatchStatus.Committed;

    /// <summary>
    /// Stores JSON metadata including created JournalEntryId, ContactIds, InvoiceIds, etc., enabling clean rollback.
    /// </summary>
    public string? SummaryJson { get; set; }

    [MaxLength(100)]
    public string? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ReversedAt { get; set; }

    [MaxLength(100)]
    public string? ReversedBy { get; set; }
}

public enum ImportType
{
    OpeningBalances,
    Contacts,
    OpenInvoices,
    OpenBills,
    InventoryOpening,
    AssetsOpening
}

public enum ImportBatchStatus
{
    Committed,
    Reversed
}
