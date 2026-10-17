"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Check, Lock } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { PERMISSIONS } from "@/lib/auth/permissions"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NoPermission, RBACGuard, useCan } from "@/components/auth/rbac-guard"
import { useCompany } from "@/contexts/company-context"
import { useModuleDoors } from "@/hooks/use-module-doors"

/** Mirrors GET /api/Plans. */
interface Plan {
  id: string
  name: string
  description: string | null
  priceMonthly: number
  priceYearly: number
  features: string | null
  maxUsers: number
  maxCompanies: number
  isPopular: boolean
}

/** Mirrors GET /api/Subscriptions/current/{companyId}. */
interface CurrentSubscription {
  id: string
  plan: { id: string; name: string; priceMonthly: number; priceYearly: number }
  startDate: string
  endDate: string
  billingCycle: number
  autoRenew: boolean
}

function parseFeatures(json: string | null): string[] {
  if (!json) return []
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

/**
 * The company's plan, the plans on offer, and the modules each door opens.
 * Everything here is read from the API; the page used to show three
 * hard-coded plans whose prices did not match the ones being charged.
 */
function SubscriptionContent() {
  const { company } = useCompany()
  const can = useCan()
  const doors = useModuleDoors()

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiClient.get<Plan[]>("/Plans"),
    retry: retryUnlessClientError,
  })
  const current = useQuery({
    queryKey: ["subscription", company?.id],
    queryFn: () => apiClient.get<CurrentSubscription>(`/Subscriptions/current/${company!.id}`),
    enabled: !!company,
    retry: retryUnlessClientError,
  })
  const upgrade = useMutation({
    mutationFn: (planId: string) =>
      apiClient.post<{ message: string }>("/Subscriptions/upgrade", { companyId: company!.id, planId, billingCycle: "monthly" }),
    onSuccess: (res) => toast.info(res.message),
  })

  const currentPlanId = current.data?.plan.id

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg font-bold">Subscription</h3>
        <p className="text-[13px] text-muted-foreground">
          The plan decides which modules open. Online payment is not connected yet; a plan change is recorded as a request.
        </p>
      </div>

      <section className="rounded-xl border border-foreground/10 bg-card/60 p-5 sm:p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Current plan</div>
        {current.isPending ? (
          <Skeleton className="mt-3 h-6 w-48" />
        ) : current.isError ? (
          <p className="mt-2 text-sm text-muted-foreground">No active subscription. Only the Accounting module is open.</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="font-display text-xl font-bold">{current.data.plan.name}</span>
            <span className="font-money text-sm">{formatModuleMoney(current.data.plan.priceMonthly, "IDR")} / month</span>
            <span className="text-[13px] text-muted-foreground">
              Until {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(current.data.endDate))}
            </span>
          </div>
        )}

        {doors.data && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {doors.data.doors.map((d) => (
              <li
                key={d.key}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                  d.entitled
                    ? "border-emerald-600/30 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400"
                    : "border-foreground/15 text-muted-foreground",
                )}
              >
                {d.entitled ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {d.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {plans.isPending
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)
          : plans.isError
            ? <p className="text-sm text-muted-foreground">Plans could not be loaded.</p>
            : plans.data.map((plan) => {
                const isCurrent = plan.id === currentPlanId
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex flex-col rounded-xl border bg-card/60 p-5 sm:p-6",
                      isCurrent ? "border-emerald-600/40 dark:border-emerald-400/40" : "border-foreground/10",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="font-display text-base font-bold">{plan.name}</h4>
                      {isCurrent && (
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">Active</span>
                      )}
                    </div>
                    {plan.description && <p className="mt-1 text-[13px] text-muted-foreground">{plan.description}</p>}
                    <div className="mt-4 font-money text-2xl">
                      {plan.priceMonthly === 0 ? "Free" : formatModuleMoney(plan.priceMonthly, "IDR")}
                      {plan.priceMonthly > 0 && <span className="text-sm text-muted-foreground"> / month</span>}
                    </div>
                    {plan.priceYearly > 0 && (
                      <div className="font-money text-xs text-muted-foreground">{formatModuleMoney(plan.priceYearly, "IDR")} / year</div>
                    )}
                    <ul className="mt-5 flex-1 space-y-1.5 text-[13px]">
                      {parseFeatures(plan.features).map((f) => (
                        <li key={f} className="flex gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {can(PERMISSIONS.SettingsManage) && !isCurrent && (
                      <Button
                        variant="outline"
                        className="mt-6 rounded-full border-foreground/15"
                        disabled={upgrade.isPending || !company}
                        onClick={() => upgrade.mutate(plan.id)}
                      >
                        Request {plan.name}
                      </Button>
                    )}
                  </div>
                )
              })}
      </section>
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <RBACGuard permission={PERMISSIONS.SettingsView} fallback={<NoPermission permission={PERMISSIONS.SettingsView} />}>
      <SubscriptionContent />
    </RBACGuard>
  )
}
