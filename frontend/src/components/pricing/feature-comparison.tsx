"use client"

import { Check, Minus, HelpCircle } from "lucide-react"
import { Fragment } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface Feature {
    name: string
    description?: string
    starter: boolean | string
    pro: boolean | string
    enterprise: boolean | string
}

interface Section {
    title: string
    features: Feature[]
}

const comparisonData: Section[] = [
    {
        title: "Core Accounting",
        features: [
            { name: "Transaction Limit", starter: "100/mo", pro: "Unlimited", enterprise: "Unlimited" },
            { name: "Bank Recon", description: "Automatically match bank transactions", starter: true, pro: true, enterprise: true },
            { name: "Multi-currency", description: "Transact in over 150 currencies", starter: false, pro: true, enterprise: true },
            { name: "Recurring Invoices", starter: "5 Active", pro: "Unlimited", enterprise: "Unlimited" },
        ]
    },
    {
        title: "Reporting & Analytics",
        features: [
            { name: "Standard Reports", starter: "Basic", pro: "Advanced", enterprise: "Advanced" },
            { name: "Cash Flow Forecast", starter: false, pro: true, enterprise: true },
            { name: "Custom Reports", starter: false, pro: "5 Saved", enterprise: "Unlimited" },
            { name: "Budgeting", starter: false, pro: true, enterprise: true },
        ]
    },
    {
        title: "Team & Security",
        features: [
            { name: "Users", starter: "1 User", pro: "5 Users", enterprise: "Unlimited" },
            { name: "Role-based Access", starter: false, pro: true, enterprise: true },
            { name: "Audit Trail", starter: "30 Days", pro: "Unlimited", enterprise: "Unlimited" },
            { name: "SSO (Single Sign-On)", starter: false, pro: false, enterprise: true },
        ]
    },
    {
        title: "Support",
        features: [
            { name: "Support Channel", starter: "Email", pro: "Email & Chat", enterprise: "Dedicated Agent" },
            { name: "Response Time", starter: "48h", pro: "24h", enterprise: "1h (SLA)" },
            { name: "Onboarding", starter: "Self-serve", pro: "Webinar", enterprise: "Dedicated Session" },
        ]
    }
]

export function FeatureComparison() {
    return (
        <section className="container pb-24 px-4 max-w-6xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">Compare Plans</h2>
                <p className="text-zinc-500 dark:text-zinc-400">Detailed breakdown of what's included in each plan</p>
            </div>

            <div className="overflow-x-auto">
                <TooltipProvider>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-white/10">
                                <th className="py-4 pl-4 w-1/3 min-w-[200px] text-lg font-bold text-zinc-900 dark:text-white bg-white dark:bg-zinc-950 sticky left-0 z-10">Features</th>
                                <th className="py-4 px-4 text-center text-lg font-semibold text-zinc-900 dark:text-white">Starter</th>
                                <th className="py-4 px-4 text-center text-lg font-bold text-cyan-600 dark:text-cyan-400">Professional</th>
                                <th className="py-4 px-4 text-center text-lg font-semibold text-zinc-900 dark:text-white">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonData.map((section) => (
                                <Fragment key={section.title}>
                                    <tr>
                                        <td colSpan={4} className="py-6 pl-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest bg-zinc-50/50 dark:bg-white/5">
                                            {section.title}
                                        </td>
                                    </tr>
                                    {section.features.map((feature, idx) => (
                                        <tr
                                            key={feature.name}
                                            className="border-b border-zinc-100 dark:border-white/5 hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <td className="py-4 pl-4 font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 sticky left-0 group">
                                                <div className="flex items-center gap-2">
                                                    {feature.name}
                                                    {feature.description && (
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <HelpCircle className="h-4 w-4 text-zinc-400" />
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>{feature.description}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                                                {renderValue(feature.starter)}
                                            </td>
                                            <td className="py-4 px-4 text-center text-sm font-medium text-zinc-900 dark:text-white bg-cyan-50/30 dark:bg-cyan-900/10 border-x border-cyan-100 dark:border-cyan-900/20">
                                                {renderValue(feature.pro)}
                                            </td>
                                            <td className="py-4 px-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
                                                {renderValue(feature.enterprise)}
                                            </td>
                                        </tr>
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </TooltipProvider>
            </div>
        </section>
    )
}

function renderValue(value: boolean | string) {
    if (typeof value === "boolean") {
        return value ? (
            <div className="flex justify-center">
                <div className="bg-cyan-100 dark:bg-cyan-500/20 rounded-full p-1">
                    <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
            </div>
        ) : (
            <div className="flex justify-center">
                <Minus className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
            </div>
        )
    }
    return <span>{value}</span>
}
