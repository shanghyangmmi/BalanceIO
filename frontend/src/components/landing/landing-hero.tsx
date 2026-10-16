"use client"

import * as React from "react"
import {
    motion,
    useMotionValue,
    useSpring,
    useScroll,
    useTransform,
    type MotionValue,
} from "framer-motion"
import { ShieldCheck, Scale } from "lucide-react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { TiltCard } from "@/components/landing/tilt-card"
import { formatCurrency } from "@/lib/utils/formatter"

const HEADLINE = ["Accounting", "that", "feels"]
const HEADLINE_ACCENT = "alive."

const wordVariants = {
    hidden: { opacity: 0, y: 40, rotateX: 45, filter: "blur(8px)" },
    show: (i: number) => ({
        opacity: 1,
        y: 0,
        rotateX: 0,
        filter: "blur(0px)",
        transition: {
            delay: 0.15 + i * 0.12,
            type: "spring" as const,
            stiffness: 130,
            damping: 18,
        },
    }),
}

/** Floating mini-card that drifts with the cursor at a given parallax depth. */
function FloatCard({
    depth,
    mx,
    my,
    className,
    children,
    delay = 0,
}: {
    depth: number
    mx: MotionValue<number>
    my: MotionValue<number>
    className?: string
    children: React.ReactNode
    delay?: number
}) {
    const x = useTransform(mx, (v: number) => v * depth)
    const y = useTransform(my, (v: number) => v * depth)
    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay, type: "spring", stiffness: 120, damping: 16 }}
            style={{ x, y }}
            className={className}
        >
            {children}
        </motion.div>
    )
}

const BASE_BARS = [35, 55, 42, 70, 58, 82, 64, 92, 76, 100]
const BASE_VALUE = 4_823_750_000

export function LandingHero() {
    // Cursor parallax (springed — liquid, never jittery)
    const rawX = useMotionValue(0)
    const rawY = useMotionValue(0)
    const mx = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.8 })
    const my = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.8 })

    const onMouseMove = (e: React.MouseEvent) => {
        const { innerWidth, innerHeight } = window
        rawX.set((e.clientX / innerWidth - 0.5) * 24)
        rawY.set((e.clientY / innerHeight - 0.5) * 24)
    }

    // Scroll-driven exit
    const sectionRef = React.useRef<HTMLElement>(null)
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end start"],
    })
    const contentY = useTransform(scrollYProgress, [0, 1], [0, -120])
    const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

    // "Live data" heartbeat: every few seconds the chart morphs and the
    // net-position figure drifts — the dashboard visibly breathes.
    const [tick, setTick] = React.useState(0)
    React.useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 3200)
        return () => clearInterval(id)
    }, [])
    const bars = React.useMemo(
        () =>
            BASE_BARS.map((h, i) => {
                const wobble = Math.sin((tick + 1) * (i + 3) * 1.7) * 14
                return Math.max(22, Math.min(100, h + wobble))
            }),
        [tick]
    )
    const liveValue = React.useMemo(
        () => BASE_VALUE + Math.round(Math.sin(tick * 2.3) * 6_500_000) + tick * 1_250_000,
        [tick]
    )

    return (
        <section
            ref={sectionRef}
            onMouseMove={onMouseMove}
            className="relative min-h-[92svh] flex items-center overflow-hidden"
        >
            {/* ── Ambient stage (visible in BOTH themes) ─────────────────── */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Paper wash (light only): warm porcelain & emerald-tinted aura */}
                <div className="absolute inset-0 dark:hidden bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,#d1fae5_0%,transparent_60%),linear-gradient(160deg,#e6f4f1_0%,#f0fdf4_40%,#f7faf8_100%)]" />
                {/* Conic aurora sweep */}
                <div className="absolute -top-[40%] left-1/2 -translate-x-1/2 w-[120vw] aspect-square rounded-full opacity-[0.22] dark:opacity-25 blur-[100px] bg-[conic-gradient(from_90deg,transparent_0deg,#10b981_60deg,#06b6d4_140deg,transparent_220deg)] animate-[spin_28s_linear_infinite]" />
                <div className="absolute bottom-[-20%] left-[10%] w-[50%] h-[40%] bg-emerald-500/18 dark:bg-emerald-500/10 blur-[120px] rounded-full animate-pulse-slow" />
                <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-teal-500/18 dark:bg-teal-500/10 blur-[120px] rounded-full animate-blob" />
                {/* Dot matrix — ink dots on paper, starlight on ink */}
                <div className="absolute inset-0 bg-[radial-gradient(rgba(9,60,50,0.13)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_40%,black,transparent)]" />
                {/* Hairline rules — consulting-exhibit framing */}
                <div className="absolute inset-x-0 top-28 h-px bg-gradient-to-r from-transparent via-zinc-900/[0.07] dark:via-white/[0.07] to-transparent" />
                <div className="absolute inset-0 bg-noise" />
            </div>

            <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-36 pb-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
                {/* ── Left: editorial copy ────────────────────────────────── */}
                <motion.div style={{ y: contentY, opacity: contentOpacity }}>
                    {/* Eyebrow */}
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05, duration: 0.5 }}
                        className="flex items-center gap-3 mb-8"
                    >
                        <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                            Complete bookkeeping solutions for your business
                        </span>
                    </motion.div>

                    {/* Headline: serif display, word-by-word 3D reveal */}
                    <h1
                        className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.06] text-foreground [perspective:800px]"
                        style={{ transformStyle: "preserve-3d" }}
                    >
                        {HEADLINE.map((word, i) => (
                            <motion.span
                                key={word}
                                custom={i}
                                variants={wordVariants}
                                initial="hidden"
                                animate="show"
                                className="inline-block mr-[0.28em] will-change-transform"
                            >
                                {word}
                            </motion.span>
                        ))}
                        <motion.span
                            custom={HEADLINE.length}
                            variants={wordVariants}
                            initial="hidden"
                            animate="show"
                            className="inline-block italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent animate-gradient-flow [background-size:200%_200%]"
                        >
                            {HEADLINE_ACCENT}
                        </motion.span>
                    </h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.65, duration: 0.6 }}
                        className="mt-7 max-w-xl text-lg text-muted-foreground leading-relaxed"
                    >
                        From invoicing and inventory to fixed assets and tax, BalanceIO
                        runs your entire back office in one place — with built-in
                        accounting controls that stop mistakes before they ever reach
                        your reports.
                    </motion.p>

                    {/* Trust chips */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.95, duration: 0.8 }}
                        className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground"
                    >
                        <span className="inline-flex items-center gap-2">
                            <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                            Built-in accounting controls
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                            High data-protection standards
                        </span>
                    </motion.div>
                </motion.div>

                {/* ── Right: living hologram of the product ───────────────── */}
                <div className="relative hidden lg:block [perspective:1200px]">
                    {/* Main balance card — parallax drift + 3D tilt + glare */}
                    <FloatCard
                        depth={-0.6}
                        mx={mx}
                        my={my}
                        delay={0.5}
                        className="relative z-10 [perspective:1200px]"
                    >
                        <TiltCard max={6} className="rounded-3xl">
                        <div className="relative rounded-3xl border border-zinc-900/10 bg-white/85 dark:border-white/10 dark:bg-zinc-900/70 backdrop-blur-2xl p-8 shadow-2xl shadow-zinc-900/10 dark:shadow-emerald-950/40 overflow-hidden">
                        <div className="absolute inset-0 bg-noise pointer-events-none" />
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                                Net Position · Live
                            </span>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                        </div>
                        <div className="text-4xl font-bold text-foreground font-money">
                            <NumberTicker
                                value={liveValue}
                                format={(v) => formatCurrency(v)}
                                stiffness={40}
                                damping={20}
                            />
                        </div>
                        <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                            ▲ +12.4% this quarter · updated in real time
                        </div>
                        {/* Living sparkline — bars morph every few seconds */}
                        <div className="mt-6 flex items-end gap-1.5 h-16">
                            {bars.map((h, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ scaleY: 0 }}
                                    animate={{ height: `${h}%`, scaleY: 1 }}
                                    transition={{
                                        delay: tick === 0 ? 0.9 + i * 0.06 : 0,
                                        type: "spring",
                                        stiffness: 160,
                                        damping: 22,
                                    }}
                                    style={{ transformOrigin: "bottom" }}
                                    className="flex-1 rounded-t-md bg-gradient-to-t from-emerald-700/50 to-emerald-500 dark:from-emerald-600/40 dark:to-emerald-400"
                                />
                            ))}
                        </div>
                        </div>
                        </TiltCard>
                    </FloatCard>

                    {/* Floating chip: balanced entry — pulsing "just posted" glow */}
                    <FloatCard
                        depth={-1.2}
                        mx={mx}
                        my={my}
                        delay={1.0}
                        className="absolute -top-10 -right-4 z-20"
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.035, 1],
                                boxShadow: [
                                    "0 8px 30px -8px rgba(16,185,129,0)",
                                    "0 8px 40px -6px rgba(16,185,129,0.45)",
                                    "0 8px 30px -8px rgba(16,185,129,0)",
                                ],
                            }}
                            transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                            className="rounded-2xl border border-emerald-600/25 bg-white/90 dark:border-emerald-500/30 dark:bg-zinc-900/90 backdrop-blur-xl px-5 py-4"
                        >
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                                JE-2026-0791
                            </div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                <motion.span
                                    animate={{ rotate: [0, 0, 12, -8, 0] }}
                                    transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
                                >
                                    <ShieldCheck className="h-4 w-4" />
                                </motion.span>
                                Dr = Cr · Posted
                            </div>
                        </motion.div>
                    </FloatCard>

                    {/* Floating chip: tax */}
                    <FloatCard
                        depth={-1.8}
                        mx={mx}
                        my={my}
                        delay={1.2}
                        className="absolute -bottom-8 -left-8 z-20 rounded-2xl border border-zinc-900/10 bg-white/90 dark:border-white/10 dark:bg-zinc-900/90 backdrop-blur-xl px-5 py-4 shadow-xl"
                    >
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                            PPN Output · July
                        </div>
                        <div className="text-lg font-bold text-foreground font-money">
                            <NumberTicker value={128400000} format={(v) => formatCurrency(v)} />
                        </div>
                    </FloatCard>
                </div>
            </div>

            {/* Scroll cue */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
                style={{ opacity: contentOpacity }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/60"
            >
                <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
                <motion.span
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="h-8 w-px bg-gradient-to-b from-emerald-600 dark:from-emerald-500 to-transparent"
                />
            </motion.div>
        </section>
    )
}
