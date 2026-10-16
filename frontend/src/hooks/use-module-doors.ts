"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/** Types mirror DTOs/ModuleDoorDTOs.cs, written from a real response. */

export type ModuleKey = "accounting" | "tax" | "inventory" | "fixedAssets" | "payroll"

export interface ModuleDoor {
  key: ModuleKey
  name: string
  description: string
  /** What is inside, named. Not measured — the hub carries no figures. */
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
 * The hub's only request.
 *
 * Deliberately not module-health: the hub is a list of doors, and asking
 * four modules how they are going in order to draw a launcher would pay
 * for figures nobody asked to see.
 */
export function useModuleDoors() {
  return useQuery({
    queryKey: ["dashboard", "module-doors"],
    queryFn: () => apiClient.get<ModuleDoorsResponse>("/Dashboard/modules"),
    retry: retryUnlessClientError,
  })
}
