import { AssetForm } from "@/components/assets/asset-form";
import { Suspense } from "react";

export default function NewAssetPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col space-y-2">
        {" "}
        <h2 className="text-3xl font-bold tracking-tight">
          Onboard New Asset
        </h2>{" "}
        <p className="text-muted-foreground">
          {" "}
          Register a new fixed asset and set up depreciation.{" "}
        </p>{" "}
      </div>{" "}
      <Suspense fallback={<div>Loading...</div>}>
        <AssetForm />
      </Suspense>
    </div>
  );
}
