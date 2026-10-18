"use client"

import { useMemo } from "react"

import { ReportLayout } from "@/components/reports/report-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { type PartyRow, type PartyTotals, useTradeReport } from "@/hooks/use-trade-report"
import { FigureRow, TradeFilters, bodyRow, footRow, headRow, matches, money, th, useTradeFilters } from "./trade-report"

/**
 * Sales by customer or purchases by vendor: posted documents in the period,
 * per party and currency, totalled by the API.
 */
export function PartyReport({ kind }: { kind: "sales-by-customer" | "purchases-by-vendor" }) {
  const sales = kind === "sales-by-customer"
  const filters = useTradeFilters()
  const report = useTradeReport<PartyRow, PartyTotals>(kind, filters.start, filters.end)
  const rows = useMemo(
    () => (report.data?.rows ?? []).filter((r) => matches(filters.search, r.name, r.code)),
    [report.data, filters.search],
  )
  const party = sales ? "Customer" : "Vendor"
  const documents = sales ? "Invoices" : "Bills"

  return (
    <ReportLayout
      title={sales ? "Sales by Customer" : "Purchases by Vendor"}
      subtitle={`Posted ${documents.toLowerCase()} in the period, before and after PPN`}
      periodStart={filters.start}
      periodEnd={filters.end}
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      <TradeFilters filters={filters} placeholder={`${party} name or code`} />

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
                [`Net ${sales ? "sales" : "purchases"} (${t.currency})`, money(t.net, t.currency)],
                ["PPN", money(t.tax, t.currency)],
                [sales ? "Collected" : "Paid", money(t.paid, t.currency)],
                ["Outstanding", money(t.outstanding, t.currency)],
              ]}
            />
          ))}

          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No posted {documents.toLowerCase()} in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className={headRow}>
                    <th className={th}>{party}</th>
                    <th className={`${th} text-right`}>{documents}</th>
                    <th className={`${th} text-right`}>Net</th>
                    <th className={`${th} text-right`}>PPN</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>{sales ? "Collected" : "Paid"}</th>
                    <th className={`${th} text-right`}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.contactId}-${r.currency}`} className={bodyRow}>
                      <td className="py-2 pr-3">
                        <div>{r.name}</div>
                        {r.code && <div className="font-mono text-xs text-muted-foreground">{r.code}</div>}
                      </td>
                      <td className="py-2 pr-3 text-right">{r.documents}</td>
                      <td className="py-2 pr-3 text-right">{money(r.net, r.currency)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{money(r.tax, r.currency)}</td>
                      <td className="py-2 pr-3 text-right">{money(r.total, r.currency)}</td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{money(r.paid, r.currency)}</td>
                      <td className="py-2 pr-3 text-right">{money(r.outstanding, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                {!filters.search && (
                  <tfoot>
                    {report.data.totals.map((t) => (
                      <tr key={t.currency} className={footRow}>
                        <td className="py-2 pr-3">Total {t.currency}</td>
                        <td className="py-2 pr-3 text-right">{t.documents}</td>
                        <td className="py-2 pr-3 text-right">{money(t.net, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{money(t.tax, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{money(t.total, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{money(t.paid, t.currency)}</td>
                        <td className="py-2 pr-3 text-right">{money(t.outstanding, t.currency)}</td>
                      </tr>
                    ))}
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}
    </ReportLayout>
  )
}
