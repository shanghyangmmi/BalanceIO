namespace BalanceIO.API.Services;

/// <summary>
/// Centralized Financial Rounding Policy Engine.
/// Enforces Banker's Rounding (MidpointRounding.ToEven) per IEEE 754 / ISO 31-0 / Big 4 Accounting Standards
/// to eliminate statistical rounding bias across Tax (PPN 12%), Withholding (PPh), Discounts, and FX rates.
/// </summary>
public static class FinancialRoundingPolicy
{
    public const int DefaultCurrencyDecimals = 2;
    public const int DefaultTaxDecimals = 2;
    public const int DefaultFxRateDecimals = 6;

    /// <summary>
    /// Round a financial amount to specified decimals using Banker's Rounding (ToEven).
    /// </summary>
    public static decimal RoundCurrency(decimal amount, int decimals = DefaultCurrencyDecimals)
    {
        return Math.Round(amount, decimals, MidpointRounding.ToEven);
    }

    /// <summary>
    /// Calculate Tax (e.g. PPN 12%) with Banker's Rounding.
    /// </summary>
    public static decimal CalculateTax(decimal baseAmount, decimal taxRatePercentage, int decimals = DefaultTaxDecimals)
    {
        decimal rawTax = baseAmount * (taxRatePercentage / 100m);
        return Math.Round(rawTax, decimals, MidpointRounding.ToEven);
    }

    /// <summary>
    /// Calculate Line Item Discount Amount with Banker's Rounding.
    /// </summary>
    public static decimal CalculateDiscount(decimal baseAmount, decimal discountPercentage, int decimals = DefaultCurrencyDecimals)
    {
        decimal rawDiscount = baseAmount * (discountPercentage / 100m);
        return Math.Round(rawDiscount, decimals, MidpointRounding.ToEven);
    }

    /// <summary>
    /// Round Foreign Exchange (FX) rates using 6-decimal precision Banker's Rounding.
    /// </summary>
    public static decimal RoundFxRate(decimal fxRate)
    {
        return Math.Round(fxRate, DefaultFxRateDecimals, MidpointRounding.ToEven);
    }
}
