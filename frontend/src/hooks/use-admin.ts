"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { adminApiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/**
 * Server state for the sys-control panel.
 *
 * The panel's screens were written with useEffect and raw fetch, each one
 * holding its own loading flag and its own catch block that fell back to
 * empty data. That fallback is the reason the dashboard could show a
 * confident zero when the API was unreachable — an administrator reading
 * "0 companies" has no way to tell an empty platform from a broken one.
 *
 * Everything here goes through TanStack Query with the same retry rule the
 * rest of the application uses: a 4xx is an answer, not a fault, so it is
 * not retried.
 */

const keys = {
  metrics: ["admin", "metrics"] as const,
  jobs: ["admin", "jobs"] as const,
  backups: ["admin", "backups"] as const,
  database: ["admin", "database"] as const,
  matrix: ["admin", "licensing", "matrix"] as const,
  usage: ["admin", "licensing", "usage"] as const,
  settings: ["admin", "settings"] as const,
}

// ── Load ───────────────────────────────────────────────────────────────

export interface ServerMetrics {
  machineName: string
  operatingSystem: string
  runtime: string
  architecture: string
  processorCount: number
  processStartedAt: string
  uptimeSeconds: number
  cpuPercent: number | null
  threadCount: number
  workingSetMB: number
  managedHeapMB: number
  machineMemoryMB: number | null
  memoryPercent: number | null
  gen0Collections: number
  gen1Collections: number
  gen2Collections: number
  totalRequests: number
  totalServerErrors: number
  averageResponseMs: number
  requestsPerSecond: number
  drives: {
    name: string
    format: string
    totalGB: number
    freeGB: number
    usedGB: number
    usedPercent: number
  }[]
}

/**
 * Polled rather than fetched once. CPU is a ratio between two samples, so
 * the first reading after a cold start is null by design — leaving it on
 * screen would look like a bug rather than a measurement that does not
 * exist yet.
 */
export function useServerMetrics(enabled = true) {
  return useQuery({
    queryKey: keys.metrics,
    queryFn: () => adminApiClient.get<ServerMetrics>("/admin/operations/metrics"),
    refetchInterval: enabled ? 5000 : false,
    staleTime: 0,
    retry: retryUnlessClientError,
    enabled,
  })
}

// ── Schedule ───────────────────────────────────────────────────────────

export interface ScheduledJob {
  id: string
  jobKey: string
  name: string
  description?: string
  intervalMinutes: number
  preferredMinuteOfDay: number | null
  isEnabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastStatus: string | null
  lastMessage: string | null
  consecutiveFailures: number
}

export interface JobRun {
  id: string
  scheduledJobId: string
  jobKey: string
  startedAt: string
  finishedAt: string | null
  status: string
  message: string | null
  wasManual: boolean
  durationMs: number
}

export function useJobs() {
  return useQuery({
    queryKey: keys.jobs,
    queryFn: () =>
      adminApiClient.get<{ jobs: ScheduledJob[]; recentRuns: JobRun[] }>(
        "/admin/operations/jobs",
      ),
    staleTime: 15_000,
    retry: retryUnlessClientError,
  })
}

export function useRunJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      adminApiClient.post<JobRun>(`/admin/operations/jobs/${id}/run`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.jobs })
      queryClient.invalidateQueries({ queryKey: keys.backups })
    },
  })
}

export function useUpdateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      isEnabled: boolean
      intervalMinutes: number
      preferredMinuteOfDay: number | null
    }) =>
      adminApiClient.put(`/admin/operations/jobs/${input.id}`, {
        isEnabled: input.isEnabled,
        intervalMinutes: input.intervalMinutes,
        preferredMinuteOfDay: input.preferredMinuteOfDay,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.jobs }),
  })
}

// ── Backups ────────────────────────────────────────────────────────────

export interface BackupListing {
  directory: string
  retention: number
  files: { fileName: string; sizeBytes: number; createdAt: string }[]
}

export function useBackups() {
  return useQuery({
    queryKey: keys.backups,
    queryFn: () => adminApiClient.get<BackupListing>("/admin/operations/backups"),
    staleTime: 30_000,
    retry: retryUnlessClientError,
  })
}

export function useRunBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => adminApiClient.post("/admin/operations/backups/run", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.backups })
      queryClient.invalidateQueries({ queryKey: keys.jobs })
    },
  })
}

// ── Database console ───────────────────────────────────────────────────

export interface DatabaseOverview {
  provider: string
  writeEnabled: boolean
  writeSettingKey: string
  writeConfirmationPhrase: string
  tables: { name: string; rowCount: number }[]
}

export interface QueryResult {
  success: boolean
  refused?: boolean
  message: string
  columns: string[]
  rows: (string | number | boolean | null)[][]
  rowCount: number
  rowsAffected: number
  truncated: boolean
  durationMs: number
}

export function useDatabaseOverview() {
  return useQuery({
    queryKey: keys.database,
    queryFn: () => adminApiClient.get<DatabaseOverview>("/admin/operations/database"),
    staleTime: 60_000,
    retry: retryUnlessClientError,
  })
}

export function useRunQuery() {
  return useMutation({
    mutationFn: (sql: string) =>
      adminApiClient.post<QueryResult>("/admin/operations/database/query", { sql }),
  })
}

export function useExecuteSql() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sql: string; confirm: string }) =>
      adminApiClient.post<QueryResult>("/admin/operations/database/execute", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.database }),
  })
}

// ── Licensing ──────────────────────────────────────────────────────────

export interface AdminPlan {
  id: string
  name: string
  description?: string
  priceMonthly: number
  priceYearly: number
  maxUsers: number
  maxCompanies: number
  maxStorageMB: number
  maxJournalEntries: number
  modules: string | null
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  subscribers: number
}

export interface AdminFeature {
  key: string
  name: string
  description?: string
  module: string
  priceMonthly: number
  priceYearly: number
  isAddOn: boolean
  isActive: boolean
  sortOrder: number
  isModuleDoor: boolean
  purchasedBy: number
}

export interface LicensingMatrix {
  plans: AdminPlan[]
  features: AdminFeature[]
  pairings: { planId: string; featureKey: string; included: boolean; quota: number | null }[]
  modules: string[]
  unbuiltModules: string[]
  coreModule: string
}

export function useLicensingMatrix() {
  return useQuery({
    queryKey: keys.matrix,
    queryFn: () => adminApiClient.get<LicensingMatrix>("/admin/licensing/matrix"),
    staleTime: 30_000,
    retry: retryUnlessClientError,
  })
}

export function useSetPairing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      planId: string
      featureKey: string
      included: boolean
      quota?: number | null
    }) => adminApiClient.put("/admin/licensing/pairings", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.matrix }),
  })
}

export function useSaveFeature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { create: boolean; feature: Partial<AdminFeature> & { key: string } }) =>
      input.create
        ? adminApiClient.post("/admin/licensing/features", input.feature)
        : adminApiClient.put(`/admin/licensing/features/${input.feature.key}`, input.feature),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.matrix }),
  })
}

export function useRetireFeature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => adminApiClient.delete(`/admin/licensing/features/${key}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.matrix }),
  })
}

export function useSeedCatalogue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      adminApiClient.post<{ added: number; message: string }>(
        "/admin/licensing/features/seed",
        {},
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.matrix }),
  })
}

export function useSavePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (plan: AdminPlan) => adminApiClient.put(`/admin/plans/${plan.id}`, plan),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.matrix }),
  })
}

export interface UsageRow {
  id: string
  name: string
  isSuspended: boolean
  plan: { name: string; maxJournalEntries: number; maxUsers: number } | null
  journalEntries: number
  users: number
}

export function usePlatformUsage() {
  return useQuery({
    queryKey: keys.usage,
    queryFn: () =>
      adminApiClient.get<{ window: string; windowStart: string | null; rows: UsageRow[] }>(
        "/admin/licensing/usage",
      ),
    staleTime: 30_000,
    retry: retryUnlessClientError,
  })
}

// ── Activity ───────────────────────────────────────────────────────────

export interface ActivityRow {
  id: string
  timestamp: string
  action: string
  targetEntity: string | null
  details: string | null
  ipAddress: string | null
  device: string | null
  operatingSystem: string | null
  userId: string | null
  userName: string | null
  userEmail: string | null
  companyId: string | null
  companyName: string | null
}

export function useActivity(params: {
  page: number
  pageSize: number
  search?: string
  action?: string
}) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  })
  if (params.search) query.set("search", params.search)
  if (params.action) query.set("action", params.action)

  return useQuery({
    queryKey: ["admin", "activity", params],
    queryFn: () =>
      adminApiClient.get<{
        page: number
        pageSize: number
        total: number
        totalPages: number
        rows: ActivityRow[]
      }>(`/admin/activity?${query.toString()}`),
    staleTime: 10_000,
    retry: retryUnlessClientError,
  })
}

export function useActivityActions() {
  return useQuery({
    queryKey: ["admin", "activity", "actions"],
    queryFn: () =>
      adminApiClient.get<{ action: string; count: number }[]>("/admin/activity/actions"),
    staleTime: 300_000,
    retry: retryUnlessClientError,
  })
}

// ── System settings ────────────────────────────────────────────────────

export interface SystemSetting {
  key: string
  value: string
  description?: string
  dataType: string
}

export function useSystemSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => adminApiClient.get<SystemSetting[]>("/admin/settings"),
    staleTime: 30_000,
    retry: retryUnlessClientError,
  })
}

export function useSaveSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (setting: SystemSetting) => adminApiClient.post("/admin/settings", setting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.settings })
      queryClient.invalidateQueries({ queryKey: keys.database })
    },
  })
}

// ── Tenants ────────────────────────────────────────────────────────────

export function useSuspendCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; reason?: string; cancelSubscription: boolean }) =>
      adminApiClient.post(`/admin/companies/${input.id}/suspend`, {
        reason: input.reason,
        cancelSubscription: input.cancelSubscription,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "companies"] }),
  })
}

export function useRestoreCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApiClient.post(`/admin/companies/${id}/restore`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "companies"] }),
  })
}

export function useSuspendUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; reason?: string }) =>
      adminApiClient.post(`/admin/users/${input.id}/suspend`, { reason: input.reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  })
}

export function useRestoreUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApiClient.post(`/admin/users/${id}/restore`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  })
}
