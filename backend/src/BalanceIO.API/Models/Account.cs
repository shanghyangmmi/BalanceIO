using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

public class Account
{
    public Guid Id { get; set; }

    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Type { get; set; } = string.Empty; // Asset, Liability, Equity, Revenue, Expense

    // --- CoA Hierarchy ---
    
    /// <summary>Account group for classification (Asset, Liability, Equity, Sales, CostOfSales, Expense, OtherIncomeExpense)</summary>
    [Required]
    [MaxLength(30)]
    public string AccountGroup { get; set; } = string.Empty;

    /// <summary>Hierarchy depth (1=root group, up to 5)</summary>
    public int Level { get; set; } = 1;

    /// <summary>True for group/parent accounts that contain sub-accounts</summary>
    public bool IsHeader { get; set; } = false;

    /// <summary>Normal balance side: "Debit" or "Credit"</summary>
    [MaxLength(10)]
    public string NormalBalance { get; set; } = "Debit";

    /// <summary>
    /// The account's name in Bahasa Indonesia, for bilingual statements.
    /// <see cref="Name"/> is the English name. Null falls back to Name.
    /// </summary>
    [MaxLength(100)]
    public string? NameId { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>True if seeded from default template (protected from deletion)</summary>
    public bool IsSystemDefault { get; set; } = false;

    // --- Balance & Parent ---

    [Column(TypeName = "decimal(19,4)")]
    public decimal CurrentBalance { get; set; } = 0;

    public Guid? ParentAccountId { get; set; }
    
    // Navigation
    [ForeignKey("ParentAccountId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Account? ParentAccount { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public ICollection<Account> Children { get; set; } = new List<Account>();
    
    // ── Tax classification ────────────────────────────────────────
    // Both of these are the accountant's judgement, recorded once on the
    // account and then used by every tax report. The product does the
    // arithmetic; it does not decide the treatment.

    /// <summary>
    /// Interest-bearing debt for the purposes of PMK-169/PMK.010/2015.
    ///
    /// The DER ratio counts borrowings, not every liability — trade
    /// payables, VAT out and tax payable are not debt. Computing the ratio
    /// over all liabilities would overstate it and disallow interest that
    /// is perfectly deductible.
    /// </summary>
    public bool IsInterestBearingDebt { get; set; } = false;

    /// <summary>
    /// How this account is treated in the rekonsiliasi fiskal:
    /// "positive" adds the balance back to commercial profit (a
    /// non-deductible cost), "negative" takes it out (income already taxed
    /// finally, or a non-taxable receipt). Null is no correction.
    ///
    /// Deliberately never defaulted to a guess. Whether entertainment,
    /// natura or a donation is deductible turns on documentation and
    /// circumstance, and a product that assumed would be handing its user
    /// a correction they did not make.
    /// </summary>
    [MaxLength(10)]
    public string? FiscalCorrection { get; set; }

    public bool IsActive { get; set; } = true;

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
