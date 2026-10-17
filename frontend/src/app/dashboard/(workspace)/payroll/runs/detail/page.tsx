"use client"

import { Fragment, Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { balanceOf, isStorableAmount, minorToNumber, sumMinor } from "@/lib/utils/minor-units"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/components/auth/rbac-guard"
import {
  usePayrollRun,
  usePayrollRunAction,
  type PayrollLine,
  type PayrollRunDetail,
} from "@/hooks/use-payroll"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import { Figure, SectionHeading, Sep, formatIsoDate } from "@/components/dashboard/module/module-primitives"
import { RunStatusBadge, terLabel } from "@/components/dashboard/payroll/payroll-parts"

/**
 * One payroll run: every employee's breakdown, the journal entry it posts,
 * and the actions its state allows. The id travels as a query parameter
 * because the frontend is a static export.
 */
export default function PayrollRunPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <PayrollRun />
    </Suspense>
  )
}

function PayrollRun() {
  const id = useSearchParams().get("id")
  const { data, isPending, isError, error } = usePayrollRun(id)

  if (!id) {
    return <p className="text-sm text-muted-foreground">No run selected. <Link href="/dashboard/payroll/runs" className="underline">Back to payroll runs</Link>.</p>
  }
  if (isError && isModuleLocked(error)) return <ModuleLocked moduleName="Payroll" />
  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6 text-sm">
        {error instanceof Error ? error.message : "The run could not be loaded."}
      </div>
    )
  }
  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return <RunView run={data} />
}

function RunView({ run }: { run: PayrollRunDetail }) {
  const router = useRouter()
  const can = useCan()
  const actions = usePayrollRunAction(run.id)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState("")

  const isDraft = run.status === "Draft"
  const editable = isDraft && can(PERMISSIONS.PayrollManage)
  const busy = Object.values(actions).some((m) => m.isPending)
  const balance = balanceOf(run.journal)
  const money = (v: number) => formatModuleMoney(v, run.currency)
  const add = (...values: number[]) => minorToNumber(sumMinor(values))

  const toggle = (lineId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(lineId)) next.delete(lineId)
      else next.add(lineId)
      return next
    })

  return (
    <div className="flex-1 space-y-10">
      <header className="space-y-3">
        <Link href="/dashboard/payroll/runs" className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground hover:text-foreground">
          Payroll runs
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{run.period}</h1>
          <RunStatusBadge status={run.status} />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Posting date {formatIsoDate(run.postingDate)}
          <Sep />
          {run.employees} employees
          {run.createdBy && (<><Sep />Calculated by {run.createdBy}</>)}
          {run.approvedBy && (<><Sep />Posted by {run.approvedBy}</>)}
          {run.journalReference && run.journalEntryId && (
            <>
              <Sep />
              <Link href={`/dashboard/accounting/journal/edit?id=${run.journalEntryId}`} className="text-foreground underline-offset-4 hover:underline">
                {run.journalReference}
              </Link>
            </>
          )}
        </p>
        {run.notes && <p className="max-w-2xl text-[13px] text-muted-foreground">{run.notes}</p>}
      </header>

      <section className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
        <div className="grid divide-y divide-foreground/10 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
          <Figure label="Gross earnings" value={money(run.totalGross)} />
          <Figure label="PPh 21" value={money(run.totalPph21)} />
          <Figure label="Employee BPJS" value={money(run.totalEmployeeBpjs)} />
          <Figure label="Net pay" value={money(run.totalNetPay)} />
          <Figure label="Cost to company" value={money(run.totalCost)} note="Gross plus employer BPJS" />
        </div>
      </section>

      {/* ── What can happen next ──────────────────────────────────────── */}
      {run.status !== "Void" && (
        <section className="space-y-4">
          {isDraft && run.blockers.length > 0 && (
            <ul className="space-y-1.5 rounded-xl border border-amber-600/25 bg-amber-500/[0.04] p-4 text-[13px] text-foreground sm:px-5">
              {run.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {isDraft && can(PERMISSIONS.PayrollApprove) && (
              <Button
                onClick={() => actions.post.mutate()}
                disabled={busy || run.blockers.length > 0}
                className="h-9 rounded-full px-5 text-xs"
              >
                {actions.post.isPending ? "Posting…" : "Post to general ledger"}
              </Button>
            )}
            {editable && (
              <>
                <Button variant="outline" onClick={() => actions.recalculate.mutate()} disabled={busy} className="h-9 rounded-full border-foreground/15 px-4 text-xs">
                  {actions.recalculate.isPending ? "Recalculating…" : "Recalculate"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => actions.remove.mutate(undefined, { onSuccess: () => router.push("/dashboard/payroll/runs") })}
                  disabled={busy}
                  className="h-9 rounded-full px-4 text-xs text-red-700 hover:text-red-700 dark:text-red-400"
                >
                  Delete draft
                </Button>
              </>
            )}
            {run.status === "Posted" && can(PERMISSIONS.PayrollApprove) && !voiding && (
              <Button variant="outline" onClick={() => setVoiding(true)} className="h-9 rounded-full border-foreground/15 px-4 text-xs">
                Void run
              </Button>
            )}
            {voiding && (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  actions.void.mutate(reason, { onSuccess: () => setVoiding(false) })
                }}
              >
                <Input
                  autoFocus
                  placeholder="Reason for voiding"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9 w-72"
                />
                <Button type="submit" variant="destructive" disabled={busy || !reason.trim()} className="h-9 rounded-full px-4 text-xs">
                  {actions.void.isPending ? "Voiding…" : "Void run and its journal"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setVoiding(false)} className="h-9 text-xs">
                  Cancel
                </Button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* ── Employees ─────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note={run.warnings > 0 ? `${run.warnings} with warnings` : "Select a row for its breakdown"}>
          Employees
        </SectionHeading>

        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-5 py-3 font-normal">Employee</th>
                <th className="px-3 py-3 text-right font-normal">Salary + allowance</th>
                <th className="px-3 py-3 text-right font-normal">Other earnings</th>
                <th className="px-3 py-3 text-right font-normal">Taxable gross</th>
                <th className="px-3 py-3 text-right font-normal">TER</th>
                <th className="px-3 py-3 text-right font-normal">PPh 21</th>
                <th className="px-3 py-3 text-right font-normal">Employee BPJS</th>
                <th className="px-5 py-3 text-right font-normal">Net pay</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {run.lines.map((line) => (
                <Fragment key={line.id}>
                  <tr
                    className="cursor-pointer border-t border-foreground/10 first:border-t-0 hover:bg-foreground/[0.02]"
                    onClick={() => toggle(line.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", expanded.has(line.id) && "rotate-90")} />
                        <div className="min-w-0">
                          <div className="truncate text-foreground">{line.employeeName}</div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            {line.ptkpStatus} · TER {line.terCategory}
                            {line.warning && <span className="text-amber-700 dark:text-amber-400"> · check</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">{money(add(line.baseSalary, line.fixedAllowance))}</td>
                    <td className="px-3 py-3 text-right" onClick={(e) => editable && e.stopPropagation()}>
                      {editable ? (
                        <OtherEarnings line={line} disabled={busy} onSave={(v) => actions.updateLine.mutate({ lineId: line.id, otherEarnings: v })} />
                      ) : (
                        money(line.otherEarnings)
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">{money(line.taxableGross)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[12px]">{terLabel(line.terRate, line.pph21Method)}</td>
                    <td className="px-3 py-3 text-right">{money(line.pph21)}</td>
                    <td className="px-3 py-3 text-right">{money(add(line.employeeJht, line.employeeJp, line.employeeKesehatan))}</td>
                    <td className="px-5 py-3 text-right text-foreground">{money(line.netPay)}</td>
                  </tr>
                  {expanded.has(line.id) && <Breakdown line={line} money={money} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── The journal entry ─────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note={run.status === "Posted" ? "As posted" : run.status === "Void" ? "Voided" : "Created on posting"}>
          Journal entry
        </SectionHeading>

        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-5 py-3 font-normal">Account</th>
                <th className="px-3 py-3 font-normal">Description</th>
                <th className="px-3 py-3 text-right font-normal">Debit</th>
                <th className="px-5 py-3 text-right font-normal">Credit</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {run.journal.map((l) => (
                <tr key={l.accountCode} className="border-t border-foreground/10 first:border-t-0">
                  <td className="px-5 py-3">
                    <span className="font-mono text-[12px] text-muted-foreground">{l.accountCode}</span>{" "}
                    <span className={cn(l.credit > 0 && "pl-4", "text-foreground")}>{l.accountName}</span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{l.description}</td>
                  <td className="px-3 py-3 text-right">{l.debit > 0 ? money(l.debit) : ""}</td>
                  <td className="px-5 py-3 text-right">{l.credit > 0 ? money(l.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-foreground/20 font-mono text-[11px] uppercase tracking-[0.12em]">
                <td className="px-5 py-3 text-muted-foreground" colSpan={2}>
                  {balance.balanced ? (
                    <span className="text-emerald-700 dark:text-emerald-400">Debits equal credits</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">Out of balance</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-foreground">{money(minorToNumber(balance.debit))}</td>
                <td className="px-5 py-3 text-right text-foreground">{money(minorToNumber(balance.credit))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}

function OtherEarnings({ line, disabled, onSave }: { line: PayrollLine; disabled: boolean; onSave: (value: number) => void }) {
  const [value, setValue] = useState(String(line.otherEarnings))
  const valid = value.trim() !== "" && isStorableAmount(value) && Number(value) >= 0

  const commit = () => {
    if (!valid || Number(value) === line.otherEarnings) return
    onSave(Number(value))
  }

  return (
    <Input
      inputMode="decimal"
      value={value}
      disabled={disabled}
      aria-label={`Other earnings for ${line.employeeName}`}
      aria-invalid={!valid}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="ml-auto h-8 w-36 text-right font-mono tabular-nums"
    />
  )
}

function Breakdown({ line, money }: { line: PayrollLine; money: (v: number) => string }) {
  const rows: [string, number][][] = [
    [
      ["Base salary", line.baseSalary],
      ["Fixed allowance", line.fixedAllowance],
      ["Other earnings", line.otherEarnings],
    ],
    [
      ["JHT, employee 2%", line.employeeJht],
      ["JP, employee 1%", line.employeeJp],
      ["Kesehatan, employee 1%", line.employeeKesehatan],
    ],
    [
      ["JKK, employer", line.employerJkk],
      ["JKM, employer 0.3%", line.employerJkm],
      ["JHT, employer 3.7%", line.employerJht],
      ["JP, employer 2%", line.employerJp],
      ["Kesehatan, employer 4%", line.employerKesehatan],
    ],
  ]
  const headings = ["Earnings", "Deducted from pay", "Paid by the company"]

  return (
    <tr className="bg-foreground/[0.015]">
      <td colSpan={8} className="px-5 pb-5 pt-1">
        <div className="grid gap-6 pl-6 sm:grid-cols-3">
          {rows.map((group, i) => (
            <dl key={headings[i]} className="space-y-1.5">
              <dt className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{headings[i]}</dt>
              {group.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 text-[12px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-money text-foreground">{money(value)}</span>
                </div>
              ))}
            </dl>
          ))}
        </div>
        <p className="mt-4 pl-6 text-[12px] text-muted-foreground">
          {line.pph21Method === "Annual"
            ? "December settles the year under Pasal 17, less the TER withheld January to November. A negative figure is returned in net pay."
            : `PPh 21 is ${terLabel(line.terRate, line.pph21Method)} of taxable gross, TER category ${line.terCategory}. Taxable gross adds the JKK, JKM and Kesehatan premiums the company pays.`}
          {line.nik ? ` NIK ${line.nik}.` : " No NIK recorded."}
        </p>
        {line.warning && <p className="mt-2 pl-6 text-[12px] text-amber-700 dark:text-amber-400">{line.warning}</p>}
      </td>
    </tr>
  )
}
