"use client"

import * as React from "react"
import {
    motion,
    useMotionValue,
    useSpring,
    useMotionTemplate,
} from "framer-motion"

/**
 * Global ambient cursor light — a soft emerald radial glow that trails
 * the pointer across the whole page (Linear/Stripe-style). One fixed,
 * pointer-events-none layer; springed so it glides, never jitters.
 * Hidden on touch devices (no hover) for zero wasted work.
 */
export function AmbientCursor() {
    const x = useMotionValue(-600)
    const y = useMotionValue(-600)
    const sx = useSpring(x, { stiffness: 90, damping: 24, mass: 0.7 })
    const sy = useSpring(y, { stiffness: 90, damping: 24, mass: 0.7 })

    React.useEffect(() => {
        const move = (e: PointerEvent) => {
            x.set(e.clientX)
            y.set(e.clientY)
        }
        window.addEventListener("pointermove", move, { passive: true })
        return () => window.removeEventListener("pointermove", move)
    }, [x, y])

    const background = useMotionTemplate`radial-gradient(620px circle at ${sx}px ${sy}px, rgba(13,148,136,0.12), transparent 70%)`
    const backgroundDark = useMotionTemplate`radial-gradient(640px circle at ${sx}px ${sy}px, rgba(16,185,129,0.09), transparent 70%)`

    return (
        <>
            <motion.div
                aria-hidden
                style={{ background }}
                className="fixed inset-0 z-[3] pointer-events-none hidden [@media(hover:hover)]:block dark:[@media(hover:hover)]:hidden"
            />
            <motion.div
                aria-hidden
                style={{ background: backgroundDark }}
                className="fixed inset-0 z-[3] pointer-events-none hidden dark:[@media(hover:hover)]:block"
            />
        </>
    )
}
