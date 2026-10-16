"use client"

import { motion, useReducedMotion } from "framer-motion"
import {
  Building2,
  CalendarClock,
  Layers,
  Repeat2,
  ScanLine,
  Scale,
  Trash2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING, EASE_HOUSE } from "@/lib/motion"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAssetOverview } from "@/hooks/use-asset-overview"
import { ModuleMasthead } from "@/components/dashboard/module/module-masthead"
import { OutstandingList } from "@/components/dashboard/module/outstanding-list"
import { ModuleDoors, type Door } from "@/components/dashboard/module/module-doors"
import {
  ModuleLocked,
  isModuleLocked,
} from "@/components/dashboard/module/module-locked"
import {
  SectionHeading,
  Sep,
  Figure,
  formatIsoDate,
} from "@/components/dashboard/module/module-primitives"

/**
 * The Assets module dashboard.
 *
 * Assets earns its card because it produces depreciation. Every
 * figure here is a fact from the register — the product does not choose a
 * useful life or a method for you.
 *
 * Figures come from GET /Dashboard/assets, which embeds the hub's card.
 */

const DOORS: Door[] = [
  {
    label: "Asset Register",
    description: "Every asset at cost, with its accumulated depreciation.",
    href: "/dashboard/assets/register",
    icon: Building2,
  },
  {
    label: "Depreciation",
    description: "Run the period and post it to the ledger.",
    href: "/dashboard/assets/depreciation",
    icon: CalendarClock,
  },
  {
    label: "Amortization",
    description: "Intangible assets, straight line, posted as a journal entry.",
    href: "/dashboard/assets/amortization",
    icon: Repeat2,
  },
  {
    label: "Categories",
    description: "Useful life and method defaults, grouped for the schedule.",
    href: "/dashboard/assets/categories",
    icon: Layers,
  },
  {
    label: "Disposal",
    description: "Retire, sell or write off an asset and close its depreciation.",
    href: "/dashboard/assets/disposal",
    icon: Trash2,
  },
  {
    label: "Revaluation",
    description: "Restate an asset's carrying amount, with the entry it produces.",
    href: "/dashboard/assets/revaluation",
    icon: Scale,
  },
  {
    label: "Labels",
    description: "Printable asset tags for the physical register.",
    href: "/dashboard/assets/labels",
    icon: ScanLine,
  },
]

export default function AssetsModulePage() {
  const reduce = useReducedMotion()
  const { data, isPending, isError, error, isFetching, refetch } = useAssetOverview()

  const asOf = data
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(
        new Date(data.generatedAt),
      )
    : null

  const rise = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: SPRING.soft },
  }

  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      className="flex-1 space-y-10"
    >
      <ModuleMasthead
        moduleName="Assets"
        title="The register at"
        accent="cost."
        lede="What the register holds, what depreciation is outstanding for this period, and what could not post to the ledger even if it were run."
        status={data?.module.status}
        headline={data?.module.headline}
        detail={data?.module.detail}
        asOf={asOf}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {isError && isModuleLocked(error) ? (
        <motion.div variants={rise}>
          <ModuleLocked moduleName="Assets" />
        </motion.div>
      ) : isError ? (
        <motion.div
          variants={rise}
          className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6"
        >
          <p className="text-sm font-medium text-foreground">
            The asset figures are unavailable.
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "The request did not complete."} No
            figures are shown rather than stale ones.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="mt-4 h-8 rounded-full border-foreground/10 px-3 text-xs"
          >
            Try again
          </Button>
        </motion.div>
      ) : (
        <>
          {/* ── The register ─────────────────────────────────────────────
              Three figures that visibly subtract, so the net book value is
              something the reader can check rather than take on trust. */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading note={data ? `${data.register.active} active` : undefined}>
              The register
            </SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid divide-y divide-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-28" />
                      <Skeleton className="h-7 w-40" />
                    </div>
                  ))
                ) : (
                  <>
                    <Figure
                      label="Acquisition cost"
                      value={formatModuleMoney(data!.register.acquisitionCost, data!.currency)}
                    />
                    <Figure
                      label="Less accumulated"
                      value={formatModuleMoney(
                        data!.register.accumulatedDepreciation,
                        data!.currency,
                      )}
                      note="Depreciation to date"
                    />
                    <Figure
                      label="Net book value"
                      value={formatModuleMoney(data!.register.bookValue, data!.currency)}
                      note={
                        data!.depreciation.behind > 0
                          ? "Before this period's depreciation"
                          : "Depreciated through the period"
                      }
                    />
                  </>
                )}
              </div>

              <div className="border-t border-foreground/10 px-5 py-3.5 sm:px-6">
                {isPending ? (
                  <Skeleton className="h-3 w-80" />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {data!.register.disposed} disposed or retired
                    <Sep />
                    {data!.register.withoutCategory} uncategorised
                    <Sep />
                    {data!.register.withoutDepreciationAccount} without a depreciation account
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── The work left, and the period ────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-5">
            <motion.section variants={rise} className="space-y-5 lg:col-span-2">
              <SectionHeading
                note={
                  data
                    ? data.outstanding.length === 0
                      ? "Nothing open"
                      : `${data.outstanding.length} open`
                    : undefined
                }
              >
                What is left
              </SectionHeading>

              {isPending ? (
                <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2.5 p-5 sm:px-6">
                      <Skeleton className="h-4 w-60" />
                      <Skeleton className="h-3 w-80" />
                    </div>
                  ))}
                </div>
              ) : (
                <OutstandingList
                  items={data!.outstanding}
                  emptyTitle="Nothing outstanding."
                  emptyDetail="Depreciation is posted through this period, every active asset has somewhere to post it, and nothing is sitting fully written down. Whether the useful lives on the register are the right ones is a judgement, and not one this module makes."
                />
              )}
            </motion.section>

            <motion.section variants={rise} className="space-y-5">
              <SectionHeading>This period</SectionHeading>

              <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
                {isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-2 w-24" />
                    <Skeleton className="h-7 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ) : (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {data!.depreciation.period}
                    </div>

                    <div
                      className={cn(
                        "mt-2 text-xl tabular-nums sm:text-2xl",
                        data!.depreciation.behind > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400",
                      )}
                    >
                      {data!.depreciation.upToDate} of {data!.register.active}
                    </div>

                    <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Depreciated this period
                    </div>

                    <div className="mt-5 h-px bg-foreground/10" />

                    <dl className="mt-4 space-y-2.5 text-[13px]">
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-muted-foreground">Posted this period</dt>
                        <dd className="font-money text-foreground">
                          {formatModuleMoney(
                            data!.depreciation.postedThisPeriod,
                            data!.currency,
                          )}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-muted-foreground">Last posted</dt>
                        <dd className="text-foreground">
                          {data!.depreciation.lastPostedDate
                            ? formatIsoDate(data!.depreciation.lastPostedDate)
                            : "Never"}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>
            </motion.section>
          </div>

          {/* ── Recent postings ──────────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading note="Newest first">Recent depreciation</SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              {isPending ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6",
                      i > 0 && "border-t border-foreground/10",
                    )}
                  >
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))
              ) : data!.recent.length === 0 ? (
                <p className="p-5 text-[13px] leading-relaxed text-muted-foreground sm:p-6">
                  No depreciation has been posted yet. Nothing on the register has reached
                  the ledger.
                </p>
              ) : (
                data!.recent.map((row, i) => (
                  <div
                    key={row.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5 sm:px-6",
                      i > 0 && "border-t border-foreground/10",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-foreground">{row.assetName}</div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {row.assetCode && (
                          <>
                            {row.assetCode}
                            <Sep />
                          </>
                        )}
                        {formatIsoDate(row.date)}
                        {!row.posted && (
                          <>
                            <Sep />
                            <span className="text-amber-700 dark:text-amber-400">
                              No journal entry
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="font-money shrink-0 text-sm text-foreground">
                      {formatModuleMoney(row.amount, data!.currency)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.section>

          <motion.section variants={rise} className="space-y-5">
            <SectionHeading>Working screens</SectionHeading>
            <ModuleDoors doors={DOORS} />
          </motion.section>
        </>
      )}

      <motion.footer
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { duration: 0.6, ease: EASE_HOUSE } },
        }}
        className="space-y-4 pt-2"
      >
        <div className="h-px bg-gradient-to-r from-foreground/10 to-transparent" />
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Depreciation is what earns this module its card in the hub. The useful life and
          the method on each asset are entered, not decided here — this page reports what
          those inputs produce and whether it reached the ledger.
        </p>
      </motion.footer>
    </motion.div>
  )
}
