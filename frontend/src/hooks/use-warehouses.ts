"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { retryUnlessClientError } from "@/lib/query-retry"
import { useCompany } from "@/contexts/company-context"

/** Mirrors Models/Warehouse.cs. */
export interface Warehouse {
  id: string
  code: string
  name: string
  address: string | null
  city: string | null
  type: 0 | 1 | 2
  isActive: boolean
  isDefault: boolean
}

export interface WarehouseStockRow {
  warehouseId: string
  warehouseCode: string | null
  warehouseName: string | null
  productId: string
  productCode: string
  productName: string
  unit: string
  quantity: number
  unitCost: number
  value: number
}

export interface WarehouseStockSummary {
  id: string
  code: string
  name: string
  isDefault: boolean
  isActive: boolean
  items: number
  value: number
  negative: number
}

export const warehouseKeys = {
  all: (company?: string) => ["warehouses", company] as const,
  stock: (company?: string) => ["warehouses", company, "stock"] as const,
}

/**
 * The company's warehouses, default first. The list is never empty for a
 * company in the inventory module: the API creates the default on first read.
 */
export function useWarehouses() {
  const { company } = useCompany()
  return useQuery({
    queryKey: warehouseKeys.all(company?.id),
    queryFn: () => apiClient.get<Warehouse[]>("/Warehouses"),
    enabled: !!company,
    retry: retryUnlessClientError,
  })
}

export function useWarehouseStock() {
  const { company } = useCompany()
  return useQuery({
    queryKey: warehouseKeys.stock(company?.id),
    queryFn: () => apiClient.get<{ warehouses: WarehouseStockSummary[]; rows: WarehouseStockRow[] }>("/Warehouses/stock"),
    enabled: !!company,
    retry: retryUnlessClientError,
  })
}
