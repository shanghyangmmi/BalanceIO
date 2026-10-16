"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { adminApiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRestoreCompany, useSuspendCompany } from "@/hooks/use-admin"
import {
  Empty,
  ErrorNote,
  Masthead,
  Panel,
  Pill,
  relativeTime,
  Row,
  Sep,
  TableShell,
  Td,
  Th,
} from "@/components/sys-control/admin-primitives"

interface Company {
  id: string
  name: string
  industry?: string
  currency?: string
  city?: string
  country?: string
  isOnboarded: boolean
  createdAt: string
  isSuspended: boolean
  suspendedAt: string | null
  suspensionReason: string | null
  journalEntryCount: number
  userCount: number
  subscription: { name: string; endDate: string } | null
}

/**
 * The tenants.
 *
 * Suspension is the primary control here and deletion is not offered at
 * all. A company that has posted anything owns a set of statutory records
 * that a tax audit can reach back years for; the API refuses to delete one
 * regardless, and a button that always fails is worse than no button.
 */
export default function CompaniesPage() {
  const [search, setSearch] = React.useState("")
  const [debounced, setDebounced] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [target, setTarget] = React.useState<Company | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const companies = useQuery({
    queryKey: ["admin", "companies", { page, search: debounced }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" })
      if (debounced) params.set("search", debounced)
      return adminApiClient.get<{
        data: Company[]
        pagination: { page: number; totalPages: number; totalCount: number }
      }>(`/admin/companies?${params}`)
    },
    staleTime: 15_000,
    retry: retryUnlessClientError,
  })

  const restore = useRestoreCompany()

  return (
    <div className="space-y-8 pb-16">
      <Masthead
        title="Companies"
        accent="on the platform."
        lede="Every tenant, what they are subscribed to, and how much they have posted. Suspension takes effect within thirty seconds and leaves every record intact."
        actions={
          companies.data ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {companies.data.pagination.totalCount.toLocaleString("en-GB")} total
            </span>
          ) : undefined
        }
      />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name"
        className="w-full max-w-sm rounded-lg border border-foreground/15 bg-transparent px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
      />

      {companies.isError ? (
        <ErrorNote
          message={companies.error instanceof Error ? companies.error.message : undefined}
          onRetry={() => companies.refetch()}
        />
      ) : companies.isPending ? (
        <Panel className="space-y-3 p-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </Panel>
      ) : companies.data.data.length === 0 ? (
        <Empty title={debounced ? "Nothing matches that." : "No companies have signed up yet."} />
      ) : (
        <>
          <TableShell
            minWidth="56rem"
            head={
              <>
                <Th>Company</Th>
                <Th>Plan</Th>
                <Th align="right">Users</Th>
                <Th align="right">Journals</Th>
                <Th align="right">Joined</Th>
                <Th align="right" />
              </>
            }
          >
            {companies.data.data.map((company, i) => (
              <Row key={company.id} index={i}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[13px]",
                        company.isSuspended ? "text-muted-foreground" : "text-foreground",
                      )}
                    >
                      {company.name}
                    </span>
                    {company.isSuspended && <Pill tone="bad">Suspended</Pill>}
                    {!company.isOnboarded && <Pill>Not onboarded</Pill>}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {[company.industry, company.city, company.currency]
                      .filter(Boolean)
                      .join(" · ") || "no profile"}
                  </div>
                  {company.suspensionReason && (
                    <div className="mt-1 text-[12px] text-red-700 dark:text-red-400">
                      {company.suspensionReason}
                    </div>
                  )}
                </Td>
                <Td>
                  {company.subscription ? (
                    <>
                      <div className="text-[13px] text-foreground">
                        {company.subscription.name}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        to {new Date(company.subscription.endDate).toLocaleDateString("en-GB")}
                      </div>
                    </>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">none</span>
                  )}
                </Td>
                <Td align="right">{company.userCount}</Td>
                <Td align="right">{company.journalEntryCount.toLocaleString("en-GB")}</Td>
                <Td align="right" className="whitespace-nowrap text-muted-foreground">
                  {relativeTime(company.createdAt)}
                </Td>
                <Td align="right">
                  {company.isSuspended ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={restore.isPending}
                      onClick={async () => {
                        await restore.mutateAsync(company.id)
                        toast.success(`${company.name} restored.`)
                      }}
                    >
                      Restore
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setTarget(company)}>
                      Suspend
                    </Button>
                  )}
                </Td>
              </Row>
            ))}
          </TableShell>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Page {companies.data.pagination.page} of {companies.data.pagination.totalPages || 1}
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
                disabled={page >= companies.data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <SuspendDialog company={target} onClose={() => setTarget(null)} />

      <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
        Companies are not deletable from here once anything has been posted to their books, and
        the API refuses it regardless of what this screen offers. Suspension is reversible and
        loses nothing.
      </p>
    </div>
  )
}

function SuspendDialog({
  company,
  onClose,
}: {
  company: Company | null
  onClose: () => void
}) {
  const suspend = useSuspendCompany()
  const [reason, setReason] = React.useState("")
  const [cancelSubscription, setCancelSubscription] = React.useState(false)

  React.useEffect(() => {
    if (company) {
      setReason("")
      setCancelSubscription(false)
    }
  }, [company])

  return (
    <Dialog open={!!company} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {company?.name}</DialogTitle>
          <DialogDescription>
            Everyone at this company stops being able to reach the API within thirty seconds.
            Nothing is deleted and nothing is anonymised.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Reason
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Shown to them, and recorded in the audit log"
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
            />
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={cancelSubscription}
              onChange={(e) => setCancelSubscription(e.target.checked)}
              className="mt-1"
            />
            <span className="text-[13px] leading-relaxed text-muted-foreground">
              Cancel the subscription as well. Leave this off for an investigation — a contract
              that is paid up should survive a suspension.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={suspend.isPending}
            onClick={async () => {
              if (!company) return
              try {
                await suspend.mutateAsync({
                  id: company.id,
                  reason: reason || undefined,
                  cancelSubscription,
                })
                toast.success(`${company.name} suspended.`)
                onClose()
              } catch (error) {
                toast.error("Could not suspend", {
                  description: error instanceof Error ? error.message : undefined,
                })
              }
            }}
          >
            {suspend.isPending ? "Suspending…" : "Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
