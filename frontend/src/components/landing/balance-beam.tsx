"use client"

import * as React from "react"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { registerScrollPlugins, useIsDark, prefersReducedMotion } from "./scroll-engine"

/**
 * Act I — The Balance Instrument.
 *
 * A pinned, scroll-scrubbed proof of double entry. Each transaction
 * lands its debit on the left carriage (the beam tips *down* on that
 * side, because that side just got heavier), then its credit on the
 * right, and the beam rights itself with a damped settle.
 *
 * Deliberately not an antique pan-and-cord scale — this is a precision
 * instrument: a hairline beam on a lit pivot, floating carriages held
 * by thin stems, a digital delta readout, and a trace strip that plots
 * the entire balancing history as a waveform.
 *
 * Everything derives from one scroll progress value through `netAt`,
 * so the trace can plot future and past states in the same frame and
 * scrubbing backwards replays the physics exactly.
 */

interface Txn {
    label: string
    debit: string
    credit: string
    amount: string
    /** Which side of the entry is captured first. Real bookkeeping does
     *  not always lead with the debit, and a beam that only ever tips
     *  one way looks like a scripted animation rather than a mechanism. */
    lead: "dr" | "cr"
}

const TXNS: Txn[] = [
    { label: "Cash sale", debit: "Cash", credit: "Sales revenue", amount: "45.000.000", lead: "dr" },
    { label: "Stock purchase", debit: "Inventory", credit: "Accounts payable", amount: "28.500.000", lead: "cr" },
    { label: "Monthly payroll", debit: "Salary expense", credit: "Net pay payable", amount: "62.000.000", lead: "dr" },
    { label: "Customer settles", debit: "Cash", credit: "Accounts receivable", amount: "120.000.000", lead: "cr" },
]

const MAX_ANGLE = 0.105 // radians

function smoothstep(edge0: number, edge1: number, x: number) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}

/** Landing amounts for the two sides at a given point inside one entry. */
/** Point in a beat where both sides are down and the recoil begins. */
const SETTLE_AT = 0.74

function sidesAt(local: number, lead: "dr" | "cr") {
    const first = smoothstep(0.1, 0.36, local)
    const second = smoothstep(0.48, 0.74, local)
    return lead === "dr"
        ? { dr: first, cr: second }
        : { dr: second, cr: first }
}

/**
 * Signed imbalance at a given global progress. Positive = debit side
 * heavier. Pure and total, which is what lets the trace strip render
 * the whole journey — past and future — without simulating it.
 */
function netAt(p: number) {
    const n = TXNS.length
    const scaled = Math.min(Math.max(p, 0) * n, n - 0.0001)
    const idx = Math.floor(scaled)
    const local = scaled - idx
    const lead = TXNS[idx].lead

    const { dr, cr } = sidesAt(local, lead)
    let net = dr - cr

    // Damped settle once both sides are down. Driven by scroll position,
    // not elapsed time, so a reverse scrub replays it faithfully.
    if (local > SETTLE_AT) {
        const q = local - SETTLE_AT
        /**
         * The oscillation is forced to exactly zero by the end of the beat.
         *
         * Exponential decay alone never reaches zero, and here it did not
         * get close enough: at the end of the run the recoil term still
         * held 0.011, which rounds to one cent. So the animation whose
         * entire argument is that entries post only at exact equality
         * came to rest reading "0.01" in amber. In this product that is
         * not a rounding artefact, it is the opposite of the claim.
         *
         * The (1 - t)^2 envelope leaves the visible part of the recoil
         * intact - it is still 0.16 at the top of the settle - and takes
         * the tail to zero rather than to something small.
         */
        const t = Math.min(1, q / (1 - SETTLE_AT))
        const envelope = Math.exp(-14 * q) * (1 - t) * (1 - t)
        // The overshoot follows whichever side led, so the recoil always
        // kicks back against the direction it tipped.
        net += (lead === "dr" ? 1 : -1) * 0.42 * envelope * Math.sin(30 * q)
    }
    return net
}

export function BalanceBeam() {
    const sectionRef = React.useRef<HTMLDivElement | null>(null)
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
    const progress = React.useRef(0)
    const isDark = useIsDark()
    const [step, setStep] = React.useState(-1)
    const [delta, setDelta] = React.useState(0)
    const darkRef = React.useRef(isDark)
    darkRef.current = isDark

    React.useEffect(() => {
        const section = sectionRef.current
        if (!section) return
        registerScrollPlugins()

        if (prefersReducedMotion()) {
            progress.current = 1
            setStep(TXNS.length - 1)
            return
        }

        const st = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "+=340%",
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            onUpdate: (self) => {
                progress.current = self.progress
                const s = Math.min(TXNS.length - 1, Math.floor(self.progress * TXNS.length))
                setStep((prev) => (prev === s ? prev : s))
                // Quantised so the readout doesn't thrash React every frame.
                const d = Math.round(Math.abs(netAt(self.progress)) * 100)
                setDelta((prev) => (prev === d ? prev : d))
            },
        })

        return () => st.kill()
    }, [])

    React.useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let w = 0
        let h = 0
        let frame = 0

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            w = rect.width
            h = rect.height
            canvas.width = Math.round(w * dpr)
            canvas.height = Math.round(h * dpr)
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(canvas)

        const draw = () => {
            frame = requestAnimationFrame(draw)
            ctx.clearRect(0, 0, w, h)

            const dark = darkRef.current
            const ink = dark ? "255,255,255" : "24,32,40"
            const glow = dark ? "52,211,153" : "13,148,136"
            const cool = dark ? "34,211,238" : "8,145,178"
            const warn = dark ? "251,191,36" : "217,119,6"

            const p = progress.current
            const n = TXNS.length
            const scaled = Math.min(p * n, n - 0.0001)
            const idx = Math.floor(scaled)
            const local = scaled - idx

            const { dr: dLanded, cr: cLanded } = sidesAt(local, TXNS[idx].lead)
            const net = netAt(p)

            // NEGATED: canvas angles run clockwise, so a positive rotation
            // would lift the left end. The heavier side must drop.
            const angle = -net * MAX_ANGLE

            const cx = w / 2
            const cy = h * 0.34
            const beamLen = Math.min(w * 0.68, 700)
            const half = beamLen / 2
            const stem = Math.min(h * 0.17, 96)

            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            const lx = cx - half * cos
            const ly = cy - half * sin
            const rx = cx + half * cos
            const ry = cy + half * sin

            // ── Level datum: the reference the beam is measured against.
            // Without it the tilt has nothing to be read relative to. ──
            ctx.setLineDash([2, 6])
            ctx.strokeStyle = `rgba(${ink},${dark ? 0.16 : 0.13})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(cx - half - 26, cy)
            ctx.lineTo(cx + half + 26, cy)
            ctx.stroke()
            ctx.setLineDash([])

            // Graduation ticks along the datum.
            for (let i = -5; i <= 5; i++) {
                if (i === 0) continue
                const gx = cx + (i / 5) * (half + 10)
                const major = i % 5 === 0
                ctx.fillStyle = `rgba(${ink},${dark ? 0.2 : 0.16})`
                ctx.fillRect(gx - 0.5, cy - (major ? 6 : 3), 1, major ? 12 : 6)
            }

            // ── Pivot column: a thin lit shaft, not a wooden triangle ──
            const colGrad = ctx.createLinearGradient(0, cy, 0, cy + 96)
            colGrad.addColorStop(0, `rgba(${glow},0.5)`)
            colGrad.addColorStop(1, `rgba(${glow},0)`)
            ctx.fillStyle = colGrad
            ctx.fillRect(cx - 0.75, cy, 1.5, 96)

            // ── Beam ──
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate(angle)
            ctx.fillStyle = `rgba(${ink},${dark ? 0.5 : 0.4})`
            ctx.fillRect(-half, -1, beamLen, 2)
            // Tips carry the accent so the eye tracks the tilt.
            ctx.fillStyle = `rgba(${glow},0.85)`
            ctx.fillRect(-half, -1, 46, 2)
            ctx.fillRect(half - 46, -1, 46, 2)
            ctx.restore()

            // ── Pivot node ──
            ctx.fillStyle = `rgba(${glow},0.12)`
            ctx.beginPath()
            ctx.arc(cx, cy, 17, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = `rgba(${glow},0.95)`
            ctx.beginPath()
            ctx.arc(cx, cy, 4, 0, Math.PI * 2)
            ctx.fill()

            // ── Carriages ──
            const drawCarriage = (
                ex: number,
                ey: number,
                stacked: number,
                inFlight: number,
                side: "dr" | "cr"
            ) => {
                const py = ey + stem
                const cwd = 132
                const accent = side === "dr" ? glow : cool

                // Single hairline stem — no rope, no swing.
                ctx.strokeStyle = `rgba(${ink},${dark ? 0.2 : 0.15})`
                ctx.lineWidth = 1
                ctx.beginPath()
                ctx.moveTo(ex, ey)
                ctx.lineTo(ex, py)
                ctx.stroke()

                // Carriage rail.
                ctx.fillStyle = `rgba(${ink},${dark ? 0.26 : 0.18})`
                ctx.fillRect(ex - cwd / 2, py, cwd, 1.5)
                ctx.fillStyle = `rgba(${accent},0.7)`
                ctx.fillRect(ex - cwd / 2, py, cwd * Math.min(1, (stacked + inFlight) / TXNS.length), 1.5)

                // Posted entries stack downward from the rail as slim bars —
                // reads as a growing column of postings, not weights on a pan.
                const bh = 9
                const gap = 4
                for (let i = 0; i < stacked; i++) {
                    const by = py + 9 + i * (bh + gap)
                    ctx.fillStyle = `rgba(${accent},${0.2 + i * 0.14})`
                    ctx.fillRect(ex - cwd / 2 + 10, by, cwd - 20, bh)
                    ctx.fillStyle = `rgba(${accent},0.75)`
                    ctx.fillRect(ex - cwd / 2 + 10, by, 2, bh)
                }

                // The entry currently landing.
                if (inFlight > 0.001) {
                    const by = py + 9 + stacked * (bh + gap)
                    const rise = (1 - inFlight) * 46
                    ctx.globalAlpha = Math.min(1, inFlight * 1.4)
                    ctx.fillStyle = `rgba(${inFlight < 0.99 ? warn : accent},0.8)`
                    ctx.fillRect(ex - cwd / 2 + 10, by - rise, cwd - 20, bh)
                    ctx.globalAlpha = 1
                }

                ctx.font =
                    '600 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
                ctx.textAlign = "center"
                ctx.fillStyle = `rgba(${ink},${dark ? 0.4 : 0.34})`
                ctx.fillText(side === "dr" ? "DEBIT" : "CREDIT", ex, py - 9)
            }

            drawCarriage(lx, ly, idx, dLanded, "dr")
            drawCarriage(rx, ry, idx, cLanded, "cr")

            // ── Trace strip: the whole balancing history as a waveform ──
            const tY = h - 44
            const tH = 26
            const tX0 = cx - Math.min(w * 0.42, 400)
            const tX1 = cx + Math.min(w * 0.42, 400)
            const tW = tX1 - tX0

            // Zero axis.
            ctx.strokeStyle = `rgba(${ink},${dark ? 0.12 : 0.1})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(tX0, tY)
            ctx.lineTo(tX1, tY)
            ctx.stroke()

            // Entry boundaries — one division per transaction, so the
            // waveform is legible as four discrete postings.
            for (let i = 1; i < n; i++) {
                const bx = tX0 + (i / n) * tW
                ctx.fillStyle = `rgba(${ink},${dark ? 0.14 : 0.11})`
                ctx.fillRect(bx - 0.5, tY - tH, 1, tH * 2)
            }

            // Dr / Cr polarity labels on the trace.
            ctx.font =
                '600 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
            ctx.textAlign = "right"
            ctx.fillStyle = `rgba(${ink},${dark ? 0.3 : 0.26})`
            ctx.fillText("DR", tX0 - 8, tY - tH + 7)
            ctx.fillText("CR", tX0 - 8, tY + tH)

            // Future (un-scrolled) portion, ghosted.
            ctx.strokeStyle = `rgba(${ink},${dark ? 0.16 : 0.13})`
            ctx.beginPath()
            for (let i = 0; i <= 240; i++) {
                const q = i / 240
                const x = tX0 + q * tW
                const y = tY - netAt(q) * tH
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
            }
            ctx.stroke()

            // Traced-so-far portion, lit.
            ctx.strokeStyle = `rgba(${glow},0.9)`
            ctx.lineWidth = 1.6
            ctx.beginPath()
            const upto = Math.max(1, Math.round(240 * p))
            for (let i = 0; i <= upto; i++) {
                const q = i / 240
                const x = tX0 + q * tW
                const y = tY - netAt(q) * tH
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
            }
            ctx.stroke()

            // Playhead.
            const phX = tX0 + p * tW
            const phY = tY - net * tH
            ctx.fillStyle = `rgba(${glow},0.18)`
            ctx.beginPath()
            ctx.arc(phX, phY, 8, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = `rgba(${Math.abs(net) < 0.02 ? glow : warn},1)`
            ctx.beginPath()
            ctx.arc(phX, phY, 3, 0, Math.PI * 2)
            ctx.fill()
        }

        draw()
        return () => {
            cancelAnimationFrame(frame)
            ro.disconnect()
        }
    }, [])

    const active = step >= 0 ? TXNS[Math.min(step, TXNS.length - 1)] : null
    const balanced = delta === 0

    return (
        <section
            ref={sectionRef}
            className="relative h-[100svh] overflow-hidden bg-background"
        >
            <div
                aria-hidden
                className="absolute inset-0 opacity-[0.35] dark:opacity-[0.22] [background-image:linear-gradient(to_right,rgba(120,130,140,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,130,140,0.14)_1px,transparent_1px)] [background-size:56px_56px]"
            />
            <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,transparent_20%,var(--background)_92%)]"
            />

            <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6 pt-20 pb-8">
                <div className="flex items-baseline justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <span className="h-px w-8 bg-foreground/30" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                            Act I — Double entry
                        </span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {String(Math.min(step + 1, TXNS.length)).padStart(2, "0")} /{" "}
                        {String(TXNS.length).padStart(2, "0")}
                    </span>
                </div>

                <h2 className="font-display mt-5 max-w-2xl text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-foreground">
                    Nothing posts until{" "}
                    <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                        both sides agree.
                    </span>
                </h2>

                <div className="relative min-h-0 flex-1">
                    <canvas
                        ref={canvasRef}
                        aria-hidden
                        style={{ width: "100%", height: "100%", display: "block" }}
                    />

                    {/* Digital delta readout */}
                    <div className="pointer-events-none absolute right-0 top-0 text-right">
                        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                            Difference
                        </div>
                        <div
                            className={
                                "font-money text-2xl sm:text-3xl tabular-nums transition-colors duration-200 " +
                                (balanced
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400")
                            }
                        >
                            {(delta / 100).toFixed(2).replace(".", ",")}
                        </div>
                        <div
                            className={
                                "mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-200 " +
                                (balanced
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400")
                            }
                        >
                            <span
                                className={
                                    "h-1.5 w-1.5 rounded-full " +
                                    (balanced
                                        ? "bg-emerald-600 dark:bg-emerald-400"
                                        : "bg-amber-500")
                                }
                            />
                            {balanced ? "Balanced" : "Posting"}
                        </div>
                    </div>
                </div>

                <div className="mt-2 border-t border-foreground/10 pt-4">
                    <div className="grid grid-cols-12 items-center gap-3 font-mono text-[11px] sm:text-xs">
                        <span className="col-span-12 sm:col-span-3 flex items-center gap-2 uppercase tracking-[0.2em] text-muted-foreground">
                            {active?.label ?? "Awaiting entry"}
                            {active && (
                                <span className="rounded-sm border border-foreground/15 px-1.5 py-px text-[9px] tracking-[0.1em] text-muted-foreground">
                                    {active.lead === "dr" ? "DR first" : "CR first"}
                                </span>
                            )}
                        </span>
                        <span className="col-span-5 sm:col-span-3 truncate text-foreground">
                            <span className={active?.lead === "dr" ? "text-emerald-700 dark:text-emerald-400" : ""}>
                                Dr
                            </span>{" "}
                            &nbsp;{active?.debit ?? "—"}
                        </span>
                        <span className="col-span-7 sm:col-span-3 truncate text-foreground">
                            <span className={active?.lead === "cr" ? "text-cyan-700 dark:text-cyan-400" : ""}>
                                Cr
                            </span>{" "}
                            &nbsp;{active?.credit ?? "—"}
                        </span>
                        <span className="col-span-12 sm:col-span-3 tabular-nums text-right text-emerald-700 dark:text-emerald-400">
                            {active ? `Rp ${active.amount}` : "—"}
                        </span>
                    </div>
                </div>
            </div>
        </section>
    )
}
