"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"
import { Edit } from "lucide-react"

/**
 * Written against a real GET /Assets response, not a guess at the contract.
 *
 * Four columns were reading fields the API does not send — `purchaseDate`,
 * `cost`, and a `status` compared against the strings "ACTIVE"/"DISPOSED"
 * when the API sends the enum as a number. `formatDate(undefined)` threw
 * `RangeError: Invalid time value` and took the whole page down with it.
 *
 * The API sends: code, acquisitionDate, acquisitionCost, bookValue,
 * accumulatedDepreciation, status (0-4).
 *
 * Typed locally rather than against `FixedAsset` in @/lib/types/assets:
 * that interface describes a shape the API has never sent (purchaseDate,
 * cost, salvageValue, a string status) and is still what the mock data in
 * lib/data/assets-data.ts and two report pages are built on. Correcting it
 * is its own job; this file answers to the wire.
 */

interface AssetRow {
    id: string
    code?: string | null
    name: string
    serialNumber?: string | null
    acquisitionDate?: string | null
    acquisitionCost?: number | null
    accumulatedDepreciation?: number | null
    bookValue?: number | null
    /** 0 Active, 1 FullyDepreciated, 2 Disposed, 3 Sold, 4 WrittenOff. */
    status: number
}

/** Model enum order: Active, FullyDepreciated, Disposed, Sold, WrittenOff. */
const ASSET_STATUS: Record<number, { label: string; className: string }> = {
    0: { label: "Active", className: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    1: { label: "Fully depreciated", className: "bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    2: { label: "Disposed", className: "bg-zinc-500/10 text-muted-foreground border-foreground/10" },
    3: { label: "Sold", className: "bg-zinc-500/10 text-muted-foreground border-foreground/10" },
    4: { label: "Written off", className: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-500/20" },
}

export const assetColumns: ColumnDef<AssetRow>[] = [
    {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.getValue("code") || "—"}</span>
        ),
    },
    {
        accessorKey: "name",
        header: "Asset Name",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{row.getValue("name")}</span>
                {row.original.serialNumber && (
                    <span className="text-xs text-muted-foreground">{row.original.serialNumber}</span>
                )}
            </div>
        ),
    },
    {
        accessorKey: "acquisitionDate",
        header: "Acquired",
        cell: ({ row }) => {
            const value = row.getValue("acquisitionDate") as string | null
            // Guarded: a missing date is a gap in the record, not a reason to
            // blank the page.
            return <span className="text-muted-foreground">{value ? formatDate(value) : "—"}</span>
        },
    },
    {
        accessorKey: "acquisitionCost",
        header: () => <div className="text-right">Cost</div>,
        cell: ({ row }) => (
            <div className="text-right">{formatCurrency(row.getValue("acquisitionCost") ?? 0)}</div>
        ),
    },
    {
        accessorKey: "accumulatedDepreciation",
        header: () => <div className="text-right">Accumulated</div>,
        cell: ({ row }) => (
            <div className="text-right text-muted-foreground">
                {formatCurrency(row.getValue("accumulatedDepreciation") ?? 0)}
            </div>
        ),
    },
    {
        accessorKey: "bookValue",
        header: () => <div className="text-right">Book Value</div>,
        cell: ({ row }) => (
            <div className="text-right font-medium">{formatCurrency(row.getValue("bookValue") ?? 0)}</div>
        ),
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as number
            const tone = ASSET_STATUS[status] ?? {
                label: `Unknown (${status})`,
                className: "bg-zinc-500/10 text-muted-foreground border-foreground/10",
            }
            return (
                <Badge variant="outline" className={tone.className}>
                    {tone.label}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: () => (
            <Button variant="ghost" size="icon">
                <Edit className="w-4 h-4 text-muted-foreground" />
            </Button>
        ),
    },
]
