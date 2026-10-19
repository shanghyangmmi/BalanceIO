"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { useCompany } from "@/contexts/company-context"
import { ReportLayout } from "@/components/reports/report-layout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors GET /api/Reports/inventory-aging. */
interface Bucket { quantity: number; value: number }
interface AgingRow {
  productId: string
  code: string
  name: string
  unit: string
  quantity: number
  value: number
  averageCost: number
  buckets: Bucket[]
  lastSale: string | null
  daysSinceLastSale: number | null
}
interface AgingReport {
  asOf: string
  buckets: string[]
  totals: Bucket[]
  value: number
  rows: AgingRow[]
}

const qty = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 })
const money = (n: number) => formatModuleMoney(n, "IDR")

/**
 * Age of the stock on hand, from receipt dates in the movement ledger.
 * The page used to spread each item's stock over the buckets by its
 * position in the list.
 */
export default function InventoryAgingPage() {
  const { company } = useCompany()
  const [asOf, setAsOf] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [search, setSearch] = useState("")

  const report = useQuery({
    queryKey: ["inventory-aging", company?.id, asOf],
    queryFn: () => apiClient.get<AgingReport>(`/Reports/inventory-aging?asOf=${asOf}`),
    enabled: !!company && !!asOf,
    retry: retryUnlessClientError,
  })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const all = report.data?.rows ?? []
    return term ? all.filter((r) => r.code.toLowerCase().includes(term) || r.name.toLowerCase().includes(term)) : all
  }, [report.data, search])

  const labels = report.data?.buckets ?? ["0-30", "31-60", "61-90", "90+"]

  return (
    <ReportLayout
      title="Inventory Aging"
      subtitle="Stock on hand by days since receipt, at moving-average cost"
      reportDate={asOf}
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-xs text-muted-foreground">
          As of
          <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="mt-1 w-40" />
        </label>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Item code or name" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {report.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : report.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">The aging report could not be loaded.</p>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-foreground/10 py-4 sm:grid-cols-5">
            {report.data.totals.map((t, i) => (
              <div key={labels[i]}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{labels[i]} days</dt>
                <dd className={cn("font-money mt-1 text-lg", i === labels.length - 1 && t.value > 0 && "text-red-700 dark:text-red-400")}>{money(t.value)}</dd>
              </div>
            ))}
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Carrying value</dt>
              <dd className="font-money mt-1 text-lg">{money(report.data.value)}</dd>
            </div>
          </dl>

          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No stock on hand.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">Item</th>
                    <th className="py-2 pr-3 text-right font-normal">On hand</th>
                    {labels.map((l) => <th key={l} className="py-2 pr-3 text-right font-normal">{l} days</th>)}
                    <th className="py-2 pr-3 text-right font-normal">Value</th>
                    <th className="py-2 text-right font-normal">Last sale</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.productId} className="border-t border-foreground/5 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                      </td>
                      <td className="py-2 pr-3 text-right">{qty(r.quantity)} {r.unit}</td>
                      {r.buckets.map((b, i) => (
                        <td key={labels[i]} className="py-2 pr-3 text-right">
                          {b.quantity ? (
                            <>
                              <div>{qty(b.quantity)}</div>
                              <div className="text-xs text-muted-foreground">{money(b.value)}</div>
                            </>
                          ) : ""}
                        </td>
                      ))}
                      <td className="py-2 pr-3 text-right">{money(r.value)}</td>
                      <td className="py-2 text-right text-xs text-muted-foreground">
                        {r.lastSale ? `${r.lastSale} (${r.daysSinceLastSale} d)` : "Never sold"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Units on hand are attributed to the most recent receipts. Stock with no receipt on record is shown as 90+ days.
          </p>
        </>
      )}
    </ReportLayout>
  )
}
