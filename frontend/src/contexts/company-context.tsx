"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { apiClient } from "@/lib/api-client"

interface Company {
    id: string
    name: string
    currency: string
    role: string
    logoUrl?: string
}

interface CompanyContextType {
    company: Company | null
    companies: Company[]
    setCompany: (company: Company) => void
    isLoading: boolean
    refreshCompanies: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
    const [company, setCompanyState] = useState<Company | null>(null)
    const [companies, setCompanies] = useState<Company[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const refreshCompanies = async () => {
        // Skip API calls on pages that don't need company context
        if (typeof window !== "undefined") {
            const path = window.location.pathname;
            if (path.startsWith("/maintenance") || path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/forgot-password") || path.startsWith("/reset-password")) {
                setIsLoading(false);
                return;
            }
        }

        const token = localStorage.getItem("token")
        if (!token) {
            setCompanies([])
            setCompanyState(null)
            setIsLoading(false)
            return
        }

        try {
            const data = await apiClient.get<Company[]>("/users/me/companies")
            setCompanies(data)

            // Auto-select logic
            if (data.length > 0) {
                // Check local storage for preference
                const storedId = localStorage.getItem("selectedCompanyId")
                const matched = data.find(c => c.id === storedId)

                if (matched) {
                    setCompanyState(matched)
                } else {
                    // Default to first one
                    setCompanyState(data[0])
                    localStorage.setItem("selectedCompanyId", data[0].id)
                }
            } else {
                setCompanyState(null)
            }
        } catch (error: any) {
            // Only log if it's not an expected unauthorized state (not logged in)
            if (error.message === "Unauthorized") {
                // Token invalid - clear it
                localStorage.removeItem("token")
            } else {
                console.error("Failed to load companies", error)
            }
            setCompanies([])
            setCompanyState(null)
        } finally {
            setIsLoading(false)
        }
    }

    const setCompany = (newCompany: Company) => {
        setCompanyState(newCompany)
        localStorage.setItem("selectedCompanyId", newCompany.id)
        // Optionally refresh page to ensure all data reloads with new context
        // window.location.reload() 
        // Better: we just rely on the context change, assuming components listen to it.
        // For now, let's keep it simple.
    }

    useEffect(() => {
        refreshCompanies()
    }, [])

    return (
        <CompanyContext.Provider value={{
            company,
            companies,
            setCompany,
            isLoading,
            refreshCompanies
        }}>
            {children}
        </CompanyContext.Provider>
    )
}

export function useCompany() {
    const context = useContext(CompanyContext)
    if (context === undefined) {
        throw new Error("useCompany must be used within a CompanyProvider")
    }
    return context
}
