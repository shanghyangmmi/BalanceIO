"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  useBackups,
  useJobs,
  useRunBackup,
  useRunJob,
  useServerMetrics,
  useUpdateJob,
  type ScheduledJob,
} from "@/hooks/use-admin"
import { adminApiClient } from "@/lib/api-client"
import {
  bytes,
  DangerPanel,
  duration,
  Empty,
  ErrorNote,
  Figure,
  FigureStrip,
  Masthead,
  Meter,
  Panel,
  Pill,
  relativeTime,
  Row,
  SectionHeading,
  Sep,
  StatusDot,
  TableShell,
  Td,
  Th,
  type StatusTone,
} from "@/components/sys-control/admin-primitives"

/**
 * What the server is doing, what it does on a schedule, and what it has
 * kept.
 *
 * Three things on one page because they are one question. "Is this
 * instance healthy" is not answered by CPU alone: a box at 12% CPU whose
 * backup last succeeded eleven days ago is in worse shape than a busy one.
 */
export default function OperationsPage() {
  const [live, setLive] = React.useState(true)
  const metrics = useServerMetrics(live)
  const jobs = useJobs()
  const backups = useBackups()

  const runJob = useRunJob()
  const runBackup = useRunBackup()

  const m = metrics.data

  return (
    <div className="space-y-10 pb-16">
      <Masthead
        title="Server"
        accent="operations."
        lede="Load on this instance, the work it does on its own, and the snapshots it has kept. Figures are sampled from the running process, not from configuration."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLive((v) => !v)}
            className="font-mono text-[10px] uppercase tracking-[0.16em]"
          >
            <StatusDot tone={live ? "good" : "idle"} />
            <span className="ml-2">{live ? "Live" : "Paused"}</span>
          </Button>
        }
      />

      {/* ── Load ─────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading
          note={
            m
              ? `${m.machineName} · ${m.processorCount} vCPU · up ${duration(m.uptimeSeconds)}`
              : undefined
          }
        >
          Load
        </SectionHeading>

        {metrics.isError ? (
          <ErrorNote
            message={metrics.error instanceof Error ? metrics.error.message : undefined}
            onRetry={() => metrics.refetch()}
          />
        ) : (
          <>
            <FigureStrip>
              <Figure
                label="CPU"
                pending={metrics.isPending}
                value={
                  m?.cpuPercent === null || m?.cpuPercent === undefined
                    ? "—"
                    : `${m.cpuPercent.toFixed(1)}%`
                }
                tone={
                  m?.cpuPercent == null
                    ? "text-muted-foreground"
                    : m.cpuPercent >= 85
                      ? "text-red-600 dark:text-red-400"
                      : m.cpuPercent >= 60
                        ? "text-amber-700 dark:text-amber-400"
                        : undefined
                }
                note={
                  m?.cpuPercent == null ? "Waiting for a second sample" : "Share of the machine"
                }
              />
              <Figure
                label="Memory"
                pending={metrics.isPending}
                value={m ? `${m.workingSetMB.toLocaleString("en-GB")} MB` : "—"}
                tone={
                  m?.memoryPercent != null && m.memoryPercent >= 85
                    ? "text-amber-700 dark:text-amber-400"
                    : undefined
                }
                note={
                  m?.machineMemoryMB
                    ? `${m.memoryPercent?.toFixed(1)}% of ${(m.machineMemoryMB / 1024).toFixed(1)} GB`
                    : "Working set"
                }
              />
              <Figure
                label="Throughput"
                pending={metrics.isPending}
                value={m ? `${m.requestsPerSecond.toFixed(2)}/s` : "—"}
                note={m ? `${m.totalRequests.toLocaleString("en-GB")} since start` : undefined}
              />
              <Figure
                label="Response"
                pending={metrics.isPending}
                value={m ? `${m.averageResponseMs.toFixed(0)} ms` : "—"}
                tone={
                  m && m.totalServerErrors > 0 ? "text-amber-700 dark:text-amber-400" : undefined
                }
                note={
                  m
                    ? m.totalServerErrors === 0
                      ? "No server errors"
                      : `${m.totalServerErrors.toLocaleString("en-GB")} server error(s)`
                    : undefined
                }
              />
            </FigureStrip>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel className="p-5 sm:p-6">
                <SectionHeading>Disk</SectionHeading>
                <div className="mt-5 space-y-5">
                  {metrics.isPending ? (
                    <Skeleton className="h-10 w-full" />
                  ) : m?.drives.length ? (
                    m.drives.map((d) => (
                      <Meter
                        key={d.name}
                        label={`${d.name} ${d.format}`}
                        used={d.usedGB}
                        max={d.totalGB}
                        unit="GB"
                      />
                    ))
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      No mounted volume reported its size.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel className="p-5 sm:p-6">
                <SectionHeading>Runtime</SectionHeading>
                <dl className="mt-5 space-y-3 text-[13px]">
                  {[
                    ["Operating system", m?.operatingSystem],
                    ["Framework", m?.runtime],
                    ["Architecture", m?.architecture],
                    ["Threads", m ? String(m.threadCount) : undefined],
                    [
                      "Collections",
                      m ? `gen0 ${m.gen0Collections} · gen1 ${m.gen1Collections} · gen2 ${m.gen2Collections}` : undefined,
                    ],
                    ["Managed heap", m ? `${m.managedHeapMB.toLocaleString("en-GB")} MB` : undefined],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex items-baseline justify-between gap-6">
                      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="min-w-0 truncate text-right text-foreground">
                        {value ?? <Skeleton className="ml-auto h-3 w-24" />}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </div>
          </>
        )}
      </section>

      {/* ── Schedule ─────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note={jobs.data ? `${jobs.data.jobs.length} job(s)` : undefined}>
          Schedule
        </SectionHeading>

        {jobs.isError ? (
          <ErrorNote
            message={jobs.error instanceof Error ? jobs.error.message : undefined}
            onRetry={() => jobs.refetch()}
          />
        ) : jobs.isPending ? (
          <Panel className="space-y-4 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </Panel>
        ) : jobs.data.jobs.length === 0 ? (
          <Empty title="No jobs are registered yet.">
            The schedule seeds itself shortly after the server starts. If this stays empty, the
            background runner did not come up.
          </Empty>
        ) : (
          <div className="space-y-3">
            {jobs.data.jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onRun={async () => {
                  try {
                    const run = await runJob.mutateAsync(job.id)
                    if (run.status === "Success") {
                      toast.success(job.name, { description: run.message ?? "Done." })
                    } else {
                      toast.error(job.name, { description: run.message ?? "It failed." })
                    }
                  } catch (error) {
                    toast.error("Could not start the job", {
                      description: error instanceof Error ? error.message : undefined,
                    })
                  }
                }}
                running={runJob.isPending && runJob.variables === job.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── The service itself ───────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading>The service</SectionHeading>
        <ServiceControls />
      </section>

      {/* ── Backups ──────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading
          note={
            backups.data
              ? `keeping ${backups.data.retention} · ${backups.data.files.length} on disk`
              : undefined
          }
        >
          Backups
        </SectionHeading>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={runBackup.isPending}
            onClick={async () => {
              try {
                const result = await runBackup.mutateAsync()
                toast.success("Backup taken", { description: (result as any)?.message })
              } catch (error) {
                toast.error("Backup failed", {
                  description: error instanceof Error ? error.message : undefined,
                })
              }
            }}
          >
            {runBackup.isPending ? "Taking a snapshot…" : "Back up now"}
          </Button>
          {backups.data && (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {backups.data.directory}
            </span>
          )}
        </div>

        {backups.isError ? (
          <ErrorNote
            message={backups.error instanceof Error ? backups.error.message : undefined}
            onRetry={() => backups.refetch()}
          />
        ) : backups.data && backups.data.files.length === 0 ? (
          <Empty title="Nothing has been backed up yet.">
            The nightly job writes here, or press the button above. On PostgreSQL this needs
            pg_dump installed on the host — if it is missing, the job will say so rather than
            writing an empty file.
          </Empty>
        ) : (
          <TableShell
            minWidth="34rem"
            head={
              <>
                <Th>File</Th>
                <Th align="right">Size</Th>
                <Th align="right">Taken</Th>
              </>
            }
          >
            {(backups.data?.files ?? []).map((f, i) => (
              <Row key={f.fileName} index={i}>
                <Td mono>{f.fileName}</Td>
                <Td align="right">{bytes(f.sizeBytes)}</Td>
                <Td align="right" className="text-muted-foreground">
                  {relativeTime(f.createdAt)}
                </Td>
              </Row>
            ))}
          </TableShell>
        )}
      </section>
    </div>
  )
}

function JobCard({
  job,
  onRun,
  running,
}: {
  job: ScheduledJob
  onRun: () => void
  running: boolean
}) {
  const update = useUpdateJob()
  const [interval, setInterval] = React.useState(String(job.intervalMinutes))

  const tone: StatusTone = !job.isEnabled
    ? "idle"
    : job.lastStatus === "Failed"
      ? "bad"
      : job.consecutiveFailures > 0
        ? "warn"
        : job.lastStatus === "Success"
          ? "good"
          : "idle"

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-xl">
          <div className="flex items-center gap-2">
            <StatusDot tone={tone} />
            <h3 className="text-sm font-medium text-foreground">{job.name}</h3>
            {!job.isEnabled && <Pill>Off</Pill>}
            {job.consecutiveFailures > 0 && (
              <Pill tone="bad">
                {job.consecutiveFailures} failure{job.consecutiveFailures === 1 ? "" : "s"}
              </Pill>
            )}
          </div>

          {job.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {job.description}
            </p>
          )}

          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Last {relativeTime(job.lastRunAt)}
            <Sep />
            Next{" "}
            {job.isEnabled
              ? job.nextRunAt
                ? new Date(job.nextRunAt).toLocaleString("en-GB")
                : "on the next sweep"
              : "not scheduled"}
          </p>

          {job.lastMessage && (
            <p
              className={cn(
                "mt-2 text-[13px] leading-relaxed",
                job.lastStatus === "Failed"
                  ? "text-red-700 dark:text-red-400"
                  : "text-muted-foreground",
              )}
            >
              {job.lastMessage}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Every
            </span>
            <input
              value={interval}
              onChange={(e) => setInterval(e.target.value.replace(/\D/g, ""))}
              onBlur={() => {
                const minutes = Number(interval)
                if (!minutes || minutes === job.intervalMinutes) {
                  setInterval(String(job.intervalMinutes))
                  return
                }
                update.mutate({
                  id: job.id,
                  isEnabled: job.isEnabled,
                  intervalMinutes: minutes,
                  preferredMinuteOfDay: job.preferredMinuteOfDay,
                })
              }}
              inputMode="numeric"
              className="font-money w-16 rounded-md border border-foreground/15 bg-transparent px-2 py-1 text-right text-[13px] tabular-nums text-foreground focus:border-foreground/30 focus:outline-none"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              min
            </span>
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              update.mutate({
                id: job.id,
                isEnabled: !job.isEnabled,
                intervalMinutes: job.intervalMinutes,
                preferredMinuteOfDay: job.preferredMinuteOfDay,
              })
            }
          >
            {job.isEnabled ? "Disable" : "Enable"}
          </Button>

          <Button variant="outline" size="sm" onClick={onRun} disabled={running}>
            {running ? "Running…" : "Run now"}
          </Button>
        </div>
      </div>
    </Panel>
  )
}

/**
 * Maintenance mode and restart.
 *
 * Both reach every tenant at once, so both sit inside the red border and
 * neither is a single click. Restart writes a trigger file the host watches
 * — it does not kill the process from inside itself, which would leave the
 * response half-written and the operator unsure whether it worked.
 */
function ServiceControls() {
  const [maintenance, setMaintenance] = React.useState<boolean | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    adminApiClient
      .get<{ enabled?: boolean; maintenanceMode?: boolean }>("/admin/system/maintenance")
      .then((state) => setMaintenance(state.enabled ?? state.maintenanceMode ?? false))
      .catch(() => setMaintenance(null))
  }, [])

  const toggle = async () => {
    setBusy(true)
    try {
      const next = !maintenance
      await adminApiClient.post("/admin/system/maintenance", { enabled: next })
      setMaintenance(next)
      toast.success(next ? "Maintenance mode on" : "Maintenance mode off", {
        description: next
          ? "Ordinary requests are refused. This panel keeps working."
          : "The application is serving again.",
      })
    } catch (error) {
      toast.error("Could not change maintenance mode", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const restart = async () => {
    const typed = window.prompt(
      "Restarting disconnects everyone for about a minute.\n\nType RESTART to confirm:",
    )
    if (typed !== "RESTART") {
      if (typed !== null) toast.error("That did not match. Nothing was restarted.")
      return
    }

    setBusy(true)
    try {
      const result = await adminApiClient.post<{ message?: string }>(
        "/admin/system/restart",
        {},
      )
      toast.success("Restart requested", { description: result?.message })
    } catch (error) {
      toast.error("Could not request a restart", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <DangerPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="max-w-xl space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-foreground">Maintenance mode</h3>
              {maintenance && <Pill tone="bad">On</Pill>}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Refuses ordinary requests while it is on. This panel keeps working, so you can
              turn it back off.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Restart the service</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              Writes a trigger file the host watches. Everyone is disconnected for roughly a
              minute, and anything half-typed is lost.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <Button
            variant={maintenance ? "destructive" : "outline"}
            size="sm"
            disabled={busy || maintenance === null}
            onClick={toggle}
          >
            {maintenance === null
              ? "Unavailable"
              : maintenance
                ? "Turn maintenance off"
                : "Turn maintenance on"}
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={restart}>
            Restart
          </Button>
        </div>
      </div>
    </DangerPanel>
  )
}
