"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Contact, contactTypeLabels, contactCategoryLabels, contactScopeLabels } from "./types"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, User, Building2, Landmark, Globe, Trash2, Pencil } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/formatter"

export const contactColumns: ColumnDef<Contact>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected()}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: "Name / Entity",
        cell: ({ row }) => {
            const category = row.original.category;
            const Icon = category === 0 ? User :
                category === 2 ? Landmark : Building2;

            return (
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                        <Icon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.getValue("name")}</div>
                        <div className="text-xs text-muted-foreground">{row.original.code}</div>
                    </div>
                </div>
            )
        }
    },
    {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => {
            const label = contactCategoryLabels[row.original.category] || "Unknown"
            return (
                <Badge variant="outline" className="font-normal border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
                    {label}
                </Badge>
            )
        }
    },
    {
        accessorKey: "type",
        header: "Roles",
        cell: ({ row }) => {
            const c = row.original;
            return (
                <div className="flex flex-wrap gap-1">
                    {(c.isCustomer || c.type === 0 || c.type === 2) && (
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 text-xs">Customer</Badge>
                    )}
                    {(c.isVendor || c.type === 1 || c.type === 2) && (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 text-xs">Vendor</Badge>
                    )}
                    {c.isEmployee && (
                        <Badge variant="secondary" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-100 text-xs">Employee</Badge>
                    )}
                    {c.isPkp && (
                        <Badge variant="secondary" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100 text-xs">PKP</Badge>
                    )}
                </div>
            )
        }
    },
    {
        accessorKey: "scope",
        header: "Scope",
        cell: ({ row }) => {
            const scope = row.original.scope;
            const label = contactScopeLabels[scope] || "Unknown";
            return (
                <div className="flex items-center gap-2">
                    {scope === 1 && <Globe className="h-3 w-3 text-indigo-500" />}
                    <span className={scope === 1 ? "text-indigo-600 font-medium" : ""}>
                        {label}
                    </span>
                </div>
            )
        }
    },
    {
        accessorKey: "taxId",
        header: "Tax ID / NPWP",
        cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("taxId") || "-"}</div>
    },
    {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <div className="text-sm">{row.original.email || "-"}</div>
    },
    {
        id: "actions",
        cell: ({ row }) => {
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
                        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(row.original.code)}>
                            Copy Code
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Pencil className="mr-2 h-4 w-4" /> Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
