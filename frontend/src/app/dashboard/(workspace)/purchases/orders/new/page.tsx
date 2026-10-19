"use client"

import { OrderForm } from "@/components/purchases/order-form"
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewOrderPage() {
    return (
        <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight text-gradient">Create Purchase Order</h2>
            </div>
            <RBACGuard permission={PERMISSIONS.PurchasesCreate} fallback={<NoPermission permission={PERMISSIONS.PurchasesCreate} />}>
<OrderForm />
</RBACGuard>
        </div>
    )
}
