"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronLeft, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { SPRING } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { ModuleStatus } from "@/hooks/use-module-health"
import { MODULE_STATUS_TONE } from "@/components/dashboard/module-hub/module-card"

/**
 * The head of a module dashboard.
 *
 * The status line here is the server's, unedited. A module page that
 * phrased the same state differently from the hub card would leave the
 * reader deciding which screen to believe.
 *
 * Shared rather than written per module: the hub's argument is that five
 * modules answer one question, and that only holds if their pages look
 * like siblings.
 */

export function ModuleMasthead({
  moduleName,
  title,
  accent,
  lede,
  status,
  headline,
  detail,
  asOf,
  isFetching,
  onRefresh,
}: {
  /** Shown in the trail, and the module this page belongs to. */
  moduleName: string
  title: string
  /** The one italic gradient span, per DESIGN-SYSTEM.md §3. */
  accent: string
  lede: string
  status?: ModuleStatus
  headline?: string
  detail?: string | null
  /** Local time the figures were computed. */
  asOf?: string | null
  isFetching: boolean
  onRefresh: () => void
}) {
  const reduce = useReducedMotion()
  const tone = status ? MODULE_STATUS_TONE[status] : null

  const rise = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: SPRING.soft },
  }

  return (
    <motion.header variants={rise} className="space-y-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" strokeWidth={2} />
          Module hub
        </Link>
        <span aria-hidden className="text-muted-foreground/40">
          /
        </span>
        <span className="text-foreground">{moduleName}</span>
      </div>

      <div className="space-y-5">
        <h1 className="font-display max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}{" "}
          {/* box-decoration-clone, or the padding lands only on the last
              line and the italic descender is clipped where it wraps. */}
          <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
            {accent}
          </span>
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{lede}</p>
      </div>

      <div className="space-y-4">
        <div className="h-px bg-foreground/10" />

        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 space-y-1.5">
            {tone && headline ? (
              <>
                <div className="flex items-center gap-3">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
                  <span className="text-sm font-medium text-foreground">{headline}</span>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.16em]",
                      tone.text,
                    )}
                  >
                    {tone.label}
                  </span>
                </div>
                {detail && (
                  <p className="pl-5 text-[13px] leading-relaxed text-muted-foreground">
                    {detail}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Skeleton className="h-2 w-2 rounded-full" />
                <Skeleton className="h-4 w-52" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {asOf && (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                As of {asOf}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onRefresh}
              disabled={isFetching}
              className="h-8 gap-2 rounded-full border-foreground/10 bg-card/60 px-3 text-xs backdrop-blur-sm"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
              Recheck
            </Button>
          </div>
        </div>

        <div className="h-px bg-foreground/10" />
      </div>
    </motion.header>
  )
}
