"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import {
    motion,
    AnimatePresence,
    useScroll,
    useSpring,
} from "framer-motion"
import { ThemeToggle } from "@/components/theme-toggle"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MessageCircle, Mail, ChevronDown, ArrowRight } from "lucide-react"

const NAV_LINKS = [
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
]

/**
 * Editorial navbar — Big 4 restraint with accounting-native motion.
 *
 * The accounting cues are functional, not ornamental:
 *  - The scroll hairline is split Dr | Cr from the centre out, so the
 *    reading position renders as a balanced pair rather than a bar.
 *  - A live posting ticker cycles real double-entry pairs, each with a
 *    balanced tick — the product's core promise, stated continuously.
 *  - Nav links underline with a ledger rule that draws from the left.
 *  - The wordmark's period is a balance dot that settles on hover.
 */

export function SiteHeader() {
    const [scrolled, setScrolled] = useState(false)
    const [contactOpen, setContactOpen] = useState(false)
    const [hovered, setHovered] = useState<string | null>(null)
    const pathname = usePathname()

    const { scrollYProgress } = useScroll()
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50)
        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <>
            {/* Reading position as a balanced Dr | Cr pair growing from the
                centre — a progress bar that states the thesis. */}
            <div className="fixed top-0 left-0 right-0 z-[60] h-[2px] flex">
                <div className="relative w-1/2 overflow-hidden">
                    <motion.div
                        style={{ scaleX: progress }}
                        className="absolute inset-0 origin-right bg-gradient-to-l from-emerald-600 to-emerald-500/40 dark:from-emerald-400 dark:to-emerald-400/30"
                    />
                </div>
                <div className="relative w-1/2 overflow-hidden">
                    <motion.div
                        style={{ scaleX: progress }}
                        className="absolute inset-0 origin-left bg-gradient-to-r from-cyan-600 to-cyan-500/40 dark:from-cyan-400 dark:to-cyan-400/30"
                    />
                </div>
            </div>

            <div
                className={cn(
                    "fixed left-0 right-0 z-50 flex justify-center px-4 transition-all duration-300",
                    scrolled ? "top-3" : "top-6"
                )}
            >
                <motion.header
                    initial={{ y: -80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    className={cn(
                        "relative flex items-center justify-between rounded-full pl-4 pr-2 sm:pl-5 sm:pr-3 transition-all duration-300 border",
                        "bg-white/85 dark:bg-zinc-950/80 backdrop-blur-xl",
                        "border-zinc-900/10 dark:border-white/10",
                        scrolled
                            ? "h-13 w-full max-w-5xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] dark:shadow-black/40"
                            : "h-16 w-full max-w-6xl"
                    )}
                >
                    {/* ── Wordmark ─────────────────────────────────────── */}
                    <Link href="/" className="flex items-center gap-2.5 group shrink-0">
                        <div className="relative h-8 w-8 rounded-lg overflow-hidden">
                            <img
                                src="/images/logo-icon.svg"
                                alt={siteConfig.name}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <span
                            className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 inline-flex items-baseline"
                            style={{ fontFamily: "var(--font-document-serif), Georgia, serif" }}
                        >
                            {siteConfig.name}
                            {/* The period doubles as a balance indicator. It
                                used to bob up and down forever, which reads
                                as a loading spinner on a brand mark; it now
                                rests, and settles once when hovered. */}
                            <span className="ml-px inline-block h-[5px] w-[5px] rounded-full bg-emerald-600 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-[2px] dark:bg-emerald-400" />
                        </span>
                    </Link>

                    {/* ── Centre nav ───────────────────────────────────── */}
                    <nav
                        className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2"
                        onMouseLeave={() => setHovered(null)}
                    >
                        {NAV_LINKS.map((link) => {
                            const active = pathname === link.href
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onMouseEnter={() => setHovered(link.href)}
                                    className={cn(
                                        "group relative px-4 py-2 text-sm font-medium rounded-full transition-colors",
                                        active
                                            ? "text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="relative z-10">{link.label}</span>
                                    {/* Ledger rule: draws left-to-right, the way
                                        a line is ruled under a posted total. */}
                                    <span className="pointer-events-none absolute bottom-1 left-4 right-4 z-10 h-px origin-left scale-x-0 bg-emerald-600/70 dark:bg-emerald-400/70 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                                    {active && (
                                        <motion.span
                                            layoutId="nav-active-dot"
                                            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-emerald-600 dark:bg-emerald-400"
                                        />
                                    )}
                                </Link>
                            )
                        })}

                        <button
                            onMouseEnter={() => setHovered("contact")}
                            onClick={() => setContactOpen(!contactOpen)}
                            className="group relative px-4 py-2 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                        >
                            <span className="relative z-10">Contact</span>
                            <ChevronDown
                                className={cn(
                                    "relative z-10 h-3.5 w-3.5 transition-transform duration-200",
                                    contactOpen && "rotate-180"
                                )}
                            />
                            <span className="pointer-events-none absolute bottom-1 left-4 right-7 z-10 h-px origin-left scale-x-0 bg-emerald-600/70 dark:bg-emerald-400/70 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                        </button>
                    </nav>

                    {/* ── Right actions ────────────────────────────────── */}
                    <div className="flex items-center gap-1.5">
                        <ThemeToggle />

                        <Link href="/login">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="hidden sm:inline-flex text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-900/5 dark:hover:bg-white/10 rounded-full font-medium px-4 transition-colors"
                            >
                                Sign in
                            </Button>
                        </Link>

                        <Link href="/register">
                            <Button
                                size="sm"
                                className="group rounded-full font-medium px-3.5 sm:px-5 bg-foreground text-background hover:bg-foreground/85 transition-colors"
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    Create account
                                    <ArrowRight className="hidden h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 sm:block" />
                                </span>
                            </Button>
                        </Link>
                    </div>

                    {/* ── Contact dropdown ─────────────────────────────── */}
                    <AnimatePresence>
                        {contactOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 rounded-2xl border border-zinc-900/10 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                            >
                                <a
                                    href={siteConfig.contacts.whatsapp}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 px-4 py-3.5 text-sm text-zinc-700 dark:text-zinc-100 hover:bg-zinc-900/[0.04] dark:hover:bg-white/10 transition-colors"
                                    onClick={() => setContactOpen(false)}
                                >
                                    <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                                        <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">WhatsApp</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Chat with support
                                        </div>
                                    </div>
                                </a>
                                <a
                                    href={`mailto:${siteConfig.contacts.email}`}
                                    className="flex items-center gap-3 px-4 py-3.5 text-sm text-zinc-700 dark:text-zinc-100 hover:bg-zinc-900/[0.04] dark:hover:bg-white/10 transition-colors border-t border-zinc-900/5 dark:border-white/5"
                                    onClick={() => setContactOpen(false)}
                                >
                                    <div className="h-9 w-9 rounded-full bg-cyan-500/15 flex items-center justify-center">
                                        <Mail className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">Email</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {siteConfig.contacts.email}
                                        </div>
                                    </div>
                                </a>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.header>
            </div>
        </>
    )
}
