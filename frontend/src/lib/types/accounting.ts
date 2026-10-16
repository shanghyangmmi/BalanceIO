export type AccountGroup =
  | 'Asset'
  | 'Liability'
  | 'Equity'
  | 'Sales'
  | 'CostOfSales'
  | 'Expense'
  | 'OtherIncomeExpense';

// Keep old type for backward compat
export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'INCOME'
  | 'EXPENSE';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  accountGroup: string;
  level: number;
  isHeader: boolean;
  normalBalance: string;
  description?: string;
  isSystemDefault: boolean;
  parentId?: string;
  parentAccountId?: string;
  balance?: number;
  currentBalance?: number;
  isActive?: boolean;
}

export const accountGroupLabels: Record<string, { label: string; labelId: string; color: string; bgColor: string }> = {
  Asset: { label: 'Assets', labelId: 'Harta', color: '#10b981', bgColor: 'bg-emerald-500/10' },
  Liability: { label: 'Liabilities', labelId: 'Kewajiban', color: '#ef4444', bgColor: 'bg-red-500/10' },
  Equity: { label: 'Equity', labelId: 'Modal', color: '#8b5cf6', bgColor: 'bg-violet-500/10' },
  Sales: { label: 'Sales / Revenue', labelId: 'Pendapatan', color: '#3b82f6', bgColor: 'bg-blue-500/10' },
  CostOfSales: { label: 'Cost of Sales', labelId: 'Harga Pokok', color: '#f97316', bgColor: 'bg-orange-500/10' },
  Expense: { label: 'General & Administrative Expenses', labelId: 'Beban Umum & Administrasi', color: '#ec4899', bgColor: 'bg-pink-500/10' },
  OtherIncomeExpense: { label: 'Other Income & Expense', labelId: 'Pendapatan & Beban Lain', color: '#6366f1', bgColor: 'bg-indigo-500/10' },
};

export type JournalStatus = 'DRAFT' | 'POSTED' | 'VOID';

export interface JournalLine {
  id: string;
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
  tax?: string;
}

export interface JournalEntry {
  id: string;
  date: Date;
  referenceNumber: string;
  description: string;
  notes?: string;
  tags?: string;
  contactId?: string;
  currency?: string;
  lines: JournalLine[];
  status: JournalStatus;
  createdAt: Date;
  updatedAt: Date;
}
