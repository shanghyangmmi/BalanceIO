"use client";

import { DataTable } from "@/components/ui/data-table";
import { journalColumns } from "@/components/accounting/journal-columns";
import { Button } from "@/components/ui/button";
import { PlusCircle, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { JournalEntry } from "@/lib/types/accounting";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

// Backend enum: 0 = Draft, 1 = Posted, 2 = Void
const STATUS_MAP: Record<number, string> = {
  0: "DRAFT",
  1: "POSTED",
  2: "VOID",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  POSTED: "Posted",
  VOID: "Void",
};

function JournalPageBody() {
    const can = useCan();
  // ?status=draft narrows the list. The Accounting module dashboard links
  // here that way, and a link that promised drafts and delivered every
  // entry would be worse than no link at all.
  const params = useSearchParams();
  const statusParam = params.get("status")?.toUpperCase() ?? null;
  const status = statusParam && STATUS_LABEL[statusParam] ? statusParam : null;

  // Cached via TanStack Query: revisiting this page renders instantly
  // from cache (zero skeleton flash) and revalidates in the background.
  const { data: response, isLoading } = useJournalEntries();

  const data: JournalEntry[] = useMemo(() => {
    if (!response) return [];
    return response
      .map((item: any) => ({
        id: item.id,
        date: new Date(item.date),
        referenceNumber: item.referenceNumber || "",
        description: item.notes || "-",
        // Real ledger status from the backend (was previously hardcoded "POSTED")
        status: (STATUS_MAP[item.status as number] ?? "DRAFT") as JournalEntry["status"],
        lines: item.lines || [],
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt || item.createdAt),
      }))
      .filter((entry) => !status || entry.status === status);
  }, [response, status]);

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Journal Entries</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage your journal entries and financial transactions.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {can(PERMISSIONS.FinanceCreate) && <Link href="/dashboard/accounting/journal/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Entry
            </Button>
          </Link>}
        </div>
      </div>

      {status && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
            Showing {STATUS_LABEL[status]} only
            <Link
              href="/dashboard/accounting/journal"
              aria-label="Clear status filter"
              className="transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Link>
          </span>
          {!isLoading && (
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              {data.length} of {response?.length ?? 0}
            </span>
          )}
        </div>
      )}

      <div className="h-full flex-1 flex-col space-y-8 md:flex">
        <DataTable
          data={data}
          columns={journalColumns}
          isLoading={isLoading}
          filterColumn="description"
          filterPlaceholder="Search journals..."
        />
      </div>
    </div>
  );
}

export default function JournalPage() {
  // useSearchParams needs a Suspense boundary for this route to stay
  // statically exportable.
  return (
    <Suspense fallback={null}>
      <JournalPageBody />
    </Suspense>
  );
}
