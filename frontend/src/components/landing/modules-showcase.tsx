"use client"

import { motion } from "framer-motion"

/**
 * Exhibit — what each module posts.
 *
 * This used to be eight feature cards with icon badges and bullet lists
 * ("Invoices with premium templates"), the layout every SaaS page uses,
 * and it never showed the one thing that justifies the product: that
 * each module ends in a journal entry. It listed eight modules while the
 * plans sell five, and left payroll out entirely.
 *
 * It is now laid out the way a report exhibit is: one row per module,
 * the entry it posts, and what is specific to Indonesia. The last row is
 * the refusal from DESIGN-SYSTEM.md §1, stated as a row of the same
 * table rather than as a slogan.
 *
 * Every entry here is the one the code posts (see CLAUDE.md: Payroll,
 * Inventory and warehouses, Fixed assets, Tax module state). If a module
 * changes its posting, change its row.
 */

interface Row {
    module: string
    plan: string
    dr: string
    cr: string
    detail: string
}

const ROWS: Row[] = [
    {
        module: "Accounting",
        plan: "Every plan",
        dr: "Trade receivables",
        cr: "Revenue · PPN keluaran",
        detail:
            "Journals, sales invoices, purchase bills, bank reconciliation and year-end closing. A period lock and segregation of duties stop back-dating and self-approval.",
    },
    {
        module: "Tax",
        plan: "Pro",
        dr: "PPN keluaran",
        cr: "PPN masukan · PPN payable",
        detail:
            "SPT Masa PPN summary, settlement journal, e-Faktur and e-Bupot CSV exports, ekualisasi and rekonsiliasi fiskal.",
    },
    {
        module: "Inventory",
        plan: "Pro",
        dr: "Cost of goods sold",
        cr: "Inventory",
        detail:
            "Moving-average cost across warehouses. Stock cannot go negative, and every movement carries the value it posts.",
    },
    {
        module: "Fixed assets",
        plan: "Pro",
        dr: "Depreciation expense",
        cr: "Accumulated depreciation",
        detail:
            "Straight-line commercial depreciation monthly, with the fiscal schedule under Pasal 11 (Kelompok 1 to 4) alongside.",
    },
    {
        module: "Payroll",
        plan: "Pro",
        dr: "Salaries · employer BPJS",
        cr: "PPh 21 · BPJS · net pay",
        detail:
            "PPh 21 under the TER rates of PP 58/2023, BPJS Ketenagakerjaan and Kesehatan with configured wage caps.",
    },
]

const reveal = {
    initial: { opacity: 0, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.4 },
}

export function ModulesShowcase() {
    return (
        <section className="relative bg-background py-32">
            <div className="mx-auto max-w-6xl px-6">
                <motion.div
                    {...reveal}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-14 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end"
                >
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="h-px w-8 bg-foreground/30" />
                            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                                Act III — The modules
                            </span>
                        </div>
                        <h2 className="font-display mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl">
                            A module earns its place{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
                                by posting to the ledger.
                            </span>
                        </h2>
                    </div>
                    <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground lg:justify-self-end">
                        Five modules, one chart of accounts. Each one ends in a journal
                        entry, so the statements never depend on someone reconciling a
                        side system at month end.
                    </p>
                </motion.div>

                {/* The exhibit */}
                <div className="border-t border-foreground">
                    <div className="hidden grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-6 border-b border-foreground/10 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground lg:grid">
                        <span>Module</span>
                        <span>Debit</span>
                        <span>Credit</span>
                        <span>What is specific</span>
                    </div>

                    {ROWS.map((r, i) => (
                        <motion.div
                            key={r.module}
                            {...reveal}
                            transition={{ delay: i * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                            className="grid gap-3 border-b border-foreground/10 py-6 lg:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-6"
                        >
                            <div>
                                <p className="font-display text-xl font-bold tracking-tight text-foreground">
                                    {r.module}
                                </p>
                                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                    {r.plan}
                                </p>
                            </div>
                            <p className="text-[14px] text-foreground">
                                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400">
                                    Dr
                                </span>
                                {r.dr}
                            </p>
                            <p className="text-[14px] text-foreground">
                                <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-400">
                                    Cr
                                </span>
                                {r.cr}
                            </p>
                            <p className="text-[13px] leading-relaxed text-muted-foreground">{r.detail}</p>
                        </motion.div>
                    ))}

                    {/* The refusal, as a row of the same exhibit. */}
                    <motion.div
                        {...reveal}
                        transition={{ delay: 0.3, duration: 0.6 }}
                        className="grid gap-3 py-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-6"
                    >
                        <p className="font-display text-xl font-bold tracking-tight text-muted-foreground/70">
                            Not included
                        </p>
                        <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                            CRM, attendance and online storefronts. None of them posts to the
                            general ledger, so none of them belongs in it. Use the tools you
                            already have for those.
                        </p>
                    </motion.div>
                </div>

                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Exhibit 1 · Typical entry per module · Plans as configured at launch; see Pricing for current availability
                </p>
            </div>
        </section>
    )
}
