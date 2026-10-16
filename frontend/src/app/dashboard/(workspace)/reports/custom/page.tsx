"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { GeneralLedgerResponse } from "@/lib/types/reports";
import { toast } from "sonner";
import { Loader2, Download, Printer, Settings2, Search } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import { cn } from "@/lib/utils";

// Format currency
function formatAmount(amount: number): string {
    if (!amount || amount === 0) return "-";
    return amount.toLocaleString("id-ID");
}

type Column = {
    id: string;
    label: string;
    visible: boolean;
};

export default function CustomReportPage() {
    const [period, setPeriod] = useState("this-month");
    const [projectId, setProjectId] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<GeneralLedgerResponse | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Columns Configuration
    const [columns, setColumns] = useState<Column[]>([
        { id: "date", label: "Date", visible: true },
        { id: "reference", label: "Reference", visible: true },
        { id: "description", label: "Description", visible: true },
        { id: "account", label: "Account", visible: true },
        { id: "debit", label: "Debit", visible: true },
        { id: "credit", label: "Credit", visible: true },
        { id: "balance", label: "Running Balance", visible: true },
    ]);

    // Derive start and end dates based on the selected period
    const { start, end, reportStartStr, reportEndStr } = useMemo(() => {
        let startDate: Date;
        let endDate: Date;
        const now = new Date();

        switch (period) {
            case "this-month":
                startDate = startOfMonth(now);
                endDate = endOfMonth(now);
                break;
            case "last-month":
                startDate = startOfMonth(subMonths(now, 1));
                endDate = endOfMonth(subMonths(now, 1));
                break;
            case "this-year":
                startDate = startOfYear(now);
                endDate = endOfYear(now);
                break;
            case "last-year":
                startDate = startOfYear(subYears(now, 1));
                endDate = endOfYear(subYears(now, 1));
                break;
            default: // Default to this month
                startDate = startOfMonth(now);
                endDate = endOfMonth(now);
                break;
        }

        return {
            start: startDate!,
            end: endDate!,
            reportStartStr: format(startDate!, 'dd MMM yyyy'),
            reportEndStr: format(endDate!, 'dd MMM yyyy'),
        };
    }, [period]);

    async function fetchReport() {
        setIsLoading(true);
        try {
            // Fetch ALL accounts (undefined accountId)
            const response = await apiClient.getReportsGeneralLedger(start, end, undefined, projectId);
            setData(response);
        } catch (error) {
            console.error("Failed to fetch Custom Report data:", error);
            toast.error("Failed to load report data");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchReport();
    }, [period, projectId]);

    // Filtered Data
    const filteredLines = useMemo(() => {
        if (!data) return [];
        if (!searchQuery) return data.lines;

        const lowerQuery = searchQuery.toLowerCase();
        return data.lines.filter(line =>
            (line.description && line.description.toLowerCase().includes(lowerQuery)) ||
            (line.reference && line.reference.toLowerCase().includes(lowerQuery)) ||
            (line.accountCode && line.accountCode.toLowerCase().includes(lowerQuery)) ||
            (line.accountName && line.accountName.toLowerCase().includes(lowerQuery))
        );
    }, [data, searchQuery]);

    // Export to Excel
    const handleExportExcel = () => {
        if (!data) return;

        const rows = filteredLines.map(line => {
            const row: any = {};
            if (columns.find(c => c.id === "date")?.visible) row["Date"] = format(new Date(line.date), "yyyy-MM-dd");
            if (columns.find(c => c.id === "reference")?.visible) row["Reference"] = line.reference;
            if (columns.find(c => c.id === "description")?.visible) row["Description"] = line.description;
            if (columns.find(c => c.id === "account")?.visible) row["Account"] = `${line.accountCode} - ${line.accountName}`;
            if (columns.find(c => c.id === "debit")?.visible) row["Debit"] = line.debit;
            if (columns.find(c => c.id === "credit")?.visible) row["Credit"] = line.credit;
            if (columns.find(c => c.id === "balance")?.visible) row["Balance"] = line.balance;
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Custom Report");
        XLSX.writeFile(workbook, `CustomReport_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
        toast.success("Excel exported successfully");
    };

    // Print Logic
    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Custom Report - ${reportStartStr} to ${reportEndStr}`,
    });

    const toggleColumn = (id: string) => {
        setColumns(cols => cols.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
    };

    return (
        <ReportLayout
            title="Custom Report Builder"
            subtitle="Explore transactions with custom filters"
            periodStart={reportStartStr}
            periodEnd={reportEndStr}
            selectedPeriod={period}
            onPeriodChange={setPeriod}
            showProjectSelector={true}
            onProjectChange={setProjectId}
            selectedProjectId={projectId}
        >
            {/* Controls Bar (No Print) */}
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-6 no-print">

                {/* Search */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Search description, reference..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white dark:bg-zinc-900"
                    />
                </div>

                <div className="flex gap-2">
                    {/* Column Toggle */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Settings2 className="h-4 w-4" />
                                Columns
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {columns.map(col => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    checked={col.visible}
                                    onCheckedChange={() => toggleColumn(col.id)}
                                >
                                    {col.label}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Export Buttons */}
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
                        <Download className="h-4 w-4" />
                        Excel
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
                        <Printer className="h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <span className="ml-2 text-zinc-500">Loading live data...</span>
                </div>
            ) : (
                <div ref={componentRef} className="print:p-8">
                    {/* Print Header (Only visible when printing) */}
                    <div className="hidden print:block mb-6">
                        <h1 className="text-2xl font-bold text-zinc-900">Custom Transaction Report</h1>
                        <p className="text-sm text-zinc-500">Period: {reportStartStr} - {reportEndStr}</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-zinc-900 dark:border-zinc-100">
                                    {columns.map(col => col.visible && (
                                        <th key={col.id} className={cn(
                                            "py-2 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap px-2",
                                            (col.id === "debit" || col.id === "credit" || col.id === "balance") ? "text-right" : "text-left"
                                        )}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLines.length === 0 ? (
                                    <tr>
                                        <td colSpan={columns.filter(c => c.visible).length} className="py-8 text-center text-zinc-500 italic">
                                            No transactions found matching your criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLines.map((row: any, i: number) => (
                                        <tr key={i} className="group hover:bg-zinc-50 dark:hover:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800">
                                            {columns.find(c => c.id === "date")?.visible && (
                                                <td className="py-2 px-2 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                                    {format(new Date(row.date), 'yyyy-MM-dd')}
                                                </td>
                                            )}
                                            {columns.find(c => c.id === "reference")?.visible && (
                                                <td className="py-2 px-2 text-zinc-600 dark:text-zinc-400 font-mono text-xs whitespace-nowrap">
                                                    {row.reference}
                                                </td>
                                            )}
                                            {columns.find(c => c.id === "description")?.visible && (
                                                <td className="py-2 px-2 text-zinc-800 dark:text-zinc-200">
                                                    {row.description}
                                                </td>
                                            )}
                                            {columns.find(c => c.id === "account")?.visible && (
                                                <td className="py-2 px-2 text-zinc-500 text-xs">
                                                    <span className="font-mono font-medium">{row.accountCode}</span>
                                                    <span className="ml-2 text-zinc-400">{row.accountName}</span>
                                                </td>
                                            )}
                                            {columns.find(c => c.id === "debit")?.visible && (
                                                <td className="py-2 px-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                                                    {formatAmount(row.debit)}
                                                </td>
                                            )}
                                            {columns.find(c => c.id === "credit")?.visible && (
                                                <td className="py-2 px-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                                                    {formatAmount(row.credit)}
                                                </td>
                                            )}
                                            {columns.find(c => c.id === "balance")?.visible && (
                                                <td className="py-2 px-2 text-right font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                                                    {/* Balance in mixed view might be confusing, but we show it as calculated from start */}
                                                    {formatAmount(row.balance)}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {/* Totals Footer */}
                            <tfoot>
                                <tr className="border-t-2 border-zinc-900 dark:border-zinc-100 font-bold bg-zinc-50 dark:bg-zinc-900/50">
                                    {columns.map(col => {
                                        if (!col.visible) return null;
                                        if (col.id === "description") return <td key={col.id} className="py-3 px-2 text-right">Total:</td>;
                                        if (col.id === "debit") return <td key={col.id} className="py-3 px-2 text-right tabular-nums">{formatAmount(filteredLines.reduce((sum, l) => sum + l.debit, 0))}</td>;
                                        if (col.id === "credit") return <td key={col.id} className="py-3 px-2 text-right tabular-nums">{formatAmount(filteredLines.reduce((sum, l) => sum + l.credit, 0))}</td>;
                                        if (col.id === "balance") return <td key={col.id}></td>;
                                        return <td key={col.id}></td>;
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="mt-8 text-xs text-zinc-400 text-center print:block hidden">
                        Generated by BalanceIO on {format(new Date(), "PPpp")}
                    </div>
                </div>
            )}
        </ReportLayout>
    );
}
