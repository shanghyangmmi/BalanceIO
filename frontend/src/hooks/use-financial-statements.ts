"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { useCompany } from "@/contexts/company-context"

/** Types mirror DTOs/FinancialStatementDTOs.cs. */

export type StatementLineKind = "section" | "heading" | "item" | "subtotal" | "total"

export interface StatementLine {
  kind: StatementLineKind
  labelId: string
  labelEn: string
  code: string | null
  indent: number
  current: number | null
  prior: number | null
  /** Trial balance only; `current` is then the debit. */
  credit: number | null
}

export interface StatementCheck {
  labelId: string
  labelEn: string
  passed: boolean
  difference: number
}

export type StatementKey = "sofp" | "pl" | "equity" | "cashflow" | "tb"

export interface FinancialStatement {
  key: StatementKey
  titleId: string
  titleEn: string
  basisId: string
  basisEn: string
  lines: StatementLine[]
  checks: StatementCheck[]
}

export interface FinancialStatementPack {
  companyName: string
  companyAddress: string | null
  companyTaxId: string | null
  currency: string
  periodStart: string
  periodEnd: string
  comparative: boolean
  priorStart: string | null
  priorEnd: string | null
  columnCurrent: string
  columnPrior: string | null
  hasFractions: boolean
  generatedAt: string
  generatedBy: string | null
  statements: FinancialStatement[]
}

export function useFinancialStatements(start: string, end: string, comparative: boolean) {
  const { company } = useCompany()
  return useQuery({
    queryKey: ["reports", "financial-statements", company?.id, start, end, comparative],
    queryFn: () =>
      apiClient.get<FinancialStatementPack>(
        `/Reports/financial-statements?start=${start}&end=${end}&comparative=${comparative}`,
      ),
    enabled: !!company && !!start && !!end && start <= end,
    retry: retryUnlessClientError,
  })
}
