import { cn } from "@/lib/utils"

/**
 * The small parts every module dashboard is built from.
 *
 * Extracted at the third module rather than the second: two copies is a
 * coincidence, four would have been four places to fix a spacing bug.
 */

/**
 * ISO date to "19 Aug 2026", split by hand rather than passed to `new
 * Date()`. An ISO date-only string parses as UTC midnight, which renders as
 * the previous day for every reader west of Greenwich — a date on a period
 * lock or a stock count is not a figure that may drift by a timezone.
 */
export function formatIsoDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d))
}

/** The dot between facts in a footnote line. */
export function Sep() {
  return <span className="mx-2 text-muted-foreground/40">·</span>
}

export function SectionHeading({
  children,
  note,
}: {
  children: string
  note?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {children}
      </h2>
      {note && (
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
          {note}
        </span>
      )}
    </div>
  )
}

/**
 * One figure in a module's headline strip.
 *
 * `tone` is a colour class and carries meaning — pass it only where the
 * value's state is what the colour is reporting.
 */
export function Figure({
  label,
  value,
  tone,
  note,
}: {
  label: string
  value: string
  tone?: string
  note?: string
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-money mt-2 text-xl text-foreground sm:text-2xl", tone)}>
        {value}
      </div>
      {note && (
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {note}
        </div>
      )}
    </div>
  )
}
