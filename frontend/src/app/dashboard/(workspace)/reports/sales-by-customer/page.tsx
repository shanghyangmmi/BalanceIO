"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, TrendingUp, DollarSign, FileText, ArrowUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerSalesSummary {
  contactId: string;
  customerName: string;
  email: string;
  invoiceCount: number;
  totalSales: number;
  totalPaid: number;
  totalOutstanding: number;
  avgOrderValue: number;
}

export default function SalesByCustomerPage() {
  const { company } = useCompanyData();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"sales" | "name" | "count">("sales");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function loadInvoices() {
      setIsLoading(true);
      try {
        const data = await apiClient.getInvoices();
        setInvoices(data || []);
      } catch (err) {
        console.error("Failed to load invoices for sales by customer report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadInvoices();
  }, []);

  // Aggregate invoices by customer
  const customerMap = new Map<string, CustomerSalesSummary>();

  invoices.forEach((inv) => {
    // Ignore draft and void invoices for actual sales summary
    if (inv.status === "Draft" || inv.status === "Void" || inv.status === 0 || inv.status === 4) return;

    const contactId = inv.contactId || inv.contact?.id || "unknown";
    const customerName = inv.contact?.name || inv.customerName || "General Customer";
    const email = inv.contact?.email || "";
    const total = Number(inv.total || inv.grandTotal || 0);
    const amountPaid = Number(inv.amountPaid || 0);
    const outstanding = Math.max(0, total - amountPaid);

    if (!customerMap.has(contactId)) {
      customerMap.set(contactId, {
        contactId,
        customerName,
        email,
        invoiceCount: 0,
        totalSales: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        avgOrderValue: 0,
      });
    }

    const existing = customerMap.get(contactId)!;
    existing.invoiceCount += 1;
    existing.totalSales += total;
    existing.totalPaid += amountPaid;
    existing.totalOutstanding += outstanding;
    existing.avgOrderValue = existing.totalSales / existing.invoiceCount;
  });

  const customerList = Array.from(customerMap.values());

  // Filter
  const filteredCustomers = customerList.filter(
    (c) =>
      c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort
  filteredCustomers.sort((a, b) => {
    let multiplier = sortOrder === "desc" ? -1 : 1;
    if (sortBy === "sales") return (a.totalSales - b.totalSales) * multiplier;
    if (sortBy === "count") return (a.invoiceCount - b.invoiceCount) * multiplier;
    return a.customerName.localeCompare(b.customerName) * multiplier;
  });

  const grandTotalSales = customerList.reduce((acc, c) => acc + c.totalSales, 0);
  const grandTotalPaid = customerList.reduce((acc, c) => acc + c.totalPaid, 0);
  const grandTotalOutstanding = customerList.reduce((acc, c) => acc + c.totalOutstanding, 0);
  const totalInvoicesCount = customerList.reduce((acc, c) => acc + c.invoiceCount, 0);

  const toggleSort = (field: "sales" | "name" | "count") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <ReportLayout
      title="Sales by Customer"
      subtitle="Comprehensive revenue summary by customer entity"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Sales Revenue</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(grandTotalSales, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Collected</p>
              <h3 className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
                {formatCurrency(grandTotalPaid, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Outstanding</p>
              <h3 className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {formatCurrency(grandTotalOutstanding, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Customers</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {customerList.length} Customers
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-xl text-purple-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer name or email..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sort by:</span>
          <button
            onClick={() => toggleSort("sales")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "sales" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Sales Revenue <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort("name")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "name" ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Customer Name <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading sales by customer report...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Customer Name</th>
              <th className="py-3 px-4 text-center">Invoices Count</th>
              <th className="py-3 px-4 text-right">Avg Order Value</th>
              <th className="py-3 px-4 text-right">Collected Amount</th>
              <th className="py-3 px-4 text-right">Outstanding</th>
              <th className="py-3 px-4 text-right">Total Sales Revenue</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => (
              <tr key={c.contactId} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                <td className="py-3 px-4 font-medium">
                  <div className="flex flex-col">
                    <span className="text-foreground font-semibold">{c.customerName}</span>
                    {c.email && <span className="text-xs text-muted-foreground font-normal">{c.email}</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  <Badge variant="outline" className="font-mono">{c.invoiceCount} invoices</Badge>
                </td>
                <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                  {formatCurrency(c.avgOrderValue, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-blue-600 dark:text-blue-400">
                  {formatCurrency(c.totalPaid, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">
                  {formatCurrency(c.totalOutstanding, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                  {formatCurrency(c.totalSales, company?.currency)}
                </td>
              </tr>
            ))}

            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No sales data found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredCustomers.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4">Grand Total ({filteredCustomers.length} Customers)</td>
                <td className="py-3 px-4 text-center font-mono">{totalInvoicesCount} invoices</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(grandTotalPaid, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-amber-600 dark:text-amber-400">{formatCurrency(grandTotalOutstanding, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotalSales, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
