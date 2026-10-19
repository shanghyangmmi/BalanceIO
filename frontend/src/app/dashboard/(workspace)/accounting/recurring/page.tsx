"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { PlusCircle, Loader2, Play, Pencil, Trash2, CalendarClock } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate, formatCurrency } from "@/lib/utils/formatter"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { RecurringEntryForm } from "@/components/accounting/recurring-entry-form"
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

// Types
interface RecurringEntry {
  id: string
  description: string
  frequency: number
  nextRunDate: string
  lastPostedDate?: string
  amount: number
  isActive: boolean
  lines: any[]
}

const frequencyLabels: Record<number, string> = {
  0: "Daily",
  1: "Weekly",
  2: "Monthly",
  3: "Quarterly",
  4: "Yearly"
}

export default function RecurringEntriesPage() {
    const can = useCan();
  const [entries, setEntries] = useState<RecurringEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<RecurringEntry | null>(null)

  const fetchEntries = async () => {
    try {
      const data = await apiClient.get<RecurringEntry[]>("/RecurringJournalEntries")
      setEntries(data)
    } catch (error) {
      console.error("Failed to fetch recurring entries", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const handleCreate = async (data: any) => {
    try {
      if (editingEntry) {
        await apiClient.put(`/RecurringJournalEntries/${editingEntry.id}`, { ...data, id: editingEntry.id })
        toast.success("Template updated")
      } else {
        await apiClient.post("/RecurringJournalEntries", data)
        toast.success("Template created")
      }
      setIsSheetOpen(false)
      setEditingEntry(null)
      fetchEntries()
    } catch (error: any) {
      toast.error("Failed to save template")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return
    try {
      await apiClient.delete(`/RecurringJournalEntries/${id}`)
      toast.success("Template deleted")
      fetchEntries()
    } catch (error) {
      toast.error("Failed to delete")
    }
  }

  const handleProcess = async (id: string) => {
    try {
      await apiClient.post(`/RecurringJournalEntries/${id}/process`, {})
      toast.success("Processed successfully - Journal Entry created")
      fetchEntries()
    } catch (error) {
      toast.error("Failed to process")
    }
  }

  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Recurring Entries</h2>
          <p className="text-muted-foreground">Automate your regular journal entries.</p>
        </div>
        <Sheet open={isSheetOpen} onOpenChange={(val) => {
          if (!val) setEditingEntry(null)
          setIsSheetOpen(val)
        }}>
          {can(PERMISSIONS.FinanceCreate) && <SheetTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Template
            </Button>
          </SheetTrigger>}
          <SheetContent className="sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editingEntry ? "Edit Template" : "New Recurring Template"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <RecurringEntryForm
                onSubmit={handleCreate}
                defaultValues={editingEntry ? {
                  ...editingEntry,
                  // Ensure lines map correctly if needed
                } : undefined}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4">
        {entries.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="text-center py-10">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">No Recurring Templates</h3>
              <p className="text-muted-foreground">Create a template to automate monthly rent, subscriptions, etc.</p>
            </CardContent>
          </Card>
        )}

        {entries.map(entry => (
          <Card key={entry.id} className="overflow-hidden">
            <div className="flex items-center p-4 gap-4">
              <div className="h-10 w-10 flex items-center justify-center bg-cyan-50 dark:bg-cyan-900/20 rounded-lg text-cyan-600">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{entry.description}</h3>
                  <Badge variant="outline">{frequencyLabels[entry.frequency]}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex gap-4 mt-1">
                  <span>Next Run: {formatDate(entry.nextRunDate)}</span>
                  <span>Last Posted: {entry.lastPostedDate ? formatDate(entry.lastPostedDate) : "Never"}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {can(PERMISSIONS.FinanceCreate) && <Button variant="outline" size="sm" onClick={() => handleProcess(entry.id)}>
                  <Play className="h-3 w-3 mr-2" /> Run Now
                </Button>}
                {can(PERMISSIONS.FinanceEdit) && <Button variant="ghost" size="icon" onClick={() => {
                  setEditingEntry(entry)
                  setIsSheetOpen(true)
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>}
                {can(PERMISSIONS.FinanceDelete) && <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(entry.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
