"use client"

import { useState } from "react"
import { format, startOfYear } from "date-fns"
import { Search } from "lucide-react"

import { formatModuleMoney } from "@/lib/utils/module-money"
import { Input } from "@/components/ui/input"

export const qty = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 4 })
export const money = (n: number, currency = "IDR") => formatModuleMoney(n, currency)

/** Period and search state shared by the sales and purchase reports; defaults to the year to date. */
export function useTradeFilters() {
  const [start, setStart] = useState(() => format(startOfYear(new Date()), "yyyy-MM-dd"))
  const [end, setEnd] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [search, setSearch] = useState("")
  return { start, setStart, end, setEnd, search, setSearch }
}

export function TradeFilters({ filters, placeholder }: { filters: ReturnType<typeof useTradeFilters>; placeholder: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
      <label className="text-xs text-muted-foreground">
        From
        <Input type="date" value={filters.start} onChange={(e) => filters.setStart(e.target.value)} className="mt-1 w-40" />
      </label>
      <label className="text-xs text-muted-foreground">
        To
        <Input type="date" value={filters.end} onChange={(e) => filters.setEnd(e.target.value)} className="mt-1 w-40" />
      </label>
      <div className="relative ml-auto w-full sm:w-72">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder={placeholder} value={filters.search} onChange={(e) => filters.setSearch(e.target.value)} className="pl-9" />
      </div>
    </div>
  )
}

/** Labelled figures above a report table. */
export function FigureRow({ figures }: { figures: [string, React.ReactNode][] }) {
  return (
    <dl className="mb-6 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-foreground/10 py-4 sm:grid-cols-4">
      {figures.map(([label, value]) => (
        <div key={label}>
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
          <dd className="font-money mt-1 text-lg">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export const th = "py-2 pr-3 font-normal"
export const headRow = "text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
export const bodyRow = "border-t border-foreground/5"
export const footRow = "border-t border-foreground/15 font-semibold"

export function matches(term: string, ...values: (string | null)[]) {
  const t = term.trim().toLowerCase()
  return !t || values.some((v) => v?.toLowerCase().includes(t))
}
