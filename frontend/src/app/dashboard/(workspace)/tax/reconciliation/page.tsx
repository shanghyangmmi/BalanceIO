"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Skeleton } from "@/components/ui/skeleton"
import { useFiscalReconciliation } from "@/hooks/use-tax-analysis"
import {
  ModuleLocked,
  isModuleLocked,
} from "@/components/dashboard/module/module-locked"
import { SectionHeading } from "@/components/dashboard/module/module-primitives"
import {
  StatementRow,
  TaxReportShell,
} from "@/components/dashboard/tax/tax-report-shell"

/**
 * Rekonsiliasi fiskal — commercial profit reconciled to fiscal profit.
 *
 * The arithmetic is the product's job. The classification is not: whether
 * entertainment, natura, a donation or a penalty is deductible turns on
 * documentation and circumstance, and a product that assumed would hand
 * its user a correction they never made.
 *
 * So corrections come from what the accountant marked on each account, and
 * an unclassified chart reconciles to itself — loudly, because a fiscal
 * profit that equals the commercial profit exactly is almost always a
 * reconciliation nobody has done yet rather than a company with nothing to
 * correct.
 */
export default function FiscalReconciliationPage() {
  const [year, setYear] = React.useState<number | null>(null)
  const { data, isPending, isError, error, refetch } = useFiscalReconciliation(year)

  if (isError && isModuleLocked(error)) {
    return <ModuleLocked moduleName="Tax" />
  }

  const unclassified = data ? data.classifiedAccounts === 0 : false
  const money = (v: number) => formatModuleMoney(v, data?.currency ?? "IDR")

  return (
    <TaxReportShell
      title="Rekonsiliasi"
      accent="fiskal."
      lede="Commercial profit from the ledger, corrected to fiscal profit by what has been classified on the chart of accounts. The corrections are yours; the arithmetic is ours."
      verdict={unclassified ? "attention" : data ? "clean" : "neutral"}
      verdictLabel={
        data
          ? unclassified
            ? "No account carries a fiscal classification."
            : `${data.classifiedAccounts} of ${data.classifiableAccounts} accounts classified`
          : undefined
      }
      isPending={isPending}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : undefined}
      onRetry={() => refetch()}
      years={data?.availableYears}
      activeYear={data?.year}
      onYear={setYear}
    >
      {/* ── The reconciliation ─────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note={data ? `${data.year}` : undefined}>
          Commercial to fiscal
        </SectionHeading>

        <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
          {isPending ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <>
              <StatementRow label="Revenue" value={money(data!.revenue)} />
              <StatementRow label="Expenses" value={money(data!.expenses)} />
              <StatementRow
                label="Commercial profit"
                value={money(data!.commercialProfit)}
                strong
                note="Per the ledger, before any correction"
              />

              <div className="mt-6" />

              <StatementRow
                label="Koreksi fiskal positif"
                value={money(data!.positiveCorrections)}
                muted
                note="Costs added back as non-deductible"
              />
              <StatementRow
                label="Koreksi fiskal negatif"
                value={money(data!.negativeCorrections)}
                muted
                note="Income taken out — taxed finally, or not taxable"
              />
              <StatementRow
                label="Fiscal profit"
                value={money(data!.fiscalProfit)}
                strong
                tone={
                  data!.fiscalProfit === data!.commercialProfit
                    ? "text-muted-foreground"
                    : undefined
                }
                note="The base an SPT Tahunan Badan starts from"
              />
            </>
          )}
        </div>
      </section>

      {/* ── The corrections themselves ─────────────────────────────── */}
      {data && data.corrections.length > 0 && (
        <section className="space-y-5">
          <SectionHeading note={`${data.corrections.length} account${data.corrections.length === 1 ? "" : "s"}`}>
            Where the corrections come from
          </SectionHeading>

          <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
            {data.corrections.map((c, i) => (
              <div
                key={c.code}
                className={cn(
                  "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3.5 sm:px-6",
                  i > 0 && "border-t border-foreground/10",
                )}
              >
                <div className="min-w-0">
                  <div className="text-sm text-foreground">{c.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {c.code}
                    <span className="mx-2 text-muted-foreground/40">·</span>
                    <span
                      className={
                        c.direction === "positive"
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }
                    >
                      {c.direction === "positive" ? "Added back" : "Taken out"}
                    </span>
                  </div>
                </div>
                <div className="font-money shrink-0 text-sm tabular-nums text-foreground">
                  {c.direction === "positive" ? "+" : "−"} {money(c.amount)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The refusal ────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading>How a correction gets here</SectionHeading>

        <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            An account is corrected because someone marked it on the{" "}
            <Link
              href="/dashboard/accounting/coa"
              className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              chart of accounts
            </Link>
            , not because BalanceIO recognised its name. Entertainment is deductible with a
            daftar nominatif and not without one; natura turns on who received it and when;
            a donation turns on the recipient. None of that is visible from an account
            label, and guessing it would put a position in your return that you did not
            take.
          </p>

          {unclassified && (
            <>
              <div className="mt-5 h-px bg-foreground/10" />
              <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                Nothing is classified yet, so the fiscal profit above is simply the
                commercial profit repeated. That is arithmetic, not a conclusion — read it
                as &ldquo;no reconciliation has been performed&rdquo; rather than
                &ldquo;no corrections are needed&rdquo;.
              </p>
            </>
          )}
        </div>
      </section>
    </TaxReportShell>
  )
}
