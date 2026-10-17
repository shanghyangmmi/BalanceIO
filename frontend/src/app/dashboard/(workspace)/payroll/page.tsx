"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarClock, FileSpreadsheet, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/components/auth/rbac-guard"
import { useModuleHealth } from "@/hooks/use-module-health"
import {
  useCreatePayrollRun,
  usePayrollOverview,
  type PayrollRunSummary,
} from "@/hooks/use-payroll"
import { ModuleMasthead } from "@/components/dashboard/module/module-masthead"
import { ModuleDoors, type Door } from "@/components/dashboard/module/module-doors"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import {
  Figure,
  SectionHeading,
  Sep,
  formatIsoDate,
} from "@/components/dashboard/module/module-primitives"
import { RunStatusBadge } from "@/components/dashboard/payroll/payroll-parts"

/**
 * The Payroll module dashboard.
 *
 * Payroll earns its place by what it posts: salary expense, employer BPJS,
 * and the PPh 21, BPJS and net pay owed against them. Every figure here is
 * read from posted or calculated runs; nothing is estimated.
 */

const DOORS: Door[] = [
  {
    label: "Payroll Runs",
    description: "Calculate a month, review each payslip, post it to the ledger.",
    href: "/dashboard/payroll/runs",
    icon: CalendarClock,
  },
  {
    label: "Employees",
    description: "Salary, allowance, PTKP status and BPJS enrolment per employee.",
    href: "/dashboard/payroll/employees",
    icon: Users,
  },
  {
    label: "Withholding",
    description: "PPh 21 from posted runs beside PPh 22, 23 and 4(2), for e-Bupot.",
    href: "/dashboard/tax/withholding",
    icon: FileSpreadsheet,
  },
]

export default function PayrollModulePage() {
  const router = useRouter()
  const can = useCan()
  const { data, isPending, isError, error, isFetching, refetch, dataUpdatedAt } = usePayrollOverview()
  const health = useModuleHealth()
  const card = health.data?.modules.find((m) => m.key === "payroll")
  const create = useCreatePayrollRun()

  // The latest run that is not void: this month's if it exists, else last month's.
  const latest: PayrollRunSummary | null = data ? data.currentRun ?? data.previousRun : null

  const asOf = data
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(dataUpdatedAt))
    : null

  const calculate = () => {
    if (!data) return
    create.mutate(
      { year: data.year, month: data.month },
      { onSuccess: (run) => router.push(`/dashboard/payroll/runs/detail?id=${run.id}`) },
    )
  }

  return (
    <div className="flex-1 space-y-10">
      <ModuleMasthead
        moduleName="Payroll"
        title="Salary expense, on the"
        accent="ledger."
        lede="Each month's run: earnings, PPh 21 under TER, BPJS on both sides, and the journal entry that carries them into the general ledger."
        status={card?.status}
        headline={card?.headline}
        detail={card?.detail}
        asOf={asOf}
        isFetching={isFetching}
        onRefresh={() => {
          refetch()
          health.refetch()
        }}
      />

      {isError && isModuleLocked(error) ? (
        <ModuleLocked moduleName="Payroll" />
      ) : isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6">
          <p className="text-sm font-medium text-foreground">Payroll figures are unavailable.</p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "The request did not complete."} No figures
            are shown rather than stale ones.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="mt-4 h-8 rounded-full border-foreground/10 px-3 text-xs"
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* ── The latest run ─────────────────────────────────────────
              Gross less PPh 21 and employee BPJS is net pay; employer BPJS
              sits on top as cost. Four figures the reader can reconcile. */}
          <section className="space-y-5">
            <SectionHeading note={latest ? `${latest.period} · ${latest.employees} employees` : undefined}>
              Latest run
            </SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid min-h-[104px] divide-y divide-foreground/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-24" />
                      <Skeleton className="h-7 w-32" />
                    </div>
                  ))
                ) : latest ? (
                  <>
                    <Figure label="Gross earnings" value={formatModuleMoney(latest.totalGross, data!.currency)} />
                    <Figure label="PPh 21 withheld" value={formatModuleMoney(latest.totalPph21, data!.currency)} />
                    <Figure
                      label="BPJS"
                      value={formatModuleMoney(latest.totalEmployerBpjs, data!.currency)}
                      note={`Employer · ${formatModuleMoney(latest.totalEmployeeBpjs, data!.currency)} employee`}
                    />
                    <Figure label="Net pay" value={formatModuleMoney(latest.totalNetPay, data!.currency)} />
                  </>
                ) : (
                  <p className="p-5 text-[13px] leading-relaxed text-muted-foreground sm:col-span-4 sm:p-6">
                    No run for {data!.period} or the month before. Calculate one below; it stays a
                    draft until a second person posts it.
                  </p>
                )}
              </div>

              <div className="flex min-h-[46px] flex-wrap items-center justify-between gap-3 border-t border-foreground/10 px-5 py-3 sm:px-6">
                {isPending ? (
                  <Skeleton className="h-3 w-72" />
                ) : (
                  <>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {data!.period}
                      <Sep />
                      {data!.currentRun ? (
                        <RunStatusBadge status={data!.currentRun.status} />
                      ) : (
                        "Not calculated"
                      )}
                      {latest?.journalReference && (
                        <>
                          <Sep />
                          {latest.journalReference}
                        </>
                      )}
                    </p>

                    {data!.currentRun ? (
                      <Link
                        href={`/dashboard/payroll/runs/detail?id=${data!.currentRun.id}`}
                        className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground underline-offset-4 hover:underline"
                      >
                        Open {data!.period}
                      </Link>
                    ) : (
                      can(PERMISSIONS.PayrollManage) && (
                        <Button
                          size="sm"
                          onClick={calculate}
                          disabled={create.isPending || data!.employees === 0}
                          className="h-8 rounded-full px-4 text-xs"
                        >
                          {create.isPending ? "Calculating…" : `Calculate ${data!.period}`}
                        </Button>
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-3 lg:gap-5">
            {/* ── Year to date ────────────────────────────────────────── */}
            <section className="space-y-5 lg:col-span-2">
              <SectionHeading note={data ? `Posted runs, ${data.year}` : undefined}>Year to date</SectionHeading>

              <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
                {isPending ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-4 w-full" />
                    ))}
                  </div>
                ) : (
                  <dl className="divide-y divide-foreground/10 text-[13px]">
                    {[
                      ["Gross earnings", data!.yearGross],
                      ["PPh 21 withheld", data!.yearPph21],
                      ["Employer BPJS", data!.yearEmployerBpjs],
                      ["Employee BPJS", data!.yearEmployeeBpjs],
                      ["Net pay", data!.yearNetPay],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-money text-foreground">
                          {formatModuleMoney(value as number, data!.currency)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </section>

            {/* ── Filing calendar ─────────────────────────────────────── */}
            <section className="space-y-5">
              <SectionHeading>Remittance and filing</SectionHeading>

              <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
                {isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                ) : data!.deadlines.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Nothing is due until a run is posted.
                  </p>
                ) : (
                  <ul className="divide-y divide-foreground/10">
                    {data!.deadlines.map((d) => (
                      <li key={d.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="text-[13px] text-foreground">{d.label}</div>
                          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {formatIsoDate(d.due)}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-[11px] tabular-nums",
                            d.daysRemaining < 0
                              ? "text-red-700 dark:text-red-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {d.daysRemaining < 0
                            ? `${-d.daysRemaining}d past`
                            : d.daysRemaining === 0
                              ? "Today"
                              : `${d.daysRemaining}d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* ── Workforce ──────────────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading note={data ? `${data.employees} on payroll` : undefined}>Workforce</SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid min-h-[104px] divide-y divide-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-24" />
                      <Skeleton className="h-7 w-20" />
                    </div>
                  ))
                ) : (
                  <>
                    <Figure label="Monthly fixed pay" value={formatModuleMoney(data!.monthlyBaseCost, data!.currency)} note="Salary and fixed allowance" />
                    <Figure
                      label="Without compensation"
                      value={String(data!.employeesWithoutCompensation)}
                      tone={data!.employeesWithoutCompensation > 0 ? "text-amber-700 dark:text-amber-400" : undefined}
                      note="Left out of every run"
                    />
                    <Figure
                      label="Records incomplete"
                      value={String(data!.employeesWithIssues)}
                      tone={data!.employeesWithIssues > 0 ? "text-amber-700 dark:text-amber-400" : undefined}
                      note="PTKP, NIK or bank account"
                    />
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <SectionHeading>Working screens</SectionHeading>
            <ModuleDoors doors={DOORS} />
          </section>
        </>
      )}

      <footer className="space-y-4 pt-2">
        <div className="h-px bg-gradient-to-r from-foreground/10 to-transparent" />
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          PPh 21 follows PP 58/2023: the monthly TER rate from January to November, the Pasal 17
          settlement in December. BPJS wage caps are configuration and change each year. Both need
          practitioner review before the figures are relied on.
        </p>
      </footer>
    </div>
  )
}
