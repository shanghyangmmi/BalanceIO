"use client";

import { useState, useEffect } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { AgedReportResponse } from "@/lib/types/reports";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Format currency
function formatAmount(amount: number): string {
  if (!amount || amount === 0) return "-";
  return amount.toLocaleString("id-ID");
}

export default function AgedReceivablesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<AgedReportResponse | null>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await apiClient.getReportsAgedReceivables();
        setData(response);
      } catch (error) {
        console.error("Failed to fetch Aged Receivables:", error);
        toast.error("Failed to load Aged Receivables report");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, []);

  if (isLoading) {
    return (
      <ReportLayout
        title="Aged Receivables Summary"
        subtitle="Accounts Receivable Aging Report"
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
      title="Aged Receivables Summary"
      subtitle="Accounts Receivable Aging Report"
      reportDate={new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6 no-print">
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            Total Receivables
          </p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatAmount(data.grandTotal)}
          </p>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
            Overdue (31+ Days)
          </p>
          <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
            {formatAmount(data.total60 + data.total90 + data.total90Plus)}
          </p>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            Severely Overdue (90+)
          </p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">
            {formatAmount(data.total90 + data.total90Plus)}
          </p>
        </div>
      </div>

      {/* Aging Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-zinc-900 dark:border-zinc-100">
            <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">
              Customer
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-24">
              Current
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-24">
              1-30 Days
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-24">
              31-60 Days
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-24">
              61-90 Days
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-24">
              &gt;90 Days
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-28">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row: any, i: number) => {
            return (
              <tr
                key={i}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-2">
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                    {row.contactName}
                  </span>
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatAmount(row.current)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatAmount(row.over30)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-yellow-600 dark:text-yellow-400">
                  {formatAmount(row.over60)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-orange-600 dark:text-orange-400">
                  {formatAmount(row.over90)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-red-600 dark:text-red-400 font-semibold">
                  {formatAmount(row.over90Plus)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatAmount(row.total)}
                </td>
              </tr>
            );
          })}

          {/* Totals Row */}
          <tr className="border-t-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 font-bold">
            <td className="py-3 text-zinc-900 dark:text-zinc-100">TOTAL</td>
            <td className="py-3 text-right font-mono tabular-nums">
              {formatAmount(data.totalCurrent)}
            </td>
            <td className="py-3 text-right font-mono tabular-nums">
              {formatAmount(data.total30)}
            </td>
            <td className="py-3 text-right font-mono tabular-nums text-yellow-700">
              {formatAmount(data.total60)}
            </td>
            <td className="py-3 text-right font-mono tabular-nums text-orange-700">
              {formatAmount(data.total90)}
            </td>
            <td className="py-3 text-right font-mono tabular-nums text-red-700">
              {formatAmount(data.total90Plus)}
            </td>
            <td className="py-3 text-right font-mono tabular-nums">
              {formatAmount(data.grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Notes */}
      <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          Aging is calculated based on invoice due date. Amounts in red indicate
          receivables requiring immediate collection action.
        </p>
      </div>
    </ReportLayout>
  );
}
