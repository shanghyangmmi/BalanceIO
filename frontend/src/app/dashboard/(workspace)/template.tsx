"use client"

import { motion, useReducedMotion } from "framer-motion"
import { EASE_HOUSE } from "@/lib/motion"

/**
 * Dashboard page transitions. Next.js remounts template.tsx on every
 * navigation. A 6px rise on the house curve, opacity and transform only:
 * a blur filter here used to leave every screen looking out of focus for
 * the first few frames, which reads as a rendering fault in a ledger.
 */
export default function DashboardTemplate({
    children,
}: {
    children: React.ReactNode
}) {
    const reduce = useReducedMotion()
    return (
        <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE_HOUSE }}
        >
            {children}
        </motion.div>
    )
}
