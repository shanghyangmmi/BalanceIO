"use client";

import { useState, useEffect, useId } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  FileText,
  Scale,
  RefreshCw,
  Plus,
  Lock,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  ShieldCheck,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

// Supported rate types
const RATE_TYPES = {
  0: "Bank Indonesia (JISDOR)",
  1: "Bank Indonesia (Middle)",
  2: "Kurs Pajak (KMK)",
  3: "Market Indicative",
  4: "Contract Rate",
  5: "Manual Entry",
};

function formatIDR(amount: number, digits: number = 2) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ExchangeRatesPage() {
    const can = useCan();
  const [activeTab, setActiveTab] = useState("bi-rates");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedCurrency, setSelectedCurrency] = useState("all");
  const [rates, setRates] = useState<any[]>([]);
  const [kmkDecrees, setKmkDecrees] = useState<any[]>([]);
  const [selectedKmkDecree, setSelectedKmkDecree] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingBI, setIsSyncingBI] = useState(false);
  const [isSyncingKMK, setIsSyncingKMK] = useState(false);

  // Dual Rate Comparator
  const [comparatorDate, setComparatorDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [comparatorCurrency, setComparatorCurrency] = useState("USD");
  const [dualRateData, setDualRateData] = useState<any>(null);
  const [isLoadingDual, setIsLoadingDual] = useState(false);
  const [comparatorAmount, setComparatorAmount] = useState<number>(10000);

  // PSAK 221 Retranslation Engine
  const [retransDate, setRetransDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [retransCurrency, setRetransCurrency] = useState("USD");
  const [retransPreview, setRetransPreview] = useState<any>(null);
  const [isLoadingRetrans, setIsLoadingRetrans] = useState(false);
  const [isPostingRetrans, setIsPostingRetrans] = useState(false);

  // Manual Rate Modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    rateDate: new Date().toISOString().split("T")[0],
    fromCurrency: "USD",
    toCurrency: "IDR",
    buyRate: "16200",
    sellRate: "16300",
    middleRate: "16250",
    rateType: "4", // ContractRate
    notes: "Contract negotiated rate",
  });
  const [isSavingManual, setIsSavingManual] = useState(false);

  const currenciesList = [
    { code: "USD", name: "US Dollar" },
    { code: "EUR", name: "Euro" },
    { code: "SGD", name: "Singapore Dollar" },
    { code: "JPY", name: "Japanese Yen" },
    { code: "GBP", name: "British Pound" },
    { code: "AUD", name: "Australian Dollar" },
    { code: "CNY", name: "Chinese Yuan" },
    { code: "MYR", name: "Malaysian Ringgit" },
    { code: "HKD", name: "Hong Kong Dollar" },
    { code: "CHF", name: "Swiss Franc" },
    { code: "SAR", name: "Saudi Riyal" },
    { code: "KRW", name: "South Korean Won" },
  ];

  // Fetch rates based on active tab
  const loadRates = async () => {
    setIsLoading(true);
    try {
      let typeFilter: number | undefined = undefined;
      if (activeTab === "bi-rates") {
        // Fetch all commercial/BI/market rates
        typeFilter = undefined;
      } else if (activeTab === "kmk-rates") {
        typeFilter = 2; // KursPajak_KMK
      }

      const data = await apiClient.getExchangeRates({
        date: selectedDate,
        currency: selectedCurrency === "all" ? undefined : selectedCurrency,
        rateType: typeFilter,
      });

      setRates(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load exchange rates.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadKmkDecrees = async () => {
    try {
      const decrees = await apiClient.getKmkDecrees();
      setKmkDecrees(Array.isArray(decrees) ? decrees : []);
    } catch (e) {
      // Ignored
    }
  };

  useEffect(() => {
    loadRates();
    loadKmkDecrees();
  }, [selectedDate, selectedCurrency, activeTab]);

  // Load Dual Rate
  const loadDualRate = async () => {
    setIsLoadingDual(true);
    try {
      const data = await apiClient.getDualExchangeRate(comparatorDate, comparatorCurrency);
      setDualRateData(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch dual rates.");
    } finally {
      setIsLoadingDual(false);
    }
  };

  useEffect(() => {
    if (activeTab === "retranslation") {
      loadDualRate();
    }
  }, [comparatorDate, comparatorCurrency, activeTab]);

  // Sync Handlers
  const handleSyncBI = async () => {
    setIsSyncingBI(true);
    try {
      const res = await apiClient.syncExchangeBI(selectedDate);
      toast.success(res.source || "Bank Indonesia rates updated", {
        description: `Synced ${res.ratesSynced} currencies for ${selectedDate}.`,
      });
      loadRates();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync BI rates.");
    } finally {
      setIsSyncingBI(false);
    }
  };

  const handleSyncKMK = async () => {
    setIsSyncingKMK(true);
    try {
      const res = await apiClient.syncExchangeKMK(selectedDate);
      toast.success(res.source || "Kurs pajak (KMK) updated", {
        description: `${res.kmkNumber || "KMK Decree"} (${res.ratesSynced} currencies).`,
      });
      loadRates();
      loadKmkDecrees();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync KMK rates.");
    } finally {
      setIsSyncingKMK(false);
    }
  };

  const handleSaveManualRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingManual(true);
    try {
      await apiClient.createManualExchangeRate({
        rateDate: manualForm.rateDate,
        fromCurrency: manualForm.fromCurrency,
        toCurrency: manualForm.toCurrency,
        buyRate: parseFloat(manualForm.buyRate) || 0,
        sellRate: parseFloat(manualForm.sellRate) || 0,
        middleRate: parseFloat(manualForm.middleRate) || 0,
        rateType: parseInt(manualForm.rateType),
        notes: manualForm.notes,
      });

      toast.success(`Exchange rate for ${manualForm.fromCurrency} saved successfully.`);
      setManualModalOpen(false);
      loadRates();
    } catch (err: any) {
      toast.error(err.message || "Failed to save rate.");
    } finally {
      setIsSavingManual(false);
    }
  };

  // PSAK 221 Preview & Post
  const handlePreviewRetrans = async () => {
    setIsLoadingRetrans(true);
    try {
      const res = await apiClient.previewPsak221Retranslation({
        asOfDate: retransDate,
        currency: retransCurrency,
      });
      setRetransPreview(res);
      toast.success(`Scanned monetary balances for ${retransCurrency} as of ${retransDate}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to preview retranslation.");
    } finally {
      setIsLoadingRetrans(false);
    }
  };

  const handlePostRetrans = async () => {
    if (!retransPreview) return;
    setIsPostingRetrans(true);
    try {
      const res = await apiClient.postPsak221Retranslation({
        asOfDate: retransDate,
        currency: retransCurrency,
        closingRate: retransPreview.closingRate,
        notes: `PSAK 221 Monetary Retranslation (${retransCurrency} @ Rp ${formatIDR(retransPreview.closingRate, 0)})`,
      });

      toast.success(res.message || "Retranslation journal posted");
      setRetransPreview(null);
      loadRates();
    } catch (err: any) {
      toast.error(err.message || "Failed to post retranslation journal.");
    } finally {
      setIsPostingRetrans(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Masthead */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight font-display">
              Exchange Rates ·{" "}
              <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Kurs BI &amp; KMK
              </span>
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 font-mono text-[10px]">
              Roadmap Item 4
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Two official rates, two sources, one provenance table. Commercial transactions recognize at Kurs BI; statutory tax documents recognize at Kurs Pajak (KMK).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {can(PERMISSIONS.FinanceEdit) && <Button
            onClick={handleSyncBI}
            disabled={isSyncingBI || isSyncingKMK}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-border/80"
          >
            <Building2 className={cn("h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400", isSyncingBI && "animate-spin")} />
            {isSyncingBI ? "Syncing BI..." : "Sync Kurs BI"}
          </Button>}

          {can(PERMISSIONS.FinanceEdit) && <Button
            onClick={handleSyncKMK}
            disabled={isSyncingBI || isSyncingKMK}
            size="sm"
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileText className={cn("h-3.5 w-3.5", isSyncingKMK && "animate-spin")} />
            {isSyncingKMK ? "Syncing KMK..." : "Sync Kurs KMK"}
          </Button>}

          {can(PERMISSIONS.FinanceEdit) && <Button
            onClick={() => setManualModalOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Manual Rate
          </Button>}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-1 md:grid-cols-3 w-full bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="bi-rates" className="text-xs md:text-sm font-medium gap-1.5">
            <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Kurs BI &amp; Commercial (JISDOR)
          </TabsTrigger>
          <TabsTrigger value="kmk-rates" className="text-xs md:text-sm font-medium gap-1.5">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Kurs Pajak (KMK Kemenkeu)
          </TabsTrigger>
          <TabsTrigger value="retranslation" className="text-xs md:text-sm font-medium gap-1.5">
            <Scale className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            Dual Rate &amp; PSAK 221 Retranslation
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: KURS BI & COMMERCIAL ──────────────────────────────── */}
        <TabsContent value="bi-rates" className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-card/60 border border-border/60 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="bi-date" className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  Rate Date:
                </Label>
                <Input
                  id="bi-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-background border-border/60 w-36"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs font-mono text-muted-foreground whitespace-nowrap">Currency:</Label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="h-8 w-36 text-xs bg-background">
                    <SelectValue placeholder="All Currencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Currencies</SelectItem>
                    {currenciesList.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              Showing {rates.length} rates for {selectedDate}
            </div>
          </div>

          {/* Table */}
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                Commercial Spot Rates &amp; Provenance
              </CardTitle>
              <CardDescription className="text-xs">
                Official Bank Indonesia spot rates (JISDOR for USD, middle rates for others). Governs General Ledger revenue, purchases, and receivable recognition under PSAK 221.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-12 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading commercial rates...
                </div>
              ) : rates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <p>No exchange rates recorded for {selectedDate}.</p>
                  {can(PERMISSIONS.FinanceEdit) && <Button size="sm" variant="outline" onClick={handleSyncBI} className="text-xs gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Sync Rates for {selectedDate}
                  </Button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/70 sticky top-0 border-b border-border/60 font-mono text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Currency</th>
                        <th className="py-2.5 px-3.5 text-left">Type &amp; Provenance</th>
                        <th className="py-2.5 px-3.5 text-right">Buy Rate (Rp)</th>
                        <th className="py-2.5 px-3.5 text-right">Sell Rate (Rp)</th>
                        <th className="py-2.5 px-3.5 text-right">Middle / Spot (Rp)</th>
                        <th className="py-2.5 px-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {rates.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-3.5 font-bold text-foreground">
                            {r.fromCurrency} / {r.toCurrency}
                          </td>
                          <td className="py-2.5 px-3.5 font-sans">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-mono",
                                  r.rateType === 0 ? "border-cyan-400 bg-cyan-50/50 text-cyan-700 dark:text-cyan-300" :
                                  r.rateType === 1 ? "border-teal-400 bg-teal-50/50 text-teal-700 dark:text-teal-300" :
                                  r.rateType === 4 ? "border-zinc-400 bg-zinc-50/50 text-zinc-700" :
                                  "border-border text-muted-foreground"
                                )}
                              >
                                {r.rateType === 0 ? "BI JISDOR" :
                                 r.rateType === 1 ? "BI Middle" :
                                 r.rateType === 2 ? "KMK Tax" :
                                 r.rateType === 4 ? "Contract" :
                                 r.rateType === 5 ? "Manual" : "Market"}
                              </Badge>
                              <span className="text-xs text-muted-foreground truncate max-w-xs" title={r.provenance || r.notes}>
                                {r.provenance || r.notes || "Official feed"}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-money text-muted-foreground">
                            {formatIDR(r.buyRate)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-money text-muted-foreground">
                            {formatIDR(r.sellRate)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-money font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {formatIDR(r.middleRate)}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            {r.isLockedByPostedEntry ? (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 gap-1" title="Referenced by posted entry; immutable">
                                <Lock className="h-2.5 w-2.5" /> Locked
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                                Active
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: KURS PAJAK (KMK) ──────────────────────────────────── */}
        <TabsContent value="kmk-rates" className="space-y-6">
          {/* KMK Decree Header Banner */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold font-display text-emerald-950 dark:text-emerald-100">
                    Statutory Tax Exchange Rates (Keputusan Menteri Keuangan)
                  </h4>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                    Mandatory statutory basis for Faktur Pajak DPP, PPN 12%, PPnBM, Bea Masuk, and withholding taxes. Published weekly (Wednesday through Tuesday).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white font-mono text-xs">
                  Weekly Decree Cycle
                </Badge>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-card/60 border border-border/60 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="kmk-date" className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                  Transaction Date:
                </Label>
                <Input
                  id="kmk-date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-8 text-xs font-mono bg-background border-border/60 w-36"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs font-mono text-muted-foreground whitespace-nowrap">Currency:</Label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="h-8 w-36 text-xs bg-background">
                    <SelectValue placeholder="All Currencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Currencies</SelectItem>
                    {currenciesList.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {can(PERMISSIONS.FinanceEdit) && <Button onClick={handleSyncKMK} size="sm" variant="outline" className="text-xs gap-1.5">
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncingKMK && "animate-spin")} /> Fetch Latest KMK
            </Button>}
          </div>

          {/* KMK Table */}
          <Card className="border-border/60 overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                Active KMK Rates &amp; Tax Calculation Sample
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center p-12 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading KMK rates...
                </div>
              ) : rates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <p>No KMK tax rates found for {selectedDate}.</p>
                  {can(PERMISSIONS.FinanceEdit) && <Button size="sm" onClick={handleSyncKMK} className="bg-emerald-600 text-white text-xs gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" /> Sync KMK for {selectedDate}
                  </Button>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/70 sticky top-0 border-b border-border/60 font-mono text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Currency</th>
                        <th className="py-2.5 px-3.5 text-left">KMK Decree No.</th>
                        <th className="py-2.5 px-3.5 text-left">Validity Period</th>
                        <th className="py-2.5 px-3.5 text-right">Kurs Pajak (Rp)</th>
                        <th className="py-2.5 px-3.5 text-right">PPN 12% on $1,000</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {rates.map((r) => {
                        const dpp = 1000 * r.middleRate;
                        const ppn = dpp * 0.12;
                        return (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3.5 font-bold text-foreground">
                              {r.fromCurrency} / {r.toCurrency}
                            </td>
                            <td className="py-2.5 px-3.5 font-sans font-medium text-emerald-800 dark:text-emerald-300">
                              {r.kmkNumber || "KMK Official Decree"}
                            </td>
                            <td className="py-2.5 px-3.5 text-muted-foreground">
                              {r.validFrom && r.validTo ? (
                                <span>{r.validFrom} s.d. {r.validTo}</span>
                              ) : (
                                <span>Weekly Decree</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-money font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatIDR(r.middleRate)}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-money text-cyan-600 dark:text-cyan-400 font-semibold">
                              {formatMoney(ppn)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: DUAL RATE COMPARATOR & RETRANSLATION ─────────────── */}
        <TabsContent value="retranslation" className="space-y-6">
          {/* Section 1: Side-by-Side Dual Rate Comparator */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-cyan-600" />
                    Dual Rate Reconciler: Kurs BI vs. Kurs Pajak
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Demonstrates why an invoice issued in foreign currency produces two different rupiah values on the same day.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={comparatorDate}
                    onChange={(e) => setComparatorDate(e.target.value)}
                    className="h-8 text-xs font-mono bg-background border-border/60 w-36"
                  />
                  <Select value={comparatorCurrency} onValueChange={setComparatorCurrency}>
                    <SelectTrigger className="h-8 w-28 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currenciesList.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {isLoadingDual ? (
                <div className="flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Calculating dual rates...
                </div>
              ) : dualRateData ? (
                <div className="space-y-6">
                  {/* Visual Comparison Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Kurs BI */}
                    <div className="p-4 rounded-xl border border-cyan-200 dark:border-cyan-900 bg-cyan-50/40 dark:bg-cyan-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase text-cyan-700 dark:text-cyan-300">
                          Kurs BI (Commercial Spot)
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-cyan-100/50 text-cyan-800 border-cyan-300">
                          PSAK 221
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold font-money text-foreground">
                        Rp {formatIDR(dualRateData.biMiddleRate, 2)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Source: {dualRateData.biProvenance}
                      </p>
                      <div className="pt-2 border-t border-cyan-200/60 dark:border-cyan-900/60 text-xs">
                        <span className="text-muted-foreground">GL Revenue ({comparatorAmount.toLocaleString()} {comparatorCurrency}):</span>
                        <p className="font-money font-semibold text-foreground">
                          {formatMoney(comparatorAmount * dualRateData.biMiddleRate)}
                        </p>
                      </div>
                    </div>

                    {/* Kurs Pajak */}
                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase text-emerald-700 dark:text-emerald-300">
                          Kurs Pajak (KMK Kemenkeu)
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-100/50 text-emerald-800 border-emerald-300">
                          Faktur Pajak
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold font-money text-foreground">
                        Rp {formatIDR(dualRateData.kmkRate, 2)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Decree: {dualRateData.kmkNumber || "KMK Active"}
                      </p>
                      <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60 text-xs">
                        <span className="text-muted-foreground">DPP Faktur Pajak:</span>
                        <p className="font-money font-semibold text-foreground">
                          {formatMoney(comparatorAmount * dualRateData.kmkRate)}
                        </p>
                      </div>
                    </div>

                    {/* Equalisation Delta */}
                    <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold uppercase text-amber-700 dark:text-amber-300">
                          Reconciling Delta
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-amber-100/50 text-amber-800 border-amber-300">
                          Tax Gap
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold font-money text-amber-600 dark:text-amber-400">
                        {dualRateData.rateDelta >= 0 ? "+" : ""}Rp {formatIDR(dualRateData.rateDelta, 2)} / unit
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        PPN Equalisation Reconciling Item
                      </p>
                      <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 text-xs">
                        <span className="text-muted-foreground">DPP Delta ({comparatorAmount.toLocaleString()} {comparatorCurrency}):</span>
                        <p className="font-money font-semibold text-amber-600 dark:text-amber-400">
                          {formatMoney(comparatorAmount * dualRateData.rateDelta)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Alert className="border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/20 text-cyan-900 dark:text-cyan-200 text-xs">
                    <Info className="h-4 w-4 text-cyan-600" />
                    <AlertTitle className="font-semibold text-sm">Regulatory Notice (PSAK 221 &amp; PMK)</AlertTitle>
                    <AlertDescription className="mt-1">
                      A USD invoice recognised at JISDOR and reported on a Faktur Pajak at KMK produces two different rupiah figures for one sale. That difference is a valid reconciling item on your <em>Rekonsiliasi PPN Keluaran vs Peredaran Usaha</em>.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Section 2: PSAK 221 Monetary Retranslation Engine */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    PSAK 221 Period-End Monetary Balance Retranslation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Revalues foreign currency monetary assets &amp; liabilities (Cash/Bank, Receivables, Payables, Loans) to period-end closing JISDOR rate. Non-monetary assets (Inventory, Fixed Assets) remain at historical cost.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="retrans-date" className="text-xs font-mono text-muted-foreground">
                      Closing Date:
                    </Label>
                    <Input
                      id="retrans-date"
                      type="date"
                      value={retransDate}
                      onChange={(e) => setRetransDate(e.target.value)}
                      className="h-8 text-xs font-mono bg-background border-border/60 w-36"
                    />
                  </div>

                  <Button
                    onClick={handlePreviewRetrans}
                    disabled={isLoadingRetrans}
                    size="sm"
                    className="text-xs gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    {isLoadingRetrans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
                    Scan &amp; Preview
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {retransPreview && (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/40 border border-border/60">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">Closing JISDOR Rate</span>
                      <p className="text-lg font-bold font-money text-foreground">
                        Rp {formatIDR(retransPreview.closingRate, 2)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">Book Carrying Value</span>
                      <p className="text-lg font-bold font-money text-muted-foreground">
                        {formatMoney(retransPreview.totalCarryingAmountIdr)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">Closing Retranslated Value</span>
                      <p className="text-lg font-bold font-money text-foreground">
                        {formatMoney(retransPreview.totalRetranslatedAmountIdr)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">Net Unrealised Gain / Loss</span>
                      <p
                        className={cn(
                          "text-lg font-bold font-money flex items-center gap-1",
                          retransPreview.isGain ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {retransPreview.isGain ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {retransPreview.isGain ? "+" : ""}{formatMoney(retransPreview.netUnrealisedGainLossIdr)}
                      </p>
                    </div>
                  </div>

                  {/* Retranslation Table */}
                  <div className="border border-border/60 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/70 font-mono text-muted-foreground border-b border-border/60">
                        <tr>
                          <th className="py-2 px-3 text-left">Account Code</th>
                          <th className="py-2 px-3 text-left">Account Name</th>
                          <th className="py-2 px-3 text-right">Foreign Balance</th>
                          <th className="py-2 px-3 text-right">Book Carrying (Rp)</th>
                          <th className="py-2 px-3 text-right">Retranslated (Rp)</th>
                          <th className="py-2 px-3 text-right">Unrealised Movement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {retransPreview.items.map((item: any) => (
                          <tr key={item.accountId} className="hover:bg-muted/30">
                            <td className="py-2 px-3 font-semibold">{item.accountCode}</td>
                            <td className="py-2 px-3 font-sans font-medium">{item.accountName}</td>
                            <td className="py-2 px-3 text-right font-money">
                              {item.foreignBalance > 0 ? "+" : ""}{formatIDR(item.foreignBalance, 2)} {retransCurrency}
                            </td>
                            <td className="py-2 px-3 text-right font-money text-muted-foreground">
                              {formatMoney(item.currentCarryingIdr)}
                            </td>
                            <td className="py-2 px-3 text-right font-money font-semibold text-foreground">
                              {formatMoney(item.retranslatedIdr)}
                            </td>
                            <td
                              className={cn(
                                "py-2 px-3 text-right font-money font-bold",
                                item.unrealisedGainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                              )}
                            >
                              {item.unrealisedGainLoss >= 0 ? "+" : ""}{formatMoney(item.unrealisedGainLoss)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Post Action */}
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Posting generates a balanced adjusting journal entry (<code className="font-mono">7-2000 FX Gain</code> or <code className="font-mono">8-3000 FX Loss</code>).
                    </p>

                    {can(PERMISSIONS.FinanceCreate) && <Button
                      onClick={handlePostRetrans}
                      disabled={isPostingRetrans || retransPreview.items.length === 0}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      {isPostingRetrans ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Post PSAK 221 Retranslation Journal
                    </Button>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manual / Contract Rate Modal */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold font-display">
              Add Manual / Contract Exchange Rate
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record a negotiated contract rate or manual exchange quote with explicit author provenance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveManualRate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Rate Date</Label>
                <Input
                  type="date"
                  value={manualForm.rateDate}
                  onChange={(e) => setManualForm({ ...manualForm, rateDate: e.target.value })}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Currency</Label>
                <Select
                  value={manualForm.fromCurrency}
                  onValueChange={(val) => setManualForm({ ...manualForm, fromCurrency: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currenciesList.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} · {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Rate Classification</Label>
              <Select
                value={manualForm.rateType}
                onValueChange={(val) => setManualForm({ ...manualForm, rateType: val })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">Contract Rate (Negotiated between parties)</SelectItem>
                  <SelectItem value="5">Manual Rate (Internal accountant quote)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Buy Rate (Rp)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualForm.buyRate}
                  onChange={(e) => setManualForm({ ...manualForm, buyRate: e.target.value })}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Sell Rate (Rp)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualForm.sellRate}
                  onChange={(e) => setManualForm({ ...manualForm, sellRate: e.target.value })}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-mono">Middle Rate (Rp)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={manualForm.middleRate}
                  onChange={(e) => setManualForm({ ...manualForm, middleRate: e.target.value })}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono">Notes / Contract Reference</Label>
              <Input
                value={manualForm.notes}
                onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                placeholder="e.g., Master Agreement Contract Rate Ref #CTR-2026-08"
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button type="button" variant="outline" onClick={() => setManualModalOpen(false)} disabled={isSavingManual}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingManual} className="bg-primary text-white text-xs gap-1.5">
                {isSavingManual ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Save Exchange Rate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
