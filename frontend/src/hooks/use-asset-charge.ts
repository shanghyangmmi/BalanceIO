"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/** Types mirror DTOs/AssetChargeDTOs.cs, written from a real response. */

export interface ChargeableAsset {
  id: string
  code?: string
  name: string
  category?: string
  usefulLifeMonths: number
  acquisitionCost: number
  accumulatedCharge: number
  carryingAmount: number
  monthlyCharge: number
  lastChargedDate?: string
  due: boolean
  /** Why a run would skip this asset. Absent when it is fine. */
  blocker?: string
}

export interface AssetChargeTotals {
  assets: number
  due: number
  acquisitionCost: number
  accumulatedCharge: number
  carryingAmount: number
  dueThisPeriod: number
}

export type ChargeKind = "depreciation" | "amortisation"

export interface AssetChargeOverview {
  companyId: string
  currency: string
  generatedAt: string
  period: string
  postingDate: string
  totals: AssetChargeTotals
  assets: ChargeableAsset[]
  /** Why a run would refuse. Empty means it can run. */
  blockers: string[]
  hasIntangibleCategories: boolean
  kind: ChargeKind
}

export interface AssetChargeRunResult {
  period: string
  postingDate: string
  assetsCharged: number
  totalCharge: number
  journalEntryId?: string
  journalReference?: string
  skipped: string[]
}

/**
 * One hook for both charges. Depreciation and amortisation share an engine
 * on the server, and giving them separate clients here would be the first
 * place the two drifted apart.
 */
export function useAssetCharge(kind: ChargeKind) {
  return useQuery({
    queryKey: ["dashboard", "asset-charge", kind],
    queryFn: () => apiClient.get<AssetChargeOverview>(`/Dashboard/assets/${kind}`),
    retry: retryUnlessClientError,
  })
}

export function useRunAssetCharge(kind: ChargeKind) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiClient.post<AssetChargeRunResult>(`/Dashboard/assets/${kind}/run`, {}),
    onSuccess: () => {
      // The run posts a journal entry, so the ledger figures on the
      // Accounting module and the hub are stale the moment it lands.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
