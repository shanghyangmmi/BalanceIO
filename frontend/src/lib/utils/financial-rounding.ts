/**
 * Centralized Financial Rounding Policy Engine — Frontend Edition.
 * Enforces Banker's Rounding (MidpointRounding.ToEven) per IEEE 754 / ISO 31-0 / Big 4 Accounting Standards
 * to eliminate statistical rounding bias across Tax (PPN 12%), Withholding (PPh), Discounts, and FX.
 */

export function bankersRound(num: number, decimalPlaces: number = 2): number {
  const d = Math.pow(10, decimalPlaces);
  const n = +(d * num).toFixed(8);
  const i = Math.floor(n);
  const f = n - i;
  const e = 1e-8;
  const r = (f > 0.5 - e && f < 0.5 + e) ? ((i % 2 === 0) ? i : i + 1) : Math.round(n);
  return r / d;
}

export function calculateTax(baseAmount: number, taxRatePercentage: number): number {
  return bankersRound(baseAmount * (taxRatePercentage / 100), 2);
}

export function calculateDiscount(baseAmount: number, discountPercentage: number): number {
  return bankersRound(baseAmount * (discountPercentage / 100), 2);
}

export function roundFxRate(rate: number): number {
  return bankersRound(rate, 6);
}
