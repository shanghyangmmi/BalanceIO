"use client"

import * as React from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { registerScrollPlugins, prefersReducedMotion } from "./scroll-engine"

/**
 * Act II — The Pipeline.
 *
 * A pinned section whose track scrolls horizontally as the page scrolls
 * vertically, walking the visitor along the actual accounting cycle:
 * entry → ledger → trial balance → statements. Each station carries a
 * real (if simplified) rendering of that stage of the product, so the
 * section doubles as a product tour without a single screenshot.
 */

const STATIONS = [
    {
        no: "01",
        title: "The entry",
        blurb: "A transaction is captured once, with both sides declared. It cannot be posted until it balances to the cent.",
    },
    {
        no: "02",
        title: "The ledger",
        blurb: "Every posted line lands in its account and carries a running balance forward. Nothing is retyped, nothing drifts.",
    },
    {
        no: "03",
        title: "The proof",
        blurb: "Debits and credits are totalled across every account. Equal columns are the arithmetic proof your books hold.",
    },
    {
        no: "04",
        title: "The statements",
        blurb: "Financial position, profit or loss and cash flows are built from the same posted lines, and every figure drills back to its entry.",
    },
] as const

/* ── Station visuals ─────────────────────────────────────────────── */

const Frame = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm p-4 font-mono text-[11px] tabular-nums shadow-sm">
        {children}
    </div>
)

const Row = ({
    a,
    b,
    c,
    dim,
    accent,
}: {
    a: string
    b?: string
    c?: string
    dim?: boolean
    accent?: boolean
}) => (
    <div
        className={
            "grid grid-cols-[1fr_auto_auto] gap-3 py-1.5 border-b border-foreground/5 last:border-0 " +
            (dim ? "text-muted-foreground" : "text-foreground") +
            (accent ? " text-emerald-700 dark:text-emerald-400" : "")
        }
    >
        <span className="truncate">{a}</span>
        <span className="w-24 text-right">{b}</span>
        <span className="w-24 text-right">{c}</span>
    </div>
)

function EntryVisual() {
    return (
        <Frame>
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>JE-2026-0418</span>
                <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
                    Balanced
                </span>
            </div>
            <Row a="Account" b="Debit" c="Credit" dim />
            <Row a="1-1100 Cash" b="120.000.000" c="—" />
            <Row a="1-1300 Accounts receivable" b="—" c="120.000.000" />
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-3 border-t border-foreground/15 pt-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <span>Total</span>
                <span className="w-24 text-right">120.000.000</span>
                <span className="w-24 text-right">120.000.000</span>
            </div>
        </Frame>
    )
}

function LedgerVisual() {
    return (
        <Frame>
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                1-1100 · Cash
            </div>
            <Row a="Date" b="Movement" c="Balance" dim />
            <Row a="01 Apr  Opening" b="—" c="310.400.000" dim />
            <Row a="12 Apr  Cash sale" b="+45.000.000" c="355.400.000" />
            <Row a="21 Apr  Payroll" b="−62.000.000" c="293.400.000" />
            <Row a="30 Apr  Settlement" b="+120.000.000" c="413.400.000" accent />
        </Frame>
    )
}

function TrialVisual() {
    return (
        <Frame>
            <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Trial balance · 30 Apr 2026
            </div>
            <Row a="Account" b="Debit" c="Credit" dim />
            <Row a="Assets" b="1.842.600.000" c="—" />
            <Row a="Liabilities" b="—" c="612.300.000" />
            <Row a="Equity" b="—" c="980.100.000" />
            <Row a="Income & expense" b="—" c="250.200.000" />
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] gap-3 border-t border-foreground/15 pt-2 font-semibold text-emerald-700 dark:text-emerald-400">
                <span>Difference 0,00</span>
                <span className="w-24 text-right">1.842.600.000</span>
                <span className="w-24 text-right">1.842.600.000</span>
            </div>
        </Frame>
    )
}

function StatementsVisual() {
    const bars = [
        { label: "Assets", pct: 100 },
        { label: "Liabilities", pct: 33 },
        { label: "Equity", pct: 53 },
        { label: "Revenue", pct: 71 },
        { label: "Net profit", pct: 24 },
    ]
    return (
        <Frame>
            <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Statement of financial position
            </div>
            <div className="space-y-2.5">
                {bars.map((b) => (
                    <div key={b.label} className="space-y-1">
                        <div className="flex justify-between text-muted-foreground">
                            <span>{b.label}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-foreground/8">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-cyan-400"
                                style={{ width: `${b.pct}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </Frame>
    )
}

const VISUALS = [EntryVisual, LedgerVisual, TrialVisual, StatementsVisual]

/* ── Section ─────────────────────────────────────────────────────── */

export function Pipeline() {
    const sectionRef = React.useRef<HTMLDivElement | null>(null)
    const trackRef = React.useRef<HTMLDivElement | null>(null)
    const [active, setActive] = React.useState(0)

    React.useEffect(() => {
        const section = sectionRef.current
        const track = trackRef.current
        if (!section || !track) return
        registerScrollPlugins()

        // Narrow viewports get a plain vertical stack — horizontal pinning
        // on a phone fights the browser's own gesture handling.
        if (prefersReducedMotion() || window.innerWidth < 900) return

        const ctx = gsap.context(() => {
            /**
             * How far the track has to travel.
             *
             * This used to be `track.scrollWidth - innerWidth`, and
             * scrollWidth lies here: on a flex container that overflows,
             * it omits the container's own padding-right. The track asked
             * for `pr-[30vw]` of breathing room at the end and got none of
             * it counted, so the run stopped with the last card's right
             * edge flush against the viewport — while the first card had
             * started at a comfortable inset. That asymmetry is what read
             * as "The Statements is cut off".
             *
             * Measured from the last card's real right edge instead, and
             * finished with the same inset the track starts with, so the
             * run is symmetric at both ends. Both rects carry the same
             * transform, so the subtraction is valid at any scroll
             * position — which matters because invalidateOnRefresh
             * recomputes this mid-animation.
             */
            const distance = () => {
                const last = track.lastElementChild
                if (!last) return 0
                const inset = parseFloat(getComputedStyle(track).paddingLeft) || 24
                const contentRight =
                    last.getBoundingClientRect().right - track.getBoundingClientRect().left
                return Math.max(0, contentRight + inset - window.innerWidth)
            }

            gsap.to(track, {
                x: () => -distance(),
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    start: "top top",
                    end: () => "+=" + distance(),
                    pin: true,
                    scrub: 0.7,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                    onUpdate: (self) => {
                        const i = Math.min(
                            STATIONS.length - 1,
                            Math.round(self.progress * (STATIONS.length - 1))
                        )
                        setActive((prev) => (prev === i ? prev : i))
                    },
                },
            })
        }, section)

        return () => ctx.revert()
    }, [])

    return (
        <section
            ref={sectionRef}
            className="relative overflow-hidden bg-background lg:h-[100svh]"
        >
            <div
                aria-hidden
                className="absolute inset-0 dark:hidden bg-[linear-gradient(180deg,transparent,#f0fdf4_55%,transparent)] opacity-70"
            />

            <div className="relative z-10 flex h-full flex-col pt-20 pb-10">
                <div className="mx-auto w-full max-w-6xl px-6">
                    <div className="flex items-center gap-3">
                        <span className="h-px w-8 bg-foreground/30" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Act II — The cycle
                        </span>
                    </div>
                    <h2 className="font-display mt-5 max-w-2xl text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-foreground">
                        One entry, carried all the way to the{" "}
                        <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                            financial statements.
                        </span>
                    </h2>
                </div>

                {/* Horizontal track */}
                <div className="mt-10 min-h-0 flex-1 overflow-x-auto overflow-y-hidden lg:overflow-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div
                        ref={trackRef}
                        className="flex h-full items-center gap-6 px-6 will-change-transform lg:gap-10 lg:pl-[max(1.5rem,calc((100vw-72rem)/2))] lg:pr-[max(1.5rem,calc((100vw-72rem)/2))]"
                    >
                        {STATIONS.map((s, i) => {
                            const Visual = VISUALS[i]
                            return (
                                <article
                                    key={s.no}
                                    className="group relative w-[86vw] shrink-0 sm:w-[440px]"
                                >
                                    <div className="mb-4 border-t border-foreground/15 pt-4">
                                        <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground">
                                            {s.no}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        {s.title}
                                    </h3>
                                    <p className="mt-2 mb-5 text-sm leading-relaxed text-muted-foreground">
                                        {s.blurb}
                                    </p>
                                    <Visual />
                                </article>
                            )
                        })}
                    </div>
                </div>

                {/* Progress rail */}
                <div className="mx-auto mt-6 w-full max-w-6xl px-6">
                    <div className="flex items-center gap-2">
                        {STATIONS.map((s, i) => (
                            <span
                                key={s.no}
                                className={
                                    "h-px flex-1 transition-colors duration-500 " +
                                    (i <= active
                                        ? "bg-emerald-600 dark:bg-emerald-400"
                                        : "bg-foreground/12")
                                }
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    )
}
