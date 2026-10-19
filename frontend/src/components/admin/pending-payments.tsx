"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { adminApiClient } from "@/lib/api-client"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Mirrors GET /api/admin/payments. */
interface AdminPayment {
  id: string
  orderId: string
  provider: string
  amount: number
  status: string
  billingCycle: string | null
  company: string | null
  plan: string | null
  createdAt: string
  paidAt: string | null
}

const STATUSES = ["Pending", "Success", "Failed", "Expired", "Cancelled", "Refunded"]

/**
 * Payments across companies. A manual transfer is confirmed here once it
 * shows in the bank account; confirming activates the plan. Gateway
 * payments confirm themselves through their webhook and are listed only.
 */
export function PendingPayments() {
  const client = useQueryClient()
  const [status, setStatus] = useState("Pending")
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "payments", status],
    queryFn: () => adminApiClient.get<AdminPayment[]>(`/admin/payments?status=${status}`),
  })

  const confirm = useMutation({
    mutationFn: (id: string) => adminApiClient.post(`/admin/payments/${id}/confirm`, {}),
    onSuccess: () => {
      toast.success("Payment confirmed; the plan is active.")
      return client.invalidateQueries({ queryKey: ["admin", "payments"] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Confirm a manual transfer only after it appears in the bank account.</p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-sm tabular-nums">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 font-medium">Order</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Provider</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground">Loading…</td></tr>
            ) : isError ? (
              <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground">{error instanceof Error ? error.message : "Payments could not be loaded."}</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-muted-foreground">No {status.toLowerCase()} payments.</td></tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{p.orderId}</td>
                  <td className="px-3 py-2">{p.company ?? "—"}</td>
                  <td className="px-3 py-2">{p.plan ?? "—"}{p.billingCycle ? ` · ${p.billingCycle}` : ""}</td>
                  <td className="px-3 py-2">{p.provider}</td>
                  <td className="px-3 py-2 text-right">{formatModuleMoney(p.amount, "IDR")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-4 py-2 text-right">
                    {p.status === "Pending" && p.provider === "manual" && (
                      <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate(p.id)}>Confirm transfer</Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
