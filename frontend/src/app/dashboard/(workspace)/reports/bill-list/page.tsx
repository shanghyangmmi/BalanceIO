"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, Clock, FileSpreadsheet, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function BillListPage() {
  const { company } = useCompanyData();
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadBills() {
      setIsLoading(true);
      try {
        const data = await apiClient.getPurchaseBills();
        setBills(data || []);
      } catch (err) {
        console.error("Failed to load purchase bill list report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadBills();
  }, []);

  const getStatusBadge = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === "paid" || s === "1") {
      return <Badge className="bg-emerald-600 text-white font-mono text-xs">Paid</Badge>;
    }
    if (s === "partiallypaid" || s === "partial" || s === "2") {
      return <Badge className="bg-blue-600 text-white font-mono text-xs">Partial</Badge>;
    }
    if (s === "overdue" || s === "3") {
      return <Badge className="bg-red-600 text-white font-mono text-xs">Overdue</Badge>;
    }
    if (s === "void" || s === "4") {
      return <Badge variant="outline" className="text-zinc-500 font-mono text-xs">Void</Badge>;
    }
    return <Badge variant="secondary" className="font-mono text-xs">Draft</Badge>;
  };

  const filteredBills = bills.filter((b) => {
    const billNo = b.billNumber || "";
    const vendor = b.contact?.name || b.vendorName || "";
    const matchesSearch =
      billNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.toLowerCase().includes(searchTerm.toLowerCase());

    const s = String(b.status).toLowerCase();
    if (statusFilter === "paid") return matchesSearch && (s === "paid" || s === "1");
    if (statusFilter === "unpaid") return matchesSearch && (s === "unpaid" || s === "0" || s === "2" || s === "3");
    if (statusFilter === "draft") return matchesSearch && (s === "draft" || s === "0");

    return matchesSearch;
  });

  const totalAmountSum = filteredBills.reduce((acc, b) => acc + Number(b.total || b.grandTotal || 0), 0);
  const paidAmountSum = filteredBills.reduce((acc, b) => acc + Number(b.amountPaid || 0), 0);
  const outstandingAmountSum = filteredBills.reduce((acc, b) => acc + Math.max(0, Number(b.total || 0) - Number(b.amountPaid || 0)), 0);

  return (
    <ReportLayout
      title="Purchase Bill List"
      subtitle="Complete chronological register of all vendor purchase bills"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Purchase Bills Value</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(totalAmountSum, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Payments Made</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(paidAmountSum, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Payables Due</p>
              <h3 className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(outstandingAmountSum, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bill # or vendor..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full text-xs font-medium self-start sm:self-auto">
          {[
            { id: "all", label: "All Bills" },
            { id: "paid", label: "Paid" },
            { id: "unpaid", label: "Unpaid / Due" },
            { id: "draft", label: "Draft" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-full transition-all",
                statusFilter === tab.id
                  ? "bg-white dark:bg-zinc-900 text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading purchase bill list...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Bill No</th>
              <th className="py-3 px-4 text-left">Vendor Name</th>
              <th className="py-3 px-4 text-center">Bill Date</th>
              <th className="py-3 px-4 text-center">Due Date</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Paid Amount</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.map((b) => {
              const billDateStr = b.billDate ? format(new Date(b.billDate), "dd MMM yyyy") : "-";
              const dueDateStr = b.dueDate ? format(new Date(b.dueDate), "dd MMM yyyy") : "-";
              const total = Number(b.total || b.grandTotal || 0);
              const paid = Number(b.amountPaid || 0);

              return (
                <tr key={b.id} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold text-orange-600 hover:underline">
                    <Link href={`/dashboard/purchases/${b.id}`}>
                      {b.billNumber || b.id.substring(0, 8)}
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-medium text-foreground">{b.contact?.name || b.vendorName || "General Vendor"}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{billDateStr}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{dueDateStr}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(b.status)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatCurrency(paid, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                    {formatCurrency(total, company?.currency)}
                  </td>
                </tr>
              );
            })}

            {filteredBills.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No purchase bills found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredBills.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={5}>Total ({filteredBills.length} Purchase Bills)</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(paidAmountSum, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totalAmountSum, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
