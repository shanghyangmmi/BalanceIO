"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import type { ModuleHealth, OutstandingItem } from "@/hooks/use-module-health"

/**
 * Types mirror DTOs/TaxOverviewDTOs.cs, written from a real response.
 *
 * Read the DTO comments before adding anything to this page: the module
 * records and reconciles PPN, and never decides how a transaction should
 * be taxed.
 */

export interface VatPeriod {
  /** "August 2026". */
  label: string
  start: string
  end: string
  outputTax: number
  inputTax: number
  /** Output minus input. Positive is kurang bayar. */
  net: number
  outputDocuments: number
  inputDocuments: number
}

export interface FilingDeadline {
  /** The month being reported, e.g. "July 2026". */
  period: string
  deadline: string
  /** Negative once the deadline has passed. */
  daysRemaining: number
  /** Always false — the product tracks the deadline, not the filing. */
  statusRecorded: boolean
}

export interface TaxCoverage {
  companyTaxId?: string
  counterpartiesWithoutTaxId: number
  draftTaxedInvoices: number
  draftTaxedBills: number
}

export interface TaxOverview {
  companyId: string
  currency: string
  generatedAt: string
  module: ModuleHealth
  period: VatPeriod
  filing: FilingDeadline
  outstanding: OutstandingItem[]
  /** Six months including the current one, newest first. */
  history: VatPeriod[]
  coverage: TaxCoverage
}

export function useTaxOverview() {
  return useQuery({
    queryKey: ["dashboard", "tax-overview"],
    queryFn: () => apiClient.get<TaxOverview>("/Dashboard/tax"),
    retry: retryUnlessClientError,
    refetchInterval: 60_000,
  })
}
