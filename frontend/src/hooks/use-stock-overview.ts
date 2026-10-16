"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import type { ModuleHealth, OutstandingItem } from "@/hooks/use-module-health"

/** Types mirror DTOs/StockOverviewDTOs.cs, written from a real response. */

export interface StockPosition {
  tracked: number
  negative: number
  lowStock: number
  /**
   * Quantity times buy price. Not a moving average, not a FIFO layer — the
   * name is deliberate, and the UI must not relabel it "valuation".
   */
  stockAtBuyPrice: number
  withoutInventoryAccount: number
}

export interface CountingState {
  lastCountDate?: string
  daysSinceCount?: number
  openOpnames: number
  unprocessedVariances: number
}

export interface RecentOpname {
  id: string
  number: string
  date: string
  status: "Draft" | "Processed" | "Cancelled"
  lines: number
  variances: number
}

export interface StockOverview {
  companyId: string
  currency: string
  generatedAt: string
  module: ModuleHealth
  position: StockPosition
  counting: CountingState
  outstanding: OutstandingItem[]
  recent: RecentOpname[]
}

export function useStockOverview() {
  return useQuery({
    queryKey: ["dashboard", "stock-overview"],
    queryFn: () => apiClient.get<StockOverview>("/Dashboard/inventory"),
    retry: retryUnlessClientError,
    refetchInterval: 60_000,
  })
}
