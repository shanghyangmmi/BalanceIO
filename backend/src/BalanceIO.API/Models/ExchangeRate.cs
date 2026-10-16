using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// Exchange Rate - Historical currency exchange rates
/// Stores daily rates with source tracking (BI, manual, etc.)
/// </summary>
public class ExchangeRate
{
    public Guid Id { get; set; }

    /// <summary>
    /// The date this rate applies to
    /// </summary>
    [Required]
    public DateOnly RateDate { get; set; }

    /// <summary>
    /// Source currency code (e.g., "USD", "EUR")
    /// </summary>
    [Required]
    [MaxLength(3)]
    public string FromCurrency { get; set; } = string.Empty;

    /// <summary>
    /// Target currency code (usually "IDR")
    /// </summary>
    [Required]
    [MaxLength(3)]
    public string ToCurrency { get; set; } = "IDR";

    /// <summary>
    /// Buying rate (Kurs Beli) - Bank buys from customer
    /// </summary>
    [Column(TypeName = "decimal(19,6)")]
    public decimal BuyRate { get; set; }

    /// <summary>
    /// Selling rate (Kurs Jual) - Bank sells to customer
    /// </summary>
    [Column(TypeName = "decimal(19,6)")]
    public decimal SellRate { get; set; }

    /// <summary>
    /// Middle rate (Kurs Tengah) - Used for accounting
    /// This is the primary rate used in financial transactions
    /// </summary>
    [Column(TypeName = "decimal(19,6)")]
    public decimal MiddleRate { get; set; }

    /// <summary>
    /// Type of exchange rate (Bank Indonesia JISDOR, KMK Tax, Market, Contract, Manual)
    /// </summary>
    public ExchangeRateType RateType { get; set; } = ExchangeRateType.BankIndonesia_Middle;

    /// <summary>
    /// For Kurs Pajak: Official KMK Decree Number (e.g., "KMK No. 12/KM.10/2026")
    /// </summary>
    [MaxLength(100)]
    public string? KmkNumber { get; set; }

    /// <summary>
    /// Start date of weekly KMK decree validity (Wednesday)
    /// </summary>
    public DateOnly? ValidFrom { get; set; }

    /// <summary>
    /// End date of weekly KMK decree validity (Tuesday)
    /// </summary>
    public DateOnly? ValidTo { get; set; }

    /// <summary>
    /// Explicit provenance description (e.g. "Bank Indonesia (JISDOR API)", "Kemenkeu Fiskal KMK 12/KM.10/2026", "Manual Entry")
    /// </summary>
    [MaxLength(200)]
    public string? Provenance { get; set; }

    /// <summary>
    /// Source of this exchange rate
    /// </summary>
    public ExchangeRateSource Source { get; set; } = ExchangeRateSource.Manual;

    /// <summary>
    /// Whether this rate is locked because a posted journal entry or invoice has used it
    /// </summary>
    public bool IsLockedByPostedEntry { get; set; } = false;

    /// <summary>
    /// Whether this rate is synced with official BI rate
    /// </summary>
    public bool IsSyncedWithBI { get; set; } = false;

    /// <summary>
    /// Timestamp when last synced from external source
    /// </summary>
    public DateTime? LastSyncedAt { get; set; }

    /// <summary>
    /// If manually edited, notes about the change or contract reference
    /// </summary>
    [MaxLength(500)]
    public string? Notes { get; set; }

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
}

/// <summary>
/// Fine-grained statutory classification of exchange rates
/// </summary>
public enum ExchangeRateType
{
    /// <summary>Bank Indonesia Jakarta Interbank Spot Dollar Rate (USD only)</summary>
    BankIndonesia_Jisdor = 0,

    /// <summary>Bank Indonesia official middle rate (non-USD currencies)</summary>
    BankIndonesia_Middle = 1,

    /// <summary>Kurs Pajak statutory tax rate per Keputusan Menteri Keuangan (KMK)</summary>
    KursPajak_KMK = 2,

    /// <summary>Indicative market rate from public aggregator (open.er-api.com) - estimates only</summary>
    MarketIndicative = 3,

    /// <summary>Agreed fixed contract rate between transacting parties</summary>
    ContractRate = 4,

    /// <summary>Manually entered rate by accountant</summary>
    Manual = 5
}

/// <summary>
/// Source of exchange rate data
/// </summary>
public enum ExchangeRateSource
{
    /// <summary>Bank Indonesia official rate</summary>
    BankIndonesia,
    
    /// <summary>Kurs Pajak (KMK) - Ministry of Finance tax rate</summary>
    KursPajak,
    
    /// <summary>Manually entered by user</summary>
    Manual,
    
    /// <summary>From third-party API</summary>
    ExternalAPI,
    
    /// <summary>Imported from file</summary>
    Import
}

/// <summary>
/// Currency - Supported currencies in the system
/// </summary>
public class Currency
{
    public Guid Id { get; set; }

    /// <summary>
    /// ISO 4217 Currency Code (e.g., "IDR", "USD", "EUR")
    /// </summary>
    [Required]
    [MaxLength(3)]
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Currency name (e.g., "Indonesian Rupiah", "US Dollar")
    /// </summary>
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Currency symbol (e.g., "Rp", "$", "€")
    /// </summary>
    [MaxLength(10)]
    public string Symbol { get; set; } = string.Empty;

    /// <summary>
    /// Number of decimal places for this currency
    /// </summary>
    public int DecimalPlaces { get; set; } = 2;

    /// <summary>
    /// Whether this is the base/functional currency
    /// </summary>
    public bool IsBaseCurrency { get; set; } = false;

    /// <summary>
    /// Whether this currency is active/enabled
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Display order for lists
    /// </summary>
    public int SortOrder { get; set; } = 0;
}
