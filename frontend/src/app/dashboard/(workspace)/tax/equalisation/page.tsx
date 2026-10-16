"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTaxEqualisation } from "@/hooks/use-tax-equalisation"
import {
  ModuleLocked,
  isModuleLocked,
} from "@/components/dashboard/module/module-locked"
import { SectionHeading, Sep } from "@/components/dashboard/module/module-primitives"

/**
 * Ekualisasi PPN.
 *
 * Peredaran usaha in the ledger set against the DPP reported on faktur
 * pajak, month by month. It is the first check a pemeriksa runs, and the
 * one a company would rather run on itself first.
 *
 * The two sides are read independently — the ledger side from posted
 * journal lines on the Sales accounts, the tax side from issued invoices.
 * Deriving either from the other would make the report always balance and
 * therefore say nothing.
 *
 * A difference is not an error. Non-taxable revenue, revenue booked by
 * journal without an invoice, and timing between the invoice date and the
 * posting date all produce legitimate gaps. This page shows the gap and
 * names the usual causes; deciding whether a particular one is acceptable
 * is professional judgement, not something the product asserts.
 */
export default function EqualisationPage() {
  const [year, setYear] = React.useState<number | null>(null)
  const { data, isPending, isError, error, refetch } = useTaxEqualisation(year)

  if (isError && isModuleLocked(error)) {
    return <ModuleLocked moduleName="Tax" />
  }

  const clean = data ? data.totals.monthsWithDifference === 0 : false

  return (
    <div className="flex-1 space-y-8">
      {/* ── Masthead ─────────────────────────────────────────────── */}
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
            Ekualisasi{" "}
            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
              PPN.
            </span>
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Peredaran usaha in the ledger against the DPP on issued faktur, month by
            month. Both sides are read from what was recorded — neither is derived from
            the other, or the report would always balance and tell you nothing.
          </p>
        </div>

        <div className="h-px bg-foreground/10" />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {isPending ? (
            <Skeleton className="h-4 w-56" />
          ) : isError ? (
            <span className="text-sm text-muted-foreground">
              Could not read the reconciliation.
            </span>
          ) : (
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  clean
                    ? "bg-emerald-600 dark:bg-emerald-400"
                    : "bg-amber-600 dark:bg-amber-400",
                )}
              />
              <span className="text-sm font-medium text-foreground">
                {clean
                  ? "Every month agrees."
                  : data!.totals.monthsWithDifference === 1
                    ? "1 month does not agree."
                    : `${data!.totals.monthsWithDifference} months do not agree.`}
              </span>
            </div>
          )}

          {/* Year picker. Only years that carry something. */}
          {data && data.availableYears.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {data.availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
                    y === data.year
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
          <p className="text-sm font-medium text-foreground">
            The reconciliation is unavailable.
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "The request did not complete."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="mt-4 h-8 rounded-full border-foreground/10 px-3 text-xs"
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* ── The reconciliation ───────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading note={data ? `${data.year}` : undefined}>
              Month by month
            </SectionHeading>

            <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <table className="w-full min-w-[46rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-foreground/10">
                    <Th align="left">Period</Th>
                    <Th>Ledger revenue</Th>
                    <Th>Invoice DPP</Th>
                    <Th>PPN Keluaran</Th>
                    <Th>Difference</Th>
                  </tr>
                </thead>
                <tbody>
                  {isPending
                    ? Array.from({ length: 12 }).map((_, i) => (
                        <tr key={i} className={cn(i > 0 && "border-t border-foreground/10")}>
                          <td className="px-5 py-3 sm:px-6">
                            <Skeleton className="h-3 w-20" />
                          </td>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <td key={j} className="px-5 py-3">
                              <Skeleton className="ml-auto h-3 w-24" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : data!.months.map((row, i) => {
                        const empty = row.ledgerRevenue === 0 && row.invoiceDpp === 0
                        return (
                          <tr
                            key={row.month}
                            className={cn(i > 0 && "border-t border-foreground/10")}
                          >
                            <td
                              className={cn(
                                "px-5 py-3 sm:px-6",
                                empty ? "text-muted-foreground/50" : "text-foreground",
                              )}
                            >
                              {row.label}
                              {row.invoiceCount > 0 && (
                                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                  {row.invoiceCount} inv
                                </span>
                              )}
                            </td>
                            <Td muted={empty}>
                              {formatModuleMoney(row.ledgerRevenue, data!.currency)}
                            </Td>
                            <Td muted={empty}>
                              {formatModuleMoney(row.invoiceDpp, data!.currency)}
                            </Td>
                            <Td muted={empty}>
                              {formatModuleMoney(row.outputTax, data!.currency)}
                            </Td>
                            <Td
                              muted={empty}
                              tone={
                                row.difference === 0
                                  ? undefined
                                  : "text-amber-700 dark:text-amber-400"
                              }
                            >
                              {formatModuleMoney(row.difference, data!.currency)}
                            </Td>
                          </tr>
                        )
                      })}
                </tbody>

                {data && (
                  <tfoot>
                    <tr className="border-t-2 border-foreground/20 font-medium">
                      <td className="px-5 py-3.5 text-foreground sm:px-6">Total {data.year}</td>
                      <Td>{formatModuleMoney(data.totals.ledgerRevenue, data.currency)}</Td>
                      <Td>{formatModuleMoney(data.totals.invoiceDpp, data.currency)}</Td>
                      <Td>{formatModuleMoney(data.totals.outputTax, data.currency)}</Td>
                      <Td
                        tone={
                          data.totals.difference === 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-amber-700 dark:text-amber-400"
                        }
                      >
                        {formatModuleMoney(data.totals.difference, data.currency)}
                      </Td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {data && (
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Ledger side reads {data.revenueAccounts.length} account
                {data.revenueAccounts.length === 1 ? "" : "s"}
                <Sep />
                {data.revenueAccounts.join(" · ")}
              </p>
            )}
          </section>

          {/* ── What a difference means ──────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading>Reading the difference</SectionHeading>

            <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
              <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                A gap is not automatically an error. These are the ordinary causes, and
                each of them is something you should be able to point at:
              </p>

              <ul className="mt-4 space-y-2.5">
                {[
                  "Revenue that carries no PPN — exports at 0%, or a non-taxable delivery.",
                  "Revenue booked straight to the ledger by journal, with no sales invoice behind it.",
                  "An invoice issued in one month and posted in another; the two sides sit in different rows.",
                  "A sales return or discount recorded on one side only.",
                  "Faktur pajak issued for something the ledger records outside the Sales accounts.",
                ].map((cause) => (
                  <li key={cause} className="flex gap-3 text-[13px] leading-relaxed text-muted-foreground">
                    <span
                      aria-hidden
                      className="mt-[0.45rem] h-[3px] w-[3px] shrink-0 rounded-full bg-emerald-600/60 dark:bg-emerald-400/60"
                    />
                    {cause}
                  </li>
                ))}
              </ul>

              <div className="mt-5 h-px bg-foreground/10" />

              <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                BalanceIO reconciles and shows the gap. Whether a particular difference is
                acceptable is professional judgement — this page does not decide it, and
                it does not file anything.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Th({
  children,
  align = "right",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th
      className={cn(
        "px-5 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground",
        align === "left" ? "text-left sm:px-6" : "text-right",
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  muted,
  tone,
}: {
  children: React.ReactNode
  muted?: boolean
  tone?: string
}) {
  return (
    <td
      className={cn(
        "px-5 py-3 text-right tabular-nums",
        muted ? "text-muted-foreground/50" : "text-foreground",
        tone,
      )}
    >
      {children}
    </td>
  )
}
