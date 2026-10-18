"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { minorToNumber, sumMinor } from "@/lib/utils/minor-units"
import type { Product } from "@/lib/types/inventory"
import { useCompany } from "@/contexts/company-context"
import { ReportLayout } from "@/components/reports/report-layout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

type Status = "all" | "in" | "low" | "out"

const qty = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 })
const money = (n: number) => formatModuleMoney(n, "IDR")

/** Low means at or under a reorder level that has been set; zero is "not set". */
function statusOf(p: Product): Exclude<Status, "all"> {
  if (p.stockOnHand <= 0) return "out"
  if (p.reorderLevel > 0 && p.stockOnHand <= p.reorderLevel) return "low"
  return "in"
}

const STATUS_LABEL = { in: "In stock", low: "Low", out: "Out of stock" } as const

/** Quantities and carrying value per tracked item, at moving-average cost. */
export default function StockOnHandPage() {
  const { company } = useCompany()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<Status>("all")

  const products = useQuery({
    queryKey: ["products", company?.id],
    queryFn: () => apiClient.getProducts() as Promise<Product[]>,
    enabled: !!company,
    retry: retryUnlessClientError,
  })

  const tracked = useMemo(() => (products.data ?? []).filter((p) => p.trackInventory), [products.data])
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return tracked.filter((p) =>
      (status === "all" || statusOf(p) === status) &&
      (!term || p.code.toLowerCase().includes(term) || p.name.toLowerCase().includes(term)))
  }, [tracked, search, status])

  const totalValue = minorToNumber(sumMinor(rows.map((p) => p.inventoryValue)))
  const lowCount = tracked.filter((p) => statusOf(p) === "low").length

  return (
    <ReportLayout
      title="Stock on Hand"
      subtitle="Quantity and carrying value per item, at moving-average cost"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Item code or name" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 text-xs">
          {(["all", "in", "low", "out"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1.5",
                status === s ? "border-foreground/30 font-semibold" : "border-foreground/10 text-muted-foreground",
              )}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {products.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : products.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">Items could not be loaded.</p>
      ) : (
        <>
          <dl className="mb-6 grid grid-cols-3 gap-x-8 border-y border-foreground/10 py-4">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Carrying value</dt>
              <dd className="font-money mt-1 text-lg">{money(totalValue)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Items shown</dt>
              <dd className="font-money mt-1 text-lg">{rows.length}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">At or under reorder level</dt>
              <dd className={cn("font-money mt-1 text-lg", lowCount > 0 && "text-amber-700 dark:text-amber-400")}>{lowCount}</dd>
            </div>
          </dl>

          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No tracked items match.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="py-2 pr-3 font-normal">Code</th>
                    <th className="py-2 pr-3 font-normal">Item</th>
                    <th className="py-2 pr-3 font-normal">Status</th>
                    <th className="py-2 pr-3 text-right font-normal">On hand</th>
                    <th className="py-2 pr-3 text-right font-normal">Average cost</th>
                    <th className="py-2 pr-3 text-right font-normal">Sell price</th>
                    <th className="py-2 text-right font-normal">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const s = statusOf(p)
                    return (
                      <tr key={p.id} className="border-t border-foreground/5">
                        <td className="py-2 pr-3 font-mono text-xs">{p.code}</td>
                        <td className="py-2 pr-3">{p.name}</td>
                        <td className={cn("py-2 pr-3 text-xs",
                          s === "out" && "text-red-700 dark:text-red-400",
                          s === "low" && "text-amber-700 dark:text-amber-400")}>{STATUS_LABEL[s]}</td>
                        <td className="py-2 pr-3 text-right">{qty(p.stockOnHand)} {p.unit}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{money(p.averageCost)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{money(p.sellPrice)}</td>
                        <td className="py-2 text-right">{money(p.inventoryValue)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-foreground/15 font-semibold">
                    <td className="py-2 pr-3" colSpan={6}>Total</td>
                    <td className="py-2 text-right">{money(totalValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </ReportLayout>
  )
}
