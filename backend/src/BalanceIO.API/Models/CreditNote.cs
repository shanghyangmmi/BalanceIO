using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Credit Note (CN) - Issued to customer for sales returns/adjustments
/// </summary>
public class CreditNote
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string CreditNoteNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly IssueDate { get; set; }

    [Required]
    public Guid ContactId { get; set; }
    public Contact? Contact { get; set; }

    // Link to original Sales Invoice
    public Guid? SalesInvoiceId { get; set; }
    public SalesInvoice? SalesInvoice { get; set; }

    [MaxLength(100)]
    public string? Reason { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    [Column(TypeName = "decimal(19,6)")]
    public decimal ExchangeRate { get; set; } = 1;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Subtotal { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal Total { get; set; }

    public CreditNoteStatus Status { get; set; } = CreditNoteStatus.Draft;

    public string? Notes { get; set; }

    [MaxLength(100)]
    public string TemplateName { get; set; } = "classic";

    // Journal Entry generated when posted
    public Guid? JournalEntryId { get; set; }
    public JournalEntry? JournalEntry { get; set; }

    // Navigation
    public List<CreditNoteLine> Lines { get; set; } = new();

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? PostedAt { get; set; }
    public DateTime? VoidedAt { get; set; }
}

public class CreditNoteLine
{
    public Guid Id { get; set; }

    [Required]
    public Guid CreditNoteId { get; set; }
    public CreditNote? CreditNote { get; set; }

    public int LineNumber { get; set; }

    public Guid? ProductId { get; set; }
    public Product? Product { get; set; }

    [Required]
    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Column(TypeName = "decimal(19,4)")]
    public decimal Quantity { get; set; } = 1;

    [MaxLength(20)]
    public string Unit { get; set; } = "pcs";

    [Column(TypeName = "decimal(19,4)")]
    public decimal UnitPrice { get; set; }

    public bool IsTaxable { get; set; } = true;

    [Column(TypeName = "decimal(5,2)")]
    public decimal TaxRate { get; set; } = 11;

    [Column(TypeName = "decimal(19,4)")]
    public decimal TaxAmount { get; set; }

    [Column(TypeName = "decimal(19,4)")]
    public decimal LineTotal { get; set; }

    public Guid? AccountId { get; set; }
    public Account? Account { get; set; }
}

public enum CreditNoteStatus
{
    Draft,
    Pending,
    Posted,
    Void
}
