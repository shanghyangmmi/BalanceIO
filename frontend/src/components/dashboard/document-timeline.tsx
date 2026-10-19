"use client"

import { useEffect, useState } from "react"
import { apiClient, DocumentHistoryEvent } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Clock,
    CheckCircle2,
    FileEdit,
    PlusCircle,
    XCircle,
    RotateCcw,
    AlertOctagon,
    ShieldCheck,
    Loader2,
    Hash
} from "lucide-react"
import { format } from "date-fns"

interface DocumentTimelineProps {
    documentType: string
    documentId: string
    className?: string
}

function getActionMeta(action: string) {
    switch (action.toLowerCase()) {
        case "created":
            return {
                icon: <PlusCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
                badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
                label: "Created",
            }
        case "updated":
            return {
                icon: <FileEdit className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />,
                badgeClass: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",
                label: "Updated",
            }
        case "posted":
        case "acquisitionposted":
            return {
                icon: <CheckCircle2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />,
                badgeClass: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
                label: action === "AcquisitionPosted" ? "Acquisition posted" : "Posted to ledger",
            }
        case "voided":
            return {
                icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />,
                badgeClass: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
                label: "Voided",
            }
        case "reversed":
            return {
                icon: <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
                badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
                label: "Reversed",
            }
        case "rejected":
            return {
                icon: <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400" />,
                badgeClass: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
                label: "Rejected",
            }
        default:
            return {
                icon: <Clock className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />,
                badgeClass: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800",
                label: action,
            }
    }
}

export function DocumentTimeline({ documentType, documentId, className }: DocumentTimelineProps) {
    const [events, setEvents] = useState<DocumentHistoryEvent[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function fetchHistory() {
            try {
                setIsLoading(true)
                setError(null)
                const data = await apiClient.getDocumentHistory(documentType, documentId)
                if (mounted) {
                    setEvents(data || [])
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err?.message || "Failed to load audit history")
                }
            } finally {
                if (mounted) {
                    setIsLoading(false)
                }
            }
        }

        if (documentType && documentId) {
            fetchHistory()
        }

        return () => {
            mounted = false
        }
    }, [documentType, documentId])

    if (isLoading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Audit timeline & history
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading audit trail...
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        Audit timeline & history
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-destructive py-4">
                    {error}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Audit timeline & history
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Cryptographically chained, tamper-evident business audit trail (UU KUP Pasal 28).
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground gap-1">
                        <Hash className="h-3 w-3" />
                        SHA-256 chained
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No audit events recorded for this document.</p>
                ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                        {events.map((event, index) => {
                            const meta = getActionMeta(event.action)
                            const dateStr = event.createdAt
                                ? format(new Date(event.createdAt), "dd MMM yyyy, HH:mm:ss")
                                : "—"

                            return (
                                <div key={event.id || index} className="relative group">
                                    <div className="absolute -left-[27px] top-0.5 rounded-full bg-background border border-foreground/10 p-1">
                                        {meta.icon}
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${meta.badgeClass}`}>
                                                {meta.label}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                by <span className="font-medium text-foreground">{event.userEmail || event.userId || "System"}</span>
                                            </span>
                                            <span className="text-xs text-muted-foreground font-mono">
                                                • {dateStr}
                                            </span>
                                        </div>

                                        {event.reason && (
                                            <p className="text-xs text-muted-foreground leading-relaxed pl-1">
                                                {event.reason}
                                            </p>
                                        )}

                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono bg-muted/40 rounded px-2 py-1 w-fit border border-border/50">
                                            <span className="text-muted-foreground/80">Hash:</span>
                                            <span title={event.rowHash} className="select-all">
                                                {event.rowHash ? `${event.rowHash.substring(0, 16)}...` : "—"}
                                            </span>
                                            {event.previousHash && (
                                                <>
                                                    <span className="text-muted-foreground/40">←</span>
                                                    <span title={`Previous: ${event.previousHash}`} className="text-muted-foreground/70">
                                                        prev:{event.previousHash.substring(0, 8)}...
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
