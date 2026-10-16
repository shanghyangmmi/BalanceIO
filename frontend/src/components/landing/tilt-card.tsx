"use client"

import * as React from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"
import { cn } from "@/lib/utils"

interface TiltCardProps {
    children: React.ReactNode
    className?: string
    /** Max tilt in degrees. Keep ≤ 8 for an enterprise feel. */
    max?: number
    /** Moving glare highlight that follows the cursor. */
    glare?: boolean
}

/**
 * 3D tilt card — the surface leans toward the cursor on springs and a
 * soft glare sweeps across it. Transform-only (GPU), settles instantly
 * on mouse leave. Wrap in a parent with [perspective:1000px].
 */
export function TiltCard({ children, className, max = 7, glare = true }: TiltCardProps) {
    const ref = React.useRef<HTMLDivElement>(null)
    const rx = useMotionValue(0)
    const ry = useMotionValue(0)
    const srx = useSpring(rx, { stiffness: 220, damping: 22, mass: 0.6 })
    const sry = useSpring(ry, { stiffness: 220, damping: 22, mass: 0.6 })
    const [spot, setSpot] = React.useState({ x: 50, y: 50, on: false })

    const onMouseMove = (e: React.MouseEvent) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        const px = (e.clientX - rect.left) / rect.width - 0.5
        const py = (e.clientY - rect.top) / rect.height - 0.5
        ry.set(px * max)
        rx.set(-py * max)
        setSpot({ x: (px + 0.5) * 100, y: (py + 0.5) * 100, on: true })
    }

    const onMouseLeave = () => {
        rx.set(0)
        ry.set(0)
        setSpot((s) => ({ ...s, on: false }))
    }

    return (
        <motion.div
            ref={ref}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            style={{ rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" }}
            className={cn("relative will-change-transform", className)}
        >
            {children}
            {glare && (
                <div
                    className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300 z-20"
                    style={{
                        opacity: spot.on ? 1 : 0,
                        background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.10), transparent 60%)`,
                    }}
                />
            )}
        </motion.div>
    )
}
