"use client"

import * as React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Check, Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { EASE_HOUSE } from "@/lib/motion"
import { siteConfig } from "@/config/site"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Skeleton } from "@/components/ui/skeleton"
import { usePublicPricing, type PublicPlan, type PublicPricing } from "@/hooks/use-public-pricing"

/**
 * Pricing, as the API charges it.
 *
 * This page used to carry its own three plans, prices and comparison
 * matrix in code. They disagreed with the plans the backend sells (names,
 * the Pro price, the free quota, which modules each plan opens), and the
 * "Save 20%" was a discount computed in the browser that checkout never
 * applied. Everything below now comes from GET /api/Plans/public: prices
 * and promotions from the admin plan editor, the checklist from the
 * licensing catalogue the API enforces. If the request fails the page says
 * so; it never falls back to figures it made up.
 */

const rupiah = new Intl.NumberFormat("id-ID")
const formatRp = (v: number) => `Rp ${rupiah.format(v)}`

const MODULE_LABEL: Record<string, string> = {
    accounting: "Accounting",
    tax: "Tax",
    inventory: "Inventory",
    fixedAssets: "Fixed assets",
    payroll: "Payroll",
    platform: "Platform",
}
const MODULE_ORDER = ["accounting", "tax", "inventory", "fixedAssets", "payroll", "platform"]

const promoEnd = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })

const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: EASE_HOUSE },
})

/* ── Plans ────────────────────────────────────────────────────────── */

function PlanPrice({ plan, yearly }: { plan: PublicPlan; yearly: boolean }) {
    if (plan.priceMonthly === 0 && plan.priceYearly === 0) {
        return (
            <div className="flex h-[76px] flex-col justify-end">
                <span className="font-display text-4xl font-bold tracking-tight">Free</span>
                <span className="mt-1 text-[12px] text-muted-foreground">No card required</span>
            </div>
        )
    }

    if (yearly) {
        const monthsEquivalent = plan.priceMonthly > 0 ? plan.priceYearly / plan.priceMonthly : 0
        const freeMonths = Math.floor(12 - monthsEquivalent)
        return (
            <div className="flex h-[76px] flex-col justify-end">
                <span className="font-money text-4xl font-bold tracking-tight">
                    {formatRp(plan.priceYearly)}
                    <span className="ml-1 font-sans text-[13px] font-normal text-muted-foreground">/ year</span>
                </span>
                <span className="mt-1 text-[12px] text-muted-foreground">
                    {freeMonths > 0 ? `${freeMonths} months free against monthly billing` : "Billed once a year"}
                </span>
            </div>
        )
    }

    const promo = plan.promoPriceMonthly !== null && plan.promoEndsAt !== null
    return (
        <div className="flex h-[76px] flex-col justify-end">
            {promo && (
                <span className="font-money text-[13px] text-muted-foreground line-through decoration-muted-foreground/60">
                    {formatRp(plan.priceMonthly)}
                </span>
            )}
            <span className="font-money text-4xl font-bold tracking-tight">
                {formatRp(plan.effectivePriceMonthly)}
                <span className="ml-1 font-sans text-[13px] font-normal text-muted-foreground">/ month</span>
            </span>
            <span className="mt-1 text-[12px] text-muted-foreground">
                {promo ? `Introductory price for checkouts until ${promoEnd(plan.promoEndsAt!)}` : "Billed monthly"}
            </span>
        </div>
    )
}

function PlanCard({ plan, data, yearly, index }: { plan: PublicPlan; data: PublicPricing; yearly: boolean; index: number }) {
    const paid = plan.priceMonthly > 0 || plan.priceYearly > 0
    const promo = !yearly && plan.promoPriceMonthly !== null

    return (
        <motion.article
            {...reveal(0.1 + index * 0.06)}
            className={cn(
                "relative flex flex-col rounded-xl border bg-card p-7",
                plan.isPopular ? "border-foreground/40" : "border-foreground/10",
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h2>
                    {plan.description && <p className="mt-1 text-[13px] text-muted-foreground">{plan.description}</p>}
                </div>
                {promo ? (
                    <span className="shrink-0 rounded-full border border-emerald-600/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400">
                        Promotion
                    </span>
                ) : plan.isPopular ? (
                    <span className="shrink-0 rounded-full border border-foreground/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Recommended
                    </span>
                ) : null}
            </div>

            <div className="mt-8">
                <PlanPrice plan={plan} yearly={yearly} />
            </div>

            <div className="my-7 h-px bg-foreground/10" />

            <dl className="grid grid-cols-3 gap-3 text-[12px]">
                <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Users</dt>
                    <dd className="mt-1 font-money text-foreground">{plan.maxUsers <= 0 ? "Unlimited" : rupiah.format(plan.maxUsers)}</dd>
                </div>
                <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Companies</dt>
                    <dd className="mt-1 font-money text-foreground">{plan.maxCompanies <= 0 ? "Unlimited" : rupiah.format(plan.maxCompanies)}</dd>
                </div>
                <div>
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Journals</dt>
                    <dd className="mt-1 text-foreground">
                        {plan.maxJournalEntries <= 0
                            ? "Unlimited"
                            : `${rupiah.format(plan.maxJournalEntries)} ${data.journalLimitWindow.toLowerCase() === "total" ? "total" : "/ month"}`}
                    </dd>
                </div>
            </dl>

            <div className="mt-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Modules</p>
                <p className="mt-1.5 text-[13px] text-foreground">
                    {MODULE_ORDER.filter((m) => plan.modules.includes(m)).map((m) => MODULE_LABEL[m]).join(" · ") || "Accounting"}
                </p>
            </div>

            {plan.highlights.length > 0 && (
                <ul className="mt-6 space-y-2.5">
                    {plan.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground/85">
                            <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                            {h}
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-auto pt-8">
                <Link
                    href="/register"
                    className={cn(
                        "group flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium transition-colors",
                        plan.isPopular || promo
                            ? "bg-foreground text-background hover:bg-foreground/85"
                            : "border border-foreground/15 text-foreground hover:border-foreground/40",
                    )}
                >
                    {paid ? `Start with ${plan.name}` : "Create a free account"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {paid && (
                    <p className="mt-3 text-center text-[11px] text-muted-foreground">
                        Register free first; upgrade from Settings when you are ready to pay.
                    </p>
                )}
            </div>
        </motion.article>
    )
}

/* ── Checklist ────────────────────────────────────────────────────── */

function Checklist({ data }: { data: PublicPricing }) {
    const groups = MODULE_ORDER.map((m) => [m, data.features.filter((f) => f.module === m)] as const).filter(
        ([, list]) => list.length > 0,
    )

    // Without a catalogue, compare what is certain: which module each plan opens.
    const rows =
        groups.length > 0
            ? null
            : MODULE_ORDER.filter((m) => m !== "platform").map((m) => ({
                  key: m,
                  name: MODULE_LABEL[m],
                  has: (p: PublicPlan) => p.modules.includes(m),
              }))

    const cell = (on: boolean) =>
        on ? (
            <Check className="mx-auto h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-label="Included" />
        ) : (
            <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />
        )

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-t border-foreground text-[13px]">
                <thead>
                    <tr className="border-b border-foreground/10">
                        <th className="py-3 pr-4 text-left font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
                            Feature
                        </th>
                        {data.plans.map((p) => (
                            <th key={p.id} className="w-32 py-3 text-center font-display text-base font-bold">
                                {p.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows
                        ? rows.map((r) => (
                              <tr key={r.key} className="border-b border-foreground/[0.06]">
                                  <td className="py-3 pr-4 text-foreground">{r.name}</td>
                                  {data.plans.map((p) => (
                                      <td key={p.id} className="py-3 text-center">
                                          {cell(r.has(p))}
                                      </td>
                                  ))}
                              </tr>
                          ))
                        : groups.map(([module, list]) => (
                              <React.Fragment key={module}>
                                  <tr>
                                      <td
                                          colSpan={data.plans.length + 1}
                                          className="pb-2 pt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                                      >
                                          {MODULE_LABEL[module] ?? module}
                                      </td>
                                  </tr>
                                  {list.map((f) => (
                                      <tr key={f.key} className="border-b border-foreground/[0.06]">
                                          <td className="py-3 pr-4">
                                              <span className="text-foreground">{f.name}</span>
                                              {f.description && (
                                                  <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                                                      {f.description}
                                                  </span>
                                              )}
                                          </td>
                                          {data.plans.map((p) => (
                                              <td key={p.id} className="py-3 text-center">
                                                  {cell(f.planIds.includes(p.id))}
                                              </td>
                                          ))}
                                      </tr>
                                  ))}
                              </React.Fragment>
                          ))}
                </tbody>
            </table>
        </div>
    )
}

/* ── Questions ────────────────────────────────────────────────────── */

// Each answer states what the code does. No migration service, backup
// schedule, IFRS claim or Coretax link is promised here, because none of
// them exists.
const FAQS = [
    {
        q: "Is there a contract or automatic renewal?",
        a: "No. Each month or year is paid on its own, by bank transfer or on the online payment page where it is enabled. Nothing renews or charges you automatically.",
    },
    {
        q: "How does the introductory price work?",
        a: "While a promotion is shown on this page, a monthly checkout is charged the promotional price. The figure is fixed when you start checkout. After the stated date, new monthly payments are at the normal price.",
    },
    {
        q: "Can I move my books from another system?",
        a: "Yes. The standard Indonesian chart of accounts loads in one step, and the migration wizard imports opening balances, so you start from your last closed period rather than re-entering history.",
    },
    {
        q: "Can I take my data out?",
        a: "Settings → Data backup downloads a complete snapshot of the company as JSON, on every plan, whenever you want it.",
    },
    {
        q: "Does BalanceIO file my taxes?",
        a: "No. It records PPN and PPh, prepares the SPT Masa PPN summary, and exports e-Faktur and e-Bupot CSV files. It does not connect to Coretax or file with DJP, and the tax treatment of a transaction stays your accountant's judgement.",
    },
]

function Faq() {
    const [open, setOpen] = React.useState<number | null>(0)
    return (
        <div className="border-t border-foreground">
            {FAQS.map((f, i) => {
                const isOpen = open === i
                return (
                    <div key={f.q} className="border-b border-foreground/10">
                        <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : i)}
                            aria-expanded={isOpen}
                            className="flex w-full items-center justify-between gap-6 py-5 text-left"
                        >
                            <span className="text-[15px] font-medium text-foreground">{f.q}</span>
                            <Plus
                                className={cn(
                                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                                    isOpen && "rotate-45",
                                )}
                            />
                        </button>
                        <div
                            className={cn(
                                "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                            )}
                        >
                            <p className="overflow-hidden pr-10 text-[14px] leading-relaxed text-muted-foreground">
                                <span className="block pb-5">{f.a}</span>
                            </p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

/* ── Page ─────────────────────────────────────────────────────────── */

export default function PricingPage() {
    const { data, isLoading, isError, error, refetch } = usePublicPricing()
    const [yearly, setYearly] = React.useState(false)

    const anyPaid = data?.plans.some((p) => p.priceYearly > 0) ?? false
    const promoPlan = data?.plans.find((p) => p.promoPriceMonthly !== null && p.promoEndsAt !== null)

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
            <SiteHeader />

            <main className="flex-1 pb-24 pt-36">
                {/* ── Head ── */}
                <section className="mx-auto max-w-6xl px-6">
                    <motion.div {...reveal(0)} className="flex items-center gap-3">
                        <span className="h-px w-8 bg-foreground/30" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Pricing</span>
                    </motion.div>
                    <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
                        <motion.h1
                            {...reveal(0.05)}
                            className="font-display text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl"
                        >
                            Every module,{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
                                one price.
                            </span>
                        </motion.h1>
                        <motion.p {...reveal(0.12)} className="max-w-md text-[15px] leading-relaxed text-muted-foreground lg:justify-self-end">
                            Start on the free plan with your real books. Move to Pro when you need tax, inventory, fixed assets or
                            payroll. Prices are in rupiah; nothing renews without you.
                        </motion.p>
                    </div>

                    {promoPlan && !yearly && (
                        <motion.p
                            {...reveal(0.18)}
                            className="mt-8 border-l-2 border-emerald-600 pl-4 text-[14px] text-foreground dark:border-emerald-400"
                        >
                            {promoPlan.name} is{" "}
                            <span className="font-money font-medium">{formatRp(promoPlan.promoPriceMonthly!)}</span> a month for
                            checkouts until {promoEnd(promoPlan.promoEndsAt!)}, then{" "}
                            <span className="font-money">{formatRp(promoPlan.priceMonthly)}</span>.
                        </motion.p>
                    )}

                    {anyPaid && (
                        <motion.div {...reveal(0.2)} className="mt-10 inline-flex rounded-full border border-foreground/15 p-1">
                            {(["Monthly", "Yearly"] as const).map((label) => {
                                const active = yearly === (label === "Yearly")
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        onClick={() => setYearly(label === "Yearly")}
                                        aria-pressed={active}
                                        className={cn(
                                            "rounded-full px-5 py-1.5 text-[13px] font-medium transition-colors",
                                            active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {label}
                                    </button>
                                )
                            })}
                        </motion.div>
                    )}
                </section>

                {/* ── Plans ── */}
                <section className="mx-auto mt-10 max-w-6xl px-6">
                    {isLoading ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            {[0, 1].map((i) => (
                                <div key={i} className="space-y-4 rounded-xl border border-foreground/10 p-7">
                                    <Skeleton className="h-7 w-24" />
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="mt-8 h-10 w-56" />
                                    <Skeleton className="mt-8 h-24 w-full" />
                                </div>
                            ))}
                        </div>
                    ) : isError || !data ? (
                        <div className="rounded-xl border border-destructive/25 bg-destructive/[0.04] px-6 py-8">
                            <p className="text-sm font-medium text-foreground">Prices could not be loaded.</p>
                            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
                                {error instanceof Error ? error.message : "The request did not complete."} We do not show figures we
                                cannot confirm. Try again, or ask us at{" "}
                                <a className="underline underline-offset-4" href={`mailto:${siteConfig.contacts.email}`}>
                                    {siteConfig.contacts.email}
                                </a>
                                .
                            </p>
                            <button
                                type="button"
                                onClick={() => refetch()}
                                className="mt-5 rounded-full border border-foreground/15 px-4 py-1.5 text-[13px] hover:border-foreground/40"
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <div className={cn("grid gap-6", data.plans.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2")}>
                            {data.plans.map((plan, i) => (
                                <PlanCard key={plan.id} plan={plan} data={data} yearly={yearly} index={i} />
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Checklist ── */}
                {data && data.plans.length > 0 && (
                    <section className="mx-auto mt-28 max-w-6xl px-6">
                        <div className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
                            <h2 className="font-display text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                                What each plan includes.
                            </h2>
                            <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground lg:justify-self-end">
                                The same list the application checks before it opens a feature, so this table and your account cannot
                                disagree.
                            </p>
                        </div>
                        <Checklist data={data} />
                    </section>
                )}

                {/* ── Questions ── */}
                <section className="mx-auto mt-28 grid max-w-6xl gap-10 px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
                    <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Questions</p>
                        <h2 className="font-display mt-4 text-3xl font-bold leading-[1.1] tracking-tight">Before you pay.</h2>
                        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                            Anything else:{" "}
                            <Link href="/contact" className="text-foreground underline decoration-foreground/25 underline-offset-4">
                                contact us
                            </Link>
                            .
                        </p>
                    </div>
                    <Faq />
                </section>
            </main>

            <SiteFooter />
        </div>
    )
}
