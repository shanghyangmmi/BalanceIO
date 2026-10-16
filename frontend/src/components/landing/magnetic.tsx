"use client"

import * as React from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"

/**
 * Magnetic wrapper — the element is gently attracted to the cursor while
 * hovered and springs back on leave. Pure transform, zero layout work.
 */
export function Magnetic({
    children,
    strength = 0.25,
}: {
    children: React.ReactNode
    strength?: number
}) {
    const ref = React.useRef<HTMLDivElement>(null)
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.5 })
    const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.5 })

    const onMouseMove = (e: React.MouseEvent) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        x.set((e.clientX - (rect.left + rect.width / 2)) * strength)
        y.set((e.clientY - (rect.top + rect.height / 2)) * strength)
    }

    const onMouseLeave = () => {
        x.set(0)
        y.set(0)
    }

    return (
        <motion.div
            ref={ref}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{ x: sx, y: sy }}
            className="inline-block"
        >
            {children}
        </motion.div>
    )
}
