"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"

/** Types mirror DTOs/TaxEqualisationDTOs.cs, written from a real response. */

export interface EqualisationRow {
  month: number
  label: string
  /** Credits less debits on the Sales revenue accounts, posted entries only. */
  ledgerRevenue: number
  /** Invoice total less its PPN, on issued invoices. */
  invoiceDpp: number
  outputTax: number
  /** Ledger revenue less invoice DPP. Zero is the clean case. */
  difference: number
  invoiceCount: number
}

export interface EqualisationTotals {
  ledgerRevenue: number
  invoiceDpp: number
  outputTax: number
  difference: number
  invoiceCount: number
  monthsWithDifference: number
}

export interface TaxEqualisation {
  companyId: string
  currency: string
  generatedAt: string
  year: number
  availableYears: number[]
  months: EqualisationRow[]
  totals: EqualisationTotals
  /** The accounts the ledger side reads, so the basis can be checked. */
  revenueAccounts: string[]
}

export function useTaxEqualisation(year: number | null) {
  return useQuery({
    queryKey: ["dashboard", "tax-equalisation", year],
    queryFn: () =>
      apiClient.get<TaxEqualisation>(
        year ? `/Dashboard/tax/equalisation?year=${year}` : "/Dashboard/tax/equalisation",
      ),
    retry: retryUnlessClientError,
  })
}
