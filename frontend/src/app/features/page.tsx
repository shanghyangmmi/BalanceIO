"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    BookOpen,
    PieChart,
    Globe,
    Scale,
    Calculator,
    ShieldCheck,
    FileText,
    Boxes,
    Building2,
    RefreshCcw,
    Command,
    DatabaseBackup,
    ArrowRight,
    Check,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { TiltCard } from "@/components/landing/tilt-card"
import { Magnetic } from "@/components/landing/magnetic"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatCurrency } from "@/lib/utils/formatter"
import { cn } from "@/lib/utils"
import { SPRING, EASE_HOUSE } from "@/lib/motion"
import { SmoothScrollProvider } from "@/components/landing/scroll-engine"

/* ────────────────────────────────────────────────────────────────────────
   Deep-dive capabilities (tabbed)
──────────────────────────────────────────────────────────────────────── */
interface Capability {
    id: string
    icon: React.ElementType
    label: string
    title: string
    body: string
    points: string[]
    visual: React.ComponentType
}

function LedgerVisual() {
    const rows = [
        { a: "1-1100 · Cash & Bank", d: 55_500_000, c: 0 },
        { a: "4-1000 · Sales Revenue", d: 0, c: 50_000_000 },
        { a: "2-1300 · PPN Output", d: 0, c: 5_500_000 },
    ]
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-1">
                <span className="font-mono">Journal #JV-2026-008</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider">
                    Posted (Locked)
                </span>
            </div>
            {rows.map((r, i) => (
                <motion.div
                    key={r.a}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.14, ...SPRING.medium }}
                    className="flex justify-between items-center rounded-lg border border-foreground/[0.06] bg-card/70 px-3 py-2 text-[11px]"
                >
                    <span className="text-foreground/80 font-medium truncate mr-3">{r.a}</span>
                    <span className="font-money text-emerald-700 dark:text-emerald-300 shrink-0">
                        {formatCurrency(r.d || r.c)}
                    </span>
                </motion.div>
            ))}
            <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.6, ...SPRING.soft }}
                className="h-1.5 w-full origin-left rounded-full bg-emerald-600 dark:bg-emerald-500"
                style={{ boxShadow: "0 0 12px rgba(16,185,129,0.5)" }}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-semibold">
                <span className="text-muted-foreground">Drafts stay Unposted until ready</span>
                <span className="text-emerald-700 dark:text-emerald-400">Dr = Cr · balanced exactly</span>
            </div>
        </div>
    )
}

function ReportsVisual() {
    return (
        <div>
            <div className="flex items-end gap-1.5 h-24 mb-2">
                {[45, 62, 50, 74, 58, 86, 68, 95, 78, 100].map((h, i) => (
                    <motion.div
                        key={i}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.1 + i * 0.05, ...SPRING.medium }}
                        style={{ height: `${h}%`, transformOrigin: "bottom" }}
                        className="flex-1 rounded-t-[4px] bg-gradient-to-t from-emerald-700/40 to-emerald-500 dark:from-emerald-600/40 dark:to-emerald-400"
                    />
                ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Net profit · trailing 12m</span>
                <span className="font-money font-bold text-foreground">
                    <NumberTicker value={1_212_500_000} format={(v) => formatCurrency(v)} stiffness={55} />
                </span>
            </div>
        </div>
    )
}

function CurrencyVisual() {
    const pairs = [
        { p: "USD / IDR", v: "16.245", up: true },
        { p: "SGD / IDR", v: "12.108", up: false },
        { p: "EUR / IDR", v: "17.632", up: true },
    ]
    return (
        <div className="space-y-2">
            {pairs.map((x, i) => (
                <motion.div
                    key={x.p}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.12, ...SPRING.medium }}
                    className="flex justify-between items-center rounded-lg border border-foreground/[0.06] bg-card/70 px-3 py-2.5 text-xs"
                >
                    <span className="font-mono text-muted-foreground">{x.p}</span>
                    <span className={cn("font-money font-bold", x.up ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                        {x.v} {x.up ? "▲" : "▼"}
                    </span>
                </motion.div>
            ))}
            <div className="text-[10px] text-muted-foreground text-right">Rate as booked, per transaction</div>
        </div>
    )
}

function ComplianceVisual() {
    const items = ["Revenue recognition", "Depreciation schedules", "Period locking", "Period closing"]
    return (
        <div className="space-y-2">
            {items.map((x, i) => (
                <motion.div
                    key={x}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.11, ...SPRING.medium }}
                    className="flex items-center gap-2.5 rounded-lg border border-foreground/[0.06] bg-card/70 px-3 py-2 text-xs text-foreground/85"
                >
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600/10 dark:bg-emerald-500/15">
                        <Check className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
                    </span>
                    {x}
                </motion.div>
            ))}
        </div>
    )
}

function TaxVisual() {
    return (
        <div className="space-y-2.5">
            {[
                { l: "PPN Output · July", v: 128_400_000 },
                { l: "PPN Input · July", v: 87_100_000 },
            ].map((t, i) => (
                <motion.div
                    key={t.l}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.12, ...SPRING.medium }}
                    className="flex justify-between rounded-lg border border-foreground/[0.06] bg-card/70 px-3 py-2.5 text-xs"
                >
                    <span className="text-muted-foreground">{t.l}</span>
                    <span className="font-money font-bold text-foreground">
                        <NumberTicker value={t.v} format={(v) => formatCurrency(v)} stiffness={80} />
                    </span>
                </motion.div>
            ))}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.6, ease: EASE_HOUSE }}
                className="rounded-lg border border-emerald-600/25 dark:border-emerald-500/25 bg-emerald-600/[0.06] dark:bg-emerald-500/[0.08] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 text-center"
            >
                Structured tax data support
            </motion.div>
        </div>
    )
}

function SecurityVisual() {
    const roles = [
        { r: "Owner", p: "Full access" },
        { r: "Finance", p: "Post & report" },
        { r: "Staff", p: "Draft only" },
        { r: "Auditor", p: "Read only" },
    ]
    return (
        <div className="grid grid-cols-2 gap-2">
            {roles.map((x, i) => (
                <motion.div
                    key={x.r}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.09, ...SPRING.medium }}
                    className="rounded-lg border border-foreground/[0.06] bg-card/70 px-3 py-2.5"
                >
                    <div className="text-xs font-semibold text-foreground">{x.r}</div>
                    <div className="text-[10px] text-muted-foreground">{x.p}</div>
                </motion.div>
            ))}
        </div>
    )
}

const CAPABILITIES: Capability[] = [
    {
        id: "ledger",
        icon: BookOpen,
        label: "Ledger & Posting Control",
        title: "A ledger that runs itself — with total posting control",
        body: "Operational modules auto-post upon approval, while manual entries stay safely in Draft (Unposted) until verified. Double-entry is enforced to the exact rupiah with batch posting and immutable Void + Reversal audit trails.",
        points: ["Sub-ledger auto-posting on approval", "Draft (Unposted) entry safety", "Period lock stops back-dating", "Immutable Posted entries (Void & Reversals)"],
        visual: LedgerVisual,
    },
    {
        id: "reports",
        icon: PieChart,
        label: "Financial Reports",
        title: "Financial Statements & Disclosures",
        body: "25 financial and managerial reports generated live from posted ledger entries — from Statement of Financial Position, Statement of Profit or Loss and Other Comprehensive Income, Cash Flows, Equity, to Inventory & Fixed Assets Reports.",
        points: ["Statement of Financial Position", "Statement of Profit or Loss & Comprehensive Income", "Notes to Financial Statements", "Inventory & Fixed Assets Reports"],
        visual: ReportsVisual,
    },
    {
        id: "currency",
        icon: Globe,
        label: "Multi-Currency",
        title: "Books that cross borders",
        body: "Invoice in USD, pay in SGD, report in IDR. Every transaction carries the rate it was booked at — buy, sell and middle, dated — so the figure in the statement is the figure that was agreed.",
        points: ["Per-transaction exchange rates", "Dated rate table, buy / sell / middle", "Multi-currency AR / AP", "Consolidated IDR reporting"],
        visual: CurrencyVisual,
    },
    {
        id: "compliance",
        icon: Scale,
        label: "PSAK / IFRS Accommodating",
        title: "Compliance-ready by design",
        body: "Engineered to accommodate local PSAK and international IFRS reporting needs directly within the posting logic — supporting period locking, audit trails, and financial disclosures.",
        points: ["Accommodates PSAK & IFRS needs", "Period locking & closing", "Immutable posted entries", "Audit-ready trails"],
        visual: ComplianceVisual,
    },
    {
        id: "tax",
        icon: Calculator,
        label: "Tax Compliance Support",
        title: "Tax compliance data support",
        body: "Organize PPN input and output details per line item, track PPh withholding records, and maintain structured NPWP and invoice data formatted for easy export.",
        points: ["PPN input & output tracking", "PPh withholding record management", "NPWP & invoice data organization", "Exportable tax data format"],
        visual: TaxVisual,
    },
    {
        id: "security",
        icon: ShieldCheck,
        label: "RBAC Security",
        title: "Everyone sees exactly enough",
        body: "Granular role-based access down to individual actions, MFA on sign-in, encrypted credential storage, and an append-only audit log behind every mutation.",
        points: ["Granular role permissions", "Multi-factor authentication", "Append-only audit logs", "High data-protection standards"],
        visual: SecurityVisual,
    },
]

/* ────────────────────────────────────────────────────────────────────────
   Secondary bento
──────────────────────────────────────────────────────────────────────── */
/** Split for the mask reveal; the second clause carries the gradient. */
const HEADLINE: { text: string; accent?: boolean }[] = [
    { text: "Built" },
    { text: "like" },
    { text: "an" },
    { text: "audit" },
    { text: "firm." },
    { text: "Run", accent: true },
    { text: "like", accent: true },
    { text: "software.", accent: true },
]

const EXTRAS = [
    { icon: FileText, title: "Invoice templates", body: "Five premium, print-perfect designs." },
    { icon: Boxes, title: "Inventory & opname", body: "Multi-warehouse stock with physical counts." },
    { icon: Building2, title: "Fixed assets", body: "Auto depreciation, revaluation, disposal." },
    { icon: RefreshCcw, title: "Recurring journals", body: "Set the schedule, entries post themselves." },
    { icon: Command, title: "⌘K everywhere", body: "Any page or action in one keystroke." },
    { icon: DatabaseBackup, title: "Automated backups", body: "Your books, safeguarded continuously." },
]

export default function FeaturesPage() {
    const [active, setActive] = React.useState("ledger")
    const cap = CAPABILITIES.find((c) => c.id === active)!
    const Visual = cap.visual

    return (
        <SmoothScrollProvider>
        <div className="relative flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-emerald-500/25 overflow-hidden">
            <SiteHeader />

            {/* Ambient stage */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 dark:hidden bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent" />
                <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[100vw] aspect-square rounded-full opacity-[0.10] dark:opacity-20 blur-[110px] bg-[conic-gradient(from_90deg,transparent_0deg,var(--color-emerald-500)_60deg,var(--color-cyan-500)_140deg,transparent_220deg)] animate-[spin_30s_linear_infinite]" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(9,60,50,0.10)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
                <div className="absolute inset-0 bg-noise" />
            </div>

            <main className="flex-1 relative z-10 pt-40 pb-24">
                {/* ── Hero ─────────────────────────────────────────────── */}
                <section className="mx-auto max-w-4xl px-6 text-center mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-3 mb-7"
                    >
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            Features
                        </span>
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                    </motion.div>
                    {/* Mask reveal, not a fade.
                        The words slide up from behind a clipping edge, which is
                        the house technique for headlines - it reads as printed
                        rather than faded in. This page was using a plain
                        opacity+y drift while the landing hero next door used
                        the mask, and that difference is most of why the two
                        felt like different levels of finish. */}
                    <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]">
                        {HEADLINE.map((w, i) => (
                            <span key={w.text + i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                                <motion.span
                                    initial={{ y: "110%" }}
                                    animate={{ y: "0%" }}
                                    transition={{ delay: 0.1 + i * 0.06, duration: 0.85, ease: EASE_HOUSE }}
                                    className={
                                        "mr-[0.24em] inline-block will-change-transform " +
                                        (w.accent
                                            ? "italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent animate-gradient-flow [background-size:200%_200%]"
                                            : "")
                                    }
                                >
                                    {w.text}
                                </motion.span>
                            </span>
                        ))}
                    </h1>
                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.7, ease: EASE_HOUSE }}
                        className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
                    >
                        Six capabilities, each deep enough to close a period on.
                        Ledger and posting control, financial statements,
                        multi-currency, PSAK and IFRS, tax records, access control.
                    </motion.p>
                </section>

                {/* ── Tabbed deep-dive ─────────────────────────────────── */}
                <section className="mx-auto max-w-6xl px-6 mb-28">
                    <div className="grid lg:grid-cols-[280px_1fr] gap-8">
                        {/* Tab rail */}
                        <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                            {CAPABILITIES.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => setActive(c.id)}
                                    className={cn(
                                        "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors text-left",
                                        active === c.id
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {active === c.id && (
                                        <motion.span
                                            layoutId="feature-tab-bg"
                                            transition={{ ...SPRING.snappy }}
                                            className="absolute inset-0 rounded-xl border border-emerald-600/25 dark:border-emerald-500/25 bg-emerald-600/[0.06] dark:bg-emerald-500/[0.08]"
                                        />
                                    )}
                                    <c.icon
                                        className={cn(
                                            "relative z-10 h-4 w-4 shrink-0",
                                            active === c.id
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : "text-muted-foreground/70"
                                        )}
                                    />
                                    <span className="relative z-10">{c.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Detail panel */}
                        <div className="[perspective:1400px]">
                            <TiltCard max={3} className="rounded-3xl">
                                <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-card/60 backdrop-blur-sm min-h-[380px]">
                                    <div className="absolute inset-0 bg-noise pointer-events-none" />
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={cap.id}
                                            initial={{ opacity: 0, y: 18, scale: 0.99 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -12, scale: 0.99 }}
                                            transition={{ ...SPRING.medium }}
                                            className="relative p-8 space-y-6"
                                        >
                                            {/* Full-width Header Banner across top */}
                                            <div className="flex items-center gap-4 border-b border-foreground/10 pb-5">
                                                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-600/20 bg-emerald-600/[0.07] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0">
                                                    <cap.icon className="h-6 w-6" />
                                                </span>
                                                <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                                                    {cap.title}
                                                </h2>
                                            </div>

                                            {/* Content Grid */}
                                            <div className="grid md:grid-cols-[1.15fr_1fr] gap-8 items-center">
                                                <div>
                                                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6 text-justify">
                                                        {cap.body}
                                                    </p>
                                                    <ul className="space-y-2.5">
                                                        {cap.points.map((p, i) => (
                                                            <motion.li
                                                                key={p}
                                                                initial={{ opacity: 0, x: -12 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: EASE_HOUSE }}
                                                                className="flex items-center gap-2.5 text-sm font-medium text-foreground/90"
                                                            >
                                                                <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-600/10 dark:bg-emerald-500/15 shrink-0">
                                                                    <Check className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
                                                                </span>
                                                                {p}
                                                            </motion.li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <div className="rounded-2xl border border-foreground/[0.06] bg-foreground/[0.02] p-5 self-center">
                                                    <Visual />
                                                </div>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </TiltCard>
                        </div>
                    </div>
                </section>

                {/* ── Secondary bento ──────────────────────────────────── */}
                <section className="mx-auto max-w-6xl px-6 mb-28">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.5 }}
                        className="flex items-center gap-3 mb-10"
                    >
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            And everything around it
                        </span>
                    </motion.div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {EXTRAS.map((f, i) => (
                            <motion.div
                                key={f.title}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.4 }}
                                transition={{ delay: (i % 3) * 0.08, ...SPRING.soft }}
                                whileHover={{ y: -5 }}
                                className="group relative rounded-2xl border border-foreground/10 bg-card/60 backdrop-blur-xl p-6 overflow-hidden hover:border-emerald-600/25 dark:hover:border-emerald-500/25 transition-colors"
                            >
                                <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500/15 to-transparent blur-2xl opacity-40 group-hover:opacity-80 group-hover:scale-125 transition-all duration-500" />
                                <f.icon className="h-5 w-5 text-emerald-700 dark:text-emerald-400 mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                                <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.body}</p>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* ── Closing ──────────────────────────────────────────── */}
                <section className="mx-auto max-w-3xl px-6 text-center">
                    <motion.h2
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-8"
                    >
                        Ready to see the{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                            full picture?
                        </span>
                    </motion.h2>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ delay: 0.12, duration: 0.6, ease: EASE_HOUSE }}
                    >
                        <Magnetic>
                            <Link
                                href="/pricing"
                                className="group inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-bold bg-zinc-900 text-white hover:shadow-[0_12px_40px_-8px_rgba(16,185,129,0.5)] dark:bg-emerald-500 dark:text-zinc-950 dark:shadow-[0_0_40px_-8px_rgba(16,185,129,0.7)] transition-shadow"
                            >
                                Compare plans
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Magnetic>
                    </motion.div>
                </section>
            </main>

            <SiteFooter />
        </div>
        </SmoothScrollProvider>
    )
}
