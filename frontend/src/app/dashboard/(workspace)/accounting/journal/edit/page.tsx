"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { JournalForm } from "@/components/accounting/journal-form";
import { useJournalEntry } from "@/hooks/use-journal-entries";
import { JournalEntry } from "@/lib/types/accounting";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// Backend enum: 0 = Draft, 1 = Posted, 2 = Void
const STATUS_MAP: Record<number, JournalEntry["status"]> = {
    0: "DRAFT",
    1: "POSTED",
    2: "VOID",
};

function JournalEditContent() {
    const id = useSearchParams().get("id") ?? undefined;
    const { data: response, isLoading, isError } = useJournalEntry(id);

    const journal = useMemo<JournalEntry | null>(() => {
        if (!response) return null;
        return {
            id: response.id,
            date: new Date(response.date),
            referenceNumber: response.referenceNumber,
            description: response.notes || "-", // Map Backend 'Notes' to 'Description'
            notes: response.notes,
            tags: response.tags,
            contactId: response.contactId,
            currency: response.currency,
            status: STATUS_MAP[response.status as number] ?? "DRAFT",
            createdAt: new Date(response.createdAt),
            updatedAt: new Date(response.updatedAt ?? response.createdAt),
            lines: response.lines || [],
        };
    }, [response]);

    if (isLoading) {
        return (
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between space-y-2">
                    <Skeleton className="h-8 w-64" />
                </div>
                <Skeleton className="h-[500px] w-full" />
            </div>
        );
    }

    if (isError || !journal) {
        return <div className="flex-1 space-y-4">Journal Entry not found</div>;
    }

    // The API refuses edits to Posted and Void entries (POSTED_IMMUTABLE,
    // VOID_IMMUTABLE); corrections go through void or reverse.
    if (journal.status !== "DRAFT") {
        return (
            <div className="flex-1 space-y-4 p-6">
                <h1 className="text-lg font-semibold">
                    {journal.status === "POSTED" ? "Posted entries cannot be edited" : "Void entries cannot be edited"}
                </h1>
                <p className="text-sm text-muted-foreground max-w-prose">
                    {journal.status === "POSTED"
                        ? "A posted entry is part of the ledger. Void it, or post a reversal, from the journal list."
                        : "A void entry is a historical record and is kept as it was."}
                </p>
                <Button asChild variant="outline">
                    <Link href="/dashboard/accounting/journal">Back to journal</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-0 p-0">
            <div className="bg-card text-card-foreground">
                <JournalForm initialData={journal} />
            </div>
        </div>
    );
}

export default function EditJournalPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <JournalEditContent />
        </Suspense>
    );
}
