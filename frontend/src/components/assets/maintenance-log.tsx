"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus } from "lucide-react"

const logs = [
    { id: 1, date: "2024-01-10", asset: "Toyota Avanza", type: "Service", cost: 1500000, notes: "Regular oil change" },
    { id: 2, date: "2024-02-15", asset: "MacBook Pro M1", type: "Repair", cost: 2500000, notes: "Battery replacement" },
]

export function MaintenanceLog() {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Maintenance Log</CardTitle>
                    <CardDescription>History of asset repairs and services.</CardDescription>
                </div>
                <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Asset</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell>{log.date}</TableCell>
                                <TableCell>{log.asset}</TableCell>
                                <TableCell>{log.type}</TableCell>
                                <TableCell>{log.notes}</TableCell>
                                <TableCell className="text-right">Rp {log.cost.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
