"use client";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { assetColumns } from "@/components/assets/asset-columns";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { PlusCircle, Calculator, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/formatter";
import Link from "next/link";
import { toast } from "sonner";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface AssetSummary {
  totalAssets: number;
  activeAssets: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalBookValue: number;
  fullyDepreciated: number;
  disposedThisYear: number;
}

export default function AssetsPage() {
    const can = useCan();
  const [assets, setAssets] = useState<any[]>([]);
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [assetsData, summaryData] = await Promise.all([
          apiClient.get<any[]>("/Assets"),
          apiClient.get<AssetSummary>("/Assets/summary"),
        ]);
        setAssets(assetsData);
        setSummary(summaryData);
      } catch (error) {
        console.error("Failed to fetch assets", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Assets
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Calculator className="mr-2 h-4 w-4" /> Run Depreciation
          </Button>
          {can(PERMISSIONS.AssetsManage) && <Link href="/dashboard/assets/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" /> New Asset
            </Button>
          </Link>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Asset Value (Cost)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary?.totalAcquisitionCost ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.totalAssets ?? 0} total assets ({summary?.activeAssets ?? 0} active)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Accumulated Depreciation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(summary?.totalAccumulatedDepreciation ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.fullyDepreciated ?? 0} fully depreciated
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Book Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(summary?.totalBookValue ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="h-full flex-1 flex-col space-y-8 md:flex">
        <DataTable
          data={assets}
          columns={assetColumns}
          filterColumn="name"
          filterPlaceholder="Search assets..."
        />
      </div>
    </div>
  );
}
