"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/** Types mirror DTOs/TaxAnalysisDTOs.cs, written from real responses. */

// ── Rekonsiliasi fiskal ───────────────────────────────────────────────

export interface FiscalCorrectionLine {
  code: string
  name: string
  /** "positive" adds back, "negative" takes out. */
  direction: "positive" | "negative"
  amount: number
}

export interface FiscalReconciliation {
  companyId: string
  currency: string
  generatedAt: string
  year: number
  availableYears: number[]
  revenue: number
  expenses: number
  commercialProfit: number
  positiveCorrections: number
  negativeCorrections: number
  fiscalProfit: number
  corrections: FiscalCorrectionLine[]
  classifiedAccounts: number
  classifiableAccounts: number
}

export function useFiscalReconciliation(year: number | null) {
  return useQuery({
    queryKey: ["dashboard", "fiscal-reconciliation", year],
    queryFn: () =>
      apiClient.get<FiscalReconciliation>(
        year
          ? `/Dashboard/tax/reconciliation?year=${year}`
          : "/Dashboard/tax/reconciliation",
      ),
    retry: retryUnlessClientError,
  })
}

// ── Debt to equity ────────────────────────────────────────────────────

export interface DebtEquityMonth {
  month: number
  label: string
  debt: number
  equity: number
}

export interface DebtToEquity {
  companyId: string
  currency: string
  generatedAt: string
  year: number
  availableYears: number[]
  /** The PMK-169 cap. Four to one. */
  maximumRatio: number
  averageDebt: number
  averageEquity: number
  /** Absent when average equity is zero or negative. */
  ratio?: number
  withinLimit: boolean
  interestExpense: number
  disallowedInterest: number
  months: DebtEquityMonth[]
  debtAccounts: string[]
  interestAccounts: string[]
  notes: string[]
}

export function useDebtToEquity(year: number | null) {
  return useQuery({
    queryKey: ["dashboard", "debt-to-equity", year],
    queryFn: () =>
      apiClient.get<DebtToEquity>(
        year ? `/Dashboard/tax/debt-to-equity?year=${year}` : "/Dashboard/tax/debt-to-equity",
      ),
    retry: retryUnlessClientError,
  })
}
