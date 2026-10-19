"use client"

import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

export interface CompanyData {
    id?: string
    name: string
    industry?: string
    currency: string
    address?: string
    city?: string
    country?: string
    phone?: string
    email?: string
    taxId?: string
    logoUrl?: string
    fiscalYearStartMonth?: number
    isOnboarded?: boolean
    lockDate?: string | null // ISO Date string
}

const defaultCompanyData: CompanyData = {
    name: "",
    industry: "",
    currency: "IDR",
    city: "Jakarta",
    country: "Indonesia"
}

/**
 * Hook to get company data from API using TanStack Query.
 * Cached across routes with 60s stale time to eliminate redundant network requests
 * and prevent flash of placeholder "Your Company Name" text.
 */
export function useCompanyData(): { company: CompanyData; isLoading: boolean; refetch: () => void } {
    const { data, isLoading, refetch } = useQuery<CompanyData>({
        queryKey: queryKeys.company.details(),
        queryFn: async () => {
            const result = await apiClient.get<CompanyData>("/company")
            return result || defaultCompanyData
        },
        staleTime: 60_000,
    })

    // Memoised: callers put `company` in effect dependencies (the settings form
    // resets from it), and a fresh object per render loops them forever.
    const company = useMemo(() => (data ? { ...defaultCompanyData, ...data } : defaultCompanyData), [data])

    return { company, isLoading, refetch }
}

/**
 * TanStack Mutation Hook to update company data with automatic cache invalidation
 */
export function useUpdateCompanyData() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (data: Partial<CompanyData>) => {
            return apiClient.put("/company", data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.company.all })
        },
    })
}

/**
 * Legacy imperative updater for backwards compatibility
 */
export async function updateCompanyData(data: Partial<CompanyData>): Promise<{ success: boolean; error?: string }> {
    try {
        await apiClient.put("/company", data)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || "Failed to update" }
    }
}
