"use client"

import { useState } from "react"
import { FileSpreadsheet, Printer } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { useFinancialStatements, type StatementKey } from "@/hooks/use-financial-statements"
import {
  StatementDocument,
  type StatementLanguage,
  type StatementOrder,
} from "@/components/reports/statement-document"
import { exportStatementsToExcel } from "@/lib/reports/statement-excel"

/**
 * Laporan Keuangan / Financial Statements.
 *
 * Generated on the server from posted journal lines
 * (GET /Reports/financial-statements). This page only lays them out: A4
 * paper on screen, and the same paper through the browser's print dialog
 * for PDF, or as a workbook.
 */

const STATEMENTS: { key: StatementKey; label: string }[] = [
  { key: "sofp", label: "Statement of Financial Position (SoFP)" },
  { key: "pl", label: "Profit or Loss and OCI" },
  { key: "equity", label: "Changes in Equity" },
  { key: "cashflow", label: "Cash Flows" },
  { key: "tb", label: "Trial Balance" },
]

const LANGUAGES: { value: StatementLanguage; label: string }[] = [
  { value: "bilingual", label: "Bilingual" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "en", label: "English" },
]

function isoToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function FinancialStatementsPage() {
  const today = isoToday()
  const [start, setStart] = useState(`${today.slice(0, 4)}-01-01`)
  const [end, setEnd] = useState(today)
  const [comparative, setComparative] = useState(true)
  const [language, setLanguage] = useState<StatementLanguage>("bilingual")
  const [order, setOrder] = useState<StatementOrder>("id-en")
  const [include, setInclude] = useState<Record<string, boolean>>(
    Object.fromEntries(STATEMENTS.map((s) => [s.key, true])),
  )
  const [exporting, setExporting] = useState(false)

  const { data, isPending, isError, error, isFetching } = useFinancialStatements(start, end, comparative)
  const options = { language, order, include }
  const failedChecks = data?.statements.flatMap((s) => s.checks.filter((c) => !c.passed)).length ?? 0

  const excel = async () => {
    if (!data) return
    setExporting(true)
    try {
      await exportStatementsToExcel(data, options)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 space-y-8">
      {/* Paper rules: A4, Lato, page numbers in the bottom margin. Scoped to
          this route because @page is global while the page is mounted. */}
      <style>{`
        .statement-paper { font-family: var(--font-document), Arial, Helvetica, sans-serif; }
        .statement-page { background: #fff; padding: 18mm 16mm; }
        @page {
          size: A4;
          margin: 16mm 14mm 18mm;
          @bottom-right { content: counter(page); font: 8pt Arial, sans-serif; color: #555; }
        }
        @media print {
          html, body { background: #fff !important; }
          body * { background-color: transparent !important; box-shadow: none !important; }
          .statement-page { padding: 0; border: 0 !important; margin: 0 !important; }
          .statement-break { break-before: page; }
          .statement-paper tr { break-inside: avoid; }
        }
      `}</style>

      <header className="space-y-3 print:hidden">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Reports</span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Laporan keuangan{" "}
          <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
            Financial statements
          </span>
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          The full set from posted journal lines, with the prior year alongside. Bahasa Indonesia is the
          governing text and sits on the left by default; English is its translation. Every statement
          carries arithmetic checks, and a failed one is printed on the page.
        </p>
      </header>

      <section className="space-y-5 rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm print:hidden sm:p-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="fs-start" className="text-xs text-muted-foreground">From</Label>
            <Input id="fs-start" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="h-9 w-44 font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fs-end" className="text-xs text-muted-foreground">To</Label>
            <Input id="fs-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="h-9 w-44 font-mono" />
          </div>
          <div className="flex h-9 items-center gap-2">
            <Switch id="fs-compare" checked={comparative} onCheckedChange={setComparative} />
            <Label htmlFor="fs-compare" className="text-sm font-normal">Prior year comparative</Label>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => window.print()} disabled={!data} className="h-9 rounded-full border-foreground/15 px-4 text-xs">
              <Printer className="mr-2 h-3.5 w-3.5" /> Print / PDF
            </Button>
            <Button variant="outline" onClick={excel} disabled={!data || exporting} className="h-9 rounded-full border-foreground/15 px-4 text-xs">
              <FileSpreadsheet className="mr-2 h-3.5 w-3.5" /> {exporting ? "Exporting…" : "Excel"}
            </Button>
          </div>
        </div>

        <div className="h-px bg-foreground/10" />

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Language</legend>
            <div className="flex overflow-hidden rounded-full border border-foreground/15">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => setLanguage(l.value)}
                  aria-pressed={language === l.value}
                  className={cn(
                    "px-3.5 py-1.5 text-xs transition-colors",
                    language === l.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {language === "bilingual" && (
              <div className="flex items-center gap-2 pt-1">
                <Switch id="fs-order" checked={order === "en-id"} onCheckedChange={(v) => setOrder(v ? "en-id" : "id-en")} />
                <Label htmlFor="fs-order" className="text-xs font-normal text-muted-foreground">
                  {order === "id-en" ? "Indonesian left, English right" : "English left, Indonesian right"}
                </Label>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Statements</legend>
            <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {STATEMENTS.map((s) => (
                <label key={s.key} className="flex items-center gap-2 text-[13px] text-foreground">
                  <input
                    type="checkbox"
                    checked={include[s.key]}
                    onChange={(e) => setInclude((prev) => ({ ...prev, [s.key]: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-emerald-700"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {data && (
          <p
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.16em]",
              failedChecks > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {failedChecks > 0
              ? `${failedChecks} arithmetic check${failedChecks === 1 ? "" : "s"} failed — see the statements`
              : "All arithmetic checks pass"}
            {isFetching && <span className="text-muted-foreground"> · refreshing</span>}
          </p>
        )}
      </section>

      {start > end ? (
        <p className="text-sm text-muted-foreground print:hidden">The period end is before its start.</p>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6 text-sm print:hidden">
          {error instanceof Error ? error.message : "The statements could not be generated."}
        </div>
      ) : isPending ? (
        <Skeleton className="mx-auto h-[297mm] w-full max-w-[210mm]" />
      ) : (
        <div className="mx-auto max-w-[210mm] space-y-6 print:max-w-none print:space-y-0 [&_.statement-page]:border [&_.statement-page]:border-foreground/10 print:[&_.statement-page]:border-0">
          <StatementDocument pack={data} options={options} />
        </div>
      )}
    </div>
  )
}
