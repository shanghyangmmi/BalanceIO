/**
 * Default Chart of Accounts — REFERENCE ONLY
 * 
 * The actual default CoA is now seeded by the backend via DefaultCoASeeder.
 * This file is kept for reference and offline/testing purposes.
 * 
 * Groups:
 * 1-xxxx = Assets
 * 2-xxxx = Liabilities
 * 3-xxxx = Equity
 * 4-xxxx = Sales / Revenue
 * 5-xxxx = Cost of Sales (COGS)
 * 6-xxxx = Operating Expenses
 * 7-xxxx = Other Income
 * 8-xxxx = Other Expenses
 */

import { Account } from "../types/accounting";

export const defaultCoA: Account[] = [
    // Assets
    { id: "1-0000", code: "1-0000", name: "Assets", type: "Asset", accountGroup: "Asset", level: 1, isHeader: true, normalBalance: "Debit", isSystemDefault: true, balance: 0 },
    { id: "1-1000", code: "1-1000", name: "Current Assets", type: "Asset", accountGroup: "Asset", level: 2, isHeader: true, normalBalance: "Debit", isSystemDefault: true, parentId: "1-0000", balance: 0 },
    { id: "1-1100", code: "1-1100", name: "Cash & Cash Equivalents", type: "Asset", accountGroup: "Asset", level: 3, isHeader: true, normalBalance: "Debit", isSystemDefault: true, parentId: "1-1000", balance: 0 },
    { id: "1-1101", code: "1-1101", name: "Petty Cash", type: "Asset", accountGroup: "Asset", level: 4, isHeader: false, normalBalance: "Debit", isSystemDefault: true, parentId: "1-1100", balance: 0 },
    { id: "1-1102", code: "1-1102", name: "Cash in Bank", type: "Asset", accountGroup: "Asset", level: 4, isHeader: false, normalBalance: "Debit", isSystemDefault: true, parentId: "1-1100", balance: 0 },

    // Liabilities
    { id: "2-0000", code: "2-0000", name: "Liabilities", type: "Liability", accountGroup: "Liability", level: 1, isHeader: true, normalBalance: "Credit", isSystemDefault: true, balance: 0 },
    { id: "2-1000", code: "2-1000", name: "Current Liabilities", type: "Liability", accountGroup: "Liability", level: 2, isHeader: true, normalBalance: "Credit", isSystemDefault: true, parentId: "2-0000", balance: 0 },

    // Equity
    { id: "3-0000", code: "3-0000", name: "Equity", type: "Equity", accountGroup: "Equity", level: 1, isHeader: true, normalBalance: "Credit", isSystemDefault: true, balance: 0 },

    // Sales
    { id: "4-0000", code: "4-0000", name: "Sales / Revenue", type: "Revenue", accountGroup: "Sales", level: 1, isHeader: true, normalBalance: "Credit", isSystemDefault: true, balance: 0 },

    // Cost of Sales
    { id: "5-0000", code: "5-0000", name: "Cost of Sales", type: "Expense", accountGroup: "CostOfSales", level: 1, isHeader: true, normalBalance: "Debit", isSystemDefault: true, balance: 0 },

    // Expenses
    { id: "6-0000", code: "6-0000", name: "General & Administrative Expenses", type: "Expense", accountGroup: "Expense", level: 1, isHeader: true, normalBalance: "Debit", isSystemDefault: true, balance: 0 },

    // Other Income & Expense
    { id: "7-0000", code: "7-0000", name: "Other Income", type: "Revenue", accountGroup: "OtherIncomeExpense", level: 1, isHeader: true, normalBalance: "Credit", isSystemDefault: true, balance: 0 },
    { id: "8-0000", code: "8-0000", name: "Other Expenses", type: "Expense", accountGroup: "OtherIncomeExpense", level: 1, isHeader: true, normalBalance: "Debit", isSystemDefault: true, balance: 0 },
];
