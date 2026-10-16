"use client"

import Link from "next/link"
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Building2,
  Lock,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useModuleDoors, type ModuleDoor, type ModuleKey } from "@/hooks/use-module-doors"

/**
 * The hub.
 *
 * A list of doors, and nothing else. No figures, no balance state, no
 * summary strip — those belong to whichever module you walk into. A page
 * that is both a launcher and a report does neither job.
 *
 * The reason it is doors rather than one merged workspace is focus, not
 * data separation — the ledger underneath stays integrated. Someone doing
 * accounting should see accounting, and each further door is something the
 * company adds to its plan.
 *
 * Locks are drawn from GET /Dashboard/modules and enforced again by the
 * module endpoints, which answer 402 when the plan does not include them.
 *
 * There is no JavaScript animation on this page, deliberately.
 *
 * It used to open with a Framer Motion stagger, and the cards started at
 * opacity 0 waiting for it. Two things then went wrong at once. The
 * variants never reached them — Framer propagates variants only through
 * `motion` components and the grid and stack wrappers here are plain divs
 * — so every card stayed invisible; the three that were links appeared
 * when hovered, because whileHover forced an animation, and the locked one
 * never appeared at all, reading as a missing card rather than a stuck one.
 *
 * The deeper mistake was making content visibility depend on an animation
 * finishing. A launcher has to be on screen the instant it renders. Hover
 * feedback is a CSS transform transition, which the compositor handles
 * without a frame loop and which cannot leave anything hidden if it fails.
 */

const ICONS: Record<ModuleKey, LucideIcon> = {
  accounting: BookOpenCheck,
  tax: Receipt,
  inventory: Boxes,
  fixedAssets: Building2,
  payroll: Users,
}

export default function ModuleHubPage() {
  const { data, isPending, isError, error, refetch } = useModuleDoors()

  const primary = data?.doors.find((d) => d.primary)
  const rest = data?.doors.filter((d) => !d.primary) ?? []

  return (
    <div>
      <header className="mb-10 sm:mb-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Module hub
          </span>

          {data?.planName && (
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {data.planName} plan
            </span>
          )}
        </div>

        <h1 className="font-display mt-5 max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
          Where to{" "}
          <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
            work.
          </span>
        </h1>

        <div className="mt-7 h-px bg-gradient-to-r from-foreground/15 via-foreground/10 to-transparent" />
      </header>

      {isError ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-6">
          <p className="text-sm font-medium text-foreground">The module list is unavailable.</p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {error instanceof Error ? error.message : "The request did not complete."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            className="mt-4 h-8 rounded-full border-foreground/10 px-3 text-xs"
          >
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {primary && <Door door={primary} featured />}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rest.map((door) => (
              <Door key={door.key} door={door} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * What is inside, as a ruled list.
 *
 * Two earlier attempts were worse. Dot-separated text wrapped mid-list and
 * orphaned a separator at the start of a line. Chips wrapped as whole
 * words but left a ragged hole wherever the last row ran short — six items
 * across a wide column broke five-and-one.
 *
 * A list cannot leave a ragged edge: every row is full width, and the
 * column count is chosen rather than whatever happens to fit.
 */
function Contents({
  items,
  muted,
  columns = 1,
}: {
  items: string[]
  muted: boolean
  columns?: 1 | 2
}) {
  return (
    <ul
      className={cn(
        "grid gap-x-6",
        columns === 2 ? "sm:grid-cols-2" : "grid-cols-1",
      )}
    >
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "flex items-center gap-2.5 border-b border-foreground/[0.07] py-[7px] last:border-b-0",
            columns === 2 && "sm:[&:nth-last-child(2)]:border-b-0",
            "font-mono text-[10px] uppercase tracking-[0.12em]",
            muted ? "text-muted-foreground/60" : "text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "h-[3px] w-[3px] shrink-0 rounded-full",
              muted ? "bg-muted-foreground/30" : "bg-emerald-600/60 dark:bg-emerald-400/60",
            )}
          />
          <span className="truncate">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function Door({
  door,
  featured = false,
}: {
  door: ModuleDoor
  featured?: boolean
}) {
  const Icon = ICONS[door.key]
  const open = door.entitled && Boolean(door.href)

  const surface = cn(
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border",
    "transition-[border-color,background-color] duration-300",
    open
      ? "border-foreground/10 bg-card/70 hover:border-emerald-600/30 dark:hover:border-emerald-400/30"
      : "border-dashed border-foreground/20 bg-foreground/[0.02]",
    featured ? "p-6 sm:p-7" : "p-5",
  )

  const iconTile = (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border transition-colors",
        featured ? "h-11 w-11" : "h-9 w-9",
        open
          ? "border-emerald-600/20 bg-emerald-500/[0.07] dark:border-emerald-400/20"
          : "border-foreground/10 bg-foreground/[0.03]",
      )}
    >
      <Icon
        className={cn(
          featured ? "h-[1.15rem] w-[1.15rem]" : "h-4 w-4",
          open ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/60",
        )}
        strokeWidth={1.75}
      />
    </span>
  )

  const title = (
    <h2
      className={cn(
        "font-display font-bold leading-tight tracking-tight",
        featured ? "text-2xl" : "text-base",
        open ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {door.name}
    </h2>
  )

  const description = (
    <p
      className={cn(
        "leading-relaxed",
        featured ? "mt-2 max-w-md text-sm" : "mt-2 text-[12.5px]",
        open ? "text-muted-foreground" : "text-muted-foreground/70",
      )}
    >
      {door.description}
    </p>
  )

  const lockRow = !open && door.lockedReason && (
    <div className="mt-3.5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
        <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
        {door.lockedReason}
      </span>

      {/* Not built is not a sale. Only a plan lock gets an upgrade link. */}
      {door.implemented && (
        <Link
          href="/dashboard/settings/subscription"
          className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
        >
          Add to plan
        </Link>
      )}
    </div>
  )

  const body = (
    <>
      {/* A wash rather than a shadow: one opacity transition, no repaint. */}
      {open && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}

      {featured ? (
        // Two columns on lg: identity left, what is inside right. A card
        // this wide with everything stacked at the left edge reads as a
        // banner with a hole in it.
        <div className="relative flex flex-1 flex-col gap-6 lg:flex-row lg:items-center lg:gap-12">
          <div className="flex min-w-0 flex-1 gap-4">
            {iconTile}
            <div className="min-w-0">
              {title}
              {description}
              {lockRow}
            </div>
          </div>

          <div className="w-full lg:w-[46%] lg:shrink-0">
            <div className="mb-1 h-px bg-foreground/10 lg:hidden" />
            <Contents items={door.contents} muted={!open} columns={2} />
          </div>

          {open && (
            <ArrowRight
              className="hidden h-4 w-4 shrink-0 self-center text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 lg:block"
              strokeWidth={2}
            />
          )}
        </div>
      ) : (
        <>
          <div className="relative flex items-start justify-between gap-3">
            {iconTile}
            {open && (
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400"
                strokeWidth={2}
              />
            )}
          </div>

          <div className="relative mt-4">
            {title}
            {description}
          </div>

          <div className="relative mt-auto pt-5">
            <div className="h-px bg-foreground/10" />
            <div className="mt-3.5">
              <Contents items={door.contents} muted={!open} />
            </div>
            {lockRow}
          </div>
        </>
      )}
    </>
  )

  return (
    <div
      className={cn(
        "h-full transition-transform duration-300 ease-out motion-reduce:transition-none",
        open && "hover:-translate-y-[3px]",
        featured ? "" : "min-h-[15rem]",
      )}
    >
      {open ? (
        <Link
          href={door.href!}
          className={cn(
            surface,
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={surface} aria-disabled="true">
          {body}
        </div>
      )}
    </div>
  )
}
