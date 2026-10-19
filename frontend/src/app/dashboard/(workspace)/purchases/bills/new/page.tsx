"use client"

import { BillForm } from "@/components/purchases/bill-form"
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewBillPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">Create Purchase Bill</h2>
      </div>
      <RBACGuard permission={PERMISSIONS.PurchasesCreate} fallback={<NoPermission permission={PERMISSIONS.PurchasesCreate} />}>
<BillForm />
</RBACGuard>
    </div>
  )
}
