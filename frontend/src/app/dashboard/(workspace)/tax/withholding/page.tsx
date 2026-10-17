"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, Receipt, Users, Building, Download, RefreshCw, Loader2, ShieldCheck, AlertCircle, FileText } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { formatCurrency, formatDate } from "@/lib/utils/formatter"

export default function WithholdingTaxPage() {
    const today = new Date()
    const [year, setYear] = React.useState<number>(today.getFullYear())
    const [month, setMonth] = React.useState<number>(today.getMonth() + 1)
    const [data, setData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    const fetchWithholding = React.useCallback(async () => {
        try {
            setLoading(true)
            const result = await apiClient.getWithholdingSummary(year, month)
            setData(result)
        } catch (error) {
            console.error("Failed to load withholding summary", error)
            toast.error("Gagal memuat rekapitulasi pemotongan/pemungutan PPh")
        } finally {
            setLoading(false)
        }
    }, [year, month])

    React.useEffect(() => {
        fetchWithholding()
    }, [fetchWithholding])

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
                            Rekapitulasi{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                Potput PPh.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Pajak Penghasilan Pasal 21 (Skema TER PP 58/2023), PPh 23, PPh 4(2) Final, dan PPh 22 unifikasi.
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

                        <Button variant="outline" size="sm" onClick={fetchWithholding} disabled={loading} className="gap-1.5 text-xs font-mono">
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>

                        <Link href={`/dashboard/tax/exports?tab=ebupot&period=${year}-${month.toString().padStart(2, "0")}`}>
                            <Button size="sm" variant="secondary" className="gap-1.5 text-xs font-mono">
                                <Download className="h-3.5 w-3.5" />
                                Export e-Bupot
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
                    {/* ── KPI Summary Cards ─────────────────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">PPh 21 (TER Karyawan)</CardDescription>
                                <CardTitle className="text-xl font-bold font-money text-emerald-700 dark:text-emerald-400">
                                    {formatCurrency(data.totalPph21Withheld || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    {data.pph21Lines?.length || 0} Pegawai / Objek PPh 21
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">PPh 23 (Jasa & Sewa)</CardDescription>
                                <CardTitle className="text-xl font-bold font-money text-cyan-700 dark:text-cyan-400">
                                    {formatCurrency(data.totalPph23Withheld || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    {data.pph23Lines?.length || 0} Bukti Potong Jasa/Sewa
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">PPh 4(2) Final</CardDescription>
                                <CardTitle className="text-xl font-bold font-money text-purple-700 dark:text-purple-400">
                                    {formatCurrency(data.totalPph42Withheld || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    {data.pph42Lines?.length || 0} Sewa Gedung / Konstruksi
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                            <CardHeader className="pb-2">
                                <CardDescription className="text-xs font-mono uppercase tracking-wider">Total Seluruh Potput</CardDescription>
                                <CardTitle className="text-xl font-bold font-money">
                                    {formatCurrency(data.grandTotalWithheld || 0)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground">
                                    Masa {data.periodLabel}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ── Tax Categories Tabs ────────────────────────────────────────── */}
                    <Tabs defaultValue="pph21" className="space-y-4">
                        <TabsList className="grid grid-cols-4 w-full md:w-[650px] font-mono text-xs">
                            <TabsTrigger value="pph21">PPh 21 TER ({data.pph21Lines?.length || 0})</TabsTrigger>
                            <TabsTrigger value="pph23">PPh 23 ({data.pph23Lines?.length || 0})</TabsTrigger>
                            <TabsTrigger value="pph42">PPh 4(2) Final ({data.pph42Lines?.length || 0})</TabsTrigger>
                            <TabsTrigger value="pph22">PPh 22 ({data.pph22Lines?.length || 0})</TabsTrigger>
                        </TabsList>

                        {/* PPh 21 TER Tab */}
                        <TabsContent value="pph21" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">PPh Pasal 21 — Skema TER (PP 58/2023 & PMK 168/2023)</CardTitle>
                                    <CardDescription>
                                        Daftar pemotongan PPh 21 pegawai tetap berdasarkan status PTKP dan kategori Tarif Efektif Rata-rata bulanan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Bukti Potong</TableHead>
                                                <TableHead>Nama Pegawai</TableHead>
                                                <TableHead>NPWP / NIK</TableHead>
                                                <TableHead>PTKP</TableHead>
                                                <TableHead>Kategori</TableHead>
                                                <TableHead className="text-right">Penghasilan Bruto</TableHead>
                                                <TableHead className="text-right">Tarif TER</TableHead>
                                                <TableHead className="text-right">PPh 21 Dipotong</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {data.pph21Lines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                                                        {data.pph21Note ?? "Tidak ada pemotongan PPh 21 pada masa pajak ini."}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.pph21Lines.map((row: any) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-bold">{row.buktiPotongNumber ?? "Issued in Coretax"}</TableCell>
                                                        <TableCell>{row.counterpartyName}</TableCell>
                                                        <TableCell>{row.counterpartyNpwp || row.counterpartyNik || "—"}</TableCell>
                                                        <TableCell><Badge variant="outline" className="text-[10px]">{row.ptkpStatus}</Badge></TableCell>
                                                        <TableCell><Badge variant="secondary" className="text-[10px]">{row.terCategory}</Badge></TableCell>
                                                        <TableCell className="text-right font-money">{formatCurrency(row.grossDppAmount)}</TableCell>
                                                        <TableCell className="text-right">{row.effectiveTaxRate}%</TableCell>
                                                        <TableCell className="text-right font-money font-semibold text-emerald-700 dark:text-emerald-400">
                                                            {formatCurrency(row.taxWithheldAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* PPh 23 Tab */}
                        <TabsContent value="pph23" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">PPh Pasal 23 — Jasa, Sewa & Royalti</CardTitle>
                                    <CardDescription>
                                        Daftar pemotongan PPh 23 atas tagihan jasa teknik, manajemen, konsultan, dan sewa selain tanah/bangunan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Bukti Potong</TableHead>
                                                <TableHead>Kode Objek</TableHead>
                                                <TableHead>Nama Rekanan / Vendor</TableHead>
                                                <TableHead>NPWP</TableHead>
                                                <TableHead>No. Tagihan</TableHead>
                                                <TableHead className="text-right">DPP Bruto</TableHead>
                                                <TableHead className="text-right">Tarif</TableHead>
                                                <TableHead className="text-right">PPh 23 Dipotong</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {data.pph23Lines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                                                        Tidak ada pemotongan PPh 23 pada masa pajak ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.pph23Lines.map((row: any) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-bold">{row.buktiPotongNumber ?? "Issued in Coretax"}</TableCell>
                                                        <TableCell><Badge variant="outline" className="text-[10px]">{row.kodeObjekPajak}</Badge></TableCell>
                                                        <TableCell>{row.counterpartyName}</TableCell>
                                                        <TableCell>{row.counterpartyNpwp || "—"}</TableCell>
                                                        <TableCell>{row.referenceDocument}</TableCell>
                                                        <TableCell className="text-right font-money">{formatCurrency(row.grossDppAmount)}</TableCell>
                                                        <TableCell className="text-right">{row.effectiveTaxRate}%</TableCell>
                                                        <TableCell className="text-right font-money font-semibold text-cyan-700 dark:text-cyan-400">
                                                            {formatCurrency(row.taxWithheldAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* PPh 4(2) Final Tab */}
                        <TabsContent value="pph42" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">PPh Pasal 4(2) Final — Sewa Tanah & Jasa Konstruksi</CardTitle>
                                    <CardDescription>
                                        Daftar pemotongan PPh bersifat final yang tidak dapat dikreditkan pada SPT Tahunan Badan.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Bukti Potong</TableHead>
                                                <TableHead>Kode Objek</TableHead>
                                                <TableHead>Nama Rekanan / Pemilik</TableHead>
                                                <TableHead>NPWP</TableHead>
                                                <TableHead>No. Dokumen</TableHead>
                                                <TableHead className="text-right">DPP Bruto</TableHead>
                                                <TableHead className="text-right">Tarif Final</TableHead>
                                                <TableHead className="text-right">PPh 4(2) Dipotong</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {data.pph42Lines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                                                        Tidak ada pemotongan PPh 4(2) Final pada masa pajak ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.pph42Lines.map((row: any) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-bold">{row.buktiPotongNumber ?? "Issued in Coretax"}</TableCell>
                                                        <TableCell><Badge variant="outline" className="text-[10px]">{row.kodeObjekPajak}</Badge></TableCell>
                                                        <TableCell>{row.counterpartyName}</TableCell>
                                                        <TableCell>{row.counterpartyNpwp || "—"}</TableCell>
                                                        <TableCell>{row.referenceDocument}</TableCell>
                                                        <TableCell className="text-right font-money">{formatCurrency(row.grossDppAmount)}</TableCell>
                                                        <TableCell className="text-right">{row.effectiveTaxRate}%</TableCell>
                                                        <TableCell className="text-right font-money font-semibold text-purple-700 dark:text-purple-400">
                                                            {formatCurrency(row.taxWithheldAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* PPh 22 Tab */}
                        <TabsContent value="pph22" className="space-y-4">
                            <Card className="border-border/60 shadow-none">
                                <CardHeader>
                                    <CardTitle className="font-display text-lg">PPh Pasal 22 — Impor & Pengadaan</CardTitle>
                                    <CardDescription>
                                        Daftar pemungutan PPh 22 atas impor BKP dan transaksi pengadaan barang tertentu.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No. Bukti Potong</TableHead>
                                                <TableHead>Kode Objek</TableHead>
                                                <TableHead>Nama Rekanan</TableHead>
                                                <TableHead>NPWP</TableHead>
                                                <TableHead className="text-right">DPP</TableHead>
                                                <TableHead className="text-right">Tarif</TableHead>
                                                <TableHead className="text-right">PPh 22 Dipungut</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="text-xs font-mono">
                                            {data.pph22Lines?.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                                                        Tidak ada pemungutan PPh 22 pada masa pajak ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                data.pph22Lines.map((row: any) => (
                                                    <TableRow key={row.id}>
                                                        <TableCell className="font-bold">{row.buktiPotongNumber ?? "Issued in Coretax"}</TableCell>
                                                        <TableCell><Badge variant="outline" className="text-[10px]">{row.kodeObjekPajak}</Badge></TableCell>
                                                        <TableCell>{row.counterpartyName}</TableCell>
                                                        <TableCell>{row.counterpartyNpwp || "—"}</TableCell>
                                                        <TableCell className="text-right font-money">{formatCurrency(row.grossDppAmount)}</TableCell>
                                                        <TableCell className="text-right">{row.effectiveTaxRate}%</TableCell>
                                                        <TableCell className="text-right font-money font-semibold">
                                                            {formatCurrency(row.taxWithheldAmount)}
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
