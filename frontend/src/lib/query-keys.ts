/**
 * BalanceIO Global TanStack Query Key Factory
 *
 * Centralized, type-safe query keys to ensure consistent caching,
 * predictable invalidation, and prevention of stale data across modules.
 */

export const queryKeys = {
  // Public marketing data (no company scope, no sign-in)
  publicPricing: ["public", "pricing"] as const,

  // Company & Workspace
  company: {
    all: ["company"] as const,
    details: () => [...queryKeys.company.all, "details"] as const,
    settings: () => [...queryKeys.company.all, "settings"] as const,
    members: () => [...queryKeys.company.all, "members"] as const,
    role: () => [...queryKeys.company.all, "role"] as const,
  },

  // Accounting & Ledger
  accounting: {
    all: ["accounting"] as const,
    journals: (filter?: any) => [...queryKeys.accounting.all, "journals", filter] as const,
    journal: (id: string) => [...queryKeys.accounting.all, "journal", id] as const,
    ledger: (accountId?: string, dateRange?: any) =>
      [...queryKeys.accounting.all, "ledger", accountId, dateRange] as const,
    coa: () => [...queryKeys.accounting.all, "coa"] as const,
    approvals: (status?: number) => [...queryKeys.accounting.all, "approvals", status] as const,
    postingBatch: () => [...queryKeys.accounting.all, "posting-batch"] as const,
    recurring: () => [...queryKeys.accounting.all, "recurring"] as const,
    periodClose: {
      all: () => [...queryKeys.accounting.all, "period-close"] as const,
      preview: (year: number) => [...queryKeys.accounting.periodClose.all(), "preview", year] as const,
      history: () => [...queryKeys.accounting.periodClose.all(), "history"] as const,
    },
    budgets: (year?: number) => [...queryKeys.accounting.all, "budgets", year] as const,
    costCenters: () => [...queryKeys.accounting.all, "cost-centers"] as const,
  },

  // Commercial: Sales & Receivables
  sales: {
    all: ["sales"] as const,
    invoices: (status?: string) => [...queryKeys.sales.all, "invoices", status] as const,
    invoice: (id: string) => [...queryKeys.sales.all, "invoice", id] as const,
    orders: (status?: string) => [...queryKeys.sales.all, "orders", status] as const,
    order: (id: string) => [...queryKeys.sales.all, "order", id] as const,
    creditNotes: (status?: string) => [...queryKeys.sales.all, "credit-notes", status] as const,
    creditNote: (id: string) => [...queryKeys.sales.all, "credit-note", id] as const,
  },

  // Commercial: Purchases & Payables
  purchases: {
    all: ["purchases"] as const,
    bills: (status?: string) => [...queryKeys.purchases.all, "bills", status] as const,
    bill: (id: string) => [...queryKeys.purchases.all, "bill", id] as const,
    orders: (status?: string) => [...queryKeys.purchases.all, "orders", status] as const,
    order: (id: string) => [...queryKeys.purchases.all, "order", id] as const,
    debitNotes: (status?: string) => [...queryKeys.purchases.all, "debit-notes", status] as const,
    debitNote: (id: string) => [...queryKeys.purchases.all, "debit-note", id] as const,
    goodsReceipts: (status?: number) => [...queryKeys.purchases.all, "goods-receipts", status] as const,
    goodsReceipt: (id: string) => [...queryKeys.purchases.all, "goods-receipt", id] as const,
  },

  // Inventory & Warehouses
  inventory: {
    all: ["inventory"] as const,
    products: (search?: string) => [...queryKeys.inventory.all, "products", search] as const,
    product: (id: string) => [...queryKeys.inventory.all, "product", id] as const,
    warehouses: () => [...queryKeys.inventory.all, "warehouses"] as const,
    stockOverview: () => [...queryKeys.inventory.all, "stock-overview"] as const,
    movements: (productId?: string) => [...queryKeys.inventory.all, "movements", productId] as const,
    stockOpname: () => [...queryKeys.inventory.all, "stock-opname"] as const,
  },

  // Fixed Assets
  assets: {
    all: ["assets"] as const,
    list: (category?: string) => [...queryKeys.assets.all, "list", category] as const,
    asset: (id: string) => [...queryKeys.assets.all, "asset", id] as const,
    categories: () => [...queryKeys.assets.all, "categories"] as const,
    locations: () => [...queryKeys.assets.all, "locations"] as const,
    depreciationSchedule: (assetId: string) => [...queryKeys.assets.all, "schedule", assetId] as const,
  },

  // Tax Compliance
  tax: {
    all: ["tax"] as const,
    sptPpn: (period?: string) => [...queryKeys.tax.all, "spt-ppn", period] as const,
    withholding: (period?: string) => [...queryKeys.tax.all, "withholding", period] as const,
    nsfp: () => [...queryKeys.tax.all, "nsfp"] as const,
    vatReturn: (year?: number, month?: number) => [...queryKeys.tax.all, "vat-return", year, month] as const,
  },

  // Payroll & Compensation
  payroll: {
    all: ["payroll"] as const,
    employees: () => [...queryKeys.payroll.all, "employees"] as const,
    employee: (id: string) => [...queryKeys.payroll.all, "employee", id] as const,
    runs: () => [...queryKeys.payroll.all, "runs"] as const,
    run: (id: string) => [...queryKeys.payroll.all, "run", id] as const,
    yearlySlips: (year: number) => [...queryKeys.payroll.all, "yearly-slips", year] as const,
  },

  // Financial Reports
  reports: {
    all: ["reports"] as const,
    balanceSheet: (date?: string) => [...queryKeys.reports.all, "balance-sheet", date] as const,
    profitAndLoss: (from?: string, to?: string) => [...queryKeys.reports.all, "pnl", from, to] as const,
    cashFlow: (from?: string, to?: string) => [...queryKeys.reports.all, "cash-flow", from, to] as const,
    trialBalance: (date?: string) => [...queryKeys.reports.all, "trial-balance", date] as const,
  },

  // Migration & Wizard
  migration: {
    all: ["migration"] as const,
    status: () => [...queryKeys.migration.all, "wizard-status"] as const,
    reconciliation: () => [...queryKeys.migration.all, "wizard-recon"] as const,
    batches: () => [...queryKeys.migration.all, "batches"] as const,
  },

  // Support & Audits
  support: {
    all: ["support"] as const,
    tickets: (status?: number) => [...queryKeys.support.all, "tickets", status] as const,
    ticket: (id: string) => [...queryKeys.support.all, "ticket", id] as const,
  },
} as const;
