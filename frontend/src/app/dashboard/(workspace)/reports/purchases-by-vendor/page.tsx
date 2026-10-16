"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { useCompanyData } from "@/hooks/use-company-data";
import { ReportLayout, ReportTable } from "@/components/reports/report-layout";
import { formatCurrency } from "@/lib/utils/formatter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, ShoppingBag, DollarSign, FileText, ArrowUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VendorPurchaseSummary {
  contactId: string;
  vendorName: string;
  email: string;
  billCount: number;
  totalPurchases: number;
  totalPaid: number;
  totalOutstanding: number;
  avgBillValue: number;
}

export default function PurchasesByVendorPage() {
  const { company } = useCompanyData();
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"purchases" | "name" | "count">("purchases");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    async function loadBills() {
      setIsLoading(true);
      try {
        const data = await apiClient.getPurchaseBills();
        setBills(data || []);
      } catch (err) {
        console.error("Failed to load purchase bills for vendor report", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadBills();
  }, []);

  // Aggregate bills by vendor
  const vendorMap = new Map<string, VendorPurchaseSummary>();

  bills.forEach((bill) => {
    if (bill.status === "Draft" || bill.status === "Void" || bill.status === 0 || bill.status === 4) return;

    const contactId = bill.contactId || bill.contact?.id || "unknown-vendor";
    const vendorName = bill.contact?.name || bill.vendorName || "General Vendor";
    const email = bill.contact?.email || "";
    const total = Number(bill.total || bill.grandTotal || 0);
    const amountPaid = Number(bill.amountPaid || 0);
    const outstanding = Math.max(0, total - amountPaid);

    if (!vendorMap.has(contactId)) {
      vendorMap.set(contactId, {
        contactId,
        vendorName,
        email,
        billCount: 0,
        totalPurchases: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        avgBillValue: 0,
      });
    }

    const existing = vendorMap.get(contactId)!;
    existing.billCount += 1;
    existing.totalPurchases += total;
    existing.totalPaid += amountPaid;
    existing.totalOutstanding += outstanding;
    existing.avgBillValue = existing.totalPurchases / existing.billCount;
  });

  const vendorList = Array.from(vendorMap.values());

  // Filter
  const filteredVendors = vendorList.filter(
    (v) =>
      v.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort
  filteredVendors.sort((a, b) => {
    let multiplier = sortOrder === "desc" ? -1 : 1;
    if (sortBy === "purchases") return (a.totalPurchases - b.totalPurchases) * multiplier;
    if (sortBy === "count") return (a.billCount - b.billCount) * multiplier;
    return a.vendorName.localeCompare(b.vendorName) * multiplier;
  });

  const grandTotalPurchases = vendorList.reduce((acc, v) => acc + v.totalPurchases, 0);
  const grandTotalPaid = vendorList.reduce((acc, v) => acc + v.totalPaid, 0);
  const grandTotalOutstanding = vendorList.reduce((acc, v) => acc + v.totalOutstanding, 0);
  const totalBillsCount = vendorList.reduce((acc, v) => acc + v.billCount, 0);

  const toggleSort = (field: "purchases" | "name" | "count") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <ReportLayout
      title="Purchases by Vendor"
      subtitle="Summary of procurement spend and payables categorized by supplier"
      showPeriodSelector={false}
      showProjectSelector={false}
      showAjeSelector={false}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Purchase Spend</p>
              <h3 className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
                {formatCurrency(grandTotalPurchases, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-xl text-orange-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Paid to Vendors</p>
              <h3 className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(grandTotalPaid, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Payables Outstanding</p>
              <h3 className="text-xl font-bold font-mono text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(grandTotalOutstanding, company?.currency)}
              </h3>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-zinc-900 border shadow-sm">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Active Suppliers</p>
              <h3 className="text-xl font-bold font-mono text-foreground mt-1">
                {vendorList.length} Vendors
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor name or email..."
            className="pl-9 bg-white dark:bg-zinc-900 rounded-full text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sort by:</span>
          <button
            onClick={() => toggleSort("purchases")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "purchases" ? "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Total Spend <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort("name")}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors flex items-center gap-1",
              sortBy === "name" ? "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300" : "bg-white dark:bg-zinc-900"
            )}
          >
            Vendor Name <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center items-center h-48 border rounded-2xl bg-white dark:bg-zinc-900">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          <span className="ml-2 text-sm text-muted-foreground">Loading purchases by vendor report...</span>
        </div>
      ) : (
        <ReportTable>
          <thead>
            <tr className="border-b text-xs font-semibold text-muted-foreground bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 text-left">Vendor Name</th>
              <th className="py-3 px-4 text-center">Bills Count</th>
              <th className="py-3 px-4 text-right">Avg Bill Value</th>
              <th className="py-3 px-4 text-right">Paid Amount</th>
              <th className="py-3 px-4 text-right">Payables Outstanding</th>
              <th className="py-3 px-4 text-right">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.map((v) => (
              <tr key={v.contactId} className="border-b hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 text-sm transition-colors">
                <td className="py-3 px-4 font-medium">
                  <div className="flex flex-col">
                    <span className="text-foreground font-semibold">{v.vendorName}</span>
                    {v.email && <span className="text-xs text-muted-foreground font-normal">{v.email}</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-center font-mono">
                  <Badge variant="outline" className="font-mono">{v.billCount} bills</Badge>
                </td>
                <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                  {formatCurrency(v.avgBillValue, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(v.totalPaid, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-red-600 dark:text-red-400">
                  {formatCurrency(v.totalOutstanding, company?.currency)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                  {formatCurrency(v.totalPurchases, company?.currency)}
                </td>
              </tr>
            ))}

            {filteredVendors.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No purchase data found for the selected filter.
                </td>
              </tr>
            )}
          </tbody>
          {filteredVendors.length > 0 && (
            <tfoot>
              <tr className="border-t-2 font-bold text-sm bg-zinc-50 dark:bg-zinc-900">
                <td className="py-3 px-4">Grand Total ({filteredVendors.length} Vendors)</td>
                <td className="py-3 px-4 text-center font-mono">{totalBillsCount} bills</td>
                <td className="py-3 px-4 text-right font-mono">-</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(grandTotalPaid, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-red-600 dark:text-red-400">{formatCurrency(grandTotalOutstanding, company?.currency)}</td>
                <td className="py-3 px-4 text-right font-mono text-orange-600 dark:text-orange-400">{formatCurrency(grandTotalPurchases, company?.currency)}</td>
              </tr>
            </tfoot>
          )}
        </ReportTable>
      )}
    </ReportLayout>
  );
}
