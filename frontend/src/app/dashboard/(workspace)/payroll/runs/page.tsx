"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PERMISSIONS } from "@/lib/auth/permissions"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RBACGuard } from "@/components/auth/rbac-guard"
import { useCreatePayrollRun, usePayrollRuns } from "@/hooks/use-payroll"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import { SectionHeading, formatIsoDate } from "@/components/dashboard/module/module-primitives"
import { MONTHS, RunStatusBadge } from "@/components/dashboard/payroll/payroll-parts"

/** Every payroll run, newest first, and the form that calculates the next one. */
export default function PayrollRunsPage() {
  const router = useRouter()
  const { data, isPending, isError, error } = usePayrollRuns()
  const create = useCreatePayrollRun()

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [postingDate, setPostingDate] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    create.mutate(
      { year: Number(year), month: Number(month), postingDate: postingDate || undefined },
      { onSuccess: (run) => router.push(`/dashboard/payroll/runs/detail?id=${run.id}`) },
    )
  }

  if (isError && isModuleLocked(error)) return <ModuleLocked moduleName="Payroll" />

  return (
    <div className="flex-1 space-y-10">
      <header className="space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          Payroll
        </span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Payroll runs</h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          One run per month. A run is calculated as a draft from each employee&rsquo;s
          compensation, reviewed, and posted to the ledger by a second person. A posted run is
          voided, never edited.
        </p>
      </header>

      <RBACGuard permission={PERMISSIONS.PayrollManage}>
        <section className="space-y-5">
          <SectionHeading>Calculate a month</SectionHeading>
          <form
            onSubmit={submit}
            className="flex flex-wrap items-end gap-4 rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="run-month" className="text-xs text-muted-foreground">Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger id="run-month" className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-year" className="text-xs text-muted-foreground">Year</Label>
              <Input
                id="run-year"
                inputMode="numeric"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-9 w-24 font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="run-date" className="text-xs text-muted-foreground">Posting date</Label>
              <Input
                id="run-date"
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="h-9 w-44 font-mono"
              />
            </div>
            <Button type="submit" disabled={create.isPending || year.length !== 4} className="h-9 rounded-full px-5 text-xs">
              {create.isPending ? "Calculating…" : "Calculate run"}
            </Button>
            <p className="basis-full text-[12px] text-muted-foreground">
              The posting date defaults to the last day of the month.
            </p>
          </form>
        </section>
      </RBACGuard>

      <section className="space-y-5">
        <SectionHeading note={data ? `${data.length} runs` : undefined}>History</SectionHeading>

        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-5 py-3 font-normal">Period</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-3 py-3 text-right font-normal">Employees</th>
                <th className="px-3 py-3 text-right font-normal">Gross</th>
                <th className="px-3 py-3 text-right font-normal">PPh 21</th>
                <th className="px-3 py-3 text-right font-normal">Employer BPJS</th>
                <th className="px-5 py-3 text-right font-normal">Net pay</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {isPending ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-foreground/10 first:border-t-0">
                    <td colSpan={7} className="px-5 py-3.5"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-muted-foreground">
                    {error instanceof Error ? error.message : "Runs could not be loaded."}
                  </td>
                </tr>
              ) : data!.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-muted-foreground">
                    No payroll has been run yet.
                  </td>
                </tr>
              ) : (
                data!.map((run) => (
                  <tr key={run.id} className="border-t border-foreground/10 first:border-t-0 hover:bg-foreground/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/payroll/runs/detail?id=${run.id}`} className="text-foreground underline-offset-4 hover:underline">
                        {run.period}
                      </Link>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {formatIsoDate(run.postingDate)}
                        {run.journalReference && ` · ${run.journalReference}`}
                      </div>
                    </td>
                    <td className="px-3 py-3"><RunStatusBadge status={run.status} /></td>
                    <td className="px-3 py-3 text-right">{run.employees}</td>
                    <td className="px-3 py-3 text-right">{formatModuleMoney(run.totalGross, "IDR")}</td>
                    <td className="px-3 py-3 text-right">{formatModuleMoney(run.totalPph21, "IDR")}</td>
                    <td className="px-3 py-3 text-right">{formatModuleMoney(run.totalEmployerBpjs, "IDR")}</td>
                    <td className="px-5 py-3 text-right text-foreground">{formatModuleMoney(run.totalNetPay, "IDR")}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
