"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ArrowUpRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"

/**
 * The working screens of a module.
 *
 * These are plain doors and are labelled as such — no status, no figure
 * dressed up as one. The state of the module is stated once, at the top of
 * the page; repeating it in a lower key here would only invite the reader
 * to compare two versions of the same fact.
 */

export interface Door {
  label: string
  description: string
  href: string
  icon: LucideIcon
  /** Optional live count, e.g. the number of accounts behind a CoA door. */
  meta?: string
}

export function ModuleDoors({ doors }: { doors: Door[] }) {
  const reduce = useReducedMotion()

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {doors.map((door) => (
        <motion.div
          key={door.href}
          variants={{
            hidden: { opacity: 0, y: reduce ? 0 : 10 },
            show: { opacity: 1, y: 0, transition: SPRING.medium },
          }}
          whileHover={reduce ? undefined : { y: -2, transition: SPRING.snappy }}
        >
          <Link
            href={door.href}
            className={cn(
              "group flex h-full flex-col gap-3 rounded-xl border border-foreground/10 bg-card/60 p-5 backdrop-blur-sm",
              "transition-colors duration-300 hover:border-foreground/20 hover:bg-card/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <door.icon
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                strokeWidth={1.75}
              />
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                strokeWidth={1.75}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{door.label}</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {door.description}
              </p>
            </div>

            {door.meta && (
              <div className="mt-auto pt-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {door.meta}
                </span>
              </div>
            )}
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
