"use client";

import Link from "next/link"
import { siteConfig } from "@/config/site"
import { Instagram, Linkedin, MessageCircle, ArrowUpRight } from "lucide-react"
import { motion } from "framer-motion"

/**
 * Footer as a closing ledger page.
 *
 * The structure is borrowed from the last page of a statutory report:
 * ruled columns and a signature line. The motion is restrained on
 * purpose — this is where a reader lands after the argument is made,
 * not another exhibit.
 */

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
    {
        heading: "Product",
        links: [
            { label: "Features", href: "/features" },
            { label: "Pricing", href: "/pricing" },
            { label: "Log In", href: "/login" },
            { label: "Get Started", href: "/register" },
        ],
    },
]

export function SiteFooter() {
    return (
        <footer className="relative w-full overflow-hidden border-t border-foreground/10 bg-muted/30">
            {/* Ledger rules — vertical column guides, the way a ruled page
                is printed before anything is written on it. */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-40 [background-image:linear-gradient(to_right,rgba(120,130,140,0.10)_1px,transparent_1px)] [background-size:56px_100%]"
            />
            <div
                aria-hidden
                className="absolute -top-24 right-0 w-[420px] h-[220px] rounded-full bg-emerald-500/[0.05] dark:bg-emerald-400/[0.07] blur-[100px] pointer-events-none"
            />

            <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 mx-auto max-w-6xl px-6 py-9"
            >
                <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                    {/* ── Masthead ── */}
                    <div>
                        <Link href="/" className="group inline-flex items-center gap-2.5">
                            <div className="h-8 w-8 overflow-hidden rounded-md shadow-sm transition-transform duration-300 group-hover:scale-105">
                                <img
                                    src="/images/logo-icon.svg"
                                    alt={siteConfig.name}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                            <span className="font-display text-xl font-bold tracking-tight text-foreground">
                                {siteConfig.name}
                                <span className="text-emerald-600 dark:text-emerald-400">.</span>
                            </span>
                        </Link>

                        <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                            Accounting, inventory, fixed assets and tax records —
                            one system, one trail back to the entry that made it.
                        </p>

                        <div className="mt-5 flex gap-2">
                            {[Instagram, MessageCircle, Linkedin].map((Icon, i) => (
                                <motion.a
                                    key={i}
                                    href="#"
                                    aria-label="Social link"
                                    whileHover={{ y: -3 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                    className="rounded-lg border border-foreground/10 p-2 text-muted-foreground transition-colors hover:border-emerald-600/30 hover:text-emerald-700 dark:hover:border-emerald-500/30 dark:hover:text-emerald-400"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* ── Links ──
                        A single group does not need a stacked column. Four
                        links were taking 158px of vertical space and made the
                        footer 41% of the viewport; laid out in a row they take
                        one line and the footer reads as a footer. */}
                    <div className="lg:justify-self-end lg:text-right">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400">
                            {COLUMNS[0].heading}
                        </div>
                        <div className="mt-2.5 mb-3 h-px w-full bg-foreground/10" />
                        <ul className="flex flex-wrap gap-x-6 gap-y-2 lg:justify-end">
                            {COLUMNS[0].links.map((l) => (
                                <li key={l.label}>
                                    <Link
                                        href={l.href}
                                        className="group inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <span className="relative">
                                            {l.label}
                                            <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-emerald-600/60 transition-transform duration-300 ease-out group-hover:scale-x-100 dark:bg-emerald-400/60" />
                                        </span>
                                        <ArrowUpRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* ── Signature line ── */}
                <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-foreground/[0.06] pt-5 sm:flex-row">
                    <span className="font-mono text-[11px] text-muted-foreground/70">
                        © {new Date().getFullYear()} {siteConfig.brand.companyName}. All rights reserved.
                    </span>
                    {/* Terms was only ever reachable from the Compliance column
                        and Privacy from nowhere at all, though both pages exist
                        and ship. Removing that column would have orphaned them,
                        so they take the slot the signature mark vacated - which
                        is where legal links belong anyway. */}
                    <div className="flex items-center gap-5">
                        {[
                            { label: "Terms", href: "/terms" },
                            { label: "Privacy", href: "/privacy" },
                        ].map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 transition-colors hover:text-foreground"
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </motion.div>
        </footer>
    )
}
