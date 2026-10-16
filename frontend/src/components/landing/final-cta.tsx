"use client"

import { motion } from "framer-motion"

/**
 * Closing statement — a quiet, confident consulting-report sign-off.
 * No buttons by design; the navbar's "Get Started" carries the action.
 */
export function FinalCta() {
    return (
        <section className="relative py-32 overflow-hidden">
            {/* Stage glow + texture (visible in both themes) */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 dark:hidden bg-[linear-gradient(180deg,transparent_0%,#ecfdf5_100%)] opacity-70" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] h-[70%] bg-emerald-500/[0.07] dark:bg-emerald-500/10 blur-[140px] rounded-full" />
                <div className="absolute inset-0 bg-[radial-gradient(rgba(9,60,50,0.10)_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(ellipse_50%_60%_at_50%_100%,black,transparent)]" />
            </div>

            <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.6 }}
                    className="flex items-center justify-center gap-3 mb-8"
                >
                    <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-400">
                        BalanceIO
                    </span>
                    <span className="h-px w-10 bg-emerald-600/70 dark:bg-emerald-400/70" />
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20 }}
                    className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-[1.08]"
                >
                    Your books deserve a{" "}
                    <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-300 dark:to-cyan-400 bg-clip-text text-transparent animate-gradient-flow [background-size:200%_200%]">
                        heartbeat
                    </span>
                    .
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ delay: 0.15, type: "spring", stiffness: 100, damping: 20 }}
                    className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
                >
                    Accuracy, control, and clarity — one platform built for how modern
                    businesses actually run their books.
                </motion.p>
            </div>
        </section>
    )
}
