"use client";

import { useEffect, useState } from "react";
import { ReportLayout } from "@/components/reports/report-layout";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { Loader2, ShieldCheck, AlertTriangle, AlertCircle, Calendar, Hash, ArrowDownRight, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DiagnosticsPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      const response = await apiClient.getDiagnostics();
      setData(response);
    } catch (error) {
      console.error("Failed to run diagnostics:", error);
      toast.error("Failed to load auditor diagnostics");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const totalAlerts = data
    ? (data.invoiceGaps?.length || 0) +
      (data.billGaps?.length || 0) +
      (data.unusualPostings?.length || 0) +
      (data.negativeBalances?.length || 0) +
      (data.unpostedDrafts?.length || 0)
    : 0;

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex justify-between items-center no-print">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gradient">Auditor Diagnostics</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Automated internal audit checks to detect transaction gaps, anomalies, and safety risks.
          </p>
        </div>
        <button
          onClick={fetchDiagnostics}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Re-Run Audit
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <span className="ml-2 text-zinc-500">Scanning ledger & sequences...</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Alert */}
          {totalAlerts === 0 ? (
            <div className="flex items-center gap-4 p-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
              <ShieldCheck className="h-10 w-10 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-bold text-lg">Ledger Healthy & Auditor Standard Compliant</h4>
                <p className="text-sm text-emerald-700 mt-0.5">
                  No sequence gaps, negative cash balances, weekend postings, or stalled draft journals were detected in this company.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl">
              <AlertTriangle className="h-10 w-10 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-bold text-lg">Diagnostics Flagged {totalAlerts} Attention Items</h4>
                <p className="text-sm text-amber-800 mt-0.5">
                  The automated audit flagged sequence number gaps or abnormal cash entries. Review details below to ensure financial accuracy.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Invoice & Bill Sequence Gaps */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2 font-bold">
                  <Hash className="h-5 w-5 text-emerald-600" />
                  Sequence Gap Detection
                </CardTitle>
                <CardDescription>
                  Checks for missing transaction numbers. Gaps in sequences represent audit or reporting risks.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sales Invoices</h5>
                  {data.invoiceGaps?.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic">No missing invoice numbers detected.</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {data.invoiceGaps.map((gap: string) => (
                        <Badge key={gap} variant="destructive" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 font-mono text-xs">
                          Missing {gap}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Purchase Bills</h5>
                  {data.billGaps?.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic">No missing bill numbers detected.</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {data.billGaps.map((gap: string) => (
                        <Badge key={gap} variant="destructive" className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200 font-mono text-xs">
                          Missing {gap}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. Negative Cash Balances */}
            <Card>
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2 font-bold">
                  <ArrowDownRight className="h-5 w-5 text-red-500" />
                  Abnormal Negative Balances
                </CardTitle>
                <CardDescription>
                  Monitors Cash & Bank accounts. Assets should not have negative/credit balances.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.negativeBalances?.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50/50 p-4 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" /> All cash/bank balances are positive.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.negativeBalances.map((acc: any) => (
                      <div key={acc.accountCode} className="flex justify-between items-center p-3 border border-red-100 bg-red-50/30 rounded-lg">
                        <div>
                          <p className="text-sm font-semibold">{acc.accountName}</p>
                          <p className="text-xs font-mono text-zinc-400">{acc.accountCode}</p>
                        </div>
                        <span className="font-mono text-sm font-bold text-red-600">
                          (Rp {Math.abs(acc.balance).toLocaleString("id-ID")})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. Weekend & Off-Hours Postings */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2 font-bold">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Weekend & Off-Hours Postings
                </CardTitle>
                <CardDescription>
                  Identifies journal entries posted outside business hours or on weekends, indicating high risk for manual entries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.unusualPostings?.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No weekend or off-hour postings detected.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr className="border-b text-xs font-bold text-zinc-500">
                          <th className="p-3 text-left">Date</th>
                          <th className="p-3 text-left">Reference</th>
                          <th className="p-3 text-left">Posted Time (Local)</th>
                          <th className="p-3 text-left">Anomaly Reason</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.unusualPostings.map((p: any) => (
                          <tr key={p.entryId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                            <td className="p-3 font-medium text-xs whitespace-nowrap">{p.date}</td>
                            <td className="p-3 font-mono text-xs text-zinc-500">{p.reference}</td>
                            <td className="p-3 text-xs">{p.day}, {p.time}</td>
                            <td className="p-3">
                              <Badge className="bg-amber-100 text-amber-800 border-0 hover:bg-amber-100 text-[10px]">
                                {p.reason}
                              </Badge>
                            </td>
                            <td className="p-3 text-right">
                              <a
                                href={`/dashboard/accounting/journal/edit?id=${p.entryId}`}
                                className="text-xs text-emerald-600 hover:text-emerald-500 font-semibold"
                              >
                                View Entry
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 4. Aged Unposted Drafts */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-md flex items-center gap-2 font-bold">
                  <AlertCircle className="h-5 w-5 text-zinc-500" />
                  Stalled Draft JVs (&gt; 30 Days)
                </CardTitle>
                <CardDescription>
                  Draft journal entries that have been unposted for more than 30 days. These should be posted or deleted to prevent reporting lags.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.unpostedDrafts?.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No stalled draft journal entries found.</p>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr className="border-b text-xs font-bold text-zinc-500">
                          <th className="p-3 text-left">Date</th>
                          <th className="p-3 text-left">Reference</th>
                          <th className="p-3 text-left">Age</th>
                          <th className="p-3 text-left">Notes</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.unpostedDrafts.map((d: any) => (
                          <tr key={d.entryId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                            <td className="p-3 font-medium text-xs whitespace-nowrap">{d.date}</td>
                            <td className="p-3 font-mono text-xs text-zinc-500">{d.reference}</td>
                            <td className="p-3 text-xs text-red-600 font-semibold">{d.ageDays} days old</td>
                            <td className="p-3 text-xs text-zinc-500 truncate max-w-sm">{d.notes || "-"}</td>
                            <td className="p-3 text-right">
                              <a
                                href={`/dashboard/accounting/journal/edit?id=${d.entryId}`}
                                className="text-xs text-emerald-600 hover:text-emerald-500 font-semibold"
                              >
                                Edit Entry
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
