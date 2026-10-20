import { AssetForm } from "@/components/assets/asset-form";
import { Suspense } from "react";
import { RBACGuard, NoPermission } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function NewAssetPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col space-y-2">
        {" "}
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Onboard New Asset
        </h2>{" "}
        <p className="text-muted-foreground">
          {" "}
          Register a new fixed asset and set up depreciation.{" "}
        </p>{" "}
      </div>{" "}
      <Suspense fallback={<div>Loading...</div>}>
        <RBACGuard permission={PERMISSIONS.AssetsManage} fallback={<NoPermission permission={PERMISSIONS.AssetsManage} />}>
<AssetForm />
</RBACGuard>
      </Suspense>
    </div>
  );
}
