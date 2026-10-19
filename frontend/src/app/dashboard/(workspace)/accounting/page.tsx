"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import {
  BookOpenCheck,
  CalendarClock,
  FileSpreadsheet,
  Layers,
  Lock,
  Repeat2,
  ShieldCheck,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING, EASE_HOUSE } from "@/lib/motion"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAccountingOverview } from "@/hooks/use-accounting-overview"
import { ModuleMasthead } from "@/components/dashboard/module/module-masthead"
import { OutstandingList } from "@/components/dashboard/module/outstanding-list"
import { ModuleDoors, type Door } from "@/components/dashboard/module/module-doors"
import {
  SectionHeading,
  Sep,
  Figure,
  formatIsoDate,
} from "@/components/dashboard/module/module-primitives"

/**
 * The Accounting module dashboard — the floor between the hub and the
 * working screens.
 *
 * Every figure comes from GET /Dashboard/accounting, which embeds the
 * hub's own card. Nothing on this page re-derives an accounting answer
 * from a list of rows: a module page that disagreed with the hub above it
 * or the Trial Balance below it would poison both.
 */

const DOORS: Door[] = [
  {
    label: "Journal Entries",
    description: "Record, edit and post. Draft entries live here until they are posted.",
    href: "/dashboard/accounting/journal",
    icon: FileSpreadsheet,
  },
  {
    label: "General Ledger",
    description: "Every posting, account by account. Where an out-of-balance ledger is traced.",
    href: "/dashboard/accounting/ledger",
    icon: BookOpenCheck,
  },
  {
    label: "Chart of Accounts",
    description: "The account structure everything posts into.",
    href: "/dashboard/accounting/coa",
    icon: Layers,
  },
  {
    label: "Journal Approvals",
    description: "Review drafts before they reach the ledger.",
    href: "/dashboard/accounting/approvals",
    icon: ShieldCheck,
  },
  {
    label: "Batch Posting",
    description: "Post many entries in one pass instead of one at a time.",
    href: "/dashboard/accounting/posting",
    icon: CalendarClock,
  },
  {
    label: "Recurring Entries",
    description: "Scheduled entries. They generate nothing until they are run.",
    href: "/dashboard/accounting/recurring",
    icon: Repeat2,
  },
  {
    label: "Period Close & Lock",
    description: "Close nominal accounts into Retained Earnings and enforce hard period locks.",
    href: "/dashboard/accounting/period-close",
    icon: Lock,
  },
]

export default function AccountingModulePage() {
  const reduce = useReducedMotion()
  const { data, isPending, isError, error, isFetching, refetch } = useAccountingOverview()

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
        moduleName="Accounting"
        title="The state of the"
        accent="books."
        lede="What the ledger says, what is still open, and where to go and close it. Every figure below is computed server-side, from the same query the reports run."
        status={data?.module.status}
        headline={data?.module.headline}
        detail={data?.module.detail}
        asOf={asOf}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {isError ? (
        <motion.div
          variants={rise}
          className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6"
        >
          <p className="text-sm font-medium text-foreground">
            The accounting figures are unavailable.
          </p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "The request did not complete."} No
            figures are shown rather than stale ones — a balance you cannot trust is worse
            than none.
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
          {/* ── The identity ──────────────────────────────────────────
              Three numbers, and the third is the one that matters. */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading>The identity</SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid divide-y divide-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-20" />
                      <Skeleton className="h-7 w-40" />
                    </div>
                  ))
                ) : (
                  <>
                    <Figure
                      label="Total debit"
                      value={formatModuleMoney(data!.balance.debit, data!.currency)}
                    />
                    <Figure
                      label="Total credit"
                      value={formatModuleMoney(data!.balance.credit, data!.currency)}
                    />
                    <Figure
                      label="Difference"
                      value={formatModuleMoney(data!.balance.difference, data!.currency)}
                      // Compared with === on the server, never a tolerance.
                      // Out by a fraction of a rupiah is out.
                      tone={
                        data!.balance.isBalanced
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      }
                      note={data!.balance.isBalanced ? "Exactly zero" : "The books are out"}
                    />
                  </>
                )}
              </div>

              <div className="border-t border-foreground/10 px-5 py-3.5 sm:px-6">
                {isPending ? (
                  <Skeleton className="h-3 w-72" />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {data!.balance.postedEntries.toLocaleString("id-ID")} posted entries
                    <Sep />
                    {data!.ledger.entriesThisMonth.toLocaleString("id-ID")} this month
                    <Sep />
                    {data!.ledger.postableAccounts} of {data!.ledger.accounts} accounts postable
                    {data!.ledger.lastPostedDate && (
                      <>
                        <Sep />
                        Last posted {formatIsoDate(data!.ledger.lastPostedDate)}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── The work left, and what was posted ───────────────────── */}
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
                <div className="space-y-px overflow-hidden rounded-xl border border-foreground/10 bg-card/60">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2.5 p-5 sm:px-6">
                      <Skeleton className="h-4 w-56" />
                      <Skeleton className="h-3 w-80" />
                    </div>
                  ))}
                </div>
              ) : (
                <OutstandingList
                  items={data!.outstanding}
                  emptyTitle="Nothing outstanding."
                  emptyDetail={
                    data!.period.lockDate
                      ? `Everything is posted and the books are closed through ${formatIsoDate(
                          data!.period.lockDate,
                        )}. That means nothing is waiting on you — not that every figure is right. Balance is an arithmetic check, not a review.`
                      : "Everything is posted. That means nothing is waiting on you — not that every figure is right. Balance is an arithmetic check, not a review."
                  }
                />
              )}
            </motion.section>

            <motion.section variants={rise} className="space-y-5">
              <SectionHeading>Recently posted</SectionHeading>

              <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
                {isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center justify-between gap-4 px-5 py-3.5",
                        i > 0 && "border-t border-foreground/10",
                      )}
                    >
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))
                ) : data!.recent.length === 0 ? (
                  <p className="p-5 text-[13px] leading-relaxed text-muted-foreground">
                    Nothing has been posted yet. Drafts do not appear here — only entries
                    that have reached the ledger.
                  </p>
                ) : (
                  data!.recent.map((entry, i) => (
                    <Link
                      key={entry.id}
                      href={`/dashboard/accounting/journal/edit?id=${entry.id}`}
                      className={cn(
                        "group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-foreground/[0.02]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40",
                        i > 0 && "border-t border-foreground/10",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[11px] tracking-[0.08em] text-foreground">
                          {entry.reference ?? "No reference"}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          {formatIsoDate(entry.date)}
                          <Sep />
                          {entry.lines} lines
                        </div>
                      </div>
                      <div className="font-money shrink-0 text-sm text-foreground">
                        {formatModuleMoney(entry.amount, data!.currency)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </motion.section>
          </div>

          {/* ── The working screens ──────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading>Working screens</SectionHeading>
            <ModuleDoors
              doors={DOORS.map((door) =>
                door.href.endsWith("/coa") && data
                  ? { ...door, meta: `${data.ledger.accounts} accounts` }
                  : door,
              )}
            />
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
          Posted entries are immutable. A mistake is corrected by voiding or reversing the
          entry, never by editing it — the correction is part of the record, and an audit
          that cannot see it is not an audit.
        </p>
      </motion.footer>
    </motion.div>
  )
}

