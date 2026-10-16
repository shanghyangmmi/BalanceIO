"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { JournalForm } from "@/components/accounting/journal-form";
import { apiClient } from "@/lib/api-client";
import { JournalEntry } from "@/lib/types/accounting";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function JournalEditContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");
    const [data, setData] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            try {
                if (!id) return;

                const response = await apiClient.getJournalEntry(id);

                // Map API response to Frontend Type
                const journal: JournalEntry = {
                    id: response.id,
                    date: new Date(response.date),
                    referenceNumber: response.referenceNumber,
                    description: response.notes || "-", // Map Backend 'Notes' to 'Description'
                    notes: response.notes,
                    tags: response.tags,
                    contactId: response.contactId,
                    currency: response.currency,
                    status: "POSTED",
                    createdAt: new Date(response.createdAt),
                    updatedAt: new Date(response.updatedAt),
                    lines: response.lines || [],
                };

                setData(journal);
            } catch (error) {
                console.error("Failed to load journal", error);
                toast.error("Failed to load journal details");
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [id]);

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

    if (!data) {
        return (
            <div className="flex-1 space-y-4">
                <div>Journal Entry not found</div>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-0 p-0">
            <div className="bg-card text-card-foreground">
                <JournalForm initialData={data} />
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
