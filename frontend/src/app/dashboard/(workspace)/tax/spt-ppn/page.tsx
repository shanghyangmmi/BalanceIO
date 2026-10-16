"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownLeft, ShieldCheck, Download, Loader2, Sparkles, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils/formatter"

export default function SptPpnPage() {
    const today = new Date()
    const [year, setYear] = React.useState<number>(today.getFullYear())
    const [month, setMonth] = React.useState<number>(today.getMonth() + 1)
    const [data, setData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [isSettling, setIsSettling] = React.useState(false)
    const [settleDialogOpen, setSettleDialogOpen] = React.useState(false)
    const [settlementDate, setSettlementDate] = React.useState(new Date().toISOString().split('T')[0])
    const [settlementNotes, setSettlementNotes] = React.useState("")

    const fetchSpt = React.useCallback(async () => {
        try {
            setLoading(true)
            const result = await apiClient.getSptPpn1111(year, month)
            setData(result)
        } catch (error) {
            console.error("Failed to load SPT Masa PPN 1111", error)
            toast.error("Gagal memuat SPT Masa PPN 1111")
        } finally {
            setLoading(false)
        }
    }, [year, month])

    React.useEffect(() => {
        fetchSpt()
    }, [fetchSpt])

    const handleSettlePpn = async () => {
        try {
            setIsSettling(true)
            const res = await apiClient.settlePpn({
                year,
                month,
                settlementDate,
                notes: settlementNotes || `SPT Masa PPN 1111 Closing Masa ${month}/${year}`
            })
            toast.success(res.message || "Jurnal penutupan PPN berhasil diposting.")
            setSettleDialogOpen(false)
            fetchSpt()
        } catch (error: any) {
            console.error("Failed to settle PPN", error)
            toast.error(error.message || "Gagal memposting jurnal penutupan PPN.")
        } finally {
            setIsSettling(false)
        }
    }

    const months = [
        { value: 1, label: "Januari" },
        { value: 2, label: "Februari" },
        { value: 3, label: "Maret" },
        { value: 4, label: "April" },
        { value: 5, label: "Mei" },
        { value: 6, label: "Juni" },
        { value: 7, label: "Juli" },
        { value: 8, label: "Agustus" },
        { value: 9, label: "September" },
        { value: 10, label: "Oktober" },
        { value: 11, label: "November" },
        { value: 12, label: "Desember" },
    ]

    return (
        <div className="flex-1 space-y-8 pb-12">
            {/* ── Masthead ─────────────────────────────────────────────── */}
            <header className="space-y-4">
                <Link
                    href="/dashboard/tax"
                    className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
                >
                    <ChevronLeft className="h-3 w-3" strokeWidth={2} />
                    Tax Workspace
                </Link>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                            SPT Masa{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                PPN 1111.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Surat Pemberitahuan Masa Pajak Pertambahan Nilai dan formulir lampiran AB, A2, B2/B3 sesuai PER-03/PJ/2022.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Month Selector */}
                        <Select value={month.toString()} onValueChange={(val) => setMonth(parseInt(val))}>
                            <SelectTrigger className="w-[130px] font-mono text-xs">
                                <SelectValue placeholder="Pilih Bulan" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value.toString()} className="text-xs font-mono">
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Year Selector */}
                        <Select value={year.toString()} onValueChange={(val) => setYear(parseInt(val))}>
                            <SelectTrigger className="w-[100px] font-mono text-xs">
                                <SelectValue placeholder="Tahun" />
                            </SelectTrigger>
                            <SelectContent>
                                {[2024, 2025, 2026, 2027].map((y) => (
                                    <SelectItem key={y} value={y.toString()} className="text-xs font-mono">
                                        {y}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Button variant="outline" size="sm" onClick={fetchSpt} disabled={loading} className="gap-1.5 text-xs font-mono">
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>

                        <Link href={`/dashboard/tax/exports?period=${year}-${month.toString().padStart(2, "0")}`}>
                            <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-mono">
                                <Download className="h-3.5 w-3.5" />
                                Export e-Faktur
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : data ? (
                <div className="space-y-6">
                    {/* ── Status KPI Cards ─────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">Total Penyerahan (DPP)</CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {formatCurrency(data.totalPenyerahanDpp || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    {data.totalFakturKeluaranCount} Faktur Pajak Keluaran
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-1">
                                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> PPN Keluaran
                                </CardDescription>
                                <CardTitle className="text-xl font-bold font-money text-emerald-700 dark:text-emerald-400">
                                    {formatCurrency(data.totalPpnKeluaran || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    Terutang dipungut (Akun 2-1300)
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider flex items-center gap-1">
                                    <ArrowDownLeft className="h-3.5 w-3.5 text-cyan-600" /> PPN Masukan Dikreditkan
                                </CardDescription>
                                <CardTitle className="text-xl font-bold font-money text-cyan-700 dark:text-cyan-400">
                                    {formatCurrency(data.totalPpnMasukanDapatDikreditkan || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    {data.formB2Lines?.length || 0} Faktur Pembelian (Akun 1-1400)
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={`border shadow-none backdrop-blur-sm ${
                            data.ppnKurangBayar > 0 
                                ? "bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" 
                                : data.ppnLebihBayar > 0
                                ? "bg-cyan-50/40 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-800"
                                : "bg-card/60 border-border/60"
                        }`}>
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider font-semibold">
                                    Status SPT Masa
                                </CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {data.ppnKurangBayar > 0 
                                        ? formatCurrency(data.ppnKurangBayar)
                                        : data.ppnLebihBayar > 0
                                        ? formatCurrency(data.ppnLebihBayar)
                                        : "Rp 0 (Nihil)"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-center justify-between">
                                <Badge variant={data.ppnKurangBayar > 0 ? "destructive" : "outline"} className="text-[10px] font-mono">
                                    {data.taxStatusLabel}
                                </Badge>
                                {data.isSettlementJournalPosted ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-mono font-medium">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Jurnal Ditutup
                                    </span>
                                ) : (
                                    <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-6 text-[10px] font-mono">
                                                Tutup Masa
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle className="font-display">Posting Jurnal Penutupan PPN</DialogTitle>
                                                <DialogDescription>
                                                    Tutup akun PPN Keluaran (2-1300) dan PPN Masukan (1-1400) ke akun {data.ppnKurangBayar > 0 ? "PPN Kurang Bayar (2-1400)" : "PPN Lebih Bayar (1-1450)"} untuk Masa {data.periodLabel}.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-3">
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor="sDate" className="text-xs">Tanggal Jurnal Penutupan</Label>
                                                    <Input id="sDate" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
                                                </div>
                                                <div className="grid gap-1.5">
                                                    <Label htmlFor="sNotes" className="text-xs">Catatan Jurnal</Label>
                                                    <Input id="sNotes" value={settlementNotes} onChange={(e) => setSettlementNotes(e.target.value)} placeholder={`SPT Masa PPN 1111 Closing Masa ${month}/${year}`} />
                                                </div>
                                                <div className="rounded-md border p-3 text-xs bg-muted/40 font-mono space-y-1">
                                                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                                                        <span>Dr. 2-1300 PPN Keluaran:</span>
                                                        <span className="font-bold font-money">{formatCurrency(data.totalPpnKeluaran)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-cyan-700 dark:text-cyan-400">
                                                        <span>Cr. 1-1400 PPN Masukan:</span>
                                                        <span className="font-bold font-money">{formatCurrency(data.totalPpnMasukanDapatDikreditkan)}</span>
                                                    </div>
                                                    <div className="border-t pt-1 flex justify-between font-bold">
                                                        <span>{data.ppnKurangBayar > 0 ? "Cr. 2-1400 PPN Kurang Bayar:" : "Dr. 1-1450 PPN Lebih Bayar:"}</span>
                                                        <span className="font-money">{formatCurrency(data.ppnKurangBayar || data.ppnLebihBayar)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>Batal</Button>
                                                <Button onClick={handleSettlePpn} disabled={isSettling}>
                                                    {isSettling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                                                    Konfirmasi & Posting
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Statutory Tabs Breakdown ─────────────────────────────────── */}
                    <Tabs defaultValue="induk" className="space-y-4">
                        <TabsList className="grid grid-cols-4 w-full md:w-[650px] font-mono text-xs">
                            <TabsTrigger value="induk">Induk SPT</TabsTrigger>
                            <TabsTrigger value="formAb">Form 1111 AB</TabsTrigger>
                            <TabsTrigger value="formA2">Form A2 ({data.formA2Lines?.length || 0})</TabsTrigger>
                            <TabsTrigger value="formB2">Form B2 ({data.formB2Lines?.length || 0})</TabsTrigger>
                        </TabsList>

                        {/* Induk SPT Tab */}
                        <TabsContent value="induk" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">Induk SPT Masa PPN 1111 — {data.periodLabel}</CardTitle>
                                    <CardDescription>
                                        Ringkasan penghitungan Pajak Pertambahan Nilai dan Pajak Penjualan atas Barang Mewah terutang.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12">No</TableHead>
                                                <TableHead>Uraian</TableHead>
                                                <TableHead className="text-right">DPP (Rupiah)</TableHead>
                                                <TableHead className="text-right">PPN (Rupiah)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            <TableRow className="bg-muted/20 font-semibold">
                                                <TableCell>I</TableCell>
                                                <TableCell colSpan={3}>Penyerahan Barang dan Jasa</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>1</TableCell>
                                                <TableCell>Penyerahan Dalam Negeri dengan Faktur Pajak</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.dppPenyerahanDalamNegeriFaktur)}</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.ppnPenyerahanDalamNegeriFaktur)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>2</TableCell>
                                                <TableCell>Ekspor BKP Berwujud / BKP Tidak Berwujud / JKP</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.dppPenyerahanEkspor)}</TableCell>
                                                <TableCell className="text-right font-money">Rp 0</TableCell>
                                            </TableRow>
                                            <TableRow className="font-semibold bg-muted/10">
                                                <TableCell colSpan={2}>Jumlah Penyerahan (I.1 + I.2)</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.totalPenyerahanDpp)}</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.totalPpnKeluaran)}</TableCell>
                                            </TableRow>

                                            <TableRow className="bg-muted/20 font-semibold">
                                                <TableCell>II</TableCell>
                                                <TableCell colSpan={3}>Penghitungan PPN Kurang Bayar / Lebih Bayar</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>A</TableCell>
                                                <TableCell>Pajak Keluaran yang harus dipungut sendiri</TableCell>
                                                <TableCell className="text-right font-money">—</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.totalPpnKeluaran)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>B</TableCell>
                                                <TableCell>Pajak Masukan yang dapat diperhitungkan</TableCell>
                                                <TableCell className="text-right font-money">—</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.totalPpnMasukanDapatDikreditkan)}</TableCell>
                                            </TableRow>
                                            <TableRow className="font-bold bg-primary/5">
                                                <TableCell>C</TableCell>
                                                <TableCell>PPN Kurang atau (Lebih) Bayar (II.A - II.B)</TableCell>
                                                <TableCell className="text-right font-money">—</TableCell>
                                                <TableCell className="text-right font-money text-base">
                                                    {data.ppnKurangBayar > 0 ? formatCurrency(data.ppnKurangBayar) : `(${formatCurrency(data.ppnLebihBayar)})`}
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Form AB Tab */}
                        <TabsContent value="formAb" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">Formulir 1111 AB — Rekapitulasi Penyerahan dan Perolehan</CardTitle>
                                    <CardDescription>
                                        Rekapitulasi penyerahan barang/jasa dan perolehan BKP/JKP untuk Masa Pajak {data.periodLabel}.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Kode / Uraian</TableHead>
                                                <TableHead className="text-right">DPP (Rupiah)</TableHead>
                                                <TableHead className="text-right">PPN (Rupiah)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            <TableRow className="font-semibold bg-muted/20">
                                                <TableCell colSpan={3}>I. Rekapitulasi Penyerahan</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>A. Ekspor BKP / JKP</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.dppPenyerahanEkspor)}</TableCell>
                                                <TableCell className="text-right font-money">Rp 0</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>B. Penyerahan Dalam Negeri dengan Faktur Pajak</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.dppPenyerahanDalamNegeriFaktur)}</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.ppnPenyerahanDalamNegeriFaktur)}</TableCell>
                                            </TableRow>
                                            <TableRow className="font-semibold bg-muted/20">
                                                <TableCell colSpan={3}>II. Rekapitulasi Perolehan</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>A. Impor BKP / Pemanfaatan JKP Luar Negeri</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.dppImporBkp)}</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.ppnImporBkp)}</TableCell>
                                            </TableRow>
                                            <TableRow>
                                                <TableCell>B. Perolehan BKP / JKP Dalam Negeri yang dapat dikreditkan</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.dppPerolehanBkpJkpDalamNegeri)}</TableCell>
                                                <TableCell className="text-right font-money">{formatCurrency(data.ppnPerolehanBkpJkpDalamNegeri)}</TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Form A2 Tab (Pajak Keluaran) */}
                        <TabsContent value="formA2" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">Formulir 1111 A2 — Daftar Pajak Keluaran</CardTitle>
                                    <CardDescription>
                                        Daftar faktur pajak keluaran atas penyerahan dalam negeri kepada pihak pembeli.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Faktur / NSFP</TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Nama Pembeli / Counterparty</TableHead>
                                                <TableHead>NPWP / NIK</TableHead>
                                                <TableHead className="text-right">DPP</TableHead>
                                                <TableHead className="text-right">Tarif</TableHead>
                                                <TableHead className="text-right">PPN</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {data.formA2Lines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                                        Tidak ada faktur pajak keluaran yang tercatat pada masa pajak ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.formA2Lines.map((row: any) => (
                                                    <TableRow key={row.documentId}>
                                                        <TableCell className="font-bold">{row.fakturPajakNumber}</TableCell>
                                                        <TableCell>{formatDate(row.documentDate)}</TableCell>
                                                        <TableCell>{row.counterpartyName}</TableCell>
                                                        <TableCell>{row.counterpartyNpwp || row.counterpartyNik || "—"}</TableCell>
                                                        <TableCell className="text-right font-money">{formatCurrency(row.dppAmount)}</TableCell>
                                                        <TableCell className="text-right">{row.taxRate}%</TableCell>
                                                        <TableCell className="text-right font-money font-semibold text-emerald-700 dark:text-emerald-400">
                                                            {formatCurrency(row.ppnAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Form B2 Tab (Pajak Masukan) */}
                        <TabsContent value="formB2" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">Formulir 1111 B2 — Pajak Masukan Dapat Dikreditkan</CardTitle>
                                    <CardDescription>
                                        Daftar faktur pajak masukan atas perolehan BKP/JKP yang dapat dikreditkan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Faktur / Tagihan</TableHead>
                                                <TableHead>Tanggal</TableHead>
                                                <TableHead>Nama Penjual / Supplier</TableHead>
                                                <TableHead>NPWP</TableHead>
                                                <TableHead className="text-right">DPP</TableHead>
                                                <TableHead className="text-right">Tarif</TableHead>
                                                <TableHead className="text-right">PPN Masukan</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {data.formB2Lines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                                        Tidak ada faktur pajak masukan yang tercatat pada masa pajak ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.formB2Lines.map((row: any) => (
                                                    <TableRow key={row.documentId}>
                                                        <TableCell className="font-bold">{row.fakturPajakNumber}</TableCell>
                                                        <TableCell>{formatDate(row.documentDate)}</TableCell>
                                                        <TableCell>{row.counterpartyName}</TableCell>
                                                        <TableCell>{row.counterpartyNpwp || "—"}</TableCell>
                                                        <TableCell className="text-right font-money">{formatCurrency(row.dppAmount)}</TableCell>
                                                        <TableCell className="text-right">{row.taxRate}%</TableCell>
                                                        <TableCell className="text-right font-money font-semibold text-cyan-700 dark:text-cyan-400">
                                                            {formatCurrency(row.ppnAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            ) : null}
        </div>
    )
}
