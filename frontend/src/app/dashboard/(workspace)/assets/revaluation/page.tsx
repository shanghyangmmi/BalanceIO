"use client";
import { AssetRevaluationForm } from "@/components/assets/asset-revaluation-form";
export default function AssetRevaluationPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        {" "}
        <h2 className="text-3xl font-bold tracking-tight">
          Asset Revaluation
        </h2>{" "}
      </div>
      <div className="max-w-2xl">
        {" "}
        <AssetRevaluationForm />{" "}
      </div>{" "}
    </div>
  );
}
