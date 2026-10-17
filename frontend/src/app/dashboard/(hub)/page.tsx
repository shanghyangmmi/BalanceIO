"use client"

import Link from "next/link"
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Building2,
  Lock,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { formatModuleMoney } from "@/lib/utils/module-money"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MODULE_STATUS_TONE } from "@/components/dashboard/module-hub/module-card"
import { formatIsoDate } from "@/components/dashboard/module/module-primitives"
import { useModuleDoors, type ModuleDoor, type ModuleKey } from "@/hooks/use-module-doors"
import {
  useModuleHealth,
  type ModuleFigure,
  type ModuleHealth,
  type ModuleStatus,
} from "@/hooks/use-module-health"

/**
 * The hub: the general ledger and the four sub-ledgers that post into it.
 *
 * Accounting is drawn as the anchor because it is: every other module's
 * output is a journal entry. Each card carries its state rather than a
 * list of screens: status, the one sentence that explains it, and two
 * figures from GET /Dashboard/module-health.
 *
 * Two requests, rendered independently. Which doors open comes from
 * /Dashboard/modules and draws the cards at once; the figures fill fixed
 * slots when module-health answers, so nothing moves when they arrive.
 * Locks are enforced again by every module endpoint (402).
 *
 * No JavaScript animation, deliberately. A launcher whose cards wait on a
 * stagger to become visible has failed at being a launcher; hover feedback
 * is a CSS transform the compositor handles.
 */

const ICONS: Record<ModuleKey, LucideIcon> = {
  accounting: BookOpenCheck,
  tax: Receipt,
  inventory: Boxes,
  fixedAssets: Building2,
  payroll: Wallet,
}

/** What each module contributes to the general ledger. */
const POSTS: Record<ModuleKey, string> = {
  accounting: "Trial balance, period close",
  tax: "PPN settlement, withholding",
  inventory: "COGS, stock variance",
  fixedAssets: "Depreciation, amortisation",
  payroll: "Salary expense, PPh 21, BPJS",
}

export default function ModuleHubPage() {
  const doors = useModuleDoors()
  const health = useModuleHealth()

  const byKey = new Map<string, ModuleHealth>(health.data?.modules.map((m) => [m.key, m]) ?? [])
  const primary = doors.data?.doors.find((d) => d.primary)
  const rest = doors.data?.doors.filter((d) => !d.primary) ?? []

  const openDoors = doors.data?.doors.filter((d) => d.entitled) ?? []
  const overall = overallStatus(openDoors.map((d) => byKey.get(d.key)?.status))
  const asOf = health.dataUpdatedAt
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(health.dataUpdatedAt))
    : null

  return (
    <div>
      <header className="mb-10 sm:mb-12">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            Financial operations
          </span>
          <span className="min-h-[15px] font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {doors.data && (
              <>
                {doors.data.planName ? `${doors.data.planName} plan` : "No active plan"}
                {asOf && <span className="text-muted-foreground/60"> · as of {asOf}</span>}
              </>
            )}
          </span>
        </div>

        <h1 className="font-display mt-5 max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-[2.75rem]">
          One ledger,{" "}
          <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
            every operation.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Integrated accounting, tax compliance and sub-ledger operations. Inventory, fixed assets,
          payroll and tax each post to the general ledger; none keeps books of its own.
        </p>

        <div className="mt-7 flex min-h-[20px] flex-wrap items-center gap-x-6 gap-y-2">
          <div className="h-px flex-1 bg-gradient-to-r from-foreground/15 via-foreground/10 to-transparent" />
          {overall && (
            <span className={cn("inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]", MODULE_STATUS_TONE[overall].text)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", MODULE_STATUS_TONE[overall].dot)} />
              {OVERALL_LABEL[overall]}
            </span>
          )}
        </div>
      </header>

      {doors.isError ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-6">
          <p className="text-sm font-medium text-foreground">The module list is unavailable.</p>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {doors.error instanceof Error ? doors.error.message : "The request did not complete."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => doors.refetch()}
            className="mt-4 h-8 rounded-full border-foreground/10 px-3 text-xs"
          >
            Try again
          </Button>
        </div>
      ) : (
        <div>
          <SectionLabel>General ledger</SectionLabel>
          {primary ? (
            <AnchorCard door={primary} health={byKey.get(primary.key)} healthPending={health.isPending} />
          ) : (
            <Skeleton className="h-[188px] w-full rounded-2xl" />
          )}

          {/* The four feeds, drawn as lines into the ledger above. */}
          <div aria-hidden className="hidden h-8 grid-cols-4 lg:grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-center">
                <div className="w-px bg-gradient-to-b from-emerald-600/30 to-foreground/10 dark:from-emerald-400/30" />
              </div>
            ))}
          </div>

          <div className="mt-10 lg:mt-0">
            <SectionLabel className="lg:hidden">Sub-ledgers</SectionLabel>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {doors.isPending
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[264px] rounded-2xl" />)
                : rest.map((door) => (
                    <FeedCard key={door.key} door={door} health={byKey.get(door.key)} healthPending={health.isPending} />
                  ))}
            </div>
          </div>

          {health.isError && (
            <p className="mt-6 text-[12px] text-muted-foreground">
              Module figures are unavailable: {health.error instanceof Error ? health.error.message : "the request did not complete"}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

const OVERALL_LABEL: Record<ModuleStatus, string> = {
  balanced: "All modules in sync",
  attention: "Items awaiting review",
  overdue: "Action overdue",
  inactive: "No activity yet",
}

/** Worst of the open modules; a module with no activity never drags it down. */
function overallStatus(statuses: (ModuleStatus | undefined)[]): ModuleStatus | null {
  const known = statuses.filter((s): s is ModuleStatus => !!s)
  if (known.length === 0) return null
  for (const s of ["overdue", "attention", "balanced"] as const) {
    if (known.includes(s)) return s
  }
  return "inactive"
}

function SectionLabel({ children, className }: { children: string; className?: string }) {
  return (
    <h2 className={cn("mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground", className)}>
      {children}
    </h2>
  )
}

function formatFigure(f: ModuleFigure) {
  switch (f.format) {
    case "money":
      return formatModuleMoney(f.value, f.currency ?? "IDR")
    case "days":
      return `${f.value} ${f.value === 1 ? "day" : "days"}`
    case "date":
      return f.isoDate ? formatIsoDate(f.isoDate) : "—"
    default:
      return new Intl.NumberFormat("en-GB").format(f.value)
  }
}

function StatusLine({ status }: { status: ModuleStatus }) {
  const tone = MODULE_STATUS_TONE[status]
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em]", tone.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
      {tone.label}
    </span>
  )
}

function LockLine({ door }: { door: ModuleDoor }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
        {door.lockedReason ?? "Not in plan"}
      </span>
      {door.implemented && (
        <Link
          href="/dashboard/settings/subscription"
          className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
        >
          Add to plan
        </Link>
      )}
    </div>
  )
}

function IconTile({ icon: Icon, open, large }: { icon: LucideIcon; open: boolean; large?: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border",
        large ? "h-11 w-11" : "h-9 w-9",
        open
          ? "border-emerald-600/20 bg-emerald-500/[0.07] dark:border-emerald-400/20"
          : "border-foreground/10 bg-foreground/[0.03]",
      )}
    >
      <Icon
        className={cn(large ? "h-[1.15rem] w-[1.15rem]" : "h-4 w-4", open ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground/60")}
        strokeWidth={1.75}
      />
    </span>
  )
}

/** A card is a link only when its module is open; a locked card is a plain surface. */
function Surface({ door, className, children }: { door: ModuleDoor; className: string; children: React.ReactNode }) {
  const open = door.entitled && !!door.href
  const base = cn(
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-[border-color,transform] duration-300 ease-out motion-reduce:transition-none",
    open
      ? "border-foreground/10 bg-card/70 hover:-translate-y-[2px] hover:border-emerald-600/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:hover:border-emerald-400/30"
      : "border-dashed border-foreground/20 bg-foreground/[0.02]",
    className,
  )

  return open ? (
    <Link href={door.href!} className={base}>{children}</Link>
  ) : (
    <div className={base} aria-disabled="true">{children}</div>
  )
}

function AnchorCard({ door, health, healthPending }: { door: ModuleDoor; health?: ModuleHealth; healthPending: boolean }) {
  return (
    <Surface door={door} className="p-6 sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-10">
        <div className="flex min-w-0 flex-1 gap-4">
          <IconTile icon={ICONS[door.key]} open large />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">{door.name}</h3>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">Core</span>
            </div>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{door.description}</p>
            <div className="mt-4 min-h-[38px]">
              {health ? (
                <>
                  <StatusLine status={health.status} />
                  <p className="mt-1 text-[13px] text-foreground">{health.headline}</p>
                </>
              ) : healthPending ? (
                <>
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="mt-2 h-3.5 w-56" />
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid w-full grid-cols-1 divide-y divide-foreground/10 rounded-xl border border-foreground/10 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:w-[46%] lg:shrink-0">
          {[0, 1].map((i) => {
            const figure = health?.figures[i]
            return (
              <div key={i} className="flex min-h-[88px] flex-col justify-center p-4 sm:p-5">
                {figure ? (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{figure.label}</div>
                    <div className="font-money mt-2 text-lg text-foreground [overflow-wrap:anywhere] sm:text-xl">
                      {formatFigure(figure)}
                    </div>
                  </>
                ) : healthPending ? (
                  <>
                    <Skeleton className="h-2 w-16" />
                    <Skeleton className="mt-3 h-6 w-36" />
                  </>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">—</span>
                )}
              </div>
            )
          })}
        </div>

        <ArrowRight
          className="hidden h-4 w-4 shrink-0 self-center text-muted-foreground/30 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 lg:block"
          strokeWidth={2}
        />
      </div>

      <p className="mt-5 border-t border-foreground/10 pt-3.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {POSTS[door.key]}
      </p>
    </Surface>
  )
}

function FeedCard({ door, health, healthPending }: { door: ModuleDoor; health?: ModuleHealth; healthPending: boolean }) {
  const open = door.entitled && !!door.href
  // A locked module's figures are not shown even though the server computed them.
  const shown = open ? health : undefined

  return (
    <Surface door={door} className="min-h-[264px] p-5">
      <div className="flex items-start justify-between gap-3">
        <IconTile icon={ICONS[door.key]} open={open} />
        {open && (
          <ArrowRight
            className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400"
            strokeWidth={2}
          />
        )}
      </div>

      <h3 className={cn("font-display mt-4 text-base font-bold leading-tight tracking-tight", open ? "text-foreground" : "text-muted-foreground")}>
        {door.name}
      </h3>

      <div className="mt-2 min-h-[54px]">
        {!open ? (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground/80">{door.description}</p>
        ) : shown ? (
          <>
            <StatusLine status={shown.status} />
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-foreground">{shown.headline}</p>
          </>
        ) : healthPending ? (
          <>
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2 h-3 w-full" />
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{door.description}</p>
        )}
      </div>

      <div className="mt-auto pt-4">
        {open ? (
          <dl className="grid grid-cols-2 gap-3 border-t border-foreground/10 pt-3.5">
            {[0, 1].map((i) => {
              const figure = shown?.figures[i]
              return (
                <div key={i} className="min-h-[38px] min-w-0">
                  {figure ? (
                    <>
                      <dt className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{figure.label}</dt>
                      <dd className="font-money mt-1 text-[13px] text-foreground [overflow-wrap:anywhere]">
                        {formatFigure(figure)}
                      </dd>
                    </>
                  ) : healthPending ? (
                    <>
                      <Skeleton className="h-2 w-14" />
                      <Skeleton className="mt-2 h-3.5 w-20" />
                    </>
                  ) : null}
                </div>
              )
            })}
          </dl>
        ) : (
          <div className="border-t border-dashed border-foreground/15 pt-3.5">
            <LockLine door={door} />
          </div>
        )}
        <p className="mt-3 truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/80">
          Posts: {POSTS[door.key]}
        </p>
      </div>
    </Surface>
  )
}
