"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Account } from "@/lib/types/accounting"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, MoreHorizontal, Pencil, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const getTypeColor = (type: string) => {
    switch (type) {
        case 'ASSET': return 'bg-emerald-500 hover:bg-emerald-600';
        case 'LIABILITY': return 'bg-amber-500 hover:bg-amber-600';
        case 'EQUITY': return 'bg-zinc-500 hover:bg-zinc-600';
        case 'INCOME': return 'bg-cyan-500 hover:bg-cyan-600';
        case 'EXPENSE': return 'bg-red-500 hover:bg-red-600';
        default: return 'bg-gray-500';
    }
}

export const coaColumns: ColumnDef<Account>[] = [
    {
        accessorKey: "code",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Code
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <span className="font-mono font-medium">{row.getValue("code")}</span>,
    },
    {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
            const level = row.original.level || 1;
            const padding = (level - 1) * 20;
            return (
                <div style={{ paddingLeft: `${padding}px` }} className="font-medium">
                    {row.getValue("name")}
                </div>
            )
        }
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("type") as string;
            return (
                < Badge className={`${getTypeColor(type)} uppercase text-[10px]`}>
                    {type}
                </Badge>
            )
        },
    },
    {
        accessorKey: "balance",
        header: ({ column }) => (
            <div className="text-right">Balance</div>
        ),
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("balance") || "0")
            const formatted = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
            }).format(amount)

            return <div className="text-right font-mono">{formatted}</div>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const account = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(account.id)}>
                            Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                            <Trash className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
