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
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Scale,
  Users,
  Boxes,
  Building2,
  FileText,
  History,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useCan, NoPermission } from "@/components/auth/rbac-guard";
import { usePermission } from "@/contexts/permission-context";
import { PERMISSIONS } from "@/lib/auth/permissions";

// Lightweight in-browser CSV parser
function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Parse header line
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] !== undefined ? values[idx].trim() : "";
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

function formatIDR(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function MigrationHubPage() {
    const can = useCan();
  const [activeTab, setActiveTab] = useState("opening-balances");
  const [conversionDate, setConversionDate] = useState("2025-01-01");
  const [plugAccount, setPlugAccount] = useState("3-2000");
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Open Items Sub-tab
  const [openItemMode, setOpenItemMode] = useState<"invoices" | "bills">("invoices");

  // Inventory/Asset Sub-tab
  const [inventoryAssetMode, setInventoryAssetMode] = useState<"inventory" | "assets">("inventory");

  // Batches history
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [rollbackBatch, setRollbackBatch] = useState<any>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const fileInputId = useId();

  // Load batch history
  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const data = await apiClient.getMigrationBatches();
      setBatches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      // Handled in api-client
    } finally {
      setIsLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const resetState = () => {
    setFileName("");
    setParsedRows([]);
    setPreviewData(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const rows = parseCSV(content);
      if (rows.length === 0) {
        toast.error("File is empty or contains invalid CSV format.");
        return;
      }
      setParsedRows(rows);
      await runPreview(rows, activeTab);
    };
    reader.readAsText(file);
  };

  const getImportTypeEnum = (tab: string): number => {
    switch (tab) {
      case "opening-balances":
        return 0; // OpeningBalances
      case "contacts":
        return 1; // Contacts
      case "open-items":
        return openItemMode === "invoices" ? 2 : 3; // OpenInvoices : OpenBills
      case "inventory-assets":
        return inventoryAssetMode === "inventory" ? 4 : 5; // InventoryOpening : AssetsOpening
      default:
        return 0;
    }
  };

  const runPreview = async (rows: Record<string, string>[], tab: string) => {
    setIsValidating(true);
    try {
      const type = getImportTypeEnum(tab);
      const res = await apiClient.previewMigration({
        type,
        conversionDate,
        rows,
        plugAccountId: plugAccount,
        autoCreateContacts: true,
        mergeContactsByTaxId: true,
      });

      setPreviewData(res);
      if (res.isValid) {
        toast.success(`Validated ${rows.length} row(s) successfully.`);
      } else {
        toast.warning(`Validation identified ${res.errors?.length || 0} issue(s). Review details below.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to validate file.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || !parsedRows.length) return;
    setIsCommitting(true);

    try {
      const type = getImportTypeEnum(activeTab);
      const res = await apiClient.commitMigration({
        type,
        conversionDate,
        fileName,
        rows: parsedRows,
        plugAccountId: plugAccount,
        autoCreateContacts: true,
        mergeContactsByTaxId: true,
      });

      toast.success(res.message || "Migration batch committed successfully!");
      resetState();
      loadBatches();
    } catch (err: any) {
      toast.error(err.message || "Failed to commit migration batch.");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleRollbackConfirm = async () => {
    if (!rollbackBatch) return;
    setIsRollingBack(true);

    try {
      const res = await apiClient.rollbackMigrationBatch(rollbackBatch.id);
      toast.success(res.message || `Batch ${rollbackBatch.batchNumber} reversed successfully.`);
      setRollbackBatch(null);
      loadBatches();
    } catch (err: any) {
      toast.error(err.message || "Failed to rollback batch.");
    } finally {
      setIsRollingBack(false);
    }
  };

  // Every import step posts or stages ledger data; without Finance.Create the
  // page has nothing it can do.
  const { isReady } = usePermission();
  if (isReady && !can(PERMISSIONS.FinanceCreate)) {
    return <NoPermission permission={PERMISSIONS.FinanceCreate} />;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Masthead */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight font-display">
              Migration{" "}
              <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Import Hub
              </span>
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
              Roadmap Item 3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Import historical starting data from Accurate, Jurnal, Zahir, MYOB, or spreadsheets with exact double-entry balance verification and 1-click batch rollback.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/50 border border-border/60 rounded-lg px-3 py-1.5">
            <Label htmlFor="conv-date" className="text-xs font-mono text-muted-foreground whitespace-nowrap">
              Conversion Date:
            </Label>
            <Input
              id="conv-date"
              type="date"
              value={conversionDate}
              onChange={(e) => {
                setConversionDate(e.target.value);
                if (parsedRows.length > 0) runPreview(parsedRows, activeTab);
              }}
              className="h-7 text-xs font-mono bg-background border-none w-32 focus-visible:ring-1"
            />
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          resetState();
        }}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="opening-balances" className="text-xs md:text-sm font-medium gap-1.5">
            <Scale className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Opening Balances
          </TabsTrigger>
          <TabsTrigger value="contacts" className="text-xs md:text-sm font-medium gap-1.5">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Contacts & Roles
          </TabsTrigger>
          <TabsTrigger value="open-items" className="text-xs md:text-sm font-medium gap-1.5">
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Open AR & AP
          </TabsTrigger>
          <TabsTrigger value="inventory-assets" className="text-xs md:text-sm font-medium gap-1.5">
            <Boxes className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Stock & Assets
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs md:text-sm font-medium gap-1.5">
            <History className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Batch History
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: OPENING BALANCES ──────────────────────────────────── */}
        <TabsContent value="opening-balances" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Scale className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Trial Balance & Opening Balances
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Upload your ending Trial Balance as of conversion date. The system guarantees exact double-entry ledger posting (<code className="font-mono">Sum(Debit) == Sum(Credit)</code>).
                  </CardDescription>
                </div>
                <a
                  href={apiClient.getMigrationTemplateUrl("openingbalances")}
                  download="balanceio_template_openingbalances.csv"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-md"
                >
                  <Download className="h-3.5 w-3.5" /> Download Template (.csv)
                </a>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-6 text-center bg-card/40">
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor={fileInputId}
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {fileName ? fileName : "Click to select or drag & drop CSV file"}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Required columns: <code className="font-mono">AccountCode</code>, <code className="font-mono">AccountName</code>, <code className="font-mono">Debit</code>, <code className="font-mono">Credit</code>
                    </p>
                  </div>
                </label>
              </div>

              {/* Live Preview & Balance Meter */}
              {isValidating && (
                <div className="flex items-center justify-center p-8 gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Validating Chart of Accounts codes and balance equality...
                </div>
              )}

              {previewData && (
                <div className="space-y-4 pt-2">
                  {/* Balance Health Meter */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/40 border border-border/60 p-4 rounded-xl">
                    <div>
                      <span className="text-xs font-mono text-muted-foreground uppercase">Total Debits</span>
                      <p className="text-lg font-bold font-money text-emerald-600 dark:text-emerald-400">
                        {formatIDR(previewData.totalDebit || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-mono text-muted-foreground uppercase">Total Credits</span>
                      <p className="text-lg font-bold font-money text-cyan-600 dark:text-cyan-400">
                        {formatIDR(previewData.totalCredit || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-mono text-muted-foreground uppercase">Difference</span>
                      <p
                        className={cn(
                          "text-lg font-bold font-money",
                          previewData.difference === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {formatIDR(previewData.difference || 0)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-mono text-muted-foreground uppercase">Balance Status</span>
                      <div className="mt-1">
                        {previewData.difference === 0 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Exact Equilibrium
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 gap-1">
                            <AlertTriangle className="h-3 w-3" /> Requires Equity Plug
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Equity Plug Selector if Imbalanced */}
                  {previewData.difference > 0 && (
                    <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="font-semibold text-sm">Trial Balance Imbalance Detected</AlertTitle>
                      <AlertDescription className="text-xs mt-1 space-y-2">
                        <p>
                          Total debits do not equal credits by <strong>{formatIDR(previewData.difference)}</strong>. Under SAK standards, historical opening imbalances are balanced into Retained Earnings or Share Capital.
                        </p>
                        <div className="flex items-center gap-3 pt-1">
                          <Label className="text-xs font-medium">Balancing Account (Plug):</Label>
                          <Select value={plugAccount} onValueChange={setPlugAccount}>
                            <SelectTrigger className="h-8 w-60 text-xs bg-background">
                              <SelectValue placeholder="Select Equity Account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3-2000">3-2000 · Laba Ditahan (Retained Earnings)</SelectItem>
                              <SelectItem value="3-1000">3-1000 · Modal Saham (Paid-in Capital)</SelectItem>
                              <SelectItem value="3-3000">3-3000 · Ekuitas Saldo Awal (Opening Equity)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Errors / Warnings list */}
                  {previewData.errors?.length > 0 && (
                    <Alert variant="destructive" className="text-xs">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle className="font-semibold text-sm">Errors identified (Posting Blocked)</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          {previewData.errors.map((err: string, i: number) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Preview Table */}
                  <div className="border border-border/60 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/80 sticky top-0 border-b border-border/60">
                        <tr>
                          <th className="py-2 px-3 text-left font-mono">Row</th>
                          <th className="py-2 px-3 text-left font-mono">Account Code</th>
                          <th className="py-2 px-3 text-left">Account Name</th>
                          <th className="py-2 px-3 text-right font-mono">Debit (Rp)</th>
                          <th className="py-2 px-3 text-right font-mono">Credit (Rp)</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {previewData.previewRows?.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-1.5 px-3 text-muted-foreground">{r.rowIndex}</td>
                            <td className="py-1.5 px-3 font-semibold">{r.accountCode}</td>
                            <td className="py-1.5 px-3 font-sans">{r.accountName}</td>
                            <td className="py-1.5 px-3 text-right font-money text-emerald-600 dark:text-emerald-400">
                              {r.debit > 0 ? formatIDR(r.debit) : "—"}
                            </td>
                            <td className="py-1.5 px-3 text-right font-money text-cyan-600 dark:text-cyan-400">
                              {r.credit > 0 ? formatIDR(r.credit) : "—"}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              {r.status === "Valid" ? (
                                <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                                  Valid
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  {r.status}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={resetState}>
                      Clear
                    </Button>
                    <Button
                      onClick={handleCommit}
                      disabled={isCommitting || !previewData.isValid || previewData.errors?.length > 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      {isCommitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Commit & Post Opening Journal
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: CONTACTS ──────────────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    Contacts Master (Customers, Vendors, Employees)
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Import customer and supplier registers with additive role flags, Indonesian NIK (16 digits), PTKP status (TK/0 – K/3), bank account details, and PPh withholding profiles.
                  </CardDescription>
                </div>
                <a
                  href={apiClient.getMigrationTemplateUrl("contacts")}
                  download="balanceio_template_contacts.csv"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-md"
                >
                  <Download className="h-3.5 w-3.5" /> Download Contacts Template (.csv)
                </a>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-6 text-center bg-card/40">
                <input
                  id={`${fileInputId}-contacts`}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor={`${fileInputId}-contacts`}
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {fileName ? fileName : "Upload Contacts CSV"}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Columns: <code className="font-mono">Name</code>, <code className="font-mono">IsCustomer</code>, <code className="font-mono">IsVendor</code>, <code className="font-mono">IsEmployee</code>, <code className="font-mono">TaxId</code>, <code className="font-mono">Nik</code>, <code className="font-mono">PtkpStatus</code>
                    </p>
                  </div>
                </label>
              </div>

              {previewData && (
                <div className="space-y-4">
                  <div className="border border-border/60 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/80 sticky top-0 border-b border-border/60 font-mono">
                        <tr>
                          <th className="py-2 px-3 text-left">Row</th>
                          <th className="py-2 px-3 text-left">Contact Name</th>
                          <th className="py-2 px-3 text-left">NPWP / Tax ID</th>
                          <th className="py-2 px-3 text-left">Email</th>
                          <th className="py-2 px-3 text-center">Roles</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {previewData.previewRows?.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-1.5 px-3 text-muted-foreground">{r.rowIndex}</td>
                            <td className="py-1.5 px-3 font-semibold font-sans">{r.name}</td>
                            <td className="py-1.5 px-3 text-muted-foreground">{r.taxId || "—"}</td>
                            <td className="py-1.5 px-3 text-muted-foreground">{r.email || "—"}</td>
                            <td className="py-1.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {r.isCustomer && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">C</Badge>}
                                {r.isVendor && <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700">V</Badge>}
                                {r.isEmployee && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700">EMP</Badge>}
                              </div>
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <Badge variant="outline" className="text-[10px] text-emerald-600">
                                {r.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={resetState}>
                      Clear
                    </Button>
                    <Button
                      onClick={handleCommit}
                      disabled={isCommitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                    >
                      {isCommitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Commit Contacts ({parsedRows.length})
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: OPEN ITEMS (AR & AP) ──────────────────────────────── */}
        <TabsContent value="open-items" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Open Items (Unpaid Invoices & Bills)
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Import outstanding customer invoices and vendor bills with their original dates so aging reports reflect reality without duplicating ledger balances.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={openItemMode === "invoices" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setOpenItemMode("invoices");
                      resetState();
                    }}
                    className={openItemMode === "invoices" ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    Open Invoices (AR)
                  </Button>
                  <Button
                    variant={openItemMode === "bills" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setOpenItemMode("bills");
                      resetState();
                    }}
                    className={openItemMode === "bills" ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    Open Bills (AP)
                  </Button>
                  <a
                    href={apiClient.getMigrationTemplateUrl(openItemMode === "invoices" ? "openinvoices" : "openbills")}
                    download={`balanceio_template_${openItemMode}.csv`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-md"
                  >
                    <Download className="h-3.5 w-3.5" /> Template
                  </a>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 text-xs">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="font-semibold text-sm">Ledger Protection Notice</AlertTitle>
                <AlertDescription className="mt-1">
                  Because summary receivables (1-1200) and payables (2-1100) are already posted in the Opening Balances journal, open items only populate the subledger and aging buckets without double-posting to the General Ledger.
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-6 text-center bg-card/40">
                <input
                  id={`${fileInputId}-open-items`}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor={`${fileInputId}-open-items`}
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {fileName ? fileName : `Upload Open ${openItemMode === "invoices" ? "Invoices" : "Bills"} CSV`}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Columns: <code className="font-mono">Number</code>, <code className="font-mono">Date</code>, <code className="font-mono">DueDate</code>, <code className="font-mono">PartyName</code>, <code className="font-mono">Amount</code>
                    </p>
                  </div>
                </label>
              </div>

              {previewData && (
                <div className="space-y-4">
                  <div className="border border-border/60 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/80 sticky top-0 border-b border-border/60 font-mono">
                        <tr>
                          <th className="py-2 px-3 text-left">Doc Number</th>
                          <th className="py-2 px-3 text-left">Document Date</th>
                          <th className="py-2 px-3 text-left">Due Date</th>
                          <th className="py-2 px-3 text-left">Party</th>
                          <th className="py-2 px-3 text-right">Amount (Rp)</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {previewData.previewRows?.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-1.5 px-3 font-semibold">{r.invoiceNumber || r.billNumber}</td>
                            <td className="py-1.5 px-3 text-muted-foreground">{r.invoiceDate || r.billDate}</td>
                            <td className="py-1.5 px-3 text-muted-foreground">{r.dueDate}</td>
                            <td className="py-1.5 px-3 font-sans">{r.customerName || r.vendorName}</td>
                            <td className="py-1.5 px-3 text-right font-money text-foreground font-semibold">
                              {formatIDR(r.amount)}
                            </td>
                            <td className="py-1.5 px-3 text-center">
                              <Badge variant="outline" className="text-[10px] text-emerald-600">
                                {r.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={resetState}>
                      Clear
                    </Button>
                    <Button
                      onClick={handleCommit}
                      disabled={isCommitting}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                    >
                      {isCommitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Commit Open {openItemMode === "invoices" ? "Invoices" : "Bills"} ({parsedRows.length})
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: INVENTORY & ASSETS ────────────────────────────────── */}
        <TabsContent value="inventory-assets" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Opening Stock & Fixed Assets Register
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Initialize starting inventory quantities with historical cost basis, and fixed assets with accumulated depreciation to date.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={inventoryAssetMode === "inventory" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setInventoryAssetMode("inventory");
                      resetState();
                    }}
                    className={inventoryAssetMode === "inventory" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    Opening Stock
                  </Button>
                  <Button
                    variant={inventoryAssetMode === "assets" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setInventoryAssetMode("assets");
                      resetState();
                    }}
                    className={inventoryAssetMode === "assets" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                  >
                    Asset Register
                  </Button>
                  <a
                    href={apiClient.getMigrationTemplateUrl(inventoryAssetMode === "inventory" ? "inventory" : "assets")}
                    download={`balanceio_template_${inventoryAssetMode}.csv`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-primary/5 border border-primary/20 px-3 py-1.5 rounded-md"
                  >
                    <Download className="h-3.5 w-3.5" /> Template
                  </a>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-xl p-6 text-center bg-card/40">
                <input
                  id={`${fileInputId}-inv-assets`}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor={`${fileInputId}-inv-assets`}
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-foreground">
                      {fileName ? fileName : `Upload ${inventoryAssetMode === "inventory" ? "Stock" : "Assets"} CSV`}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {inventoryAssetMode === "inventory"
                        ? "Columns: ProductCode, ProductName, Quantity, UnitCost, SellPrice, Unit"
                        : "Columns: AssetCode, AssetName, CategoryName, AcquisitionCost, AccumulatedDepreciation"}
                    </p>
                  </div>
                </label>
              </div>

              {previewData && (
                <div className="space-y-4">
                  <div className="border border-border/60 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/80 sticky top-0 border-b border-border/60 font-mono">
                        <tr>
                          <th className="py-2 px-3 text-left">Code</th>
                          <th className="py-2 px-3 text-left">Name</th>
                          {inventoryAssetMode === "inventory" ? (
                            <>
                              <th className="py-2 px-3 text-right">Quantity</th>
                              <th className="py-2 px-3 text-right">Unit Cost</th>
                              <th className="py-2 px-3 text-right">Total Cost</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2 px-3 text-right">Acq Cost</th>
                              <th className="py-2 px-3 text-right">Acc Depreciation</th>
                              <th className="py-2 px-3 text-right">Book Value</th>
                            </>
                          )}
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {previewData.previewRows?.map((r: any, idx: number) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="py-1.5 px-3 font-semibold">{r.productCode || r.assetCode}</td>
                            <td className="py-1.5 px-3 font-sans">{r.productName || r.assetName}</td>
                            {inventoryAssetMode === "inventory" ? (
                              <>
                                <td className="py-1.5 px-3 text-right font-money">{r.quantity}</td>
                                <td className="py-1.5 px-3 text-right font-money">{formatIDR(r.unitCost)}</td>
                                <td className="py-1.5 px-3 text-right font-money font-semibold text-primary">{formatIDR(r.totalCost)}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-1.5 px-3 text-right font-money">{formatIDR(r.acquisitionCost)}</td>
                                <td className="py-1.5 px-3 text-right font-money text-amber-600">{formatIDR(r.accumulatedDepreciation)}</td>
                                <td className="py-1.5 px-3 text-right font-money font-semibold text-emerald-600">{formatIDR(r.bookValue)}</td>
                              </>
                            )}
                            <td className="py-1.5 px-3 text-center">
                              <Badge variant="outline" className="text-[10px] text-emerald-600">
                                {r.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" onClick={resetState}>
                      Clear
                    </Button>
                    <Button
                      onClick={handleCommit}
                      disabled={isCommitting}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                    >
                      {isCommitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Commit {inventoryAssetMode === "inventory" ? "Stock" : "Assets"} ({parsedRows.length})
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 5: BATCH HISTORY & ROLLBACK ──────────────────────────── */}
        <TabsContent value="history" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Migration Batches & 1-Click Rollback
                </CardTitle>
                <CardDescription className="mt-1">
                  Audit trail of all migration batches. If an import had data errors, you can reverse it in a single click without leaving orphaned records.
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadBatches} disabled={isLoadingBatches}>
                {isLoadingBatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              </Button>
            </CardHeader>

            <CardContent>
              {batches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No migration batches recorded yet.
                </div>
              ) : (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/80 font-mono border-b border-border/60">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Batch Number</th>
                        <th className="py-2.5 px-3 text-left">Type</th>
                        <th className="py-2.5 px-3 text-left">Conversion Date</th>
                        <th className="py-2.5 px-3 text-right">Records</th>
                        <th className="py-2.5 px-3 text-left">Created At</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {batches.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold text-foreground">{b.batchNumber}</td>
                          <td className="py-2 px-3 font-sans">
                            {b.type === 0 && "Opening Balances"}
                            {b.type === 1 && "Contacts"}
                            {b.type === 2 && "Open Invoices (AR)"}
                            {b.type === 3 && "Open Bills (AP)"}
                            {b.type === 4 && "Inventory Opening"}
                            {b.type === 5 && "Assets Opening"}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{b.conversionDate}</td>
                          <td className="py-2 px-3 text-right font-money font-semibold">{b.successfulRecords}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {new Date(b.createdAt).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {b.status === 0 ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800 text-[10px]">
                                Committed
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Reversed
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {b.status === 0 && can(PERMISSIONS.FinanceEdit) && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setRollbackBatch(b)}
                                className="h-7 text-xs gap-1"
                              >
                                <RotateCcw className="h-3 w-3" /> Rollback
                              </Button>
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
      </Tabs>

      {/* Rollback Confirmation Modal */}
      <Dialog open={!!rollbackBatch} onOpenChange={(open) => !open && setRollbackBatch(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Rollback Migration Batch
            </DialogTitle>
            <DialogDescription className="pt-2 text-xs">
              Are you sure you want to reverse batch <strong>{rollbackBatch?.batchNumber}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 p-3 rounded-lg text-xs space-y-1.5 border border-border/60">
            <p>
              • <strong>Opening Balances</strong>: Voids the linked General Ledger journal entry.
            </p>
            <p>
              • <strong>Open Items</strong>: Removes open invoices/bills (only if no payments were made).
            </p>
            <p>
              • <strong>Inventory</strong>: Reverses opening cost layers and deducts stock on hand.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setRollbackBatch(null)} disabled={isRollingBack}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRollbackConfirm}
              disabled={isRollingBack}
              className="gap-1.5"
            >
              {isRollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Confirm Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
