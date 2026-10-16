"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useActivity, useActivityActions } from "@/hooks/use-admin"
import {
  Empty,
  ErrorNote,
  Masthead,
  Panel,
  Pill,
  relativeTime,
  Row,
  SectionHeading,
  Sep,
  TableShell,
  Td,
  Th,
} from "@/components/sys-control/admin-primitives"

/**
 * Everything that happened, across every tenant.
 *
 * The action filter is built from the data rather than a hard-coded list,
 * because the set grows whenever somebody audits a new operation, and a
 * stale list would quietly hide the newest ones - which are exactly the
 * ones a recent incident involves.
 */
export default function ActivityPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [action, setAction] = React.useState<string>("")

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const activity = useActivity({ page, pageSize: 50, search: debounced, action })
  const actions = useActivityActions()

  return (
    <div className="space-y-8 pb-16">
      <Masthead
        title="Platform"
        accent="activity."
        lede="Sign-ins, administrative actions and audited mutations across every company. This is the only screen that reads past the tenant boundary, and it does so deliberately."
        actions={
          activity.data ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {activity.data.total.toLocaleString("en-GB")} rows
            </span>
          ) : undefined
        }
      />

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search action, target, detail or address"
          className="w-full max-w-sm rounded-lg border border-foreground/15 bg-transparent px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
        />

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value)
            setPage(1)
          }}
          className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground focus:border-foreground/30 focus:outline-none"
        >
          <option value="">All actions</option>
          {(actions.data ?? []).map((a) => (
            <option key={a.action} value={a.action}>
              {a.action} ({a.count})
            </option>
          ))}
        </select>

        {(debounced || action) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("")
              setAction("")
              setPage(1)
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* ── The log ──────────────────────────────────────────────────── */}
      {activity.isError ? (
        <ErrorNote
          message={activity.error instanceof Error ? activity.error.message : undefined}
          onRetry={() => activity.refetch()}
        />
      ) : activity.isPending ? (
        <Panel className="space-y-3 p-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </Panel>
      ) : activity.data.rows.length === 0 ? (
        <Empty title="Nothing matches.">
          {debounced || action
            ? "Widen the filter, or clear it to see everything."
            : "The log fills as people sign in and post. An empty log on a running instance means auditing is not reaching the database."}
        </Empty>
      ) : (
        <>
          <TableShell
            minWidth="60rem"
            head={
              <>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>Who</Th>
                <Th>Company</Th>
                <Th>Detail</Th>
                <Th align="right">From</Th>
              </>
            }
          >
            {activity.data.rows.map((row, i) => (
              <Row key={row.id} index={i}>
                <Td className="whitespace-nowrap">
                  <div className="text-[13px] text-foreground">{relativeTime(row.timestamp)}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {new Date(row.timestamp).toLocaleString("en-GB")}
                  </div>
                </Td>
                <Td>
                  <ActionPill action={row.action} />
                </Td>
                <Td>
                  {row.userName ? (
                    <>
                      <div className="text-[13px] text-foreground">{row.userName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {row.userEmail}
                      </div>
                    </>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">system</span>
                  )}
                </Td>
                <Td className="text-[13px]">
                  {row.companyName ?? <span className="text-muted-foreground">—</span>}
                </Td>
                <Td className="max-w-sm">
                  <div className="truncate text-[13px] text-muted-foreground" title={row.details ?? ""}>
                    {row.targetEntity && (
                      <span className="font-mono text-[11px] text-foreground">
                        {row.targetEntity}
                        <Sep />
                      </span>
                    )}
                    {row.details}
                  </div>
                </Td>
                <Td align="right" mono>
                  {row.ipAddress ?? "—"}
                  {row.device && (
                    <div className="text-[10px] text-muted-foreground/70">
                      {row.device} · {row.operatingSystem}
                    </div>
                  )}
                </Td>
              </Row>
            ))}
          </TableShell>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Page {activity.data.page} of {activity.data.totalPages || 1}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= activity.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Colour carries meaning here as it does everywhere else: red for a
 * failure or a deletion, amber for something destructive that succeeded,
 * green for a sign-in that worked. Everything else stays neutral, or the
 * colour stops meaning anything.
 */
function ActionPill({ action }: { action: string }) {
  const tone =
    /FAIL|DENIED|ERROR/.test(action)
      ? "bad"
      : /DELETE|RESET|SUSPEND|SQL_EXECUTE/.test(action)
        ? "warn"
        : /SUCCESS|CREATED|RESTORE/.test(action)
          ? "good"
          : "idle"

  return (
    <Pill tone={tone as never}>
      <span className={cn("truncate")}>{action}</span>
    </Pill>
  )
}
