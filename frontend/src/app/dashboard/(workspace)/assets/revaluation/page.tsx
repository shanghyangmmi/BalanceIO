"use client";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AssetRevaluationForm } from "@/components/assets/asset-revaluation-form";
export default function AssetRevaluationPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        {" "}
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Asset Revaluation
        </h2>{" "}
      </div>
      <div className="max-w-2xl">
        {" "}
        <RBACGuard permission={PERMISSIONS.AssetsManage} fallback={<NoPermission permission={PERMISSIONS.AssetsManage} />}>
          <AssetRevaluationForm />
        </RBACGuard>{" "}
      </div>{" "}
    </div>
  );
}
