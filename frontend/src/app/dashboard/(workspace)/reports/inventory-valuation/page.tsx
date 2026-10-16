"use client";

import { useState, useEffect } from "react";
import { ReportLayout, ReportTable, ReportRow } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { InventoryValuationResponse } from "@/lib/types/reports";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function InventoryValuationPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<InventoryValuationResponse | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await apiClient.getReportsInventory();
        setData(response);
      } catch (error) {
        console.error("Failed to fetch Inventory Valuation:", error);
        toast.error("Failed to load Inventory Valuation report");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, []);

  if (isLoading) {
    return (
      <ReportLayout
        title="Inventory Valuation Summary"
        subtitle="Stock Value Report"
        reportDate={new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-2 text-zinc-500">Loading live data...</span>
        </div>
      </ReportLayout>
    );
  }

  if (!data) return null;

  return (
    <ReportLayout
      title="Inventory Valuation Summary"
      subtitle="Stock Value Report"
      reportDate={new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6 no-print">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Total Inventory Value
          </p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {data.totalValue.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
          </p>
        </div>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            Total Items
          </p>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
            {data.totalItems}
          </p>
        </div>
      </div>

      {/* Inventory Table */}
      <ReportTable>
        <thead>
          <tr className="border-b-2 border-zinc-900 dark:border-zinc-100">
            <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">Item Code</th>
            <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">Item Name</th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">Quantity</th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">Avg Cost</th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100">Total Value</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800">
              <td className="py-2 text-zinc-800 dark:text-zinc-200">{item.code}</td>
              <td className="py-2 text-zinc-800 dark:text-zinc-200">{item.name}</td>
              <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {item.quantity.toLocaleString("id-ID")}
              </td>
              <td className="py-2 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                {item.averageCost.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
              </td>
              <td className="py-2 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {item.totalValue.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 font-bold">
            <td className="py-3 text-zinc-900 dark:text-zinc-100" colSpan={4}>TOTAL INVENTORY VALUE</td>
            <td className="py-3 text-right tabular-nums">
              {data.totalValue.toLocaleString("id-ID", { style: "currency", currency: "IDR" })}
            </td>
          </tr>
        </tbody>
      </ReportTable>

      {/* Notes */}
      <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          Valuation based on Average Cost (Buy Price).
        </p>
      </div>
    </ReportLayout>
  );
}
