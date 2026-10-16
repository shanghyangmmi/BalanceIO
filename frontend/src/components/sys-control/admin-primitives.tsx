"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The parts every sys-control screen is built from.
 *
 * The panel had drifted into a different product from the one it
 * administers: gradient-filled headings, drop shadows on in-flow cards,
 * `text-3xl font-bold` where the rest of the application uses a display
 * serif. It is the same product and the same people, so it gets the same
 * language — hairlines and tonal shifts, Merriweather for the headline
 * with a single italic gradient span, Geist Mono for labels and codes.
 *
 * One deliberate difference: red is reserved here. In the application red
 * means overdue or void. In this panel it means "this reaches every
 * tenant", and it appears only on the controls that do.
 */

/** The dot between facts in a footnote line. */
export function Sep() {
  return <span className="mx-2 text-muted-foreground/40">·</span>
}

export function Masthead({
  title,
  accent,
  lede,
  actions,
}: {
  title: string
  accent: string
  lede: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-foreground/10 pb-6">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-normal leading-tight tracking-tight text-foreground sm:text-3xl">
          {title}{" "}
          {/* box-decoration-clone is not optional: without it a wrapped
              gradient span clips its ascenders on every line but the last. */}
          <span className="box-decoration-clone bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text pb-[0.08em] pr-[0.14em] italic text-transparent dark:from-emerald-400 dark:to-cyan-400">
            {accent}
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {lede}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function SectionHeading({
  children,
  note,
}: {
  children: React.ReactNode
  note?: React.ReactNode
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

/** A hairline card. No shadow: this sits in the flow. */
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * A panel for controls that reach every tenant. The border is the warning;
 * there is no icon and no capitalised shouting.
 */
export function DangerPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-red-500/25 bg-red-500/[0.03] backdrop-blur-sm dark:border-red-400/25",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Figure({
  label,
  value,
  tone,
  note,
  pending,
}: {
  label: string
  value: React.ReactNode
  tone?: string
  note?: React.ReactNode
  pending?: boolean
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      {pending ? (
        <Skeleton className="mt-2.5 h-6 w-28" />
      ) : (
        <div className={cn("font-money mt-2 text-xl text-foreground sm:text-2xl", tone)}>
          {value}
        </div>
      )}
      {note && (
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {note}
        </div>
      )}
    </div>
  )
}

/** A strip of figures divided by hairlines rather than gaps. */
export function FigureStrip({ children }: { children: React.ReactNode }) {
  return (
    <Panel className="overflow-hidden">
      <div className="grid divide-y divide-foreground/10 sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:[&>*:nth-child(-n+4)]:border-t-0 sm:[&>*:nth-child(-n+2)]:border-t-0 [&>*:first-child]:border-t-0">
        {children}
      </div>
    </Panel>
  )
}

/**
 * A horizontal usage bar.
 *
 * Amber past three quarters and red at the ceiling, matching the
 * application's colour roles: amber is "out of balance", red is a hard
 * stop. Neither is decorative.
 */
export function Meter({
  used,
  max,
  label,
  unit,
}: {
  used: number
  max: number
  label: string
  unit?: string
}) {
  const unlimited = max <= 0
  const ratio = unlimited ? 0 : Math.min(1, used / max)
  const percent = Math.round(ratio * 100)

  const tone = unlimited
    ? "bg-foreground/20"
    : ratio >= 1
      ? "bg-red-500 dark:bg-red-400"
      : ratio >= 0.75
        ? "bg-amber-500 dark:bg-amber-400"
        : "bg-emerald-600 dark:bg-emerald-400"

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="font-money text-[13px] tabular-nums text-foreground">
          {used.toLocaleString("en-GB")}
          {unlimited ? (
            <span className="text-muted-foreground"> / no limit</span>
          ) : (
            <span className="text-muted-foreground">
              {" "}
              / {max.toLocaleString("en-GB")}
              {unit ? ` ${unit}` : ""}
            </span>
          )}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.07]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", tone)}
          style={{ width: unlimited ? "0%" : `${Math.max(percent, used > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  )
}

export type StatusTone = "good" | "warn" | "bad" | "idle"

export function StatusDot({ tone }: { tone: StatusTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
        tone === "good" && "bg-emerald-600 dark:bg-emerald-400",
        tone === "warn" && "bg-amber-500 dark:bg-amber-400",
        tone === "bad" && "bg-red-500 dark:bg-red-400",
        tone === "idle" && "bg-foreground/25",
      )}
    />
  )
}

export function Pill({
  tone = "idle",
  children,
}: {
  tone?: StatusTone
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
        tone === "good" && "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
        tone === "warn" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        tone === "bad" && "bg-red-500/10 text-red-700 dark:text-red-400",
        tone === "idle" && "bg-foreground/[0.06] text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

/**
 * What a screen shows when there is nothing to show. Says what would put
 * something here, because "No data" leaves the reader to guess whether
 * that is a state or a failure.
 */
export function Empty({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] px-6 py-10 text-center">
      <p className="text-sm text-foreground">{title}</p>
      {children && (
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
    </div>
  )
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] px-5 py-4">
      <p className="text-[13px] leading-relaxed text-foreground">
        {message || "That request did not come back."}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
        >
          Try again
        </button>
      )}
    </div>
  )
}

/** A table that scrolls inside itself rather than pushing the page wide. */
export function TableShell({
  head,
  children,
  minWidth = "48rem",
}: {
  head: React.ReactNode
  children: React.ReactNode
  minWidth?: string
}) {
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-foreground/10">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </Panel>
  )
}

export function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode
  align?: "left" | "right" | "center"
}) {
  return (
    <th
      className={cn(
        "px-5 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground",
        align === "left" && "text-left",
        align === "right" && "text-right",
        align === "center" && "text-center",
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = "left",
  className,
  mono,
}: {
  children?: React.ReactNode
  align?: "left" | "right" | "center"
  className?: string
  mono?: boolean
}) {
  return (
    <td
      className={cn(
        "px-5 py-3 align-middle text-foreground",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        mono && "font-mono text-[11px] text-muted-foreground",
        className,
      )}
    >
      {children}
    </td>
  )
}

export function Row({
  children,
  index,
  muted,
}: {
  children: React.ReactNode
  index: number
  muted?: boolean
}) {
  return (
    <tr
      className={cn(
        index > 0 && "border-t border-foreground/10",
        muted && "text-muted-foreground",
      )}
    >
      {children}
    </tr>
  )
}

/** Rupiah, or whatever the platform is priced in. */
export function money(value: number, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function relativeTime(iso?: string | null) {
  if (!iso) return "never"

  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "unknown"

  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 0) return "scheduled"
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

export function duration(seconds: number) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function bytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`
  return `${(value / 1024).toFixed(1)} KB`
}
