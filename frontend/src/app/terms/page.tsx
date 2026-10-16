"use client"

import { motion } from "framer-motion"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { FileText, Shield, CreditCard, Users, AlertTriangle, RefreshCw, Mail, Scale, Lock } from "lucide-react"
import { siteConfig } from "@/config/site"

const sections = [
    {
        icon: FileText,
        title: "1. Acceptance of Terms",
        content: `By accessing and using ${siteConfig.name}, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.`,
    },
    {
        icon: Scale,
        title: "2. Description of Service",
        content: `${siteConfig.name} is a cloud-based accounting and financial management platform provided by ${siteConfig.brand.companyName}. Services include financial transaction tracking, invoice management, financial reporting & analytics, multi-currency support, and team collaboration features.`,
    },
    {
        icon: Users,
        title: "3. User Accounts",
        content: "To access certain features, you must register for an account. You agree to provide accurate, current, and complete information and to keep it updated. You are responsible for safeguarding your password and must notify us immediately of any unauthorized use.",
    },
    {
        icon: CreditCard,
        title: "4. Payment Terms",
        content: "Certain features require payment. By subscribing to a paid plan, you agree to pay the applicable fees. Fees are non-refundable except as required by law or as explicitly stated in this agreement.",
    },
    {
        icon: Shield,
        title: "5. Data Security",
        content: "Your data is saved and protected. We are committed to ensuring your information is secure and use trusted measures to safeguard the data you provide to us.",
    },
    {
        icon: AlertTriangle,
        title: "6. Limitation of Liability",
        content: `To the maximum extent permitted by law, ${siteConfig.brand.companyName} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues.`,
    },
    {
        icon: RefreshCw,
        title: "7. Changes to Terms",
        content: "We reserve the right to modify these terms at any time. We will notify users of any material changes via email or through the Service. Continued use after modifications constitutes acceptance of the updated terms.",
    },
    {
        icon: Mail,
        title: "8. Contact Information",
        content: `For any questions regarding these Terms of Service, please contact us at ${siteConfig.brand.supportEmail} or visit our office in Jakarta, Indonesia.`,
    },
]

export default function TermsPage() {
    return (
        <div className="relative flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
            <SiteHeader />

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-1/4 h-[500px] w-[500px] bg-blue-500/5 dark:bg-blue-600/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-1/4 left-1/4 h-[400px] w-[400px] bg-emerald-500/5 dark:bg-emerald-600/10 blur-[120px] rounded-full" />
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
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                            <FileText className="h-4 w-4 text-blue-500" />
                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Legal Document</span>
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">
                            Terms of Service
                        </h1>
                        <p className="text-lg text-zinc-500 max-w-2xl mx-auto">
                            Please read these terms carefully before using {siteConfig.name}
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
                                className="group p-8 rounded-3xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-white/5 hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
                            >
                                <div className="flex gap-5">
                                    <div className="shrink-0">
                                        <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 transition-all duration-300">
                                            <section.icon className="h-6 w-6 text-blue-500 group-hover:text-white transition-colors" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-3 tracking-tight">
                                            {section.title}
                                        </h2>
                                        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-sm">
                                            {section.content}
                                        </p>
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
                        <div className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-blue-500/20 backdrop-blur-sm">
                            <Lock className="h-8 w-8 text-blue-500" />
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
