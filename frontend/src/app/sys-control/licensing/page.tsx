"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  useLicensingMatrix,
  usePlatformUsage,
  useSeedCatalogue,
  useSetPairing,
  type AdminFeature,
  type AdminPlan,
} from "@/hooks/use-admin"
import {
  Empty,
  ErrorNote,
  Masthead,
  money,
  Panel,
  Pill,
  Row,
  SectionHeading,
  Sep,
  TableShell,
  Td,
  Th,
} from "@/components/sys-control/admin-primitives"

/**
 * Pricing, as a grid.
 *
 * The panel could already edit a plan's price and its four numeric limits.
 * What it could not express is the thing the business actually turns on:
 * which capabilities a tier includes, what each one is worth on its own,
 * and who has bought one separately.
 *
 * Plans are columns and features are rows because that is how the decision
 * is made. "Does Pro include Ekualisasi" is never asked alone - it is
 * asked against what Starter gets, and a form that shows one plan at a
 * time hides the comparison that is the whole point.
 */
export default function LicensingPage() {
  const matrix = useLicensingMatrix()
  const usage = usePlatformUsage()
  const seed = useSeedCatalogue()
  const setPairing = useSetPairing()

  const grouped = React.useMemo(() => {
    if (!matrix.data) return []

    const byModule = new Map<string, AdminFeature[]>()
    for (const feature of matrix.data.features) {
      const list = byModule.get(feature.module) ?? []
      list.push(feature)
      byModule.set(feature.module, list)
    }

    // Doors first, then what sits behind them, then everything that
    // belongs to no module.
    const order = ["tax", "inventory", "fixedAssets", "accounting", "payroll", "platform"]
    return [...byModule.entries()].sort(
      (a, b) => (order.indexOf(a[0]) + 99) % 99 || 0 - ((order.indexOf(b[0]) + 99) % 99),
    )
  }, [matrix.data])

  const included = React.useCallback(
    (planId: string, featureKey: string) =>
      matrix.data?.pairings.find((p) => p.planId === planId && p.featureKey === featureKey)
        ?.included ?? null,
    [matrix.data],
  )

  return (
    <div className="space-y-10 pb-16">
      <Masthead
        title="Plans and"
        accent="pricing."
        lede="What each tier costs, what it includes, and what each capability is worth on its own. A key of the form module.tax opens a door; everything else is a capability behind one."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={seed.isPending}
            onClick={async () => {
              const result = await seed.mutateAsync()
              toast.success("Catalogue", { description: result.message })
            }}
          >
            {seed.isPending ? "Seeding…" : "Seed catalogue"}
          </Button>
        }
      />

      {matrix.isError ? (
        <ErrorNote
          message={matrix.error instanceof Error ? matrix.error.message : undefined}
          onRetry={() => matrix.refetch()}
        />
      ) : matrix.isPending ? (
        <Panel className="space-y-4 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Panel>
      ) : (
        <>
          {/* ── The plans ────────────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading note={`${matrix.data.plans.length} plan(s)`}>Tiers</SectionHeading>

            {matrix.data.plans.length === 0 ? (
              <Empty title="No plans exist yet.">
                Plans are created through the subscriptions screen. Without one, every company
                falls back to the core module and no limit applies.
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matrix.data.plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </section>

          {/* ── The grid ─────────────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading note={`${matrix.data.features.length} feature(s)`}>
              What each tier includes
            </SectionHeading>

            {matrix.data.features.length === 0 ? (
              <Empty title="The catalogue is empty.">
                Seed it to start from the doors and capabilities that exist today, then price
                them. Nothing is gated until a feature exists here — an unlisted capability is
                available to everyone.
              </Empty>
            ) : (
              <Panel className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" style={{ minWidth: "52rem" }}>
                  <thead>
                    <tr className="border-b border-foreground/10">
                      <th className="sticky left-0 z-10 bg-card/95 px-5 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                        Feature
                      </th>
                      <th className="px-4 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                        On its own
                      </th>
                      {matrix.data.plans.map((plan) => (
                        <th
                          key={plan.id}
                          className="px-4 py-3 text-center font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground"
                        >
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map(([module, features]) => (
                      <React.Fragment key={module}>
                        <tr className="border-t border-foreground/10 bg-foreground/[0.02]">
                          <td
                            colSpan={matrix.data.plans.length + 2}
                            className="px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                          >
                            {module}
                          </td>
                        </tr>
                        {features.map((feature) => (
                          <tr key={feature.key} className="border-t border-foreground/10">
                            <td className="sticky left-0 z-10 bg-card/95 px-5 py-3 backdrop-blur">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "text-[13px]",
                                    feature.isActive
                                      ? "text-foreground"
                                      : "text-muted-foreground line-through",
                                  )}
                                >
                                  {feature.name}
                                </span>
                                {feature.isModuleDoor && <Pill tone="good">Door</Pill>}
                                {feature.purchasedBy > 0 && (
                                  <Pill>{feature.purchasedBy} bought</Pill>
                                )}
                              </div>
                              <div className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground">
                                {feature.key}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {feature.isAddOn && feature.priceMonthly > 0 ? (
                                <span className="font-money text-[13px] tabular-nums text-foreground">
                                  {money(feature.priceMonthly)}
                                  <span className="text-muted-foreground">/mo</span>
                                </span>
                              ) : (
                                <span className="text-[13px] text-muted-foreground">
                                  {feature.isAddOn ? "not priced" : "tier only"}
                                </span>
                              )}
                            </td>
                            {matrix.data.plans.map((plan) => {
                              const state = included(plan.id, feature.key)
                              return (
                                <td key={plan.id} className="px-4 py-3 text-center">
                                  <button
                                    onClick={() =>
                                      setPairing.mutate({
                                        planId: plan.id,
                                        featureKey: feature.key,
                                        included: state !== true,
                                      })
                                    }
                                    title={
                                      state === null
                                        ? "Not decided — click to include"
                                        : state
                                          ? "Included — click to exclude"
                                          : "Excluded — click to include"
                                    }
                                    className={cn(
                                      "mx-auto flex h-6 w-6 items-center justify-center rounded-md text-[13px] transition-colors",
                                      state === true &&
                                        "bg-emerald-600/12 text-emerald-700 dark:text-emerald-400",
                                      state === false && "bg-foreground/[0.05] text-muted-foreground",
                                      state === null &&
                                        "border border-dashed border-foreground/20 text-muted-foreground/50 hover:border-foreground/40",
                                    )}
                                  >
                                    {state === true ? "✓" : state === false ? "—" : ""}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              An empty cell means nobody has decided. It reads differently from an explicit
              exclusion, and it should: one says this plan has not been priced against this
              capability yet, the other says it was considered and left out.
            </p>
          </section>

          {/* ── Who is against a ceiling ─────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading
              note={usage.data ? `counted per ${usage.data.window.toLowerCase()}` : undefined}
            >
              Against the limits
            </SectionHeading>

            {usage.isError ? (
              <ErrorNote onRetry={() => usage.refetch()} />
            ) : usage.isPending ? (
              <Panel className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </Panel>
            ) : usage.data.rows.length === 0 ? (
              <Empty title="No companies yet." />
            ) : (
              <TableShell
                head={
                  <>
                    <Th>Company</Th>
                    <Th>Plan</Th>
                    <Th align="right">Journals</Th>
                    <Th align="right">Users</Th>
                    <Th align="right">State</Th>
                  </>
                }
              >
                {usage.data.rows.slice(0, 25).map((row, i) => {
                  const max = row.plan?.maxJournalEntries ?? 0
                  const over = max > 0 && row.journalEntries >= max
                  const near = max > 0 && !over && row.journalEntries >= max * 0.75

                  return (
                    <Row key={row.id} index={i}>
                      <Td>{row.name}</Td>
                      <Td mono>{row.plan?.name ?? "none"}</Td>
                      <Td align="right">
                        <span
                          className={cn(
                            "font-money",
                            over && "text-red-600 dark:text-red-400",
                            near && "text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {row.journalEntries.toLocaleString("en-GB")}
                        </span>
                        <span className="text-muted-foreground">
                          {max > 0 ? ` / ${max.toLocaleString("en-GB")}` : " / ∞"}
                        </span>
                      </Td>
                      <Td align="right">
                        {row.users}
                        <span className="text-muted-foreground">
                          {row.plan?.maxUsers ? ` / ${row.plan.maxUsers}` : " / ∞"}
                        </span>
                      </Td>
                      <Td align="right">
                        {row.isSuspended ? (
                          <Pill tone="bad">Suspended</Pill>
                        ) : over ? (
                          <Pill tone="bad">At the ceiling</Pill>
                        ) : near ? (
                          <Pill tone="warn">Close</Pill>
                        ) : (
                          <Pill tone="good">Fine</Pill>
                        )}
                      </Td>
                    </Row>
                  )
                })}
              </TableShell>
            )}

            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              These limits only began to be enforced with this release. A tenant already past a
              ceiling that was never applied should hear from you before their next journal is
              refused.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function PlanCard({ plan }: { plan: AdminPlan }) {
  const modules: string[] = React.useMemo(() => {
    if (!plan.modules) return []
    try {
      const parsed = JSON.parse(plan.modules)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [plan.modules])

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-foreground">{plan.name}</h3>
        {plan.isPopular && <Pill tone="good">Recommended</Pill>}
        {!plan.isActive && <Pill>Hidden</Pill>}
      </div>

      <div className="font-money mt-3 text-xl text-foreground">
        {money(plan.priceMonthly)}
        <span className="text-[13px] text-muted-foreground"> / month</span>
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {money(plan.priceYearly)} yearly
        <Sep />
        {plan.subscribers} subscriber{plan.subscribers === 1 ? "" : "s"}
      </div>

      <dl className="mt-5 space-y-2 border-t border-foreground/10 pt-4 text-[13px]">
        {[
          ["Journals", plan.maxJournalEntries > 0 ? plan.maxJournalEntries.toLocaleString("en-GB") : "no limit"],
          ["Users", plan.maxUsers > 0 ? String(plan.maxUsers) : "no limit"],
          ["Companies", plan.maxCompanies > 0 ? String(plan.maxCompanies) : "no limit"],
          ["Storage", plan.maxStorageMB > 0 ? `${plan.maxStorageMB.toLocaleString("en-GB")} MB` : "no limit"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {k}
            </dt>
            <dd className="font-money tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-foreground/10 pt-4">
        {modules.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            No module list — resolves to Accounting only.
          </span>
        ) : (
          modules.map((m) => <Pill key={m}>{m}</Pill>)
        )}
      </div>
    </Panel>
  )
}
