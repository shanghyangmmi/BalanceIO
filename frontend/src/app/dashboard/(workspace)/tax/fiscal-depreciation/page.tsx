"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Skeleton } from "@/components/ui/skeleton"
import { useFiscalDepreciation } from "@/hooks/use-tax-analysis"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import { SectionHeading } from "@/components/dashboard/module/module-primitives"
import { StatementRow, TaxReportShell } from "@/components/dashboard/tax/tax-report-shell"

const METHOD = { StraightLine: "Garis lurus", DecliningBalance: "Saldo menurun", "": "—" } as const

/**
 * Penyusutan fiskal — the tax schedule beside the commercial charge, by
 * kelompok harta, in the shape of SPT Tahunan Badan Lampiran 1A. The
 * difference, including book value written off on disposal, is the
 * correction the fiscal reconciliation carries.
 */
export default function FiscalDepreciationPage() {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = React.useState(thisYear)
  const { data, isPending, isError, error, refetch } = useFiscalDepreciation(year)

  if (isError && isModuleLocked(error)) {
    return <ModuleLocked moduleName="Fixed Assets" />
  }

  const money = (v: number) => formatModuleMoney(v, data?.currency ?? "IDR")
  const signed = (v: number) => (v === 0 ? money(0) : `${v > 0 ? "+" : "−"} ${money(Math.abs(v))}`)
  const disposals = data?.rows.filter((r) => r.disposalDate) ?? []

  return (
    <TaxReportShell
      title="Penyusutan"
      accent="fiskal."
      lede="Tax depreciation by kelompok harta under UU PPh Pasal 11, set beside what the register charged. The difference goes to the fiscal reconciliation by itself."
      verdict={data ? (data.unclassified > 0 ? "attention" : "clean") : "neutral"}
      verdictLabel={
        data
          ? data.unclassified > 0
            ? `${data.unclassified} asset${data.unclassified === 1 ? "" : "s"} without a fiscal group, left out`
            : `${data.rows.length} asset${data.rows.length === 1 ? "" : "s"} classified`
          : undefined
      }
      isPending={isPending}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : undefined}
      onRetry={() => refetch()}
      years={Array.from({ length: 6 }, (_, i) => thisYear - i)}
      activeYear={year}
      onYear={setYear}
    >
      <section className="space-y-5">
        <SectionHeading note={`${year}`}>Commercial to fiscal</SectionHeading>
        <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
          {isPending || !data ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : (
            <>
              <StatementRow label="Penyusutan komersial" value={money(data.commercialCharge)} note="Charged by the register in the year" />
              <StatementRow label="Penyusutan fiskal" value={money(data.fiscalCharge)} note="Pasal 11, from the month of acquisition" />
              <StatementRow
                label="Koreksi fiskal"
                value={signed(data.correction)}
                strong
                tone={data.correction === 0 ? "text-muted-foreground" : undefined}
                note={data.correction > 0 ? "Positive: more commercial than fiscal expense" : data.correction < 0 ? "Negative: more fiscal than commercial expense" : "Including disposals"}
              />
            </>
          )}
        </div>
      </section>

      {data && data.groups.length > 0 && (
        <section className="space-y-5">
          <SectionHeading note="Lampiran 1A">By kelompok harta</SectionHeading>
          <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-5 py-3 font-normal">Kelompok</th>
                  <th className="px-3 py-3 text-right font-normal">Assets</th>
                  <th className="px-3 py-3 text-right font-normal">Cost</th>
                  <th className="px-3 py-3 text-right font-normal">Fiscal</th>
                  <th className="px-3 py-3 text-right font-normal">Commercial</th>
                  <th className="px-3 py-3 text-right font-normal">Fiscal book value</th>
                  <th className="px-5 py-3 text-right font-normal">Correction</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <tr key={g.group} className="border-t border-foreground/10">
                    <td className="px-5 py-2.5">{g.groupLabel}</td>
                    <td className="px-3 py-2.5 text-right">{g.assets}</td>
                    <td className="px-3 py-2.5 text-right">{money(g.cost)}</td>
                    <td className="px-3 py-2.5 text-right">{money(g.fiscalCharge)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{money(g.commercialCharge)}</td>
                    <td className="px-3 py-2.5 text-right">{money(g.fiscalClosing)}</td>
                    <td className="px-5 py-2.5 text-right">{signed(g.correction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && data.rows.length > 0 && (
        <section className="space-y-5">
          <SectionHeading note={`${data.rows.length}`}>Per asset</SectionHeading>
          <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-5 py-3 font-normal">Asset</th>
                  <th className="px-3 py-3 font-normal">Kelompok · metode</th>
                  <th className="px-3 py-3 font-normal">Acquired</th>
                  <th className="px-3 py-3 text-right font-normal">Cost</th>
                  <th className="px-3 py-3 text-right font-normal">Opening</th>
                  <th className="px-3 py-3 text-right font-normal">Fiscal</th>
                  <th className="px-3 py-3 text-right font-normal">Commercial</th>
                  <th className="px-5 py-3 text-right font-normal">Closing</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.assetId} className="border-t border-foreground/10 align-top">
                    <td className="px-5 py-2.5">
                      <div>{r.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{r.code}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {r.groupLabel}
                      {r.method && ` · ${METHOD[r.method]}`}
                      {r.lifeYears ? ` · ${r.lifeYears} th` : ""}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.acquisitionDate}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.cost)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{money(r.fiscalOpening)}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.fiscalCharge)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{money(r.commercialCharge)}</td>
                    <td className="px-5 py-2.5 text-right">{r.disposalDate ? "Disposed" : money(r.fiscalClosing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {disposals.length > 0 && (
        <section className="space-y-5">
          <SectionHeading note={`${disposals.length}`}>Disposals</SectionHeading>
          <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-5 py-3 font-normal">Asset</th>
                  <th className="px-3 py-3 font-normal">Date</th>
                  <th className="px-3 py-3 text-right font-normal">Proceeds</th>
                  <th className="px-3 py-3 text-right font-normal">Fiscal gain / loss</th>
                  <th className="px-5 py-3 text-right font-normal">Commercial gain / loss</th>
                </tr>
              </thead>
              <tbody>
                {disposals.map((r) => (
                  <tr key={r.assetId} className="border-t border-foreground/10">
                    <td className="px-5 py-2.5">{r.name} <span className="font-mono text-xs text-muted-foreground">{r.code}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{r.disposalDate}</td>
                    <td className="px-3 py-2.5 text-right">{money(r.proceeds ?? 0)}</td>
                    <td className={cn("px-3 py-2.5 text-right", (r.fiscalGainLoss ?? 0) < 0 && "text-red-700 dark:text-red-400")}>{signed(r.fiscalGainLoss ?? 0)}</td>
                    <td className={cn("px-5 py-2.5 text-right text-muted-foreground")}>{signed(r.commercialGainLoss ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-5">
        <SectionHeading>What this assumes</SectionHeading>
        <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Depreciation starts in the month of acquisition and the first year is prorated by months. Declining balance
            charges twice the straight-line rate on the opening book value and takes what remains in the year the useful
            life ends; buildings are straight line only. A disposed asset is depreciated to the month before disposal, and
            the rest of its book value is the fiscal gain or loss. Starting depreciation when an asset first produces
            income, with DJP approval, is not modelled. Assets without a group are left out: set it on the{" "}
            <Link href="/dashboard/assets/register" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
              asset
            </Link>{" "}
            or its{" "}
            <Link href="/dashboard/assets/categories" className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400">
              category
            </Link>
            . Review with your tax adviser before filing.
          </p>
        </div>
      </section>
    </TaxReportShell>
  )
}
