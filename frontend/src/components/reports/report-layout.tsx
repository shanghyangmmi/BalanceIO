"use client"

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Calendar, Download, Printer, FileText, Settings2 } from "lucide-react";
import { ReportExports } from "./report-exports";
import { siteConfig } from "@/config/site";
import { useCompanyData } from "@/hooks/use-company-data";
import { ProjectSelect } from "@/components/projects/project-select";

interface ReportLayoutProps {
    title: string;
    subtitle?: string;
    reportDate?: string;
    periodStart?: string;
    periodEnd?: string;
    children: React.ReactNode;
    showPeriodSelector?: boolean;
    onPeriodChange?: (value: string) => void;
    selectedPeriod?: string;
    showCompareSelector?: boolean;
    onCompareChange?: (value: string) => void;
    selectedCompare?: string;
    showProjectSelector?: boolean;
    onProjectChange?: (value: string) => void;
    selectedProjectId?: string;
    showAjeSelector?: boolean;
    onAjeChange?: (value: string) => void;
    selectedAje?: string;
}

function getCurrencyName(code: string = "IDR") {
    const names: Record<string, string> = {
        "IDR": "Indonesian Rupiah",
        "USD": "United States Dollar",
        "EUR": "Euro",
        "SGD": "Singapore Dollar"
    }
    return names[code] || code
}

export function ReportLayout({
    title,
    subtitle,
    reportDate = "1 February 2026",
    periodStart,
    periodEnd,
    children,
    showPeriodSelector = true,
    onPeriodChange,
    selectedPeriod = "this-month",
    showCompareSelector = false,
    onCompareChange,
    selectedCompare = "none",
    showProjectSelector = false,
    onProjectChange,
    selectedProjectId,
    showAjeSelector = true,
    onAjeChange,
    selectedAje = "include"
}: ReportLayoutProps) {
    const { company } = useCompanyData();

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h2>
                    {subtitle && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {showPeriodSelector && (
                        <div className="flex items-center gap-2">
                            <Select value={selectedPeriod} onValueChange={onPeriodChange}>
                                <SelectTrigger className="w-[160px]">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Select Period" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="this-month">This Month</SelectItem>
                                    <SelectItem value="last-month">Last Month</SelectItem>
                                    <SelectItem value="this-quarter">This Quarter</SelectItem>
                                    <SelectItem value="this-year">This Year</SelectItem>
                                    <SelectItem value="custom">Custom Range</SelectItem>
                                </SelectContent>
                            </Select>

                            {showCompareSelector && (
                                <Select value={selectedCompare} onValueChange={onCompareChange}>
                                    <SelectTrigger className="w-[160px]">
                                        <FileText className="mr-2 h-4 w-4" />
                                        <SelectValue placeholder="Compare" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Comparison</SelectItem>
                                        <SelectItem value="previous-period">Previous Period</SelectItem>
                                        <SelectItem value="previous-year">Previous Year</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    {showProjectSelector && onProjectChange && (
                        <div className="w-[160px]">
                            <ProjectSelect
                                value={selectedProjectId === "" ? "all" : selectedProjectId} // Handle empty as "all" for select 
                                onChange={(val) => onProjectChange(val === "all" ? "" : val)}
                                placeholder="All Projects"
                                showAllOption
                            />
                        </div>
                    )}

                    {showAjeSelector && onAjeChange && (
                        <div className="w-[150px]">
                            <Select value={selectedAje} onValueChange={onAjeChange}>
                                <SelectTrigger>
                                    <Settings2 className="mr-2 h-4 w-4 text-emerald-600" />
                                    <SelectValue placeholder="AJE Filter" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="include">Include AJEs</SelectItem>
                                    <SelectItem value="exclude">Exclude AJEs</SelectItem>
                                    <SelectItem value="only">Only AJEs</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <ReportExports />
                </div>
            </div>

            {/* Professional Report Document */}
            <div
                id="report-content"
                className="bg-card rounded-xl border border-foreground/10 print:border-none overflow-hidden print:overflow-visible"
            >
                <table className="w-full">
                    <thead className="print:table-header-group bg-white dark:bg-zinc-950">
                        <tr>
                            <td>
                                {/* Report Header - Professional Style */}
                                <div className="border-b border-zinc-200 dark:border-zinc-800 p-8 pb-6">
                                    {/* Company Header */}
                                    <div className="text-center mb-6">
                                        <h1 className="text-lg font-bold tracking-wide text-zinc-900 dark:text-white uppercase">
                                            {company.name}
                                        </h1>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-lg mx-auto leading-relaxed">
                                            {company.address ? (
                                                <>
                                                    {company.address}
                                                    <br />
                                                </>
                                            ) : null}
                                            {company.city || "Jakarta"}, {company.country || "Indonesia"}
                                        </p>
                                        {(company.phone || company.email) && (
                                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                                {company.phone && <span>Ph: {company.phone}</span>}
                                                {company.phone && company.email && <span className="mx-2">•</span>}
                                                {company.email && <span>{company.email}</span>}
                                            </p>
                                        )}
                                    </div>

                                    {/* Report Title */}
                                    <div className="text-center border-t border-b border-zinc-300 dark:border-zinc-700 py-4 my-4">
                                        <h2 className="text-base font-bold tracking-widest text-zinc-800 dark:text-zinc-200 uppercase">
                                            {title}
                                        </h2>
                                        {periodStart && periodEnd ? (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                                For the Period {periodStart} to {periodEnd}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                                As of {reportDate}
                                            </p>
                                        )}
                                    </div>

                                    {/* Currency Note */}
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 text-right italic">
                                        (Expressed in {getCurrencyName(company.currency)}, unless otherwise stated)
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="p-8 font-['Times_New_Roman',_Georgia,_serif]">
                                {/* Report Body */}
                                {children}
                            </td>
                        </tr>
                    </tbody>
                    <tfoot className="print:table-footer-group bg-zinc-50 dark:bg-zinc-900/50">
                        <tr>
                            <td>
                                {/* Report Footer */}
                                <div className="border-t border-zinc-200 dark:border-zinc-800 p-6">
                                    <div className="flex justify-between items-end text-xs text-zinc-500 dark:text-zinc-400">
                                        <div>
                                            <p>Generated by {siteConfig.name}</p>
                                            <p className="text-[10px] mt-0.5">This report is computer-generated and requires no signature.</p>
                                        </div>
                                        <div className="text-right">
                                            <p>Report Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                            {/* Removed static "Page 1 of 1" as it's inaccurate in print */}
                                            <p className="text-[10px] mt-0.5">{company.name} Confidential</p>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div >
    )
}

/**
 * Professional table components for financial reports
 */
export function ReportTable({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <table className={`w-full text-sm border-collapse ${className || ''}`}>
            {children}
        </table>
    );
}

export function ReportSection({
    title,
    children,
    level = 1
}: {
    title: string;
    children: React.ReactNode;
    level?: 1 | 2 | 3;
}) {
    const titleStyles = {
        1: "text-base font-bold uppercase tracking-wide border-b-2 border-zinc-900 dark:border-zinc-100 pb-2 mb-4",
        2: "text-sm font-bold uppercase tracking-wide mb-3",
        3: "text-sm font-semibold mb-2 pl-4"
    };

    return (
        <div className="mb-6">
            <h3 className={titleStyles[level] + " text-zinc-900 dark:text-zinc-100"}>
                {title}
            </h3>
            <div className={level > 1 ? "pl-4" : ""}>
                {children}
            </div>
        </div>
    );
}

export function ReportRow({
    label,
    amount,
    previousAmount, // Optional for comparison
    code,
    isTotal = false,
    isGrandTotal = false,
    indent = 0,
    showUnderline = false,
    onClick
}: {
    label: string;
    amount: number | string;
    previousAmount?: number | string;
    code?: string;
    isTotal?: boolean;
    isGrandTotal?: boolean;
    indent?: number;
    showUnderline?: boolean;
    onClick?: () => void;
}) {
    const paddingLeft = indent * 20;

    if (isGrandTotal) {
        return (
            <tr className="border-t-2 border-b-4 border-double border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800">
                <td className="py-2 font-bold text-zinc-900 dark:text-zinc-100" style={{ paddingLeft }}>
                    {label}
                </td>
                <td className="py-2 text-right font-bold font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                    {typeof amount === 'number' ? formatReportCurrency(amount) : amount}
                </td>
                {previousAmount !== undefined && (
                    <td className="py-2 text-right font-bold font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {typeof previousAmount === 'number' ? formatReportCurrency(previousAmount) : previousAmount}
                    </td>
                )}
            </tr>
        );
    }

    if (isTotal) {
        return (
            <tr className={`border-t border-zinc-400 dark:border-zinc-600 ${showUnderline ? 'border-b' : ''}`}>
                <td className="py-1.5 font-semibold text-zinc-800 dark:text-zinc-200" style={{ paddingLeft }}>
                    {label}
                </td>
                <td className="py-1.5 text-right font-semibold font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                    {typeof amount === 'number' ? formatReportCurrency(amount) : amount}
                </td>
                {previousAmount !== undefined && (
                    <td className="py-1.5 text-right font-semibold font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                        {typeof previousAmount === 'number' ? formatReportCurrency(previousAmount) : previousAmount}
                    </td>
                )}
            </tr>
        );
    }

    return (
        <tr
            className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors ${onClick ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800' : ''}`}
            onClick={onClick}
        >
            <td className="py-1 text-zinc-700 dark:text-zinc-300" style={{ paddingLeft }}>
                {code && <span className="font-mono text-zinc-400 dark:text-zinc-500 text-xs mr-3">{code}</span>}
                {label}
            </td>
            <td className="py-1 text-right font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                {typeof amount === 'number' ? formatReportCurrency(amount) : amount}
            </td>
            {previousAmount !== undefined && (
                <td className="py-1 text-right font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                    {typeof previousAmount === 'number' ? formatReportCurrency(previousAmount) : previousAmount}
                </td>
            )}
        </tr>
    );
}

export function ReportColumnHeaders({ currentLabel, previousLabel }: { currentLabel: string, previousLabel?: string }) {
    if (!previousLabel) return null;
    return (
        <tr className="border-b border-zinc-900 dark:border-zinc-100">
            <td className="py-2 font-bold uppercase text-xs">Account</td>
            <td className="py-2 text-right font-bold uppercase text-xs w-[150px]">{currentLabel}</td>
            <td className="py-2 text-right font-bold uppercase text-xs w-[150px] text-zinc-500">{previousLabel}</td>
        </tr>
    );
}

export function ReportSpacer() {
    return <tr><td colSpan={2} className="py-2"></td></tr>;
}

// Format currency for reports (no symbol, with parentheses for negative)
function formatReportCurrency(amount: number): string {
    const formatted = Math.abs(amount).toLocaleString('id-ID');
    if (amount < 0) {
        return `(${formatted})`;
    }
    return formatted;
}
