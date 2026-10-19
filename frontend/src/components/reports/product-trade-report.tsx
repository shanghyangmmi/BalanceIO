"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { ReportLayout } from "@/components/reports/report-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { type PurchaseProductRow, type SalesProductRow, useTradeReport } from "@/hooks/use-trade-report"
import { FigureRow, TradeFilters, bodyRow, footRow, headRow, matches, money, qty, th, useTradeFilters } from "./trade-report"

interface SalesTotals { currency: string; net: number; costOfSales: number; grossProfit: number; netWithCost: number }
interface PurchaseTotals { currency: string; net: number }

const margin = (profit: number, net: number) =>
  net === 0 ? "" : `${((profit / net) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })} %`

/**
 * Sales by product carries the cost of sales the invoices posted at
 * moving-average cost; lines without a tracked product have none.
 */
export function SalesByProductReport() {
  const filters = useTradeFilters()
  const report = useTradeReport<SalesProductRow, SalesTotals>("sales-by-product", filters.start, filters.end)
  const rows = useMemo(
    () => (report.data?.rows ?? []).filter((r) => matches(filters.search, r.name, r.code)),
    [report.data, filters.search],
  )

  return (
    <ReportLayout
      title="Sales by Product"
      subtitle="Quantity, net sales and gross margin per item"
      periodStart={filters.start}
      periodEnd={filters.end}
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      <TradeFilters filters={filters} placeholder="Item code or name" />
      {report.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : report.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">The report could not be loaded.</p>
      ) : (
        <>
          {report.data.totals.map((t) => (
            <FigureRow
              key={t.currency}
              figures={[
                [`Net sales (${t.currency})`, money(t.net, t.currency)],
                ["Cost of sales", money(t.costOfSales, t.currency)],
                ["Gross profit", money(t.grossProfit, t.currency)],
                ["Gross margin", margin(t.grossProfit, t.netWithCost) || "—"],
              ]}
            />
          ))}
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No posted invoices in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className={headRow}>
                    <th className={th}>Item</th>
                    <th className={`${th} text-right`}>Invoices</th>
                    <th className={`${th} text-right`}>Quantity</th>
                    <th className={`${th} text-right`}>Average price</th>
                    <th className={`${th} text-right`}>Net sales</th>
                    <th className={`${th} text-right`}>Cost of sales</th>
                    <th className={`${th} text-right`}>Gross profit</th>
                    <th className={`${th} text-right`}>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.productId ?? r.name}-${r.currency}`} className={bodyRow}>
                      <td className="py-2 pr-3">
                        <div>{r.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.code ?? "No item"}</div>
                      </td>
                      <td className="py-2 pr-3 text-right">{r.invoices}</td>
                      <td className="py-2 pr-3 text-right">{qty(r.quantity)} {r.unit}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{money(r.averagePrice, r.currency)}</td>
                      <td className="py-2 pr-3 text-right">{money(r.net, r.currency)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{r.costOfSales === null ? "" : money(r.costOfSales, r.currency)}</td>
                      <td className={cn("py-2 pr-3 text-right", r.grossProfit !== null && r.grossProfit < 0 && "text-red-700 dark:text-red-400")}>
                        {r.grossProfit === null ? "" : money(r.grossProfit, r.currency)}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{r.grossProfit === null ? "" : margin(r.grossProfit, r.net)}</td>
                    </tr>
                  ))}
                </tbody>
                {!filters.search && (
                  <tfoot>
                    {report.data.totals.map((t) => (
                      <tr key={t.currency} className={footRow}>
                        <td className="py-2 pr-3" colSpan={4}>Total {t.currency}</td>
                        <td className="py-2 pr-3 text-right">{money(t.net, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{money(t.costOfSales, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{money(t.grossProfit, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{margin(t.grossProfit, t.netWithCost)}</td>
                      </tr>
                    ))}
                  </tfoot>
                )}
              </table>
              <p className="mt-4 text-xs text-muted-foreground">
                Gross margin covers items whose stock is tracked; service lines have no cost of sales.
              </p>
            </div>
          )}
        </>
      )}
    </ReportLayout>
  )
}

export function PurchasesByProductReport() {
  const filters = useTradeFilters()
  const report = useTradeReport<PurchaseProductRow, PurchaseTotals>("purchases-by-product", filters.start, filters.end)
  const rows = useMemo(
    () => (report.data?.rows ?? []).filter((r) => matches(filters.search, r.name, r.code)),
    [report.data, filters.search],
  )

  return (
    <ReportLayout
      title="Purchases by Product"
      subtitle="Quantity bought and net cost per item"
      periodStart={filters.start}
      periodEnd={filters.end}
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      <TradeFilters filters={filters} placeholder="Item code or name" />
      {report.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : report.isError ? (
        <p className="text-sm text-red-700 dark:text-red-400">The report could not be loaded.</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No posted bills in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={headRow}>
                <th className={th}>Item</th>
                <th className={`${th} text-right`}>Bills</th>
                <th className={`${th} text-right`}>Quantity</th>
                <th className={`${th} text-right`}>Average cost</th>
                <th className={`${th} text-right`}>Net cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.productId ?? r.name}-${r.currency}`} className={bodyRow}>
                  <td className="py-2 pr-3">
                    <div>{r.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.code ?? "No item"}</div>
                  </td>
                  <td className="py-2 pr-3 text-right">{r.bills}</td>
                  <td className="py-2 pr-3 text-right">{qty(r.quantity)} {r.unit}</td>
                  <td className="py-2 pr-3 text-right text-muted-foreground">{money(r.averageCost, r.currency)}</td>
                  <td className="py-2 pr-3 text-right">{money(r.net, r.currency)}</td>
                </tr>
              ))}
            </tbody>
            {!filters.search && (
              <tfoot>
                {report.data.totals.map((t) => (
                  <tr key={t.currency} className={footRow}>
                    <td className="py-2 pr-3" colSpan={4}>Total {t.currency}</td>
                    <td className="py-2 pr-3 text-right">{money(t.net, t.currency)}</td>
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      )}
    </ReportLayout>
  )
}
