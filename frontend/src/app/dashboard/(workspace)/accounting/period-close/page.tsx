"use client";

import { useEffect, useState } from "react";
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  History,
  FileCheck,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiClient, PeriodClosePreview, MigrationWizardStatus } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils/formatter";
import { useCan } from "@/components/auth/rbac-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

export default function PeriodClosingPage() {
  const can = useCan();
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState<number>(currentYear - 1);
  const [retainedEarningsAccount, setRetainedEarningsAccount] = useState<string>("3-2000");
  const [autoLock, setAutoLock] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");

  // Period Lock state
  const [currentLockDate, setCurrentLockDate] = useState<string | null>(null);
  const [newLockDate, setNewLockDate] = useState<string>("");
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  // Preview & Execution state
  const [preview, setPreview] = useState<PeriodClosePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    loadLockStatus();
    loadHistory();
  }, []);

  const loadLockStatus = async () => {
    try {
      const status: MigrationWizardStatus = await apiClient.getMigrationWizardStatus();
      if (status.lockDate) {
        setCurrentLockDate(status.lockDate);
        setNewLockDate(status.lockDate);
      } else {
        setCurrentLockDate(null);
      }
    } catch (err: any) {
      console.error("Failed to load lock status", err);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const hist = await apiClient.getPeriodCloseHistory();
      setHistory(hist || []);
    } catch (err: any) {
      console.error("Failed to load closing history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFetchPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const data = await apiClient.getPeriodClosePreview(fiscalYear);
      setPreview(data);
      if (data.nominalAccounts.length === 0) {
        toast.info(`No nominal account activity found for fiscal year ${fiscalYear}.`);
      } else {
        toast.success(`Preview generated for FY ${fiscalYear}: ${data.nominalAccounts.length} nominal accounts.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load period closing preview.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleExecuteClosing = async () => {
    setIsExecuting(true);
    try {
      const res = await apiClient.executeYearEndClose({
        fiscalYear,
        retainedEarningsAccountId: retainedEarningsAccount,
        notes: notes || `Year-end closing for FY ${fiscalYear}`,
        lockPeriod: autoLock,
      });

      toast.success(res.message || `FY ${fiscalYear} closed. Closing journal: ${res.referenceNumber}`);
      setShowConfirmModal(false);
      setPreview(null);
      await loadLockStatus();
      await loadHistory();
    } catch (err: any) {
      toast.error(err.message || "Year-end closing failed.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLockPeriod = async () => {
    if (!newLockDate) {
      toast.error("Please specify a lock date.");
      return;
    }
    setIsLocking(true);
    try {
      const res = await apiClient.lockPeriod(newLockDate);
      toast.success(res.message || `Accounting period locked through ${newLockDate}.`);
      await loadLockStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to lock period.");
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockPeriod = async () => {
    setIsUnlocking(true);
    try {
      const res = await apiClient.unlockPeriod();
      toast.success(res.message || "Accounting period lock removed.");
      await loadLockStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to unlock period.");
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Masthead */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight font-display">
              Period Closing &{" "}
              <span className="italic box-decoration-clone pr-[0.14em] pb-[0.08em] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Hard Lock Engine
              </span>
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5">
              Year-End Close
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automate nominal account clearing (Revenue, COGS, Expenses, Tax) into Retained Earnings (3-2000) and enforce hard period locks to prevent retroactive tampering.
          </p>
        </div>

        {/* Lock Status Pill */}
        <div className="flex items-center gap-2">
          {currentLockDate ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium">
              <Lock className="h-3.5 w-3.5" />
              <span>Locked Through: <strong>{currentLockDate}</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <Unlock className="h-3.5 w-3.5" />
              <span>Periods Unlocked</span>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="year-end" className="space-y-6">
        <TabsList className="grid grid-cols-1 md:grid-cols-3 w-full max-w-md bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="year-end" className="text-xs md:text-sm font-medium gap-1.5">
            <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Year-End Close
          </TabsTrigger>
          <TabsTrigger value="lock-management" className="text-xs md:text-sm font-medium gap-1.5">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Period Lock
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs md:text-sm font-medium gap-1.5">
            <History className="h-4 w-4 text-zinc-600 dark:text-zinc-400" /> Audit History
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: YEAR-END CLOSING */}
        <TabsContent value="year-end" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Fiscal Year-End Configuration
              </CardTitle>
              <CardDescription>
                Select the fiscal year to close. The closing engine zeroes nominal accounts (Classes 4-9) and credits/debits the Net Income/Loss to Retained Earnings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fiscalYear" className="text-xs font-medium">Fiscal Year</Label>
                  <Input
                    id="fiscalYear"
                    type="number"
                    value={fiscalYear}
                    onChange={(e) => setFiscalYear(parseInt(e.target.value) || currentYear)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="retainedEarnings" className="text-xs font-medium">Retained Earnings Account</Label>
                  <Input
                    id="retainedEarnings"
                    value={retainedEarningsAccount}
                    onChange={(e) => setRetainedEarningsAccount(e.target.value)}
                    placeholder="3-2000"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-xs font-medium">Closing Notes / Reference</Label>
                  <Input
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={`FY ${fiscalYear} Closing Journal`}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="autoLock"
                  checked={autoLock}
                  onCheckedChange={(c) => setAutoLock(!!c)}
                />
                <Label htmlFor="autoLock" className="text-xs text-muted-foreground cursor-pointer">
                  Automatically lock the period through <strong>December 31, {fiscalYear}</strong> upon successful closing (recommended).
                </Label>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <Button
                  onClick={handleFetchPreview}
                  disabled={isLoadingPreview}
                  className="gap-2"
                >
                  {isLoadingPreview ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4" />
                  )}
                  Generate Closing Preview
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Preview Results */}
          {preview && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="border-border/60 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Nominal Revenue</CardDescription>
                    <CardTitle className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" />
                      {formatCurrency(preview.totalRevenue)}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Total Nominal Expenses & COGS</CardDescription>
                    <CardTitle className="text-xl font-bold font-mono text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <TrendingDown className="h-4 w-4" />
                      {formatCurrency(preview.totalExpense)}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Net Income / (Loss) to Equity</CardDescription>
                    <CardTitle className={`text-xl font-bold font-mono flex items-center gap-1.5 ${
                      preview.netIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {formatCurrency(preview.netIncome)}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="border-border/60 bg-card/60">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs">Ledger Balance Status</CardDescription>
                    <CardTitle className="text-xl font-bold flex items-center gap-1.5 text-primary">
                      {preview.isBalanced ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Strictly Balanced</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-semibold text-red-600">Out of Balance</span>
                        </>
                      )}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Accounts Table */}
              <Card className="border-border/60">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">Nominal Accounts to be Cleared</CardTitle>
                    <CardDescription className="text-xs">
                      {preview.nominalAccounts.length} nominal accounts will be zeroed out as of {preview.closingDate}.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={isExecuting || !preview.isBalanced}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Commit FY {fiscalYear} Year-End Closing
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="w-28 font-mono text-xs">Code</TableHead>
                          <TableHead className="text-xs">Account Name</TableHead>
                          <TableHead className="text-xs">Classification</TableHead>
                          <TableHead className="text-right text-xs font-mono">Current Balance</TableHead>
                          <TableHead className="text-right text-xs font-mono text-emerald-600 dark:text-emerald-400">Closing Debit</TableHead>
                          <TableHead className="text-right text-xs font-mono text-red-600 dark:text-red-400">Closing Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.nominalAccounts.map((acc) => (
                          <TableRow key={acc.accountId} className="text-xs">
                            <TableCell className="font-mono font-medium">{acc.accountCode}</TableCell>
                            <TableCell className="font-medium">{acc.accountName}</TableCell>
                            <TableCell className="text-muted-foreground">{acc.classification}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(acc.balance)}</TableCell>
                            <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                              {acc.closingDebit > 0 ? formatCurrency(acc.closingDebit) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                              {acc.closingCredit > 0 ? formatCurrency(acc.closingCredit) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Retained Earnings Balancing Line */}
                        <TableRow className="bg-muted/30 font-semibold text-xs border-t-2">
                          <TableCell className="font-mono">{preview.retainedEarningsAccountId}</TableCell>
                          <TableCell colSpan={2}>Retained Earnings Adjustment (3-2000)</TableCell>
                          <TableCell className="text-right font-mono">—</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {preview.retainedEarningsAdjustmentDebit > 0 ? formatCurrency(preview.retainedEarningsAdjustmentDebit) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600 dark:text-red-400">
                            {preview.retainedEarningsAdjustmentCredit > 0 ? formatCurrency(preview.retainedEarningsAdjustmentCredit) : "—"}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: PERIOD LOCK MANAGEMENT */}
        <TabsContent value="lock-management" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Hard Period Lock Enforcer
              </CardTitle>
              <CardDescription>
                When a lock date is active, no transaction (Sales Invoice, Purchase Bill, Journal Entry, Payment) dated on or before the lock date can be created, updated, or deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border border-border/60">
                <div className="space-y-1">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    {currentLockDate ? (
                      <>
                        <Lock className="h-4 w-4 text-amber-500" />
                        <span>Hard Lock is ACTIVE through {currentLockDate}</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 text-emerald-500" />
                        <span>No Period Lock currently enforced</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentLockDate
                      ? "All journals, invoices, and ledger postings on or prior to this date are strictly immutable."
                      : "Transactions can be posted to any date without period-lock rejection."}
                  </p>
                </div>

                {currentLockDate && (
                  <Button
                    variant="outline"
                    onClick={handleUnlockPeriod}
                    disabled={isUnlocking}
                    className="border-red-500/30 text-red-600 hover:bg-red-500/10 text-xs gap-1.5"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Unlock All Periods
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label htmlFor="lockDate" className="text-xs font-medium">Set / Update Lock Date</Label>
                  <Input
                    id="lockDate"
                    type="date"
                    value={newLockDate}
                    onChange={(e) => setNewLockDate(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleLockPeriod}
                    disabled={isLocking || !newLockDate}
                    className="w-full gap-2 text-xs"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Enforce Period Lock
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: AUDIT HISTORY */}
        <TabsContent value="history" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Period Closing Audit Trail</CardTitle>
                <CardDescription className="text-xs">
                  Immutable record of all year-end closing entries and period lock adjustments.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadHistory}
                disabled={isLoadingHistory}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
                Refresh History
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs">Fiscal Year</TableHead>
                      <TableHead className="text-xs font-mono">Reference</TableHead>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Closed By</TableHead>
                      <TableHead className="text-right text-xs font-mono">Net Income</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Period Locked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-xs text-muted-foreground">
                          No period closing entries found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((h, i) => (
                        <TableRow key={h.id || i} className="text-xs">
                          <TableCell className="font-semibold">{h.fiscalYear}</TableCell>
                          <TableCell className="font-mono">{h.referenceNumber}</TableCell>
                          <TableCell>{h.closingDate}</TableCell>
                          <TableCell>{h.closedBy || "System"}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(h.netIncome)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/5 text-[10px]">
                              {h.status || "Posted"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {h.periodLockedUntil ? (
                              <span className="font-mono text-muted-foreground">{h.periodLockedUntil}</span>
                            ) : (
                              <span className="text-muted-foreground">Unlocked</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Confirm Year-End Closing for FY {fiscalYear}
            </DialogTitle>
            <DialogDescription className="pt-2 text-xs text-muted-foreground space-y-2">
              <p>
                This action will post an immutable adjusting journal entry clearing all nominal accounts (Revenue, COGS, Expenses, Tax) and transferring the Net Income/Loss of <strong>{preview ? formatCurrency(preview.netIncome) : "0"}</strong> into Retained Earnings (<code>{retainedEarningsAccount}</code>).
              </p>
              {autoLock && (
                <p className="text-amber-600 dark:text-amber-400 font-medium">
                  The period through December 31, {fiscalYear} will be locked to prevent further postings.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              disabled={isExecuting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecuteClosing}
              disabled={isExecuting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 text-xs"
            >
              {isExecuting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Yes, Execute Closing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
