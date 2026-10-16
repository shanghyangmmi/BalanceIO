"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, TrendingUp, DollarSign, ArrowUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductSalesSummary {
  productId: string;
  productCode: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  avgUnitPrice: number;
}

export default function SalesByProductPage() {
  const { company } = useCompanyData();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"revenue" | "qty" | "name">("revenue");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const data = await apiClient.getInvoices();
        setInvoices(data || []);
      } catch (err) {
        console.error("Failed to load invoices for sales by product report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Extract and group invoice lines by product
  const productMap = new Map<string, ProductSalesSummary>();

  invoices.forEach((inv) => {
    if (inv.status === "Draft" || inv.status === "Void" || inv.status === 0 || inv.status === 4) return;

    const lines = inv.lines || inv.invoiceLines || [];
    lines.forEach((line: any) => {
      const productId = line.productId || line.product?.id || line.description || "custom-item";
      const productCode = line.product?.code || line.productCode || "-";
      const productName = line.product?.name || line.description || "General Item / Service";
      const qty = Number(line.quantity || 1);
      const total = Number(line.lineTotal || (line.unitPrice * qty) || 0);

      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          productCode,
          productName,
          quantitySold: 0,
          totalRevenue: 0,
          avgUnitPrice: 0,
        });
      }

      const existing = productMap.get(productId)!;
      existing.quantitySold += qty;
      existing.totalRevenue += total;
      existing.avgUnitPrice = existing.quantitySold > 0 ? existing.totalRevenue / existing.quantitySold : 0;
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
    if (sortBy === "revenue") return (a.totalRevenue - b.totalRevenue) * multiplier;
    if (sortBy === "qty") return (a.quantitySold - b.quantitySold) * multiplier;
    return a.productName.localeCompare(b.productName) * multiplier;
  });

  const grandTotalRevenue = productList.reduce((acc, p) => acc + p.totalRevenue, 0);
  const grandTotalQty = productList.reduce((acc, p) => acc + p.quantitySold, 0);

  const toggleSort = (field: "revenue" | "qty" | "name") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <ReportLayout
      title="Sales by Product"
      subtitle="Product performance, quantity sold, and total revenue breakdown"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Revenue Generated</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(grandTotalRevenue, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Units Sold</p>
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
              <p className="text-xs font-medium text-muted-foreground">Distinct Items Sold</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {productList.length} Items
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Controls */}
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
            onClick={() => toggleSort("revenue")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "revenue" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Total Revenue <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort("qty")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "qty" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Qty Sold <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading sales by product report...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Code</th>
              <th className="py-3 px-4 text-left">Product / Item Description</th>
              <th className="py-3 px-4 text-center">Quantity Sold</th>
              <th className="py-3 px-4 text-right">Avg Unit Selling Price</th>
              <th className="py-3 px-4 text-right">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.productId} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{p.productCode}</td>
                <td className="py-3 px-4 font-medium text-foreground">{p.productName}</td>
                <td className="py-3 px-4 text-center font-mono font-semibold">
                  <Badge variant="secondary" className="font-mono">{p.quantitySold.toLocaleString()} units</Badge>
                </td>
                <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                  {formatCurrency(p.avgUnitPrice, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(p.totalRevenue, company?.currency)}
                </td>
              </tr>
            ))}

            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-muted-foreground">
                  No product sales data found.
                </td>
              </tr>
            )}
          </tbody>
          {filteredProducts.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={2}>Grand Total ({filteredProducts.length} Distinct Products)</td>
                <td className="py-3 px-4 text-center font-mono">{grandTotalQty.toLocaleString()} units</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotalRevenue, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
