"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { formatDate } from "@/lib/utils/formatter"
import { useCompany } from "@/contexts/company-context"
import { RBACGuard } from "@/components/auth/rbac-guard"
import { PERMISSIONS } from "@/lib/auth/permissions"

/** Mirrors GET /api/audit-logs. */
interface AuditLogRow {
    id: string
    action: string
    targetEntity: string | null
    details: string | null
    ipAddress: string | null
    timestamp: string
    userName: string
    userEmail: string
}

interface AuditLogPage {
    data: AuditLogRow[]
    pagination: { page: number; pageSize: number; totalCount: number; totalPages: number }
}

const PAGE_SIZE = 20

function AuditLogTable() {
    const { company } = useCompany()
    const [page, setPage] = useState(1)
    const { data, isPending, isError, error } = useQuery({
        queryKey: ["audit-logs", company?.id, page],
        queryFn: () => apiClient.get<AuditLogPage>(`/audit-logs?page=${page}&pageSize=${PAGE_SIZE}`),
        enabled: !!company,
        retry: retryUnlessClientError,
        placeholderData: (previous) => previous,
    })

    if (isPending) return <div className="p-8"><Loader2 className="animate-spin" /></div>
    if (isError) return <p className="p-6 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Audit logs could not be loaded."}</p>

    const { data: logs, pagination } = data

    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.action}</TableCell>
                            <TableCell>{log.targetEntity}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={log.details ?? undefined}>
                                {log.details}
                            </TableCell>
                            <TableCell className="text-sm">{log.userName}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                        </TableRow>
                    ))}
                    {logs.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                                No audit logs found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-end gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
                    <span className="tabular-nums">Page {pagination.page} of {pagination.totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
            )}
        </Card>
    )
}

export function AuditLogViewer() {
    return (
        <RBACGuard
            permission={PERMISSIONS.AuditView}
            fallback={<p className="p-6 text-sm text-muted-foreground">Your role cannot view the audit log.</p>}
        >
            <AuditLogTable />
        </RBACGuard>
    )
}
