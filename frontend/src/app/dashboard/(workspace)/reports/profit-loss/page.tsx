"use client";

import { useState, useEffect } from "react";

import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  startOfQuarter,
  endOfQuarter,
  subYears,
} from "date-fns";
import {
  ReportLayout,
  ReportTable,
  ReportSection,
  ReportRow,
  ReportColumnHeaders,
} from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { ProfitLossResponse } from "@/lib/types/reports";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ProfitLossPage() {

  const [period, setPeriod] = useState("this-month");
  const [projectId, setProjectId] = useState("");
  const [ajeFilter, setAjeFilter] = useState("include");
  const [compare, setCompare] = useState("none"); // Comparison logic pending backend support
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ProfitLossResponse | null>(null);

  // Calculate Dates based on Period
  const getDates = (p: string) => {
    const today = new Date();
    switch (p) {
      case "this-month":
        return {
          start: startOfMonth(today),
          end: endOfMonth(today),
          label: "This Month",
        };
      case "last-month":
        return {
          start: startOfMonth(subMonths(today, 1)),
          end: endOfMonth(subMonths(today, 1)),
          label: "Last Month",
        };
      case "this-quarter":
        return {
          start: startOfQuarter(today),
          end: endOfQuarter(today),
          label: "This Quarter",
        };
      case "this-year":
        return { start: startOfYear(today), end: today, label: "This Year" };
      case "today":
        return { start: today, end: today, label: "Today" };
      default:
        return {
          start: startOfMonth(today),
          end: endOfMonth(today),
          label: "Custom",
        };
    }
  };

  const { start, end } = getDates(period);
  const reportStartStr = format(start, "d MMMM yyyy");
  const reportEndStr = format(end, "d MMMM yyyy");

  // helper for drill down
  const handleDrillDown = (accountCode: string) => {
    const params = new URLSearchParams();
    params.set("accountId", accountCode);
    params.set("startDate", format(start, 'yyyy-MM-dd'));
    params.set("endDate", format(end, 'yyyy-MM-dd'));
    if (projectId) params.set("projectId", projectId);
    window.location.href = `/dashboard/reports/general-ledger?${params.toString()}`;
  };

  useEffect(() => {
    async function fetchReport() {
      setIsLoading(true);
      try {
        const response = await apiClient.getReportsProfitLoss(
          start, 
          end, 
          projectId, 
          ajeFilter === "exclude", 
          ajeFilter === "only"
        );
        setData(response);
      } catch (error) {
        console.error("Failed to fetch P&L:", error);
        toast.error("Failed to load Profit & Loss report");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [period, projectId, ajeFilter]);

  if (isLoading && !data) {
    return (
      <ReportLayout
        title="Statement of Profit or Loss"
        subtitle="Income Statement"
        periodStart={reportStartStr}
        periodEnd={reportEndStr}
        selectedPeriod={period}
        onPeriodChange={setPeriod}
        showProjectSelector={true}
        onProjectChange={setProjectId}
        selectedProjectId={projectId}
        showCompareSelector={false} // Hidden for now
        showAjeSelector={true}
        selectedAje={ajeFilter}
        onAjeChange={setAjeFilter}
      >
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-2 text-zinc-500">Loading live data...</span>
        </div>
      </ReportLayout>
    )
  }

  if (!data) return null;

  return (
    <ReportLayout
      title="Statement of Profit or Loss and Other Comprehensive Income"
      subtitle="Comprehensive Income Report"
      periodStart={reportStartStr}
      periodEnd={reportEndStr}
      selectedPeriod={period}
      onPeriodChange={setPeriod}
      showProjectSelector={true}
      onProjectChange={setProjectId}
      selectedProjectId={projectId}
      showCompareSelector={false}
      selectedCompare={compare}
      onCompareChange={setCompare}
      showAjeSelector={true}
      selectedAje={ajeFilter}
      onAjeChange={setAjeFilter}
    >
      {/* REVENUE */}
      <ReportSection title="Revenue" level={1}>
        <ReportTable>
          <tbody>
            <ReportColumnHeaders
              currentLabel={format(end, "MMM yyyy")}
            />

            {data.revenue.accounts.map((acc: any) => (
              <ReportRow
                key={acc.code}
                code={acc.code}
                label={acc.name}
                amount={acc.balance}
                indent={1}
                onClick={() => handleDrillDown(acc.code)}
              />
            ))}
            <ReportRow
              label="Total Revenue"
              amount={data.revenue.total}
              isTotal
            />
          </tbody>
        </ReportTable>
      </ReportSection>

      {/* COST OF SALES */}
      <ReportSection title="Cost of Sales" level={1}>
        <ReportTable>
          <tbody>
            {data.cogs.accounts.map((acc: any) => (
              <ReportRow
                key={acc.code}
                code={acc.code}
                label={acc.name}
                amount={acc.balance}
                indent={1}
                onClick={() => handleDrillDown(acc.code)}
              />
            ))}
            <ReportRow
              label="Total Cost of Sales"
              amount={data.cogs.total}
              isTotal
            />
          </tbody>
        </ReportTable>
      </ReportSection>

      {/* GROSS PROFIT */}
      <div className="my-4">
        <ReportTable>
          <tbody>
            <ReportRow
              label="GROSS PROFIT"
              amount={data.grossProfit}
              isGrandTotal
            />
          </tbody>
        </ReportTable>
      </div>

      {/* EXPENSES */}
      <ReportSection title="Expenses" level={1}>
        <ReportTable>
          <tbody>
            {data.expenses.accounts.map((acc: any) => (
              <ReportRow
                key={acc.code}
                code={acc.code}
                label={acc.name}
                amount={acc.balance}
                indent={1}
                onClick={() => handleDrillDown(acc.code)}
              />
            ))}
            <ReportRow
              label="Total Expenses"
              amount={data.expenses.total}
              isTotal
            />
          </tbody>
        </ReportTable>
      </ReportSection>

      {/* NET INCOME */}
      <div className="mt-6 pt-4 border-t-2 border-zinc-900 dark:border-zinc-100">
        <ReportTable>
          <tbody>
            <tr className="border-t-2 border-b-4 border-double border-emerald-700 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30">
              <td className="py-3 font-bold text-lg text-emerald-800 dark:text-emerald-300">
                NET INCOME
              </td>
              <td className="py-3 text-right font-bold text-lg font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
                {data.netIncome?.toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tbody>
        </ReportTable>
      </div>

      {/* Notes */}
      <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          Generated from live data.
        </p>
      </div>
    </ReportLayout>
  );
}
