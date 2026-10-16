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
import { apiClient } from "@/lib/api-client";
import { BalanceSheetResponse } from "@/lib/types/reports";
import {
  ReportLayout,
  ReportTable,
  ReportSection,
  ReportRow,
  ReportSpacer,
  ReportColumnHeaders,
} from "@/components/reports/report-layout";

// Mock Data for Balance Sheet


export default function BalanceSheetPage() {

  const [period, setPeriod] = useState("this-month");
  const [asOf, setAsOf] = useState<Date>(new Date());
  const [projectId, setProjectId] = useState("");
  const [ajeFilter, setAjeFilter] = useState("include");
  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  // The Balance Sheet is "as of" a specific date, not a period.
  // The 'period' state is kept for potential future use or if the layout component requires it,
  // but the actual report date is driven by 'asOf'.
  const reportDateStr = format(asOf, "d MMMM yyyy");

  const handleDrillDown = (accountCode: string) => {
    const params = new URLSearchParams();
    params.set("accountId", accountCode);
    // Balance Sheet usually 'As of', so GL history is relevant up to that date.
    // Default to start of month for context.
    params.set("endDate", format(asOf, 'yyyy-MM-dd'));
    params.set("startDate", format(startOfMonth(asOf), 'yyyy-MM-dd'));
    window.location.href = `/dashboard/reports/general-ledger?${params.toString()}`;
  };

  useEffect(() => {
    fetchReport();
  }, [asOf, projectId, ajeFilter]);

  async function fetchReport() {
    setIsLoading(true);
    try {
      const response = await apiClient.getReportsBalanceSheet(
        asOf, 
        projectId, 
        ajeFilter === "exclude", 
        ajeFilter === "only"
      );
      setData(response);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <ReportLayout
        title="Statement of Financial Position"
        subtitle="Balance Sheet Report"
        reportDate={format(asOf, "d MMMM yyyy")}
        showPeriodSelector={false}
        showProjectSelector={true}
        onProjectChange={setProjectId}
        selectedProjectId={projectId}
        showAjeSelector={true}
        selectedAje={ajeFilter}
        onAjeChange={setAjeFilter}
      >
        <div className="p-8 text-center text-zinc-500">Loading Financial Data...</div>
      </ReportLayout>
    );
  }

  return (
    <ReportLayout
      title="Statement of Financial Position"
      subtitle="Financial Position Report"
      reportDate={format(asOf, "d MMMM yyyy")}
      showPeriodSelector={false} // Balance Sheet is point-in-time
      showProjectSelector={true}
      onProjectChange={setProjectId}
      selectedProjectId={projectId}
      showAjeSelector={true}
      selectedAje={ajeFilter}
      onAjeChange={setAjeFilter}
    >
      {/* ASSETS */}
      <ReportSection title="Assets" level={1}>
        <ReportTable>
          <tbody>
            <ReportColumnHeaders
              currentLabel={reportDateStr}
            />

            {/* Current Assets */}
            <ReportRow label="Current Assets" amount="" isTotal={false} />
            {data.assets.current.accounts.map((acc: any) => (
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
              label="Total Current Assets"
              amount={data.assets.current.total}
              isTotal
              indent={1}
            />

            <ReportSpacer />

            {/* Non-Current Assets */}
            <ReportRow label="Non-Current Assets" amount="" isTotal={false} />
            {data.assets.nonCurrent.accounts.map((acc: any) => (
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
              label="Total Non-Current Assets"
              amount={data.assets.nonCurrent.total}
              isTotal
              indent={1}
            />

            <ReportSpacer />

            <ReportRow
              label="TOTAL ASSETS"
              amount={data.assets.total}
              isGrandTotal
            />
          </tbody>
        </ReportTable>
      </ReportSection>

      {/* LIABILITIES */}
      <ReportSection title="Liabilities" level={1}>
        <ReportTable>
          <tbody>
            {/* Current Liabilities */}
            <ReportRow label="Current Liabilities" amount="" isTotal={false} />
            {data.liabilities.current.accounts.map((acc: any) => (
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
              label="Total Current Liabilities"
              amount={data.liabilities.current.total}
              isTotal
              indent={1}
            />

            <ReportSpacer />

            {/* Non-Current Liabilities */}
            <ReportRow
              label="Non-Current Liabilities"
              amount=""
              isTotal={false}
            />
            {data.liabilities.nonCurrent.accounts.map((acc: any) => (
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
              label="Total Non-Current Liabilities"
              amount={data.liabilities.nonCurrent.total}
              isTotal
              indent={1}
            />

            <ReportSpacer />

            <ReportRow
              label="TOTAL LIABILITIES"
              amount={data.liabilities.total}
              isGrandTotal
            />
          </tbody>
        </ReportTable>
      </ReportSection>

      {/* EQUITY */}
      <ReportSection title="Equity" level={1}>
        <ReportTable>
          <tbody>
            {data.equity.accounts.map((acc: any) => (
              <ReportRow
                key={acc.code}
                code={acc.code}
                label={acc.name}
                amount={acc.balance}
                indent={1}
                onClick={() => handleDrillDown(acc.code)}
              />
            ))}

            <ReportSpacer />

            <ReportRow
              label="TOTAL EQUITY"
              amount={data.equity.total}
              isGrandTotal
            />
          </tbody>
        </ReportTable>
      </ReportSection>

      {/* TOTAL LIABILITIES & EQUITY */}
      <div className="mt-8 pt-4 border-t-2 border-zinc-900 dark:border-zinc-100">
        <ReportTable>
          <tbody>
            <ReportRow
              label="TOTAL LIABILITIES AND EQUITY"
              amount={data.liabilities.total + data.equity.total}
              isGrandTotal
            />
          </tbody>
        </ReportTable>
      </div>

      {/* Notes */}
      <div className="mt-8 pt-4 border-t border-dashed border-zinc-300 dark:border-zinc-700">
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          Generated automatically from BalanceIO Journal Entries.
        </p>
      </div>
    </ReportLayout>
  );
}
