"use client"

import * as React from "react"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
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
 * thing, neither matching the 25 report pages that exist. On a product
 * whose whole positioning is trust, a number nobody checked is worse
 * than no number.
 */
const READOUT = [
    { value: "8", label: "Integrated modules", note: "Ledger, sales, purchasing, stock, assets, tax, reports, controls" },
    { value: "25", label: "Financial reports", note: "Statutory, management and audit" },
    { value: "76", label: "Accounts pre-built", note: "Indonesian chart of accounts, ready to post on day one" },
    { value: "100", label: "Percent traceable", note: "Every figure back to the entry that made it", suffix: "%" },
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
                                    <span className="text-emerald-700 dark:text-emerald-400">
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
const CLOSING = ["BalanceIO,", "on", "every", "axis."]

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
                className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.05] blur-[130px]"
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
                    One system for the whole cycle — accounting, sales, purchasing,
                    inventory, fixed assets and tax records — so the entry you make on
                    Monday is still the entry behind the statement in March, with the
                    trail intact for whoever asks.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.85, duration: 0.9 }}
                    className="mt-12 flex items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                    Accounting · Inventory · Assets · Tax — one trail
                </motion.div>
            </div>
        </section>
    )
}
