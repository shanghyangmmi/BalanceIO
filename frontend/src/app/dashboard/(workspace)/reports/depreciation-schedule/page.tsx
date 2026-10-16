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
import { Search, Building2, TrendingDown, DollarSign, Calculator, Loader2 } from "lucide-react";

export default function DepreciationSchedulePage() {
  const { company } = useCompanyData();
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all font-semibold");

  useEffect(() => {
    async function loadAssets() {
      setIsLoading(true);
      try {
        const data = await apiClient.get<any[]>("/Assets").catch(() => null);
        if (data && Array.isArray(data) && data.length > 0) {
          setAssets(data);
        } else {
          // Fallback to default asset register demo data
          setAssets(defaultAssets);
        }
      } catch (err) {
        console.error("Failed to load assets for depreciation schedule", err);
        setAssets(defaultAssets);
      } finally {
        setIsLoading(false);
      }
    }
    loadAssets();
  }, []);

  const filteredAssets = assets.filter((a) => {
    const code = a.code || a.id || "";
    const name = a.name || "";
    const category = a.category?.name || a.category || "";
    const matchesSearch =
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedCategory !== "all font-semibold" && selectedCategory !== "all") {
      return matchesSearch && category.toLowerCase() === selectedCategory.toLowerCase();
    }
    return matchesSearch;
  });

  const totalCost = filteredAssets.reduce((acc, a) => acc + Number(a.cost || a.purchasePrice || 0), 0);
  const totalAccDepr = filteredAssets.reduce((acc, a) => acc + Number(a.accumulatedDepreciation || 0), 0);
  const totalBookValue = filteredAssets.reduce((acc, a) => acc + Number(a.bookValue || (Number(a.cost || 0) - Number(a.accumulatedDepreciation || 0))), 0);
  const monthlyDeprTotal = filteredAssets.reduce((acc, a) => {
    const cost = Number(a.cost || 0);
    const salvage = Number(a.salvageValue || 0);
    const months = Number(a.usefulLifeMonths || (a.usefulLifeYears ? a.usefulLifeYears * 12 : 48));
    const monthlyRate = months > 0 ? (cost - salvage) / months : 0;
    return acc + monthlyRate;
  }, 0);

  const categories = Array.from(new Set(assets.map((a) => a.category?.name || a.category).filter(Boolean)));

  return (
    <ReportLayout
      title="Depreciation Schedule"
      subtitle="Fixed asset depreciation schedule and net book value amortization"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Acquisition Cost</p>
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
              <p className="text-xs font-medium text-muted-foreground">Accumulated Depreciation</p>
              <h3 className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrency(totalAccDepr, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Net Book Value</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(totalBookValue, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Est. Monthly Depreciation</p>
              <h3 className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                {formatCurrency(monthlyDeprTotal, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600">
              <Calculator className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search asset code, name or category..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full text-xs font-medium self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-full transition-all ${
              selectedCategory === "all" || selectedCategory === "all font-semibold"
                ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat: any) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading depreciation schedule...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Asset Code</th>
              <th className="py-3 px-4 text-left">Asset Name & Category</th>
              <th className="py-3 px-4 text-center">Acquisition Date</th>
              <th className="py-3 px-4 text-center">Useful Life</th>
              <th className="py-3 px-4 text-right">Cost Basis</th>
              <th className="py-3 px-4 text-right">Monthly Depr.</th>
              <th className="py-3 px-4 text-right">Accumulated Depr.</th>
              <th className="py-3 px-4 text-right">Net Book Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((a) => {
              const code = a.code || a.id || "-";
              const name = a.name || "Fixed Asset";
              const category = a.category?.name || a.category || "General";
              const purchaseDate = a.purchaseDate || a.createdAt;
              const dateStr = purchaseDate ? format(new Date(purchaseDate), "dd MMM yyyy") : "-";
              const cost = Number(a.cost || a.purchasePrice || 0);
              const salvage = Number(a.salvageValue || 0);
              const months = Number(a.usefulLifeMonths || (a.usefulLifeYears ? a.usefulLifeYears * 12 : 48));
              const monthlyDepr = months > 0 ? (cost - salvage) / months : 0;
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
                  <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{dateStr}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs">
                    <Badge variant="outline" className="font-mono">{months} mos ({Math.round(months / 12)} yrs)</Badge>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                    {formatCurrency(cost, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-purple-600 dark:text-purple-400">
                    {formatCurrency(monthlyDepr, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">
                    {formatCurrency(accDepr, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(bookVal, company?.currency)}
                  </td>
                </tr>
              );
            })}

            {filteredAssets.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  No assets found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredAssets.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={4}>Grand Total ({filteredAssets.length} Assets)</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totalCost, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-purple-600 dark:text-purple-400">{formatCurrency(monthlyDeprTotal, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(totalAccDepr, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalBookValue, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
