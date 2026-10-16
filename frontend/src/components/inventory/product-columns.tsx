"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Product } from "@/lib/types/inventory"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/formatter"
import { Edit, MoreHorizontal } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export const getProductColumns = (onAdjustStock: (product: Product) => void): ColumnDef<Product>[] => [
    {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("code")}</span>,
    },
    {
        accessorKey: "name",
        header: "Product Name",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{row.getValue("name")}</span>
                <span className="text-xs text-muted-foreground">{row.original.type === 0 ? "Service" : "Product"}</span>
            </div>
        )
    },
    {
        accessorKey: "stockOnHand",
        header: "Stock",
        cell: ({ row }) => {
            const stock = row.getValue("stockOnHand") as number;
            const min = row.original.reorderLevel;
            const type = row.original.type;

            if (type === 0) return <Badge variant="secondary">Service</Badge>;

            return (
                <div className={`font-bold ${stock <= min ? 'text-red-500' : 'text-zinc-700'}`}>
                    {stock} {row.original.unit}
                </div>
            )
        }
    },
    {
        accessorKey: "sellPrice",
        header: () => <div className="text-right">Sales Price</div>,
        cell: ({ row }) => {
            return <div className="text-right">{formatCurrency(row.getValue("sellPrice"))}</div>
        }
    },
    {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => <Badge variant={row.getValue("isActive") ? "outline" : "secondary"}>{row.getValue("isActive") ? "Active" : "Inactive"}</Badge>
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const product = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4 text-zinc-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => window.location.href = `/dashboard/inventory/${product.id}`}>
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        {product.trackInventory && (
                            <DropdownMenuItem onClick={() => onAdjustStock(product)}>
                                <Edit className="mr-2 h-4 w-4" /> Adjust Stock
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
