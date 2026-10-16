"use client"

import * as React from "react"
import { SPRING } from "@/lib/motion"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard,
    BookOpen,
    PieChart,
    Calculator,
    Lock,
    ArrowUpRight,
    TrendingUp,
    Wallet,
    CreditCard,
    FileText,
} from "lucide-react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatCurrency } from "@/lib/utils/formatter"
import { TiltCard } from "@/components/landing/tilt-card"
import { cn } from "@/lib/utils"

const TABS = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, url: "app.balanceio.id/dashboard" },
    { id: "journal", label: "Journal", icon: BookOpen, url: "app.balanceio.id/accounting/journal" },
    { id: "reports", label: "Reports", icon: PieChart, url: "app.balanceio.id/reports/profit-loss" },
    { id: "tax", label: "Tax", icon: Calculator, url: "app.balanceio.id/tax" },
] as const

type TabId = (typeof TABS)[number]["id"]

/* ── Panel: Dashboard ─────────────────────────────────────────────────── */
function DashboardPanel() {
    const tiles = [
        { label: "Revenue (YTD)", value: 2_845_000_000, icon: TrendingUp, tint: "text-emerald-700 dark:text-emerald-400" },
        { label: "Expenses (YTD)", value: 1_632_500_000, icon: CreditCard, tint: "text-rose-600 dark:text-rose-400" },
        { label: "Cash & Bank", value: 964_200_000, icon: Wallet, tint: "text-cyan-700 dark:text-cyan-400" },
        { label: "Open Invoices", value: 37, icon: FileText, tint: "text-amber-600 dark:text-amber-400", plain: true },
    ]
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {tiles.map((t, i) => (
                    <motion.div
                        key={t.label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07, type: "spring", stiffness: 200, damping: 22 }}
                        whileHover={{ y: -3, scale: 1.02 }}
                        className="rounded-xl border border-zinc-900/[0.07] dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] p-3.5 cursor-default"
                    >
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.label}</span>
                            <t.icon className={cn("h-3.5 w-3.5", t.tint)} />
                        </div>
                        <div className={cn("text-sm font-bold font-money", t.tint)}>
                            <NumberTicker
                                value={t.value}
                                format={t.plain ? undefined : (v) => formatCurrency(v)}
                                stiffness={70}
                            />
                        </div>
                    </motion.div>
                ))}
            </div>
            {/* Revenue flow bars */}
            <div className="rounded-xl border border-zinc-900/[0.07] dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Revenue Flow · 12 months</div>
                <div className="flex items-end gap-1.5 h-24">
                    {[42, 58, 38, 66, 52, 74, 61, 83, 70, 90, 78, 100].map((h, i) => (
                        <motion.div
                            key={i}
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            whileHover={{ scaleY: 1.06 }}
                            transition={{ delay: 0.2 + i * 0.045, type: "spring", stiffness: 220, damping: 20 }}
                            style={{ height: `${h}%`, transformOrigin: "bottom" }}
                            className="flex-1 rounded-t-[4px] bg-gradient-to-t from-emerald-700/40 to-emerald-500 dark:from-emerald-600/40 dark:to-emerald-400 hover:to-cyan-400 transition-colors"
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ── Panel: Journal ───────────────────────────────────────────────────── */
function JournalPanel() {
    const rows = [
        { acc: "1-1100 · Cash & Bank", d: 55_500_000, c: 0 },
        { acc: "4-1000 · Sales Revenue", d: 0, c: 50_000_000 },
        { acc: "2-1300 · VAT (PPN) Output", d: 0, c: 5_500_000 },
    ]
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">JE-2026-0812 · Cash sale</span>
                <motion.span
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.1, type: "spring", stiffness: 400, damping: 16 }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 border border-emerald-600/25 dark:bg-emerald-500/15 dark:border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                >
                    <Lock className="h-2.5 w-2.5" /> POSTED
                </motion.span>
            </div>
            <div className="rounded-xl border border-zinc-900/[0.07] dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 py-2 text-[9px] uppercase tracking-widest text-muted-foreground/70 border-b border-zinc-900/[0.05] dark:border-white/[0.05]">
                    <span>Account</span>
                    <span className="w-24 text-right">Debit</span>
                    <span className="w-24 text-right">Credit</span>
                </div>
                {rows.map((r, i) => (
                    <motion.div
                        key={r.acc}
                        initial={{ opacity: 0, x: -18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.18, type: "spring", stiffness: 240, damping: 24 }}
                        className="grid grid-cols-[1fr_auto_auto] gap-x-6 px-4 py-2.5 text-xs border-b border-zinc-900/[0.03] dark:border-white/[0.03] hover:bg-emerald-600/[0.04] dark:hover:bg-emerald-500/[0.06] transition-colors cursor-default"
                    >
                        <span className="text-foreground/85 font-medium truncate">{r.acc}</span>
                        <span className="w-24 text-right font-money text-emerald-700 dark:text-emerald-300">
                            {r.d ? <NumberTicker value={r.d} format={(v) => formatCurrency(v)} stiffness={130} /> : <span className="text-muted-foreground/30">—</span>}
                        </span>
                        <span className="w-24 text-right font-money text-cyan-700 dark:text-cyan-300">
                            {r.c ? <NumberTicker value={r.c} format={(v) => formatCurrency(v)} stiffness={130} /> : <span className="text-muted-foreground/30">—</span>}
                        </span>
                    </motion.div>
                ))}
            </div>
            {/* Balance meter */}
            <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span>Balance check</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Dr = Cr · exact</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-900/5 dark:bg-white/5 overflow-hidden">
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 0.7, ...SPRING.soft }}
                        className="h-full w-full origin-left rounded-full bg-emerald-600 dark:bg-emerald-500"
                        style={{ boxShadow: "0 0 12px rgba(16,185,129,0.5)" }}
                    />
                </div>
            </div>
        </div>
    )
}

/* ── Panel: Reports ───────────────────────────────────────────────────── */
function ReportsPanel() {
    const reports = ["Balance Sheet", "Profit & Loss", "Cash Flow", "Trial Balance"]
    return (
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
            {/* Area chart with draw-on animation */}
            <div className="rounded-xl border border-zinc-900/[0.07] dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Net Profit · trailing 12m</div>
                <svg viewBox="0 0 300 110" className="w-full h-28">
                    <defs>
                        <linearGradient id="pp-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <motion.path
                        d="M0,90 C30,82 45,60 75,64 C105,68 120,40 150,44 C180,48 195,28 225,30 C255,32 275,16 300,10"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.4, ease: "easeInOut", delay: 0.2 }}
                    />
                    <motion.path
                        d="M0,90 C30,82 45,60 75,64 C105,68 120,40 150,44 C180,48 195,28 225,30 C255,32 275,16 300,10 L300,110 L0,110 Z"
                        fill="url(#pp-area)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2, duration: 0.6 }}
                    />
                </svg>
                <div className="mt-1 text-lg font-bold font-money text-foreground">
                    <NumberTicker value={1_212_500_000} format={(v) => formatCurrency(v)} stiffness={50} />
                </div>
            </div>
            {/* Report list */}
            <div className="space-y-2">
                {reports.map((r, i) => (
                    <motion.div
                        key={r}
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.09, type: "spring", stiffness: 220, damping: 24 }}
                        whileHover={{ x: 4 }}
                        className="group flex items-center justify-between rounded-lg border border-zinc-900/[0.07] dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] px-3.5 py-2.5 text-xs font-medium text-foreground/85 cursor-default hover:border-emerald-600/30 dark:hover:border-emerald-500/30 transition-colors"
                    >
                        {r}
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                    </motion.div>
                ))}
                <div className="text-[10px] text-muted-foreground text-right pt-1">+ 12 more reports</div>
            </div>
        </div>
    )
}

/* ── Panel: Tax ───────────────────────────────────────────────────────── */
function TaxPanel() {
    const tiles = [
        { label: "PPN Output · July", value: 128_400_000 },
        { label: "PPN Input · July", value: 87_100_000 },
        { label: "PPh 21 Withheld", value: 24_350_000 },
    ]
    return (
        <div className="space-y-4">
            <div className="grid lg:grid-cols-3 gap-3">
                {tiles.map((t, i) => (
                    <motion.div
                        key={t.label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.09, type: "spring", stiffness: 200, damping: 22 }}
                        whileHover={{ y: -3 }}
                        className="rounded-xl border border-zinc-900/[0.07] dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.03] p-4 cursor-default"
                    >
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{t.label}</div>
                        <div className="text-sm font-bold font-money text-foreground">
                            <NumberTicker value={t.value} format={(v) => formatCurrency(v)} stiffness={70} />
                        </div>
                    </motion.div>
                ))}
            </div>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between rounded-xl border border-emerald-600/20 dark:border-emerald-500/25 bg-emerald-600/[0.05] dark:bg-emerald-500/[0.07] px-4 py-3"
            >
                <div className="text-xs text-foreground/85">
                    <span className="font-semibold">Net PPN payable:</span>{" "}
                    <span className="font-money text-emerald-700 dark:text-emerald-400 font-bold">
                        <NumberTicker value={41_300_000} format={(v) => formatCurrency(v)} stiffness={60} />
                    </span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-bold">
                    Coretax-ready
                </span>
            </motion.div>
        </div>
    )
}

const PANELS: Record<TabId, React.ComponentType> = {
    dashboard: DashboardPanel,
    journal: JournalPanel,
    reports: ReportsPanel,
    tax: TaxPanel,
}

/**
 * "Inside the product" — a live, tabbed preview in a glass browser frame.
 * Tabs switch with a sliding pill + AnimatePresence; every panel replays
 * its choreography on entry and reacts to hover. Instant, cached, weightless.
 */
export function ProductPreview() {
    const [tab, setTab] = React.useState<TabId>("dashboard")
    const active = TABS.find((t) => t.id === tab)!
    const Panel = PANELS[tab]

    return (
        <section className="relative py-32 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 dark:hidden bg-[linear-gradient(180deg,transparent,#ecfdf5_55%,transparent)] opacity-50" />
                <div className="absolute top-[20%] right-[-15%] w-[50%] h-[50%] bg-cyan-500/[0.05] dark:bg-cyan-500/[0.07] blur-[130px] rounded-full" />
                <div className="absolute inset-0 bg-noise" />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="text-center mb-12"
                >
                    <div className="flex items-center justify-center gap-3">
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            Inside the product
                        </span>
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                    </div>
                    <h2 className="font-display mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                        See it{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                            before you sign in.
                        </span>
                    </h2>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Switch tabs, hover around — everything reacts.
                    </p>
                </motion.div>

                {/* Tab pills */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 120, damping: 20 }}
                    className="flex justify-center mb-8"
                >
                    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-900/10 dark:border-white/10 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl p-1.5 shadow-sm">
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={cn(
                                    "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                                    tab === t.id
                                        ? "text-white dark:text-zinc-950"
                                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                                )}
                            >
                                {tab === t.id && (
                                    <motion.span
                                        layoutId="preview-tab-pill"
                                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                        className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-emerald-400 shadow-md"
                                    />
                                )}
                                <t.icon className="relative z-10 h-3.5 w-3.5" />
                                <span className="relative z-10">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Browser frame with tilt */}
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ type: "spring", stiffness: 90, damping: 18 }}
                    className="[perspective:1400px]"
                >
                    <TiltCard max={4} className="rounded-2xl">
                        <div className="rounded-2xl border border-zinc-900/10 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-2xl shadow-2xl shadow-zinc-900/10 dark:shadow-emerald-950/30 overflow-hidden">
                            {/* Chrome bar */}
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-900/[0.06] dark:border-white/[0.06] bg-zinc-900/[0.02] dark:bg-white/[0.02]">
                                <div className="flex gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                                </div>
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={active.url}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.18 }}
                                        className="flex-1 max-w-sm mx-auto rounded-md border border-zinc-900/[0.06] dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.04] px-3 py-1 text-center text-[10px] font-mono text-muted-foreground truncate"
                                    >
                                        {active.url}
                                    </motion.div>
                                </AnimatePresence>
                                <div className="w-10" />
                            </div>

                            {/* Panel body */}
                            <div className="p-5 min-h-[300px] relative">
                                <div className="absolute inset-0 bg-noise pointer-events-none" />
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={tab}
                                        initial={{ opacity: 0, y: 16, scale: 0.99 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -12, scale: 0.99 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 26 }}
                                        className="relative"
                                    >
                                        <Panel />
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>
                    </TiltCard>
                </motion.div>
            </div>
        </section>
    )
}
