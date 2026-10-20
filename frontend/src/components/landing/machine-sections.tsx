"use client"

import * as React from "react"
import Link from "next/link"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Odometer } from "./odometer"

/**
 * Supporting movements for "The Ledger Machine": the readout strip that
 * follows Act I, and the closing statement that lets the machine come
 * to rest.
 */

/* ── Readout strip ───────────────────────────────────────────────── */

/**
 * Every figure here is counted from the repository, not estimated.
 *
 * The strip used to lead with "0.00 — out-of-balance tolerance", which
 * put an arithmetic identity where the breadth of the product should be.
 * Exact equality is table stakes; no accounting tool ships without it.
 *
 * It also carried "40 report formats" while the bento strip on the same
 * page claimed "16+ financial reports" — two different numbers for one
 * thing. Later it said "76 accounts" after the chart had grown to 86,
 * "8 modules" while the plans sell five, and "100% traceable", which is
 * a slogan with a percent sign. Each figure below is either a count from
 * the code (DefaultCoASeeder, ModuleEntitlementService) or a rule the
 * code enforces (ScheduledJobRunner refuses retention under 3,650 days;
 * FiscalDepreciation's groups). Recount them when those change.
 */
const READOUT = [
    {
        value: "5",
        label: "Modules on one ledger",
        note: "Accounting, tax, inventory, fixed assets and payroll. None keeps books of its own.",
    },
    {
        value: "86",
        label: "Accounts in the standard chart",
        note: "Coded by class, named in Indonesian and English, ready to post on day one.",
    },
    {
        value: "10",
        suffix: " yrs",
        label: "Audit trail retention",
        note: "A shorter retention is refused, per UU KUP Pasal 28. It is not a setting.",
    },
    {
        value: "4",
        label: "Fiscal asset groups",
        note: "Kelompok 1 to 4 and buildings under Pasal 11, beside the commercial schedule.",
    },
] as const

export function ReadoutStrip() {
    return (
        <section className="relative border-y border-foreground/10 bg-background py-16">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid gap-y-10 gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
                    {READOUT.map((r, i) => (
                        <motion.div
                            key={r.label}
                            initial={{ opacity: 0, y: 18 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.5 }}
                            transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="font-display text-4xl font-bold tracking-tight text-foreground">
                                <Odometer value={r.value} delay={i * 0.08} />
                                {"suffix" in r && (
                                    <span className="ml-1 font-sans text-base font-medium tracking-normal text-muted-foreground">
                                        {r.suffix}
                                    </span>
                                )}
                            </div>
                            <div className="mt-3 h-px w-10 bg-emerald-600/60 dark:bg-emerald-400/60" />
                            <p className="mt-3 text-sm font-medium text-foreground">{r.label}</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                                {r.note}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ── Standards band ──────────────────────────────────────────────── */

/**
 * What the books are kept against, stated once and held still.
 *
 * This replaced a two-row scrolling marquee of chips. A moving wall of
 * acronyms is how generic SaaS pages signal breadth; it also listed IFRS
 * and US GAAP, which the product does not report under, and "Balance
 * Sheet", which is not the house term. Each entry here names what the
 * product does about it, with the safe verbs from DESIGN-SYSTEM.md §6:
 * records, exports, applies - never "determines".
 */
const STANDARDS = [
    { code: "PSAK", text: "Statement set: financial position, profit or loss and OCI, changes in equity, cash flows, notes" },
    { code: "PPN", text: "Output and input recorded per line; SPT Masa PPN summary and settlement journal" },
    { code: "e-Faktur", text: "Faktur pajak data exported as CSV; missing NSFP reported, never invented" },
    { code: "PPh 21", text: "TER rates of PP 58/2023 applied monthly; December settles under Pasal 17" },
    { code: "PPh 23 · 4(2)", text: "Withholding recorded on bills; e-Bupot CSV export" },
    { code: "UU KUP 28", text: "Append-only, hash-chained document history kept for ten years" },
] as const

export function StandardsBand() {
    return (
        <section className="relative border-y border-foreground/10 bg-background py-20">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Kept against
                        </p>
                        <h2 className="font-display mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-foreground">
                            Indonesian standards, in their own terms.
                        </h2>
                        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                            The product records, organises and exports. Judgements on tax
                            treatment stay with your accountant, where the liability sits.
                        </p>
                    </div>

                    <dl className="grid gap-x-10 sm:grid-cols-2">
                        {STANDARDS.map((st, i) => (
                            <motion.div
                                key={st.code}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.6 }}
                                transition={{ delay: (i % 2) * 0.06 + Math.floor(i / 2) * 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="border-t border-foreground/10 py-5"
                            >
                                <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                                    {st.code}
                                </dt>
                                <dd className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{st.text}</dd>
                            </motion.div>
                        ))}
                    </dl>
                </div>
            </div>
        </section>
    )
}

/* ── Closing statement ───────────────────────────────────────────── */

/**
 * The closing claim.
 *
 * Two earlier versions were wrong in instructive ways.
 *
 * "Books that close themselves" overclaimed an automation the product
 * does not perform, and implied a balanced ledger is a correct one.
 *
 * "Balanced on every axis" fixed the overclaim but argued the thesis
 * instead of stating it, and its body promised BalanceIO would carry a
 * transaction through "the PPN it creates". That is a claim the product
 * must never make: deciding a transaction's tax treatment from the
 * journal alone is a professional judgement, and taking it on would move
 * the liability for that judgement onto us. The tax module records,
 * tracks and exports - it does not determine.
 */
// "BalanceIO, on every axis." was the third version, and it still argued
// the thesis instead of telling the reader what to do next. The close is
// now the next step, stated plainly.
const CLOSING = ["Start", "with", "this", "month's", "entries."]

export function MachineClose() {
    const ref = React.useRef<HTMLElement>(null)
    const inView = useInView(ref, { once: true, amount: 0.4 })
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end end"],
    })
    // The rule draws itself across the page as the section arrives —
    // the machine's last stroke before it comes to rest.
    const ruleScale = useTransform(scrollYProgress, [0.15, 0.8], [0, 1])

    return (
        <section ref={ref} className="relative overflow-hidden bg-background py-36">
            <div
                aria-hidden
                className="absolute inset-0 opacity-40 dark:opacity-25 [background-image:linear-gradient(to_right,rgba(120,130,140,0.12)_1px,transparent_1px)] [background-size:56px_100%]"
            />
            <div
                aria-hidden
                className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.04] blur-[130px]"
            />

            <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
                <motion.div
                    style={{ scaleX: ruleScale }}
                    className="mx-auto mb-12 h-px w-full max-w-xs origin-center bg-gradient-to-r from-transparent via-emerald-600 to-transparent dark:via-emerald-400"
                />

                <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-foreground">
                    {CLOSING.map((w, i) => (
                        <span key={w} className="inline-block overflow-hidden pb-[0.06em]">
                            <motion.span
                                initial={{ y: "110%" }}
                                animate={inView ? { y: "0%" } : { y: "110%" }}
                                transition={{
                                    delay: 0.1 + i * 0.08,
                                    duration: 0.9,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                className={
                                    "inline-block mr-[0.26em] will-change-transform " +
                                    (i === CLOSING.length - 1
                                        ? "italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent"
                                        : "")
                                }
                            >
                                {w}
                            </motion.span>
                        </span>
                    ))}
                </h2>

                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.55, duration: 0.7 }}
                    className="mx-auto mt-8 max-w-xl text-base sm:text-lg leading-relaxed text-muted-foreground"
                >
                    Create an account, load the standard chart and post the first
                    journal. Opening balances from your previous system can be
                    imported when you are ready, and the period locks once it closes.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.75, duration: 0.7 }}
                    className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4"
                >
                    <Link
                        href="/register"
                        className="group inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-colors hover:bg-foreground/85"
                    >
                        Create an account
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                    <Link
                        href="/pricing"
                        className="text-[15px] font-medium text-foreground underline decoration-foreground/25 underline-offset-[6px] transition-colors hover:decoration-foreground"
                    >
                        Compare plans
                    </Link>
                </motion.div>

                <motion.p
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.95, duration: 0.9 }}
                    className="mt-8 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
                >
                    Free plan · No card required
                </motion.p>
            </div>
        </section>
    )
}
