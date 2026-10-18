import {
  Boxes,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Folder,
  Layers,
  LayoutDashboard,
  PieChart,
  Receipt,
  Repeat2,
  Ruler,
  Wallet,
  Scale,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react"

import { PERMISSIONS } from "@/lib/auth/permissions"

/**
 * Each module is its own workspace.
 *
 * Contacts is not in any module menu. It is a master record every module
 * reads and none of them owns — one party can be a customer, a supplier and
 * an employee at once — so it sits in the hub navbar and under Settings,
 * where configuration belongs, rather than being repeated four times.
 *
 * Walking into Accounting should feel like opening a different application,
 * not like filtering one. So the sidebar carries that module's menu and
 * nothing else — no Tax, no Inventory, no Assets — and the way back out is
 * the hub button in the navbar rather than a list of every other module
 * sitting permanently in the left rail.
 *
 * This is a UI decision, not a data one. The ledger underneath stays whole:
 * a sales invoice is one row that Accounting and Tax each look at through
 * their own lens, which is why the same screen legitimately appears in two
 * menus under two group headings.
 */

export type ModuleId = "accounting" | "tax" | "inventory" | "assets" | "payroll" | "settings"

export interface ModuleNavItem {
  label: string
  href: string
  icon: LucideIcon
  permission?: string
}

export interface ModuleNavGroup {
  label: string
  items: ModuleNavItem[]
}

export interface ModuleNav {
  id: ModuleId
  /** Shown in the navbar beside the hub button. */
  name: string
  icon: LucideIcon
  /** The module dashboard. */
  home: string
  /**
   * Every path that belongs to this module, including screens that live
   * outside its own folder. Longest match wins, so /dashboard/accounting
   * does not swallow /dashboard/accounting-something.
   */
  owns: string[]
  groups: ModuleNavGroup[]
}

export const MODULE_NAVS: ModuleNav[] = [
  {
    id: "accounting",
    name: "Accounting",
    icon: LayoutDashboard,
    home: "/dashboard/accounting",
    owns: [
      "/dashboard/accounting",
      "/dashboard/sales",
      "/dashboard/purchases",
      "/dashboard/expenses",
      "/dashboard/documents",
      "/dashboard/projects",
      "/dashboard/reports",
    ],
    groups: [
      {
        label: "The ledger",
        items: [
          { label: "Overview", href: "/dashboard/accounting", icon: LayoutDashboard },
          { label: "Journal Entries", href: "/dashboard/accounting/journal", icon: FileSpreadsheet, permission: PERMISSIONS.FinanceView },
          { label: "Approvals", href: "/dashboard/accounting/approvals", icon: ShieldCheck, permission: PERMISSIONS.FinanceView },
          { label: "General Ledger", href: "/dashboard/accounting/ledger", icon: Layers, permission: PERMISSIONS.FinanceView },
          { label: "Bank Reconciliation", href: "/dashboard/accounting/bank-reconciliation", icon: Scale, permission: PERMISSIONS.FinanceView },
          { label: "Budgets & RKAP", href: "/dashboard/accounting/budgets", icon: Target, permission: PERMISSIONS.FinanceView },
          { label: "E2E Lifecycle Validation", href: "/dashboard/accounting/e2e-validation", icon: CheckCircle2, permission: PERMISSIONS.AuditView },
          { label: "Chart of Accounts", href: "/dashboard/accounting/coa", icon: Folder, permission: PERMISSIONS.FinanceView },
          { label: "Batch Posting", href: "/dashboard/accounting/posting", icon: CalendarClock, permission: PERMISSIONS.FinanceView },
          { label: "Recurring", href: "/dashboard/accounting/recurring", icon: Repeat2, permission: PERMISSIONS.FinanceView },
        ],
      },
      {
        label: "Transactions",
        items: [
          { label: "Sales Invoices", href: "/dashboard/sales", icon: TrendingUp, permission: PERMISSIONS.SalesView },
          { label: "Purchase Bills", href: "/dashboard/purchases", icon: ShoppingBag, permission: PERMISSIONS.PurchasesView },
          { label: "Expenses", href: "/dashboard/expenses", icon: CreditCard, permission: PERMISSIONS.PurchasesView },
        ],
      },
      {
        label: "Records",
        items: [
          { label: "Documents", href: "/dashboard/documents", icon: FileText },
          { label: "Projects", href: "/dashboard/projects", icon: Folder },
          { label: "Reports", href: "/dashboard/reports", icon: PieChart, permission: PERMISSIONS.FinanceReport },
          { label: "Financial Statements", href: "/dashboard/reports/financial-statements", icon: FileText, permission: PERMISSIONS.FinanceReport },
        ],
      },
    ],
  },
  {
    id: "tax",
    name: "Tax",
    icon: Receipt,
    home: "/dashboard/tax",
    owns: ["/dashboard/tax"],
    groups: [
      {
        label: "Statutory Reporting",
        items: [
          { label: "Overview", href: "/dashboard/tax", icon: LayoutDashboard },
          { label: "SPT Masa PPN 1111", href: "/dashboard/tax/spt-ppn", icon: FileText, permission: PERMISSIONS.FinanceReport },
          { label: "Withholding PPh", href: "/dashboard/tax/withholding", icon: Receipt, permission: PERMISSIONS.FinanceReport },
          { label: "DJP Online Exports", href: "/dashboard/tax/exports", icon: FileSpreadsheet, permission: PERMISSIONS.FinanceReport },
        ],
      },
      {
        label: "Reconciliation",
        items: [
          { label: "Ekualisasi", href: "/dashboard/tax/equalisation", icon: Scale, permission: PERMISSIONS.FinanceReport },
          { label: "Rekonsiliasi Fiskal", href: "/dashboard/tax/reconciliation", icon: FileSpreadsheet, permission: PERMISSIONS.FinanceReport },
          { label: "Debt to Equity", href: "/dashboard/tax/debt-to-equity", icon: PieChart, permission: PERMISSIONS.FinanceReport },
        ],
      },
      {
        // Labelled for what the screens are, not for the lens. A row called
        // "PPN Keluaran" that opens a sales invoice list would be a lie in
        // the one module where precision is the product.
        label: "Where PPN is recorded",
        items: [
          { label: "Sales Invoices", href: "/dashboard/sales", icon: TrendingUp, permission: PERMISSIONS.SalesView },
          { label: "Purchase Bills", href: "/dashboard/purchases", icon: ShoppingBag, permission: PERMISSIONS.PurchasesView },
        ],
      },
    ],
  },
  {
    id: "inventory",
    name: "Inventory",
    icon: Boxes,
    home: "/dashboard/inventory",
    owns: ["/dashboard/inventory"],
    groups: [
      {
        label: "Stock",
        items: [
          { label: "Overview", href: "/dashboard/inventory", icon: LayoutDashboard },
          { label: "Items", href: "/dashboard/inventory/items", icon: Boxes, permission: PERMISSIONS.InventoryView },
          { label: "Stock Opname", href: "/dashboard/inventory/opname", icon: ClipboardCheck, permission: PERMISSIONS.InventoryOpname },
          { label: "Adjustments", href: "/dashboard/inventory/adjustments", icon: Layers, permission: PERMISSIONS.InventoryManage },
        ],
      },
      {
        label: "Reference",
        items: [
          { label: "Categories", href: "/dashboard/inventory/categories", icon: Folder, permission: PERMISSIONS.InventoryManage },
          { label: "Units", href: "/dashboard/inventory/units", icon: Ruler, permission: PERMISSIONS.InventoryManage },
          { label: "Warehouses", href: "/dashboard/inventory/warehouses", icon: Warehouse, permission: PERMISSIONS.InventoryView },
          { label: "Settings", href: "/dashboard/inventory/settings", icon: Settings, permission: PERMISSIONS.InventoryManage },
        ],
      },
    ],
  },
  {
    id: "assets",
    name: "Assets",
    icon: Building2,
    home: "/dashboard/assets",
    owns: ["/dashboard/assets"],
    groups: [
      {
        label: "Register",
        items: [
          { label: "Overview", href: "/dashboard/assets", icon: LayoutDashboard },
          { label: "Asset Register", href: "/dashboard/assets/register", icon: Building2, permission: PERMISSIONS.AssetsView },
          { label: "Depreciation", href: "/dashboard/assets/depreciation", icon: CalendarClock, permission: PERMISSIONS.AssetsDepreciate },
          { label: "Amortization", href: "/dashboard/assets/amortization", icon: Repeat2, permission: PERMISSIONS.AssetsDepreciate },
          { label: "Disposal", href: "/dashboard/assets/disposal", icon: Trash2, permission: PERMISSIONS.AssetsManage },
          { label: "Revaluation", href: "/dashboard/assets/revaluation", icon: Scale, permission: PERMISSIONS.AssetsManage },
        ],
      },
      {
        label: "Reference",
        items: [
          { label: "Categories", href: "/dashboard/assets/categories", icon: Folder, permission: PERMISSIONS.AssetsManage },
          { label: "Labels", href: "/dashboard/assets/labels", icon: ScanLine, permission: PERMISSIONS.AssetsView },
        ],
      },
    ],
  },
  {
    id: "payroll",
    name: "Payroll",
    icon: Wallet,
    home: "/dashboard/payroll",
    owns: ["/dashboard/payroll"],
    groups: [
      {
        label: "Payroll",
        items: [
          { label: "Overview", href: "/dashboard/payroll", icon: LayoutDashboard },
          { label: "Payroll Runs", href: "/dashboard/payroll/runs", icon: CalendarClock, permission: PERMISSIONS.PayrollView },
          { label: "Employees", href: "/dashboard/payroll/employees", icon: Users, permission: PERMISSIONS.PayrollView },
        ],
      },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    icon: Settings,
    home: "/dashboard/settings",
    owns: ["/dashboard/settings", "/dashboard/contacts"],
    groups: [
      {
        label: "Company",
        items: [
          { label: "Company Profile", href: "/dashboard/settings", icon: Settings },
          { label: "Contacts", href: "/dashboard/contacts", icon: Users, permission: PERMISSIONS.ContactsView },
          { label: "Users", href: "/dashboard/settings/users", icon: Users, permission: PERMISSIONS.UsersView },
          { label: "Exchange Rates", href: "/dashboard/settings/exchange-rates", icon: Scale },
          { label: "Subscription", href: "/dashboard/settings/subscription", icon: CreditCard },
        ],
      },
      {
        label: "Governance",
        items: [
          { label: "Security", href: "/dashboard/settings/security", icon: ShieldCheck },
          { label: "Migration & Import", href: "/dashboard/settings/migration", icon: FileSpreadsheet, permission: PERMISSIONS.FinanceCreate },
          { label: "Audit Logs", href: "/dashboard/settings/audit-logs", icon: FileText },
          { label: "Backup", href: "/dashboard/settings/backup", icon: FileSpreadsheet },
          { label: "Email", href: "/dashboard/settings/email", icon: FileText },
        ],
      },
    ],
  },
]

/** Static export serves trailing slashes; strip one before matching. */
function normalise(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname
}

/**
 * Which module the current path belongs to, or null on the hub itself.
 * Longest owned prefix wins.
 */
export function resolveModule(pathname: string): ModuleNav | null {
  const path = normalise(pathname)
  if (path === "/dashboard") return null

  let best: { nav: ModuleNav; length: number } | null = null

  for (const nav of MODULE_NAVS) {
    for (const owned of nav.owns) {
      if (path === owned || path.startsWith(owned + "/")) {
        if (!best || owned.length > best.length) best = { nav, length: owned.length }
      }
    }
  }

  return best?.nav ?? null
}

/**
 * The menu row to light up: the longest href the current path sits under.
 *
 * A plain `startsWith` lit both "Overview" and "Journal Entries" on
 * /dashboard/accounting/journal; an exact match left nothing lit on
 * /dashboard/inventory/items.
 */
export function activeHref(nav: ModuleNav, pathname: string): string | null {
  const path = normalise(pathname)
  const hrefs = nav.groups
    .flatMap((g) => g.items.map((i) => i.href))
    .sort((a, b) => b.length - a.length)

  return hrefs.find((href) => path === href || path.startsWith(href + "/")) ?? null
}
