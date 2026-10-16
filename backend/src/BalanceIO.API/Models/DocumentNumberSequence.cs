using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

/// <summary>
/// Document number sequence for auto-generating document numbers.
/// </summary>
public class DocumentNumberSequence
{
    public Guid Id { get; set; }

    [Required]
    public DocumentType DocumentType { get; set; }

    [Required]
    [MaxLength(20)]
    public string Prefix { get; set; } = string.Empty; // e.g., "INV", "PO", "BILL"

    [MaxLength(20)]
    public string? Suffix { get; set; }

    [Required]
    public int NextNumber { get; set; } = 1;

    public int NumberLength { get; set; } = 4; // Pad with zeros

    public bool IncludeYear { get; set; } = true;
    public bool IncludeMonth { get; set; } = false;

    [MaxLength(10)]
    public string Separator { get; set; } = "-"; // e.g., "INV-2026-0001"

    public bool ResetYearly { get; set; } = true;
    public bool ResetMonthly { get; set; } = false;

    public int LastResetYear { get; set; } = DateTime.UtcNow.Year;
    public int LastResetMonth { get; set; } = DateTime.UtcNow.Month;

    // Audit
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>
    /// Generate the next document number and increment the sequence.
    /// </summary>
    public string GenerateNextNumber()
    {
        var now = DateTime.UtcNow;

        // Check if reset is needed
        if (ResetYearly && now.Year != LastResetYear)
        {
            NextNumber = 1;
            LastResetYear = now.Year;
            LastResetMonth = now.Month;
        }
        else if (ResetMonthly && (now.Year != LastResetYear || now.Month != LastResetMonth))
        {
            NextNumber = 1;
            LastResetYear = now.Year;
            LastResetMonth = now.Month;
        }

        var parts = new List<string> { Prefix };

        if (IncludeYear)
            parts.Add(now.Year.ToString());

        if (IncludeMonth)
            parts.Add(now.Month.ToString("D2"));

        parts.Add(NextNumber.ToString().PadLeft(NumberLength, '0'));

        if (!string.IsNullOrEmpty(Suffix))
            parts.Add(Suffix);

        var number = string.Join(Separator, parts);

        NextNumber++;
        UpdatedAt = DateTime.UtcNow;

        return number;
    }
}
