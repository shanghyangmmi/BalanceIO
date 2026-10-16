"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, AlertTriangle, CheckCircle2, DollarSign, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StockOnHandPage() {
  const { company } = useCompanyData();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadProducts() {
      setIsLoading(true);
      try {
        const data = await apiClient.getProducts();
        setProducts(data || []);
      } catch (err) {
        console.error("Failed to load products for stock on hand report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadProducts();
  }, []);

  const getStockStatus = (qty: number, minQty: number = 5) => {
    if (qty <= 0) {
      return <Badge variant="destructive" className="font-mono text-xs">Out of Stock</Badge>;
    }
    if (qty <= minQty) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-400 font-mono text-xs flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Low Stock ({qty})
        </Badge>
      );
    }
    return <Badge className="bg-emerald-600 text-white font-mono text-xs">In Stock</Badge>;
  };

  const filteredProducts = products.filter((p) => {
    const code = p.code || "";
    const name = p.name || "";
    const category = p.category?.name || p.category || "";
    const matchesSearch =
      code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.toLowerCase().includes(searchTerm.toLowerCase());

    const qty = Number(p.stockOnHand || 0);
    const minQty = Number(p.minStockLevel || 5);

    if (statusFilter === "low") return matchesSearch && qty <= minQty && qty > 0;
    if (statusFilter === "out") return matchesSearch && qty <= 0;
    if (statusFilter === "in") return matchesSearch && qty > minQty;

    return matchesSearch;
  });

  const totalPhysicalQty = filteredProducts.reduce((acc, p) => acc + Number(p.stockOnHand || 0), 0);
  const totalValuation = filteredProducts.reduce((acc, p) => {
    const qty = Number(p.stockOnHand || 0);
    const price = Number(p.buyPrice || p.costPrice || 0);
    return acc + qty * price;
  }, 0);

  const lowStockCount = products.filter((p) => Number(p.stockOnHand || 0) <= Number(p.minStockLevel || 5)).length;

  return (
    <ReportLayout
      title="Stock-on-Hand"
      subtitle="Real-time physical inventory quantities, reorder status, and asset valuation"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Inventory Asset Valuation</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(totalValuation, company?.currency)}
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
              <p className="text-xs font-medium text-muted-foreground">Total Physical Units on Hand</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {totalPhysicalQty.toLocaleString()} Units
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Low Stock Alert Items</p>
              <h3 className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {lowStockCount} Items
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product SKU, name or category..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full text-xs font-medium self-start sm:self-auto">
          {[
            { id: "all", label: "All Items" },
            { id: "in", label: "In Stock" },
            { id: "low", label: "Low Stock Alert" },
            { id: "out", label: "Out of Stock" },
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
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading stock-on-hand report...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">SKU Code</th>
              <th className="py-3 px-4 text-left">Product Name & Category</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Physical Qty on Hand</th>
              <th className="py-3 px-4 text-right">Unit Cost Price</th>
              <th className="py-3 px-4 text-right">Unit Selling Price</th>
              <th className="py-3 px-4 text-right">Total Inventory Valuation</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const code = p.code || "SKU-ITEM";
              const name = p.name || "Product";
              const category = p.category?.name || p.category || "General";
              const qty = Number(p.stockOnHand || 0);
              const minQty = Number(p.minStockLevel || 5);
              const buyPrice = Number(p.buyPrice || p.costPrice || 0);
              const sellPrice = Number(p.sellPrice || p.price || 0);
              const totalVal = qty * buyPrice;

              return (
                <tr key={p.id || code} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-teal-600">{code}</td>
                  <td className="py-3 px-4 font-medium">
                    <div className="flex flex-col">
                      <span className="text-foreground font-semibold">{name}</span>
                      <span className="text-xs text-muted-foreground font-normal">{category}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">{getStockStatus(qty, minQty)}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    {qty.toLocaleString()} units
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                    {formatCurrency(buyPrice, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                    {formatCurrency(sellPrice, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalVal, company?.currency)}
                  </td>
                </tr>
              );
            })}

            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No stock items found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredProducts.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={3}>Grand Total ({filteredProducts.length} Distinct SKUs)</td>
                <td className="py-3 px-4 text-center font-mono">{totalPhysicalQty.toLocaleString()} units</td>
                <td className="py-3 px-4 text-right font-mono" colSpan={2}>-</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalValuation, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
