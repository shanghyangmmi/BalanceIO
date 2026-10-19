"use client";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Info, Loader2, CheckSquare } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatter";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface DraftJournal {
  id: string;
  journalNumber: string;
  date: string;
  reference: string;
  description: string; // Changed from memo to match API
  totalDebit: number; // Changed to match likely API response or mapped
  status: number;
  lines: any[];
}

export default function PostJournalsPage() {
    const can = useCan();
  const [drafts, setDrafts] = useState<DraftJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    try {
      const allJournals = await apiClient.getJournalEntries();
      // Map and Filter for draft journals (status = 0)
      const draftJournals = allJournals
        .filter((j: any) => j.status === 0)
        .map((j: any) => ({
          id: j.id,
          journalNumber: j.journalNumber || "DRAFT",
          date: j.date,
          reference: j.reference,
          description: j.description,
          totalDebit: j.lines.reduce((sum: number, l: any) => sum + l.debit, 0),
          status: j.status,
          lines: j.lines
        }));
      setDrafts(draftJournals);
    } catch (error) {
      console.error("Failed to fetch draft journals", error);
    } finally {
      setLoading(false);
    }
  }

  const handlePost = async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsPosting(true);
      const result = await apiClient.batchPostJournalEntries(Array.from(selectedIds));

      if (result.failedCount && result.failedCount > 0) {
        toast.warning(`${result.message}. ${result.failedCount} failed.`, {
          description: result.errors?.join("\n")
        });
      } else {
        toast.success(result.message);
      }

      setSelectedIds(new Set()); // Clear selection
      fetchDrafts(); // Refresh list
    } catch (error) {
      toast.error("Failed to post journals");
    } finally {
      setIsPosting(false);
    }
  };

  const columns = useMemo<ColumnDef<DraftJournal>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => {
            table.toggleAllPageRowsSelected(!!value);
            if (value) {
              setSelectedIds(new Set(drafts.map(d => d.id)));
            } else {
              setSelectedIds(new Set());
            }
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => {
            row.toggleSelected(!!value);
            const newSet = new Set(selectedIds);
            if (value) newSet.add(row.original.id);
            else newSet.delete(row.original.id);
            setSelectedIds(newSet);
          }}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => new Date(row.original.date).toLocaleDateString(),
    },
    { accessorKey: "journalNumber", header: "Journal #" },
    { accessorKey: "reference", header: "Reference" },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="font-medium">{row.original.description || "-"}</div>
      ),
    },
    {
      accessorKey: "totalDebit",
      header: "Total Amount",
      cell: ({ row }) => (
        <div className="font-mono">
          {formatCurrency(row.original.totalDebit || 0)}
        </div>
      ),
    },
    {
      id: "status",
      cell: () => <Badge variant="outline">Draft</Badge>
    }
  ], [drafts, selectedIds]); // Re-memoize when drafts or selection changes (though logic inside cell usually handles rows)

  // Sync selection state with table selection if needed, or just rely on manual state
  // We are managing `selectedIds` manually in headers/cells for simplicity with external button

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Batch Posting
          </h2>
          <p className="text-muted-foreground">
            Review and post multiple draft journal entries at once.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && can(PERMISSIONS.FinanceCreate) && (
            <Button onClick={handlePost} disabled={isPosting} className="bg-emerald-600 hover:bg-emerald-700">
              {isPosting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckSquare className="mr-2 h-4 w-4" />
              Post {selectedIds.size} Selected
            </Button>
          )}
        </div>
      </div>

      {drafts.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <DataTable
              data={drafts}
              columns={columns}
              filterColumn="description"
            // Pass selection state if DataTable supports it, or use our custom cells
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 border rounded-lg border-dashed bg-zinc-50 dark:bg-zinc-800/50">
          <CheckCircle className="h-10 w-10 text-emerald-500 mb-4" />
          <h3 className="text-lg font-medium">All Caught Up!</h3>
          <p className="text-muted-foreground">
            No draft journals found pending review.
          </p>
        </div>
      )}
    </div>
  );
}
