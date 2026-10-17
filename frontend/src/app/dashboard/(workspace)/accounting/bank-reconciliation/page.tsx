"use client"

import * as React from "react"
import Link from "next/link"
import { 
    ChevronLeft, Scale, RefreshCw, Upload, Sparkles, CheckCircle2, AlertTriangle, 
    ArrowUpRight, ArrowDownLeft, ShieldCheck, Download, Loader2, Link2, Unlink, 
    PlusCircle, FileText, Check, HelpCircle
} from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils/formatter"
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function BankReconciliationPage() {
    const can = useCan();
    const [accounts, setAccounts] = React.useState<any[]>([])
    const [selectedAccountId, setSelectedAccountId] = React.useState<string>("")
    const [asOfDate, setAsOfDate] = React.useState<string>(new Date().toISOString().split('T')[0])
    const [workspace, setWorkspace] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    // Selection state for manual matching
    const [selectedStatementLineId, setSelectedStatementLineId] = React.useState<string | null>(null)
    const [selectedJournalLineId, setSelectedJournalLineId] = React.useState<string | null>(null)

    // Dialogs
    const [importOpen, setImportOpen] = React.useState(false)
    const [importFormat, setImportFormat] = React.useState<number>(1) // 1=Generic, 2=BCA, 3=Mandiri
    const [importCsv, setImportCsv] = React.useState("")
    const [importOpeningBal, setImportOpeningBal] = React.useState<string>("")
    const [isImporting, setIsImporting] = React.useState(false)

    const [isAutoMatching, setIsAutoMatching] = React.useState(false)
    const [finalizeOpen, setFinalizeOpen] = React.useState(false)
    const [finalizeNotes, setFinalizeNotes] = React.useState("")
    const [isFinalizing, setIsFinalizing] = React.useState(false)

    const [adjustmentOpen, setAdjustmentOpen] = React.useState(false)
    const [adjustmentLine, setAdjustmentLine] = React.useState<any>(null)
    const [adjustmentType, setAdjustmentType] = React.useState("BankCharge")
    const [adjustmentAccount, setAdjustmentAccount] = React.useState("6-1900")
    const [adjustmentNotes, setAdjustmentNotes] = React.useState("")
    const [isPostingAdjustment, setIsPostingAdjustment] = React.useState(false)

    // 1. Fetch Accounts
    const fetchAccounts = React.useCallback(async () => {
        try {
            const list = await apiClient.getBankReconciliationAccounts()
            setAccounts(list)
            if (list.length > 0 && !selectedAccountId) {
                setSelectedAccountId(list[0].accountId)
            }
        } catch (error) {
            console.error("Failed to load cash & bank accounts", error)
            toast.error("Gagal memuat daftar rekening kas/bank")
        }
    }, [selectedAccountId])

    // 2. Fetch Workspace
    const fetchWorkspace = React.useCallback(async () => {
        if (!selectedAccountId) return
        try {
            setLoading(true)
            const ws = await apiClient.getBankReconciliationWorkspace(selectedAccountId, asOfDate)
            setWorkspace(ws)
            setSelectedStatementLineId(null)
            setSelectedJournalLineId(null)
        } catch (error) {
            console.error("Failed to load bank reconciliation workspace", error)
            toast.error("Gagal memuat lembar kerja rekonsiliasi bank")
        } finally {
            setLoading(false)
        }
    }, [selectedAccountId, asOfDate])

    React.useEffect(() => {
        fetchAccounts()
    }, [fetchAccounts])

    React.useEffect(() => {
        if (selectedAccountId) {
            fetchWorkspace()
        }
    }, [selectedAccountId, asOfDate, fetchWorkspace])

    // 3. Actions
    const handleImportStatement = async () => {
        if (!importCsv.trim()) {
            toast.error("Silakan tempel atau unggah isi file CSV rekening koran")
            return
        }
        try {
            setIsImporting(true)
            const res = await apiClient.importBankStatement({
                accountId: selectedAccountId,
                format: importFormat,
                csvContent: importCsv,
                fileName: "statement.csv",
                initialOpeningBalance: importOpeningBal ? parseFloat(importOpeningBal) : undefined
            })
            toast.success(res.message)
            setImportOpen(false)
            setImportCsv("")
            fetchWorkspace()
            fetchAccounts()
        } catch (error: any) {
            console.error("Failed to import bank statement", error)
            toast.error(error.message || "Gagal mengimpor rekening koran")
        } finally {
            setIsImporting(false)
        }
    }

    const handleAutoMatch = async () => {
        try {
            setIsAutoMatching(true)
            const res = await apiClient.autoMatchBankStatement({
                accountId: selectedAccountId,
                dateToleranceDays: 3,
                autoSplitBankFees: true
            })
            toast.success(res.message)
            fetchWorkspace()
            fetchAccounts()
        } catch (error: any) {
            console.error("Failed to auto-match", error)
            toast.error(error.message || "Gagal menjalankan pencocokan otomatis")
        } finally {
            setIsAutoMatching(false)
        }
    }

    const handleManualMatch = async () => {
        if (!selectedStatementLineId || !selectedJournalLineId) {
            toast.error("Pilih satu baris rekening koran dan satu baris buku besar untuk dicocokkan")
            return
        }
        try {
            await apiClient.manualMatchBankStatement({
                statementLineId: selectedStatementLineId,
                journalLineId: selectedJournalLineId
            })
            toast.success("Baris berhasil dicocokkan secara manual")
            fetchWorkspace()
            fetchAccounts()
        } catch (error: any) {
            console.error("Failed to match manually", error)
            toast.error(error.message || "Gagal mencocokkan transaksi")
        }
    }

    const handleUnmatch = async (statementLineId: string) => {
        try {
            await apiClient.unmatchBankStatement({ statementLineId })
            toast.success("Pencocokan dibatalkan")
            fetchWorkspace()
            fetchAccounts()
        } catch (error: any) {
            console.error("Failed to unmatch", error)
            toast.error(error.message || "Gagal membatalkan pencocokan")
        }
    }

    const handlePostAdjustment = async () => {
        if (!adjustmentLine) return
        try {
            setIsPostingAdjustment(true)
            const res = await apiClient.postBankAdjustment({
                statementLineId: adjustmentLine.id,
                adjustmentType,
                accountCode: adjustmentAccount,
                notes: adjustmentNotes
            })
            toast.success(res.message || "Jurnal penyesuaian berhasil diposting")
            setAdjustmentOpen(false)
            fetchWorkspace()
            fetchAccounts()
        } catch (error: any) {
            console.error("Failed to post adjustment", error)
            toast.error(error.message || "Gagal memposting penyesuaian")
        } finally {
            setIsPostingAdjustment(false)
        }
    }

    const handleFinalize = async () => {
        try {
            setIsFinalizing(true)
            const res = await apiClient.finalizeBankReconciliation({
                accountId: selectedAccountId,
                reconciliationDate: asOfDate,
                notes: finalizeNotes
            })
            toast.success(res.message)
            setFinalizeOpen(false)
            fetchWorkspace()
            fetchAccounts()
        } catch (error: any) {
            console.error("Failed to finalize reconciliation", error)
            toast.error(error.message || "Gagal menyelesaikan rekonsiliasi")
        } finally {
            setIsFinalizing(false)
        }
    }

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
                            Rekonsiliasi{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                Bank.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Pencocokan rekening koran bank dengan buku besar, pelacakan selisih waktu (timing differences), dan posting biaya administrasi/bunga.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Account Selector */}
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                            <SelectTrigger className="w-[240px] font-mono text-xs font-semibold">
                                <SelectValue placeholder="Pilih Rekening Bank" />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map((acc) => (
                                    <SelectItem key={acc.accountId} value={acc.accountId} className="text-xs font-mono">
                                        {acc.accountCode} · {acc.accountName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* As-Of Date */}
                        <Input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                            className="w-[140px] h-9 text-xs font-mono"
                        />

                        <Button variant="outline" size="sm" onClick={fetchWorkspace} disabled={loading} className="gap-1.5 text-xs font-mono">
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>

                        {/* Import Statement Dialog */}
                        <Dialog open={importOpen} onOpenChange={setImportOpen}>
                            {can(PERMISSIONS.FinanceCreate) && <DialogTrigger asChild>
                                <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-mono">
                                    <Upload className="h-3.5 w-3.5" />
                                    Impor Rekening Koran
                                </Button>
                            </DialogTrigger>}
                            <DialogContent className="max-w-xl">
                                <DialogHeader>
                                    <DialogTitle className="font-display">Impor Rekening Koran Bank (CSV)</DialogTitle>
                                    <DialogDescription>
                                        Unggah atau tempel data mutasi rekening koran. Format angka Indonesia (1.234.567,89) didukung penuh dengan de-duplikasi otomatis.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">Format Bank</Label>
                                            <Select value={importFormat.toString()} onValueChange={(val) => setImportFormat(parseInt(val))}>
                                                <SelectTrigger className="text-xs font-mono">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1" className="text-xs font-mono">Generic 5-Kolom CSV</SelectItem>
                                                    <SelectItem value="2" className="text-xs font-mono">BCA (KlikBCA Bisnis)</SelectItem>
                                                    <SelectItem value="3" className="text-xs font-mono">Bank Mandiri (MCM)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-xs">Saldo Awal (Opsional)</Label>
                                            <Input
                                                type="number"
                                                step="any"
                                                value={importOpeningBal}
                                                onChange={(e) => setImportOpeningBal(e.target.value)}
                                                placeholder="Contoh: 50000000"
                                                className="text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <div className="flex justify-between items-center">
                                            <Label className="text-xs">Isi Data CSV / Rekening Koran</Label>
                                            <a 
                                                href={`/api/bankreconciliation/sample-template?format=${importFormat === 2 ? "bca" : importFormat === 3 ? "mandiri" : "generic"}`} 
                                                download 
                                                className="text-[11px] text-primary hover:underline font-mono inline-flex items-center gap-1"
                                            >
                                                <Download className="h-3 w-3" /> Unduh Contoh CSV
                                            </a>
                                        </div>
                                        <Textarea
                                            rows={8}
                                            value={importCsv}
                                            onChange={(e) => setImportCsv(e.target.value)}
                                            placeholder="Date,Description,Reference,Debit,Credit,Balance&#10;2026-08-01,&quot;Customer Payment VA 12345&quot;,REC-001,0,&quot;15.000.000,00&quot;,&quot;65.000.000,00&quot;"
                                            className="font-mono text-xs"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setImportOpen(false)}>Batal</Button>
                                    <Button onClick={handleImportStatement} disabled={isImporting}>
                                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                                        Impor Mutasi Bank
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : workspace ? (
                <div className="space-y-6">
                    {/* ── Formal Reconciliation Equation KPI Cards ─────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* 1. Bank Side */}
                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">Saldo Rekening Koran</CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {formatCurrency(workspace.statementEndingBalance)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-xs text-muted-foreground font-mono">
                                <div className="flex justify-between">
                                    <span>+ Setoran Dalam Proses:</span>
                                    <span className="font-money text-emerald-700 dark:text-emerald-400">+{formatCurrency(workspace.depositsInTransit)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>- Cek Beredar / Out:</span>
                                    <span className="font-money text-amber-700 dark:text-amber-400">-{formatCurrency(workspace.outstandingPayments)}</span>
                                </div>
                                <div className="border-t pt-1 flex justify-between font-bold text-foreground">
                                    <span>= Saldo Bank Disesuaikan:</span>
                                    <span className="font-money">{formatCurrency(workspace.adjustedBankBalance)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Book Side */}
                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">Saldo Buku Besar (GL)</CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {formatCurrency(workspace.generalLedgerEndingBalance)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-xs text-muted-foreground font-mono">
                                <div className="flex justify-between">
                                    <span>+ Pendapatan Bank (Bunga):</span>
                                    <span className="font-money text-emerald-700 dark:text-emerald-400">+{formatCurrency(workspace.unrecordedBankCredits)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>- Biaya Admin Bank:</span>
                                    <span className="font-money text-amber-700 dark:text-amber-400">-{formatCurrency(workspace.unrecordedBankDebits)}</span>
                                </div>
                                <div className="border-t pt-1 flex justify-between font-bold text-foreground">
                                    <span>= Saldo Buku Disesuaikan:</span>
                                    <span className="font-money">{formatCurrency(workspace.adjustedLedgerBalance)}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Progress / Stats */}
                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">Progres Pencocokan</CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {workspace.matchedStatementLines} / {workspace.totalStatementLines} Cocok
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-1 text-xs text-muted-foreground font-mono">
                                <div className="flex justify-between">
                                    <span>Belum Cocok (Bank):</span>
                                    <span className="font-bold text-amber-600">{workspace.unmatchedStatementLines} baris</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Belum Cocok (Buku):</span>
                                    <span className="font-bold text-amber-600">{workspace.unmatchedLedgerLines} baris</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. Difference & Finalize Action */}
                        <Card className={`border shadow-none backdrop-blur-sm ${
                            workspace.isBalanced 
                                ? "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                : "bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                        }`}>
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider font-semibold">
                                    Selisih Rekonsiliasi
                                </CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {formatCurrency(Math.abs(workspace.difference))}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <Badge variant={workspace.isBalanced ? "outline" : "destructive"} className="text-[10px] font-mono">
                                    {workspace.isBalanced ? "Seimbang (Rp 0)" : "Terdapat Selisih"}
                                </Badge>

                                {workspace.isBalanced ? (
                                    <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                                        {can(PERMISSIONS.FinanceEdit) && <DialogTrigger asChild>
                                            <Button size="sm" className="h-7 text-xs font-mono gap-1">
                                                <ShieldCheck className="h-3.5 w-3.5" /> Selesaikan
                                            </Button>
                                        </DialogTrigger>}
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle className="font-display">Kunci & Selesaikan Rekonsiliasi Bank</DialogTitle>
                                                <DialogDescription>
                                                    Saldo bank dan buku besar telah seimbang sempurna (Selisih: Rp 0). Selesaikan sesi untuk mengunci mutasi rekening koran hingga tanggal {formatDate(asOfDate)}.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-3 py-2">
                                                <div className="grid gap-1.5">
                                                    <Label className="text-xs">Catatan / Referensi</Label>
                                                    <Input 
                                                        value={finalizeNotes} 
                                                        onChange={(e) => setFinalizeNotes(e.target.value)} 
                                                        placeholder="Rekonsiliasi Bank bulanan disetujui" 
                                                        className="text-xs"
                                                    />
                                                </div>
                                                <div className="rounded-md border p-3 bg-muted/40 font-mono text-xs space-y-1">
                                                    <div className="flex justify-between">
                                                        <span>Rekening:</span>
                                                        <span className="font-bold">{workspace.accountCode} · {workspace.accountName}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Saldo Rekonsiliasi:</span>
                                                        <span className="font-bold font-money text-emerald-700 dark:text-emerald-400">{formatCurrency(workspace.adjustedBankBalance)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Batal</Button>
                                                <Button onClick={handleFinalize} disabled={isFinalizing}>
                                                    {isFinalizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                                                    Kunci Rekonsiliasi
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                ) : can(PERMISSIONS.FinanceEdit) && (
                                    <Button size="sm" variant="outline" onClick={handleAutoMatch} disabled={isAutoMatching} className="h-7 text-xs font-mono gap-1">
                                        {isAutoMatching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-emerald-600" />}
                                        Auto Match
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Action Toolbar for Manual Matching ─────────────────────────────────── */}
                    <div className="flex flex-wrap items-center justify-between bg-muted/30 border rounded-lg p-3 gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-muted-foreground font-mono">Pencocokan Manual:</span>
                            {selectedStatementLineId ? (
                                <Badge variant="secondary" className="text-[11px] font-mono gap-1">
                                    <Check className="h-3 w-3 text-emerald-600" /> 1 Baris Bank Terpilih
                                </Badge>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">Pilih 1 baris dari sisi Bank</span>
                            )}
                            <span className="text-muted-foreground">+</span>
                            {selectedJournalLineId ? (
                                <Badge variant="secondary" className="text-[11px] font-mono gap-1">
                                    <Check className="h-3 w-3 text-emerald-600" /> 1 Baris Buku Terpilih
                                </Badge>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">Pilih 1 baris dari sisi Buku</span>
                            )}
                        </div>

                        {can(PERMISSIONS.FinanceEdit) && <div className="flex items-center gap-2">
                            <Button 
                                size="sm" 
                                onClick={handleManualMatch} 
                                disabled={!selectedStatementLineId || !selectedJournalLineId}
                                className="h-8 text-xs font-mono gap-1.5"
                            >
                                <Link2 className="h-3.5 w-3.5" />
                                Cocokkan Terpilih
                            </Button>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                onClick={handleAutoMatch} 
                                disabled={isAutoMatching}
                                className="h-8 text-xs font-mono gap-1.5"
                            >
                                {isAutoMatching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-600" />}
                                Auto Match Semua
                            </Button>
                        </div>}
                    </div>

                    {/* ── 2-Pane Side-by-Side Matching Workspace ───────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* ── Left Pane: Bank Statement Lines ─────────────────── */}
                        <Card className="border-border/60 shadow-none">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="font-display text-base">Rekening Koran Bank</CardTitle>
                                    <CardDescription className="text-xs font-mono">
                                        Mutasi dari file impor ({workspace.statementLines?.length || 0} baris)
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                    Bank CR = Uang Masuk · DB = Uang Keluar
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[600px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                                            <TableRow>
                                                <TableHead className="w-10"></TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Keterangan / VA</TableHead>
                                                <TableHead className="text-right">Mutasi</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="w-16"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {workspace.statementLines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        Belum ada mutasi rekening koran yang diimpor. Klik &quot;Impor Rekening Koran&quot; untuk memulai.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                workspace.statementLines.map((row: any) => {
                                                    const isMatched = row.status !== 0;
                                                    const isSelected = selectedStatementLineId === row.id;

                                                    return (
                                                        <TableRow 
                                                            key={row.id}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected 
                                                                    ? "bg-primary/10 hover:bg-primary/15" 
                                                                    : isMatched 
                                                                    ? "opacity-60 hover:opacity-100" 
                                                                    : "hover:bg-muted/40"
                                                            }`}
                                                            onClick={() => {
                                                                if (!isMatched) {
                                                                    setSelectedStatementLineId(isSelected ? null : row.id);
                                                                }
                                                            }}
                                                        >
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="radio"
                                                                    checked={isSelected}
                                                                    disabled={isMatched}
                                                                    onChange={() => setSelectedStatementLineId(isSelected ? null : row.id)}
                                                                    className="h-3.5 w-3.5"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">{formatDate(row.transactionDate)}</TableCell>
                                                            <TableCell>
                                                                <div className="font-sans font-medium line-clamp-2 max-w-[220px]">
                                                                    {row.description}
                                                                </div>
                                                                {row.extractedVirtualAccount && (
                                                                    <Badge variant="outline" className="text-[9px] mt-0.5 font-mono">
                                                                        VA: {row.extractedVirtualAccount}
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right font-money whitespace-nowrap">
                                                                {row.credit > 0 ? (
                                                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                                                        +{formatCurrency(row.credit)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                                                                        -{formatCurrency(row.debit)}
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                {isMatched ? (
                                                                    <Badge variant="outline" className="text-[9px] text-emerald-600 font-mono">
                                                                        {row.matchConfidenceLabel || "Cocok"}
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="text-[9px] font-mono">
                                                                        Belum
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                {isMatched ? can(PERMISSIONS.FinanceEdit) && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                        onClick={() => handleUnmatch(row.id)}
                                                                        title="Batalkan pencocokan"
                                                                    >
                                                                        <Unlink className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                ) : can(PERMISSIONS.FinanceCreate) && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                                                                        onClick={() => {
                                                                            setAdjustmentLine(row)
                                                                            setAdjustmentType(row.debit > 0 ? "BankCharge" : "InterestIncome")
                                                                            setAdjustmentAccount(row.debit > 0 ? "6-1900" : "7-1000")
                                                                            setAdjustmentNotes(row.description)
                                                                            setAdjustmentOpen(true)
                                                                        }}
                                                                        title="Posting penyesuaian biaya bank / bunga"
                                                                    >
                                                                        <PlusCircle className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Right Pane: General Ledger Lines ────────────────── */}
                        <Card className="border-border/60 shadow-none">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="font-display text-base">Buku Besar (General Ledger)</CardTitle>
                                    <CardDescription className="text-xs font-mono">
                                        Transaksi akun {workspace.accountCode} ({workspace.ledgerLines?.length || 0} baris)
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                    Book Dr = Penerimaan · Cr = Pengeluaran
                                </Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[600px] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10">
                                            <TableRow>
                                                <TableHead className="w-10"></TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Ref / Uraian</TableHead>
                                                <TableHead className="text-right">Debit (Masuk)</TableHead>
                                                <TableHead className="text-right">Kredit (Keluar)</TableHead>
                                                <TableHead>Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {workspace.ledgerLines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                        Tidak ada transaksi buku besar yang tercatat pada periode ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                workspace.ledgerLines.map((row: any) => {
                                                    const isMatched = row.isReconciled;
                                                    const isSelected = selectedJournalLineId === row.journalLineId;

                                                    return (
                                                        <TableRow 
                                                            key={row.journalLineId}
                                                            className={`cursor-pointer transition-colors ${
                                                                isSelected 
                                                                    ? "bg-primary/10 hover:bg-primary/15" 
                                                                    : isMatched 
                                                                    ? "opacity-60 hover:opacity-100" 
                                                                    : "hover:bg-muted/40"
                                                            }`}
                                                            onClick={() => {
                                                                if (!isMatched) {
                                                                    setSelectedJournalLineId(isSelected ? null : row.journalLineId);
                                                                }
                                                            }}
                                                        >
                                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                                <input
                                                                    type="radio"
                                                                    checked={isSelected}
                                                                    disabled={isMatched}
                                                                    onChange={() => setSelectedJournalLineId(isSelected ? null : row.journalLineId)}
                                                                    className="h-3.5 w-3.5"
                                                                />
                                                            </TableCell>
                                                            <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                                                            <TableCell>
                                                                <div className="font-semibold text-foreground">{row.journalNumber}</div>
                                                                <div className="font-sans text-[11px] text-muted-foreground line-clamp-1">
                                                                    {row.description}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right font-money whitespace-nowrap">
                                                                {row.debit > 0 ? (
                                                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                                                        {formatCurrency(row.debit)}
                                                                    </span>
                                                                ) : "—"}
                                                            </TableCell>
                                                            <TableCell className="text-right font-money whitespace-nowrap">
                                                                {row.credit > 0 ? (
                                                                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                                                                        {formatCurrency(row.credit)}
                                                                    </span>
                                                                ) : "—"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {isMatched ? (
                                                                    <Badge variant="outline" className="text-[9px] text-emerald-600 font-mono">
                                                                        Terekonsiliasi
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="text-[9px] font-mono">
                                                                        Belum
                                                                    </Badge>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── 1-Click Adjustment Posting Dialog ─────────────────────────────────── */}
                    <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="font-display">Posting Penyesuaian Bank (1-Click)</DialogTitle>
                                <DialogDescription>
                                    Buat dan posting jurnal penyesuaian untuk mutasi bank yang belum tercatat di buku besar (misal: Biaya Admin Bank atau Pendapatan Bunga).
                                </DialogDescription>
                            </DialogHeader>
                            {adjustmentLine && (
                                <div className="space-y-4 py-2">
                                    <div className="rounded-md border p-3 bg-muted/40 font-mono text-xs space-y-1">
                                        <div className="flex justify-between">
                                            <span>Tanggal Transaksi:</span>
                                            <span>{formatDate(adjustmentLine.transactionDate)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Keterangan Bank:</span>
                                            <span className="font-sans font-medium line-clamp-1 max-w-[280px]">{adjustmentLine.description}</span>
                                        </div>
                                        <div className="flex justify-between font-bold">
                                            <span>Jumlah Mutasi:</span>
                                            <span className="font-money">
                                                {adjustmentLine.debit > 0 ? formatCurrency(adjustmentLine.debit) : formatCurrency(adjustmentLine.credit)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Jenis Penyesuaian</Label>
                                        <Select value={adjustmentType} onValueChange={(val) => {
                                            setAdjustmentType(val)
                                            setAdjustmentAccount(val === "BankCharge" ? "6-1900" : "7-1000")
                                        }}>
                                            <SelectTrigger className="text-xs font-mono">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="BankCharge" className="text-xs font-mono">Biaya Administrasi Bank (Dr 6-1900 / Cr Kas Bank)</SelectItem>
                                                <SelectItem value="InterestIncome" className="text-xs font-mono">Pendapatan Bunga Bank (Dr Kas Bank / Cr 7-1000)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Kode Akun Lawan</Label>
                                        <Input
                                            value={adjustmentAccount}
                                            onChange={(e) => setAdjustmentAccount(e.target.value)}
                                            className="text-xs font-mono font-bold"
                                        />
                                    </div>

                                    <div className="grid gap-1.5">
                                        <Label className="text-xs">Catatan Jurnal</Label>
                                        <Input
                                            value={adjustmentNotes}
                                            onChange={(e) => setAdjustmentNotes(e.target.value)}
                                            className="text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setAdjustmentOpen(false)}>Batal</Button>
                                <Button onClick={handlePostAdjustment} disabled={isPostingAdjustment}>
                                    {isPostingAdjustment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                                    Posting & Cocokkan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            ) : null}
        </div>
    )
}
