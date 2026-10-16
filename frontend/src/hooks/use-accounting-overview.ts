"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import type { ModuleHealth, OutstandingItem } from "@/hooks/use-module-health"

/**
 * Types mirror DTOs/AccountingOverviewDTOs.cs, written from a real response
 * rather than a guess at the contract.
 *
 * Note `module`: the server sends back the hub's own card. The module page
 * renders that object rather than deriving its own status, so the two
 * screens cannot disagree about whether the books balance.
 */

export interface LedgerBalance {
  debit: number
  credit: number
  /** Debit minus credit. Exactly zero or the books are out. */
  difference: number
  isBalanced: boolean
  postedEntries: number
}

export interface PeriodState {
  /** ISO date. Absent when no lock has ever been set. */
  lockDate?: string
  expectedLockThrough: string
  isSet: boolean
  isCurrent: boolean
  monthsBehind: number
}

export interface LedgerShape {
  accounts: number
  postableAccounts: number
  entriesThisMonth: number
  lastPostedDate?: string
}

export interface RecentEntry {
  id: string
  date: string
  reference?: string
  /** Total debits on the entry. */
  amount: number
  lines: number
}

export interface AccountingOverview {
  companyId: string
  currency: string
  generatedAt: string
  module: ModuleHealth
  balance: LedgerBalance
  period: PeriodState
  /** Worst first. Empty means there is genuinely nothing to do. */
  outstanding: OutstandingItem[]
  ledger: LedgerShape
  recent: RecentEntry[]
}

export function useAccountingOverview() {
  return useQuery({
    queryKey: ["dashboard", "accounting-overview"],
    queryFn: () => apiClient.get<AccountingOverview>("/Dashboard/accounting"),
    retry: retryUnlessClientError,
    refetchInterval: 60_000,
  })
}
