"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { useCompany } from "@/contexts/company-context"

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
  /** Fixed assets in use in the year without a fiscal group; their depreciation is not reconciled. */
  unclassifiedAssets: number
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

// ── Penyusutan fiskal ─────────────────────────────────────────────────

/** Mirrors DTOs/FiscalDepreciationDTOs.cs. */
export interface FiscalDepreciationRow {
  assetId: string
  code: string
  name: string
  group: string
  groupLabel: string
  method: "StraightLine" | "DecliningBalance" | ""
  lifeYears: number | null
  acquisitionDate: string
  cost: number
  fiscalOpening: number
  fiscalCharge: number
  fiscalClosing: number
  commercialCharge: number
  disposalDate: string | null
  proceeds: number | null
  fiscalGainLoss: number | null
  commercialGainLoss: number | null
  correction: number
}

export interface FiscalDepreciationGroup {
  group: string
  groupLabel: string
  assets: number
  cost: number
  fiscalCharge: number
  fiscalClosing: number
  commercialCharge: number
  correction: number
}

export interface FiscalDepreciationReport {
  year: number
  currency: string
  rows: FiscalDepreciationRow[]
  groups: FiscalDepreciationGroup[]
  fiscalCharge: number
  commercialCharge: number
  correction: number
  unclassified: number
}

export function useFiscalDepreciation(year: number) {
  const { company } = useCompany()
  return useQuery({
    queryKey: ["fiscal-depreciation", company?.id, year],
    queryFn: () => apiClient.get<FiscalDepreciationReport>(`/Assets/fiscal-depreciation?year=${year}`),
    enabled: !!company,
    retry: retryUnlessClientError,
  })
}
