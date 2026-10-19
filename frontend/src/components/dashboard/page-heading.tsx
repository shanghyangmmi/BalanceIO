import { cn } from "@/lib/utils"

/**
 * The head of a working screen: a list, a form, a settings page.
 *
 * Quieter sibling of ModuleMasthead. Module overviews earn the italic
 * gradient accent; working screens do not, or every page shouts and the
 * accent stops meaning "this is the front door" (DESIGN-SYSTEM.md §3).
 */
export function PageHeading({
  eyebrow,
  title,
  lede,
  actions,
  className,
}: {
  /** Mono label naming the area, e.g. "Settings". */
  eyebrow?: string
  title: string
  lede?: React.ReactNode
  /** Right-aligned controls: the page's primary action. */
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("space-y-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-3">
          {eyebrow && (
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-foreground">
            {title}
          </h1>
          {lede && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{lede}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="h-px bg-foreground/10" />
    </header>
  )
}
