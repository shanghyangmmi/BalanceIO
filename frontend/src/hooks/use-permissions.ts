"use client"

import { useEffect, useState } from "react"
import { usePermission } from "@/contexts/permission-context"

export function usePermissionCheck() {
    const { permissions, isLoading, refreshPermissions } = usePermission()

    return {
        permissions,
        isLoading,
        refreshPermissions,
        // Helper to check efficiently without re-rendering if just checking
        can: (permission: string) => permissions.includes(permission)
    }
}
