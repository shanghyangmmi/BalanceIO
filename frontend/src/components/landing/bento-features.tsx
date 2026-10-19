"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Zap,
    Scale,
    Landmark,
    LineChart,
    ShieldCheck,
    Layers,
    Command,
} from "lucide-react"
import { NumberTicker } from "@/components/ui/number-ticker"

/* ────────────────────────────────────────────────────────────────────────
   Stats strip — consulting-exhibit style: hairline rules, serif figures
──────────────────────────────────────────────────────────────────────── */
interface StatItem {
    value: number
    suffix: string
    label: string
    exact?: string
}

const STATS: StatItem[] = [
    { value: 25, suffix: "", label: "financial reports" },
    { value: 8, suffix: "", label: "integrated modules" },
    { value: 100, suffix: "%", label: "double-entry validated" },
    { value: 3, suffix: "", label: "standards · PSAK / IFRS / GAAP" },
]

export function StatsStrip() {
    return (
        <section className="relative border-y border-zinc-900/10 dark:border-white/5 bg-zinc-900/[0.015] dark:bg-white/[0.015]">
            <div className="mx-auto max-w-6xl px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-10 lg:divide-x lg:divide-zinc-900/[0.06] dark:lg:divide-white/[0.06]">
                {STATS.map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ delay: i * 0.1, type: "spring", stiffness: 120, damping: 18 }}
                        className="text-center"
                    >
                        <div className="text-4xl font-bold text-foreground font-money">
                            {s.exact ? (
                                s.exact
                            ) : (
                                <NumberTicker value={s.value} stiffness={60} damping={22} />
                            )}
                            <span className="text-emerald-700 dark:text-emerald-400">{s.suffix}</span>
                        </div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {s.label}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    )
}

/* ────────────────────────────────────────────────────────────────────────
   Marquee — compliance & report vocabulary drifting past
──────────────────────────────────────────────────────────────────────── */
const MARQUEE_ITEMS = [
    "PSAK", "IFRS", "US GAAP", "PPN 11/12%", "PPh 21", "PPh 23", "Faktur Pajak",
    "Coretax", "Balance Sheet", "P&L", "Cash Flow", "Trial Balance",
    "Aged Receivables", "Multi-Currency", "Bankers Rounding", "Audit Trail",
]

export function ComplianceMarquee() {
    const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
    const rowB = [...MARQUEE_ITEMS.slice(8), ...MARQUEE_ITEMS.slice(0, 8)]
    const rowBFull = [...rowB, ...rowB]
    const chip =
        "whitespace-nowrap rounded-full border border-zinc-900/10 bg-zinc-900/[0.02] dark:border-white/10 dark:bg-white/[0.03] px-5 py-2 text-sm text-muted-foreground transition-colors hover:text-emerald-700 hover:border-emerald-600/30 dark:hover:text-emerald-300 dark:hover:border-emerald-500/30"
    return (
        <div className="relative py-10 overflow-hidden select-none space-y-3" aria-hidden>
            <div className="absolute inset-y-0 left-0 w-32 z-10 bg-gradient-to-r from-background to-transparent" />
            <div className="absolute inset-y-0 right-0 w-32 z-10 bg-gradient-to-l from-background to-transparent" />
            {/* Row 1 → drifts left */}
            <div className="flex w-max animate-marquee gap-4 hover:[animation-play-state:paused]">
                {row.map((item, i) => (
                    <span key={`a-${item}-${i}`} className={chip}>
                        {item}
                    </span>
                ))}
            </div>
            {/* Row 2 → drifts right, slower (counter-flow depth) */}
            <div className="flex w-max animate-marquee gap-4 [animation-direction:reverse] [animation-duration:56s] hover:[animation-play-state:paused]">
                {rowBFull.map((item, i) => (
                    <span key={`b-${item}-${i}`} className={chip}>
                        {item}
                    </span>
                ))}
            </div>
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────
   Bento features — cursor-tracked spotlight + spring lift
──────────────────────────────────────────────────────────────────────── */
interface Feature {
    icon: React.ElementType
    title: string
    body: string
    span?: string
    accent?: string
}

const FEATURES: Feature[] = [
    {
        icon: Scale,
        title: "A ledger that runs itself — with total posting control",
        body: "Operational modules auto-post upon approval, while manual entries stay safely in Draft (Unposted) until verified. Double-entry is enforced to the exact rupiah with batch posting and immutable Void + Reversal audit trails.",
        span: "lg:col-span-2",
        accent: "from-emerald-500/15",
    },
    {
        icon: Zap,
        title: "Fast on a large ledger",
        body: "Virtualised tables and cached queries, so a hundred thousand journal lines scroll like ten.",
        accent: "from-cyan-500/15",
    },
    {
        icon: Landmark,
        title: "Tax Compliance Support",
        body: "Track PPN input/output per line, organize PPh withholding details, and maintain structured NPWP & invoice records ready for export.",
        accent: "from-teal-500/15",
    },
    {
        icon: LineChart,
        title: "Financial Statements & Reports",
        body: "Statement of Financial Position, Comprehensive Income, Cash Flows, Equity, Notes to Financial Statements, Inventory & Fixed Assets Reports.",
        accent: "from-emerald-500/15",
    },
    {
        icon: Command,
        title: "⌘K everything",
        body: "One keystroke to any page, report or action.",
        accent: "from-cyan-500/15",
    },
    {
        icon: ShieldCheck,
        title: "Access you can audit",
        body: "Encrypted credentials, MFA, granular RBAC, and append-only audit logs on every mutation.",
        accent: "from-teal-500/15",
    },
    {
        icon: Layers,
        title: "Multi-company, multi-currency",
        body: "Tenant-isolated books, each with its own chart of accounts, and a dated rate table shared across them.",
        span: "lg:col-span-2",
        accent: "from-emerald-500/15",
    },
]

function BentoCard({ feature, index }: { feature: Feature; index: number }) {
    const ref = React.useRef<HTMLDivElement>(null)
    const [spot, setSpot] = React.useState({ x: 50, y: 50, on: false })

    const onMouseMove = (e: React.MouseEvent) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        setSpot({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            on: true,
        })
    }

    const Icon = feature.icon
    return (
        <motion.div
            ref={ref}
            onMouseMove={onMouseMove}
            onMouseLeave={() => setSpot((s) => ({ ...s, on: false }))}
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: (index % 3) * 0.08, type: "spring", stiffness: 110, damping: 18 }}
            whileHover={{ y: -6 }}
            className={`group relative rounded-3xl border border-zinc-900/10 bg-white/70 dark:border-white/10 dark:bg-zinc-900/50 backdrop-blur-xl p-7 overflow-hidden transition-colors hover:border-emerald-600/25 dark:hover:border-emerald-500/25 shadow-sm hover:shadow-xl hover:shadow-zinc-900/5 dark:shadow-none ${feature.span ?? ""}`}
        >
            {/* Cursor spotlight */}
            <div
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{
                    opacity: spot.on ? 1 : 0,
                    background: `radial-gradient(320px circle at ${spot.x}% ${spot.y}%, rgba(16,185,129,0.08), transparent 65%)`,
                }}
            />
            {/* Corner glow */}
            <div
                className={`absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${feature.accent ?? "from-emerald-500/15"} to-transparent blur-2xl opacity-40 group-hover:opacity-80 group-hover:scale-125 transition-all duration-500`}
            />

            <div className="relative z-10">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-600/20 bg-emerald-600/[0.07] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]">
                    <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
        </motion.div>
    )
}

export function BentoFeatures() {
    return (
        <section className="relative py-32 overflow-hidden">
            {/* Ambient texture (both themes) */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 dark:hidden bg-[linear-gradient(200deg,#f0fdfa_0%,transparent_35%)] opacity-70" />
                <div className="absolute bottom-[10%] right-[-10%] w-[45%] h-[45%] bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] blur-[130px] rounded-full" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(9,60,50,0.08)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_50%_50%_at_80%_50%,black,transparent)]" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="mb-16 max-w-2xl"
                >
                    <div className="flex items-center gap-3">
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            The engine room
                        </span>
                    </div>
                    <h2 className="font-display mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                        Serious accounting.{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                            Seriously polished.
                        </span>
                    </h2>
                </motion.div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map((f, i) => (
                        <BentoCard key={f.title} feature={f} index={i} />
                    ))}
                </div>
            </div>
        </section>
    )
}
