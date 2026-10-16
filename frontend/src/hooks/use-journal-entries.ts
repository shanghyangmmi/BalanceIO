"use client"

import {
    useQuery,
    useInfiniteQuery,
    useMutation,
    useQueryClient,
    keepPreviousData,
} from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"

/** Centralized query keys — invalidate once, refresh everywhere. */
export const journalKeys = {
    all: ["journal-entries"] as const,
    list: () => [...journalKeys.all, "list"] as const,
    paged: (search?: string, status?: number) =>
        [...journalKeys.all, "paged", { search: search ?? "", status: status ?? null }] as const,
    detail: (id: string) => [...journalKeys.all, "detail", id] as const,
}

/** Full list (legacy shape). Cached — revisits render instantly. */
export function useJournalEntries() {
    return useQuery({
        queryKey: journalKeys.list(),
        queryFn: () => apiClient.getJournalEntries(),
    })
}

/**
 * Infinite paged feed for large ledgers. Pairs with VirtualDataTable
 * for 60fps rendering of 10,000+ entries.
 */
export function useJournalEntriesInfinite(pageSize = 50, search?: string, status?: number) {
    return useInfiniteQuery({
        queryKey: journalKeys.paged(search, status),
        queryFn: ({ pageParam }) =>
            apiClient.getJournalEntriesPaged(pageParam as number, pageSize, search, status),
        initialPageParam: 1,
        getNextPageParam: (last) =>
            last.page * last.pageSize < last.total ? last.page + 1 : undefined,
        placeholderData: keepPreviousData, // no flash while typing a search term
    })
}

export function useJournalEntry(id: string | undefined) {
    return useQuery({
        queryKey: journalKeys.detail(id ?? ""),
        queryFn: () => apiClient.getJournalEntry(id!),
        enabled: !!id,
    })
}

/**
 * Create with OPTIMISTIC UPDATE: the row appears in the list instantly,
 * and rolls back with a toast if the server rejects it.
 */
export function useCreateJournalEntry() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (data: any) => apiClient.createJournalEntry(data),
        onMutate: async (newEntry) => {
            await qc.cancelQueries({ queryKey: journalKeys.list() })
            const previous = qc.getQueryData<any[]>(journalKeys.list())
            if (previous) {
                qc.setQueryData<any[]>(journalKeys.list(), [
                    { ...newEntry, id: `optimistic-${Date.now()}`, createdAt: new Date().toISOString() },
                    ...previous,
                ])
            }
            return { previous }
        },
        onError: (err: Error, _newEntry, context) => {
            if (context?.previous) qc.setQueryData(journalKeys.list(), context.previous)
            toast.error(err.message || "Failed to save journal entry — changes reverted.")
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: journalKeys.all })
        },
    })
}

export function useUpdateJournalEntry() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) =>
            apiClient.updateJournalEntry(id, data),
        onSuccess: () => toast.success("Journal entry updated"),
        onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.all }),
    })
}

/** Void a Posted entry (record retained — audit trail). */
export function useVoidJournalEntry() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.voidJournalEntry(id),
        onSuccess: () => toast.success("Entry voided. Record retained for audit."),
        onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.all }),
    })
}

/** Create a reversal Draft (Dr/Cr swapped) from a Posted/Void entry. */
export function useReverseJournalEntry() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: ({ id, date }: { id: string; date?: string }) =>
            apiClient.reverseJournalEntry(id, date),
        onSuccess: () => toast.success("Reversal draft created — review and post it."),
        onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.all }),
    })
}

export function useDeleteJournalEntry() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => apiClient.deleteJournalEntry(id),
        onMutate: async (id) => {
            await qc.cancelQueries({ queryKey: journalKeys.list() })
            const previous = qc.getQueryData<any[]>(journalKeys.list())
            if (previous) {
                qc.setQueryData<any[]>(journalKeys.list(), previous.filter((e) => e.id !== id))
            }
            return { previous }
        },
        onError: (err: Error, _id, context) => {
            if (context?.previous) qc.setQueryData(journalKeys.list(), context.previous)
            toast.error(err.message || "Delete failed — entry restored.")
        },
        onSettled: () => qc.invalidateQueries({ queryKey: journalKeys.all }),
    })
}
