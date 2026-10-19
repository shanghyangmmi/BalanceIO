"use client"

import { motion } from "framer-motion"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Shield, Database, Eye, Lock, Share2, UserCheck, Cookie, Clock, Mail } from "lucide-react"
import { siteConfig } from "@/config/site"

const sections = [
    {
        icon: Shield,
        title: "1. Introduction",
        content: `${siteConfig.brand.companyName} is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use ${siteConfig.name}.`,
    },
    {
        icon: Database,
        title: "2. Information We Collect",
        items: [
            "Account Information: Name, email address, company name, and password",
            "Financial Data: Transaction records, invoices, and financial reports",
            "Payment Information: Billing details (processed securely by payment providers)",
            "Usage Data: Features used, time spent, and interaction patterns",
            "Device Information: IP address, browser type, and operating system",
        ],
    },
    {
        icon: Eye,
        title: "3. How We Use Your Information",
        items: [
            "Provide, maintain, and improve our Service",
            "Process transactions and send related information",
            "Send technical notices, updates, and security alerts",
            "Respond to your customer service requests",
            "Monitor and analyze trends and usage patterns",
            "Detect and prevent fraudulent activities",
        ],
    },
    {
        icon: Lock,
        title: "4. Data Security",
        items: [
            "Encryption: Your data is safely encrypted",
            "Secure Transmission: Protected connections",
            "Access Controls: Strict authentication measures",
            "Regular Audits: Security assessments",
            "Data Backup: Secure backups",
        ],
    },
    {
        icon: Share2,
        title: "5. Data Sharing",
        content: "We do not sell, trade, or rent your personal information. We may share data only with your consent, with service providers, to comply with legal obligations, or to protect our rights and safety.",
    },
    {
        icon: UserCheck,
        title: "6. Your Rights",
        items: [
            "Access and receive a copy of your personal data",
            "Rectify inaccurate personal data",
            "Request deletion of your personal data",
            "Object to processing of your data",
            "Export your data in a portable format",
        ],
    },
    {
        icon: Cookie,
        title: "7. Cookies",
        content: "We use cookies and similar tracking technologies. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. Some features may not function properly without cookies.",
    },
    {
        icon: Clock,
        title: "8. Data Retention",
        content: "We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including legal, accounting, or reporting requirements.",
    },
    {
        icon: Mail,
        title: "9. Contact Us",
        content: `For questions about this Privacy Policy, contact us at ${siteConfig.brand.supportEmail} or visit our office in Jakarta, Indonesia.`,
    },
]

export default function PrivacyPage() {
    return (
        <div className="relative flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
            <SiteHeader />

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-1/4 h-[500px] w-[500px] bg-emerald-500/5 dark:bg-emerald-600/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-1/4 left-1/4 h-[400px] w-[400px] bg-cyan-500/5 dark:bg-cyan-600/10 blur-[120px] rounded-full" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000005_1px,transparent_1px),linear-gradient(to_bottom,#00000005_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:50px_50px]" />
            </div>

            <main className="flex-1 pt-32 pb-20 relative z-10">
                <div className="container px-4 md:px-6 max-w-5xl mx-auto">
                    {/* Hero */}
                    <motion.div
                        className="text-center mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                            <Shield className="h-4 w-4 text-emerald-500" />
                            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Your Privacy Matters</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">
                            Privacy Policy
                        </h1>
                        <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                            How we collect, use, and protect your personal information
                        </p>
                    </motion.div>

                    {/* Sections Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {sections.map((section, index) => (
                            <motion.div
                                key={section.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.08 }}
                                className="group p-8 rounded-3xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                            >
                                <div className="flex gap-5">
                                    <div className="shrink-0">
                                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 transition-all duration-300">
                                            <section.icon className="h-6 w-6 text-emerald-500 group-hover:text-white transition-colors" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">
                                            {section.title}
                                        </h2>
                                        {section.content && (
                                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                                                {section.content}
                                            </p>
                                        )}
                                        {section.items && (
                                            <ul className="space-y-3 mt-4">
                                                {section.items.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-3 text-zinc-600 dark:text-zinc-400 text-sm">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                                                        <span>{item}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Security Badge */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="mt-16 text-center"
                    >
                        <div className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 backdrop-blur-sm">
                            <Lock className="h-8 w-8 text-emerald-500" />
                            <div className="text-left">
                                <div className="font-bold text-zinc-900 dark:text-white">Secured Data</div>
                                <div className="text-sm text-zinc-500">Your data is saved and protected</div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
            <SiteFooter />
        </div>
    )
}
