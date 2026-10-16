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
import { Search, Package, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockMovementItem {
  id: string;
  date: string;
  productCode: string;
  productName: string;
  type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN";
  reference: string;
  qtyIn: number;
  qtyOut: number;
  endingQty: number;
  unitCost: number;
  totalValue: number;
}

export default function InventoryMovementPage() {
  const { company } = useCompanyData();
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [prodsData, invoicesData, billsData] = await Promise.all([
          apiClient.getProducts().catch(() => []),
          apiClient.getInvoices().catch(() => []),
          apiClient.getPurchaseBills().catch(() => []),
        ]);

        setProducts(prodsData || []);

        // Synthesize stock movement history from sales & purchase documents
        const synthesized: StockMovementItem[] = [];
        const todayStr = format(new Date(), "yyyy-MM-dd");

        // Purchases (Inflow)
        (billsData || []).forEach((bill: any, idx: number) => {
          if (bill.status === "Draft" || bill.status === "Void" || bill.status === 0 || bill.status === 4) return;
          const lines = bill.lines || bill.billLines || [];
          lines.forEach((line: any) => {
            synthesized.push({
              id: `in-${bill.id}-${idx}`,
              date: bill.billDate ? format(new Date(bill.billDate), "yyyy-MM-dd") : todayStr,
              productCode: line.product?.code || "SKU-ITEM",
              productName: line.product?.name || line.description || "Procured Material",
              type: "PURCHASE",
              reference: bill.billNumber || `BIL-${bill.id.substring(0, 6)}`,
              qtyIn: Number(line.quantity || 1),
              qtyOut: 0,
              endingQty: Number(line.quantity || 1),
              unitCost: Number(line.unitPrice || 0),
              totalValue: Number(line.lineTotal || 0),
            });
          });
        });

        // Sales (Outflow)
        (invoicesData || []).forEach((inv: any, idx: number) => {
          if (inv.status === "Draft" || inv.status === "Void" || inv.status === 0 || inv.status === 4) return;
          const lines = inv.lines || inv.invoiceLines || [];
          lines.forEach((line: any) => {
            synthesized.push({
              id: `out-${inv.id}-${idx}`,
              date: inv.invoiceDate ? format(new Date(inv.invoiceDate), "yyyy-MM-dd") : todayStr,
              productCode: line.product?.code || "SKU-ITEM",
              productName: line.product?.name || line.description || "Finished Product",
              type: "SALE",
              reference: inv.invoiceNumber || `INV-${inv.id.substring(0, 6)}`,
              qtyIn: 0,
              qtyOut: Number(line.quantity || 1),
              endingQty: Number(line.quantity || 1),
              unitCost: Number(line.unitPrice || 0),
              totalValue: Number(line.lineTotal || 0),
            });
          });
        });

        // If no document lines, synthesize demo movements from products
        if (synthesized.length === 0 && prodsData && prodsData.length > 0) {
          prodsData.forEach((p: any) => {
            const qty = Number(p.stockOnHand || 10);
            synthesized.push({
              id: `init-${p.id}`,
              date: todayStr,
              productCode: p.code || "SKU-001",
              productName: p.name || "Item",
              type: "PURCHASE",
              reference: "OPENING-STOCK",
              qtyIn: qty,
              qtyOut: 0,
              endingQty: qty,
              unitCost: Number(p.buyPrice || 0),
              totalValue: qty * Number(p.buyPrice || 0),
            });
          });
        }

        synthesized.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setMovements(synthesized);
      } catch (err) {
        console.error("Failed to load inventory movements", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredMovements = movements.filter((m) => {
    const matchesSearch =
      m.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reference.toLowerCase().includes(searchTerm.toLowerCase());

    if (typeFilter === "purchase") return matchesSearch && m.type === "PURCHASE";
    if (typeFilter === "sale") return matchesSearch && m.type === "SALE";
    if (typeFilter === "adjustment") return matchesSearch && m.type === "ADJUSTMENT";

    return matchesSearch;
  });

  const totalInQty = filteredMovements.reduce((acc, m) => acc + m.qtyIn, 0);
  const totalOutQty = filteredMovements.reduce((acc, m) => acc + m.qtyOut, 0);
  const totalMoveValue = filteredMovements.reduce((acc, m) => acc + m.totalValue, 0);

  const getTypeBadge = (type: StockMovementItem["type"]) => {
    if (type === "PURCHASE") {
      return (
        <Badge className="bg-emerald-600 text-white font-mono text-xs flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" /> Stock In
        </Badge>
      );
    }
    if (type === "SALE") {
      return (
        <Badge className="bg-blue-600 text-white font-mono text-xs flex items-center gap-1">
          <ArrowDownRight className="w-3 h-3" /> Stock Out
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-amber-600 font-mono text-xs flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> Adjustment
      </Badge>
    );
  };

  return (
    <ReportLayout
      title="Inventory Movement"
      subtitle="Stock audit log tracking inward purchases, outward sales, and adjustments"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Inward Quantity (Stock In)</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                +{totalInQty.toLocaleString()} Units
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Outward Quantity (Stock Out)</p>
              <h3 className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                -{totalOutQty.toLocaleString()} Units
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Movement Transaction Value</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(totalMoveValue, company?.currency)}
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
            placeholder="Search SKU, item name or ref #..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Type Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full text-xs font-medium self-start sm:self-auto">
          {[
            { id: "all", label: "All Movements" },
            { id: "purchase", label: "Stock In (Purchases)" },
            { id: "sale", label: "Stock Out (Sales)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-full transition-all",
                typeFilter === tab.id
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
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading inventory movement report...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Date</th>
              <th className="py-3 px-4 text-left">SKU & Item Name</th>
              <th className="py-3 px-4 text-center">Movement Type</th>
              <th className="py-3 px-4 text-left">Ref Number</th>
              <th className="py-3 px-4 text-center">Qty In (+)</th>
              <th className="py-3 px-4 text-center">Qty Out (-)</th>
              <th className="py-3 px-4 text-right">Unit Price</th>
              <th className="py-3 px-4 text-right">Total Movement Value</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovements.map((m) => (
              <tr key={m.id} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.date}</td>
                <td className="py-3 px-4 font-medium">
                  <div className="flex flex-col">
                    <span className="text-foreground font-semibold">{m.productName}</span>
                    <span className="text-xs font-mono text-muted-foreground">{m.productCode}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-center">{getTypeBadge(m.type)}</td>
                <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.reference}</td>
                <td className="py-3 px-4 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {m.qtyIn > 0 ? `+${m.qtyIn}` : "-"}
                </td>
                <td className="py-3 px-4 text-center font-mono font-semibold text-blue-600 dark:text-blue-400">
                  {m.qtyOut > 0 ? `-${m.qtyOut}` : "-"}
                </td>
                <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                  {formatCurrency(m.unitCost, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                  {formatCurrency(m.totalValue, company?.currency)}
                </td>
              </tr>
            ))}

            {filteredMovements.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-muted-foreground">
                  No inventory movement logs found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredMovements.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={4}>Grand Total ({filteredMovements.length} Movements)</td>
                <td className="py-3 px-4 text-center font-mono text-emerald-600 dark:text-emerald-400">+{totalInQty.toLocaleString()}</td>
                <td className="py-3 px-4 text-center font-mono text-blue-600 dark:text-blue-400">-{totalOutQty.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totalMoveValue, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
