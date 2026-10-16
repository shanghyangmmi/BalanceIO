"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { defaultAssets } from "@/lib/data/assets-data";
import { Search, Building2, MapPin, Hash, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AssetRegisterPage() {
  const { company } = useCompanyData();
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadAssets() {
      setIsLoading(true);
      try {
        const data = await apiClient.get<any[]>("/Assets").catch(() => null);
        if (data && Array.isArray(data) && data.length > 0) {
          setAssets(data);
        } else {
          setAssets(defaultAssets);
        }
      } catch (err) {
        console.error("Failed to load asset register", err);
        setAssets(defaultAssets);
      } finally {
        setIsLoading(false);
      }
    }
    loadAssets();
  }, []);

  const getStatusBadge = (status: any) => {
    const s = String(status || "ACTIVE").toUpperCase();
    if (s === "ACTIVE" || s === "1") {
      return <Badge className="bg-emerald-600 text-white font-mono text-xs">Active</Badge>;
    }
    if (s === "DISPOSED" || s === "2") {
      return <Badge variant="outline" className="text-amber-600 border-amber-400 font-mono text-xs">Disposed</Badge>;
    }
    if (s === "WRITTEN_OFF" || s === "3") {
      return <Badge variant="destructive" className="font-mono text-xs">Written Off</Badge>;
    }
    return <Badge variant="secondary" className="font-mono text-xs">{s}</Badge>;
  };

  const filteredAssets = assets.filter((a) => {
    const code = a.code || a.id || "";
    const name = a.name || "";
    const serial = a.serialNumber || "";
    const location = a.location || "";
    const category = a.category?.name || a.category || "";

    const matchesSearch =
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.toLowerCase().includes(searchTerm.toLowerCase());

    const s = String(a.status || "ACTIVE").toUpperCase();
    if (statusFilter === "active") return matchesSearch && (s === "ACTIVE" || s === "1");
    if (statusFilter === "disposed") return matchesSearch && (s === "DISPOSED" || s === "2" || s === "WRITTEN_OFF");

    return matchesSearch;
  });

  const totalCost = filteredAssets.reduce((acc, a) => acc + Number(a.cost || a.purchasePrice || 0), 0);
  const totalBookValue = filteredAssets.reduce((acc, a) => acc + Number(a.bookValue || (Number(a.cost || 0) - Number(a.accumulatedDepreciation || 0))), 0);
  const activeAssetsCount = assets.filter((a) => String(a.status || "ACTIVE").toUpperCase() === "ACTIVE" || String(a.status) === "1").length;

  return (
    <ReportLayout
      title="Fixed Asset Register"
      subtitle="Master asset register compliant with PSAK 201 & Tax Regulations"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Assets Cost Basis</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(totalCost, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Current Net Book Value</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(totalBookValue, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Active Assets</p>
              <h3 className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                {activeAssetsCount} Assets Active
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600">
              <Hash className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search code, serial #, location..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full text-xs font-medium self-start sm:self-auto">
          {[
            { id: "all", label: "All Assets" },
            { id: "active", label: "Active" },
            { id: "disposed", label: "Disposed / Written Off" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-full transition-all",
                statusFilter === tab.id
                  ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading asset register...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Asset Code</th>
              <th className="py-3 px-4 text-left">Asset Name & Category</th>
              <th className="py-3 px-4 text-left">Serial No & Location</th>
              <th className="py-3 px-4 text-center">Acquisition Date</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Cost Basis</th>
              <th className="py-3 px-4 text-right">Current Book Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((a) => {
              const code = a.code || a.id || "-";
              const name = a.name || "Fixed Asset";
              const category = a.category?.name || a.category || "General";
              const serial = a.serialNumber || "-";
              const location = a.location?.name || a.location || "General Office";
              const purchaseDate = a.purchaseDate || a.createdAt;
              const dateStr = purchaseDate ? format(new Date(purchaseDate), "dd MMM yyyy") : "-";
              const cost = Number(a.cost || a.purchasePrice || 0);
              const accDepr = Number(a.accumulatedDepreciation || 0);
              const bookVal = Number(a.bookValue || (cost - accDepr));

              return (
                <tr key={code} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-purple-600">{code}</td>
                  <td className="py-3 px-4 font-medium">
                    <div className="flex flex-col">
                      <span className="text-foreground font-semibold">{name}</span>
                      <span className="text-xs text-muted-foreground font-normal">{category}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="flex flex-col">
                      <span className="font-mono text-muted-foreground">{serial}</span>
                      <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-purple-500 inline" /> {location}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{dateStr}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(a.status)}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                    {formatCurrency(cost, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(bookVal, company?.currency)}
                  </td>
                </tr>
              );
            })}

            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No assets found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredAssets.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={5}>Total ({filteredAssets.length} Registered Assets)</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totalCost, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalBookValue, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
