"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { useCompany } from "@/contexts/company-context"

/** Mirrors TradeReportsController: sales-by-customer and purchases-by-vendor. */
export interface PartyRow {
  contactId: string
  code: string | null
  name: string
  currency: string
  documents: number
  net: number
  tax: number
  total: number
  paid: number
  outstanding: number
}

export interface PartyTotals {
  currency: string
  documents: number
  net: number
  tax: number
  total: number
  paid: number
  outstanding: number
}

export interface SalesProductRow {
  productId: string | null
  code: string | null
  name: string
  unit: string
  currency: string
  invoices: number
  quantity: number
  net: number
  averagePrice: number
  costOfSales: number | null
  grossProfit: number | null
}

export interface PurchaseProductRow {
  productId: string | null
  code: string | null
  name: string
  unit: string
  currency: string
  bills: number
  quantity: number
  net: number
  averageCost: number
}

export interface TradeReport<Row, Totals> {
  start: string
  end: string
  rows: Row[]
  totals: Totals[]
}

export type TradeReportKind = "sales-by-customer" | "purchases-by-vendor" | "sales-by-product" | "purchases-by-product"

/** A trade report for the period, totalled by the API in decimal. */
export function useTradeReport<Row, Totals>(kind: TradeReportKind, start: string, end: string) {
  const { company } = useCompany()
  return useQuery({
    queryKey: ["trade-report", kind, company?.id, start, end],
    queryFn: () => apiClient.get<TradeReport<Row, Totals>>(`/Reports/${kind}?start=${start}&end=${end}`),
    enabled: !!company && !!start && !!end,
    retry: retryUnlessClientError,
  })
}
