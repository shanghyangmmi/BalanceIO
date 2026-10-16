"use client"

import * as React from "react"

import { adminApiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  useSaveSetting,
  useServerMetrics,
  useSystemSettings,
  type SystemSetting,
} from "@/hooks/use-admin"
import {
  DangerPanel,
  duration,
  Empty,
  ErrorNote,
  Masthead,
  Panel,
  Pill,
  SectionHeading,
  Sep,
} from "@/components/sys-control/admin-primitives"

/**
 * Server configuration.
 *
 * The page this replaces printed "Environment: Production" and "Database:
 * PostgreSQL / SQLite" as static text, next to a server time rendered from
 * the browser's own clock. All three were decoration — none of them was
 * read from the server, and the database line named both options because
 * the page did not know which was running.
 *
 * The settings below are real rows in SystemSettings, and the ones that
 * change behaviour say so in plain terms rather than by their key alone.
 */

/**
 * Keys the server actually reads, with the explanation that belongs beside
 * them. Anything not listed still appears, uncommented — a setting somebody
 * added should never become invisible because this map is out of date.
 */
const EXPLAINED: Record<string, { title: string; note: string; danger?: boolean }> = {
  JOURNAL_LIMIT_WINDOW: {
    title: "How the journal allowance is counted",
    note:
      "Month gives every plan a fresh allowance on the first — a tier somebody can stay on. " +
      "Total counts for the life of the company, which makes the free plan a trial that ends. " +
      "The plan's own MaxJournalEntries sets the number; this decides what it counts.",
  },
  ADMIN_SQL_WRITE_ENABLED: {
    title: "Write mode in the database console",
    note:
      "While this is true, an administrator can commit arbitrary SQL against production. " +
      "Turn it on for the operation you need and turn it off again — every statement is " +
      "recorded in the audit log either way, but a record is not a control.",
    danger: true,
  },
  MAINTENANCE_MODE: {
    title: "Maintenance mode",
    note: "Refuses ordinary requests while it is on. The admin panel keeps working.",
    danger: true,
  },
  ALLOW_SIGNUPS: {
    title: "Open registration",
    note: "Whether a new company can be created without an invitation.",
  },
  PAYMENT_GATEWAY_ENABLED: {
    title: "Payment gateway",
    note: "Whether subscriptions can be paid for in-product rather than recorded by hand.",
  },
}

export default function ConfigurationPage() {
  const settings = useSystemSettings()
  const metrics = useServerMetrics(false)
  const save = useSaveSetting()
  const [initialising, setInitialising] = React.useState(false)

  // Only for the environment card, which does not need to be live.
  React.useEffect(() => {
    metrics.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const m = metrics.data

  const initialise = async () => {
    setInitialising(true)
    try {
      await adminApiClient.post("/admin/settings/init", {})
      await settings.refetch()
      toast.success("Defaults created", {
        description: "Any setting that was missing now exists with its default value.",
      })
    } catch (error) {
      toast.error("Could not create the defaults", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setInitialising(false)
    }
  }

  return (
    <div className="space-y-10 pb-16">
      <Masthead
        title="Server"
        accent="configuration."
        lede="Settings the server reads at run time. Changing one takes effect on the next request that consults it — there is no deployment involved and no restart needed."
        actions={
          <Button variant="outline" size="sm" onClick={initialise} disabled={initialising}>
            {initialising ? "Creating…" : "Create missing defaults"}
          </Button>
        }
      />

      {/* ── What is actually running ─────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading>This instance</SectionHeading>

        <Panel className="p-5 sm:p-6">
          <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
            {[
              ["Machine", m?.machineName],
              ["Operating system", m?.operatingSystem],
              ["Framework", m?.runtime],
              ["Processors", m ? `${m.processorCount} vCPU` : undefined],
              ["Started", m ? new Date(m.processStartedAt).toLocaleString("en-GB") : undefined],
              ["Uptime", m ? duration(m.uptimeSeconds) : undefined],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-6">
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </dt>
                <dd className="min-w-0 truncate text-right text-foreground">
                  {value ?? <Skeleton className="ml-auto h-3 w-28" />}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </section>

      {/* ── Settings ─────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <SectionHeading note={settings.data ? `${settings.data.length} setting(s)` : undefined}>
          Settings
        </SectionHeading>

        {settings.isError ? (
          <ErrorNote
            message={settings.error instanceof Error ? settings.error.message : undefined}
            onRetry={() => settings.refetch()}
          />
        ) : settings.isPending ? (
          <Panel className="space-y-4 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </Panel>
        ) : settings.data.length === 0 ? (
          <Empty title="No settings exist yet.">
            Press &ldquo;Create missing defaults&rdquo; above. Until a row exists, each of these
            falls back to its built-in value — which is the safe one in every case.
          </Empty>
        ) : (
          <div className="space-y-3">
            {settings.data.map((setting) => (
              <SettingRow
                key={setting.key}
                setting={setting}
                onSave={async (value) => {
                  await save.mutateAsync({ ...setting, value })
                  toast.success(setting.key, { description: `Set to ${value}.` })
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── The one that needs saying out loud ───────────────────────── */}
      <section className="space-y-5">
        <SectionHeading>Journal allowances</SectionHeading>

        <Panel className="p-5 sm:p-6">
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            How many journal entries a plan allows is set per plan, on the{" "}
            <a
              href="/sys-control/licensing"
              className="text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-400"
            >
              plans and pricing
            </a>{" "}
            screen. Whether that number is counted per month or over the life of the company is
            the JOURNAL_LIMIT_WINDOW setting above.
          </p>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            These limits were stored but never checked until this release. Companies already past
            a ceiling will be refused on their next journal, so look at who is affected before
            tightening anything.
          </p>
        </Panel>
      </section>
    </div>
  )
}

function SettingRow({
  setting,
  onSave,
}: {
  setting: SystemSetting
  onSave: (value: string) => Promise<void>
}) {
  const meta = EXPLAINED[setting.key]
  const isBool = setting.dataType === "bool"
  const [value, setValue] = React.useState(setting.value)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => setValue(setting.value), [setting.value])

  const dirty = value !== setting.value
  const on = setting.value?.toLowerCase() === "true"
  const Shell = meta?.danger && on ? DangerPanel : Panel

  const commit = async (next: string) => {
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">{meta?.title ?? setting.key}</h3>
            {meta?.danger && on && <Pill tone="bad">On</Pill>}
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {setting.key}
            <Sep />
            {setting.dataType}
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
            {meta?.note ?? setting.description ?? "No description was recorded for this setting."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isBool ? (
            <Button
              variant={on ? "destructive" : "outline"}
              size="sm"
              disabled={saving}
              onClick={() => commit(on ? "false" : "true")}
            >
              {saving ? "Saving…" : on ? "Turn off" : "Turn on"}
            </Button>
          ) : (
            <>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="font-money w-48 rounded-lg border border-foreground/15 bg-transparent px-3 py-1.5 text-[13px] text-foreground focus:border-foreground/30 focus:outline-none"
              />
              <Button size="sm" disabled={!dirty || saving} onClick={() => commit(value)}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Shell>
  )
}
