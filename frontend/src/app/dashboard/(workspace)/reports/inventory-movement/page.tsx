"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, startOfMonth } from "date-fns"
import { Search } from "lucide-react"

import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { useCompany } from "@/contexts/company-context"
import { useWarehouses } from "@/hooks/use-warehouses"
import { ReportLayout } from "@/components/reports/report-layout"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Mirrors GET /api/Reports/inventory-movements. Value fields are null when filtered to one warehouse. */
interface CardMovement {
  id: string
  date: string
  type: string
  reference: string | null
  notes: string | null
  warehouse: string | null
  quantityIn: number
  quantityOut: number
  unitCost: number
  value: number | null
  balanceQuantity: number
  balanceValue: number | null
}

interface StockCard {
  productId: string
  code: string
  name: string
  unit: string
  openingQuantity: number
  openingValue: number | null
  quantityIn: number
  quantityOut: number
  valueIn: number | null
  valueOut: number | null
  closingQuantity: number
  closingValue: number | null
  movements: CardMovement[]
}

interface MovementReport {
  start: string
  end: string
  withValue: boolean
  openingValue: number | null
  valueIn: number | null
  valueOut: number | null
  closingValue: number | null
  products: StockCard[]
}

const TYPE_LABEL: Record<string, string> = {
  Purchase: "Purchase",
  Sale: "Sale",
  OpnameAdjustment: "Stock opname",
  ManualAdjustment: "Adjustment",
  Transfer: "Transfer",
  OpeningBalance: "Opening",
}

const qty = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 })
const money = (n: number | null) => (n === null ? "" : formatModuleMoney(n, "IDR"))

/**
 * Stock card per product from the movement ledger, valued at moving-average
 * cost. It used to be assembled in the browser from invoices and bills, and
 * showed invented opening stock when there were none.
 */
export default function InventoryMovementPage() {
  const { company } = useCompany()
  const warehouses = useWarehouses()
  const [start, setStart] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [end, setEnd] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [warehouseId, setWarehouseId] = useState("all")
  const [search, setSearch] = useState("")

  const report = useQuery({
    queryKey: ["inventory-movements", company?.id, start, end, warehouseId],
    queryFn: () => {
      const params = new URLSearchParams({ start, end })
      if (warehouseId !== "all") params.set("warehouseId", warehouseId)
      return apiClient.get<MovementReport>(`/Reports/inventory-movements?${params}`)
    },
    enabled: !!company && !!start && !!end,
    retry: retryUnlessClientError,
  })

  const cards = useMemo(() => {
    const term = search.trim().toLowerCase()
    const all = report.data?.products ?? []
    if (!term) return all
    return all.filter((c) =>
      c.code.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.movements.some((m) => m.reference?.toLowerCase().includes(term)),
    )
  }, [report.data, search])

  const withValue = report.data?.withValue ?? warehouseId === "all"

  return (
    <ReportLayout
      title="Inventory Movement"
      subtitle="Stock card per item at moving-average cost"
      periodStart={start}
      periodEnd={end}
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-xs text-muted-foreground">
          From
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-40" />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-40" />
        </label>
        <div className="text-xs text-muted-foreground">
          Warehouse
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="mt-1 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehouses.data?.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.code} · {w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Item code, name or reference" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {!withValue && (
        <p className="mb-4 text-[13px] text-muted-foreground">
          One warehouse shows quantities only. The average cost is company-wide, so value is reported for all warehouses together.
        </p>
      )}

      {report.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : report.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">The movement report could not be loaded.</p>
      ) : (
        <>
          {withValue && (
            <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-foreground/10 py-4 sm:grid-cols-4">
              {([
                ["Opening value", report.data.openingValue],
                ["In", report.data.valueIn],
                ["Out", report.data.valueOut],
                ["Closing value", report.data.closingValue],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
                  <dd className="font-money mt-1 text-lg">{money(value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {cards.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No stock movements in this period.</p>
          ) : (
            <div className="space-y-8">
              {cards.map((c) => (
                <section key={c.productId} className="break-inside-avoid">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-foreground/10 pb-1.5">
                    <h3 className="text-sm font-semibold">
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span> {c.name}
                    </h3>
                    <span className="text-xs text-muted-foreground">{c.unit}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          <th className="py-2 pr-3 font-normal">Date</th>
                          <th className="py-2 pr-3 font-normal">Type</th>
                          <th className="py-2 pr-3 font-normal">Reference</th>
                          <th className="py-2 pr-3 font-normal">Warehouse</th>
                          <th className="py-2 pr-3 text-right font-normal">In</th>
                          <th className="py-2 pr-3 text-right font-normal">Out</th>
                          {withValue && <th className="py-2 pr-3 text-right font-normal">Unit cost</th>}
                          {withValue && <th className="py-2 pr-3 text-right font-normal">Value</th>}
                          <th className="py-2 pr-3 text-right font-normal">Balance</th>
                          {withValue && <th className="py-2 text-right font-normal">Balance value</th>}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-foreground/5 text-muted-foreground">
                          <td className="py-1.5 pr-3" colSpan={withValue ? 8 : 6}>Opening balance</td>
                          <td className="py-1.5 pr-3 text-right">{qty(c.openingQuantity)}</td>
                          {withValue && <td className="py-1.5 text-right">{money(c.openingValue)}</td>}
                        </tr>
                        {c.movements.map((m) => (
                          <tr key={m.id} className="border-t border-foreground/5">
                            <td className="py-1.5 pr-3 font-mono text-xs">{m.date}</td>
                            <td className="py-1.5 pr-3">{TYPE_LABEL[m.type] ?? m.type}</td>
                            <td className="py-1.5 pr-3 font-mono text-xs" title={m.notes ?? undefined}>{m.reference ?? ""}</td>
                            <td className="py-1.5 pr-3 font-mono text-xs">{m.warehouse ?? ""}</td>
                            <td className="py-1.5 pr-3 text-right">{m.quantityIn ? qty(m.quantityIn) : ""}</td>
                            <td className="py-1.5 pr-3 text-right">{m.quantityOut ? qty(m.quantityOut) : ""}</td>
                            {withValue && <td className="py-1.5 pr-3 text-right text-muted-foreground">{money(m.unitCost)}</td>}
                            {withValue && <td className="py-1.5 pr-3 text-right">{m.value ? money(m.value) : ""}</td>}
                            <td className="py-1.5 pr-3 text-right">{qty(m.balanceQuantity)}</td>
                            {withValue && <td className="py-1.5 text-right">{money(m.balanceValue)}</td>}
                          </tr>
                        ))}
                        <tr className="border-t border-foreground/15 font-semibold">
                          <td className="py-1.5 pr-3" colSpan={4}>Closing balance</td>
                          <td className="py-1.5 pr-3 text-right">{qty(c.quantityIn)}</td>
                          <td className="py-1.5 pr-3 text-right">{qty(c.quantityOut)}</td>
                          {withValue && <td className="py-1.5 pr-3" />}
                          {withValue && <td className="py-1.5 pr-3" />}
                          <td className="py-1.5 pr-3 text-right">{qty(c.closingQuantity)}</td>
                          {withValue && <td className="py-1.5 text-right">{money(c.closingValue)}</td>}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </ReportLayout>
  )
}
