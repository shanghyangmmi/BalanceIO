"use client";

import { useState, useEffect } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { TrialBalanceResponse } from "@/lib/types/reports";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";


import { format } from "date-fns";

// Format currency
function formatAmount(amount: number): string {
  if (!amount || amount === 0) return "-";
  return amount.toLocaleString("id-ID");
}

export default function TrialBalancePage() {

  const [asOf, setAsOf] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("");
  const [ajeFilter, setAjeFilter] = useState("include");
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<TrialBalanceResponse | null>(null);

  const handleDrillDown = (accountCode: string) => {
    const today = new Date();
    const params = new URLSearchParams();
    params.set("accountId", accountCode);
    // TB is 'As Of' today usually, so link to GL for current month or Year to Date?
    // Default to start of month for now.
    params.set("startDate", format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd'));
    params.set("endDate", format(today, 'yyyy-MM-dd'));
    window.location.href = `/dashboard/reports/general-ledger?${params.toString()}`;
  };

  useEffect(() => {
    async function fetchReport() {
      setIsLoading(true);
      try {
        const response = await apiClient.getReportsTrialBalance(
          asOf, 
          projectId, 
          ajeFilter === "exclude", 
          ajeFilter === "only"
        );
        setData(response);
      } catch (error) {
        console.error("Failed to fetch Trial Balance:", error);
        toast.error("Failed to load Trial Balance report");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [asOf, projectId, ajeFilter]);

  if (isLoading) {
    return (
      <ReportLayout
        title="Trial Balance"
        subtitle="As of Today"
        reportDate={format(asOf, "d MMMM yyyy")}
        showPeriodSelector={false}
        showProjectSelector={true}
        onProjectChange={setProjectId}
        selectedProjectId={projectId}
        showAjeSelector={true}
        selectedAje={ajeFilter}
        onAjeChange={setAjeFilter}
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
      title="Trial Balance"
      subtitle="As of Today"
      reportDate={new Date().toLocaleDateString("en-GB", { day: 'numeric', month: 'long', year: 'numeric' })}
      showAjeSelector={true}
      selectedAje={ajeFilter}
      onAjeChange={setAjeFilter}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-zinc-900 dark:border-zinc-100">
            <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">
              Account Code
            </th>
            <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">
              Account Name
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-32">
              Debit
            </th>
            <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-32">
              Credit
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row: any, i: number) => {
            return (
              <tr
                key={i}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800 cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => handleDrillDown(row.code)}
              >
                <td className="py-2 text-zinc-600 dark:text-zinc-400 font-mono">
                  {row.code}
                </td>
                <td className="py-2 text-zinc-800 dark:text-zinc-200 font-medium">
                  {row.name}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatAmount(row.debit)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatAmount(row.credit)}
                </td>
              </tr>
            );
          })}

          {/* Totals Row */}
          <tr className="border-t-2 border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 font-bold">
            <td className="py-3 text-zinc-900 dark:text-zinc-100" colSpan={2}>TOTAL</td>
            <td className="py-3 text-right font-mono tabular-nums">
              {formatAmount(data.totalDebit)}
            </td>
            <td className="py-3 text-right font-mono tabular-nums">
              {formatAmount(data.totalCredit)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Validation Message */}
      {data.totalDebit !== data.totalCredit && (
        <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700">
          <div className="flex items-center text-red-600 dark:text-red-400">
            <span className="font-bold mr-2">⚠</span>
            <p className="text-sm font-medium">Balances do not match. Please review your journal entries.</p>
          </div>
        </div>
      )}
    </ReportLayout>
  );
}
