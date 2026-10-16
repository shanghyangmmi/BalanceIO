"use client"

import * as React from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { FlowNetwork } from "./flow-network"

/**
 * Hero — "The Ledger Machine" opening.
 *
 * The Ledger Core canvas occupies the full stage; the headline sits in
 * the elliptical void carved out of the lattice's front face. Words
 * arrive through a clip-path mask (not opacity) so they feel printed
 * onto the page rather than faded in.
 */

const LINE_1 = ["Every", "figure"]
const LINE_2 = ["accounted", "for."]

/** Mask-reveal: the word slides up from behind a clipping edge. */
const word = {
    hidden: { y: "110%", opacity: 0 },
    show: (i: number) => ({
        y: "0%",
        opacity: 1,
        transition: {
            delay: 0.15 + i * 0.075,
            duration: 0.85,
            ease: [0.16, 1, 0.3, 1] as const,
        },
    }),
}

function MaskedLine({
    words,
    offset,
    accentFrom,
}: {
    words: string[]
    offset: number
    accentFrom?: number
}) {
    return (
        <span className="block overflow-hidden pb-[0.06em]">
            {words.map((w, i) => {
                const isAccent = accentFrom !== undefined && i >= accentFrom
                return (
                    <motion.span
                        key={w}
                        custom={offset + i}
                        variants={word}
                        initial="hidden"
                        animate="show"
                        className={
                            "inline-block mr-[0.26em] will-change-transform " +
                            (isAccent
                                ? "italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent"
                                : "")
                        }
                    >
                        {w}
                    </motion.span>
                )
            })}
        </span>
    )
}

export function MachineHero() {
    const ref = React.useRef<HTMLElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    })

    // Content lifts and dissolves faster than the canvas behind it —
    // cheap parallax depth, transform/opacity only.
    const contentY = useTransform(scrollYProgress, [0, 1], [0, -110])
    const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0])
    const coreScale = useTransform(scrollYProgress, [0, 1], [1, 1.18])

    return (
        <section
            ref={ref}
            className="relative min-h-[100svh] flex items-center justify-center overflow-hidden"
        >
            {/* The live chart of accounts */}
            <motion.div
                style={{ scale: coreScale }}
                className="absolute inset-0 z-0 will-change-transform"
            >
                <FlowNetwork />
            </motion.div>

            {/* A soft scrim rather than a knockout — the network has to read
                through it now that it carries the section's meaning. */}
            <div
                aria-hidden
                className="absolute inset-0 z-[1] pointer-events-none bg-[radial-gradient(ellipse_40%_30%_at_50%_50%,var(--background)_0%,color-mix(in_oklab,var(--background)_55%,transparent)_55%,transparent_85%)]"
            />
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 z-[1] h-40 pointer-events-none bg-gradient-to-t from-background to-transparent"
            />

            <motion.div
                style={{ y: contentY, opacity: contentOpacity }}
                className="relative z-10 mx-auto max-w-4xl px-6 text-center will-change-transform"
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.05, duration: 0.7 }}
                    className="mb-9 flex items-center justify-center gap-3"
                >
                    <span className="h-px w-8 bg-emerald-600/60 dark:bg-emerald-400/60" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-700 dark:text-emerald-400">
                        Complete bookkeeping for your business
                    </span>
                    <span className="h-px w-8 bg-emerald-600/60 dark:bg-emerald-400/60" />
                </motion.div>

                <h1 className="font-display text-[12.5vw] sm:text-6xl lg:text-[5.4rem] font-bold tracking-tight leading-[1.02] text-foreground">
                    <MaskedLine words={LINE_1} offset={0} />
                    <MaskedLine words={LINE_2} offset={LINE_1.length} accentFrom={0} />
                </h1>

                <motion.p
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.72, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="mx-auto mt-8 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed"
                >
                    From invoicing and inventory to fixed assets and tax, BalanceIO runs
                    your entire back office in one place — with accounting controls that
                    stop mistakes before they ever reach your reports.
                </motion.p>
            </motion.div>

            {/* Scroll cue */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.9 }}
                style={{ opacity: contentOpacity }}
                className="absolute bottom-9 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-3 text-muted-foreground"
            >
                <span className="text-[10px] uppercase tracking-[0.32em]">Scroll</span>
                <span className="relative h-10 w-px overflow-hidden bg-foreground/15">
                    <motion.span
                        animate={{ y: ["-100%", "100%"] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-x-0 h-1/2 bg-emerald-600 dark:bg-emerald-400"
                    />
                </span>
            </motion.div>
        </section>
    )
}
