"use client";

import * as React from "react";
import Link from "next/link";
import { 
    ChevronLeft, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, 
    Search, Eye, Loader2, RefreshCw, FileText, Check, Lock,
    SlidersHorizontal, UserX, Clock, ArrowUpRight
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { formatCurrency, formatDate } from "@/lib/utils/formatter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EvidenceAttachmentPanel } from "@/components/documents/evidence-attachment-panel";
import { toast } from "sonner";

interface JournalLineItem {
    id?: string;
    accountId: string;
    accountName?: string;
    accountCode?: string;
    debit: number;
    credit: number;
    description?: string;
}

interface PendingJournal {
    id: string;
    referenceNumber: string;
    date: string;
    createdAt: string;
    status: string;
    notes?: string;
    createdBy?: string;
    createdByUserId?: string;
    approvedBy?: string;
    rejectionReason?: string;
    totalAmount: number;
    lines: JournalLineItem[];
}

function parseJwt(token: string) {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

export default function JournalApprovalsPage() {
    const { company } = useCompanyData();
    const [journals, setJournals] = React.useState<PendingJournal[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState("");
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
    const [currentUser, setCurrentUser] = React.useState<{ id?: string; email?: string }>({});

    // Inspection Modal
    const [inspectJournal, setInspectJournal] = React.useState<PendingJournal | null>(null);

    // Single Approve Modal
    const [approveModal, setApproveModal] = React.useState<{ isOpen: boolean; journal?: PendingJournal }>({ isOpen: false });
    const [isApproving, setIsApproving] = React.useState(false);

    // Batch Approve Modal
    const [batchApproveOpen, setBatchApproveOpen] = React.useState(false);
    const [isBatchApproving, setIsBatchApproving] = React.useState(false);

    // Reject Modal
    const [rejectModal, setRejectModal] = React.useState<{ isOpen: boolean; journal?: PendingJournal }>({ isOpen: false });
    const [rejectReason, setRejectReason] = React.useState("");
    const [isRejecting, setIsRejecting] = React.useState(false);

    React.useEffect(() => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("token");
            if (token) {
                const decoded = parseJwt(token);
                if (decoded) {
                    setCurrentUser({
                        id: decoded.id || decoded.sub || decoded.nameid,
                        email: decoded.email || decoded.Email || ""
                    });
                }
            }
        }
    }, []);

    const loadPendingJournals = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.get<any[]>("/JournalEntries?status=Draft").catch(() => []);
            
            const transformed: PendingJournal[] = (data || []).map((j: any) => {
                const lines: JournalLineItem[] = (j.lines || []).map((l: any) => ({
                    id: l.id,
                    accountId: l.accountId || "",
                    accountName: l.account?.name || l.accountName || "Akun",
                    accountCode: l.account?.code || l.accountCode || "",
                    debit: Number(l.debit || 0),
                    credit: Number(l.credit || 0),
                    description: l.description || l.memo || "",
                }));

                const totalDebit = lines.reduce((acc, l) => acc + l.debit, 0);

                return {
                    id: j.id,
                    referenceNumber: j.referenceNumber || `JV-${j.id.substring(0, 6)}`,
                    date: j.date,
                    createdAt: j.createdAt,
                    status: j.status === 0 ? "Draft" : j.status === 1 ? "Posted" : "Void",
                    notes: j.notes,
                    createdBy: j.createdBy,
                    createdByUserId: j.createdByUserId,
                    approvedBy: j.approvedBy,
                    rejectionReason: j.rejectionReason,
                    totalAmount: totalDebit,
                    lines: lines,
                };
            });

            setJournals(transformed);
            setSelectedIds([]);
        } catch (error) {
            console.error("Failed to load draft journals", error);
            toast.error("Gagal memuat daftar entri jurnal yang menunggu persetujuan");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadPendingJournals();
    }, [loadPendingJournals]);

    // Check if an item was created by the currently logged-in user
    const checkIsSelfCreated = (j: PendingJournal) => {
        if (!currentUser.email && !currentUser.id) return false;
        if (currentUser.id && j.createdByUserId && currentUser.id.toLowerCase() === j.createdByUserId.toLowerCase()) return true;
        if (currentUser.email && j.createdBy && currentUser.email.toLowerCase() === j.createdBy.toLowerCase()) return true;
        return false;
    };

    // Filter by search term
    const filteredJournals = journals.filter((j) => {
        const term = searchTerm.toLowerCase();
        return (
            j.referenceNumber.toLowerCase().includes(term) ||
            (j.notes && j.notes.toLowerCase().includes(term)) ||
            (j.createdBy && j.createdBy.toLowerCase().includes(term))
        );
    });

    // Stats calculations
    const totalPendingCount = journals.length;
    const totalPendingAmount = journals.reduce((sum, j) => sum + j.totalAmount, 0);
    const selfCreatedCount = journals.filter(checkIsSelfCreated).length;
    const eligibleCount = journals.filter((j) => !checkIsSelfCreated(j)).length;
    const highValueCount = journals.filter((j) => j.totalAmount >= 50000000).length;

    // Eligible for batch selection (must NOT be self-created)
    const eligibleJournals = filteredJournals.filter((j) => !checkIsSelfCreated(j));

    const toggleSelectAll = () => {
        if (selectedIds.length === eligibleJournals.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(eligibleJournals.map((j) => j.id));
        }
    };

    const toggleSelectId = (id: string) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    // Single Approve
    const handleApproveSingle = async () => {
        if (!approveModal.journal) return;
        try {
            setIsApproving(true);
            const res = await apiClient.post<any>(`/JournalEntries/${approveModal.journal.id}/post`, {});
            toast.success(res?.message || "Jurnal berhasil disetujui & diposting ke Buku Besar");
            setApproveModal({ isOpen: false });
            setInspectJournal(null);
            loadPendingJournals();
        } catch (error: any) {
            console.error("Approval error", error);
            toast.error(error.message || "Gagal menyetujui jurnal. Pelanggaran Segregation of Duties.");
        } finally {
            setIsApproving(false);
        }
    };

    // Batch Approve
    const handleBatchApprove = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBatchApproving(true);
            const res = await apiClient.post<any>("/JournalEntries/batch-post", selectedIds);
            toast.success(res?.message || `${selectedIds.length} jurnal berhasil diposting`);
            if (res?.errors && res.errors.length > 0) {
                res.errors.forEach((err: string) => toast.error(err));
            }
            setBatchApproveOpen(false);
            loadPendingJournals();
        } catch (error: any) {
            console.error("Batch approval error", error);
            toast.error(error.message || "Gagal melakukan batch approval");
        } finally {
            setIsBatchApproving(false);
        }
    };

    // Reject with reason
    const handleReject = async () => {
        if (!rejectModal.journal) return;
        if (!rejectReason.trim()) {
            toast.error("Wajib mengisi alasan penolakan / catatan revisi");
            return;
        }
        try {
            setIsRejecting(true);
            await apiClient.post<any>(`/JournalEntries/${rejectModal.journal.id}/reject`, JSON.stringify(rejectReason), {
                headers: { "Content-Type": "application/json" }
            });
            toast.success("Jurnal ditolak dan dikembalikan ke draf untuk diperbaiki");
            setRejectModal({ isOpen: false });
            setRejectReason("");
            setInspectJournal(null);
            loadPendingJournals();
        } catch (error: any) {
            console.error("Rejection error", error);
            toast.error(error.message || "Gagal menolak jurnal");
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <TooltipProvider>
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
                                Persetujuan & Kontrol{" "}
                                <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                    Segregation of Duties.
                                </span>
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Verifikasi transaksi keuangan sebelum diposting ke Buku Besar. Prinsip tata kelola mengharuskan verifikator kedua (pembuat draf dilarang menyetujui transaksi sendiri).
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={loadPendingJournals} disabled={isLoading} className="gap-1.5 text-xs font-mono">
                                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </header>

                {/* ── Governance KPI Cards ─────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Total Pending */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Menunggu Persetujuan</CardDescription>
                            <CardTitle className="text-2xl font-bold font-money">
                                {totalPendingCount} <span className="text-xs font-normal text-muted-foreground">Entri</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Total Nilai: <span className="font-money font-semibold text-foreground">{formatCurrency(totalPendingAmount)}</span>
                            </p>
                        </CardContent>
                    </Card>

                    {/* 2. Ready for Your Review */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">
                                Siap Anda Setujui
                            </CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-emerald-700 dark:text-emerald-400">
                                {eligibleCount} <span className="text-xs font-normal text-muted-foreground">Entri</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Dibuat oleh rekan kerja (Lolos SoD)
                            </p>
                        </CardContent>
                    </Card>

                    {/* 3. Created by You (SoD Blocked) */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                                Draf Dibuat Oleh Anda
                            </CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-amber-700 dark:text-amber-400">
                                {selfCreatedCount} <span className="text-xs font-normal text-muted-foreground">Entri</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Butuh reviewer kedua untuk posting
                            </p>
                        </CardContent>
                    </Card>

                    {/* 4. High-Value Entries */}
                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                        <CardHeader className="pb-2">
                            <CardDescription className="text-xs font-mono uppercase tracking-wider text-purple-700 dark:text-purple-400 font-semibold">
                                Nilai Tinggi (&ge; Rp 50Jt)
                            </CardDescription>
                            <CardTitle className="text-2xl font-bold font-money text-purple-700 dark:text-purple-400">
                                {highValueCount} <span className="text-xs font-normal text-muted-foreground">Entri</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground font-mono">
                                Membutuhkan otorisasi manajemen
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Toolbar & Filter ─────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 border rounded-lg p-3">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari nomor ref, catatan, pembuat..."
                            className="pl-9 text-xs font-mono h-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        {selectedIds.length > 0 && (
                            <>
                                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                    {selectedIds.length} Terpilih
                                </span>
                                <Button
                                    size="sm"
                                    onClick={() => setBatchApproveOpen(true)}
                                    className="text-xs font-mono h-8 gap-1.5"
                                >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Setujui Terpilih ({selectedIds.length})
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Approvals Table ──────────────────────────────────────── */}
                <Card className="border-border/60 shadow-none">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="font-display text-base">Daftar Transaksi Menunggu Persetujuan</CardTitle>
                            <CardDescription className="text-xs font-mono">
                                Total {filteredJournals.length} draf entri jurnal
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono gap-1">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" /> Kontrol SoD Aktif
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex h-48 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-xs font-mono text-muted-foreground">Memuat draf jurnal...</span>
                            </div>
                        ) : filteredJournals.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground font-mono text-xs">
                                Tidak ada entri jurnal yang sedang menunggu persetujuan.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={eligibleJournals.length > 0 && selectedIds.length === eligibleJournals.length}
                                                onChange={toggleSelectAll}
                                                disabled={eligibleJournals.length === 0}
                                                className="h-3.5 w-3.5"
                                            />
                                        </TableHead>
                                        <TableHead>Nomor Ref</TableHead>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Dibuat Oleh</TableHead>
                                        <TableHead>Catatan / Uraian</TableHead>
                                        <TableHead className="text-right">Total Debit / Kredit</TableHead>
                                        <TableHead>Status SoD</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="text-xs font-mono">
                                    {filteredJournals.map((j) => {
                                        const isSelf = checkIsSelfCreated(j);
                                        const isSelected = selectedIds.includes(j.id);

                                        return (
                                            <TableRow 
                                                key={j.id}
                                                className={`transition-colors ${
                                                    isSelf ? "bg-amber-50/20 dark:bg-amber-950/10" : isSelected ? "bg-primary/5" : ""
                                                }`}
                                            >
                                                <TableCell className="text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={isSelf}
                                                        onChange={() => toggleSelectId(j.id)}
                                                        className="h-3.5 w-3.5"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-bold text-foreground">
                                                    {j.referenceNumber}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {formatDate(j.date)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium text-foreground">
                                                        {j.createdBy || "Accountant"}
                                                    </div>
                                                    {isSelf && (
                                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                                                            (Anda)
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-sans text-muted-foreground line-clamp-1 max-w-[220px]">
                                                        {j.notes || "—"}
                                                    </div>
                                                    {j.rejectionReason && (
                                                        <Badge variant="destructive" className="text-[9px] mt-0.5 font-mono">
                                                            Revisi: {j.rejectionReason}
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-money font-bold">
                                                    {formatCurrency(j.totalAmount)}
                                                </TableCell>
                                                <TableCell>
                                                    {isSelf ? (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/30 font-mono gap-1 cursor-help">
                                                                    <Lock className="h-2.5 w-2.5" /> Butuh Reviewer Lain
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="text-xs max-w-xs">
                                                                Prinsip Segregation of Duties: Anda adalah pembuat entri ini dan dilarang menyetujui transaksi sendiri.
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 font-mono gap-1">
                                                            <Check className="h-2.5 w-2.5 text-emerald-600" /> Siap Disetujui
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            onClick={() => setInspectJournal(j)}
                                                            title="Inspeksi Baris Jurnal"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>

                                                        {isSelf ? (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            disabled
                                                                            className="h-7 text-xs font-mono opacity-50 cursor-not-allowed"
                                                                        >
                                                                            Setujui
                                                                        </Button>
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="text-xs max-w-xs">
                                                                    Segregation of Duties: Tidak dapat menyetujui draf buatan sendiri.
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => setApproveModal({ isOpen: true, journal: j })}
                                                                    className="h-7 text-xs font-mono gap-1"
                                                                >
                                                                    <CheckCircle2 className="h-3 w-3" /> Setujui
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => setRejectModal({ isOpen: true, journal: j })}
                                                                    className="h-7 text-xs font-mono text-destructive hover:bg-destructive/10"
                                                                >
                                                                    Tolak
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* ── Inspection Modal ─────────────────────────────────────── */}
                <Dialog open={!!inspectJournal} onOpenChange={(open) => !open && setInspectJournal(null)}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="font-display">Detail Entri Jurnal: {inspectJournal?.referenceNumber}</DialogTitle>
                            <DialogDescription>
                                Periksa rincian baris debit/kredit dan audit atribusi pembuat sebelum memberikan persetujuan.
                            </DialogDescription>
                        </DialogHeader>
                        {inspectJournal && (
                            <div className="space-y-4 py-2">
                                <div className="grid grid-cols-2 gap-3 text-xs font-mono bg-muted/40 p-3 rounded-lg border">
                                    <div>
                                        <span className="text-muted-foreground">Tanggal:</span>{" "}
                                        <span className="font-bold">{formatDate(inspectJournal.date)}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Dibuat Oleh:</span>{" "}
                                        <span className="font-bold">{inspectJournal.createdBy || "Accountant"}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">Uraian / Catatan:</span>{" "}
                                        <span className="font-sans font-medium">{inspectJournal.notes || "—"}</span>
                                    </div>
                                </div>

                                <div className="border rounded-md overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="text-xs">
                                                <TableHead>Kode / Nama Akun</TableHead>
                                                <TableHead>Uraian Baris</TableHead>
                                                <TableHead className="text-right">Debit</TableHead>
                                                <TableHead className="text-right">Kredit</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {inspectJournal.lines.map((line, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <div className="font-bold">{line.accountCode || line.accountId}</div>
                                                        <div className="font-sans text-[11px] text-muted-foreground">{line.accountName}</div>
                                                    </TableCell>
                                                    <TableCell className="font-sans text-[11px]">
                                                        {line.description || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-money font-bold">
                                                        {line.debit > 0 ? formatCurrency(line.debit) : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-right font-money font-bold">
                                                        {line.credit > 0 ? formatCurrency(line.credit) : "—"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow className="bg-muted/30 font-bold">
                                                <TableCell colSpan={2} className="text-right">Total:</TableCell>
                                                <TableCell className="text-right font-money text-emerald-700 dark:text-emerald-400">
                                                    {formatCurrency(inspectJournal.lines.reduce((s, l) => s + l.debit, 0))}
                                                </TableCell>
                                                <TableCell className="text-right font-money text-emerald-700 dark:text-emerald-400">
                                                    {formatCurrency(inspectJournal.lines.reduce((s, l) => s + l.credit, 0))}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Evidence Attachments Panel */}
                                <div className="border-t pt-3">
                                    <EvidenceAttachmentPanel
                                        entityType="JournalEntry"
                                        entityId={inspectJournal.id}
                                        readOnly={false}
                                        allowVerification={true}
                                    />
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setInspectJournal(null)}>Tutup</Button>
                            {inspectJournal && !checkIsSelfCreated(inspectJournal) && (
                                <>
                                    <Button 
                                        variant="outline" 
                                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => {
                                            const j = inspectJournal;
                                            setInspectJournal(null);
                                            setRejectModal({ isOpen: true, journal: j });
                                        }}
                                    >
                                        Tolak Jurnal
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            const j = inspectJournal;
                                            setInspectJournal(null);
                                            setApproveModal({ isOpen: true, journal: j });
                                        }}
                                    >
                                        Setujui Jurnal
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Single Approve Confirmation Dialog ───────────────────── */}
                <Dialog open={approveModal.isOpen} onOpenChange={(open) => !open && setApproveModal({ isOpen: false })}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="font-display">Setujui & Posting ke Buku Besar?</DialogTitle>
                            <DialogDescription>
                                Anda akan menyetujui entri jurnal <strong>{approveModal.journal?.referenceNumber}</strong> senilai <strong>{formatCurrency(approveModal.journal?.totalAmount || 0)}</strong>. Transaksi akan langsung tercatat pada Buku Besar umum.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2 text-xs font-mono bg-muted/40 p-3 rounded-lg border">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Pembuat Draf:</span>
                                <span className="font-bold">{approveModal.journal?.createdBy || "Accountant"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Penyetuju (Anda):</span>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">{currentUser.email || "Current User"}</span>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setApproveModal({ isOpen: false })}>Batal</Button>
                            <Button onClick={handleApproveSingle} disabled={isApproving}>
                                {isApproving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Konfirmasi & Posting
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Batch Approve Dialog ─────────────────────────────────── */}
                <Dialog open={batchApproveOpen} onOpenChange={setBatchApproveOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="font-display">Posting {selectedIds.length} Jurnal Terpilih?</DialogTitle>
                            <DialogDescription>
                                Seluruh {selectedIds.length} transaksi yang dipilih telah diverifikasi lolos aturan Segregation of Duties.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setBatchApproveOpen(false)}>Batal</Button>
                            <Button onClick={handleBatchApprove} disabled={isBatchApproving}>
                                {isBatchApproving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Posting {selectedIds.length} Jurnal
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── Rejection Dialog ─────────────────────────────────────── */}
                <Dialog open={rejectModal.isOpen} onOpenChange={(open) => !open && setRejectModal({ isOpen: false })}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="font-display">Tolak Jurnal: {rejectModal.journal?.referenceNumber}</DialogTitle>
                            <DialogDescription>
                                Masukkan alasan penolakan atau catatan revisi yang diperlukan agar pembuat draf dapat memperbaiki transaksi.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-semibold">Alasan Penolakan / Catatan Revisi *</Label>
                                <Textarea
                                    rows={3}
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Contoh: Kode akun beban salah, mohon ubah ke 6-1200 Beban Sewa..."
                                    className="text-xs"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectModal({ isOpen: false })}>Batal</Button>
                            <Button 
                                variant="destructive" 
                                onClick={handleReject} 
                                disabled={isRejecting || !rejectReason.trim()}
                            >
                                {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                                Tolak & Kembalikan ke Draf
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
