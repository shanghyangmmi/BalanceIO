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
import { Upload, FileDown, AlertCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"

export function ImportAccountsModal() {
    const [mounted, setMounted] = useState(false)
    const [open, setOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleUpload = () => {
        if (!file) return
        setUploading(true)
        // Simulate upload
        setTimeout(() => {
            setUploading(false)
            setOpen(false)
            setFile(null)
            toast.success("Accounts imported successfully", {
                description: `${Math.floor(Math.random() * 50) + 10} accounts added to your chart.`
            })
        }, 1500)
    }

    if (!mounted) {
        return (
            <Button variant="outline" disabled>
                <Upload className="mr-2 h-4 w-4" /> Import
            </Button>
        )
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import Accounts</DialogTitle>
                    <DialogDescription>
                        Upload a CSV or Excel file to bulk import accounts.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4 border rounded p-4 bg-muted/50">
                        <div className="h-10 w-10 bg-green-100 items-center justify-center flex rounded text-green-600">
                            <FileDown className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-semibold">Download Template</h4>
                            <p className="text-xs text-muted-foreground">Use this file to format your data.</p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-blue-500">
                            Download
                        </Button>
                    </div>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="file">Account File</Label>
                        <Input
                            id="file"
                            type="file"
                            accept=".csv, .xlsx"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    {file && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            <span>File selected: {file.name}</span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleUpload} disabled={!file || uploading}>
                        {uploading ? "Importing..." : "Start Import"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
