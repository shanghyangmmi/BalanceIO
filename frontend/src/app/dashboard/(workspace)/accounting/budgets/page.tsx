"use client";

import * as React from "react";
import Link from "next/link";
import { 
    ChevronLeft, Plus, Target, CheckCircle2, AlertTriangle, 
    TrendingUp, Calendar, ArrowUpRight, Loader2, Trash2, 
    Edit, Eye, RefreshCw, Layers, ShieldCheck, Check, Sparkles
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { formatCurrency, formatDate } from "@/lib/utils/formatter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

interface BudgetSummary {
    id: string;
    name: string;
    fiscalYear: number;
    periodType: string;
    status: string;
    projectId?: string;
    projectName?: string;
    totalBudgetAmount: number;
    createdBy?: string;
    createdAt: string;
    approvedBy?: string;
    approvedAt?: string;
    totalAllocatedAccounts: number;
}

interface AccountItem {
    id: string;
    code: string;
    name: string;
    type: number; // 3 = Revenue, 4 = Expense
}

interface LineDraft {
    accountId: string;
    months: number[]; // 12 months amounts
    warningThreshold: number;
    criticalThreshold: number;
    notes?: string;
}

export default function BudgetsPage() {
    const can = useCan();
    const { company } = useCompanyData();
    const [budgets, setBudgets] = React.useState<BudgetSummary[]>([]);
    const [accounts, setAccounts] = React.useState<AccountItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [selectedYear, setSelectedYear] = React.useState<number>(new Date().getFullYear());

    // Create Modal State
    const [createOpen, setCreateOpen] = React.useState(false);
    const [budgetName, setBudgetName] = React.useState(`RKAP Operasional ${new Date().getFullYear()}`);
    const [fiscalYear, setFiscalYear] = React.useState<number>(new Date().getFullYear());
    const [notes, setNotes] = React.useState("");
    const [lineDrafts, setLineDrafts] = React.useState<LineDraft[]>([]);
    const [isSaving, setIsSaving] = React.useState(false);

    const loadBudgets = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [budgetsData, accountsData] = await Promise.all([
                apiClient.getBudgets(selectedYear).catch(() => []),
                apiClient.getAccounts().catch(() => [])
            ]);
            setBudgets(budgetsData || []);
            setAccounts(accountsData || []);
        } catch (error) {
            console.error("Failed to load budgets", error);
            toast.error("Gagal memuat daftar anggaran");
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear]);

    React.useEffect(() => {
        loadBudgets();
    }, [loadBudgets]);

    const handleAddLine = () => {
        // Find first unused expense account
        const usedIds = lineDrafts.map(l => l.accountId);
        const available = accounts.find(a => !usedIds.includes(a.id));
        if (!available) {
            toast.info("Semua akun telah dialokasikan");
            return;
        }

        setLineDrafts(prev => [
            ...prev,
            {
                accountId: available.id,
                months: Array(12).fill(0),
                warningThreshold: 80,
                criticalThreshold: 100
            }
        ]);
    };

    const handleRemoveLine = (idx: number) => {
        setLineDrafts(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSpreadAnnual = (idx: number, annualAmount: number) => {
        const monthly = Math.round(annualAmount / 12);
        setLineDrafts(prev => {
            const next = [...prev];
            next[idx].months = Array(12).fill(monthly);
            return next;
        });
    };

    const handleMonthChange = (lineIdx: number, monthIdx: number, val: number) => {
        setLineDrafts(prev => {
            const next = [...prev];
            next[lineIdx].months[monthIdx] = val;
            return next;
        });
    };

    const handleSaveBudget = async () => {
        if (!budgetName.trim()) {
            toast.error("Nama anggaran / RKAP wajib diisi");
            return;
        }
        if (lineDrafts.length === 0) {
            toast.error("Wajib menambahkan minimal 1 alokasi akun anggaran");
            return;
        }

        try {
            setIsSaving(true);
            const flatLines: any[] = [];
            lineDrafts.forEach(draft => {
                draft.months.forEach((amt, mIdx) => {
                    if (amt > 0) {
                        flatLines.push({
                            accountId: draft.accountId,
                            month: mIdx + 1,
                            amount: amt,
                            warningThresholdPercentage: draft.warningThreshold,
                            criticalThresholdPercentage: draft.criticalThreshold,
                            notes: draft.notes
                        });
                    }
                });
            });

            await apiClient.createBudget({
                name: budgetName.trim(),
                fiscalYear: fiscalYear,
                periodType: 0, // Monthly
                notes: notes.trim(),
                lines: flatLines
            });

            toast.success("Anggaran RKAP berhasil disimpan sebagai draf");
            setCreateOpen(false);
            setLineDrafts([]);
            loadBudgets();
        } catch (error: any) {
            console.error("Save budget error", error);
            toast.error(error.message || "Gagal menyimpan anggaran");
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async (id: string, name: string) => {
        try {
            await apiClient.approveBudget(id);
            toast.success(`Anggaran ${name} berhasil disetujui & diaktifkan.`);
            loadBudgets();
        } catch (error: any) {
            toast.error(error.message || "Gagal menyetujui anggaran");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Hapus draf anggaran ini?")) return;
        try {
            await apiClient.deleteBudget(id);
            toast.success("Anggaran berhasil dihapus");
            loadBudgets();
        } catch (error: any) {
            toast.error(error.message || "Gagal menghapus anggaran");
        }
    };

    // Calculate Summary KPIs
    const totalApprovedBudget = budgets
        .filter(b => b.status === "Approved")
        .reduce((sum, b) => sum + b.totalBudgetAmount, 0);
    const draftBudgetCount = budgets.filter(b => b.status === "Draft").length;
    const approvedBudgetCount = budgets.filter(b => b.status === "Approved").length;

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
                            Anggaran & RKAP{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                Rencana Kerja.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Perencanaan plafon anggaran per akun buku besar, pemantauan realisasi belanja (Actual vs Budget), dan mitigasi over-budget.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/reports/budget-variance">
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                                Laporan Varians Realisasi
                            </Button>
                        </Link>

                        {can(PERMISSIONS.FinanceCreate) && (
                            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="gap-1.5 text-xs font-mono">
                                        <Plus className="h-3.5 w-3.5" /> Buat Anggaran Baru
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-6">
                                    <DialogHeader>
                                        <DialogTitle className="font-display text-lg">Buat Anggaran RKAP Baru</DialogTitle>
                                        <DialogDescription className="text-xs font-mono">
                                            Alokasikan target penerimaan atau plafon belanja per akun Chart of Accounts untuk 12 bulan.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="flex-1 overflow-y-auto space-y-4 py-2 text-xs font-mono">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-muted/30 p-3 rounded-lg border">
                                            <div className="grid gap-1.5 md:col-span-2">
                                                <Label className="font-semibold">Nama Anggaran / RKAP *</Label>
                                                <Input
                                                    value={budgetName}
                                                    onChange={e => setBudgetName(e.target.value)}
                                                    placeholder="Contoh: RKAP Operasional 2026"
                                                    className="text-xs font-sans"
                                                />
                                            </div>
                                            <div className="grid gap-1.5">
                                                <Label className="font-semibold">Tahun Buku *</Label>
                                                <Input
                                                    type="number"
                                                    value={fiscalYear}
                                                    onChange={e => setFiscalYear(parseInt(e.target.value) || new Date().getFullYear())}
                                                    className="text-xs font-mono"
                                                />
                                            </div>
                                        </div>

                                        {/* Line Allocations */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="font-bold text-foreground">Alokasi Plafon Akun ({lineDrafts.length})</h4>
                                                <Button size="sm" variant="outline" onClick={handleAddLine} className="h-7 text-xs gap-1">
                                                    <Plus className="h-3 w-3" /> Tambah Akun
                                                </Button>
                                            </div>

                                            {lineDrafts.length === 0 ? (
                                                <div className="border border-dashed p-6 text-center text-muted-foreground rounded-lg bg-muted/10">
                                                    Klik "Tambah Akun" untuk mulai mengalokasikan plafon anggaran ke akun beban atau pendapatan.
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {lineDrafts.map((draft, idx) => {
                                                        const totalLine = draft.months.reduce((a, b) => a + b, 0);
                                                        return (
                                                            <div key={idx} className="border rounded-lg p-3 bg-card/60 space-y-3">
                                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-2">
                                                                    <div className="w-full sm:w-72">
                                                                        <Select
                                                                            value={draft.accountId}
                                                                            onValueChange={val => {
                                                                                setLineDrafts(prev => {
                                                                                    const next = [...prev];
                                                                                    next[idx].accountId = val;
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        >
                                                                            <SelectTrigger className="text-xs font-mono">
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {accounts.map(acc => (
                                                                                    <SelectItem key={acc.id} value={acc.id} className="text-xs font-mono">
                                                                                        {acc.code} - {acc.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </div>

                                                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                                                        <div className="flex items-center gap-1.5 text-[11px]">
                                                                            <span className="text-muted-foreground">Bagi Rata Tahunan:</span>
                                                                            <Input
                                                                                type="number"
                                                                                placeholder="Rp Total"
                                                                                onBlur={e => {
                                                                                    const val = parseFloat(e.target.value) || 0;
                                                                                    if (val > 0) handleSpreadAnnual(idx, val);
                                                                                }}
                                                                                className="h-7 w-28 text-xs font-money"
                                                                            />
                                                                        </div>

                                                                        <div className="text-right">
                                                                            <span className="text-muted-foreground text-[10px]">Total Akun: </span>
                                                                            <span className="font-bold font-money text-foreground">{formatCurrency(totalLine)}</span>
                                                                        </div>

                                                                        <Button
                                                                            size="icon"
                                                                            variant="ghost"
                                                                            onClick={() => handleRemoveLine(idx)}
                                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                {/* 12 Months Grid */}
                                                                <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                                                                    {draft.months.map((amt, mIdx) => {
                                                                        const mNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
                                                                        return (
                                                                            <div key={mIdx} className="space-y-0.5">
                                                                                <label className="text-[10px] text-muted-foreground block text-center">{mNames[mIdx]}</label>
                                                                                <Input
                                                                                    type="number"
                                                                                    value={amt || ""}
                                                                                    placeholder="0"
                                                                                    onChange={e => handleMonthChange(idx, mIdx, parseFloat(e.target.value) || 0)}
                                                                                    className="h-7 text-[11px] font-money text-right px-1.5"
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <DialogFooter className="border-t pt-3">
                                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button>
                                        <Button onClick={handleSaveBudget} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                            Simpan Anggaran RKAP
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Governance KPI Cards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-mono uppercase tracking-wider">Total Pagu Disetujui ({selectedYear})</CardDescription>
                        <CardTitle className="text-2xl font-bold font-money text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(totalApprovedBudget)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground font-mono">
                            {approvedBudgetCount} RKAP aktif & disetujui
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                            Draf Menunggu Persetujuan
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold font-money text-amber-700 dark:text-amber-400">
                            {draftBudgetCount} <span className="text-xs font-normal text-muted-foreground">Draf</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground font-mono">
                            Belum disetujui direksi / manajemen
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-mono uppercase tracking-wider">Pusat Biaya / Proyek</CardDescription>
                        <CardTitle className="text-2xl font-bold font-money">
                            Perusahaan <span className="text-xs font-normal text-muted-foreground">Konsolidasi</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground font-mono">
                            Multi-dimensi Cost Center aktif
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-xs font-mono uppercase tracking-wider text-purple-700 dark:text-purple-400 font-semibold">
                            Pemantauan Varians
                        </CardDescription>
                        <CardTitle className="text-2xl font-bold font-money text-purple-700 dark:text-purple-400 flex items-center gap-2">
                            Real-Time <Sparkles className="h-4 w-4" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-muted-foreground font-mono">
                            Terintegrasi langsung Buku Besar GL
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* ── Budgets Table ────────────────────────────────────────── */}
            <Card className="border-border/60 shadow-none">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="font-display text-base">Daftar Rencana Kerja & Anggaran Perusahaan</CardTitle>
                        <CardDescription className="text-xs font-mono">
                            Tahun Anggaran {selectedYear} · Total {budgets.length} rencana anggaran
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadBudgets} disabled={isLoading} className="gap-1.5 text-xs font-mono">
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-36 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-xs font-mono text-muted-foreground">Memuat data anggaran...</span>
                        </div>
                    ) : budgets.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground font-mono text-xs">
                            Belum ada anggaran RKAP yang dibuat untuk tahun {selectedYear}.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama Anggaran / RKAP</TableHead>
                                    <TableHead>Tahun Buku</TableHead>
                                    <TableHead>Pusat Biaya / Proyek</TableHead>
                                    <TableHead>Akun Teralokasi</TableHead>
                                    <TableHead className="text-right">Total Pagu Anggaran</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className="text-xs font-mono">
                                {budgets.map(b => (
                                    <TableRow key={b.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                            <div className="font-bold text-foreground">{b.name}</div>
                                            <div className="text-[10px] text-muted-foreground">
                                                Dibuat oleh {b.createdBy || "Accountant"} · {formatDate(b.createdAt)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{b.fiscalYear}</TableCell>
                                        <TableCell>{b.projectName || "Konsolidasi Perusahaan"}</TableCell>
                                        <TableCell>{b.totalAllocatedAccounts} Akun COA</TableCell>
                                        <TableCell className="text-right font-money font-bold text-foreground">
                                            {formatCurrency(b.totalBudgetAmount)}
                                        </TableCell>
                                        <TableCell>
                                            {b.status === "Approved" ? (
                                                <Badge variant="outline" className="border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 font-mono text-[9px] gap-1">
                                                    <Check className="h-2.5 w-2.5 text-emerald-600" /> Disetujui
                                                </Badge>
                                            ) : b.status === "Closed" ? (
                                                <Badge variant="secondary" className="font-mono text-[9px]">Ditutup</Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-50/60 font-mono text-[9px]">Draf</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link href={`/dashboard/reports/budget-variance?budgetId=${b.id}&fiscalYear=${b.fiscalYear}`}>
                                                    <Button size="sm" variant="ghost" className="h-7 text-xs font-mono gap-1" title="Lihat Laporan Varians">
                                                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> Varians
                                                    </Button>
                                                </Link>

                                                {b.status === "Draft" && (
                                                    <>
                                                        {can(PERMISSIONS.FinanceEdit) && <Button
                                                            size="sm"
                                                            onClick={() => handleApprove(b.id, b.name)}
                                                            className="h-7 text-xs font-mono gap-1"
                                                        >
                                                            <CheckCircle2 className="h-3 w-3" /> Setujui
                                                        </Button>}
                                                        {can(PERMISSIONS.FinanceDelete) && <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleDelete(b.id)}
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>}
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
