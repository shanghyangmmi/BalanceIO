"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"

export interface KpiCardProps {
    title: string
    value: number
    format?: (value: number) => string
    icon: React.ElementType
    /** Accent color family, e.g. "emerald" | "blue" | "rose" | "orange" */
    accent: "emerald" | "blue" | "rose" | "orange"
    valueClassName?: string
    footer?: React.ReactNode
}

const ACCENTS = {
    emerald: {
        border: "border-l-emerald-500",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/20",
        iconText: "text-emerald-600",
        glow: "from-emerald-500/10",
    },
    blue: {
        border: "border-l-blue-500",
        iconBg: "bg-blue-100 dark:bg-blue-900/20",
        iconText: "text-blue-600",
        glow: "from-blue-500/10",
    },
    rose: {
        border: "border-l-rose-500",
        iconBg: "bg-rose-100 dark:bg-rose-900/20",
        iconText: "text-rose-600",
        glow: "from-rose-500/10",
    },
    orange: {
        border: "border-l-orange-500",
        iconBg: "bg-orange-100 dark:bg-orange-900/20",
        iconText: "text-orange-600",
        glow: "from-orange-500/10",
    },
} as const

/**
 * Bento-style KPI card with a spring-physics hover lift and an animated
 * NumberTicker value. The figure rolls up on load and on every data
 * refresh — the dashboard feels alive without a single manual reload.
 */
export function KpiCard({
    title,
    value,
    format,
    icon: Icon,
    accent,
    valueClassName,
    footer,
}: KpiCardProps) {
    const a = ACCENTS[accent]

    return (
        <motion.div
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="h-full"
        >
            <Card
                className={cn(
                    "h-full border-l-4 overflow-hidden relative group hover:shadow-lg transition-shadow duration-300",
                    a.border
                )}
            >
                <div
                    className={cn(
                        "absolute right-0 top-0 h-24 w-24 bg-gradient-to-br to-transparent -mr-6 -mt-6 rounded-full group-hover:scale-150 transition-transform duration-500",
                        a.glow
                    )}
                />
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                    </CardTitle>
                    <div
                        className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center",
                            a.iconBg
                        )}
                    >
                        <Icon className={cn("h-4 w-4", a.iconText)} />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className={cn("text-2xl font-bold font-money", valueClassName)}>
                        <NumberTicker value={value} format={format} />
                    </div>
                    {footer && (
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            {footer}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    )
}
