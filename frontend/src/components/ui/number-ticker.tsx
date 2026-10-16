"use client"

import * as React from "react"
import { useMotionValue, useSpring, useMotionValueEvent } from "framer-motion"
import { cn } from "@/lib/utils"

interface NumberTickerProps {
    value: number
    /** Formatter for the displayed value (e.g. formatCurrency). Defaults to id-ID number format. */
    format?: (value: number) => string
    className?: string
    /** Spring stiffness/damping tuned for a satisfying financial "roll-up". */
    stiffness?: number
    damping?: number
}

/**
 * Physics-based animated number. On mount (or when `value` changes) the
 * figure rolls from its previous value to the new one on a spring — the
 * classic "living dashboard" effect. Renders with tabular figures so the
 * layout never jitters while animating.
 */
export function NumberTicker({
    value,
    format,
    className,
    stiffness = 90,
    damping = 24,
}: NumberTickerProps) {
    const motionValue = useMotionValue(0)
    const spring = useSpring(motionValue, { stiffness, damping })
    const [display, setDisplay] = React.useState("0")

    const formatter = React.useMemo(
        () => format ?? ((v: number) => new Intl.NumberFormat("id-ID").format(Math.round(v))),
        [format]
    )

    React.useEffect(() => {
        motionValue.set(value)
    }, [motionValue, value])

    useMotionValueEvent(spring, "change", (latest) => {
        setDisplay(formatter(latest as number))
    })

    return (
        <span className={cn("font-money inline-block", className)} aria-live="polite">
            {display}
        </span>
    )
}
