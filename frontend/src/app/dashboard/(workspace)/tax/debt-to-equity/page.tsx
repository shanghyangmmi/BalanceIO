"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebtToEquity } from "@/hooks/use-tax-analysis"
import {
  ModuleLocked,
  isModuleLocked,
} from "@/components/dashboard/module/module-locked"
import {
  Figure,
  SectionHeading,
  Sep,
} from "@/components/dashboard/module/module-primitives"
import {
  StatementRow,
  TaxReportShell,
} from "@/components/dashboard/tax/tax-report-shell"

/**
 * Debt to equity under PMK-169/PMK.010/2015, which caps the ratio at 4:1
 * for interest to stay deductible.
 *
 * Two things a naive version gets wrong. The ratio is built from average
 * balances across the year rather than the closing position, or a loan
 * repaid in December disappears from a year it was borrowed through. And
 * debt means interest-bearing borrowings — trade payables, VAT out and tax
 * payable are not debt, and counting them would disallow interest that is
 * perfectly deductible.
 */
export default function DebtToEquityPage() {
  const [year, setYear] = React.useState<number | null>(null)
  const { data, isPending, isError, error, refetch } = useDebtToEquity(year)

  if (isError && isModuleLocked(error)) {
    return <ModuleLocked moduleName="Tax" />
  }

  const money = (v: number) => formatModuleMoney(v, data?.currency ?? "IDR")

  const verdictLabel = !data
    ? undefined
    : data.ratio === undefined
      ? "A ratio cannot be formed."
      : data.withinLimit
        ? `${data.ratio.toFixed(2)} : 1 — within the 4:1 limit`
        : `${data.ratio.toFixed(2)} : 1 — outside the 4:1 limit`

  return (
    <TaxReportShell
      title="Debt to"
      accent="equity."
      lede="Average interest-bearing debt against average equity across the year, tested against the 4:1 cap in PMK-169. Where the ratio is exceeded, the interest on the excess is not deductible."
      verdict={!data ? "neutral" : data.ratio === undefined ? "neutral" : data.withinLimit ? "clean" : "attention"}
      verdictLabel={verdictLabel}
      isPending={isPending}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : undefined}
      onRetry={() => refetch()}
      years={data?.availableYears}
      activeYear={data?.year}
      onYear={setYear}
    >
      {/* ── The ratio ──────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note={data ? `${data.year}` : undefined}>The ratio</SectionHeading>

        <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
          <div className="grid divide-y divide-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {isPending ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-3 p-5 sm:p-6">
                  <Skeleton className="h-2 w-28" />
                  <Skeleton className="h-7 w-36" />
                </div>
              ))
            ) : (
              <>
                <Figure
                  label="Average debt"
                  value={money(data!.averageDebt)}
                  note="Interest-bearing only"
                />
                <Figure
                  label="Average equity"
                  value={money(data!.averageEquity)}
                  note="Month-end balances, twelve months"
                />
                <Figure
                  label="Ratio"
                  value={data!.ratio === undefined ? "—" : `${data!.ratio.toFixed(2)} : 1`}
                  tone={
                    data!.ratio === undefined
                      ? "text-muted-foreground"
                      : data!.withinLimit
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-amber-700 dark:text-amber-400"
                  }
                  note={`Cap ${data!.maximumRatio.toFixed(0)} : 1`}
                />
              </>
            )}
          </div>

          {data && (
            <div className="border-t border-foreground/10 px-5 py-3.5 sm:px-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Debt {data.debtAccounts.length ? data.debtAccounts.join(" · ") : "none marked"}
                <Sep />
                Interest{" "}
                {data.interestAccounts.length
                  ? data.interestAccounts.join(" · ")
                  : "none found"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── What it costs ──────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading>Interest</SectionHeading>

        <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
          {isPending ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <>
              <StatementRow
                label="Interest expense for the year"
                value={money(data!.interestExpense)}
              />
              <StatementRow
                label="Disallowed under PMK-169"
                value={money(data!.disallowedInterest)}
                tone={
                  data!.disallowedInterest > 0
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
                }
                note={
                  data!.disallowedInterest > 0
                    ? "In the same proportion the excess debt bears to the whole"
                    : undefined
                }
              />
              <StatementRow
                label="Deductible"
                value={money(data!.interestExpense - data!.disallowedInterest)}
                strong
              />
            </>
          )}
        </div>

        {data && data.notes.length > 0 && (
          <div className="rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] p-5 sm:p-6">
            <ul className="space-y-2">
              {data.notes.map((n) => (
                <li key={n} className="text-[13px] leading-relaxed text-muted-foreground">
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Which liabilities are borrowings is marked on the{" "}
              <Link
                href="/dashboard/accounting/coa"
                className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
              >
                chart of accounts
              </Link>
              . Trade payables and tax payable are not debt for this test.
            </p>
          </div>
        )}
      </section>

      {/* ── Month by month ─────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note="Closing balances">Month by month</SectionHeading>

        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="px-5 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground sm:px-6">
                  Period
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                  Debt
                </th>
                <th className="px-5 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground sm:px-6">
                  Equity
                </th>
              </tr>
            </thead>
            <tbody>
              {isPending
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={i} className={cn(i > 0 && "border-t border-foreground/10")}>
                      <td className="px-5 py-3 sm:px-6">
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-5 py-3">
                        <Skeleton className="ml-auto h-3 w-24" />
                      </td>
                      <td className="px-5 py-3 sm:px-6">
                        <Skeleton className="ml-auto h-3 w-24" />
                      </td>
                    </tr>
                  ))
                : data!.months.map((m, i) => {
                    const empty = m.debt === 0 && m.equity === 0
                    return (
                      <tr key={m.month} className={cn(i > 0 && "border-t border-foreground/10")}>
                        <td
                          className={cn(
                            "px-5 py-3 sm:px-6",
                            empty ? "text-muted-foreground/50" : "text-foreground",
                          )}
                        >
                          {m.label}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right tabular-nums",
                            empty ? "text-muted-foreground/50" : "text-foreground",
                          )}
                        >
                          {money(m.debt)}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right tabular-nums sm:px-6",
                            empty ? "text-muted-foreground/50" : "text-foreground",
                          )}
                        >
                          {money(m.equity)}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>

            {data && (
              <tfoot>
                <tr className="border-t-2 border-foreground/20 font-medium">
                  <td className="px-5 py-3.5 text-foreground sm:px-6">Average</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                    {money(data.averageDebt)}
                  </td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-foreground sm:px-6">
                    {money(data.averageEquity)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Averaged over twelve month-ends rather than read off the closing balance sheet. A
          loan drawn in January and repaid in December would otherwise leave no trace in the
          year it was borrowed through, and the interest on it would look unexplained.
        </p>
      </section>
    </TaxReportShell>
  )
}
