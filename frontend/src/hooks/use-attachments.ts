"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { useCompany } from "@/contexts/company-context"
import { retryUnlessClientError } from "@/lib/query-retry"

/** Keys carry the company: attachments are per company, and so is the scope the server checks. */
export const attachmentKeys = {
    all: ["attachments"] as const,
    storage: (companyId: string | undefined) => [...attachmentKeys.all, "storage", companyId ?? ""] as const,
    lists: () => [...attachmentKeys.all, "list"] as const,
    list: (companyId: string | undefined, entityType: string, entityId: string) =>
        [...attachmentKeys.lists(), companyId ?? "", entityType, entityId] as const,
}

/**
 * Whether the server can keep an upload, and what it accepts. It changes
 * only with the deployment's configuration, so it is held for a while.
 */
export function useAttachmentStorage() {
    const { company } = useCompany()
    return useQuery({
        queryKey: attachmentKeys.storage(company?.id),
        queryFn: () => apiClient.getAttachmentStorage(),
        enabled: !!company,
        staleTime: 5 * 60_000,
        retry: retryUnlessClientError,
    })
}

/** The evidence stored against one record. Nothing is fetched until the record exists. */
export function useAttachments(entityType: string, entityId: string | undefined) {
    const { company } = useCompany()
    return useQuery({
        queryKey: attachmentKeys.list(company?.id, entityType, entityId ?? ""),
        queryFn: () => apiClient.getAttachments(entityType, entityId!),
        enabled: !!company && !!entityId,
        retry: retryUnlessClientError,
    })
}
