"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BookOpen,
  TrendingUp,
  Wallet,
  PieChart,
  FileText,
  Users,
  Package,
  Building2,
  Truck,
  ArrowRight,
  BarChart3,
  Calculator,
  Layers,
  Settings2,
  Search,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Report categories with tabs
const reportCategories = [
  {
    id: "financial",
    label: "Financial Statements",
    icon: BookOpen,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    id: "sales",
    label: "Sales & Receivables",
    icon: TrendingUp,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  {
    id: "purchases",
    label: "Purchases & Payables",
    icon: Truck,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    id: "assets",
    label: "Assets",
    icon: Building2,
    color: "text-zinc-600",
    bgColor: "bg-zinc-50 dark:bg-zinc-900/20",
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Package,
    color: "text-teal-600",
    bgColor: "bg-teal-50 dark:bg-teal-900/20",
  },
  {
    id: "custom",
    label: "Custom Reports",
    icon: Settings2,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
  },
];

// Reports grouped by category
const reports: Record<
  string,
  Array<{ name: string; description: string; href: string; icon: any }>
> = {
  financial: [
    {
      name: "Laporan Keuangan / Financial Statements",
      description:
        "The full set, bilingual, with prior-year comparatives: position, profit or loss, equity, cash flows and trial balance. Print to PDF or export to Excel.",
      href: "/dashboard/reports/financial-statements",
      icon: Layers,
    },
    {
      name: "Statement of Financial Position",
      description:
        "Assets, liabilities, and equity at a specific date.",
      href: "/dashboard/reports/balance-sheet",
      icon: BookOpen,
    },
    {
      name: "Statement of Profit or Loss and Other Comprehensive Income",
      description: "Revenue, expenses, and other comprehensive income over a period.",
      href: "/dashboard/reports/profit-loss",
      icon: TrendingUp,
    },
    {
      name: "Statement of Cash Flows",
      description: "Operating, investing, and financing cash activities.",
      href: "/dashboard/reports/cash-flow",
      icon: Wallet,
    },
    {
      name: "Statement of Changes in Equity",
      description: "Changes in retained earnings, capital, and reserves.",
      href: "/dashboard/reports/equity",
      icon: PieChart,
    },
    {
      name: "Notes to Financial Statements (CALK)",
      description: "Summary of significant accounting policies and explanatory notes.",
      href: "/dashboard/reports/notes",
      icon: FileText,
    },
    {
      name: "Trial Balance",
      description: "Summary of all ledger account balances.",
      href: "/dashboard/reports/trial-balance",
      icon: Calculator,
    },
    {
      name: "General Ledger",
      description: "Detailed record of all transactions by account.",
      href: "/dashboard/reports/general-ledger",
      icon: Layers,
    },
    {
      name: "Auditor Diagnostics Panel",
      description: "Detect sequence numbering gaps, off-hours postings, negative cash balances, and stalled drafts.",
      href: "/dashboard/reports/diagnostics",
      icon: ShieldAlert,
    },
    {
      name: "Budget vs Actual Variance Analysis",
      description: "Comparison of actual General Ledger balances against approved RKAP budgets with alert thresholds.",
      href: "/dashboard/reports/budget-variance",
      icon: TrendingUp,
    },
  ],
  sales: [
    {
      name: "Aged Receivables Summary",
      description: "Unpaid customer invoices grouped by aging period.",
      href: "/dashboard/reports/aged-receivables",
      icon: FileText,
    },
    {
      name: "Customer Balance Detail",
      description: "Outstanding balances and transactions per customer.",
      href: "/dashboard/reports/customer-balance",
      icon: Users,
    },
    {
      name: "Sales by Customer",
      description: "Revenue breakdown by customer over a period.",
      href: "/dashboard/reports/sales-by-customer",
      icon: BarChart3,
    },
    {
      name: "Sales by Product/Service",
      description: "Revenue breakdown by item sold.",
      href: "/dashboard/reports/sales-by-product",
      icon: Package,
    },
    {
      name: "Invoice List",
      description: "Complete list of all sales invoices.",
      href: "/dashboard/reports/invoice-list",
      icon: FileText,
    },
  ],
  purchases: [
    {
      name: "Aged Payables Summary",
      description: "Unpaid vendor bills grouped by aging period.",
      href: "/dashboard/reports/aged-payables",
      icon: FileText,
    },
    {
      name: "Vendor Balance Detail",
      description: "Outstanding balances and transactions per vendor.",
      href: "/dashboard/reports/vendor-balance",
      icon: Truck,
    },
    {
      name: "Purchases by Vendor",
      description: "Expense breakdown by vendor over a period.",
      href: "/dashboard/reports/purchases-by-vendor",
      icon: BarChart3,
    },
    {
      name: "Purchases by Product/Service",
      description: "Expense breakdown by item purchased.",
      href: "/dashboard/reports/purchases-by-product",
      icon: Package,
    },
    {
      name: "Bill List",
      description: "Complete list of all purchase bills.",
      href: "/dashboard/reports/bill-list",
      icon: FileText,
    },
  ],
  assets: [
    {
      name: "Fixed Assets Schedule",
      description: "List of fixed assets with depreciation details.",
      href: "/dashboard/reports/assets-schedule",
      icon: Building2,
    },
    {
      name: "Depreciation Schedule",
      description: "Monthly/yearly depreciation calculations.",
      href: "/dashboard/reports/depreciation-schedule",
      icon: Calculator,
    },
    {
      name: "Asset Register",
      description: "Complete register of all company assets.",
      href: "/dashboard/reports/asset-register",
      icon: Layers,
    },
  ],
  inventory: [
    {
      name: "Inventory Valuation Summary",
      description: "Current value of inventory on hand.",
      href: "/dashboard/reports/inventory-valuation",
      icon: Package,
    },
    {
      name: "Inventory Movement",
      description: "Stock in, stock out, and adjustments.",
      href: "/dashboard/reports/inventory-movement",
      icon: TrendingUp,
    },
    {
      name: "Stock on Hand",
      description: "Current quantity available per item.",
      href: "/dashboard/reports/stock-on-hand",
      icon: Layers,
    },
    {
      name: "Inventory Aging",
      description: "Inventory grouped by how long items have been in stock.",
      href: "/dashboard/reports/inventory-aging",
      icon: FileText,
    },
  ],
  custom: [
    {
      name: "Transaction Explorer",
      description: "Build your own report with custom filters and columns.",
      href: "/dashboard/reports/custom",
      icon: Search,
    },
  ],
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("financial");

  const currentCategory = reportCategories.find((c) => c.id === activeTab);
  const currentReports = reports[activeTab] || [];

  return (
    <div className="flex-1 space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Financial Reports
        </h2>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 flex-wrap">
        {reportCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveTab(category.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === category.id
                ? `${category.bgColor} ${category.color} ring-1 ring-current/20`
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
          >
            <category.icon className="h-4 w-4" />
            {category.label}
          </button>
        ))}
      </div>

      {/* Reports List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {currentReports.map((report, index) => (
            <Link
              key={report.name}
              href={report.href}
              className="flex items-center gap-4 p-4 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-transparent dark:hover:from-emerald-900/20 dark:hover:to-transparent border-l-4 border-transparent hover:border-l-emerald-500 transition-all duration-200 group"
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                  currentCategory?.bgColor,
                )}
              >
                <report.icon
                  className={cn("h-5 w-5", currentCategory?.color)}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  {report.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {report.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
