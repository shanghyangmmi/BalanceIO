"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useDatabaseOverview,
  useExecuteSql,
  useRunQuery,
  type QueryResult,
} from "@/hooks/use-admin"
import {
  DangerPanel,
  Empty,
  ErrorNote,
  Masthead,
  Panel,
  Pill,
  SectionHeading,
  Sep,
} from "@/components/sys-control/admin-primitives"

/**
 * The database console.
 *
 * Two modes, and the screen never lets you forget which one you are in.
 * Read is the default and is safe by construction — one statement, SELECT
 * or its relatives only, inside a transaction that is always rolled back.
 * Write is a separate mode behind a separate switch, and the whole surface
 * changes colour when it is on.
 *
 * The mode is not a checkbox tucked beside the button. Somebody debugging
 * at two in the morning should be unable to run a DELETE believing they
 * were running a SELECT.
 */
export default function DatabaseConsolePage() {
  const overview = useDatabaseOverview()
  const runQuery = useRunQuery()
  const execute = useExecuteSql()

  const [sql, setSql] = React.useState("")
  const [mode, setMode] = React.useState<"read" | "write">("read")
  const [confirm, setConfirm] = React.useState("")
  const [result, setResult] = React.useState<QueryResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const writeEnabled = overview.data?.writeEnabled ?? false
  const phrase = overview.data?.writeConfirmationPhrase ?? "I UNDERSTAND"
  const busy = runQuery.isPending || execute.isPending

  const run = async () => {
    setError(null)
    setResult(null)

    try {
      const outcome =
        mode === "read"
          ? await runQuery.mutateAsync(sql)
          : await execute.mutateAsync({ sql, confirm })

      setResult(outcome)
      if (mode === "write") setConfirm("")
    } catch (e) {
      // A refusal and a syntax error both arrive as a non-2xx. The message
      // carries the difference, and the message is the useful part.
      setError(e instanceof Error ? e.message : "That did not run.")
    }
  }

  return (
    <div className="space-y-10 pb-16">
      <Masthead
        title="Database"
        accent="console."
        lede="Reads run inside a rolled-back transaction and are capped. Writes are a separate mode, off unless enabled in settings, and every statement is recorded in the audit log before it runs."
        actions={
          overview.data ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {overview.data.provider?.split(".").pop()}
              <Sep />
              {overview.data.tables.length} tables
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        {/* ── The editor ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <ModeButton active={mode === "read"} onClick={() => setMode("read")}>
              Read
            </ModeButton>
            <ModeButton
              active={mode === "write"}
              danger
              disabled={!writeEnabled}
              onClick={() => setMode("write")}
            >
              Write
            </ModeButton>

            {!writeEnabled && (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Write is off — set {overview.data?.writeSettingKey ?? "ADMIN_SQL_WRITE_ENABLED"}{" "}
                in configuration
              </span>
            )}
          </div>

          {mode === "write" ? (
            <DangerPanel className="p-5 sm:p-6">
              <Editor sql={sql} onChange={setSql} onRun={run} danger />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={phrase}
                  className="font-mono w-52 rounded-md border border-red-500/30 bg-transparent px-3 py-1.5 text-[12px] tracking-[0.1em] text-foreground placeholder:text-muted-foreground/60 focus:border-red-500/60 focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy || !sql.trim() || confirm !== phrase}
                  onClick={run}
                >
                  {busy ? "Running…" : "Execute"}
                </Button>
                <p className="text-[13px] text-muted-foreground">
                  This commits. There is no undo and no confirmation after this point.
                </p>
              </div>
            </DangerPanel>
          ) : (
            <Panel className="p-5 sm:p-6">
              <Editor sql={sql} onChange={setSql} onRun={run} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button size="sm" disabled={busy || !sql.trim()} onClick={run}>
                  {busy ? "Running…" : "Run"}
                </Button>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Ctrl + Enter
                </span>
              </div>
            </Panel>
          )}

          {error && <ErrorNote message={error} />}

          {result && <Result result={result} />}

          {!result && !error && (
            <Empty title="Nothing has been run yet.">
              Pick a table on the right to start a query, or write your own. Reads are limited to
              500 rows and fifteen seconds.
            </Empty>
          )}
        </div>

        {/* ── Tables ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <SectionHeading>Tables</SectionHeading>

          {overview.isError ? (
            <ErrorNote
              message={overview.error instanceof Error ? overview.error.message : undefined}
              onRetry={() => overview.refetch()}
            />
          ) : overview.isPending ? (
            <Panel className="space-y-2 p-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </Panel>
          ) : (
            <Panel className="max-h-[32rem] overflow-y-auto">
              {overview.data.tables.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setSql(`SELECT * FROM "${t.name}" LIMIT 100;`)}
                  className={cn(
                    "flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-foreground/[0.04]",
                    i > 0 && "border-t border-foreground/10",
                  )}
                >
                  <span className="truncate font-mono text-[11px] text-foreground">{t.name}</span>
                  <span className="font-money shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {t.rowCount < 0 ? "—" : t.rowCount.toLocaleString("en-GB")}
                  </span>
                </button>
              ))}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}

function ModeButton({
  active,
  danger,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  danger?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors",
        disabled && "cursor-not-allowed opacity-40",
        active && !danger && "bg-foreground text-background",
        active && danger && "bg-red-600 text-white dark:bg-red-500",
        !active && "bg-foreground/[0.06] text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Editor({
  sql,
  onChange,
  onRun,
  danger,
}: {
  sql: string
  onChange: (v: string) => void
  onRun: () => void
  danger?: boolean
}) {
  return (
    <textarea
      value={sql}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault()
          onRun()
        }
      }}
      spellCheck={false}
      rows={8}
      placeholder={danger ? "UPDATE ..." : 'SELECT * FROM "Companies" LIMIT 100;'}
      className={cn(
        "w-full resize-y rounded-lg border bg-transparent p-4 font-mono text-[12.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
        danger
          ? "border-red-500/30 focus:border-red-500/60"
          : "border-foreground/15 focus:border-foreground/30",
      )}
    />
  )
}

function Result({ result }: { result: QueryResult }) {
  if (!result.success) {
    return (
      <ErrorNote
        message={result.message}
      />
    )
  }

  if (result.rowsAffected > 0 || result.columns.length === 0) {
    return (
      <Panel className="p-5 sm:p-6">
        <p className="text-sm text-foreground">{result.message}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {result.durationMs} ms
        </p>
      </Panel>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {result.message}
          <Sep />
          {result.durationMs} ms
        </span>
        {result.truncated && <Pill tone="warn">Truncated</Pill>}
      </div>

      <Panel className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-foreground/10">
              {result.columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-4 py-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className={cn(i > 0 && "border-t border-foreground/10")}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={cn(
                      "max-w-xs truncate px-4 py-2 align-top",
                      cell === null ? "text-muted-foreground/50" : "text-foreground",
                      typeof cell === "number" && "text-right tabular-nums",
                    )}
                    title={cell === null ? "null" : String(cell)}
                  >
                    {cell === null ? "null" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
