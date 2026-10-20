"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

import { EASE_HOUSE } from "@/lib/motion"
import { siteConfig } from "@/config/site"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

/**
 * Contact: the channels, stated plainly.
 *
 * No form. A form here would depend on outgoing email being configured in
 * production, and a message that silently goes nowhere is worse than an
 * address the visitor can see. No response-time promise either, because
 * nothing in the system measures one.
 */

const reveal = (delay = 0) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: EASE_HOUSE },
})

const whatsappNumber = siteConfig.contacts.whatsapp.replace(/^https:\/\/wa\.me\//, "")
const whatsappDisplay = whatsappNumber.startsWith("62")
    ? `+62 ${whatsappNumber.slice(2).replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3")}`
    : whatsappNumber

const CHANNELS = [
    {
        label: "WhatsApp",
        value: whatsappDisplay,
        href: siteConfig.contacts.whatsapp,
        note: "Questions before you sign up, plans and pricing, moving from another system.",
        external: true,
    },
    {
        label: "Email",
        value: siteConfig.contacts.email,
        href: `mailto:${siteConfig.contacts.email}`,
        note: "Anything that needs a written record: invoices for your subscription, data requests, longer questions.",
        external: false,
    },
]

export default function ContactPage() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
            <SiteHeader />

            <main className="flex-1 pb-28 pt-36">
                <section className="mx-auto max-w-6xl px-6">
                    <motion.div {...reveal(0)} className="flex items-center gap-3">
                        <span className="h-px w-8 bg-foreground/30" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Contact</span>
                    </motion.div>

                    <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
                        <motion.h1
                            {...reveal(0.05)}
                            className="font-display text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl"
                        >
                            Talk to the people{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 bg-clip-text text-transparent dark:from-emerald-400 dark:to-cyan-400">
                                who built it.
                            </span>
                        </motion.h1>
                        <motion.p {...reveal(0.12)} className="max-w-md text-[15px] leading-relaxed text-muted-foreground lg:justify-self-end">
                            Write in English or Bahasa Indonesia. Tell us the company, what you use today and what you want to stop
                            doing by hand.
                        </motion.p>
                    </div>
                </section>

                <section className="mx-auto mt-16 max-w-6xl px-6">
                    <div className="border-t border-foreground">
                        {CHANNELS.map((c, i) => (
                            <motion.a
                                key={c.label}
                                {...reveal(0.15 + i * 0.06)}
                                href={c.href}
                                target={c.external ? "_blank" : undefined}
                                rel={c.external ? "noopener noreferrer" : undefined}
                                className="group grid gap-3 border-b border-foreground/10 py-7 transition-colors hover:bg-foreground/[0.02] md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1.2fr)_2rem] md:items-center md:gap-6"
                            >
                                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{c.label}</span>
                                <span className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">{c.value}</span>
                                <span className="text-[13px] leading-relaxed text-muted-foreground">{c.note}</span>
                                <ArrowRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground md:block" />
                            </motion.a>
                        ))}

                        <motion.div
                            {...reveal(0.3)}
                            className="grid gap-3 py-7 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6"
                        >
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                Already a customer
                            </span>
                            <div className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                                Raise a ticket from inside the application (the lifebuoy at the top of every screen). It reaches support
                                with your company attached. If you tick diagnostic consent, support can look at your books for 24
                                hours, and every look is recorded in your audit log; without it, they cannot.
                                <Link
                                    href="/login"
                                    className="mt-4 flex w-fit items-center gap-1.5 text-[14px] font-medium text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
                                >
                                    Sign in to raise a ticket
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    )
}
