"use client";

import { useState, useEffect } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { CashFlowResponse } from "@/lib/types/reports";
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
import { useMemo } from "react";


// Format currency
function formatAmount(amount: number): string {
  if (!amount || amount === 0) return "-";
  return amount.toLocaleString("id-ID");
}

export default function CashFlowPage() {

  const [period, setPeriod] = useState("this-month");
  const [projectId, setProjectId] = useState("");
  const [ajeFilter, setAjeFilter] = useState("include");
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<CashFlowResponse | null>(null);

  const { start, end, reportStartStr, reportEndStr } = useMemo(() => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;
    let reportStart: string;
    let reportEnd: string;

    switch (period) {
      case "this-month":
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case "last-month":
        startDate = startOfMonth(subMonths(today, 1));
        endDate = endOfMonth(subMonths(today, 1));
        break;
      case "this-year":
        startDate = startOfYear(today);
        endDate = endOfYear(today);
        break;
      case "last-year":
        startDate = startOfYear(subYears(today, 1));
        endDate = endOfYear(subYears(today, 1));
        break;
      default:
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
    }

    reportStart = format(startDate, "dd MMM yyyy");
    reportEnd = format(endDate, "dd MMM yyyy");

    return { start: startDate, end: endDate, reportStartStr: reportStart, reportEndStr: reportEnd };
  }, [period]);

  useEffect(() => {
    async function fetchReport() {
      setIsLoading(true);
      try {
        const response = await apiClient.getReportsCashFlow(
          start,
          end,
          projectId,
          ajeFilter === "exclude",
          ajeFilter === "only"
        );
        setData(response);
      } catch (error) {
        console.error("Failed to fetch Cash Flow:", error);
        toast.error("Failed to load Cash Flow report");
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [period, projectId, start, end, ajeFilter]);

  if (isLoading) {
    return (
      <ReportLayout
        title="Statement of Cash Flows"
        subtitle="Indirect Method"
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

  const Section = ({ title, items }: { title: string, items: any[] }) => {
    const total = items.reduce((sum, item) => sum + item.balance, 0);
    return (
      <div className="mb-6">
        <h3 className="font-bold text-lg mb-3 text-zinc-800 dark:text-zinc-200 border-b border-zinc-200 dark:border-zinc-700 pb-1">{title}</h3>
        <table className="w-full text-sm">
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-zinc-50 dark:border-zinc-800/50">
                <td className="py-2 pl-4 text-zinc-600 dark:text-zinc-400">{item.name}</td>
                <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatAmount(item.balance)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-zinc-50 dark:bg-zinc-900/30">
              <td className="py-2 pl-4 text-zinc-900 dark:text-zinc-100 italic">Net Cash from {title}</td>
              <td className="py-2 text-right font-mono tabular-nums">{formatAmount(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <ReportLayout
      title="Statement of Cash Flows"
      subtitle="Indirect Method"
      reportDate={`${format(start, "dd MMM yyyy")} - ${format(end, "dd MMM yyyy")}`}
      selectedPeriod={period}
      onPeriodChange={setPeriod}
      showAjeSelector={true}
      selectedAje={ajeFilter}
      onAjeChange={setAjeFilter}
    >
      <Section title="Operating Activities" items={data.operatingActivities} />
      <Section title="Investing Activities" items={data.investingActivities} />
      <Section title="Financing Activities" items={data.financingActivities} />

      <div className="mt-8 border-t-2 border-zinc-900 dark:border-zinc-100 pt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-zinc-600 dark:text-zinc-400">Net Increase/(Decrease) in Cash</span>
          <span className="font-bold font-mono text-lg">{formatAmount(data.netCashChange)}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-zinc-600 dark:text-zinc-400">Cash at Beginning of Period</span>
          <span className="font-mono">{formatAmount(data.cashAtBeginning)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-dashed border-zinc-300 dark:border-zinc-700">
          <span className="font-bold text-lg text-emerald-700 dark:text-emerald-400">Cash at End of Period</span>
          <span className="font-bold font-mono text-xl text-emerald-700 dark:text-emerald-400">{formatAmount(data.cashAtEnd)}</span>
        </div>
      </div>
    </ReportLayout>
  );
}
