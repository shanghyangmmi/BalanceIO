"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { apiClient } from "@/lib/api-client"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCompany } from "@/contexts/company-context"

/** Mirrors the answer of POST /api/Subscriptions/upgrade. */
export interface CheckoutResponse {
  paymentId: string
  orderId: string
  provider: string
  amount: number
  status: string
  redirectUrl: string | null
  token: string | null
  instructions: string | null
  message: string
}

/**
 * Starting payment for a plan, whatever the gateway. A hosted payment page
 * (Midtrans and the like) is followed; manual transfer instructions are
 * shown with the order number; a free plan is active at once.
 */
export function usePlanCheckout() {
  const { company } = useCompany()
  const client = useQueryClient()
  const [result, setResult] = useState<CheckoutResponse | null>(null)

  const checkout = useMutation({
    mutationFn: ({ planId, billingCycle }: { planId: string; billingCycle: "monthly" | "yearly" }) =>
      apiClient.post<CheckoutResponse>("/Subscriptions/upgrade", { companyId: company!.id, planId, billingCycle }),
    onSuccess: (res) => {
      if (res.status === "Success") {
        toast.success(res.message)
        client.invalidateQueries({ queryKey: ["subscription"] })
        client.invalidateQueries({ queryKey: ["dashboard"] })
        return
      }
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl
        return
      }
      setResult(res)
    },
  })

  const dialog = result && (
    <Dialog open onOpenChange={(open) => !open && setResult(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payment instructions</DialogTitle>
          <DialogDescription>The plan activates when the payment is confirmed.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Order</dt><dd className="font-mono">{result.orderId}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Amount</dt><dd className="font-money">{formatModuleMoney(result.amount, "IDR")}</dd></div>
        </dl>
        {result.instructions && <p className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 text-[13px] leading-relaxed">{result.instructions}</p>}
        <DialogFooter>
          <Button onClick={() => { navigator.clipboard?.writeText(result.orderId); toast.success("Order number copied") }} variant="outline">Copy order number</Button>
          <Button onClick={() => setResult(null)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { start: checkout.mutate, pending: checkout.isPending, dialog }
}

/**
 * The banner a payer sees on returning from a hosted payment page. Gateways
 * append order_id to the return URL; the status comes from our API, not
 * from the query string, which anyone can edit.
 */
export function PaymentReturnBanner() {
  const { company } = useCompany()
  const client = useQueryClient()
  // Read once on mount. The banner renders nothing until the status query
  // answers, so server and client markup agree during hydration.
  const [orderId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const params = new URLSearchParams(window.location.search)
    return params.get("order_id") ?? params.get("order")
  })

  const { data } = useQuery({
    queryKey: ["payment-status", company?.id, orderId],
    queryFn: () => apiClient.get<{ status: string; amount: number }>(`/Subscriptions/payments/status/${orderId}`),
    enabled: !!company && !!orderId,
    refetchInterval: (q) => (q.state.data?.status === "Pending" ? 5000 : false),
  })

  useEffect(() => {
    if (data?.status === "Success") {
      client.invalidateQueries({ queryKey: ["subscription"] })
      client.invalidateQueries({ queryKey: ["dashboard"] })
    }
  }, [data?.status, client])

  if (!orderId || !data) return null
  const text =
    data.status === "Success" ? "Payment received. The plan is active."
    : data.status === "Pending" ? "Waiting for the payment provider to confirm the payment…"
    : `Payment ${data.status.toLowerCase()}. Nothing was charged to the plan.`

  return (
    <div className="rounded-xl border border-foreground/10 bg-card/60 px-5 py-3 text-[13px]">
      <span className="font-mono text-[11px] text-muted-foreground">{orderId}</span> · {text}
    </div>
  )
}
