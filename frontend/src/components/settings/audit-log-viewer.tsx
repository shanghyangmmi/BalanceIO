"use client"

import { useEffect, useState } from "react"
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
import { apiClient } from "@/lib/api-client"
import { formatDate } from "@/lib/utils/formatter"

export function AuditLogViewer() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchLogs() {
            try {
                const data = await apiClient.get<any[]>("/AuditLogs")
                setLogs(data)
            } catch (error) {
                console.error("Failed to fetch logs", error)
            } finally {
                setLoading(false)
            }
        }
        fetchLogs()
    }, [])

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>

    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Date</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => (
                        <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.action}</TableCell>
                            <TableCell>{log.targetEntity}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={log.details}>
                                {log.details}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                        </TableRow>
                    ))}
                    {logs.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                                No audit logs found.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </Card>
    )
}
