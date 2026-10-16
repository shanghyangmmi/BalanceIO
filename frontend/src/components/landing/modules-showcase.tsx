"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    BookOpen,
    TrendingUp,
    ShoppingBag,
    Boxes,
    Building2,
    Calculator,
    PieChart,
    ShieldCheck,
} from "lucide-react"

interface Module {
    no: string
    icon: React.ElementType
    title: string
    items: string[]
}

/** Every module maps to features that actually exist in BalanceIO. */
const MODULES: Module[] = [
    {
        no: "01",
        icon: BookOpen,
        title: "Ledger & Posting Control",
        items: [
            "Auto-posting from every module",
            "Period lock stops back-dating",
            "Recurring & adjusting entries",
            "Void + reversal corrections",
        ],
    },
    {
        no: "02",
        icon: TrendingUp,
        title: "Sales & Receivables",
        items: [
            "Invoices with premium templates",
            "Payments & credit notes",
            "Customer balances & aging",
            "Delivery orders & documents",
        ],
    },
    {
        no: "03",
        icon: ShoppingBag,
        title: "Purchases & Payables",
        items: [
            "Purchase orders to bills",
            "Vendor management & aging",
            "Payment vouchers",
            "Expense claims & tracking",
        ],
    },
    {
        no: "04",
        icon: Boxes,
        title: "Inventory",
        items: [
            "Multi-warehouse stock",
            "Stock opname (counts)",
            "Units, categories & adjustments",
            "Inventory valuation reports",
        ],
    },
    {
        no: "05",
        icon: Building2,
        title: "Fixed Assets",
        items: [
            "Asset register & categories",
            "Automatic depreciation schedules",
            "Revaluation & disposal",
            "Asset labels & locations",
        ],
    },
    {
        no: "06",
        icon: Calculator,
        title: "Tax Compliance Support",
        items: [
            "PPN input & output tracking",
            "PPh withholding record management",
            "NPWP & tax invoice data records",
            "Exportable tax data format",
        ],
    },
    {
        no: "07",
        icon: PieChart,
        title: "Financial Reports",
        items: [
            "Statement of Financial Position",
            "Statement of Comprehensive Income",
            "Notes to Financial Statements",
            "Inventory & Fixed Assets Reports",
        ],
    },
    {
        no: "08",
        icon: ShieldCheck,
        title: "Control & Security",
        items: [
            "Role-based access & MFA",
            "Append-only audit logs",
            "Multi-company, multi-currency",
            "Automated backups",
        ],
    },
]

function ModuleCard({ module, index }: { module: Module; index: number }) {
    const Icon = module.icon
    return (
        <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ delay: (index % 4) * 0.08, type: "spring", stiffness: 110, damping: 18 }}
            className="group relative pt-6"
        >
            {/* Hairline top rule that "charges" emerald on hover */}
            <div className="absolute top-0 left-0 right-0 h-px bg-zinc-900/10 dark:bg-white/10" />
            <div className="absolute top-0 left-0 h-px w-0 bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-cyan-400 transition-all duration-500 group-hover:w-full" />

            <div className="flex items-start justify-between mb-4">
                <span className="font-display text-3xl font-bold text-zinc-900/15 dark:text-white/15 transition-colors duration-300 group-hover:text-emerald-600/60 dark:group-hover:text-emerald-400/60">
                    {module.no}
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-600/15 bg-emerald-600/[0.06] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <Icon className="h-4 w-4" />
                </span>
            </div>

            <h3 className="text-base font-semibold text-foreground mb-3">{module.title}</h3>

            <ul className="space-y-1.5">
                {module.items.map((item) => (
                    <li
                        key={item}
                        className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground"
                    >
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-600/50 dark:bg-emerald-400/50" />
                        {item}
                    </li>
                ))}
            </ul>
        </motion.div>
    )
}

/**
 * Full-suite module map — the "everything is covered" exhibit, presented
 * as a numbered consulting-report index rather than a generic feature grid.
 */
export function ModulesShowcase() {
    return (
        <section className="relative py-32 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 dark:hidden bg-[linear-gradient(180deg,transparent_0%,#f0fdf4_50%,transparent_100%)] opacity-60" />
                <div className="absolute top-[30%] left-[-10%] w-[40%] h-[40%] bg-teal-500/[0.04] dark:bg-teal-500/[0.06] blur-[120px] rounded-full" />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-6">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="mb-16 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
                >
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-3">
                            <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                                Eight modules, one trail
                            </span>
                        </div>
                        <h2 className="font-display mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
                            Every module,{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                integrated by default.
                            </span>
                        </h2>
                    </div>
                    <p className="max-w-sm text-sm text-muted-foreground leading-relaxed lg:text-right">
                        Sales, purchasing, inventory, fixed assets and tax records all
                        post into the same ledger — not into silos that somebody
                        reconciles at month end. One chart of accounts, one audit trail,
                        one set of statements.
                    </p>
                </motion.div>

                <div className="grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                    {MODULES.map((m, i) => (
                        <ModuleCard key={m.no} module={m} index={i} />
                    ))}
                </div>
            </div>
        </section>
    )
}
