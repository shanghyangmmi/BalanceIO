import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Button } from "@/components/ui/button"
import { CreditCard, Receipt, Banknote, FileSpreadsheet, Building2, Truck, ShoppingCart, BarChart, Wallet, Globe2 } from "lucide-react"
import Link from "next/link"
import { siteConfig } from "@/config/site"

const addons = [
    {
        name: "Payment Gateway",
        description: `Accept payments via credit card, bank transfer, and e-wallets directly in ${siteConfig.name}.`,
        icon: CreditCard,
        price: "$15/mo",
        category: "Payments",
    },
    {
        name: "E-Faktur Integration",
        description: "Automatic e-Faktur generation and submission to DJP for Indonesian businesses.",
        icon: Receipt,
        price: "$10/mo",
        category: "Tax",
    },
    {
        name: "Payroll Module",
        description: "Payroll runs, BPJS records and slip generation, with PPh 21 withholding tracked against every payslip.",
        icon: Banknote,
        price: "$25/mo",
        category: "HR",
    },
    {
        name: "Excel Import/Export",
        description: "Bulk import and export data with advanced Excel compatibility.",
        icon: FileSpreadsheet,
        price: "$5/mo",
        category: "Tools",
    },
    {
        name: "Multi-Branch",
        description: "Manage multiple business locations with consolidated reporting.",
        icon: Building2,
        price: "$20/mo",
        category: "Enterprise",
    },
    {
        name: "Inventory Management",
        description: "Track stock levels, manage warehouses, and automate reordering.",
        icon: Truck,
        price: "$30/mo",
        category: "Operations",
    },
    {
        name: "E-Commerce Sync",
        description: "Connect with Tokopedia, Shopee, Lazada, and other marketplaces.",
        icon: ShoppingCart,
        price: "$20/mo",
        category: "Integrations",
    },
    {
        name: "Advanced Analytics",
        description: "AI-powered insights, forecasting, and custom KPI dashboards.",
        icon: BarChart,
        price: "$35/mo",
        category: "Analytics",
    },
    {
        name: "Expense Management",
        description: "Track employee expenses, approvals, and reimbursements.",
        icon: Wallet,
        price: "$10/mo",
        category: "Tools",
    },
    {
        name: "Multi-Currency Pro",
        description: "Advanced forex management with hedging and rate lock features.",
        icon: Globe2,
        price: "$15/mo",
        category: "Finance",
    },
]

export default function AddonsPage() {
    return (
        <div className="relative flex min-h-screen flex-col bg-zinc-950">
            <SiteHeader />
            <main className="flex-1 pt-32">
                {/* Hero */}
                <section className="container text-center mb-20">
                    <p className="text-sm font-semibold text-emerald-500 uppercase tracking-widest mb-4">Add-ons</p>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6">
                        Extend your <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">capabilities</span>
                    </h1>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                        Customize {siteConfig.name} with powerful add-ons tailored for Indonesian businesses.
                    </p>
                </section>

                {/* Add-ons Grid */}
                <section className="container pb-24">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {addons.map((addon) => (
                            <div
                                key={addon.name}
                                className="group p-6 rounded-2xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 flex flex-col"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                                        <addon.icon className="h-6 w-6" />
                                    </div>
                                    <span className="px-2 py-1 rounded-full bg-white/5 text-xs text-zinc-400">{addon.category}</span>
                                </div>

                                <h3 className="text-lg font-semibold text-white mb-2">{addon.name}</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed flex-1">{addon.description}</p>

                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                                    <span className="text-lg font-bold text-white">{addon.price}</span>
                                    <Button size="sm" variant="outline" className="rounded-full border-white/10 text-white hover:bg-white/10">
                                        Add to Plan
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
            <SiteFooter />
        </div>
    )
}
