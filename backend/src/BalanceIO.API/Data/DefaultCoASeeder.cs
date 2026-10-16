using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Data;

/// <summary>
/// Seeds the default Chart of Accounts template for a new company.
/// 7 Account Groups with up to 5 levels of hierarchy.
/// </summary>
public static class DefaultCoASeeder
{
    public static async Task SeedDefaultCoA(ApplicationDbContext context, Guid companyId)
    {
        // Check if company already has accounts
        var existingCount = await context.Accounts
            .IgnoreQueryFilters()
            .Where(a => a.CompanyId == companyId)
            .CountAsync();

        if (existingCount > 0) return;

        var accounts = GetDefaultAccounts(companyId);
        context.Accounts.AddRange(accounts);
        await context.SaveChangesAsync();
    }

    private static List<Account> GetDefaultAccounts(Guid companyId)
    {
        var now = DateTime.UtcNow;
        var accounts = new List<Account>();

        // Helper to create account
        Account A(string code, string name, string type, string group, int level, bool isHeader, string normalBalance, string? parentCode = null, string? desc = null)
        {
            var acc = new Account
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Code = code,
                Name = name,
                Type = type,
                AccountGroup = group,
                Level = level,
                IsHeader = isHeader,
                NormalBalance = normalBalance,
                Description = desc,
                IsSystemDefault = true,
                IsActive = true,
                CreatedAt = now,
            };
            accounts.Add(acc);
            return acc;
        }

        // ===================================================================
        // 1. ASSETS (1-xxxx) — Normal Balance: Debit
        // ===================================================================
        var assets = A("1-0000", "Assets", "Asset", "Asset", 1, true, "Debit");

        var curAssets = A("1-1000", "Current Assets", "Asset", "Asset", 2, true, "Debit", "1-0000");
        var cashGroup = A("1-1100", "Cash & Cash Equivalents", "Asset", "Asset", 3, true, "Debit", "1-1000");
        A("1-1101", "Petty Cash", "Asset", "Asset", 4, false, "Debit", "1-1100", "Kas Kecil");
        A("1-1102", "Cash in Bank", "Asset", "Asset", 4, false, "Debit", "1-1100", "Kas di Bank");
        A("1-1103", "Cash in Transit", "Asset", "Asset", 4, false, "Debit", "1-1100", "Kas dalam Perjalanan");

        A("1-1200", "Trade Receivables", "Asset", "Asset", 3, false, "Debit", "1-1000", "Piutang Usaha");
        A("1-1300", "Other Receivables", "Asset", "Asset", 3, false, "Debit", "1-1000", "Piutang Lain-lain");
        A("1-1400", "Inventory", "Asset", "Asset", 3, false, "Debit", "1-1000", "Persediaan Barang");
        A("1-1500", "Prepaid Expenses", "Asset", "Asset", 3, false, "Debit", "1-1000", "Beban Dibayar di Muka");
        A("1-1600", "Advance Payments", "Asset", "Asset", 3, false, "Debit", "1-1000", "Uang Muka");
        A("1-1700", "VAT In", "Asset", "Asset", 3, false, "Debit", "1-1000", "PPN Masukan");

        var ncAssets = A("1-2000", "Non-Current Assets", "Asset", "Asset", 2, true, "Debit", "1-0000");
        var fixedA = A("1-2100", "Fixed Assets - Cost", "Asset", "Asset", 3, true, "Debit", "1-2000");
        A("1-2101", "Land", "Asset", "Asset", 4, false, "Debit", "1-2100", "Tanah");
        A("1-2102", "Buildings", "Asset", "Asset", 4, false, "Debit", "1-2100", "Bangunan");
        A("1-2103", "Vehicles", "Asset", "Asset", 4, false, "Debit", "1-2100", "Kendaraan");
        A("1-2104", "Office Equipment", "Asset", "Asset", 4, false, "Debit", "1-2100", "Peralatan Kantor");
        A("1-2105", "Machinery", "Asset", "Asset", 4, false, "Debit", "1-2100", "Mesin");

        var accDepr = A("1-2200", "Accumulated Depreciation", "Asset", "Asset", 3, true, "Credit", "1-2000", "Akumulasi Penyusutan");
        A("1-2201", "Acc. Depr. - Buildings", "Asset", "Asset", 4, false, "Credit", "1-2200", "Akm. Penyusutan - Bangunan");
        A("1-2202", "Acc. Depr. - Vehicles", "Asset", "Asset", 4, false, "Credit", "1-2200", "Akm. Penyusutan - Kendaraan");
        A("1-2203", "Acc. Depr. - Equipment", "Asset", "Asset", 4, false, "Credit", "1-2200", "Akm. Penyusutan - Peralatan");
        A("1-2204", "Acc. Depr. - Machinery", "Asset", "Asset", 4, false, "Credit", "1-2200", "Akm. Penyusutan - Mesin");

        A("1-2300", "Intangible Assets", "Asset", "Asset", 3, false, "Debit", "1-2000", "Aset Tak Berwujud");

        // ===================================================================
        // 2. LIABILITIES (2-xxxx) — Normal Balance: Credit
        // ===================================================================
        var liabilities = A("2-0000", "Liabilities", "Liability", "Liability", 1, true, "Credit");

        var curLiab = A("2-1000", "Current Liabilities", "Liability", "Liability", 2, true, "Credit", "2-0000");
        A("2-1100", "Trade Payables", "Liability", "Liability", 3, false, "Credit", "2-1000", "Utang Usaha");
        A("2-1200", "Accrued Expenses", "Liability", "Liability", 3, false, "Credit", "2-1000", "Beban yang Masih Harus Dibayar");
        A("2-1300", "VAT Out", "Liability", "Liability", 3, false, "Credit", "2-1000", "PPN Keluaran");
        A("2-1400", "Income Tax Payable", "Liability", "Liability", 3, false, "Credit", "2-1000", "PPh Terutang");
        A("2-1500", "Employee Payable", "Liability", "Liability", 3, false, "Credit", "2-1000", "Utang Gaji");
        A("2-1600", "Unearned Revenue", "Liability", "Liability", 3, false, "Credit", "2-1000", "Pendapatan Diterima di Muka");

        var ncLiab = A("2-2000", "Non-Current Liabilities", "Liability", "Liability", 2, true, "Credit", "2-0000");
        A("2-2100", "Bank Loans", "Liability", "Liability", 3, false, "Credit", "2-2000", "Pinjaman Bank");
        A("2-2200", "Long-Term Debt", "Liability", "Liability", 3, false, "Credit", "2-2000", "Utang Jangka Panjang");

        // ===================================================================
        // 3. EQUITY (3-xxxx) — Normal Balance: Credit
        // ===================================================================
        var equity = A("3-0000", "Equity", "Equity", "Equity", 1, true, "Credit");
        A("3-1000", "Share Capital", "Equity", "Equity", 2, false, "Credit", "3-0000", "Modal Saham");
        A("3-2000", "Retained Earnings", "Equity", "Equity", 2, false, "Credit", "3-0000", "Laba Ditahan");
        A("3-3000", "Current Year Earnings", "Equity", "Equity", 2, false, "Credit", "3-0000", "Laba Tahun Berjalan");
        A("3-4000", "Dividends", "Equity", "Equity", 2, false, "Debit", "3-0000", "Dividen");
        A("3-5000", "Owner's Drawings", "Equity", "Equity", 2, false, "Debit", "3-0000", "Prive Pemilik");

        // ===================================================================
        // 4. SALES / REVENUE (4-xxxx) — Normal Balance: Credit
        // ===================================================================
        var sales = A("4-0000", "Sales / Revenue", "Revenue", "Sales", 1, true, "Credit");
        A("4-1000", "Product Sales", "Revenue", "Sales", 2, false, "Credit", "4-0000", "Penjualan Produk");
        A("4-2000", "Service Revenue", "Revenue", "Sales", 2, false, "Credit", "4-0000", "Pendapatan Jasa");
        A("4-3000", "Sales Returns", "Revenue", "Sales", 2, false, "Debit", "4-0000", "Retur Penjualan");
        A("4-4000", "Sales Discounts", "Revenue", "Sales", 2, false, "Debit", "4-0000", "Diskon Penjualan");

        // ===================================================================
        // 5. COST OF SALES (5-xxxx) — Normal Balance: Debit
        // ===================================================================
        var cogs = A("5-0000", "Cost of Sales", "Expense", "CostOfSales", 1, true, "Debit");
        A("5-1000", "Cost of Goods Sold", "Expense", "CostOfSales", 2, false, "Debit", "5-0000", "Harga Pokok Penjualan");
        A("5-2000", "Direct Labor", "Expense", "CostOfSales", 2, false, "Debit", "5-0000", "Biaya Tenaga Kerja Langsung");
        A("5-3000", "Manufacturing Overhead", "Expense", "CostOfSales", 2, false, "Debit", "5-0000", "Biaya Overhead Pabrik");
        A("5-4000", "Freight / Shipping Cost", "Expense", "CostOfSales", 2, false, "Debit", "5-0000", "Biaya Pengiriman");
        A("5-9000", "Inventory Variance", "Expense", "CostOfSales", 2, false, "Debit", "5-0000", "Selisih Persediaan");

        // ===================================================================
        // 6. OPERATING EXPENSES (6-xxxx) — Normal Balance: Debit
        // ===================================================================
        var expenses = A("6-0000", "General & Administrative Expenses", "Expense", "Expense", 1, true, "Debit");

        var ga = A("6-1000", "General & Administrative", "Expense", "Expense", 2, true, "Debit", "6-0000");
        A("6-1100", "Salaries & Wages", "Expense", "Expense", 3, false, "Debit", "6-1000", "Gaji & Upah");
        A("6-1200", "Rent Expense", "Expense", "Expense", 3, false, "Debit", "6-1000", "Beban Sewa");
        A("6-1300", "Utilities", "Expense", "Expense", 3, false, "Debit", "6-1000", "Listrik, Air, Internet");
        A("6-1400", "Office Supplies", "Expense", "Expense", 3, false, "Debit", "6-1000", "Perlengkapan Kantor");
        A("6-1500", "Insurance", "Expense", "Expense", 3, false, "Debit", "6-1000", "Asuransi");
        A("6-1600", "Depreciation Expense", "Expense", "Expense", 3, false, "Debit", "6-1000", "Beban Penyusutan");
        A("6-1700", "Professional Fees", "Expense", "Expense", 3, false, "Debit", "6-1000", "Biaya Konsultan / Profesional");

        var sm = A("6-2000", "Sales & Marketing", "Expense", "Expense", 2, true, "Debit", "6-0000");
        A("6-2100", "Advertising & Promotion", "Expense", "Expense", 3, false, "Debit", "6-2000", "Iklan & Promosi");
        A("6-2200", "Travel & Entertainment", "Expense", "Expense", 3, false, "Debit", "6-2000", "Perjalanan & Entertain");
        A("6-2300", "Commission Expense", "Expense", "Expense", 3, false, "Debit", "6-2000", "Beban Komisi");

        // ===================================================================
        // 7. OTHER INCOME & EXPENSE (7-xxxx / 8-xxxx) — Mixed
        // ===================================================================
        var otherIncome = A("7-0000", "Other Income", "Revenue", "OtherIncomeExpense", 1, true, "Credit");
        A("7-1000", "Interest Income", "Revenue", "OtherIncomeExpense", 2, false, "Credit", "7-0000", "Pendapatan Bunga");
        A("7-2000", "Foreign Exchange Gain", "Revenue", "OtherIncomeExpense", 2, false, "Credit", "7-0000", "Laba Selisih Kurs");
        A("7-3000", "Gain on Asset Disposal", "Revenue", "OtherIncomeExpense", 2, false, "Credit", "7-0000", "Laba Penjualan Aset Tetap");
        A("7-4000", "Miscellaneous Income", "Revenue", "OtherIncomeExpense", 2, false, "Credit", "7-0000", "Pendapatan Lain-lain");

        var otherExp = A("8-0000", "Other Expenses", "Expense", "OtherIncomeExpense", 1, true, "Debit");
        A("8-1000", "Bank Charges", "Expense", "OtherIncomeExpense", 2, false, "Debit", "8-0000", "Biaya Bank");
        A("8-2000", "Interest Expense", "Expense", "OtherIncomeExpense", 2, false, "Debit", "8-0000", "Beban Bunga");
        A("8-3000", "Foreign Exchange Loss", "Expense", "OtherIncomeExpense", 2, false, "Debit", "8-0000", "Rugi Selisih Kurs");
        A("8-4000", "Loss on Asset Disposal", "Expense", "OtherIncomeExpense", 2, false, "Debit", "8-0000", "Rugi Penjualan Aset");
        A("8-5000", "Tax Expense", "Expense", "OtherIncomeExpense", 2, false, "Debit", "8-0000", "Beban Pajak");

        // Wire up ParentAccountId using code lookup
        var codeToId = accounts.ToDictionary(a => a.Code, a => a.Id);
        foreach (var acc in accounts)
        {
            // Find parent by extracting parent code from hierarchy
            var parentCode = FindParentCode(acc.Code, accounts);
            if (parentCode != null && codeToId.TryGetValue(parentCode, out var parentId))
            {
                acc.ParentAccountId = parentId;
            }
        }

        return accounts;
    }

    private static string? FindParentCode(string code, List<Account> accounts)
    {
        // Level 1 codes (x-0000) have no parent
        var acc = accounts.FirstOrDefault(a => a.Code == code);
        if (acc == null || acc.Level <= 1) return null;

        // Find the direct parent: look for all accounts with level = acc.level - 1
        // that could be a parent based on code prefix
        var prefix = code.Split('-')[0]; // e.g. "1" from "1-1101"
        var parentCandidates = accounts
            .Where(a => a.Level == acc.Level - 1 && a.Code.StartsWith(prefix + "-"))
            .OrderByDescending(a => a.Code)
            .ToList();

        // Find the parent whose code is less than current code
        foreach (var candidate in parentCandidates)
        {
            if (string.Compare(candidate.Code, code, StringComparison.Ordinal) < 0)
                return candidate.Code;
        }

        return null;
    }
}
