using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Company profile and settings
/// </summary>
public class Company
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Industry { get; set; }

    [Required]
    [MaxLength(3)]
    public string Currency { get; set; } = "IDR";

    [MaxLength(200)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; } = "Jakarta";

    [MaxLength(100)]
    public string? Country { get; set; } = "Indonesia";

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    [EmailAddress]
    public string? Email { get; set; }

    [MaxLength(50)]
    public string? TaxId { get; set; } // NPWP

    // Statutory Tax / PKP Settings
    public bool IsPkp { get; set; } = true;
    
    [MaxLength(50)]
    public string? PkpNumber { get; set; }
    
    public DateOnly? PkpDate { get; set; }
    
    [MaxLength(150)]
    public string? TaxOffice { get; set; } = "KPP Pratama"; // e.g. KPP Pratama Jakarta Kebayoran Baru

    [MaxLength(500)]
    public string? LogoUrl { get; set; }

    // Fiscal & Internal Control settings
    public int FiscalYearStartMonth { get; set; } = 1; // January
    public DateOnly? LockDate { get; set; } // Transactions before or on this date cannot be modified

    // Segregation of Duties (SoD) Internal Controls
    public bool EnforceSegregationOfDuties { get; set; } = true;

    [Column(TypeName = "decimal(19,4)")]
    public decimal? ApprovalThresholdAmount { get; set; } // Optional threshold where dual-approval is strictly required (e.g. 50,000,000 IDR)

    // Status
    public bool IsOnboarded { get; set; } = false;

    // Audit fields
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // ── Suspension ────────────────────────────────────────────────────
    // A suspended company keeps every row it owns. Nothing is deleted and
    // nothing is anonymised: the books have to survive a billing dispute,
    // and a hard delete of a company would leave journal entries pointing at
    // an author who no longer exists.

    public bool IsSuspended { get; set; } = false;

    public DateTime? SuspendedAt { get; set; }

    [MaxLength(300)]
    public string? SuspensionReason { get; set; }
}
