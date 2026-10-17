"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { useCompany } from "@/contexts/company-context"

/** Types mirror DTOs/ModuleDoorDTOs.cs, written from a real response. */

export type ModuleKey = "accounting" | "tax" | "inventory" | "fixedAssets" | "payroll"

export interface ModuleDoor {
  key: ModuleKey
  name: string
  description: string
  /** What is inside, named. Figures come from module-health. */
  contents: string[]
  /** The one door that is the product rather than an addition to it. */
  primary: boolean
  implemented: boolean
  /** Decided on the server. The module endpoint refuses independently. */
  entitled: boolean
  href?: string
  lockedReason?: string
}

export interface ModuleDoorsResponse {
  companyId: string
  generatedAt: string
  /** Absent when the company has no live subscription. */
  planName?: string
  doors: ModuleDoor[]
}

/**
 * Which modules exist and which the plan opens. The hub draws its cards
 * from this at once and fills their figures from module-health.
 */
export function useModuleDoors() {
  const { company } = useCompany()
  return useQuery({
    queryKey: ["dashboard", "module-doors", company?.id],
    enabled: !!company,
    queryFn: () => apiClient.get<ModuleDoorsResponse>("/Dashboard/modules"),
    retry: retryUnlessClientError,
  })
}
