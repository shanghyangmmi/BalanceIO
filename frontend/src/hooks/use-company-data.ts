"use client"

import { useState, useEffect } from "react"

import { apiClient } from "@/lib/api-client"

export interface CompanyData {
    id?: string
    name: string
    industry?: string
    currency: string
    address?: string
    city?: string
    country?: string
    phone?: string
    email?: string
    taxId?: string
    logoUrl?: string
    fiscalYearStartMonth?: number
    isOnboarded?: boolean
    lockDate?: string | null // ISO Date string
}

const defaultCompanyData: CompanyData = {
    name: "Your Company Name",
    industry: "",
    currency: "IDR",
    city: "Jakarta",
    country: "Indonesia"
}

/**
 * Hook to get company data from API
 */
export function useCompanyData(): { company: CompanyData; isLoading: boolean; refetch: () => void } {
    const [companyData, setCompanyData] = useState<CompanyData>(defaultCompanyData)
    const [isLoading, setIsLoading] = useState(true)

    const fetchCompany = async () => {
        try {
            setIsLoading(true)
            // Through apiClient: /company needs the bearer token and the
            // X-Company-Id header, and a bare fetch sent neither. It only
            // ever worked because the endpoint was unauthenticated, which
            // also meant it answered without knowing which tenant was asking.
            const data = await apiClient.get<CompanyData>("/company")
            if (data) {
                setCompanyData({
                    ...defaultCompanyData,
                    ...data
                })
            }
        } catch (error) {
            console.error("Failed to fetch company data:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchCompany()
    }, [])

    return { company: companyData, isLoading, refetch: fetchCompany }
}

/**
 * Update company data via API
 */
export async function updateCompanyData(data: Partial<CompanyData>): Promise<{ success: boolean; error?: string }> {
    try {
        await apiClient.put("/company", data)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error?.message || "Failed to update" }
    }
}
