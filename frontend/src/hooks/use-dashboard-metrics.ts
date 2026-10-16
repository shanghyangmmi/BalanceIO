"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"

export interface DashboardMetrics {
    totalRevenue: number
    totalExpenses: number
    revenueGrowth: number
    salesCount: number
    subscriptions: number
    activeNow: number
}

/**
 * Cached dashboard metrics. First visit fetches; every subsequent visit
 * within staleTime renders instantly from cache and revalidates silently.
 */
export function useDashboardMetrics() {
    return useQuery({
        queryKey: ["dashboard", "metrics"],
        queryFn: () => apiClient.get<DashboardMetrics>("/dashboard/metrics").catch(() => ({
            totalRevenue: 0,
            totalExpenses: 0,
            revenueGrowth: 0,
            salesCount: 0,
            subscriptions: 0,
            activeNow: 1
        })),
        // Metrics move fast — keep them fresher than the global default
        staleTime: 15_000,
        refetchInterval: 60_000, // live feel without manual refresh
    })
}
