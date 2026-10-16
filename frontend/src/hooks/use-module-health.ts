"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/**
 * Types mirror DTOs/ModuleHealthDTOs.cs exactly. They were written from a
 * real response, not from a guess at the contract — the reason
 * journal/edit/page.tsx ended up hardcoding status "POSTED".
 */

export type ModuleStatus = "balanced" | "attention" | "overdue" | "inactive"

export type FigureFormat = "money" | "count" | "days" | "date"

export interface ModuleFigure {
  label: string
  /** Raw number. The server never sends pre-formatted money. */
  value: number
  format: FigureFormat
  /** Present on money figures only. */
  currency?: string
  /** Present on date figures only. */
  isoDate?: string
}

export interface ModuleHealth {
  key: "accounting" | "tax" | "inventory" | "fixedAssets" | "payroll"
  name: string
  status: ModuleStatus
  /**
   * False only when the module has no implementation behind it. Do not
   * infer this from `status` — `inactive` also means "built but unused",
   * which is a different card.
   */
  implemented: boolean
  href: string | null
  headline: string
  detail: string | null
  /** Never more than two. Payroll sends none. */
  figures: ModuleFigure[]
}

export interface OutstandingItem {
  key: string
  /** Same vocabulary as module status — the colour means the same thing. */
  severity: ModuleStatus
  title: string
  detail?: string
  count?: number
  href?: string
  actionLabel?: string
}

export interface ModuleHealthResponse {
  companyId: string
  currency: string
  generatedAt: string
  /** Worst status among the modules; `inactive` never drags it down. */
  overall: ModuleStatus
  modules: ModuleHealth[]
}

/**
 * One request for the whole hub. Five requests would let the cards
 * disagree with each other while they settled.
 */
export function useModuleHealth() {
  return useQuery({
    queryKey: ["dashboard", "module-health"],
    queryFn: () => apiClient.get<ModuleHealthResponse>("/Dashboard/module-health"),
    retry: retryUnlessClientError,
    // The house defaults (30s stale, 10min gc) are right here: revisiting
    // the hub inside 30s renders from cache with no skeleton flash.
    refetchInterval: 60_000,
  })
}
