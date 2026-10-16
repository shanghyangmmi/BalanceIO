"use client"

import Link from "next/link"
import { Lock } from "lucide-react"

/**
 * What a module page shows when the plan does not include it.
 *
 * Reached because the endpoint answered 402, not because the frontend
 * decided to hide something. Typing the URL directly lands here too, which
 * is the point: the hub draws the lock, the API is the lock.
 */
export function ModuleLocked({ moduleName }: { moduleName: string }) {
  return (
    <div className="rounded-xl border border-dashed border-foreground/15 bg-card/60 p-6 backdrop-blur-sm sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-foreground/15">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} />
        </span>
        <p className="text-sm font-medium text-foreground">
          {moduleName} is not included in your plan.
        </p>
      </div>

      <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
        Nothing has been removed from your books. {moduleName} posts to the same ledger as
        everything else — this door is simply closed until the module is added to the
        company&rsquo;s plan.
      </p>

      <Link
        href="/dashboard/settings/subscription"
        className="mt-6 inline-flex h-8 items-center rounded-full border border-foreground/10 bg-card/60 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-foreground/25"
      >
        Add to plan
      </Link>
    </div>
  )
}

/** True when an apiClient error came from the entitlement guard. */
export function isModuleLocked(error: unknown) {
  return error instanceof Error && error.message.includes("ERR_402")
}
