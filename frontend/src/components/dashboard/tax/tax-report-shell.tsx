"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * The frame every tax report sits in: the trail back to the module, the
 * display heading, the one-line verdict, the year picker and the rules
 * between them.
 *
 * Extracted at the third report. Ekualisasi, the fiscal reconciliation and
 * the debt-to-equity test would otherwise have been three copies of the
 * same header, and the first spacing change would have left them looking
 * like three products.
 */

export type Verdict = "clean" | "attention" | "neutral"

export function TaxReportShell({
  title,
  accent,
  lede,
  verdict,
  verdictLabel,
  isPending,
  isError,
  errorMessage,
  onRetry,
  years,
  activeYear,
  onYear,
  children,
}: {
  title: string
  /** The one italic gradient span, per DESIGN-SYSTEM.md §3. */
  accent: string
  lede: string
  verdict?: Verdict
  verdictLabel?: string
  isPending: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
  years?: number[]
  activeYear?: number
  onYear?: (year: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 space-y-8">
      <header className="space-y-5">
        <Link
          href="/dashboard/tax"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" strokeWidth={2} />
          Tax
        </Link>

        <div className="space-y-4">
          <h1 className="font-display max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
            {title}{" "}
            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
              {accent}
            </span>
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{lede}</p>
        </div>

        <div className="h-px bg-foreground/10" />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {isPending ? (
            <Skeleton className="h-4 w-56" />
          ) : isError ? (
            <span className="text-sm text-muted-foreground">Could not read the report.</span>
          ) : verdictLabel ? (
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  verdict === "clean" && "bg-emerald-600 dark:bg-emerald-400",
                  verdict === "attention" && "bg-amber-600 dark:bg-amber-400",
                  verdict === "neutral" && "bg-muted-foreground/50",
                )}
              />
              <span className="text-sm font-medium text-foreground">{verdictLabel}</span>
            </div>
          ) : (
            <span />
          )}

          {years && years.length > 0 && onYear && (
            <div className="flex flex-wrap items-center gap-1.5">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => onYear(y)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                    y === activeYear
                      ? "border-emerald-600/30 bg-emerald-500/[0.08] text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400"
                      : "border-foreground/10 text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-foreground/10" />
      </header>

      {isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6">
          <p className="text-sm font-medium text-foreground">The report is unavailable.</p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {errorMessage ?? "The request did not complete."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="mt-4 h-8 rounded-full border-foreground/10 px-3 text-xs"
          >
            Try again
          </Button>
        </div>
      ) : (
        children
      )}
    </div>
  )
}

/** A ruled row in a statement-style block: label left, figure right. */
export function StatementRow({
  label,
  value,
  muted,
  tone,
  strong,
  indent,
  note,
}: {
  label: string
  value: string
  muted?: boolean
  tone?: string
  strong?: boolean
  indent?: boolean
  note?: string
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-6 border-b border-foreground/[0.07] py-3 last:border-b-0",
        strong && "border-b-0 border-t-2 border-t-foreground/20 pt-3.5 font-medium",
      )}
    >
      <div className={cn("min-w-0", indent && "pl-5")}>
        <div className={cn("text-sm", muted ? "text-muted-foreground" : "text-foreground")}>
          {label}
        </div>
        {note && (
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {note}
          </div>
        )}
      </div>
      <div className={cn("font-money shrink-0 text-sm tabular-nums text-foreground", tone)}>
        {value}
      </div>
    </div>
  )
}
