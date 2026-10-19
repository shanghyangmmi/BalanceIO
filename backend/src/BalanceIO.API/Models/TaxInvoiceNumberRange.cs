using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BalanceIO.API.Models;

/// <summary>
/// DJP Nomor Seri Faktur Pajak (NSFP) allocated range for e-Faktur issuance.
/// Under DJP regulations (PER-03/PJ/2022 and Coretax), PKP requests ranges from DJP Online / e-Nofa.
/// </summary>
public class TaxInvoiceNumberRange
{
    public Guid Id { get; set; }

    [Required]
    public Guid CompanyId { get; set; }

    [ForeignKey("CompanyId")]
    [System.Text.Json.Serialization.JsonIgnore]
    public Company? Company { get; set; }

    /// <summary>
    /// 16-digit start NSFP (e.g. "0100002600000001" or "010.000-26.00000001")
    /// </summary>
    [Required]
    [MaxLength(30)]
    public string StartNumber { get; set; } = string.Empty;

    /// <summary>
    /// 16-digit end NSFP
    /// </summary>
    [Required]
    [MaxLength(30)]
    public string EndNumber { get; set; } = string.Empty;

    /// <summary>
    /// The last allocated number within the range, or empty/start if not yet allocated.
    /// </summary>
    [Required]
    [MaxLength(30)]
    public string CurrentNumber { get; set; } = string.Empty;

    public int Year { get; set; }

    public DateOnly AllocatedDate { get; set; }

    public bool IsExhausted { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
