"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Eye, Trash2, MoreHorizontal, Loader2 } from "lucide-react"
import Link from "next/link"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { JournalEntry } from "@/lib/types/accounting"

interface JournalActionsProps {
    entry: JournalEntry
}

export function JournalActions({ entry }: JournalActionsProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    async function handleDelete() {
        setIsDeleting(true)
        try {
            await apiClient.deleteJournalEntry(entry.id)
            toast.success("Journal Entry deleted")
            // Reload page or invalidate query
            window.location.reload()
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete journal entry")
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
    }

    return (
        <>
            <div className="flex items-center justify-end gap-2">
                <Link href={`/dashboard/accounting/journal/edit?id=${entry.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-blue-600">
                        <Eye className="h-4 w-4" />
                    </Button>
                </Link>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500 hover:text-red-600"
                    onClick={() => setShowDeleteDialog(true)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently void the journal entry.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
