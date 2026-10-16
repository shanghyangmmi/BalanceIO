"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, ShoppingBag, ArrowUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductPurchaseSummary {
  productId: string;
  productCode: string;
  productName: string;
  quantityPurchased: number;
  totalCostSpend: number;
  avgUnitCost: number;
}

export default function PurchasesByProductPage() {
  const { company } = useCompanyData();
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"spend" | "qty" | "name">("spend");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await apiClient.getPurchaseBills();
        setBills(data || []);
      } catch (err) {
        console.error("Failed to load purchase bills for product report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Group bill lines by product
  const productMap = new Map<string, ProductPurchaseSummary>();

  bills.forEach((bill) => {
    if (bill.status === "Draft" || bill.status === "Void" || bill.status === 0 || bill.status === 4) return;

    const lines = bill.lines || bill.billLines || [];
    lines.forEach((line: any) => {
      const productId = line.productId || line.product?.id || line.description || "custom-item";
      const productCode = line.product?.code || line.productCode || "-";
      const productName = line.product?.name || line.description || "General Item / Material";
      const qty = Number(line.quantity || 1);
      const total = Number(line.lineTotal || (line.unitPrice * qty) || 0);

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          productCode,
          productName,
          quantityPurchased: 0,
          totalCostSpend: 0,
          avgUnitCost: 0,
        });
      }

      const existing = productMap.get(productId)!;
      existing.quantityPurchased += qty;
      existing.totalCostSpend += total;
      existing.avgUnitCost = existing.quantityPurchased > 0 ? existing.totalCostSpend / existing.quantityPurchased : 0;
    });
  });

  const productList = Array.from(productMap.values());

  // Filter
  const filteredProducts = productList.filter(
    (p) =>
      p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.productCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort
  filteredProducts.sort((a, b) => {
    let multiplier = sortOrder === "desc" ? -1 : 1;
    if (sortBy === "spend") return (a.totalCostSpend - b.totalCostSpend) * multiplier;
    if (sortBy === "qty") return (a.quantityPurchased - b.quantityPurchased) * multiplier;
    return a.productName.localeCompare(b.productName) * multiplier;
  });

  const grandTotalSpend = productList.reduce((acc, p) => acc + p.totalCostSpend, 0);
  const grandTotalQty = productList.reduce((acc, p) => acc + p.quantityPurchased, 0);

  const toggleSort = (field: "spend" | "qty" | "name") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <ReportLayout
      title="Purchases by Product"
      subtitle="Raw materials and items procurement cost breakdown"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Procurement Spend</p>
              <h3 className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
                {formatCurrency(grandTotalSpend, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl text-orange-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Units Purchased</p>
              <h3 className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                {grandTotalQty.toLocaleString()} Units
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
              <p className="text-xs font-medium text-muted-foreground">Purchased Item Types</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {productList.length} Items
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product code or name..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sort by:</span>
          <button
            onClick={() => toggleSort("spend")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "spend" ? "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Total Cost Spend <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort("qty")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "qty" ? "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Qty Purchased <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading purchases by product report...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Code</th>
              <th className="py-3 px-4 text-left">Product / Item Description</th>
              <th className="py-3 px-4 text-center">Quantity Purchased</th>
              <th className="py-3 px-4 text-right">Avg Unit Cost Price</th>
              <th className="py-3 px-4 text-right">Total Procurement Spend</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.productId} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.productCode}</td>
                <td className="py-3 px-4 font-medium text-foreground">{p.productName}</td>
                <td className="py-3 px-4 text-center font-mono font-semibold">
                  <Badge variant="secondary" className="font-mono">{p.quantityPurchased.toLocaleString()} units</Badge>
                </td>
                <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                  {formatCurrency(p.avgUnitCost, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(p.totalCostSpend, company?.currency)}
                </td>
              </tr>
            ))}

            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  No product procurement data found.
                </td>
              </tr>
            )}
          </tbody>
          {filteredProducts.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={2}>Grand Total ({filteredProducts.length} Purchased Items)</td>
                <td className="py-3 px-4 text-center font-mono">{grandTotalQty.toLocaleString()} units</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right font-mono text-orange-600 dark:text-orange-400">{formatCurrency(grandTotalSpend, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
