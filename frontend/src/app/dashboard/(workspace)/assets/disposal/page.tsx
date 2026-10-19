"use client";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AssetDisposalForm } from "@/components/assets/asset-disposal-form";
export default function DisposalPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        {" "}
        <h2 className="text-3xl font-bold tracking-tight">
          Asset Disposal
        </h2>{" "}
      </div>
      <div className="max-w-3xl">
        {" "}
        <RBACGuard permission={PERMISSIONS.AssetsManage} fallback={<NoPermission permission={PERMISSIONS.AssetsManage} />}>
          <AssetDisposalForm />
        </RBACGuard>{" "}
      </div>{" "}
    </div>
  );
}
