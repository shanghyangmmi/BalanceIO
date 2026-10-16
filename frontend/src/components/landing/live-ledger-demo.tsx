"use client"

import * as React from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { CheckCircle2, Lock } from "lucide-react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { TiltCard } from "@/components/landing/tilt-card"
import { formatCurrency } from "@/lib/utils/formatter"

const SCENARIOS = [
    {
        ref: "JE-2026-0812 · Cash sale, PPN output",
        lines: [
            { account: "1-1100 · Cash & Bank", debit: 55_500_000, credit: 0 },
            { account: "4-1000 · Sales Revenue", debit: 0, credit: 50_000_000 },
            { account: "2-1300 · VAT (PPN) Output", debit: 0, credit: 5_500_000 },
        ],
    },
    {
        ref: "JE-2026-0813 · Monthly depreciation",
        lines: [
            { account: "6-2400 · Depreciation Expense", debit: 12_250_000, credit: 0 },
            { account: "1-5900 · Accum. Depreciation", debit: 0, credit: 12_250_000 },
        ],
    },
    {
        ref: "JE-2026-0814 · Payroll accrual + PPh 21",
        lines: [
            { account: "6-1000 · Salaries Expense", debit: 86_000_000, credit: 0 },
            { account: "2-1400 · PPh 21 Payable", debit: 0, credit: 4_300_000 },
            { account: "2-1100 · Salaries Payable", debit: 0, credit: 81_700_000 },
        ],
    },
]

/**
 * "Watch it balance itself" — a journal entry writes itself line by line,
 * the debit/credit meter converges, and the entry locks as Posted with a
 * spring pop. Loops through realistic Indonesian-accounting scenarios.
 * Runs only while in view (zero off-screen work). Fully theme-aware.
 */
export function LiveLedgerDemo() {
    const ref = React.useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { amount: 0.4 })

    const [scenarioIdx, setScenarioIdx] = React.useState(0)
    const [visibleLines, setVisibleLines] = React.useState(0)
    const [posted, setPosted] = React.useState(false)

    const scenario = SCENARIOS[scenarioIdx]

    React.useEffect(() => {
        if (!inView) return
        let cancelled = false
        const timers: ReturnType<typeof setTimeout>[] = []

        setVisibleLines(0)
        setPosted(false)
        scenario.lines.forEach((_, i) => {
            timers.push(setTimeout(() => !cancelled && setVisibleLines(i + 1), 600 + i * 850))
        })
        const postAt = 600 + scenario.lines.length * 850 + 700
        timers.push(setTimeout(() => !cancelled && setPosted(true), postAt))
        timers.push(
            setTimeout(() => {
                if (!cancelled) setScenarioIdx((s) => (s + 1) % SCENARIOS.length)
            }, postAt + 2600)
        )

        return () => {
            cancelled = true
            timers.forEach(clearTimeout)
        }
    }, [inView, scenarioIdx, scenario.lines])

    const shownLines = scenario.lines.slice(0, visibleLines)
    const totalDebit = shownLines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = shownLines.reduce((s, l) => s + l.credit, 0)
    const balanced = totalDebit === totalCredit && totalDebit > 0

    return (
        <section className="relative py-32 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[60%] bg-emerald-500/[0.03] dark:bg-emerald-500/5 blur-[140px] rounded-full" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="text-center mb-16"
                >
                    <div className="flex items-center justify-center gap-3">
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            Built-in accounting controls
                        </span>
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                    </div>
                    <h2 className="font-display mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                        Mistakes stop{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                            before they post.
                        </span>
                    </h2>
                    <p className="mt-5 max-w-2xl mx-auto text-muted-foreground">
                        Every entry passes automatic validation, closed periods are locked,
                        and posted entries can never be silently altered — so human error
                        is caught at the source, not discovered in your reports.
                    </p>
                </motion.div>

                <motion.div
                    ref={ref}
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ type: "spring", stiffness: 90, damping: 18 }}
                    className="mx-auto max-w-3xl [perspective:1400px]"
                >
                <TiltCard max={5} className="rounded-3xl">
                <div className="relative rounded-3xl border border-zinc-900/10 bg-white/85 dark:border-white/10 dark:bg-zinc-900/70 backdrop-blur-2xl shadow-2xl shadow-zinc-900/10 dark:shadow-emerald-950/30 overflow-hidden">
                    <div className="absolute inset-0 bg-noise pointer-events-none" />
                    {/* Title bar */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900/5 dark:border-white/5 bg-zinc-900/[0.02] dark:bg-white/[0.02]">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={scenario.ref}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="text-xs font-mono text-muted-foreground"
                            >
                                {scenario.ref}
                            </motion.span>
                        </AnimatePresence>
                        <AnimatePresence>
                            {posted && (
                                <motion.span
                                    initial={{ scale: 0.4, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.6, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 border border-emerald-600/25 dark:bg-emerald-500/15 dark:border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
                                >
                                    <Lock className="h-3 w-3" />
                                    POSTED
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Lines */}
                    <div className="px-6 py-4 min-h-[190px]">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-8 text-[11px] uppercase tracking-widest text-muted-foreground/70 pb-3 border-b border-zinc-900/5 dark:border-white/5">
                            <span>Account</span>
                            <span className="text-right w-28">Debit</span>
                            <span className="text-right w-28">Credit</span>
                        </div>
                        <AnimatePresence mode="popLayout">
                            {shownLines.map((line) => (
                                <motion.div
                                    key={`${scenario.ref}-${line.account}`}
                                    layout
                                    initial={{ opacity: 0, x: -24, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, x: 24 }}
                                    transition={{ type: "spring", stiffness: 250, damping: 24 }}
                                    className="grid grid-cols-[1fr_auto_auto] gap-x-8 py-3 border-b border-zinc-900/[0.03] dark:border-white/[0.03] text-sm"
                                >
                                    <span className="text-foreground/85 font-medium truncate">
                                        {line.account}
                                    </span>
                                    <span className="text-right w-28 font-money text-emerald-700 dark:text-emerald-300">
                                        {line.debit > 0 ? (
                                            <NumberTicker value={line.debit} format={(v) => formatCurrency(v)} stiffness={120} />
                                        ) : (
                                            <span className="text-muted-foreground/30">—</span>
                                        )}
                                    </span>
                                    <span className="text-right w-28 font-money text-cyan-700 dark:text-cyan-300">
                                        {line.credit > 0 ? (
                                            <NumberTicker value={line.credit} format={(v) => formatCurrency(v)} stiffness={120} />
                                        ) : (
                                            <span className="text-muted-foreground/30">—</span>
                                        )}
                                    </span>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>

                    {/* Balance meter */}
                    <div className="px-6 pb-6">
                        <div className="flex items-center justify-between text-xs mb-2">
                            <span className="text-muted-foreground">Balance check</span>
                            <span
                                className={
                                    balanced
                                        ? "text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1"
                                        : "text-muted-foreground"
                                }
                            >
                                {balanced ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        Dr {formatCurrency(totalDebit)} = Cr {formatCurrency(totalCredit)}
                                    </>
                                ) : (
                                    "Awaiting lines…"
                                )}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-900/5 dark:bg-white/5 overflow-hidden">
                            <motion.div
                                animate={{
                                    width: balanced ? "100%" : `${visibleLines * 30}%`,
                                    backgroundColor: balanced ? "#059669" : "#a1a1aa",
                                }}
                                transition={{ type: "spring", stiffness: 120, damping: 20 }}
                                className="h-full rounded-full"
                                style={{
                                    boxShadow: balanced ? "0 0 16px rgba(16,185,129,0.5)" : "none",
                                }}
                            />
                        </div>
                    </div>

                    {/* Posted flash overlay */}
                    <AnimatePresence>
                        {posted && (
                            <motion.div
                                initial={{ opacity: 0.25 }}
                                animate={{ opacity: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.9 }}
                                className="absolute inset-0 pointer-events-none bg-emerald-400"
                            />
                        )}
                    </AnimatePresence>
                </div>
                </TiltCard>
                </motion.div>
            </div>
        </section>
    )
}
