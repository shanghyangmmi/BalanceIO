"use client"

import { motion } from "framer-motion"

/**
 * Dashboard page transitions. Next.js remounts template.tsx on every
 * navigation, giving each page a physics-based entrance. Kept subtle
 * (8px rise, spring-damped) so it reads as "fluid", never "slow" —
 * the animation settles in ~250ms, well under perceived-latency budgets.
 */
export default function DashboardTemplate({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{
                type: "spring",
                stiffness: 380,
                damping: 32,
                mass: 0.6,
            }}
        >
            {children}
        </motion.div>
    )
}
