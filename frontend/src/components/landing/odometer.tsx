"use client"

import * as React from "react"
import { motion, useInView } from "framer-motion"

/**
 * A mechanical odometer readout — each digit is a strip of 0-9 that
 * rolls into position, staggered left to right so the number "spins up"
 * the way a counter wheel does. Non-digit characters (separators,
 * currency marks) sit fixed between the wheels.
 *
 * Uses transform only, so the whole strip composites on the GPU.
 */
export function Odometer({
    value,
    className,
    delay = 0,
}: {
    value: string
    className?: string
    delay?: number
}) {
    const ref = React.useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true, amount: 0.6 })
    const chars = React.useMemo(() => value.split(""), [value])

    return (
        <span
            ref={ref}
            className={"inline-flex font-money " + (className ?? "")}
            aria-label={value}
        >
            {chars.map((ch, i) => {
                const digit = Number.parseInt(ch, 10)
                if (Number.isNaN(digit)) {
                    return (
                        <span key={i} aria-hidden className="inline-block">
                            {ch}
                        </span>
                    )
                }
                return (
                    <span
                        key={i}
                        aria-hidden
                        className="relative inline-block overflow-hidden tabular-nums"
                        style={{ height: "1em", lineHeight: 1 }}
                    >
                        {/* Invisible sizer keeps the wheel exactly one glyph wide */}
                        <span className="invisible block">0</span>
                        <motion.span
                            className="absolute inset-x-0 top-0 will-change-transform"
                            initial={{ y: "0%" }}
                            animate={inView ? { y: `-${digit * 10}%` } : { y: "0%" }}
                            transition={{
                                duration: 1.15,
                                delay: delay + i * 0.055,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            {Array.from({ length: 10 }, (_, d) => (
                                <span key={d} className="block" style={{ lineHeight: 1 }}>
                                    {d}
                                </span>
                            ))}
                        </motion.span>
                    </span>
                )
            })}
        </span>
    )
}
