"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Bill } from "@/lib/types/purchases"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"
import { Eye } from "lucide-react"
import Link from "next/link"

const getStatusColor = (status: string) => {
    switch (status) {
        case 'PAID': return 'bg-emerald-500 hover:bg-emerald-600';
        case 'OPEN': return 'bg-blue-500 hover:bg-blue-600';
        case 'OVERDUE': return 'bg-red-500 hover:bg-red-600';
        default: return 'bg-gray-500';
    }
}

export const billColumns: ColumnDef<Bill>[] = [
    {
        accessorKey: "id",
        header: "Bill #",
        cell: ({ row }) => <span className="font-mono font-medium">{row.getValue("id")}</span>,
    },
    {
        accessorKey: "vendorName",
        header: "Vendor",
    },
    {
        accessorKey: "referenceNumber",
        header: "Ref #",
        cell: ({ row }) => <span className="text-muted-foreground text-xs">{row.getValue("referenceNumber")}</span>,
    },
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => <span className="text-zinc-500">{formatDate(row.getValue("date"))}</span>,
    },
    {
        accessorKey: "dueDate",
        header: "Due Date",
        cell: ({ row }) => <span className="text-zinc-500">{formatDate(row.getValue("dueDate"))}</span>,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return <Badge className={`${getStatusColor(status)}`}>{status}</Badge>
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
                <Link href={`/dashboard/purchases/vendors/details?id=${row.original.vendorId}`}>
                    <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4 text-zinc-400" />
                    </Button>
                </Link>
            )
        },
    },
]
