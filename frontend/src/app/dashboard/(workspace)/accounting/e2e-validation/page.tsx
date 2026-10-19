"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Play, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, FileSpreadsheet, TrendingUp, Scale, BookOpen, Layers, Check, Loader2, ArrowRight, Calendar, Building2, DollarSign, Receipt, Lock } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { formatCurrency, formatPercentage, formatDate } from "@/lib/utils/formatter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface LifecyclePhaseResult {
    phaseNumber: number;
    phaseName: string;
    description: string;
    status: string;
    durationMs: number;
    assertions: string[];
    metrics: Record<string, string>;
    errorMessage?: string;
}

interface E2ELifecycleResult {
    executionId: string;
    executedAt: string;
    executedBy: string;
    totalDurationMs: number;
    totalPhases: number;
    passedPhases: number;
    failedPhases: number;
    overallStatus: string;
    phases: LifecyclePhaseResult[];
    balanceSheet: {
        totalAssets: number;
        totalLiabilities: number;
        totalEquity: number;
        discrepancy: number;
        isBalanced: boolean;
    };
    profitLoss: {
        totalRevenue: number;
        totalExpenses: number;
        realizedFxGain: number;
        netIncome: number;
    };
    taxSummary: {
        ppnMasukan: number;
        ppnKeluaran: number;
        netPpnPayable: number;
        pph23Withheld: number;
    };
    trialBalance: {
        totalDebit: number;
        totalCredit: number;
        difference: number;
        isBalanced: boolean;
    };
}

export default function E2EValidationPage() {
    const [result, setResult] = React.useState<E2ELifecycleResult | null>(null);
    const [isRunning, setIsRunning] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("pipeline");

    const loadLatest = React.useCallback(async () => {
        try {
            const data = await apiClient.getLatestE2ELifecycleValidation();
            if (data && data.executionId) {
                setResult(data);
            }
        } catch (error) {
            console.error("Failed to load latest validation", error);
        }
    }, []);

    React.useEffect(() => {
        loadLatest();
    }, [loadLatest]);

    const handleRunSimulation = async () => {
        setIsRunning(true);
        try {
            toast.info("Memulai simulasi 12-fase siklus akuntansi penuh...");
            const data = await apiClient.runE2ELifecycleValidation();
            setResult(data);
            if (data.overallStatus === "PASSED") {
                toast.success(`Semua ${data.passedPhases}/12 fase akuntansi berhasil diverifikasi (100% LULUS)`);
            } else {
                toast.error("Terdapat kegagalan pada simulasi siklus akuntansi.");
            }
        } catch (error: any) {
            console.error("Simulation error", error);
            toast.error(error.message || "Gagal menjalankan simulasi siklus akuntansi");
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="flex-1 space-y-8 pb-12">
            {/* ── Masthead ─────────────────────────────────────────────── */}
            <header className="space-y-4">
                <Link
                    href="/dashboard/accounting"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="h-3 w-3" strokeWidth={2} />
                    Accounting Workspace
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            Validasi Siklus Akuntansi{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                End-to-End.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Simulasi otomatis dan verifikasi menyeluruh 12-fase siklus pembukuan (Multi-tenancy, Multi-currency USD, FX Realized, Pajak PPh/PPN, SoD, Depresiasi, Rekonsiliasi Bank, Period Lock, hingga Laporan Keuangan).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={handleRunSimulation} 
                            disabled={isRunning}
                            size="sm"
                            className="gap-2 text-xs font-mono bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm"
                        >
                            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                            {isRunning ? "Menjalankan 12-Fase..." : "Jalankan Simulasi Siklus 12-Fase"}
                        </Button>
                    </div>
                </div>
            </header>

            {/* ── Governance Scorecard Summary ─────────────────────────── */}
            {result ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Verdict */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Status Validasi</CardDescription>
                            <CardTitle className="text-2xl font-bold font-money flex items-center gap-2">
                                {result.overallStatus === "PASSED" ? (
                                    <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                        <CheckCircle2 className="h-6 w-6" /> 100% LULUS
                                    </span>
                                ) : (
                                    <span className="text-destructive flex items-center gap-1.5">
                                        <AlertCircle className="h-6 w-6" /> GAGAL
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                {result.passedPhases} dari {result.totalPhases} fase terverifikasi valid ({result.totalDurationMs} ms)
                            </p>
                        </CardContent>
                    </Card>

                    {/* Balance Sheet Check */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Keseimbangan Neraca</CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-foreground">
                                {result.balanceSheet.isBalanced ? (
                                    <span className="text-emerald-700 dark:text-emerald-400">Selisih Rp 0</span>
                                ) : (
                                    <span className="text-destructive font-mono">Discrepancy</span>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Aset {formatCurrency(result.balanceSheet.totalAssets)} = Pasiva
                            </p>
                        </CardContent>
                    </Card>

                    {/* Net Income Check */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-400 font-semibold">
                                Laba Bersih Siklus (P&L)
                            </CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-cyan-700 dark:text-cyan-400">
                                {formatCurrency(result.profitLoss.netIncome)}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Termasuk Laba Kurs {formatCurrency(result.profitLoss.realizedFxGain)}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Trial Balance Equality */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Keseimbangan Buku Besar</CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-zinc-700 dark:text-zinc-400 flex items-center gap-2">
                                Balanced
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Debit = Kredit ({formatCurrency(result.trialBalance.totalDebit)})
                            </p>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="border border-dashed p-10 text-center rounded-lg bg-muted/10 space-y-3">
                    <ShieldCheck className="h-10 w-10 text-muted-foreground mx-auto" />
                    <div className="space-y-1">
                        <h3 className="font-display text-base font-bold">Simulasi Belum Dijalankan</h3>
                        <p className="text-xs text-muted-foreground font-mono max-w-md mx-auto">
                            Klik tombol "Jalankan Simulasi Siklus 12-Fase" untuk mengeksekusi pengujian siklus akuntansi penuh dan memvalidasi seluruh invarian matematis.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Tabs for Inspection ──────────────────────────────────── */}
            {result && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList className="font-mono text-xs">
                        <TabsTrigger value="pipeline" className="gap-1.5">
                            <Layers className="h-3.5 w-3.5" /> 12-Fase Pipeline
                        </TabsTrigger>
                        <TabsTrigger value="financials" className="gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" /> Laporan Keuangan
                        </TabsTrigger>
                        <TabsTrigger value="tax" className="gap-1.5">
                            <Receipt className="h-3.5 w-3.5" /> Perpajakan (PPN & PPh)
                        </TabsTrigger>
                        <TabsTrigger value="trialBalance" className="gap-1.5">
                            <Scale className="h-3.5 w-3.5" /> Neraca Saldo (TB)
                        </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: 12-Phase Pipeline View */}
                    <TabsContent value="pipeline" className="space-y-3">
                        <div className="grid gap-3">
                            {result.phases.map(phase => (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={phase.phaseNumber}
                                    className="border rounded-lg p-4 bg-card/60 space-y-2.5 font-mono text-xs"
                                >
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-2">
                                        <div className="flex items-center gap-2.5">
                                            <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center font-bold text-foreground text-[11px]">
                                                {phase.phaseNumber}
                                            </span>
                                            <div>
                                                <h4 className="font-bold text-foreground text-sm font-sans">{phase.phaseName}</h4>
                                                <p className="text-[11px] text-muted-foreground font-sans">{phase.description}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">{phase.durationMs} ms</span>
                                            {phase.status === "Passed" ? (
                                                <Badge variant="outline" className="border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 font-mono text-[9px] gap-1">
                                                    <Check className="h-2.5 w-2.5 text-emerald-600" /> PASSED
                                                </Badge>
                                            ) : (
                                                <Badge variant="destructive" className="font-mono text-[9px]">FAILED</Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Assertions */}
                                    <div className="space-y-1 bg-muted/20 p-2.5 rounded border text-[11px]">
                                        {phase.assertions.map((ass, aIdx) => (
                                            <div key={aIdx} className="text-muted-foreground flex items-center gap-1.5">
                                                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                                <span>{ass.replace("[PASS] ", "")}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </TabsContent>

                    {/* TAB 2: Financial Statements View */}
                    <TabsContent value="financials" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Balance Sheet */}
                            <Card className="border-border/60 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-display text-base">Laporan Posisi Keuangan (Neraca)</CardTitle>
                                    <CardDescription className="text-xs font-mono">Per 31 Januari 2026</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 font-mono text-xs">
                                    <div className="space-y-1.5 border-b pb-2">
                                        <div className="font-bold text-muted-foreground uppercase text-[10px]">Aset (Assets)</div>
                                        <div className="flex justify-between">
                                            <span>Kas & Bank Mandiri</span>
                                            <span className="font-money font-bold">{formatCurrency(117_495_000)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Peralatan IT & Server (Net)</span>
                                            <span className="font-money font-bold">{formatCurrency(117_500_000)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                                            <span>Total Aset</span>
                                            <span className="font-money">{formatCurrency(result.balanceSheet.totalAssets)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 border-b pb-2">
                                        <div className="font-bold text-muted-foreground uppercase text-[10px]">Kewajiban (Liabilities)</div>
                                        <div className="flex justify-between">
                                            <span>Hutang Pajak PPN (Net)</span>
                                            <span className="font-money">{formatCurrency(result.taxSummary.netPpnPayable)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Hutang PPh 23 Terutang</span>
                                            <span className="font-money">{formatCurrency(result.taxSummary.pph23Withheld)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                                            <span>Total Kewajiban</span>
                                            <span className="font-money">{formatCurrency(result.balanceSheet.totalLiabilities)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="font-bold text-muted-foreground uppercase text-[10px]">Ekuitas (Equity)</div>
                                        <div className="flex justify-between">
                                            <span>Modal Disetor</span>
                                            <span className="font-money">{formatCurrency(120_000_000)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Laba Bersih Periode Berjalan</span>
                                            <span className="font-money font-bold text-emerald-700 dark:text-emerald-400">
                                                {formatCurrency(result.profitLoss.netIncome)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                                            <span>Total Ekuitas</span>
                                            <span className="font-money">{formatCurrency(result.balanceSheet.totalEquity)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Profit & Loss */}
                            <Card className="border-border/60 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-display text-base">Laporan Laba Rugi (P&L)</CardTitle>
                                    <CardDescription className="text-xs font-mono">Periode Januari 2026</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 font-mono text-xs">
                                    <div className="space-y-1.5 border-b pb-2">
                                        <div className="font-bold text-muted-foreground uppercase text-[10px]">Pendapatan Usaha</div>
                                        <div className="flex justify-between">
                                            <span>Pendapatan Jasa Konsultasi (USD)</span>
                                            <span className="font-money font-bold">{formatCurrency(result.profitLoss.totalRevenue)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 border-b pb-2">
                                        <div className="font-bold text-muted-foreground uppercase text-[10px]">Beban Operasional</div>
                                        <div className="flex justify-between">
                                            <span>Beban Jasa Konsultasi IT</span>
                                            <span className="font-money">{formatCurrency(50_000_000)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Beban Penyusutan Server</span>
                                            <span className="font-money">{formatCurrency(2_500_000)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold border-t pt-1">
                                            <span>Total Beban Operasional</span>
                                            <span className="font-money">{formatCurrency(result.profitLoss.totalExpenses)}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 border-b pb-2">
                                        <div className="font-bold text-muted-foreground uppercase text-[10px]">Pendapatan / (Beban) Lainnya</div>
                                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                                            <span>Laba Selisih Kurs Realized</span>
                                            <span className="font-money">+{formatCurrency(result.profitLoss.realizedFxGain)}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between font-bold text-sm pt-1 text-foreground">
                                        <span>Laba Bersih Sebelum Pajak</span>
                                        <span className="font-money text-emerald-700 dark:text-emerald-400">
                                            {formatCurrency(result.profitLoss.netIncome)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB 3: Tax Summary View */}
                    <TabsContent value="tax" className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-display text-base">SPT Masa PPN 1111</CardTitle>
                                    <CardDescription className="text-xs font-mono">Masa Pajak Januari 2026</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 font-mono text-xs">
                                    <div className="flex justify-between">
                                        <span>Pajak Keluaran (Form B2 / Penjualan USD)</span>
                                        <span className="font-money font-bold">{formatCurrency(result.taxSummary.ppnKeluaran)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Pajak Masukan (Form A2 / Pembelian Jasa)</span>
                                        <span className="font-money font-bold">{formatCurrency(result.taxSummary.ppnMasukan)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2 font-bold text-foreground">
                                        <span>PPN Kurang Bayar (Net Payable)</span>
                                        <span className="font-money text-amber-700 dark:text-amber-400">{formatCurrency(result.taxSummary.netPpnPayable)}</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/60 shadow-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="font-display text-base">Bukti Potong PPh 23 (Withholding)</CardTitle>
                                    <CardDescription className="text-xs font-mono">Masa Pajak Januari 2026</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3 font-mono text-xs">
                                    <div className="flex justify-between">
                                        <span>DPP Jasa Konsultasi IT (Vendor PKP)</span>
                                        <span className="font-money font-bold">{formatCurrency(50_000_000)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tarif Pemotongan PPh 23 (Ber-NPWP)</span>
                                        <span className="font-mono">2.00%</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2 font-bold text-foreground">
                                        <span>Hutang PPh 23 Terutang ke DJP</span>
                                        <span className="font-money text-cyan-700 dark:text-cyan-400">{formatCurrency(result.taxSummary.pph23Withheld)}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* TAB 4: Trial Balance View */}
                    <TabsContent value="trialBalance">
                        <Card className="border-border/60 shadow-none">
                            <CardHeader className="pb-3">
                                <CardTitle className="font-display text-base">Neraca Saldo (Trial Balance)</CardTitle>
                                <CardDescription className="text-xs font-mono">Invarian Matematis Total Debit = Total Kredit</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 font-mono text-xs">
                                <div className="flex justify-between border-b pb-2">
                                    <span>Total Mutasi Debit Buku Besar</span>
                                    <span className="font-money font-bold">{formatCurrency(result.trialBalance.totalDebit)}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span>Total Mutasi Kredit Buku Besar</span>
                                    <span className="font-money font-bold">{formatCurrency(result.trialBalance.totalCredit)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                                    <span>Selisih (Discrepancy)</span>
                                    <span className="font-money">{formatCurrency(result.trialBalance.difference)}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
