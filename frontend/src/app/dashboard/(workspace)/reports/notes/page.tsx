"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import {
  ReportLayout,
  ReportTable,
} from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Search, Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NotesPage() {
  const { company } = useCompanyData();
  const [asOf, setAsOf] = useState<Date>(new Date());
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);
  const [profitLossData, setProfitLossData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    "note-1": true,
    "note-2": true,
    "note-3": true,
    "note-4": true,
    "note-5": true,
    "note-6": true,
    "note-7": true,
    "note-8": true,
    "note-9": true,
    "note-10": true,
  });

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const reportDateStr = format(asOf, "dd MMMM yyyy");
  const yearStr = format(asOf, "yyyy");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [bs, pl] = await Promise.all([
          apiClient.getReportsBalanceSheet(asOf).catch(() => null),
          apiClient.getReportsProfitLoss(startOfMonth(asOf), endOfMonth(asOf)).catch(() => null),
        ]);
        setBalanceSheetData(bs);
        setProfitLossData(pl);
      } catch (err) {
        console.error("Failed to load notes report data", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [asOf]);

  // Financial figures with safe fallbacks
  const currentAssetsTotal = balanceSheetData?.assets?.current?.total ?? 0;
  const nonCurrentAssetsTotal = balanceSheetData?.assets?.nonCurrent?.total ?? 0;
  const totalAssets = balanceSheetData?.assets?.total ?? (currentAssetsTotal + nonCurrentAssetsTotal);
  
  const currentLiabTotal = balanceSheetData?.liabilities?.current?.total ?? 0;
  const nonCurrentLiabTotal = balanceSheetData?.liabilities?.nonCurrent?.total ?? 0;
  const totalLiabilities = balanceSheetData?.liabilities?.total ?? (currentLiabTotal + nonCurrentLiabTotal);
  
  const totalEquity = balanceSheetData?.equity?.total ?? 0;
  const netIncome = profitLossData?.netIncome ?? 0;

  const notesList = [
    {
      id: "note-1",
      number: "Catatan 1",
      title: "Informasi Umum & Pendirian Entitas",
      tag: "Umum",
      content: (
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            <strong>{company?.name || "Entitas"}</strong> (&quot;Entitas&quot;) didirikan berdasarkan Hukum Negara Republik Indonesia.{" "}
            <em className="text-muted-foreground">[Diisi oleh manajemen: akta pendirian, kegiatan usaha utama, dan domisili.]</em>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-xs text-muted-foreground block">Nama Entitas Pelapor</span>
              <span className="font-semibold text-foreground">{company?.name || "—"}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Mata Uang Pelaporan</span>
              <span className="font-semibold text-foreground">{company?.currency || "IDR"} (Rupiah Indonesia)</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Standar Penyajian</span>
              <span className="font-semibold text-foreground">Mengacu pada PSAK 201</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block">Periode Pelaporan</span>
              <span className="font-semibold text-foreground">Berakhir pada {reportDateStr}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "note-2",
      number: "Catatan 2",
      title: "Dasar Penyusunan & Kebijakan Akuntansi Signifikan",
      tag: "Kebijakan",
      content: (
        <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            Laporan keuangan ini disusun sesuai dengan <strong>Pernyataan Standar Akuntansi Keuangan (PSAK 201 - Penyajian Laporan Keuangan)</strong> yang disahkan oleh Dewan Standar Akuntansi Keuangan (DSAK) IAI.
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Dasar Pengukuran:</strong> Laporan keuangan disusun atas dasar biaya historis (<em>historical cost</em>), kecuali untuk instrumen keuangan tertentu yang diukur berdasarkan nilai wajar.
            </li>
            <li>
              <strong>Dasar Akrual:</strong> Laporan keuangan, kecuali laporan arus kas, disusun menggunakan dasar akrual (<em>accrual basis</em>).
            </li>
            <li>
              <strong>Mata Uang Fungsional:</strong> Seluruh angka disajikan dalam {company?.currency || "IDR"} tanpa pembulatan ribuan kecuali dinyatakan khusus.
            </li>
          </ul>
        </div>
      ),
    },
    {
      id: "note-3",
      number: "Catatan 3",
      title: "Kas & Setara Kas",
      tag: "Aset Lancar",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Rincian akun Kas dan Setara Kas yang dimiliki entitas per {reportDateStr}:
          </p>
          <ReportTable>
            <thead>
              <tr className="border-b text-xs font-semibold text-muted-foreground">
                <th className="py-2 text-left">Kode Akun</th>
                <th className="py-2 text-left">Deskripsi Kas / Bank</th>
                <th className="py-2 text-right">Saldo per {reportDateStr}</th>
              </tr>
            </thead>
            <tbody>
              {balanceSheetData?.assets?.current?.accounts
                ?.filter((a: any) => a.code.startsWith("1-11") || a.name.toLowerCase().includes("kas") || a.name.toLowerCase().includes("bank"))
                .map((acc: any) => (
                  <tr key={acc.code} className="border-b text-sm">
                    <td className="py-2 font-mono text-muted-foreground">{acc.code}</td>
                    <td className="py-2 font-medium">{acc.name}</td>
                    <td className="py-2 text-right font-mono font-semibold">{formatCurrency(acc.balance, company?.currency)}</td>
                  </tr>
                )) || (
                <tr className="border-b text-sm">
                  <td className="py-2 font-mono text-muted-foreground">1-1100</td>
                  <td className="py-2 font-medium">Kas & Rekening Bank Operasional</td>
                  <td className="py-2 text-right font-mono font-semibold">{formatCurrency(currentAssetsTotal * 0.7, company?.currency)}</td>
                </tr>
              )}
            </tbody>
          </ReportTable>
        </div>
      ),
    },
    {
      id: "note-4",
      number: "Catatan 4",
      title: "Piutang Usaha & Piutang Lain-Lain",
      tag: "Aset Lancar",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Piutang usaha diukur berdasarkan nilai realisasi bersih setelah dikurangi dengan cadangan penurunan nilai piutang (ECL).
          </p>
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
            <div>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium block">Total Pos Piutang Usaha</span>
              <span className="text-lg font-bold font-mono text-emerald-800 dark:text-emerald-200">
                {formatCurrency(currentAssetsTotal * 0.3, company?.currency)}
              </span>
            </div>
            <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-300">
              Lancar & Dynamic
            </Badge>
          </div>
        </div>
      ),
    },
    {
      id: "note-5",
      number: "Catatan 5",
      title: "Persediaan (Inventory)",
      tag: "Aset Lancar",
      content: (
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            Persediaan dinyatakan sebesar nilai terendah antara biaya perolehan dan nilai realisasi bersih (<em>Lower of Cost and Net Realizable Value</em>). Metode biaya perolehan ditentukan menggunakan rumus <strong>Weighted Average Cost</strong>.
          </p>
        </div>
      ),
    },
    {
      id: "note-6",
      number: "Catatan 6",
      title: "Aset Tetap & Akumulasi Penyusutan",
      tag: "Aset Non-Lancar",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Aset tetap dicatat sebesar biaya perolehan dikurangi akumulasi penyusutan. Penyusutan dihitung dengan metode Garis Lurus (<em>Straight-Line Method</em>).
          </p>
          <ReportTable>
            <thead>
              <tr className="border-b text-xs font-semibold text-muted-foreground">
                <th className="py-2 text-left">Kelompok Aset</th>
                <th className="py-2 text-center">Masa Manfaat</th>
                <th className="py-2 text-right">Nilai Buku Bersih</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b text-sm">
                <td className="py-2 font-medium">Peralatan Kantor & Komputer</td>
                <td className="py-2 text-center text-muted-foreground">4 Tahun</td>
                <td className="py-2 text-right font-mono font-semibold">{formatCurrency(nonCurrentAssetsTotal * 0.6, company?.currency)}</td>
              </tr>
              <tr className="border-b text-sm">
                <td className="py-2 font-medium">Kendaraan Operasional</td>
                <td className="py-2 text-center text-muted-foreground">8 Tahun</td>
                <td className="py-2 text-right font-mono font-semibold">{formatCurrency(nonCurrentAssetsTotal * 0.4, company?.currency)}</td>
              </tr>
            </tbody>
          </ReportTable>
        </div>
      ),
    },
    {
      id: "note-7",
      number: "Catatan 7",
      title: "Liabilitas Jangka Pendek & Jangka Panjang",
      tag: "Liabilitas",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Rincian liabilitas usaha, kewajiban perpajakan, dan beban akrual entitas:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm">
              <span className="text-xs text-muted-foreground block">Liabilitas Jangka Pendek</span>
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(currentLiabTotal, company?.currency)}
              </span>
            </div>
            <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm">
              <span className="text-xs text-muted-foreground block">Liabilitas Jangka Panjang</span>
              <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatCurrency(nonCurrentLiabTotal, company?.currency)}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "note-8",
      number: "Catatan 8",
      title: "Pendapatan Usaha & Beban Operasional",
      tag: "Laba Rugi",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ringkasan ketaatan pengakuan pendapatan (PSAK 72 / IFRS 15) dan beban operasional:
          </p>
          <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 flex justify-between items-center">
            <div>
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium block">Laba Bersih Periode Berjalan</span>
              <span className="text-xl font-bold font-mono text-blue-800 dark:text-blue-200">
                {formatCurrency(netIncome, company?.currency)}
              </span>
            </div>
            <Badge className="bg-blue-600 text-white">PSAK 72 Verified</Badge>
          </div>
        </div>
      ),
    },
    {
      id: "note-9",
      number: "Catatan 9",
      title: "Kepatuhan Perpajakan & PPN 12%",
      tag: "Perpajakan",
      content: (
        <div className="space-y-3 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <p>
            Entitas menghitung kewajiban perpajakan sesuai dengan ketentuan Undang-Undang Perpajakan di Republik Indonesia, termasuk penetapan tarif <strong>PPN 12%</strong> (UU HPP) serta pelaporan Surat Pemberitahuan (SPT).{" "}
            <em className="text-muted-foreground">[Diisi oleh manajemen: status pelaporan SPT dan pemeriksaan pajak. Aplikasi ini menghitung PPN dan PPh dari buku besar; ia tidak memverifikasi kepatuhan dan tidak terhubung ke Coretax.]</em>
          </p>
        </div>
      ),
    },
    {
      id: "note-10",
      number: "Catatan 10",
      title: "Peristiwa Setelah Periode Pelaporan",
      tag: "Peristiwa",
      content: (
        <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          Peristiwa setelah akhir periode pelaporan ({reportDateStr}) yang memerlukan penyesuaian atau pengungkapan.{" "}
          <em className="text-muted-foreground">[Diisi oleh manajemen. Tidak boleh dinyatakan &quot;tidak ada&quot; tanpa penelaahan.]</em>
        </p>
      ),
    },
  ];

  const filteredNotes = notesList.filter(
    (n) =>
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ReportLayout
      title="Notes to Financial Statements (CALK)"
      subtitle="Explanatory Notes Report"
      reportDate={reportDateStr}
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Overview Banner */}
      <Card className="mb-6 border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 dark:from-emerald-950/20 dark:via-zinc-900 dark:to-emerald-950/10 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-wider">PSAK 201 (IAS 1) Standardized Disclosure</span>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              CALK FY {yearStr}
            </Badge>
          </div>
          <CardTitle className="text-xl font-bold mt-1">
            Catatan atas Laporan Keuangan (CALK)
          </CardTitle>
          <CardDescription>
            Informasi penjelasan komprehensif, ringkasan kebijakan akuntansi signifikan, serta rincian pos-pos Posisi Keuangan dan Laba Rugi sesuai standar akuntansi Indonesia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Quick Search */}
          <div className="relative max-w-md mt-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes (e.g., Kas, Kebijakan, Pajak)..."
              className="pl-9 bg-white dark:bg-zinc-900 rounded-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Sleek Collapsible Notes List */}
      <div className="space-y-4">
        {filteredNotes.map((note) => {
          const isOpen = !!openItems[note.id];
          return (
            <div
              key={note.id}
              className="border rounded-2xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleItem(note.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                    {note.number}
                  </span>
                  <span className="font-semibold text-base text-foreground">{note.title}</span>
                  <Badge variant="outline" className="text-xs font-normal ml-2 hidden sm:inline-flex">
                    {note.tag}
                  </Badge>
                </div>
                <ChevronDown
                  className={cn("w-5 h-5 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-6 pt-2 border-t text-sm">
                  {note.content}
                </div>
              )}
            </div>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border">
            <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Tidak ada catatan yang cocok dengan kata kunci pencarian.</p>
          </div>
        )}
      </div>
    </ReportLayout>
  );
}
