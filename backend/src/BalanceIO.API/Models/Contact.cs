using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Contact entity representing Customers, Vendors, or both.
/// </summary>
public class Contact
{
    public Guid Id { get; set; }
    
    // Multi-Tenancy
    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    [Required]
    [MaxLength(10)]
    public string Code { get; set; } = string.Empty; // e.g., "C-0001", "V-0001"

    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? DisplayName { get; set; } // Short name for display

    [Required]
    public ContactType Type { get; set; } = ContactType.Customer;

    [Required]
    public ContactCategory Category { get; set; } = ContactCategory.Individual;

    [Required]
    public ContactScope Scope { get; set; } = ContactScope.Local;

    // Contact Info
    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(30)]
    public string? Mobile { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? City { get; set; }

    [MaxLength(20)]
    public string? PostalCode { get; set; }

    [MaxLength(100)]
    public string? Country { get; set; } = "Indonesia";

    // Tax Info
    [MaxLength(30)]
    public string? TaxId { get; set; } // NPWP

    [MaxLength(100)]
    public string? TaxName { get; set; } // Name on tax document

    // Financial
    [Column(TypeName = "decimal(19,4)")]
    public decimal CreditLimit { get; set; } = 0;

    public int PaymentTermDays { get; set; } = 30;

    [MaxLength(3)]
    public string DefaultCurrency { get; set; } = "IDR";

    // Additive Contact Roles (Blueprint Roadmap Item 2)
    public bool IsCustomer { get; set; } = true;
    public bool IsVendor { get; set; } = false;
    public bool IsEmployee { get; set; } = false;
    public bool IsTaxParty { get; set; } = false;

    // Employee Attributes (Unblocks Payroll & PPh 21)
    [MaxLength(16)]
    public string? Nik { get; set; } // Nomor Induk Kependudukan (16 digits)

    [MaxLength(10)]
    public string? PtkpStatus { get; set; } // e.g. TK/0, K/1, etc.

    [MaxLength(50)]
    public string? BpjsKetenagakerjaanNumber { get; set; }

    [MaxLength(50)]
    public string? BpjsKesehatanNumber { get; set; }

    [MaxLength(50)]
    public string? BankName { get; set; }

    [MaxLength(50)]
    public string? BankAccountNumber { get; set; }

    [MaxLength(100)]
    public string? BankAccountHolder { get; set; }

    // Vendor / Withholding Profile Attributes (Unblocks PPh 23 / 4(2) Reconciliations)
    [MaxLength(50)]
    public string? WithholdingType { get; set; } // PPh 23, PPh 4(2), etc.

    [Column(TypeName = "decimal(5,2)")]
    public decimal WithholdingRate { get; set; } = 0;

    public bool HasWithholdingExemption { get; set; } = false; // SKB
    public DateOnly? ExemptionExpiryDate { get; set; }

    // Tax Party Attributes
    public bool IsPkp { get; set; } = false;
    public DateOnly? PkpDate { get; set; }

    // Default Accounts (for auto-journal)
    public Guid? DefaultReceivableAccountId { get; set; }
    public Guid? DefaultPayableAccountId { get; set; }

    // Navigation
    [ForeignKey("DefaultReceivableAccountId")]
    public Account? DefaultReceivableAccount { get; set; }

    [ForeignKey("DefaultPayableAccountId")]
    public Account? DefaultPayableAccount { get; set; }

    // Status
    public bool IsActive { get; set; } = true;

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public enum ContactType
{
    Customer,
    Vendor,
    Both
}

public enum ContactCategory
{
    Individual,
    Corporate,
    Government
}

public enum ContactScope
{
    Local,
    Foreign
}
