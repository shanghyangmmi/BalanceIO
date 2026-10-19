"use client"

import { ColumnDef } from "@tanstack/react-table"
import { StockMovement } from "@/lib/types/inventory"
import { DataTable } from "@/components/ui/data-table"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils/formatter"

const movements: StockMovement[] = [
    { id: "MV-001", date: new Date("2024-01-01"), productId: "P-001", type: "IN", quantity: 10, reference: "OPENING" },
    { id: "MV-002", date: new Date("2024-01-05"), productId: "P-001", type: "OUT", quantity: 2, reference: "INV-2024-001" },
    { id: "MV-003", date: new Date("2024-01-10"), productId: "P-001", type: "OUT", quantity: 1, reference: "INV-2024-002" },
    { id: "MV-004", date: new Date("2024-01-15"), productId: "P-001", type: "IN", quantity: 5, reference: "PO-2024-005" },
    { id: "MV-005", date: new Date("2024-01-20"), productId: "P-001", type: "ADJUSTMENT", quantity: -1, reference: "ADJ-001" },
]

const columns: ColumnDef<StockMovement>[] = [
    {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDate(row.getValue("date")),
    },
    {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
            const type = row.getValue("type") as string;
            let color = "bg-gray-500";
            if (type === 'IN') color = "bg-emerald-500";
            if (type === 'OUT') color = "bg-cyan-500";
            if (type === 'ADJUSTMENT') color = "bg-amber-500";

            return <Badge className={color}>{type}</Badge>
        }
    },
    {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("reference")}</span>,
    },
    {
        accessorKey: "quantity",
        header: () => <div className="text-right">Quantity</div>,
        cell: ({ row }) => {
            const qty = row.getValue("quantity") as number;
            return <div className={`text-right font-bold ${qty < 0 ? 'text-red-500' : 'text-green-600'}`}>{qty > 0 ? '+' : ''}{qty}</div>
        }
    },
]

export function StockCard() {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Stock Movement History</h3>
            <DataTable
                data={movements}
                columns={columns}
                filterColumn="reference"
            />
        </div>
    )
}
