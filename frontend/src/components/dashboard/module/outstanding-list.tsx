"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"
import { MODULE_STATUS_TONE } from "@/components/dashboard/module-hub/module-card"
import type { OutstandingItem } from "@/hooks/use-module-health"

/**
 * The work left, worst first.
 *
 * This is the reason a module dashboard exists. A page of metrics tells the
 * reader what is true and leaves them to work out what to do about it; this
 * one starts from what to do. Every row carries the door to do it behind.
 *
 * The list is server-ordered. Re-sorting it here would mean the frontend
 * held an opinion about which accounting problem is worse, which is exactly
 * the judgement that belongs on the other side of the API.
 */

export function OutstandingList({
  items,
  emptyTitle,
  emptyDetail,
}: {
  items: OutstandingItem[]
  emptyTitle: string
  emptyDetail: string
}) {
  const reduce = useReducedMotion()

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-foreground/10 bg-card/60 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-600/30 dark:border-emerald-400/30">
            <Check className="h-3 w-3 text-emerald-700 dark:text-emerald-400" strokeWidth={2.5} />
          </span>
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        </div>
        <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
          {emptyDetail}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/10 bg-card/60 backdrop-blur-sm">
      {items.map((item, i) => {
        const tone = MODULE_STATUS_TONE[item.severity]

        const row = (
          <div className="flex items-start gap-4 p-5 sm:px-6">
            <span className={cn("mt-[0.4rem] h-2 w-2 shrink-0 rounded-full", tone.dot)} />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    tone.text,
                  )}
                >
                  {tone.label}
                </span>
              </div>

              {item.detail && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              )}
            </div>

            {item.href && item.actionLabel && (
              <span className="hidden shrink-0 items-center gap-1.5 pt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors group-hover:text-foreground sm:flex">
                {item.actionLabel}
                <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            )}
          </div>
        )

        return (
          <motion.div
            key={item.key}
            variants={{
              hidden: { opacity: 0, y: reduce ? 0 : 10 },
              show: { opacity: 1, y: 0, transition: SPRING.medium },
            }}
            className={cn(i > 0 && "border-t border-foreground/10")}
          >
            {item.href ? (
              <Link
                href={item.href}
                className="group block transition-colors hover:bg-foreground/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
              >
                {row}
              </Link>
            ) : (
              row
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
