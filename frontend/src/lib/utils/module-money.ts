import { formatCurrency } from "@/lib/utils/formatter"

/**
 * Money on a module surface.
 *
 * IDR is conventionally written without sen, and the app-wide
 * `formatCurrency` rounds to whole rupiah accordingly. That is wrong here:
 * a ledger out of balance by cents would print two identical figures under
 * a headline saying they disagree, which is precisely the misread-figure
 * failure the design system exists to prevent.
 *
 * So: whole rupiah when the value is whole, and the stored precision (the
 * column is decimal(19,4)) the moment there is a fraction to show.
 *
 * Shared by the hub card and the module dashboards on purpose — two screens
 * rounding the same figure differently is the same bug in slower motion.
 */
export function formatModuleMoney(value: number, currency: string) {
  if (Number.isInteger(value)) return formatCurrency(value, currency)

  return new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}
