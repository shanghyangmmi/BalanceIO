"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Minus, ChevronDown, ArrowRight } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { TiltCard } from "@/components/landing/tilt-card"
import { Magnetic } from "@/components/landing/magnetic"
import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"
import { SmoothScrollProvider } from "@/components/landing/scroll-engine"

/* ────────────────────────────────────────────────────────────────────────
   Plans — yearly billing saves 20%
──────────────────────────────────────────────────────────────────────── */
const formatIDR = (v: number) =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(v)

interface Plan {
    name: string
    tagline: string
    monthly: number | null // null = custom
    features: string[]
    cta: string
    href: string
    popular?: boolean
}

const PLANS: Plan[] = [
    {
        name: "Starter",
        tagline: "For freelancers and first books",
        monthly: 0,
        features: [
            "50 journal entries / month",
            "1 user · 1 company",
            "Core financial reports",
            "Invoice templates",
            "Email support",
        ],
        cta: "Get Started",
        href: "/register",
    },
    {
        name: "Professional",
        tagline: "For growing businesses",
        monthly: 299_000,
        features: [
            "Unlimited journal entries",
            "5 users · 3 companies",
            "All 25 reports with drill-down",
            "Multi-currency with dated rate table",
            "PPN / PPh record tracking",
            "Inventory & fixed assets",
            "Priority support",
        ],
        cta: "Start Free Trial",
        href: "/register",
        popular: true,
    },
    {
        name: "Enterprise",
        tagline: "For groups and firms",
        monthly: null,
        features: [
            "Everything in Professional",
            "Unlimited users & companies",
            "Consolidated reporting",
            "Custom roles & approval flows",
            "Dedicated account manager",
            "SLA & onboarding assistance",
        ],
        cta: "Contact Sales",
        href: "/register",
    },
]

/* ────────────────────────────────────────────────────────────────────────
   Comparison matrix (expandable groups)
──────────────────────────────────────────────────────────────────────── */
type Cell = boolean | string

const MATRIX: { group: string; rows: { label: string; values: [Cell, Cell, Cell] }[] }[] = [
    {
        group: "Accounting",
        rows: [
            { label: "Journal entries", values: ["50 / month", "Unlimited", "Unlimited"] },
            { label: "Chart of Accounts", values: [true, true, true] },
            { label: "Recurring journals", values: [false, true, true] },
            { label: "Period locking", values: [false, true, true] },
            { label: "Void + reversal workflow", values: [true, true, true] },
        ],
    },
    {
        group: "Operations",
        rows: [
            { label: "Sales invoices & payments", values: [true, true, true] },
            { label: "Purchases & vendor bills", values: [false, true, true] },
            { label: "Inventory & stock opname", values: [false, true, true] },
            { label: "Fixed assets & depreciation", values: [false, true, true] },
            { label: "Projects & cost tracking", values: [false, true, true] },
        ],
    },
    {
        group: "Reports & Tax",
        rows: [
            { label: "Financial reports", values: ["Core 5", "All 16+", "All 16+"] },
            { label: "Drill-down to source", values: [false, true, true] },
            { label: "PPN / PPh record tracking", values: [false, true, true] },
            { label: "Multi-currency", values: [false, true, true] },
            { label: "Consolidated reporting", values: [false, false, true] },
        ],
    },
    {
        group: "Security & Support",
        rows: [
            { label: "MFA & audit logs", values: [true, true, true] },
            { label: "Role-based access", values: ["Basic", "Granular", "Custom + approvals"] },
            { label: "Users", values: ["1", "5", "Unlimited"] },
            { label: "Support", values: ["Email", "Priority", "Dedicated manager"] },
            { label: "SLA guarantee", values: [false, false, true] },
        ],
    },
]

function CellValue({ value }: { value: Cell }) {
    if (value === true)
        return (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600/10 dark:bg-emerald-500/15 mx-auto">
                <Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
            </span>
        )
    if (value === false) return <Minus className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />
    return <span className="text-xs font-medium text-foreground/80">{value}</span>
}

function ComparisonMatrix() {
    const [open, setOpen] = React.useState<string[]>(["Accounting"])
    const toggle = (g: string) =>
        setOpen((o) => (o.includes(g) ? o.filter((x) => x !== g) : [...o, g]))

    return (
        <div className="rounded-3xl border border-foreground/10 bg-card/60 backdrop-blur-xl overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] px-6 py-4 border-b border-foreground/[0.06] bg-foreground/[0.02]">
                <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                    Compare
                </span>
                {PLANS.map((p) => (
                    <span
                        key={p.name}
                        className={cn(
                            "text-center text-xs font-bold",
                            p.popular ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                        )}
                    >
                        {p.name}
                    </span>
                ))}
            </div>

            {MATRIX.map((section) => {
                const isOpen = open.includes(section.group)
                return (
                    <div key={section.group} className="border-b border-foreground/[0.05] last:border-0">
                        <button
                            onClick={() => toggle(section.group)}
                            className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-foreground hover:bg-emerald-600/[0.03] dark:hover:bg-emerald-500/[0.05] transition-colors"
                        >
                            {section.group}
                            <motion.span
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ ...SPRING.snappy }}
                            >
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </motion.span>
                        </button>
                        {/* Collapse by grid-template-rows, not by height.
                            Animating height forces a reflow of everything below
                            on every frame, and a *spring* on height is the worst
                            of both: springs settle slowly, so the reflow runs for
                            the whole settle. With Lenis driving scroll off the
                            GSAP ticker, that thrash competes with the scroll loop
                            directly.

                            0fr to 1fr is a pure CSS transition - no per-frame JS
                            style writes, no measurement pass, and a deterministic
                            duration on the house curve instead of an overshoot. */}
                        <div
                            className={cn(
                                "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                            )}
                        >
                            <div className="overflow-hidden">
                                    {section.rows.map((row, i) => (
                                        <div
                                            key={row.label}
                                            className={cn(
                                                "grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center px-6 py-3 text-center",
                                                i % 2 === 0 && "bg-foreground/[0.015]"
                                            )}
                                        >
                                            <span className="text-[13px] text-muted-foreground text-left">
                                                {row.label}
                                            </span>
                                            {row.values.map((v, j) => (
                                                <span key={j}>
                                                    <CellValue value={v} />
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────
   FAQ accordion
──────────────────────────────────────────────────────────────────────── */
const FAQS = [
    {
        q: "Can we migrate from our current accounting software?",
        a: "Yes. Chart of Accounts, contacts, products, and opening balances can be imported from spreadsheet templates. For larger migrations (multi-year ledgers, fixed-asset registers), our team assists Enterprise customers end to end.",
    },
    {
        q: "How is our financial data protected?",
        a: "Credentials are hashed with Argon2id, sessions require MFA when enabled, access is controlled per role down to individual actions, and every mutation lands in an append-only audit log. Backups run automatically.",
    },
    {
        q: "Does BalanceIO follow PSAK / IFRS?",
        a: "Posting logic is built around PSAK-aligned treatments with IFRS-compatible structures — double-entry enforcement, period locking, immutable posted entries, and audit-ready trails are standard on every plan.",
    },
    {
        q: "How does Indonesian tax support work?",
        a: "PPN output and input are tracked per transaction line, PPh withholding is managed per contact, and NPWP / tax-invoice data is structured to be Coretax-ready for your monthly filings.",
    },
    {
        q: "Can we cancel or change plans anytime?",
        a: "Anytime. Upgrades apply immediately; downgrades apply at the next billing cycle. Your data remains exportable in standard formats regardless of plan.",
    },
]

function FaqAccordion() {
    const [open, setOpen] = React.useState<number | null>(0)
    return (
        <div className="space-y-3">
            {FAQS.map((f, i) => {
                const isOpen = open === i
                return (
                    <motion.div
                        key={f.q}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                            "rounded-2xl border backdrop-blur-xl overflow-hidden transition-colors",
                            isOpen
                                ? "border-emerald-600/25 dark:border-emerald-500/25 bg-card/70"
                                : "border-foreground/10 bg-card/50 hover:border-foreground/20"
                        )}
                    >
                        <button
                            onClick={() => setOpen(isOpen ? null : i)}
                            className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left"
                        >
                            <span className="text-sm font-semibold text-foreground">{f.q}</span>
                            <motion.span
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ ...SPRING.snappy }}
                                className="shrink-0"
                            >
                                <ChevronDown
                                    className={cn(
                                        "h-4 w-4",
                                        isOpen ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                                    )}
                                />
                            </motion.span>
                        </button>
                        <div
                            className={cn(
                                "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                            )}
                        >
                            <div className="overflow-hidden">
                                <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                                    {f.a}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}

/* ────────────────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────────────────── */
export default function PricingPage() {
    const [yearly, setYearly] = React.useState(true)

    return (
        <SmoothScrollProvider>
        <div className="relative flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-emerald-500/25 overflow-hidden">
            <SiteHeader />

            {/* Ambient stage */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 dark:hidden bg-gradient-to-bl from-teal-500/[0.07] via-transparent to-transparent" />
                <div className="absolute -top-[30%] left-1/2 -translate-x-1/2 w-[100vw] aspect-square rounded-full opacity-[0.10] dark:opacity-20 blur-[110px] bg-[conic-gradient(from_90deg,transparent_0deg,var(--color-emerald-500)_60deg,var(--color-cyan-500)_140deg,transparent_220deg)] animate-[spin_30s_linear_infinite]" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(9,60,50,0.10)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]" />
                <div className="absolute inset-0 bg-noise" />
            </div>

            <main className="flex-1 relative z-10 pt-40 pb-24">
                {/* ── Hero ─────────────────────────────────────────────── */}
                <section className="mx-auto max-w-3xl px-6 text-center mb-14">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-3 mb-7"
                    >
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            Pricing
                        </span>
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, ...SPRING.soft }}
                        className="font-display text-5xl md:text-6xl font-bold tracking-tight leading-[1.08]"
                    >
                        Pricing you can{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent animate-gradient-flow [background-size:200%_200%]">
                            audit.
                        </span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-5 text-lg text-muted-foreground"
                    >
                        Start free, grow when your books do. Change plans anytime.
                    </motion.p>

                    {/* Billing toggle */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-9 inline-flex items-center gap-3"
                    >
                        <div className="relative inline-flex items-center rounded-full border border-foreground/10 bg-card/65 backdrop-blur-xl p-1.5">
                            {(["monthly", "yearly"] as const).map((mode) => {
                                const isActive = yearly === (mode === "yearly")
                                return (
                                    <button
                                        key={mode}
                                        onClick={() => setYearly(mode === "yearly")}
                                        className={cn(
                                            "relative rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors",
                                            isActive
                                                ? "text-white dark:text-zinc-950"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {isActive && (
                                            <motion.span
                                                layoutId="billing-pill"
                                                transition={{ ...SPRING.snappy }}
                                                className="absolute inset-0 rounded-full bg-zinc-900 dark:bg-emerald-400 shadow-md"
                                            />
                                        )}
                                        <span className="relative z-10">{mode}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <AnimatePresence>
                            {yearly && (
                                <motion.span
                                    initial={{ opacity: 0, scale: 0.6, x: -8 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    exit={{ opacity: 0, scale: 0.6, x: -8 }}
                                    transition={{ ...SPRING.snappy }}
                                    className="inline-flex items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-600/10 dark:border-emerald-500/30 dark:bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
                                >
                                    Save 20%
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </section>

                {/* ── Plan cards ───────────────────────────────────────── */}
                <section className="mx-auto max-w-6xl px-6 mb-24">
                    <div className="grid md:grid-cols-3 gap-6 items-stretch [perspective:1600px]">
                        {PLANS.map((plan, i) => {
                            const price =
                                plan.monthly === null
                                    ? null
                                    : yearly
                                        ? Math.round(plan.monthly * 0.8)
                                        : plan.monthly
                            return (
                                <motion.div
                                    key={plan.name}
                                    initial={{ opacity: 0, y: 32 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 + i * 0.1, ...SPRING.soft }}
                                    className={cn(plan.popular && "md:-mt-3 md:-mb-3")}
                                >
                                    <TiltCard max={4} className="h-full rounded-3xl">
                                        <div
                                            className={cn(
                                                "relative h-full flex flex-col rounded-3xl border backdrop-blur-2xl p-7 overflow-hidden",
                                                plan.popular
                                                    ? "border-emerald-600/45 bg-card/80 dark:border-emerald-400/40"
                                                    : "border-foreground/10 bg-card/50"
                                            )}
                                        >
                                            <div className="absolute inset-0 bg-noise pointer-events-none" />
                                            {plan.popular && (
                                                <>
                                                    <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
                                                    <div className="absolute top-4 right-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-500 dark:to-teal-400 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white dark:text-zinc-950">
                                                        Most popular
                                                    </div>
                                                </>
                                            )}

                                            <div className="relative">
                                                <h3 className="font-display text-xl font-bold mb-1">{plan.name}</h3>
                                                <p className="text-xs text-muted-foreground mb-6">{plan.tagline}</p>

                                                <div className="mb-1 min-h-[52px] flex items-end">
                                                    {price === null ? (
                                                        <span className="font-display text-4xl font-bold">Custom</span>
                                                    ) : price === 0 ? (
                                                        <span className="font-display text-4xl font-bold">Free</span>
                                                    ) : (
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-4xl font-bold font-money">
                                                                <NumberTicker
                                                                    value={price}
                                                                    format={formatIDR}
                                                                    stiffness={120}
                                                                    damping={26}
                                                                />
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">/mo</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="h-4 mb-5 text-[11px] text-muted-foreground">
                                                    {price !== null && price > 0 && (
                                                        <AnimatePresence mode="wait">
                                                            <motion.span
                                                                key={String(yearly)}
                                                                initial={{ opacity: 0, y: 4 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -4 }}
                                                            >
                                                                {yearly ? "billed annually" : "billed monthly"}
                                                            </motion.span>
                                                        </AnimatePresence>
                                                    )}
                                                </div>

                                                <ul className="space-y-2.5 mb-8">
                                                    {plan.features.map((f) => (
                                                        <li key={f} className="flex items-start gap-2.5 text-[13px] text-foreground/85">
                                                            <span className="mt-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-600/10 dark:bg-emerald-500/15 shrink-0">
                                                                <Check className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
                                                            </span>
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="relative mt-auto">
                                                <Link
                                                    href={plan.href}
                                                    className={cn(
                                                        "group flex items-center justify-center gap-2 w-full rounded-xl h-12 text-sm font-bold transition-all",
                                                        plan.popular
                                                            ? "bg-zinc-900 text-white hover:shadow-[0_10px_30px_-8px_rgba(16,185,129,0.5)] dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
                                                            : "border border-foreground/15 bg-card/55 text-foreground hover:bg-foreground/[0.06]"
                                                    )}
                                                >
                                                    {plan.cta}
                                                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </TiltCard>
                                </motion.div>
                            )
                        })}
                    </div>
                </section>

                {/* ── Comparison matrix ────────────────────────────────── */}
                <section className="mx-auto max-w-5xl px-6 mb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.4 }}
                        className="text-center mb-10"
                    >
                        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                            Compare every{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                detail.
                            </span>
                        </h2>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, y: 28 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ ...SPRING.soft }}
                    >
                        <ComparisonMatrix />
                    </motion.div>
                </section>

                {/* ── FAQ ──────────────────────────────────────────────── */}
                <section className="mx-auto max-w-3xl px-6 mb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.5 }}
                        className="text-center mb-10"
                    >
                        <div className="flex items-center justify-center gap-3 mb-5">
                            <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                                Questions, answered
                            </span>
                            <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        </div>
                        <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
                            Frequently asked
                        </h2>
                    </motion.div>
                    <FaqAccordion />
                </section>

                {/* ── Glowing final CTA ────────────────────────────────── */}
                <section className="relative mx-auto max-w-3xl px-6 text-center">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute bottom-[-40%] left-1/2 -translate-x-1/2 w-[120%] h-[120%] bg-emerald-500/[0.07] dark:bg-emerald-500/10 blur-[120px] rounded-full" />
                    </div>
                    <motion.h2
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        className="relative font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-6"
                    >
                        Start with the plan that{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent animate-gradient-flow [background-size:200%_200%]">
                            fits today.
                        </span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ delay: 0.1 }}
                        className="relative text-muted-foreground mb-10"
                    >
                        Free to begin, no credit card required. Your books scale with you.
                    </motion.p>
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.6 }}
                        transition={{ delay: 0.2 }}
                        className="relative"
                    >
                        <Magnetic>
                            <Link
                                href="/register"
                                className="group inline-flex items-center gap-2 rounded-full px-9 py-4 text-sm font-bold bg-zinc-900 text-white hover:shadow-[0_14px_44px_-8px_rgba(16,185,129,0.55)] dark:bg-gradient-to-r dark:from-emerald-500 dark:to-teal-400 dark:text-zinc-950 dark:shadow-[0_0_50px_-10px_rgba(16,185,129,0.8)] transition-shadow"
                            >
                                Open BalanceIO free
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
