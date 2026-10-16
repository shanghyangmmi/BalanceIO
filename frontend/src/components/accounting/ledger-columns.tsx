"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"
import { ArrowUpDown } from "lucide-react"

// Extended type for display
export type LedgerRow = {
    id: string;
    date: Date;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export const ledgerColumns: ColumnDef<LedgerRow>[] = [
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => <span className="text-zinc-500 font-medium whitespace-nowrap">{formatDate(row.getValue("date"))}</span>,
    },
    {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("reference")}</span>,
    },
    {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => <div className="max-w-[300px] truncate">{row.getValue("description")}</div>,
    },
    {
        accessorKey: "debit",
        header: () => <div className="text-right">Debit</div>,
        cell: ({ row }) => {
            const val = row.getValue("debit") as number;
            return <div className="text-right font-mono text-zinc-500">{val ? formatCurrency(val) : "-"}</div>
        }
    },
    {
        accessorKey: "credit",
        header: () => <div className="text-right">Credit</div>,
        cell: ({ row }) => {
            const val = row.getValue("credit") as number;
            return <div className="text-right font-mono text-zinc-500">{val ? formatCurrency(val) : "-"}</div>
        }
    },
    {
        accessorKey: "balance",
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
            const val = row.getValue("balance") as number;
            return <div className="text-right font-mono font-bold">{formatCurrency(val)}</div>
        }
    },
]
