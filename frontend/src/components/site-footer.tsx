"use client";

import Link from "next/link"
import { siteConfig } from "@/config/site"

/**
 * Footer as the signature line of a report: one ruled band, nothing that
 * asks to be read twice.
 *
 * It used to be a masthead column, a heading over a ruled link row and a
 * separate legal row, 286px tall at desktop width, with three social
 * icons that all linked to "#". It is now two lines: identity and
 * navigation, then the legal line. Social links come back when the
 * accounts behind them are live.
 */

const LINKS = [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Sign in", href: "/login" },
]

const LEGAL = [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
]

export function SiteFooter() {
    return (
        <footer className="w-full border-t border-foreground/10 bg-background">
            <div className="mx-auto max-w-6xl px-6">
                <div className="flex flex-col gap-5 py-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-4">
                        <Link href="/" className="inline-flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                            <img src="/images/logo-icon.svg" alt="" className="h-6 w-6 rounded" />
                            <span className="font-display text-base font-bold tracking-tight text-foreground">
                                {siteConfig.name}
                            </span>
                        </Link>
                        <span className="text-[13px] text-muted-foreground">
                            Accounting software for Indonesian companies.
                        </span>
                    </div>

                    <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        {LINKS.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                                {l.label}
                            </Link>
                        ))}
                        <a
                            href={`mailto:${siteConfig.contacts.email}`}
                            className="text-[13px] text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"
                        >
                            {siteConfig.contacts.email}
                        </a>
                    </nav>
                </div>

                <div className="flex flex-col gap-2 border-t border-foreground/[0.06] py-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                        © {new Date().getFullYear()} {siteConfig.brand.companyName}
                    </span>
                    <div className="flex items-center gap-5">
                        {LEGAL.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground"
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    )
}
