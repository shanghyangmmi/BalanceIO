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
import { Search, FileText, CheckCircle2, Clock, AlertCircle, FileSpreadsheet, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function InvoiceListPage() {
  const { company } = useCompanyData();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    async function loadInvoices() {
      setIsLoading(true);
      try {
        const data = await apiClient.getInvoices();
        setInvoices(data || []);
      } catch (err) {
        console.error("Failed to load invoices list report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInvoices();
  }, []);

  const getStatusBadge = (status: any) => {
    const s = String(status).toLowerCase();
    if (s === "paid" || s === "1") {
      return <Badge className="bg-emerald-600 text-white font-mono text-xs">Paid</Badge>;
    }
    if (s === "partiallypaid" || s === "partial" || s === "2") {
      return <Badge className="bg-cyan-600 text-white font-mono text-xs">Partial</Badge>;
    }
    if (s === "overdue" || s === "3") {
      return <Badge className="bg-red-600 text-white font-mono text-xs">Overdue</Badge>;
    }
    if (s === "void" || s === "4") {
      return <Badge variant="outline" className="text-zinc-500 font-mono text-xs">Void</Badge>;
    }
    return <Badge variant="secondary" className="font-mono text-xs">Draft</Badge>;
  };

  const filteredInvoices = invoices.filter((inv) => {
    const invNo = inv.invoiceNumber || "";
    const customer = inv.contact?.name || inv.customerName || "";
    const matchesSearch =
      invNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.toLowerCase().includes(searchTerm.toLowerCase());

    const s = String(inv.status).toLowerCase();
    if (statusFilter === "paid") return matchesSearch && (s === "paid" || s === "1");
    if (statusFilter === "unpaid") return matchesSearch && (s === "unpaid" || s === "0" || s === "2" || s === "3" || s === "sent");
    if (statusFilter === "draft") return matchesSearch && (s === "draft" || s === "0");

    return matchesSearch;
  });

  const totalAmountSum = filteredInvoices.reduce((acc, inv) => acc + Number(inv.total || inv.grandTotal || 0), 0);
  const paidAmountSum = filteredInvoices.reduce((acc, inv) => acc + Number(inv.amountPaid || 0), 0);
  const outstandingAmountSum = filteredInvoices.reduce((acc, inv) => acc + Math.max(0, Number(inv.total || 0) - Number(inv.amountPaid || 0)), 0);

  return (
    <ReportLayout
      title="Sales Invoice List"
      subtitle="Complete chronological register of all sales invoices"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card/60 border-foreground/10">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Invoices Value</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {formatCurrency(totalAmountSum, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-foreground/10">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Payments Received</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(paidAmountSum, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-foreground/10">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Balance Due</p>
              <h3 className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrency(outstandingAmountSum, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600">
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
            placeholder="Search invoice # or customer..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-full text-xs font-medium self-start sm:self-auto">
          {[
            { id: "all", label: "All Invoices" },
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
                  ? "bg-card text-foreground ring-1 ring-foreground/10 font-semibold"
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
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading sales invoice list...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Invoice No</th>
              <th className="py-3 px-4 text-left">Customer</th>
              <th className="py-3 px-4 text-center">Invoice Date</th>
              <th className="py-3 px-4 text-center">Due Date</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Paid Amount</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => {
              const invDateStr = inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yyyy") : "-";
              const dueDateStr = inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : "-";
              const total = Number(inv.total || inv.grandTotal || 0);
              const paid = Number(inv.amountPaid || 0);

              return (
                <tr key={inv.id} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                  <td className="py-3 px-4 font-mono font-semibold">
                    <Link href={`/dashboard/sales/${inv.id}`} className="text-emerald-600 hover:underline">
                      {inv.invoiceNumber || inv.id.substring(0, 8)}
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-medium text-foreground">{inv.contact?.name || inv.customerName || "General Customer"}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{invDateStr}</td>
                  <td className="py-3 px-4 text-center font-mono text-xs text-muted-foreground">{dueDateStr}</td>
                  <td className="py-3 px-4 text-center">{getStatusBadge(inv.status)}</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatCurrency(paid, company?.currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                    {formatCurrency(total, company?.currency)}
                  </td>
                </tr>
              );
            })}

            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  No sales invoices found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredInvoices.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4" colSpan={5}>Total ({filteredInvoices.length} Invoices)</td>
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
