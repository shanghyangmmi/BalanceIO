"use client";

import { ProductForm } from "@/components/inventory/product-form";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">New Product</h2>
        <p className="text-muted-foreground">Create a new product or service to sell or purchase.</p>
      </div>

      <div className="mx-auto max-w-2xl">
        <RBACGuard permission={PERMISSIONS.InventoryManage} fallback={<NoPermission permission={PERMISSIONS.InventoryManage} />}>
<ProductForm />
</RBACGuard>
      </div>
    </div>
  );
}
