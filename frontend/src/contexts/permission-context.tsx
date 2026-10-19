"use client"

import React, { createContext, useContext, useEffect, useState, useMemo } from "react"
import { apiClient } from "@/lib/api-client"
import { useCompany } from "@/contexts/company-context"
import { Permission } from "@/lib/auth/permissions"

interface PermissionContextType {
    permissions: string[]
    isLoading: boolean
    /** True once permissions for the selected company are known. */
    isReady: boolean
    role: string
    isSuperAdmin: boolean
    isAdmin: boolean
    isFinance: boolean
    isAuditor: boolean
    isReadOnly: boolean
    hasPermission: (permission: string) => boolean
    hasAnyPermission: (permissions: string[]) => boolean
    hasAllPermissions: (permissions: string[]) => boolean
    refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

export function PermissionProvider({ children }: { children: React.ReactNode }) {
    const { company } = useCompany()
    const [permissions, setPermissions] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [loadedFor, setLoadedFor] = useState<string | null>(null)

    const refreshPermissions = async () => {
        if (!company?.id) {
            setPermissions([])
            return
        }

        try {
            setIsLoading(true)
            const data = await apiClient.get<string[]>(`/permissions/me?companyId=${company.id}`)
            setPermissions(data || [])
        } catch (error) {
            console.error("Failed to fetch permissions", error)
            setPermissions([])
        } finally {
            setIsLoading(false)
            setLoadedFor(company.id)
        }
    }

    useEffect(() => {
        refreshPermissions()
    }, [company?.id])

    // Normalized Role Calculation
    const normalizedRole = useMemo(() => {
        const rawRole = company?.role || "Finance";
        const clean = rawRole.toLowerCase();
        if (clean === "superadmin" || clean === "super_admin" || clean === "owner") return "Superadmin";
        if (clean === "admin" || clean === "manager") return "Admin";
        if (clean === "finance" || clean === "staff" || clean === "accountant") return "Finance";
        if (clean === "auditor" || clean === "viewer") return "Auditor";
        return "Finance";
    }, [company?.role]);

    const isSuperAdmin = normalizedRole === "Superadmin";
    const isReady = !!company?.id && (isSuperAdmin || (loadedFor === company.id && !isLoading));
    const isAdmin = normalizedRole === "Admin" || isSuperAdmin;
    const isFinance = normalizedRole === "Finance";
    const isAuditor = normalizedRole === "Auditor";
    const isReadOnly = isAuditor;

    const hasPermission = (permission: string) => {
        if (isSuperAdmin) return true;
        return permissions.includes(permission);
    }

    const hasAnyPermission = (requiredPermissions: string[]) => {
        if (isSuperAdmin) return true;
        return requiredPermissions.some(p => permissions.includes(p));
    }

    const hasAllPermissions = (requiredPermissions: string[]) => {
        if (isSuperAdmin) return true;
        return requiredPermissions.every(p => permissions.includes(p));
    }

    return (
        <PermissionContext.Provider value={{
            permissions,
            isLoading,
            isReady,
            role: normalizedRole,
            isSuperAdmin,
            isAdmin,
            isFinance,
            isAuditor,
            isReadOnly,
            hasPermission,
            hasAnyPermission,
            hasAllPermissions,
            refreshPermissions
        }}>
            {children}
        </PermissionContext.Provider>
    )
}

export function usePermission() {
    const context = useContext(PermissionContext)
    if (context === undefined) {
        throw new Error("usePermission must be used within a PermissionProvider")
    }
    return context
}
