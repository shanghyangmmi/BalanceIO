"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    ArrowLeft,
    Loader2,
    Printer,
    FileText,
    Receipt,
    ShoppingCart,
    CheckCircle,
    Clock,
    AlertCircle,
    BookOpen,
} from "lucide-react"
import { format } from "date-fns"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Link from "next/link"

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
    draft: {
        color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
        icon: <Clock className="h-3.5 w-3.5" />,
    },
    posted: {
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
        icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
    paid: {
        color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
        icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
    sent: {
        color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
        icon: <FileText className="h-3.5 w-3.5" />,
    },
    approved: {
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
    overdue: {
        color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    cancelled: {
        color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    void: {
        color: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-500 border-zinc-200 dark:border-zinc-700",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
}

type DocType = "invoice" | "purchase-order" | "purchase-bill" | "journal"

export function DocumentDetailView({ id }: { id: string }) {
    const router = useRouter()
    const [document, setDocument] = useState<any>(null)
    const [docType, setDocType] = useState<DocType | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadDocument()
    }, [id])

    const loadDocument = async () => {
        try {
            setIsLoading(true)
            setError(null)

            // Try fetching from each endpoint
            try {
                const inv = await apiClient.getInvoice(id)
                if (inv) { setDocument(inv); setDocType("invoice"); setIsLoading(false); return }
            } catch { }

            try {
                const po = await apiClient.getPurchaseOrder(id)
                if (po) { setDocument(po); setDocType("purchase-order"); setIsLoading(false); return }
            } catch { }

            try {
                const bill = await apiClient.getPurchaseBill(id)
                if (bill) { setDocument(bill); setDocType("purchase-bill"); setIsLoading(false); return }
            } catch { }

            setError("Document not found")
        } catch {
            setError("Failed to load document")
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !document) {
        return (
            <div className="flex-1 space-y-4">
                <Link href="/dashboard/documents" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Documents
                </Link>
                <Card>
                    <CardContent className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <AlertCircle className="h-10 w-10 mb-3" />
                        <p className="text-lg font-medium">{error || "Document not found"}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const getDocDetails = () => {
        switch (docType) {
            case "invoice":
                return {
                    title: "Sales Invoice",
                    icon: <Receipt className="h-5 w-5" />,
                    color: "#0B3C3D",
                    number: document.invoiceNumber || `INV-${id.substring(0, 8)}`,
                    date: document.invoiceDate,
                    dueDate: document.dueDate,
                    counterpartyLabel: "Customer",
                    counterparty: document.contact?.name || "—",
                    lines: document.lines || [],
                    subtotal: document.subtotal || 0,
                    taxTotal: document.taxAmount || 0,
                    total: document.total || 0,
                    status: (document.status || "draft").toString().toLowerCase(),
                    notes: document.notes,
                }
            case "purchase-order":
                return {
                    title: "Purchase Order",
                    icon: <ShoppingCart className="h-5 w-5" />,
                    color: "#3b82f6",
                    number: document.orderNumber || `PO-${id.substring(0, 8)}`,
                    date: document.orderDate,
                    dueDate: document.expectedDeliveryDate,
                    counterpartyLabel: "Vendor",
                    counterparty: document.contact?.name || document.vendorName || "—",
                    lines: document.lines || [],
                    subtotal: document.subtotal || 0,
                    taxTotal: document.taxAmount || 0,
                    total: document.totalAmount || document.total || 0,
                    status: (document.status || "draft").toString().toLowerCase(),
                    notes: document.notes,
                }
            case "purchase-bill":
                return {
                    title: "Purchase Bill",
                    icon: <FileText className="h-5 w-5" />,
                    color: "#ef4444",
                    number: document.billNumber || `BILL-${id.substring(0, 8)}`,
                    date: document.billDate,
                    dueDate: document.dueDate,
                    counterpartyLabel: "Vendor",
                    counterparty: document.contact?.name || "—",
                    lines: document.lines || [],
                    subtotal: document.subtotal || 0,
                    taxTotal: document.taxAmount || 0,
                    total: document.total || 0,
                    status: (document.status || "draft").toString().toLowerCase(),
                    notes: document.notes,
                }
            default:
                return {
                    title: "Document", icon: <FileText className="h-5 w-5" />, color: "#6366f1",
                    number: id.substring(0, 8), date: null, dueDate: null,
                    counterpartyLabel: "Party", counterparty: "—",
                    lines: [], subtotal: 0, taxTotal: 0, total: 0, status: "draft", notes: null,
                }
        }
    }

    const details = getDocDetails()
    const statusCfg = statusConfig[details.status] || statusConfig.draft

    return (
        <div className="flex-1 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/documents" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: details.color }}>
                            {details.icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold">{details.number}</h2>
                                <Badge variant="outline" className={`${statusCfg.color} flex items-center gap-1`}>
                                    {statusCfg.icon}
                                    {details.status}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{details.title}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" /> Print
                    </Button>
                    <Button size="sm" variant="outline" disabled title="Coming soon — Generate journal entries from this document">
                        <BookOpen className="h-4 w-4 mr-2" /> Generate Journal
                    </Button>
                </div>
            </div>

            {/* Document Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">{details.counterpartyLabel}</p>
                        <p className="text-lg font-semibold">{details.counterparty}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">Document Date</p>
                        <p className="text-lg font-semibold">
                            {details.date ? format(new Date(details.date), "MMM d, yyyy") : "—"}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground">
                            {docType === "purchase-order" ? "Expected Delivery" : "Due Date"}
                        </p>
                        <p className="text-lg font-semibold">
                            {details.dueDate ? format(new Date(details.dueDate), "MMM d, yyyy") : "—"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Line Items */}
            <Card>
                <CardHeader>
                    <CardTitle>Line Items</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>#</TableHead>
                                <TableHead>Product / Description</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Discount</TableHead>
                                <TableHead className="text-right">Tax</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {details.lines.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-20 text-muted-foreground">
                                        No line items
                                    </TableCell>
                                </TableRow>
                            ) : (
                                details.lines.map((line: any, i: number) => (
                                    <TableRow key={line.id || i}>
                                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{line.product?.name || line.productName || "—"}</p>
                                                {line.description && <p className="text-sm text-muted-foreground">{line.description}</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{line.quantity}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(line.unitPrice || 0)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatCurrency(line.discountAmount || 0)}</TableCell>
                                        <TableCell className="text-right">{line.taxRate ? `${line.taxRate}%` : "—"}</TableCell>
                                        <TableCell className="text-right font-mono font-medium">{formatCurrency(line.lineTotal || 0)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    {/* Totals */}
                    <div className="border-t p-4 flex justify-end">
                        <div className="w-[300px] space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-mono">{formatCurrency(details.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Tax</span>
                                <span className="font-mono">{formatCurrency(details.taxTotal)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                                <span>Total</span>
                                <span className="font-mono">{formatCurrency(details.total)}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notes */}
            {details.notes && (
                <Card>
                    <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details.notes}</p>
                    </CardContent>
                </Card>
            )}

            {/* Future: Journal Entries placeholder */}
            <Card className="border-dashed opacity-60">
                <CardContent className="flex items-center gap-3 py-4 text-muted-foreground">
                    <BookOpen className="h-5 w-5" />
                    <div>
                        <p className="font-medium">Journal Entries</p>
                        <p className="text-sm">
                            No journal entries linked yet. Use &quot;Generate Journal&quot; to create accounting entries from this document.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
