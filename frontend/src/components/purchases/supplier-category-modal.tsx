"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Tag, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function SupplierCategoryModal() {
    const [open, setOpen] = useState(false)
    const [categories, setCategories] = useState(["Raw Materials", "Services", "Utilities", "Office Supplies"])
    const [newCat, setNewCat] = useState("")

    const handleAdd = () => {
        if (!newCat) return
        setCategories([...categories, newCat])
        setNewCat("")
        toast.success("Category added")
    }

    const handleRemove = (cat: string) => {
        setCategories(categories.filter(c => c !== cat))
        toast.success("Category removed")
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Tag className="mr-2 h-4 w-4" /> Manage Categories
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Supplier Categories</DialogTitle>
                    <DialogDescription>
                        Organize your vendors into logical groups.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="New category name..."
                            value={newCat}
                            onChange={(e) => setNewCat(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <Button size="icon" onClick={handleAdd}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {categories.map(cat => (
                            <Badge key={cat} variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1">
                                {cat}
                                <button onClick={() => handleRemove(cat)} className="hover:text-red-500 rounded-full p-0.5">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => setOpen(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
