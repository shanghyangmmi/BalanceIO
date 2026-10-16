"use client";

import { useState, useEffect, useMemo } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { GeneralLedgerResponse } from "@/lib/types/reports";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Format currency
function formatAmount(amount: number): string {
    if (!amount || amount === 0) return "-";
    return amount.toLocaleString("id-ID");
}

import { useSearchParams } from "next/navigation";

// ... imports

export default function GeneralLedgerPage() {

    const searchParams = useSearchParams();

    const [period, setPeriod] = useState("this-month");
    const [accountId, setAccountId] = useState<string>("all");
    const [projectId, setProjectId] = useState("");
    const [ajeFilter, setAjeFilter] = useState("include");
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<GeneralLedgerResponse | null>(null);
    const [accounts, setAccounts] = useState<any[]>([]);

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

    useEffect(() => {
        // Fetch accounts list for filter
        async function fetchAccounts() {
            try {
                const response = await apiClient.get<any[]>("/Accounts");
                setAccounts(response);
            } catch (error) {
                console.error("Failed to fetch accounts:", error);
            }
        }
        fetchAccounts();
    }, []);

    async function fetchReport() {
        setIsLoading(true);
        try {
            const accId = accountId === "all" ? undefined : accountId;
            const response = await apiClient.getReportsGeneralLedger(
                start, 
                end, 
                accId, 
                projectId, 
                ajeFilter === "exclude", 
                ajeFilter === "only"
            );
            setData(response);
        } catch (error) {
            console.error("Failed to fetch General Ledger:", error);
            toast.error("Failed to load General Ledger report");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchReport();
    }, [period, accountId, projectId, ajeFilter]);

    return (
        <ReportLayout
            title="General Ledger"
            subtitle="Detail of transactions by account"
            periodStart={reportStartStr}
            periodEnd={reportEndStr}
            selectedPeriod={period}
            onPeriodChange={setPeriod}
            showProjectSelector={true}
            onProjectChange={setProjectId}
            selectedProjectId={projectId}
            showAjeSelector={true}
            selectedAje={ajeFilter}
            onAjeChange={setAjeFilter}
        >
            {/* Filters (No print) */}
            <div className="mb-6 flex gap-4 no-print items-end border-b border-zinc-200 dark:border-zinc-800 pb-6">
                <div className="flex flex-col">
                    <label className="text-xs font-medium text-zinc-500 mb-1 block">Account</label>
                    <Select value={accountId} onValueChange={(val) => setAccountId(val)}>
                        <SelectTrigger>
                            <SelectValue placeholder="All Accounts" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                            <SelectItem value="all">All Accounts</SelectItem>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>
                                    {acc.code} - {acc.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                    <span className="ml-2 text-zinc-500">Loading live data...</span>
                </div>
            ) : data ? (
                <table className="w-full text-sm">
                    {(() => {
                        const selectedAccount = accountId !== "all" && accountId !== "";
                        return (
                            <>
                                <thead>
                                    <tr className="border-b-2 border-zinc-900 dark:border-zinc-100">
                                        <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100 w-24">Date</th>
                                        <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100 w-32">Reference</th>
                                        <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">Description</th>
                                        {!selectedAccount && <th className="py-2 text-left font-bold text-zinc-900 dark:text-zinc-100 w-40">Account</th>}
                                        <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-28">Debit</th>
                                        <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-28">Credit</th>
                                        {selectedAccount && <th className="py-2 text-right font-bold text-zinc-900 dark:text-zinc-100 w-32">Balance</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedAccount && data?.startDate && (
                                        <tr className="bg-zinc-50 dark:bg-zinc-900/50 font-medium italic text-zinc-500">
                                            <td className="py-2">{format(new Date(data.startDate), 'yyyy-MM-dd')}</td>
                                            <td className="py-2">-</td>
                                            <td className="py-2">Opening Balance</td>
                                            {!selectedAccount && <td className="py-2"></td>}
                                            <td className="py-2 text-right">-</td>
                                            <td className="py-2 text-right">-</td>
                                            <td className="py-2 text-right">{formatAmount(data.openingBalance || 0)}</td>
                                        </tr>
                                    )}

                                    {data.lines.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800">
                                            <td className="py-2 text-zinc-600 dark:text-zinc-400">{row.date}</td>
                                            <td className="py-2 text-zinc-600 dark:text-zinc-400 font-mono text-xs">{row.reference}</td>
                                            <td className="py-2 text-zinc-800 dark:text-zinc-200">{row.description}</td>
                                            {!selectedAccount && (
                                                <td className="py-2 text-zinc-500 text-xs">
                                                    <span className="font-mono">{row.accountCode}</span><br />
                                                    {row.accountName}
                                                </td>
                                            )}
                                            <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatAmount(row.debit)}</td>
                                            <td className="py-2 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">{formatAmount(row.credit)}</td>
                                            {selectedAccount && <td className="py-2 text-right font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{formatAmount(row.balance)}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </>
                        );
                    })()}
                </table>

            ) : null
            }
        </ReportLayout >
    );
}
