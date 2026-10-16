"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
    ChevronLeft, Download, RefreshCw, TrendingUp, AlertTriangle, 
    CheckCircle2, AlertCircle, Sparkles, Filter, Calendar, 
    Layers, PieChart, ArrowUpRight, ArrowDownRight, Loader2
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatPercentage } from "@/lib/utils/formatter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface VarianceLine {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    budgetAmount: number;
    actualAmount: number;
    varianceAmount: number;
    variancePercentage: number;
    utilizationPercentage: number;
    varianceStatus: string; // "Favorable" vs "Unfavorable"
    alertLevel: string; // "Normal", "Warning", "OverBudget"
    warningThresholdPercentage: number;
    criticalThresholdPercentage: number;
}

interface VarianceReport {
    budgetId?: string;
    budgetName: string;
    fiscalYear: number;
    month?: number;
    quarter?: number;
    periodLabel: string;
    projectName?: string;
    totalBudgetedRevenue: number;
    totalActualRevenue: number;
    revenueVariance: number;
    totalBudgetedExpense: number;
    totalActualExpense: number;
    expenseVariance: number;
    totalBudget: number;
    totalActual: number;
    totalVariance: number;
    overallUtilizationPercentage: number;
    normalCount: number;
    warningCount: number;
    overBudgetCount: number;
    revenueLines: VarianceLine[];
    expenseLines: VarianceLine[];
    otherLines: VarianceLine[];
}

export default function BudgetVarianceReportPage() {
    const searchParams = useSearchParams();
    const queryBudgetId = searchParams.get("budgetId");
    const queryYear = searchParams.get("fiscalYear");

    const [fiscalYear, setFiscalYear] = React.useState<number>(
        queryYear ? parseInt(queryYear) : new Date().getFullYear()
    );
    const [periodFilter, setPeriodFilter] = React.useState<string>("all"); // "all", "m1".."m12", "q1".."q4"
    const [report, setReport] = React.useState<VarianceReport | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    const loadReport = React.useCallback(async () => {
        setIsLoading(true);
        try {
            let month: number | undefined = undefined;
            let quarter: number | undefined = undefined;

            if (periodFilter.startsWith("m")) {
                month = parseInt(periodFilter.replace("m", ""));
            } else if (periodFilter.startsWith("q")) {
                quarter = parseInt(periodFilter.replace("q", ""));
            }

            const data = await apiClient.getBudgetVarianceReport({
                fiscalYear,
                month,
                quarter,
                budgetId: queryBudgetId || undefined
            });

            setReport(data);
        } catch (error) {
            console.error("Failed to load budget variance report", error);
            toast.error("Gagal memuat laporan varians anggaran");
        } finally {
            setIsLoading(false);
        }
    }, [fiscalYear, periodFilter, queryBudgetId]);

    React.useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handleExportCSV = () => {
        if (!report) return;

        const headers = ["Tipe Akun", "Kode Akun", "Nama Akun", "Anggaran (Rp)", "Realisasi (Rp)", "Varians (Rp)", "Penyerapan (%)", "Status", "Peringatan"];
        const rows: string[][] = [];

        // Revenues
        report.revenueLines.forEach(l => {
            rows.push([
                "Pendapatan",
                l.accountCode,
                `"${l.accountName}"`,
                l.budgetAmount.toString(),
                l.actualAmount.toString(),
                l.varianceAmount.toString(),
                `${l.utilizationPercentage}%`,
                l.varianceStatus,
                l.alertLevel
            ]);
        });

        // Expenses
        report.expenseLines.forEach(l => {
            rows.push([
                "Beban Operasional",
                l.accountCode,
                `"${l.accountName}"`,
                l.budgetAmount.toString(),
                l.actualAmount.toString(),
                l.varianceAmount.toString(),
                `${l.utilizationPercentage}%`,
                l.varianceStatus,
                l.alertLevel
            ]);
        });

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Laporan_Varians_Anggaran_${report.fiscalYear}_${report.periodLabel.replace(/\s+/g, "_")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Laporan varians berhasil diekspor ke CSV");
    };

    return (
        <div className="flex-1 space-y-8 pb-12">
            {/* ── Masthead ─────────────────────────────────────────────── */}
            <header className="space-y-4">
                <Link
                    href="/dashboard/accounting/budgets"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="h-3 w-3" strokeWidth={2} />
                    Anggaran & RKAP
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            Laporan Varians Anggaran{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                Actual vs Budget.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Analisis komparatif realisasi pembukuan Buku Besar terhadap plafon anggaran yang telah disetujui ({report?.periodLabel || `Tahun ${fiscalYear}`}).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!report} className="gap-1.5 text-xs font-mono">
                            <Download className="h-3.5 w-3.5" />
                            Ekspor CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={loadReport} disabled={isLoading} className="gap-1.5 text-xs font-mono">
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </header>

            {/* ── Filters ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 border rounded-lg p-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-36">
                        <Select value={fiscalYear.toString()} onValueChange={v => setFiscalYear(parseInt(v))}>
                            <SelectTrigger className="text-xs font-mono h-8">
                                <SelectValue placeholder="Tahun Buku" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2025" className="text-xs font-mono">Tahun 2025</SelectItem>
                                <SelectItem value="2026" className="text-xs font-mono">Tahun 2026</SelectItem>
                                <SelectItem value="2027" className="text-xs font-mono">Tahun 2027</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="w-48">
                        <Select value={periodFilter} onValueChange={setPeriodFilter}>
                            <SelectTrigger className="text-xs font-mono h-8">
                                <SelectValue placeholder="Periode Waktu" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs font-mono">Sepanjang Tahun (12 Bulan)</SelectItem>
                                <SelectItem value="q1" className="text-xs font-mono">Kuartal 1 (Jan - Mar)</SelectItem>
                                <SelectItem value="q2" className="text-xs font-mono">Kuartal 2 (Apr - Jun)</SelectItem>
                                <SelectItem value="q3" className="text-xs font-mono">Kuartal 3 (Jul - Sep)</SelectItem>
                                <SelectItem value="q4" className="text-xs font-mono">Kuartal 4 (Okt - Des)</SelectItem>
                                <SelectItem value="m1" className="text-xs font-mono">Januari</SelectItem>
                                <SelectItem value="m2" className="text-xs font-mono">Februari</SelectItem>
                                <SelectItem value="m3" className="text-xs font-mono">Maret</SelectItem>
                                <SelectItem value="m4" className="text-xs font-mono">April</SelectItem>
                                <SelectItem value="m5" className="text-xs font-mono">Mei</SelectItem>
                                <SelectItem value="m6" className="text-xs font-mono">Juni</SelectItem>
                                <SelectItem value="m7" className="text-xs font-mono">Juli</SelectItem>
                                <SelectItem value="m8" className="text-xs font-mono">Agustus</SelectItem>
                                <SelectItem value="m9" className="text-xs font-mono">September</SelectItem>
                                <SelectItem value="m10" className="text-xs font-mono">Oktober</SelectItem>
                                <SelectItem value="m11" className="text-xs font-mono">November</SelectItem>
                                <SelectItem value="m12" className="text-xs font-mono">Desember</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {report && (
                    <div className="text-xs font-mono text-muted-foreground">
                        Anggaran Aktif: <strong className="text-foreground">{report.budgetName}</strong>
                    </div>
                )}
            </div>

            {/* ── KPI Summary Cards ────────────────────────────────────── */}
            {report && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Total Budget */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Total Pagu Belanja</CardDescription>
                            <CardTitle className="text-2xl font-bold font-money">
                                {formatCurrency(report.totalBudget)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Plafon anggaran periode {report.periodLabel}
                            </p>
                        </CardContent>
                    </Card>

                    {/* 2. Total Actual */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-400 font-semibold">
                                Total Realisasi Belanja
                            </CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-cyan-700 dark:text-cyan-400">
                                {formatCurrency(report.totalActual)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Total mutasi debit GL posted
                            </p>
                        </CardContent>
                    </Card>

                    {/* 3. Absorption Ratio */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Rasio Penyerapan</CardDescription>
                            <CardTitle className={`text-2xl font-bold font-money ${
                                report.overallUtilizationPercentage > 100 
                                    ? "text-destructive" 
                                    : report.overallUtilizationPercentage >= 80 
                                    ? "text-amber-700 dark:text-amber-400" 
                                    : "text-emerald-700 dark:text-emerald-400"
                            }`}>
                                {formatPercentage(report.overallUtilizationPercentage)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                            <Progress 
                                value={Math.min(report.overallUtilizationPercentage, 100)} 
                                className="h-1.5"
                            />
                        </CardContent>
                    </Card>

                    {/* 4. Alert Status */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Peringatan Anggaran</CardDescription>
                            <CardTitle className="text-2xl font-bold font-money">
                                {report.overBudgetCount > 0 ? (
                                    <span className="text-destructive flex items-center gap-1.5">
                                        <AlertCircle className="h-5 w-5" /> {report.overBudgetCount} Over-Budget
                                    </span>
                                ) : report.warningCount > 0 ? (
                                    <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                        <AlertTriangle className="h-5 w-5" /> {report.warningCount} Waspada
                                    </span>
                                ) : (
                                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle2 className="h-5 w-5" /> Aman
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                {report.normalCount} akun dalam batas normal
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ── Variance Tables ──────────────────────────────────────── */}
            {isLoading ? (
                <div className="flex h-48 items-center justify-center border rounded-lg bg-muted/20">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">Menghitung varians realisasi anggaran...</span>
                </div>
            ) : !report ? (
                <div className="p-8 text-center border rounded-lg text-muted-foreground font-mono text-xs">
                    Tidak ada data anggaran untuk ditampilkan.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Expense Accounts Table */}
                    <Card className="border-border/60 shadow-none">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="font-display text-base">Pos Belanja & Beban Operasional</CardTitle>
                                <CardDescription className="text-xs font-mono">
                                    Total {report.expenseLines.length} akun beban teralokasi
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono">
                                Plafon: {formatCurrency(report.totalBudgetedExpense)}
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Kode & Nama Akun</TableHead>
                                        <TableHead className="text-right">Plafon Anggaran</TableHead>
                                        <TableHead className="text-right">Realisasi GL</TableHead>
                                        <TableHead className="text-right">Varians (Sisa)</TableHead>
                                        <TableHead className="w-44 text-center">Penyerapan (%)</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-center">Peringatan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs font-mono">
                                    {report.expenseLines.map(line => {
                                        const isOver = line.alertLevel === "OverBudget";
                                        const isWarn = line.alertLevel === "Warning";

                                        return (
                                            <TableRow 
                                                key={line.accountId}
                                                className={`hover:bg-muted/30 transition-colors ${
                                                    isOver ? "bg-destructive/5" : isWarn ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                                                }`}
                                            >
                                                <TableCell>
                                                    <div className="font-bold text-foreground">{line.accountCode}</div>
                                                    <div className="font-sans text-[11px] text-muted-foreground">{line.accountName}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-money font-medium">
                                                    {formatCurrency(line.budgetAmount)}
                                                </TableCell>
                                                <TableCell className="text-right font-money font-bold text-foreground">
                                                    {formatCurrency(line.actualAmount)}
                                                </TableCell>
                                                <TableCell className="text-right font-money font-bold">
                                                    <span className={line.varianceAmount > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}>
                                                        {line.varianceAmount > 0 ? "+" : ""}{formatCurrency(line.varianceAmount)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-money">{formatPercentage(line.utilizationPercentage)}</span>
                                                        </div>
                                                        <Progress 
                                                            value={Math.min(line.utilizationPercentage, 100)} 
                                                            className={`h-1.5 ${
                                                                isOver ? "[&>div]:bg-destructive" : isWarn ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-600"
                                                            }`}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {line.varianceStatus === "Favorable" ? (
                                                        <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 font-mono">
                                                            Favorable (F)
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="text-[9px] font-mono">
                                                            Unfavorable (U)
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isOver ? (
                                                        <Badge variant="destructive" className="text-[9px] font-mono gap-1">
                                                            <AlertCircle className="h-2.5 w-2.5" /> Melampaui Pagu
                                                        </Badge>
                                                    ) : isWarn ? (
                                                        <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-50/60 font-mono gap-1">
                                                            <AlertTriangle className="h-2.5 w-2.5 text-amber-600" /> Waspada ({line.warningThresholdPercentage}%)
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 font-mono">
                                                            Normal
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Revenue Accounts Table */}
                    {report.revenueLines.length > 0 && (
                        <Card className="border-border/60 shadow-none">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="font-display text-base">Pos Target Pendapatan</CardTitle>
                                    <CardDescription className="text-xs font-mono">
                                        Total {report.revenueLines.length} akun pendapatan teralokasi
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="text-[10px] font-mono">
                                    Target: {formatCurrency(report.totalBudgetedRevenue)}
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Kode & Nama Akun</TableHead>
                                            <TableHead className="text-right">Target Pendapatan</TableHead>
                                            <TableHead className="text-right">Realisasi GL</TableHead>
                                            <TableHead className="text-right">Varians</TableHead>
                                            <TableHead className="w-44 text-center">Pencapaian (%)</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-xs font-mono">
                                        {report.revenueLines.map(line => (
                                            <TableRow key={line.accountId} className="hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <div className="font-bold text-foreground">{line.accountCode}</div>
                                                    <div className="font-sans text-[11px] text-muted-foreground">{line.accountName}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-money font-medium">
                                                    {formatCurrency(line.budgetAmount)}
                                                </TableCell>
                                                <TableCell className="text-right font-money font-bold text-foreground">
                                                    {formatCurrency(line.actualAmount)}
                                                </TableCell>
                                                <TableCell className="text-right font-money font-bold">
                                                    <span className={line.actualAmount >= line.budgetAmount ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                                                        {line.varianceAmount > 0 ? "+" : ""}{formatCurrency(line.varianceAmount)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="font-money">{formatPercentage(line.utilizationPercentage)}</span>
                                                        </div>
                                                        <Progress 
                                                            value={Math.min(line.utilizationPercentage, 100)} 
                                                            className="h-1.5 [&>div]:bg-cyan-600"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {line.varianceStatus === "Favorable" ? (
                                                        <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 font-mono">
                                                            Tercapai (F)
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-50/60 font-mono">
                                                            Di Bawah Target (U)
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
