"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Building2, FileSpreadsheet, PieChart, ReceiptText, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING, EASE_HOUSE } from "@/lib/motion"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTaxOverview, type VatPeriod } from "@/hooks/use-tax-overview"
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
 * The Tax module dashboard.
 *
 * The hard rule this page exists under: BalanceIO records, reconciles and
 * exports. It does not decide how a transaction should be taxed. Deciding
 * that from a journal line is professional judgement, and a product that
 * did it would be moving someone else's liability onto itself.
 *
 * So every verb here is track / record / reconcile / export. If a future
 * edit wants "calculate your tax" or "we file it for you", the answer is no.
 *
 * Figures come from GET /Dashboard/tax, which embeds the hub's own card.
 */

const DOORS: Door[] = [
  {
    label: "SPT Masa PPN 1111",
    description: "Induk SPT, Form 1111 AB, A2, and B2/B3 with 1-click PPN settlement posting.",
    href: "/dashboard/tax/spt-ppn",
    icon: ReceiptText,
  },
  {
    label: "Withholding PPh",
    description: "PPh 21 (TER PP 58/2023), PPh 23, PPh 4(2) Final, and PPh 22 summaries.",
    href: "/dashboard/tax/withholding",
    icon: Users,
  },
  {
    label: "DJP Online Exports",
    description: "Official e-Faktur CSV and e-Bupot Unifikasi CSV/XML export center.",
    href: "/dashboard/tax/exports",
    icon: FileSpreadsheet,
  },
  {
    label: "Sales Invoices",
    description: "Where PPN keluaran is recorded. Draft invoices carry none yet.",
    href: "/dashboard/sales",
    icon: ReceiptText,
  },
  {
    label: "Purchase Bills",
    description: "Where PPN masukan is recorded, against the bill it was paid on.",
    href: "/dashboard/purchases",
    icon: FileSpreadsheet,
  },
  {
    label: "Contacts",
    description: "Counterparty NPWP, PTKP, and statutory tax withholding profiles.",
    href: "/dashboard/contacts",
    icon: Users,
  },
  {
    label: "Company Settings",
    description: "Company NPWP, PKP registration, and tax office settings.",
    href: "/dashboard/settings",
    icon: Building2,
  },
]

/** Positive net is kurang bayar; negative is lebih bayar. */
function netLabel(net: number) {
  if (net > 0) return "Kurang bayar"
  if (net < 0) return "Lebih bayar"
  return "Keluaran and masukan agree"
}

export default function TaxModulePage() {
  const reduce = useReducedMotion()
  const { data, isPending, isError, error, isFetching, refetch } = useTaxOverview()

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
        moduleName="Tax"
        title="The tax"
        accent="record."
        lede="PPN keluaran against masukan, period by period, and what is still missing before any of it could be reported. BalanceIO records and reconciles — it does not decide how a transaction is taxed."
        status={data?.module.status}
        headline={data?.module.headline}
        detail={data?.module.detail}
        asOf={asOf}
        isFetching={isFetching}
        onRefresh={() => refetch()}
      />

      {isError && isModuleLocked(error) ? (
        <motion.div variants={rise}>
          <ModuleLocked moduleName="Tax" />
        </motion.div>
      ) : isError ? (
        <motion.div
          variants={rise}
          className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-6"
        >
          <p className="text-sm font-medium text-foreground">The tax figures are unavailable.</p>
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
          {/* ── This period ──────────────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading note={data?.period.label}>This period</SectionHeading>

            <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <div className="grid divide-y divide-foreground/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {isPending ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-5 sm:p-6">
                      <Skeleton className="h-2 w-24" />
                      <Skeleton className="h-7 w-36" />
                    </div>
                  ))
                ) : (
                  <>
                    <Figure
                      label="PPN keluaran"
                      value={formatModuleMoney(data!.period.outputTax, data!.currency)}
                      note={`${data!.period.outputDocuments} documents`}
                    />
                    <Figure
                      label="PPN masukan"
                      value={formatModuleMoney(data!.period.inputTax, data!.currency)}
                      note={`${data!.period.inputDocuments} documents`}
                    />
                    {/* Neutral, not red. Kurang bayar is the ordinary outcome
                        of a trading month, not a fault — red is reserved for
                        overdue and void. The direction is carried by the
                        label under it. */}
                    <Figure
                      label="Net PPN"
                      value={formatModuleMoney(Math.abs(data!.period.net), data!.currency)}
                      note={netLabel(data!.period.net)}
                    />
                  </>
                )}
              </div>

              <div className="border-t border-foreground/10 px-5 py-3.5 sm:px-6">
                {isPending ? (
                  <Skeleton className="h-3 w-80" />
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {formatIsoDate(data!.period.start)} – {formatIsoDate(data!.period.end)}
                    <Sep />
                    Draft and Void excluded
                    <Sep />
                    NPWP {data!.coverage.companyTaxId ?? "not recorded"}
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── The work left, and the deadline ──────────────────────── */}
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
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-80" />
                    </div>
                  ))}
                </div>
              ) : (
                <OutstandingList
                  items={data!.outstanding}
                  emptyTitle="Nothing outstanding."
                  emptyDetail="Every taxed document this period is issued, the NPWP are on file, and the filing deadline is not close. What the tax treatment of those documents should have been is a separate question, and not one this module answers."
                />
              )}
            </motion.section>

            <motion.section variants={rise} className="space-y-5">
              <SectionHeading>SPT Masa PPN</SectionHeading>

              <div className="rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm sm:p-6">
                {isPending ? (
                  <div className="space-y-3">
                    <Skeleton className="h-2 w-24" />
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ) : (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Period {data!.filing.period}
                    </div>

                    <div
                      className={cn(
                        // tabular-nums, not .font-money: this is a countdown,
                        // not a monetary figure, and .font-money is reserved.
                        "mt-2 text-xl tabular-nums sm:text-2xl",
                        data!.filing.daysRemaining <= 7
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-foreground",
                      )}
                    >
                      {data!.filing.daysRemaining < 0
                        ? `${Math.abs(data!.filing.daysRemaining)} days past`
                        : data!.filing.daysRemaining === 0
                          ? "Due today"
                          : `${data!.filing.daysRemaining} ${
                              data!.filing.daysRemaining === 1 ? "day" : "days"
                            } left`}
                    </div>

                    <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      Due {formatIsoDate(data!.filing.deadline)}
                    </div>

                    <div className="mt-5 h-px bg-foreground/10" />

                    {/* Stated, not implied. The model has no field for a
                        filed return, so the page must not look like it
                        knows. */}
                    <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                      Whether the return was filed is not recorded here, and BalanceIO does
                      not file it. This is the deadline, tracked.
                    </p>
                  </>
                )}
              </div>
            </motion.section>
          </div>

          {/* ── Six months ───────────────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading note="Newest first">Six-month run</SectionHeading>

            <div className="overflow-x-auto rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-foreground/10">
                    <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] font-normal text-muted-foreground sm:px-6">
                      Period
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] font-normal text-muted-foreground">
                      PPN keluaran
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] font-normal text-muted-foreground">
                      PPN masukan
                    </th>
                    <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] font-normal text-muted-foreground sm:px-6">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isPending
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className={cn(i > 0 && "border-t border-foreground/10")}>
                          <td className="px-5 py-3.5 sm:px-6">
                            <Skeleton className="h-3 w-24" />
                          </td>
                          <td className="px-5 py-3.5">
                            <Skeleton className="ml-auto h-3 w-24" />
                          </td>
                          <td className="px-5 py-3.5">
                            <Skeleton className="ml-auto h-3 w-24" />
                          </td>
                          <td className="px-5 py-3.5 sm:px-6">
                            <Skeleton className="ml-auto h-3 w-24" />
                          </td>
                        </tr>
                      ))
                    : data!.history.map((row: VatPeriod, i) => {
                        const quiet = row.outputDocuments === 0 && row.inputDocuments === 0
                        return (
                          <tr
                            key={row.start}
                            className={cn(i > 0 && "border-t border-foreground/10")}
                          >
                            <td
                              className={cn(
                                "px-5 py-3.5 sm:px-6",
                                i === 0 ? "font-medium text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {row.label}
                              {i === 0 && (
                                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                  Current
                                </span>
                              )}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-3.5 text-right tabular-nums",
                                quiet ? "text-muted-foreground/50" : "text-foreground",
                              )}
                            >
                              {formatModuleMoney(row.outputTax, data!.currency)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-3.5 text-right tabular-nums",
                                quiet ? "text-muted-foreground/50" : "text-foreground",
                              )}
                            >
                              {formatModuleMoney(row.inputTax, data!.currency)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-3.5 text-right tabular-nums sm:px-6",
                                quiet ? "text-muted-foreground/50" : "text-foreground",
                              )}
                            >
                              {formatModuleMoney(row.net, data!.currency)}
                            </td>
                          </tr>
                        )
                      })}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* ── The working screens ──────────────────────────────────── */}
          <motion.section variants={rise} className="space-y-5">
            <SectionHeading note="Statutory reporting and source document workspaces">
              Where the record is kept
            </SectionHeading>
            <ModuleDoors doors={DOORS} />
          </motion.section>
        </>
      )}

      {/* ── The statutory boundary ── */}
      <motion.footer
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { duration: 0.6, ease: EASE_HOUSE } },
        }}
        className="space-y-4 pt-2"
      >
        <div className="h-px bg-gradient-to-r from-foreground/10 to-transparent" />
        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          BalanceIO organizes, records, reconciles, and exports statutory tax formats (e-Faktur CSV, e-Bupot Unifikasi, and SPT Masa PPN 1111). Final filing is submitted by the company through the official DJP Online portal.
        </p>
      </motion.footer>
    </motion.div>
  )
}
