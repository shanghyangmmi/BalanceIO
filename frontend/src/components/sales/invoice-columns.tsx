"use client"

import { ColumnDef } from "@tanstack/react-table"
import { SalesInvoice } from "@/lib/types/sales"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"
import { Eye } from "lucide-react"
import Link from "next/link"

const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
        case 'PAID': return 'bg-emerald-500 hover:bg-emerald-600';
        case 'SENT': return 'bg-cyan-500 hover:bg-cyan-600';
        case 'DRAFT': return 'bg-zinc-500 hover:bg-zinc-600';
        case 'VOID': return 'bg-red-500 hover:bg-red-600';
        case 'OVERDUE': return 'bg-red-500 hover:bg-red-600';
        default: return 'bg-gray-500';
    }
}

export const invoiceColumns: ColumnDef<SalesInvoice>[] = [
    {
        accessorKey: "invoiceNumber",
        header: "Invoice #",
        cell: ({ row }) => <span className="font-mono font-medium">{row.getValue("invoiceNumber")}</span>,
    },
    {
        accessorKey: "contactName",
        header: "Customer",
        cell: ({ row }) => {
            const contact = row.original.contactName;
            return <div className="font-medium">{contact || "Unknown"}</div>
        }
    },
    {
        accessorKey: "invoiceDate",
        header: "Date",
        cell: ({ row }) => <span className="text-zinc-500">{formatDate(row.getValue("invoiceDate"))}</span>,
    },
    {
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ row }) => <span className="text-zinc-500">{formatDate(row.getValue("dueDate"))}</span>,
    },
    {
        accessorKey: "status", // Map int to string if needed, but API likely returns string name of enum
        header: "Status",
        cell: ({ row }) => {
            // Backend returns Int (0=Draft, 1=Sent, 2=Paid, 3=Void, 4=Overdue) usually, 
            // OR String if serializer is configured.
            // Let's assume String for now based on API controller cleanliness, but safe to handle both.
            // Actually `SalesInvoice` interface has a Status string. 
            // Let's cast to ANY just in case until verified.
            const status = row.original.status as unknown as number | string;

            let statusStr = "";
            if (typeof status === 'number') {
                const statuses = ["Draft", "Sent", "Paid", "Void", "Overdue"];
                statusStr = statuses[status] || "Unknown";
            } else {
                statusStr = status as string;
            }

            return <Badge className={`${getStatusColor(statusStr.toUpperCase())}`}>{statusStr}</Badge>
        }
    },
    {
        accessorKey: "total",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
            return <div className="text-right font-bold font-mono">{formatCurrency(row.getValue("total"))}</div>
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
            return (
                <Link href={`/dashboard/sales/invoices/preview?id=${row.original.id}`}>
                    <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4 text-zinc-400" />
                    </Button>
                </Link>
            )
        },
    },
]
