"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompany } from "@/contexts/company-context"
import { Figure, SectionHeading, formatIsoDate } from "@/components/dashboard/module/module-primitives"

/** Mirrors CashPositionResponse in DTOs/FinancialStatementDTOs.cs. */
interface CashPosition {
  currency: string
  start: string
  end: string
  opening: number
  inflow: number
  outflow: number
  closing: number
  accounts: { code: string; name: string; nameId: string; opening: number; inflow: number; outflow: number; closing: number }[]
  series: { date: string; balance: number }[]
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Cash and cash equivalents (accounts 1-11xx) from posted journal lines:
 * what the period opened with, what came in, what went out, and where it
 * closed. Transfers between the company's own cash accounts are netted out
 * of the totals.
 */
export default function CashFlowDashboardPage() {
  const { company } = useCompany()
  const today = new Date()
  const [start, setStart] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [end, setEnd] = useState(iso(today))

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["reports", "cash-position", company?.id, start, end],
    queryFn: () => apiClient.get<CashPosition>(`/Reports/cash-position?start=${start}&end=${end}`),
    enabled: !!company && start <= end,
    retry: retryUnlessClientError,
  })

  const money = (v: number) => formatModuleMoney(v, data?.currency ?? "IDR")
  const peak = data ? Math.max(1, ...data.series.map((p) => Math.abs(p.balance))) : 1

  return (
    <div className="flex-1 space-y-8">
      <header className="space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Reports</span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Cash position</h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Cash and cash equivalent accounts from the posted ledger. For the statement of cash flows by activity, use the
          financial statements.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cp-start" className="text-xs text-muted-foreground">From</Label>
          <Input id="cp-start" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="h-9 w-44 font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cp-end" className="text-xs text-muted-foreground">To</Label>
          <Input id="cp-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-9 w-44 font-mono" />
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Cash position could not be loaded."}</p>
      ) : (
        <>
          <section className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60">
            <div className="grid min-h-[104px] divide-y divide-foreground/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              {isPending ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-3 p-5 sm:p-6"><Skeleton className="h-2 w-20" /><Skeleton className="h-7 w-32" /></div>
                ))
              ) : (
                <>
                  <Figure label="Opening" value={money(data.opening)} note={formatIsoDate(data.start)} />
                  <Figure label="Money in" value={money(data.inflow)} tone="text-emerald-700 dark:text-emerald-400" />
                  <Figure label="Money out" value={money(data.outflow)} />
                  <Figure label="Closing" value={money(data.closing)} note={formatIsoDate(data.end)} />
                </>
              )}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="space-y-5 lg:col-span-3">
              <SectionHeading>By account</SectionHeading>
              <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60">
                <table className="w-full min-w-[560px] text-[13px] tabular-nums">
                  <thead>
                    <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      <th className="px-5 py-3 font-normal">Account</th>
                      <th className="px-3 py-3 text-right font-normal">Opening</th>
                      <th className="px-3 py-3 text-right font-normal">In</th>
                      <th className="px-3 py-3 text-right font-normal">Out</th>
                      <th className="px-5 py-3 text-right font-normal">Closing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPending ? (
                      <tr><td colSpan={5} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td></tr>
                    ) : data.accounts.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-6 text-muted-foreground">No cash or bank account (1-11xx) has a balance or movement.</td></tr>
                    ) : (
                      data.accounts.map((a) => (
                        <tr key={a.code} className="border-t border-foreground/10 first:border-t-0">
                          <td className="px-5 py-3"><span className="font-mono text-[12px] text-muted-foreground">{a.code}</span> {a.name}</td>
                          <td className="px-3 py-3 text-right">{money(a.opening)}</td>
                          <td className="px-3 py-3 text-right">{money(a.inflow)}</td>
                          <td className="px-3 py-3 text-right">{money(a.outflow)}</td>
                          <td className="px-5 py-3 text-right text-foreground">{money(a.closing)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-5 lg:col-span-2">
              <SectionHeading note="Week end">Balance</SectionHeading>
              <div className="space-y-2 rounded-xl border border-foreground/10 bg-card/60 p-5">
                {isPending ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  data.series.map((p) => (
                    <div key={p.date} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 text-[12px]">
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{formatIsoDate(p.date).replace(/ \d{4}$/, "")}</span>
                      <div className="h-2 rounded-full bg-foreground/[0.06]">
                        <div
                          className={p.balance < 0 ? "h-2 rounded-full bg-red-600/70" : "h-2 rounded-full bg-emerald-600/70 dark:bg-emerald-400/70"}
                          style={{ width: `${(Math.abs(p.balance) / peak) * 100}%` }}
                        />
                      </div>
                      <span className="font-money text-right">{money(p.balance)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
