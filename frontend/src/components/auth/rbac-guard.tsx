"use client"

import React from "react"
import { ShieldAlert } from "lucide-react"
import { usePermission } from "@/contexts/permission-context"
import type { Permission } from "@/lib/auth/permissions"

/**
 * Whether the current user holds a permission in the selected company.
 *
 * Fails closed: until permissions for the selected company are known the answer
 * is false, so a control the API would refuse is never shown, even briefly. The API remains the
 * enforcement point; this only keeps users from being offered what they cannot do.
 */
export function useCan() {
    const { hasPermission, isReady } = usePermission()
    return (permission: Permission) => isReady && hasPermission(permission)
}

interface RBACGuardProps {
    permission: Permission | Permission[]; // any of these grants access
    requireAll?: boolean;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Renders its children only for users holding the permission, the fallback for
 * users who do not, and nothing until that is known (so the fallback never
 * flashes for a user who is allowed).
 */
export function RBACGuard({ permission, requireAll = false, children, fallback = null }: RBACGuardProps) {
    const { isReady } = usePermission()
    const can = useCan()
    if (!isReady) return null
    const required = Array.isArray(permission) ? permission : [permission]
    const allowed = requireAll ? required.every(can) : required.some(can)
    return <>{allowed ? children : fallback}</>
}

/** Stands in for a page whose only purpose is an action the user cannot take. */
export function NoPermission({ permission }: { permission: Permission }) {
    return (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-foreground/10 bg-card/60 p-6 max-w-prose">
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-semibold">Your role cannot do this</p>
            <p className="text-sm text-muted-foreground">
                This page needs the <span className="font-mono">{permission}</span> permission in this company.
                Ask an Owner or Manager if you need it.
            </p>
        </div>
    )
}
