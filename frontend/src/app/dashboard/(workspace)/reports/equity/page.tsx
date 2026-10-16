"use client";

import { useState, useEffect, useMemo } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { EquityChangeResponse } from "@/lib/types/reports";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
} from "date-fns";


// Format currency
function formatAmount(amount: number): string {
  if (!amount || amount === 0) return "-";
  return amount.toLocaleString("id-ID");
}

export default function EquityPage() {

  const [period, setPeriod] = useState("this-month");
  const [projectId, setProjectId] = useState("");
  const [ajeFilter, setAjeFilter] = useState("include");
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<EquityChangeResponse | null>(null);

  const { start, end } = useMemo(() => {
    const today = new Date();
    switch (period) {
      case "this-month":
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case "last-month":
        return { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) };
      case "this-year":
        return { start: startOfYear(today), end: endOfYear(today) };
      case "last-year":
        return { start: startOfYear(subYears(today, 1)), end: endOfYear(subYears(today, 1)) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  }, [period]);

  const reportStartStr = format(start, "dd MMM yyyy");
  const reportEndStr = format(end, "dd MMM yyyy");

  useEffect(() => {
    async function fetchReport() {
      setIsLoading(true);
      try {
        const response = await apiClient.getReportsEquity(
          start,
          end,
          projectId,
          ajeFilter === "exclude",
          ajeFilter === "only"
        );
        setData(response);
      } catch (error) {
        console.error("Failed to fetch Equity:", error);
        toast.error("Failed to load Equity report");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [period, projectId, start, end, ajeFilter]); // Added start and end to dependencies as they are derived from period

  if (isLoading) {
    return (
      <ReportLayout
        title="Statement of Changes in Equity"
        subtitle="Movement in Shareholder Equity"
        reportDate={`${format(start, "dd MMM yyyy")} - ${format(end, "dd MMM yyyy")}`}
        selectedPeriod={period}
        onPeriodChange={setPeriod}
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
      title="Statement of Changes in Equity"
      subtitle="Movement in Shareholder Equity"
      reportDate={`${format(start, "dd MMM yyyy")} - ${format(end, "dd MMM yyyy")}`}
      selectedPeriod={period}
      onPeriodChange={setPeriod}
      showAjeSelector={true}
      selectedAje={ajeFilter}
      onAjeChange={setAjeFilter}
    >
      <div className="max-w-2xl mx-auto">
        {/* Opening */}
        <div className="flex justify-between items-center py-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Opening Balance</h3>
            <p className="text-xs text-zinc-500">As of {format(new Date(data.startDate), "dd MMM yyyy")}</p>
          </div>
          <span className="font-mono text-lg font-medium">{formatAmount(data.openingEquity)}</span>
        </div>

        {/* Movements */}
        <div className="py-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-600 dark:text-zinc-400">Net Income for Period</span>
            <span className={`font-mono ${data.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {data.netIncome >= 0 ? '+' : ''}{formatAmount(data.netIncome)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-600 dark:text-zinc-400">Capital Injections</span>
            <span className="font-mono text-emerald-600">
              +{formatAmount(data.capitalInjection)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-600 dark:text-zinc-400">Dividends / Drawings</span>
            <span className="font-mono text-red-600">
              -{formatAmount(Math.abs(data.dividends))}
            </span>
          </div>
        </div>

        {/* Closing */}
        <div className="flex justify-between items-center py-4 border-t-2 border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-900/50 px-4 rounded-lg">
          <div>
            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Closing Balance</h3>
            <p className="text-xs text-zinc-500">As of {format(new Date(data.endDate), "dd MMM yyyy")}</p>
          </div>
          <span className="font-mono text-xl font-bold text-zinc-900 dark:text-zinc-100">{formatAmount(data.closingEquity)}</span>
        </div>
      </div>
    </ReportLayout>
  );
}
