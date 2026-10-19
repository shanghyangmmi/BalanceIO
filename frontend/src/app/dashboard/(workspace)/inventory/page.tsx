"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Boxes, ClipboardCheck, Layers, Ruler, Settings2, Warehouse } from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING, EASE_HOUSE } from "@/lib/motion"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useStockOverview, type RecentOpname } from "@/hooks/use-stock-overview"
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
 * The Inventory module dashboard.
 *
 * Inventory earns a card in the hub because it produces COGS. That is also
 * what makes an unverified quantity expensive: it posts to the ledger
 * looking exactly as authoritative as a counted one.
 *
 * Figures come from GET /Dashboard/inventory, which embeds the hub's card.
 */

const DOORS: Door[] = [
  {
    label: "Items",
    description: "The product list, quantities and reorder levels.",
    href: "/dashboard/inventory/items",
    icon: Boxes,
  },
  {
    label: "Stock Opname",
    description: "Count the shelf against the book, then post the difference.",
    href: "/dashboard/inventory/opname",
    icon: ClipboardCheck,
  },
  {
    label: "Adjustments",
    description: "Movements that are neither a sale nor a purchase.",
    href: "/dashboard/inventory/adjustments",
    icon: Layers,
  },
  {
    label: "Warehouses",
    description: "Where stock is held.",
    href: "/dashboard/inventory/warehouses",
    icon: Warehouse,
  },
  {
    label: "Units",
    description: "Units of measure items are counted in.",
    href: "/dashboard/inventory/units",
    icon: Ruler,
  },
  {
    label: "Inventory Settings",
    description: "Costing and tracking defaults for new items.",
    href: "/dashboard/inventory/settings",
    icon: Settings2,
  },
]

const OPNAME_TONE: Record<RecentOpname["status"], string> = {
  Processed: "text-emerald-700 dark:text-emerald-400",
  Draft: "text-amber-700 dark:text-amber-400",
  Cancelled: "text-muted-foreground",
}

export default function InventoryModulePage() {
  const reduce = useReducedMotion()
  const { data, isPending, isError, error, isFetching, refetch } = useStockOverview()

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
        moduleName="Inventory"
        title="Book against"
        accent="count."
        lede="What the books say is on the shelf, when that was last verified against a physical count, and what would stop a movement reaching the ledger at all."
        status={data?.module.status}
        headline={data?.module.headline}
        detail={data?.module.detail}
        asOf={asOf}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {isError && isModuleLocked(error) ? (
        <motion.div variants={rise}>
          <ModuleLocked moduleName="Inventory" />
        </motion.div>
      ) : isError ? (
        <motion.div
          variants={rise}
          className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6"
        >
          <p className="text-sm font-medium text-foreground">The stock figures are unavailable.</p>
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
          {/* ── The position ─────────────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading>The position</SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid divide-y divide-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-24" />
                      <Skeleton className="h-7 w-32" />
                    </div>
                  ))
                ) : (
                  <>
                    <Figure
                      label="Items tracked"
                      value={data!.position.tracked.toLocaleString("id-ID")}
                      note={
                        data!.position.lowStock > 0
                          ? `${data!.position.lowStock} at or below reorder level`
                          : "None at reorder level"
                      }
                    />
                    <Figure
                      label="Stock value"
                      value={formatModuleMoney(data!.position.stockValue, data!.currency)}
                      note={
                        data!.position.stockValue === data!.position.inventoryAccountBalance
                          ? "Moving average · agrees with the inventory account"
                          : `Moving average · inventory account ${formatModuleMoney(data!.position.inventoryAccountBalance, data!.currency)}`
                      }
                      tone={
                        data!.position.stockValue === data!.position.inventoryAccountBalance
                          ? undefined
                          : "text-amber-700 dark:text-amber-400"
                      }
                    />
                    <Figure
                      label="At negative stock"
                      value={data!.position.negative.toLocaleString("id-ID")}
                      tone={
                        data!.position.negative > 0
                          ? "text-red-700 dark:text-red-400"
                          : "text-emerald-700 dark:text-emerald-400"
                      }
                      note={data!.position.negative > 0 ? "Impossible, not unusual" : "None"}
                    />
                  </>
                )}
              </div>

              <div className="border-t border-foreground/10 px-5 py-3.5 sm:px-6">
                {isPending ? (
                  <Skeleton className="h-3 w-80" />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {data!.position.withoutInventoryAccount} without an inventory account
                    <Sep />
                    {data!.counting.openOpnames} open opname
                    {data!.counting.openOpnames === 1 ? "" : "s"}
                    <Sep />
                    {data!.counting.unprocessedVariances} unprocessed difference
                    {data!.counting.unprocessedVariances === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── The work left, and the last count ────────────────────── */}
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
                  emptyDetail="Quantities are positive, every tracked item has somewhere to post, and the last count found nothing unreconciled. What was counted is what the books say — whether the count itself was done properly is not something software can confirm."
                />
              )}
            </motion.section>

            <motion.section variants={rise} className="space-y-5">
              <SectionHeading>Last count</SectionHeading>

              <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
                {isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-2 w-24" />
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ) : data!.counting.lastCountDate ? (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Stock opname
                    </div>

                    <div
                      className={cn(
                        "mt-2 text-xl tabular-nums sm:text-2xl",
                        (data!.counting.daysSinceCount ?? 0) > 90
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-foreground",
                      )}
                    >
                      {data!.counting.daysSinceCount === 0
                        ? "Today"
                        : `${data!.counting.daysSinceCount} ${
                            data!.counting.daysSinceCount === 1 ? "day" : "days"
                          } ago`}
                    </div>

                    <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {formatIsoDate(data!.counting.lastCountDate)}
                    </div>

                    <div className="mt-5 h-px bg-foreground/10" />

                    <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                      A book quantity is only as good as the last time somebody counted
                      against it. Ninety days is the point this page starts saying so.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Stock opname
                    </div>
                    <div className="mt-2 text-xl text-foreground sm:text-2xl">Never</div>
                    <div className="mt-5 h-px bg-foreground/10" />
                    <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                      Nothing has ever confirmed that the book quantity matches the shelf.
                    </p>
                  </>
                )}
              </div>
            </motion.section>
          </div>

          {/* ── Counts ───────────────────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading note="Newest first">Recent counts</SectionHeading>

            <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              {isPending ? (
                <div className="space-y-3 p-5 sm:p-6">
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-3 w-52" />
                </div>
              ) : data!.recent.length === 0 ? (
                <p className="p-5 text-[13px] leading-relaxed text-muted-foreground sm:p-6">
                  No stock opname has been recorded yet.
                </p>
              ) : (
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-foreground/10">
                      <th className="px-5 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground sm:px-6">
                        Opname
                      </th>
                      <th className="px-5 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                        Date
                      </th>
                      <th className="px-5 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                        Lines
                      </th>
                      <th className="px-5 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground">
                        Differences
                      </th>
                      <th className="px-5 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-muted-foreground sm:px-6">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.recent.map((row, i) => (
                      <tr key={row.id} className={cn(i > 0 && "border-t border-foreground/10")}>
                        <td className="px-5 py-3.5 font-mono text-[11px] tracking-[0.08em] text-foreground sm:px-6">
                          {row.number}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {formatIsoDate(row.date)}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                          {row.lines}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-right tabular-nums",
                            row.variances > 0
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {row.variances}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] sm:px-6",
                            OPNAME_TONE[row.status],
                          )}
                        >
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
          Inventory has a card in the hub for one reason: it produces COGS. A quantity
          nobody has counted against still posts, and the cost of sales it produces looks
          exactly as authoritative as a verified one.
        </p>
      </motion.footer>
    </motion.div>
  )
}
