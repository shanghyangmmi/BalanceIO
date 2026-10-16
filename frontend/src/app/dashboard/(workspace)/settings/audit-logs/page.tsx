"use client";

import { useEffect, useState, Fragment } from "react";
import { format } from "date-fns";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, User, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface AuditLog {
    id: string;
    action: string;
    targetEntity: string | null;
    details: string | null;
    ipAddress: string | null;
    timestamp: string;
    userName: string;
    userEmail: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});

    const fetchLogs = async (pageNum: number) => {
        setIsLoading(true);
        try {
            const data = await apiClient.getAuditLogs(pageNum, 20);
            setLogs(data.data);
            setTotalPages(data.pagination.totalPages);
            setPage(data.pagination.page);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
            toast.error("Failed to load audit logs");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const toggleRow = (id: string) => {
        setExpandedLogIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getActionColor = (action: string) => {
        if (action.includes("LOGIN") && !action.includes("FAIL")) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
        if (action.includes("FAIL") || action.includes("DELETE") || action.includes("VOID")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
        if (action.includes("UPDATE") || action.includes("CHANGE")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400";
    };

    interface AuditDetails {
        tableName?: string;
        keys?: Record<string, any>;
        oldValues?: Record<string, any>;
        newValues?: Record<string, any>;
    }

    const parseAuditDetails = (details: string | null): AuditDetails | null => {
        if (!details) return null;
        try {
            const parsed = JSON.parse(details);
            if (parsed && (parsed.oldValues || parsed.newValues || parsed.tableName)) {
                return parsed as AuditDetails;
            }
        } catch (e) {
            // Not JSON
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-emerald-500" />
                        Activity Audit Logs
                    </CardTitle>
                    <CardDescription>
                        View a detailed history of security events and administrative actions associated with your organization.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[180px]">Timestamp</TableHead>
                                    <TableHead className="w-[150px]">Action</TableHead>
                                    <TableHead className="w-[200px]">User</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="w-[120px]">IP Address</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading logs...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No logs found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log) => {
                                        const detailsObj = parseAuditDetails(log.details);
                                        const changedFields = detailsObj ? Array.from(new Set([
                                            ...Object.keys(detailsObj.oldValues || {}),
                                            ...Object.keys(detailsObj.newValues || {})
                                        ])) : [];
                                        const isExpanded = !!expandedLogIds[log.id];

                                        return (
                                            <Fragment key={log.id}>
                                                <TableRow className={isExpanded ? "border-b-0 bg-zinc-50/30 dark:bg-zinc-900/10" : ""}>
                                                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                                        {format(new Date(log.timestamp), "MMM dd, yyyy HH:mm:ss")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={`font-mono text-xs border-0 ${getActionColor(log.action)}`}>
                                                            {log.action}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-sm">{log.userName}</span>
                                                            <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-[400px]">
                                                        <div className="flex flex-col gap-1.5">
                                                            {log.targetEntity && (
                                                                <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium w-fit">
                                                                    {log.targetEntity}
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-2 justify-between">
                                                                {detailsObj ? (
                                                                    <span className="text-sm text-zinc-500 italic">
                                                                        Modified {changedFields.length} field{changedFields.length === 1 ? '' : 's'} on {detailsObj.tableName}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-sm">{log.details || "-"}</span>
                                                                )}
                                                                {(detailsObj || log.details) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-1 shrink-0"
                                                                        onClick={() => toggleRow(log.id)}
                                                                    >
                                                                        {isExpanded ? (
                                                                            <>Hide Details <ChevronUp className="h-3 w-3" /></>
                                                                        ) : (
                                                                            <>View Details <ChevronDown className="h-3 w-3" /></>
                                                                        )}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs text-muted-foreground">
                                                        {log.ipAddress || "-"}
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && (
                                                    <TableRow className="bg-zinc-50/30 dark:bg-zinc-900/10 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10">
                                                        <TableCell colSpan={5} className="p-4 pt-0">
                                                            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
                                                                <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-900">
                                                                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                                                        Entity Modifications: {detailsObj?.tableName || log.targetEntity || "Details"}
                                                                    </span>
                                                                    {detailsObj?.keys && (
                                                                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 rounded">
                                                                            Keys: {JSON.stringify(detailsObj.keys)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {detailsObj ? (
                                                                    changedFields.length === 0 ? (
                                                                        <p className="text-xs text-zinc-500 italic">No modified columns recorded.</p>
                                                                    ) : (
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full text-xs text-left">
                                                                                <thead>
                                                                                    <tr className="text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-1 font-bold">
                                                                                        <th className="pb-2 w-1/4">Field / Property</th>
                                                                                        <th className="pb-2 w-3/8">Before (Old Value)</th>
                                                                                        <th className="pb-2 w-3/8">After (New Value)</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-850">
                                                                                    {changedFields.map((field) => {
                                                                                        const oldVal = detailsObj.oldValues?.[field];
                                                                                        const newVal = detailsObj.newValues?.[field];
                                                                                        
                                                                                        const formatValue = (v: any) => {
                                                                                            if (v === null || v === undefined) return <span className="text-zinc-400 dark:text-zinc-600 italic">null</span>;
                                                                                            if (typeof v === 'object') return JSON.stringify(v);
                                                                                            if (typeof v === 'boolean') return v ? 'true' : 'false';
                                                                                            return String(v);
                                                                                        };

                                                                                        return (
                                                                                            <tr key={field} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20">
                                                                                                <td className="py-2 pr-2 font-mono font-medium text-zinc-700 dark:text-zinc-300">{field}</td>
                                                                                                <td className="py-2 pr-4 text-red-750 dark:text-red-400 font-mono bg-red-50/30 dark:bg-red-950/10 rounded px-2 py-0.5 break-all max-w-[300px]">
                                                                                                    {formatValue(oldVal)}
                                                                                                </td>
                                                                                                <td className="py-2 font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 rounded px-2 py-0.5 break-all max-w-[300px]">
                                                                                                    {formatValue(newVal)}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded font-mono text-xs text-zinc-800 dark:text-zinc-300 break-all whitespace-pre-wrap">
                                                                        {log.details || "No details description found."}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </div>
                        <div className="space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1 || isLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages || isLoading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
