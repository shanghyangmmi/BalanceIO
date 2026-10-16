"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Expense } from "@/lib/types/expense"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"

export const expenseColumns: ColumnDef<Expense>[] = [
    {
        accessorKey: "referenceNumber",
        header: "Ref #",
        cell: ({ row }) => <span className="font-mono font-medium">{row.getValue("referenceNumber")}</span>,
    },
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => <span className="text-zinc-500">{formatDate(row.getValue("date"))}</span>,
    },
    {
        accessorKey: "description",
        header: "Description",
    },
    {
        accessorKey: "accounts",
        header: "Account",
        cell: ({ row }) => {
            const accounts = row.original.accounts;
            return (
                <div className="flex flex-col gap-1">
                    {accounts.map((acc, i) => (
                        <Badge key={i} variant="outline" className="w-fit">{acc.name}</Badge>
                    ))}
                </div>
            )
        }
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
            return <div className="text-right font-bold font-mono">{formatCurrency(row.getValue("amount"))}</div>
        }
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status");
            // 0=Draft, 1=Posted
            return status === 1
                ? <Badge className="bg-emerald-500 hover:bg-emerald-600">Posted</Badge>
                : <Badge variant="secondary">Draft</Badge>
        }
    },
]
