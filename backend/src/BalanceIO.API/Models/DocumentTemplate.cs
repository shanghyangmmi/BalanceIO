using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

/// <summary>
/// Document template configuration for customizable document designs.
/// </summary>
public class DocumentTemplate
{
    public Guid Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty; // e.g., "classic", "modern", "minimal"

    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty; // e.g., "Classic Template"

    [Required]
    public DocumentType DocumentType { get; set; } = DocumentType.SalesInvoice;

    [MaxLength(500)]
    public string? Description { get; set; }

    // Template Content (HTML/CSS)
    public string? HeaderHtml { get; set; }
    public string? BodyHtml { get; set; }
    public string? FooterHtml { get; set; }
    public string? CustomCss { get; set; }

    // Company Branding Defaults
    [MaxLength(500)]
    public string? LogoUrl { get; set; }

    [MaxLength(50)]
    public string PrimaryColor { get; set; } = "#0B3C3D";

    [MaxLength(50)]
    public string SecondaryColor { get; set; } = "#10B981";

    [MaxLength(100)]
    public string FontFamily { get; set; } = "Inter, sans-serif";

    // Paper Settings
    [MaxLength(20)]
    public string PaperSize { get; set; } = "A4"; // A4, Letter, etc.

    [MaxLength(20)]
    public string Orientation { get; set; } = "portrait"; // portrait, landscape

    // Flags
    public bool IsDefault { get; set; } = false;
    public bool IsSystemTemplate { get; set; } = true; // System templates can't be deleted

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public enum DocumentType
{
    SalesInvoice,
    SalesOrder,
    Receipt,
    CreditNote,
    PurchaseOrder,
    PurchaseBill,
    DebitNote,
    PaymentVoucher,
    PaymentInstruction
}
