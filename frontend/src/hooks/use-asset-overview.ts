"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import type { ModuleHealth, OutstandingItem } from "@/hooks/use-module-health"

/** Types mirror DTOs/AssetOverviewDTOs.cs, written from a real response. */

export interface AssetRegister {
  active: number
  disposed: number
  acquisitionCost: number
  accumulatedDepreciation: number
  bookValue: number
  withoutCategory: number
  withoutDepreciationAccount: number
  fullyDepreciatedStillActive: number
}

export interface DepreciationState {
  /** "August 2026" — the period being depreciated. */
  period: string
  behind: number
  upToDate: number
  lastPostedDate?: string
  postedThisPeriod: number
}

export interface RecentDepreciation {
  id: string
  assetName: string
  assetCode?: string
  date: string
  amount: number
  /** False when the posting carries no journal entry reference. */
  posted: boolean
}

export interface AssetOverview {
  companyId: string
  currency: string
  generatedAt: string
  module: ModuleHealth
  register: AssetRegister
  depreciation: DepreciationState
  outstanding: OutstandingItem[]
  recent: RecentDepreciation[]
}

export function useAssetOverview() {
  return useQuery({
    queryKey: ["dashboard", "asset-overview"],
    queryFn: () => apiClient.get<AssetOverview>("/Dashboard/assets"),
    retry: retryUnlessClientError,
    refetchInterval: 60_000,
  })
}
