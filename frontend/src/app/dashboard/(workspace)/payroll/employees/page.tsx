"use client"

import { useState } from "react"
import Link from "next/link"

import { PERMISSIONS } from "@/lib/auth/permissions"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { isStorableAmount } from "@/lib/utils/minor-units"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCan } from "@/components/auth/rbac-guard"
import {
  usePayrollEmployees,
  useSaveCompensation,
  type PayrollEmployee,
} from "@/hooks/use-payroll"
import { ModuleLocked, isModuleLocked } from "@/components/dashboard/module/module-locked"
import { SectionHeading } from "@/components/dashboard/module/module-primitives"

/**
 * Employees are contacts marked as employees; NIK, PTKP and bank details are
 * kept on the contact. This screen holds what payroll alone reads: salary,
 * fixed allowance, the JKK risk rate and BPJS enrolment.
 */
export default function PayrollEmployeesPage() {
  const can = useCan()
  const { data, isPending, isError, error } = usePayrollEmployees()
  const [editing, setEditing] = useState<PayrollEmployee | null>(null)

  if (isError && isModuleLocked(error)) return <ModuleLocked moduleName="Payroll" />

  return (
    <div className="flex-1 space-y-10">
      <header className="space-y-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Payroll</span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Employees</h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Contacts marked as employees. PTKP status sets the TER category: A for TK/0, TK/1 and K/0;
          B for TK/2, TK/3, K/1 and K/2; C for K/3. Identity, PTKP and bank details are edited on the{" "}
          <Link href="/dashboard/contacts" className="text-foreground underline underline-offset-4">contact</Link>.
        </p>
      </header>

      <section className="space-y-5">
        <SectionHeading note={data ? `${data.length} employees` : undefined}>Compensation</SectionHeading>

        <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-foreground/10 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-5 py-3 font-normal">Employee</th>
                <th className="px-3 py-3 font-normal">PTKP</th>
                <th className="px-3 py-3 text-right font-normal">Base salary</th>
                <th className="px-3 py-3 text-right font-normal">Fixed allowance</th>
                <th className="px-3 py-3 font-normal">BPJS</th>
                <th className="px-3 py-3 font-normal">Record</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {isPending ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-foreground/10 first:border-t-0">
                    <td colSpan={7} className="px-5 py-3.5"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={7} className="px-5 py-6 text-muted-foreground">{error instanceof Error ? error.message : "Employees could not be loaded."}</td></tr>
              ) : data!.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-muted-foreground">
                    No contact is marked as an employee. Mark one on the contact record to add it here.
                  </td>
                </tr>
              ) : (
                data!.map((e) => (
                  <tr key={e.contactId} className="border-t border-foreground/10 align-top first:border-t-0">
                    <td className="px-5 py-3">
                      <div className="text-foreground">{e.name}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {e.code}{e.nik ? ` · NIK ${e.nik}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-[12px]">
                      {e.ptkpStatus ?? "—"} <span className="text-muted-foreground">· {e.terCategory}</span>
                    </td>
                    <td className="px-3 py-3 text-right">{e.compensation ? formatModuleMoney(e.compensation.baseSalary, "IDR") : "—"}</td>
                    <td className="px-3 py-3 text-right">{e.compensation ? formatModuleMoney(e.compensation.fixedAllowance, "IDR") : "—"}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                      {e.compensation
                        ? [
                            e.compensation.bpjsKetenagakerjaan && `TK ${e.compensation.jkkRate}%`,
                            e.compensation.bpjsPension && "JP",
                            e.compensation.bpjsKesehatan && "KES",
                          ].filter(Boolean).join(" · ") || "None"
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-[12px]">
                      {e.issues.length === 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Complete</span>
                      ) : (
                        <ul className="space-y-0.5 text-amber-700 dark:text-amber-400">
                          {e.issues.map((issue) => <li key={issue}>{issue}</li>)}
                        </ul>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {can(PERMISSIONS.PayrollManage) && (
                        <Button size="sm" variant="outline" onClick={() => setEditing(e)} className="h-7 rounded-full border-foreground/15 px-3 text-xs">
                          {e.compensation ? "Edit" : "Set pay"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <CompensationDialog employee={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function CompensationDialog({ employee, onClose }: { employee: PayrollEmployee; onClose: () => void }) {
  const save = useSaveCompensation()
  const c = employee.compensation
  const [baseSalary, setBaseSalary] = useState(String(c?.baseSalary ?? ""))
  const [fixedAllowance, setFixedAllowance] = useState(String(c?.fixedAllowance ?? 0))
  const [jkkRate, setJkkRate] = useState(String(c?.jkkRate ?? 0.24))
  const [tk, setTk] = useState(c?.bpjsKetenagakerjaan ?? true)
  const [jp, setJp] = useState(c?.bpjsPension ?? true)
  const [kes, setKes] = useState(c?.bpjsKesehatan ?? true)
  const [active, setActive] = useState(c?.isActive ?? true)

  const amountOk = (v: string) => v.trim() !== "" && isStorableAmount(v) && Number(v) >= 0
  const valid = amountOk(baseSalary) && amountOk(fixedAllowance) && amountOk(jkkRate) && Number(jkkRate) <= 10

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    save.mutate(
      {
        contactId: employee.contactId,
        baseSalary: Number(baseSalary),
        fixedAllowance: Number(fixedAllowance),
        jkkRate: Number(jkkRate),
        bpjsKetenagakerjaan: tk,
        bpjsPension: jp,
        bpjsKesehatan: kes,
        isActive: active,
      },
      { onSuccess: onClose },
    )
  }

  const toggles: [string, string, boolean, (v: boolean) => void][] = [
    ["tk", "BPJS Ketenagakerjaan (JKK, JKM, JHT)", tk, setTk],
    ["jp", "Jaminan Pensiun", jp, setJp],
    ["kes", "BPJS Kesehatan", kes, setKes],
    ["active", "Include in payroll runs", active, setActive],
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{employee.name}</DialogTitle>
            <DialogDescription>
              Monthly pay. Base salary and fixed allowance form the wage BPJS is computed on.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="base">Base salary (gaji pokok)</Label>
              <Input id="base" inputMode="decimal" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="font-mono tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allowance">Fixed allowance</Label>
              <Input id="allowance" inputMode="decimal" value={fixedAllowance} onChange={(e) => setFixedAllowance(e.target.value)} className="font-mono tabular-nums" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jkk">JKK rate, %</Label>
              <Input id="jkk" inputMode="decimal" value={jkkRate} onChange={(e) => setJkkRate(e.target.value)} className="font-mono tabular-nums" />
            </div>
          </div>

          <div className="space-y-3">
            {toggles.map(([id, label, checked, set]) => (
              <div key={id} className="flex items-center justify-between gap-4">
                <Label htmlFor={id} className="font-normal">{label}</Label>
                <Switch id={id} checked={checked} onCheckedChange={set} />
              </div>
            ))}
          </div>

          <p className="text-[12px] text-muted-foreground">
            JKK by workplace risk: 0.24, 0.54, 0.89, 1.27 or 1.74. A change applies to draft runs
            when they are recalculated; posted runs keep their figures.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
