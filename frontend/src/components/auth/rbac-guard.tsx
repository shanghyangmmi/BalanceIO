"use client"

import React from "react"
import { usePermission } from "@/contexts/permission-context"
import { Permission } from "@/lib/auth/permissions"

interface RBACGuardProps {
    permission: string | string[]; // Single permission or array (default "ANY")
    requireAll?: boolean; // If true, requires ALL permissions in array
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function RBACGuard({
    permission,
    requireAll = false,
    children,
    fallback = null
}: RBACGuardProps) {
    const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermission()

    // If loading, maybe show nothing or fallback? 
    // Usually better to wait, but depends on UX.
    if (isLoading) return null;

    // Normalize to array
    const permissions = Array.isArray(permission) ? permission : [permission];

    const allowed = requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);

    if (allowed) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
