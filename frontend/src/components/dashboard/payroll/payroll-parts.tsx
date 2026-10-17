import { cn } from "@/lib/utils"
import type { PayrollRunStatus } from "@/hooks/use-payroll"

/**
 * Posted is the ledger state (emerald), Void is withdrawn (red). A Draft is
 * neither: it has not reached the ledger, so it carries no colour of its
 * own rather than borrowing amber, which means out of balance.
 */
const RUN_STATUS: Record<PayrollRunStatus, { label: string; className: string }> = {
  Draft: {
    label: "Awaiting approval",
    className: "border-foreground/15 text-muted-foreground",
  },
  Posted: {
    label: "Posted",
    className: "border-emerald-600/30 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
  },
  Void: {
    label: "Void",
    className: "border-red-600/30 text-red-700 dark:border-red-400/30 dark:text-red-400",
  },
}

export function RunStatusBadge({ status }: { status: PayrollRunStatus }) {
  const tone = RUN_STATUS[status]
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center whitespace-nowrap rounded-full border px-2 font-mono text-[9px] uppercase tracking-[0.16em]",
        tone.className,
      )}
    >
      {tone.label}
    </span>
  )
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

/** "2.50%" for a TER rate, "Annual" for the December settlement. */
export function terLabel(rate: number | null, method: string) {
  if (method === "Annual" || rate === null) return "Annual"
  return `${rate.toFixed(2)}%`
}
