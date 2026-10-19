"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, Mail, Phone, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Vendor } from "@/lib/types/purchases"
import Link from "next/link"

export const vendorColumns: ColumnDef<Vendor>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Vendor Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <div>
                <Link href={`/dashboard/purchases/vendors/details?id=${row.original.id}`} className="font-medium hover:underline text-cyan-600 dark:text-cyan-400">
                    {row.getValue("name")}
                </Link>
                <div className="text-xs text-muted-foreground">{row.original.email}</div>
            </div>
        ),
    },
    {
        id: "contact",
        header: "Contact",
        cell: ({ row }) => (
            <div className="flex flex-col text-xs text-muted-foreground">
                {row.original.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {row.original.phone}</span>}
                {row.original.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {row.original.address}</span>}
            </div>
        ),
    },
    {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const vendor = row.original

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
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(vendor.id)}>
                            Copy ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Create Bill</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
