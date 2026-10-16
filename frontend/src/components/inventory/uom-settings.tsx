"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface UoM {
    id: string
    name: string
    symbol: string
}

const defaultUoMs: UoM[] = [
    { id: "1", name: "Pcs", symbol: "pcs" },
    { id: "2", name: "Kilogram", symbol: "kg" },
    { id: "3", name: "Liter", symbol: "l" },
    { id: "4", name: "Box", symbol: "box" },
    { id: "5", name: "Meter", symbol: "m" },
]

export function UoMSettings() {
    const [uoms, setUoMs] = useState<UoM[]>(defaultUoMs)
    const [newName, setNewName] = useState("")
    const [newSymbol, setNewSymbol] = useState("")

    const handleAdd = () => {
        if (!newName || !newSymbol) return
        const newUoM = {
            id: Math.random().toString(36).substr(2, 9),
            name: newName,
            symbol: newSymbol,
        }
        setUoMs([...uoms, newUoM])
        setNewName("")
        setNewSymbol("")
        toast.success("Unit of Measure added")
    }

    const handleDelete = (id: string) => {
        setUoMs(uoms.filter((u) => u.id !== id))
        toast.success("Unit of Measure removed")
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Unit of Measures (UoM)</CardTitle>
                <CardDescription>
                    Define units used for inventory items.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2 items-end">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Input
                            placeholder="Name (e.g., Dozen)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    </div>
                    <div className="grid w-full max-w-[100px] items-center gap-1.5">
                        <Input
                            placeholder="Symbol (dz)"
                            value={newSymbol}
                            onChange={(e) => setNewSymbol(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                    <Button onClick={handleAdd}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                    </Button>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Symbol</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uoms.map((uom) => (
                                <TableRow key={uom.id}>
                                    <TableCell className="font-medium">{uom.name}</TableCell>
                                    <TableCell>{uom.symbol}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(uom.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
