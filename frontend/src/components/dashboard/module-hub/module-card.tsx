"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  BookOpenCheck,
  Boxes,
  Building2,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING, EASE_HOUSE } from "@/lib/motion"
import { formatModuleMoney } from "@/lib/utils/module-money"
import type { ModuleFigure, ModuleHealth, ModuleStatus } from "@/hooks/use-module-health"

/**
 * Colour carries meaning on this card; it is not decoration.
 *
 * Light and dark take different stops of the same hue, per
 * DESIGN-SYSTEM.md §2 — a stop that passes contrast on porcelain does
 * not pass on ink.
 */
const STATUS: Record<
  ModuleStatus,
  { label: string; text: string; dot: string; rule: string; glow: string }
> = {
  balanced: {
    label: "In sync",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-600 dark:bg-emerald-400",
    rule: "bg-emerald-600/70 dark:bg-emerald-400/70",
    glow: "bg-emerald-500/[0.06]",
  },
  attention: {
    label: "Review required",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-600 dark:bg-amber-400",
    rule: "bg-amber-600/70 dark:bg-amber-400/70",
    glow: "bg-amber-500/[0.06]",
  },
  overdue: {
    label: "Overdue",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-600 dark:bg-red-400",
    rule: "bg-red-600/70 dark:bg-red-400/70",
    glow: "bg-red-500/[0.07]",
  },
  inactive: {
    label: "No activity",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground/50",
    rule: "bg-foreground/15",
    glow: "bg-transparent",
  },
}

const ICONS: Record<ModuleHealth["key"], LucideIcon> = {
  accounting: BookOpenCheck,
  tax: Receipt,
  inventory: Boxes,
  fixedAssets: Building2,
  payroll: Users,
}

/** What each module has to be true for. Reads as the product's argument. */
const PREMISE: Record<ModuleHealth["key"], string> = {
  accounting: "Dr = Cr, nothing unposted, period closed",
  tax: "PPN keluaran and masukan reconciled",
  inventory: "Book quantity matches the last opname",
  fixedAssets: "Depreciation posted through the period",
  payroll: "Staff paid, PPh 21 accrued",
}

function figureText(figure: ModuleFigure) {
  switch (figure.format) {
    case "money":
      return formatModuleMoney(figure.value, figure.currency ?? "IDR")
    case "days":
      return `${figure.value} d`
    case "date":
      return figure.isoDate ?? String(figure.value)
    default:
      return new Intl.NumberFormat("id-ID").format(figure.value)
  }
}

export function ModuleCard({ module, index }: { module: ModuleHealth; index: number }) {
  const reduce = useReducedMotion()
  const tone = STATUS[module.status]
  const Icon = ICONS[module.key]
  const isLink = module.implemented && Boolean(module.href)

  const body = (
    <>
      {/* Ambient tint, not a shadow. Large radius, very low alpha. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-[100px]",
          tone.glow,
        )}
      />

      {/* The drawn rule — the ledger gesture, scaled in from origin-left.
          This is the card's status, read before any text. */}
      <motion.div
        aria-hidden
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.7, ease: EASE_HOUSE, delay: 0.1 + index * 0.06 }}
        className={cn("absolute inset-x-0 top-0 h-px origin-left", tone.rule)}
      />

      <div className="relative flex h-full flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-3.5 w-3.5 shrink-0", tone.text)} strokeWidth={1.75} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {module.name}
              </span>
            </div>
            <p className="mt-2.5 text-base font-semibold leading-snug text-foreground sm:text-lg">
              {module.headline}
            </p>
          </div>

          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-0.5",
              "font-mono text-[10px] uppercase tracking-[0.16em]",
              tone.text,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
            {tone.label}
          </span>
        </div>

        {module.figures.length > 0 && (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {module.figures.map((figure) => (
              <div key={figure.label} className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {figure.label}
                </div>
                <div
                  className={cn(
                    "font-money mt-1.5 text-lg text-foreground sm:text-xl",
                    module.status === "inactive" && "text-muted-foreground",
                  )}
                >
                  {figureText(figure)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto space-y-3 pt-1">
          <div className="h-px bg-foreground/10" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {module.detail ?? PREMISE[module.key]}
          </p>
        </div>
      </div>
    </>
  )

  const surface = cn(
    "group relative flex h-full flex-col overflow-hidden rounded-xl",
    "border border-foreground/10 bg-card/60 backdrop-blur-sm",
    "transition-colors duration-300",
    isLink && "hover:border-foreground/20 hover:bg-card/80",
    !isLink && "opacity-70",
  )

  const card = isLink ? (
    <Link href={module.href!} className={cn(surface, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}>
      {body}
    </Link>
  ) : (
    // Payroll is not built, so it is not a door. Saying so is more honest
    // than a card that navigates nowhere.
    <div className={surface} aria-disabled="true">
      {body}
    </div>
  )

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 16 },
        show: { opacity: 1, y: 0, transition: SPRING.medium },
      }}
      whileHover={isLink && !reduce ? { y: -3, transition: SPRING.snappy } : undefined}
      className="h-full"
    >
      {card}
    </motion.div>
  )
}

export function ModuleCardSkeleton() {
  // Same hairline structure and height as the real card, so the swap does
  // not shift the layout.
  return (
    <div className="h-full min-h-[15rem] overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
      <div className="h-px bg-foreground/10" />
      <div className="flex h-full animate-pulse flex-col gap-5 p-5 sm:p-6">
        <div className="h-2 w-24 rounded bg-foreground/10" />
        <div className="h-5 w-3/5 rounded bg-foreground/10" />
        <div className="flex gap-10">
          <div className="space-y-2">
            <div className="h-2 w-16 rounded bg-foreground/10" />
            <div className="h-5 w-24 rounded bg-foreground/10" />
          </div>
          <div className="space-y-2">
            <div className="h-2 w-16 rounded bg-foreground/10" />
            <div className="h-5 w-20 rounded bg-foreground/10" />
          </div>
        </div>
        <div className="mt-auto space-y-3">
          <div className="h-px bg-foreground/10" />
          <div className="h-2 w-4/5 rounded bg-foreground/10" />
        </div>
      </div>
    </div>
  )
}

export { STATUS as MODULE_STATUS_TONE }
