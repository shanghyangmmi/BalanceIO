"use client"

import { ColumnDef } from "@tanstack/react-table"
import { JournalEntry } from "@/lib/types/accounting"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react"
import Link from "next/link";
import { JournalActions } from "./journal-actions";

export const journalColumns: ColumnDef<JournalEntry>[] = [
    {
        accessorKey: "date",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <span className="text-zinc-500 font-medium">{formatDate(row.getValue("date"))}</span>,
    },
    {
        accessorKey: "id",
        header: "Journal #",
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("id")}</span>,
    },
    {
        accessorKey: "referenceNumber",
        header: "Reference",
        cell: ({ row }) => <span className="font-mono text-xs text-zinc-500">{row.getValue("referenceNumber")}</span>,
    },
    {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => <div className="max-w-[300px] truncate font-medium">{row.getValue("description")}</div>,
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string;
            return (
                <Badge variant={status === 'POSTED' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                    {status}
                </Badge>
            )
        }
    },
    {
        id: "total",
        header: () => <div className="text-right">Total</div>,
        cell: ({ row }) => {
            // Calculate total Debit (or Credit, they should match)
            const total = row.original.lines.reduce((sum, line) => sum + line.debit, 0);
            return <div className="text-right font-mono font-medium">{formatCurrency(total)}</div>
        }
    },
    {
        id: "actions",
        cell: ({ row }) => <JournalActions entry={row.original} />,
    },
]
