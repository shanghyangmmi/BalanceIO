namespace BalanceIO.API.Services;

/// <summary>
/// Helper for Indonesian DJP Nomor Seri Faktur Pajak (NSFP) allocation and formatting.
/// Standard NSFP structure (16 digits):
///   - 3 digits transaction code (e.g. 010)
///   - 3 digits branch/replacement (e.g. 000)
///   - 2 digits tax year (e.g. 26 for 2026)
///   - 8 digits sequential number (e.g. 00000001)
/// Formatted: 010.000-26.00000001
/// </summary>
public static class NsfpHelper
{
    public static string Normalize(string? nsfp) =>
        (nsfp ?? string.Empty).Replace(".", string.Empty).Replace("-", string.Empty).Trim();

    public static string Format(string? raw16)
    {
        var raw = Normalize(raw16);
        if (raw.Length != 16) return raw16 ?? string.Empty;
        return $"{raw[..3]}.{raw.Substring(3, 3)}-{raw.Substring(6, 2)}.{raw.Substring(8, 8)}";
    }

    public static (string NextNumber, bool IsExhausted, long Remaining) AllocateNext(string? current, string start, string end)
    {
        var startNorm = Normalize(start);
        var endNorm = Normalize(end);
        var curNorm = string.IsNullOrWhiteSpace(current) ? string.Empty : Normalize(current);

        if (startNorm.Length < 16 || endNorm.Length < 16)
        {
            throw new InvalidOperationException("NSFP range numbers must be 16 digits.");
        }

        var prefix = startNorm[..8];
        long startSeq = long.Parse(startNorm.Substring(8, 8));
        long endSeq = long.Parse(endNorm.Substring(8, 8));

        long nextSeq;
        if (string.IsNullOrWhiteSpace(curNorm))
        {
            nextSeq = startSeq;
        }
        else
        {
            long curSeq = long.Parse(curNorm.Substring(8, 8));
            nextSeq = curSeq + 1;
        }

        if (nextSeq > endSeq)
        {
            return (endNorm, true, 0);
        }

        var nextNumber = $"{prefix}{nextSeq:D8}";
        var isExhausted = nextSeq >= endSeq;
        var remaining = Math.Max(0, endSeq - nextSeq);

        return (nextNumber, isExhausted, remaining);
    }
}
