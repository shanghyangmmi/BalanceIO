"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, Download, FileSpreadsheet, FileCode, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Loader2, Copy, FileCheck } from "lucide-react"
import { apiClient } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils/formatter"

export default function TaxExportsPage() {
    const searchParams = useSearchParams()
    const periodParam = searchParams.get("period")
    const tabParam = searchParams.get("tab")

    const today = new Date()
    const defaultYear = periodParam ? parseInt(periodParam.split("-")[0]) : today.getFullYear()
    const defaultMonth = periodParam ? parseInt(periodParam.split("-")[1]) : today.getMonth() + 1

    const [year, setYear] = React.useState<number>(defaultYear)
    const [month, setMonth] = React.useState<number>(defaultMonth)
    const [activeTab, setActiveTab] = React.useState<string>(tabParam === "ebupot" ? "ebupot" : "efaktur")
    const [bupotTaxType, setBupotTaxType] = React.useState<string>("unifikasi")

    const [efakturData, setEfakturData] = React.useState<any>(null)
    const [ebupotData, setEbupotData] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    const fetchExports = React.useCallback(async () => {
        try {
            setLoading(true)
            const [efakturRes, ebupotRes] = await Promise.all([
                apiClient.getEFakturPreview(year, month),
                apiClient.getEBupotPreview(year, month, bupotTaxType)
            ])
            setEfakturData(efakturRes)
            setEbupotData(ebupotRes)
        } catch (error) {
            console.error("Failed to load tax export previews", error)
            toast.error("Gagal memuat pratinjau ekspor perpajakan")
        } finally {
            setLoading(false)
        }
    }, [year, month, bupotTaxType])

    React.useEffect(() => {
        fetchExports()
    }, [fetchExports])

    const handleDownload = (content: string, fileName: string, type: string = "text/csv") => {
        const blob = new Blob([content], { type: `${type};charset=utf-8;` })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", fileName)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success(`File ${fileName} berhasil diunduh.`)
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Konten CSV disalin ke clipboard.")
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
                            Ekspor{" "}
                            <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-700 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 bg-clip-text text-transparent">
                                DJP Online.
                            </span>
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Format impor resmi aplikasi DJP e-Faktur desktop dan skema e-Bupot Unifikasi 2024/2026.
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

                        <Button variant="outline" size="sm" onClick={fetchExports} disabled={loading} className="gap-1.5 text-xs font-mono">
                            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid grid-cols-2 w-full md:w-[480px] font-mono text-xs">
                        <TabsTrigger value="efaktur" className="gap-1.5">
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                            e-Faktur CSV (PPN)
                        </TabsTrigger>
                        <TabsTrigger value="ebupot" className="gap-1.5">
                            <FileCode className="h-3.5 w-3.5" />
                            e-Bupot Unifikasi (PPh)
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab 1: e-Faktur CSV Export ────────────────────────────────────────── */}
                    <TabsContent value="efaktur" className="space-y-6">
                        {efakturData && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                                        <CardHeader className="pb-2">
                                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Faktur Siap Ekspor</CardDescription>
                                            <CardTitle className="text-2xl font-bold font-money">
                                                {efakturData.invoiceCount} Dokumen
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground">
                                                Masa Pajak {efakturData.period}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                                        <CardHeader className="pb-2">
                                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Total DPP Penyerahan</CardDescription>
                                            <CardTitle className="text-2xl font-bold font-money">
                                                {formatCurrency(efakturData.totalDpp)}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground">
                                                PPN: {formatCurrency(efakturData.totalPpn)}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className={`border shadow-none backdrop-blur-sm ${
                                        efakturData.missingNpwpWarningCount > 0
                                            ? "bg-amber-50/40 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                                            : "bg-emerald-50/40 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                    }`}>
                                        <CardHeader className="pb-2">
                                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Validasi NPWP Pembeli</CardDescription>
                                            <CardTitle className="text-2xl font-bold font-money flex items-center gap-2">
                                                {efakturData.missingNpwpWarningCount > 0 ? (
                                                    <>
                                                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                                                        <span className="text-amber-700 dark:text-amber-400">{efakturData.missingNpwpWarningCount} Tanpa NPWP</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                                        <span className="text-emerald-700 dark:text-emerald-400">100% Valid</span>
                                                    </>
                                                )}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground">
                                                {efakturData.missingNpwpWarningCount > 0 ? "Otomatis diisi 00.000.000.0-000.000" : "Semua faktur memiliki NPWP"}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card className="border-border/60 shadow-none">
                                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                                        <div>
                                            <CardTitle className="font-display text-lg">Pratinjau File e-Faktur CSV</CardTitle>
                                            <CardDescription>
                                                Format standar impor DJP e-Faktur (FK, LT, OF) sesuai PER-03/PJ/2022.
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="gap-1.5 text-xs font-mono"
                                                onClick={() => copyToClipboard(efakturData.csvContent)}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                Salin CSV
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="gap-1.5 text-xs font-mono"
                                                onClick={() => handleDownload(efakturData.csvContent, efakturData.fileName)}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Unduh CSV ({efakturData.fileName})
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-md border bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto max-h-96">
                                            <pre className="whitespace-pre">{efakturData.csvContent}</pre>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>

                    {/* ── Tab 2: e-Bupot Unifikasi Export ───────────────────────────────────── */}
                    <TabsContent value="ebupot" className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Jenis Pajak:</Label>
                                <Select value={bupotTaxType} onValueChange={setBupotTaxType}>
                                    <SelectTrigger className="w-[180px] font-mono text-xs">
                                        <SelectValue placeholder="Pilih Jenis" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unifikasi" className="text-xs font-mono">Unifikasi (Semua PPh)</SelectItem>
                                        <SelectItem value="pph21" className="text-xs font-mono">PPh 21 (TER)</SelectItem>
                                        <SelectItem value="pph23" className="text-xs font-mono">PPh 23 (Jasa/Sewa)</SelectItem>
                                        <SelectItem value="pph42" className="text-xs font-mono">PPh 4(2) Final</SelectItem>
                                        <SelectItem value="pph22" className="text-xs font-mono">PPh 22</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {ebupotData && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                                        <CardHeader className="pb-2">
                                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Jumlah Bukti Potong</CardDescription>
                                            <CardTitle className="text-2xl font-bold font-money">
                                                {ebupotData.recordCount} Rekaman
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground">
                                                Skema Unifikasi DJP {ebupotData.taxType.toUpperCase()}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                                        <CardHeader className="pb-2">
                                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Total Dasar Pemotongan (DPP)</CardDescription>
                                            <CardTitle className="text-2xl font-bold font-money">
                                                {formatCurrency(ebupotData.totalDpp)}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground">
                                                Penghasilan bruto yang dipotong
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-border/60 shadow-none bg-card/60 backdrop-blur-sm">
                                        <CardHeader className="pb-2">
                                            <CardDescription className="text-xs font-mono uppercase tracking-wider">Total PPh Dipotong</CardDescription>
                                            <CardTitle className="text-2xl font-bold font-money text-emerald-700 dark:text-emerald-400">
                                                {formatCurrency(ebupotData.totalTaxWithheld)}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-xs text-muted-foreground">
                                                Kewajiban setor ke kas negara
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card className="border-border/60 shadow-none">
                                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                                        <div>
                                            <CardTitle className="font-display text-lg">Pratinjau File e-Bupot Unifikasi</CardTitle>
                                            <CardDescription>
                                                Format data impor aplikasi e-Bupot Unifikasi DJP Online dengan Kode Objek Pajak.
                                            </CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="gap-1.5 text-xs font-mono"
                                                onClick={() => copyToClipboard(ebupotData.exportContent)}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                                Salin Format
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="gap-1.5 text-xs font-mono"
                                                onClick={() => handleDownload(ebupotData.exportContent, ebupotData.fileName, ebupotData.contentType)}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                Unduh ({ebupotData.fileName})
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-md border bg-zinc-950 p-4 font-mono text-xs text-zinc-100 overflow-x-auto max-h-96">
                                            <pre className="whitespace-pre">{ebupotData.exportContent}</pre>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    )
}
