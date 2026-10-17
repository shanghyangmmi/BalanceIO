"use client"

import Link from "next/link"
import { ChevronLeft, Loader2, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssetCharge, useRunAssetCharge, type ChargeKind } from "@/hooks/use-asset-charge"
import {
  ModuleLocked,
  isModuleLocked,
} from "@/components/dashboard/module/module-locked"
import {
  Figure,
  SectionHeading,
  Sep,
  formatIsoDate,
} from "@/components/dashboard/module/module-primitives"
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

/**
 * The periodic charge against the asset register.
 *
 * One screen for both classes. Depreciation and amortisation are the same
 * arithmetic over the same register producing the same kind of journal
 * entry; only the class of asset and the word differ. Two screens would
 * have been two places for the wording, the rounding note and the blocker
 * list to drift apart.
 *
 * Running a period writes a balanced posted journal entry and links every
 * charge row to it. Depreciation did not do that until now — it updated
 * the register and stopped, so the charge never reached the ledger.
 */

interface Copy {
  /** "Depreciation" — sentence-leading noun. */
  noun: string
  title: string
  accent: string
  lede: string
  /** What a run refuses to do, in the footer. */
  method: string
}

const COPY: Record<ChargeKind, Copy> = {
  depreciation: {
    noun: "Depreciation",
    title: "Depreciation of",
    accent: "the register.",
    lede: "Straight line over the useful life on each asset. Running a period writes a balanced journal entry — debit depreciation expense, credit accumulated depreciation — and links every posting to it.",
    method:
      "Straight line over the useful life recorded on the asset. The final period takes whatever remains, so the carrying amount lands exactly on the residual value rather than a rounding tail.",
  },
  amortisation: {
    noun: "Amortisation",
    title: "Amortisation of",
    accent: "intangibles.",
    lede: "Straight line over the useful life on the register. Running a period writes a balanced journal entry — debit amortisation expense, credit accumulated amortisation — and links every posting to it.",
    method:
      "Straight line only. A declining balance on an intangible is unusual enough that offering it without the reporting to support it would be a trap. The final period takes whatever remains, so the carrying amount lands exactly on the residual value.",
  },
}

export function AssetChargeScreen({ kind }: { kind: ChargeKind }) {
    const can = useCan();
  const copy = COPY[kind]
  const { data, isPending, isError, error, refetch } = useAssetCharge(kind)
  const run = useRunAssetCharge(kind)

  if (isError && isModuleLocked(error)) {
    return <ModuleLocked moduleName="Assets" />
  }

  const canRun = Boolean(data && data.blockers.length === 0 && data.totals.due > 0)

  return (
    <div className="flex-1 space-y-8">
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <header className="space-y-5">
        <Link
          href="/dashboard/assets"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" strokeWidth={2} />
          Assets
        </Link>

        <div className="space-y-4">
          <h1 className="font-display max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
            {copy.title}{" "}
            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
              {copy.accent}
            </span>
          </h1>

          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.lede}</p>
        </div>

        <div className="h-px bg-foreground/10" />

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {isPending ? (
            <Skeleton className="h-4 w-64" />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  canRun
                    ? "bg-amber-600 dark:bg-amber-400"
                    : "bg-emerald-600 dark:bg-emerald-400",
                )}
              />
              <span className="text-sm font-medium text-foreground">
                {canRun
                  ? `${data!.totals.due} asset${data!.totals.due === 1 ? "" : "s"} due for ${data!.period}`
                  : `Nothing due for ${data?.period ?? "this period"}`}
              </span>
              {data && (
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Posts {formatIsoDate(data.postingDate)}
                </span>
              )}
            </div>
          )}

          {can(PERMISSIONS.AssetsDepreciate) && <Button
            size="sm"
            onClick={() => run.mutate()}
            disabled={!canRun || run.isPending}
            className="h-8 gap-2 rounded-full px-4 text-xs"
          >
            {run.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run {data?.period ?? "period"}
          </Button>}
        </div>

        <div className="h-px bg-foreground/10" />
      </header>

      {isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6">
          <p className="text-sm font-medium text-foreground">
            {copy.noun} is unavailable.
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "The request did not complete."}
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
          {/* ── What the last run did ────────────────────────────── */}
          {run.isSuccess && (
            <div className="rounded-xl border border-emerald-600/25 bg-emerald-500/[0.04] p-5 sm:p-6">
              <p className="text-sm font-medium text-foreground">
                {run.data.assetsCharged === 0
                  ? "Nothing was posted."
                  : `Posted ${formatModuleMoney(run.data.totalCharge, data?.currency ?? "IDR")} for ${run.data.period}.`}
              </p>

              {run.data.journalReference && (
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Entry {run.data.journalReference}
                  <Sep />
                  {run.data.assetsCharged} asset
                  {run.data.assetsCharged === 1 ? "" : "s"}
                  <Sep />
                  <Link
                    href="/dashboard/accounting/journal"
                    className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                  >
                    Open the journal
                  </Link>
                </p>
              )}

              {run.data.skipped.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {run.data.skipped.map((s) => (
                    <li key={s} className="text-[13px] leading-relaxed text-muted-foreground">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {run.isError && (
            <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-5 sm:p-6">
              <p className="text-sm font-medium text-foreground">The run did not post.</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {run.error instanceof Error ? run.error.message : "Unknown error."}
              </p>
            </div>
          )}

          {/* ── The register ─────────────────────────────────────── */}
          <section className="space-y-5">
            <SectionHeading
              note={
                data
                  ? `${data.totals.assets} ${kind === "amortisation" ? "intangible" : "tangible"}`
                  : undefined
              }
            >
              At cost
            </SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid divide-y divide-foreground/10 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-24" />
                      <Skeleton className="h-7 w-32" />
                    </div>
                  ))
                ) : (
                  <>
                    <Figure
                      label="Acquisition cost"
                      value={formatModuleMoney(data!.totals.acquisitionCost, data!.currency)}
                    />
                    <Figure
                      label="Less accumulated"
                      value={formatModuleMoney(data!.totals.accumulatedCharge, data!.currency)}
                    />
                    <Figure
                      label="Carrying amount"
                      value={formatModuleMoney(data!.totals.carryingAmount, data!.currency)}
                    />
                    <Figure
                      label="Due this period"
                      value={formatModuleMoney(data!.totals.dueThisPeriod, data!.currency)}
                      tone={
                        data!.totals.dueThisPeriod > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : undefined
                      }
                      note={data!.period}
                    />
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ── Why a run would refuse ───────────────────────────── */}
          {data && data.blockers.length > 0 && (
            <div className="rounded-xl border border-dashed border-foreground/20 bg-foreground/[0.02] p-5 sm:p-6">
              <p className="text-sm font-medium text-foreground">Nothing to run.</p>
              <ul className="mt-3 space-y-1.5">
                {data.blockers.map((b) => (
                  <li key={b} className="text-[13px] leading-relaxed text-muted-foreground">
                    {b}
                  </li>
                ))}
              </ul>
              {kind === "amortisation" && !data.hasIntangibleCategories && (
                <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  An asset amortises rather than depreciates because of the category it
                  sits in. Mark a category as intangible on the{" "}
                  <Link
                    href="/dashboard/assets/categories"
                    className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
                  >
                    categories
                  </Link>{" "}
                  screen, and every asset in it follows.
                </p>
              )}
            </div>
          )}

          {/* ── Asset by asset ───────────────────────────────────── */}
          {(isPending || (data && data.assets.length > 0)) && (
            <section className="space-y-5">
              <SectionHeading note="Straight line">Asset by asset</SectionHeading>

              <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
                <table className="w-full min-w-[48rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-foreground/10">
                      {["Asset", "Life", "Cost", "Accumulated", "Carrying", "Monthly"].map(
                        (h, i) => (
                          <th
                            key={h}
                            className={cn(
                              "px-5 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground",
                              i === 0 && "text-left sm:px-6",
                              i === 1 && "text-left",
                              i > 1 && "text-right",
                              i === 5 && "sm:px-6",
                            )}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {isPending
                      ? Array.from({ length: 3 }).map((_, i) => (
                          <tr key={i} className={cn(i > 0 && "border-t border-foreground/10")}>
                            <td className="px-5 py-3.5 sm:px-6">
                              <Skeleton className="h-3 w-40" />
                            </td>
                            {Array.from({ length: 5 }).map((__, j) => (
                              <td key={j} className="px-5 py-3.5">
                                <Skeleton className="ml-auto h-3 w-20" />
                              </td>
                            ))}
                          </tr>
                        ))
                      : data!.assets.map((a, i) => (
                          <tr key={a.id} className={cn(i > 0 && "border-t border-foreground/10")}>
                            <td className="px-5 py-3.5 sm:px-6">
                              <div className="text-foreground">{a.name}</div>
                              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                {a.code && (
                                  <>
                                    {a.code}
                                    <Sep />
                                  </>
                                )}
                                {a.category ?? "Uncategorised"}
                                {a.lastChargedDate && (
                                  <>
                                    <Sep />
                                    Last {formatIsoDate(a.lastChargedDate)}
                                  </>
                                )}
                              </div>
                              {a.blocker && (
                                <div className="mt-1 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
                                  Skipped: {a.blocker}
                                </div>
                              )}
                            </td>
                            <td className="px-5 py-3.5 tabular-nums text-muted-foreground">
                              {a.usefulLifeMonths} mo
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                              {formatModuleMoney(a.acquisitionCost, data!.currency)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-muted-foreground">
                              {formatModuleMoney(a.accumulatedCharge, data!.currency)}
                            </td>
                            <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                              {formatModuleMoney(a.carryingAmount, data!.currency)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-3.5 text-right tabular-nums sm:px-6",
                                a.due && !a.blocker
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-muted-foreground",
                              )}
                            >
                              {formatModuleMoney(a.monthlyCharge, data!.currency)}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <footer className="space-y-4 pt-2">
            <div className="h-px bg-gradient-to-r from-foreground/10 to-transparent" />
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              {copy.method}
            </p>
          </footer>
        </>
      )}
    </div>
  )
}
