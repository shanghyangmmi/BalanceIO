using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Authorization was missing from this controller entirely. Nothing public
/// calls it - the marketing site only talks to /auth - so requiring a token
/// changes nothing for a signed-in user and closes the endpoint to everyone
/// else. Tenant scoping still comes from the global query filters; this is
/// the layer in front of them, not a replacement for it.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public ReportsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("balance-sheet")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<BalanceSheetResponse>> GetBalanceSheet([FromQuery] DateTime? asOf = null, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var reportDate = asOf ?? DateTime.UtcNow;
        var dateDateOnly = DateOnly.FromDateTime(reportDate);

        // 1. Fetch all Accounts
        var accounts = await _context.Accounts.Where(a => a.IsActive).ToListAsync();

        // 2. Fetch Journal Lines up to date
        var query = _context.JournalLines
            .Where(l => l.JournalEntry!.Date <= dateDateOnly && l.JournalEntry.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        query = FilterAJE(query, excludeAdjusting, onlyAdjusting);
        
        var lines = await query.ToListAsync();

        var journalMap = lines
            .GroupBy(l => l.AccountId)
            .Select(g => new 
            {
                AccountCode = g.Key,
                TotalDebit = g.Sum(l => l.Debit),
                TotalCredit = g.Sum(l => l.Credit)
            })
            .ToDictionary(k => k.AccountCode, v => new { v.TotalDebit, v.TotalCredit });

        // 3. Calculate Balances
        // Assets (1xxx): Debit - Credit
        // Liabilities (2xxx): Credit - Debit
        // Equity (3xxx): Credit - Debit
        // Income (4xxx) - Exp (5-9xxx): Credit - Debit (Net) -> Add to Equity (Retained Earnings)

        var result = new BalanceSheetResponse();

        decimal totalAssets = 0;
        decimal totalLiabilities = 0;
        decimal totalEquity = 0;
        decimal netIncome = 0;

        // Helper to get balance
        decimal GetNetChange(string code) => journalMap.ContainsKey(code) 
            ? journalMap[code].TotalDebit - journalMap[code].TotalCredit 
            : 0;

        foreach (var acc in accounts)
        {
            var code = acc.Code;
            var net = GetNetChange(code);

            if (code.StartsWith("1")) // ASSETS
            {
                var balance = net; // Normal Debit
                if (balance != 0)
                {
                    var item = new ReportItem { Code = code, Name = acc.Name, Balance = balance };
                    if (code.StartsWith("1-1")) result.Assets.Current.Accounts.Add(item);
                    else result.Assets.NonCurrent.Accounts.Add(item);
                    totalAssets += balance;
                }
            }
            else if (code.StartsWith("2")) // LIABILITIES
            {
                var balance = -net; // Normal Credit
                if (balance != 0)
                {
                    var item = new ReportItem { Code = code, Name = acc.Name, Balance = balance };
                    if (code.StartsWith("2-1")) result.Liabilities.Current.Accounts.Add(item);
                    else result.Liabilities.NonCurrent.Accounts.Add(item);
                    totalLiabilities += balance;
                }
            }
            else if (code.StartsWith("3")) // EQUITY
            {
                var balance = -net; // Normal Credit
                if (balance != 0)
                {
                    result.Equity.Accounts.Add(new ReportItem { Code = code, Name = acc.Name, Balance = balance });
                    totalEquity += balance;
                }
            }
            else // REVENUE & EXPENSES (Net Income)
            {
                // Income (4) -> Credit Normal (-net is Credit - Debit)
                // Expense (5-9) -> Debit Normal (net is Debit - Credit)
                // Net Income = Income - Expense
                // Income: Credit - Debit = -net
                // Expense: Debit - Credit = net
                // Profit = (Credit-Debit) - (Debit-Credit)? No.
                
                // Profit = Credits - Debits (Global for P&L)
                // If Revenue 1000 (Credit), Expense 200 (Debit)
                // Net = -1000 + 200 = -800 (Net Credit)
                // Profit = 800.
                
                // So NetIncome contribution from this line is (-net)
                netIncome += (-net);
            }
        }

        // Add Net Income to Equity
        if (netIncome != 0)
        {
            result.Equity.Accounts.Add(new ReportItem 
            { 
                Code = "9999", 
                Name = "Current Year Earnings", 
                Balance = netIncome 
            });
            totalEquity += netIncome;
        }

        // Totals
        result.Assets.Current.Total = result.Assets.Current.Accounts.Sum(x => x.Balance);
        result.Assets.NonCurrent.Total = result.Assets.NonCurrent.Accounts.Sum(x => x.Balance);
        result.Assets.Total = result.Assets.Current.Total + result.Assets.NonCurrent.Total;

        result.Liabilities.Current.Total = result.Liabilities.Current.Accounts.Sum(x => x.Balance);
        result.Liabilities.NonCurrent.Total = result.Liabilities.NonCurrent.Accounts.Sum(x => x.Balance);
        result.Liabilities.Total = result.Liabilities.Current.Total + result.Liabilities.NonCurrent.Total;

        result.Equity.Total = result.Equity.Accounts.Sum(x => x.Balance);

        // Sorting
        result.Assets.Current.Accounts = result.Assets.Current.Accounts.OrderBy(x => x.Code).ToList();
        result.Assets.NonCurrent.Accounts = result.Assets.NonCurrent.Accounts.OrderBy(x => x.Code).ToList();
        result.Liabilities.Current.Accounts = result.Liabilities.Current.Accounts.OrderBy(x => x.Code).ToList();
        result.Liabilities.NonCurrent.Accounts = result.Liabilities.NonCurrent.Accounts.OrderBy(x => x.Code).ToList();
        result.Equity.Accounts = result.Equity.Accounts.OrderBy(x => x.Code).ToList();

        return result;
    }

    [HttpGet("profit-loss")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<ProfitLossResponse>> GetProfitLoss([FromQuery] DateOnly? startDate, [FromQuery] DateOnly? endDate, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var end = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = startDate ?? new DateOnly(end.Year, end.Month, 1);

        // Fetch Accounts (Expense/Revenue)
        var accounts = await _context.Accounts
            .Where(a => a.IsActive && 
                       (a.Code.StartsWith("4") || a.Code.StartsWith("5") || 
                        a.Code.StartsWith("6") || a.Code.StartsWith("7") || 
                        a.Code.StartsWith("8") || a.Code.StartsWith("9")))
            .ToListAsync();

        // Fetch Journal Lines
        var query = _context.JournalLines
            .Where(l => l.JournalEntry!.Date >= start && l.JournalEntry.Date <= end && l.JournalEntry.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        query = FilterAJE(query, excludeAdjusting, onlyAdjusting);

        var lines = await query.ToListAsync();

        var journalMap = lines
            .GroupBy(l => l.AccountId)
            .Select(g => new 
            {
                AccountCode = g.Key,
                NetChange = g.Sum(l => l.Credit - l.Debit) // Revenue/Income is Credit-Normal, Expense is Debit-Normal (handled later)
            })
            .ToDictionary(k => k.AccountCode, v => v.NetChange);

        var result = new ProfitLossResponse();

        foreach (var acc in accounts)
        {
            if (!journalMap.ContainsKey(acc.Code)) continue;
            
            var rawNet = journalMap[acc.Code]; // Credit - Debit
            
            if (rawNet == 0) continue;

            // Revenue (4xxx) -> Normal Credit -> rawNet is positive
            // Expense (5xxx-9xxx) -> Normal Debit -> rawNet is negative (Credit - Debit < 0)
            
            if (acc.Code.StartsWith("4")) // Revenue
            {
                result.Revenue.Accounts.Add(new ReportItem { Code = acc.Code, Name = acc.Name, Balance = rawNet });
            }
            else if (acc.Code.StartsWith("5")) // COGS
            {
                result.COGS.Accounts.Add(new ReportItem { Code = acc.Code, Name = acc.Name, Balance = -rawNet }); // Flip to positive for report
            }
            else // Expenses (6-9)
            {
                result.Expenses.Accounts.Add(new ReportItem { Code = acc.Code, Name = acc.Name, Balance = -rawNet }); // Flip to positive
            }
        }

        // Totals
        result.Revenue.Total = result.Revenue.Accounts.Sum(x => x.Balance);
        result.COGS.Total = result.COGS.Accounts.Sum(x => x.Balance);
        result.Expenses.Total = result.Expenses.Accounts.Sum(x => x.Balance);

        result.GrossProfit = result.Revenue.Total - result.COGS.Total;
        result.NetIncome = result.GrossProfit - result.Expenses.Total;

        return result;
    }

    [HttpGet("aged-receivables")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<AgedReportResponse>> GetAgedReceivables()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Fetch Unpaid Invoices
        var invoices = await _context.SalesInvoices
            .Include(i => i.Contact)
            .Where(i => i.Status != InvoiceStatus.Paid && i.Status != InvoiceStatus.Void && i.Status != InvoiceStatus.Draft)
            .ToListAsync();

        var report = new AgedReportResponse();

        foreach (var inv in invoices)
        {
            var daysOverdue = today.DayNumber - inv.DueDate.DayNumber;
            var amount = inv.AmountDue; // Use AmountDue, not Total
            var contactName = inv.Contact?.Name ?? "Unknown";
            var contactId = inv.ContactId;

            var existingRow = report.Rows.FirstOrDefault(r => r.ContactId == contactId);
            if (existingRow == null)
            {
                existingRow = new AgedReportRow { ContactId = contactId, ContactName = contactName };
                report.Rows.Add(existingRow);
            }

            if (daysOverdue <= 0) existingRow.Current += amount;
            else if (daysOverdue <= 30) existingRow.Over30 += amount;
            else if (daysOverdue <= 60) existingRow.Over60 += amount;
            else if (daysOverdue <= 90) existingRow.Over90 += amount;
            else existingRow.Over90Plus += amount;

            existingRow.Total += amount;
        }

        // Grand Totals
        report.TotalCurrent = report.Rows.Sum(r => r.Current);
        report.Total30 = report.Rows.Sum(r => r.Over30);
        report.Total60 = report.Rows.Sum(r => r.Over60);
        report.Total90 = report.Rows.Sum(r => r.Over90);
        report.Total90Plus = report.Rows.Sum(r => r.Over90Plus);
        report.GrandTotal = report.Rows.Sum(r => r.Total);

        return report;
    }

    [HttpGet("aged-payables")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<AgedReportResponse>> GetAgedPayables()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Fetch Unpaid Bills
        var bills = await _context.PurchaseBills
            .Include(b => b.Contact)
            .Where(b => b.Status != BillStatus.Paid && b.Status != BillStatus.Void && b.Status != BillStatus.Draft)
            .ToListAsync();

        var report = new AgedReportResponse();

        foreach (var bill in bills)
        {
            var daysOverdue = today.DayNumber - bill.DueDate.DayNumber;
            var amount = bill.AmountDue;
            var contactName = bill.Contact?.Name ?? "Unknown";
            var contactId = bill.ContactId;

            var existingRow = report.Rows.FirstOrDefault(r => r.ContactId == contactId);
            if (existingRow == null)
            {
                existingRow = new AgedReportRow { ContactId = contactId, ContactName = contactName };
                report.Rows.Add(existingRow);
            }

            if (daysOverdue <= 0) existingRow.Current += amount;
            else if (daysOverdue <= 30) existingRow.Over30 += amount;
            else if (daysOverdue <= 60) existingRow.Over60 += amount;
            else if (daysOverdue <= 90) existingRow.Over90 += amount;
            else existingRow.Over90Plus += amount;

            existingRow.Total += amount;
        }

         // Grand Totals
        report.TotalCurrent = report.Rows.Sum(r => r.Current);
        report.Total30 = report.Rows.Sum(r => r.Over30);
        report.Total60 = report.Rows.Sum(r => r.Over60);
        report.Total90 = report.Rows.Sum(r => r.Over90);
        report.Total90Plus = report.Rows.Sum(r => r.Over90Plus);
        report.GrandTotal = report.Rows.Sum(r => r.Total);

        return report;
    }

    [HttpGet("inventory-valuation")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<InventoryValuationResponse>> GetInventoryValuation()
    {
        var products = await _context.Products
            .Where(p => p.Type == ProductType.Product && p.TrackInventory && p.IsActive)
            .ToListAsync();

        var report = new InventoryValuationResponse();

        foreach (var p in products)
        {
            var value = p.StockOnHand * p.BuyPrice; // Evaluating at Cost (BuyPrice)
            report.Items.Add(new InventoryReportItem
            {
                ProductId = p.Id,
                Code = p.Code,
                Name = p.Name,
                Quantity = p.StockOnHand,
                AverageCost = p.BuyPrice,
                TotalValue = value
            });
        }

        report.TotalValue = report.Items.Sum(x => x.TotalValue);
        report.TotalItems = report.Items.Count;

        return report;
    }
    [HttpGet("trial-balance")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<TrialBalanceResponse>> GetTrialBalance([FromQuery] DateTime? asOf = null, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var reportDate = asOf ?? DateTime.UtcNow;
        var dateDateOnly = DateOnly.FromDateTime(reportDate);

        var accounts = await _context.Accounts.Where(a => a.IsActive).ToListAsync();

        var query = _context.JournalLines
            .Where(l => l.JournalEntry!.Date <= dateDateOnly && l.JournalEntry.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        query = FilterAJE(query, excludeAdjusting, onlyAdjusting);

        var lines = await query.ToListAsync();

        var journalMap = lines
            .GroupBy(l => l.AccountId)
            .Select(g => new
            {
                AccountCode = g.Key,
                TotalDebit = g.Sum(l => l.Debit),
                TotalCredit = g.Sum(l => l.Credit)
            })
            .ToDictionary(k => k.AccountCode, v => new { v.TotalDebit, v.TotalCredit });

        var report = new TrialBalanceResponse();

        foreach (var acc in accounts)
        {
            var debit = 0m;
            var credit = 0m;

            if (journalMap.ContainsKey(acc.Code))
            {
                debit = journalMap[acc.Code].TotalDebit;
                credit = journalMap[acc.Code].TotalCredit;
            }

            // If no activity, maybe skip? For TB, usually show all active accounts or only with balance.
            // Let's show all active accounts to be safe, or at least those with balance.
            
            var net = debit - credit;
            
            // Adjust for display: usually TB shows Debit/Credit columns
            // But we might want 'Net' column too? 
            // Standard TB: Debit Column, Credit Column.
            // Asset/Exp: Normal Debit. Liab/Eq/Rev: Normal Credit.
            // But raw TB is just sum of debits and credits per account.
            
            // However, usually TB shows the BALANCE in the appropriate column.
            // e.g. Cash 1000 (Debit), AP 500 (Credit).
            // Not sum of all debits ever vs sum of all credits ever (that's too big numbers perhaps?).
            // Actually, Trial Balance IS the closing balance of each account.
            
            decimal finalDebit = 0;
            decimal finalCredit = 0;

            if (net > 0) finalDebit = net;
            else finalCredit = -net;

            if (finalDebit == 0 && finalCredit == 0) continue; 

            report.Items.Add(new TrialBalanceItem
            {
                Code = acc.Code,
                Name = acc.Name,
                Debit = finalDebit,
                Credit = finalCredit
            });
        }

        report.Items = report.Items.OrderBy(i => i.Code).ToList();
        report.TotalDebit = report.Items.Sum(i => i.Debit);
        report.TotalCredit = report.Items.Sum(i => i.Credit);

        return report;
    }

    [HttpGet("general-ledger")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<GeneralLedgerResponse>> GetGeneralLedger([FromQuery] DateOnly? startDate, [FromQuery] DateOnly? endDate, [FromQuery] string? accountId = null, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var end = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = startDate ?? new DateOnly(end.Year, end.Month, 1);

        var query = _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.Date >= start && l.JournalEntry!.Date <= end && l.JournalEntry!.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        query = FilterAJE(query, excludeAdjusting, onlyAdjusting);

        if (!string.IsNullOrEmpty(accountId))
        {
            query = query.Where(l => l.AccountId == accountId);
        }

        var lines = await query.OrderBy(l => l.JournalEntry!.Date).ThenBy(l => l.JournalEntry!.CreatedAt).ToListAsync();
        
        var report = new GeneralLedgerResponse
        {
            StartDate = start,
            EndDate = end,
            AccountCode = accountId
        };
        
        decimal runningBalance = 0;

        if (!string.IsNullOrEmpty(accountId))
        {
             var openingQuery = _context.JournalLines
                .Where(l => l.AccountId == accountId && l.JournalEntry!.Date < start && l.JournalEntry.Status == JournalEntryStatus.Posted);

             openingQuery = FilterAJE(openingQuery, excludeAdjusting, onlyAdjusting);

             var openingLinesList = await openingQuery.ToListAsync();
             var openingLines = openingLinesList.Sum(l => l.Debit - l.Credit); // Net Debit
            
            // Determine normal balance direction?
            // For GL, usually we just show Debit/Credit and Running Balance (Net).
            // Let's assume Net Debit is the standard specific, but for Liab/Eq it might be confusing.
            // Let's stick to Debit/Credit columns and a signed Balance.
            
            runningBalance = openingLines;
            report.OpeningBalance = runningBalance;
        }

        foreach (var line in lines)
        {
            runningBalance += (line.Debit - line.Credit);

            report.Lines.Add(new GeneralLedgerLine
            {
                Date = line.JournalEntry!.Date,
                Reference = line.JournalEntry.ReferenceNumber,
                Description = line.Description ?? line.JournalEntry.Notes,
                AccountCode = line.AccountId, // Useful if showing all accounts
                AccountName = "", // Fetching names for all might be N+1, optimize later if needed
                Debit = line.Debit,
                Credit = line.Credit,
                Balance = runningBalance
            });
        }

        // Populate Account Names if needed (can be optimized)
        // If single account, just fetch once.
        if (!string.IsNullOrEmpty(accountId))
        {
             var acc = await _context.Accounts.FirstOrDefaultAsync(a => a.Code == accountId);
             if (acc != null)
             {
                 report.AccountName = acc.Name;
                 foreach(var l in report.Lines) l.AccountName = acc.Name;
             }
        }
        else 
        {
            // If multiple accounts, running balance across different accounts doesn't make sense globally mixed.
            // Usually GL is grouped by Account.
            // For now, if no account selected, we just list transactions?
            // Or maybe restrict to requiring accountId for Detailed GL?
            // Let's return the list, but RunningBalance might be meaningless if mixed.
            // Let's grouping by Account in frontend or just sort by Date.
            
            // Optimization: Get distinct types
            var codes = report.Lines.Select(x => x.AccountCode).Distinct().ToList();
            var accMap = await _context.Accounts.Where(a => codes.Contains(a.Code)).ToDictionaryAsync(a => a.Code, a => a.Name);
            
            foreach(var l in report.Lines)
            {
                if (accMap.ContainsKey(l.AccountCode)) l.AccountName = accMap[l.AccountCode];
            }
        }

        return report;
    }
    [HttpGet("cash-flow")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<CashFlowResponse>> GetCashFlow([FromQuery] DateOnly? startDate, [FromQuery] DateOnly? endDate, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var end = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = startDate ?? new DateOnly(end.Year, end.Month, 1);

        var query = _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.Date >= start && l.JournalEntry!.Date <= end && l.JournalEntry!.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        query = FilterAJE(query, excludeAdjusting, onlyAdjusting);

        var journalLines = await query
            .ToListAsync();
            
        // Pre-fetch accounts to categorize
        var accounts = await _context.Accounts.Where(a => a.IsActive).ToDictionaryAsync(a => a.Code, a => a);
        
        decimal netIncome = 0;
        decimal depreciation = 0;
        decimal changeInReceivables = 0;
        decimal changeInInventory = 0;
        decimal changeInPayables = 0;
        
        decimal netInvesting = 0;
        decimal netFinancing = 0;

        // Calculate Net Income & Depreciation
        foreach (var line in journalLines)
        {
            if (!accounts.ContainsKey(line.AccountId)) continue;
            var acc = accounts[line.AccountId];
            var net = line.Credit - line.Debit; // Rev/Inc/Liab/Eq is Credit Normal

            // P&L Items
            if (acc.Code.StartsWith("4")) netIncome += net; // Revenue (+)
            else if (acc.Code.StartsWith("5")) netIncome -= (line.Debit - line.Credit); // COGS (-)
            else if (acc.Code.StartsWith("6") || acc.Code.StartsWith("7") || acc.Code.StartsWith("8") || acc.Code.StartsWith("9")) 
            {
                 var exp = line.Debit - line.Credit;
                 netIncome -= exp;
                 
                 // Depreciation add-back (Non-cash expense)
                 if (acc.Name.Contains("Depreciation", StringComparison.OrdinalIgnoreCase) || acc.Name.Contains("Amortization", StringComparison.OrdinalIgnoreCase))
                 {
                     depreciation += exp;
                 }
            }
        }
        
        foreach (var line in journalLines)
        {
            if (!accounts.ContainsKey(line.AccountId)) continue;
            var acc = accounts[line.AccountId];
            var netCredit = line.Credit - line.Debit; // Cash Impact

            // Operating Working Capital
            // Receivables (Asset 1-1-...)
            if (acc.Code.StartsWith("1-1") && acc.Name.Contains("Receivable", StringComparison.OrdinalIgnoreCase))
            {
                 changeInReceivables += netCredit; // Decrease in AR is (+), Increase is (-)
            }
            // Inventory (Asset 1-...)
            else if (acc.Code.StartsWith("1") && (acc.Name.Contains("Inventory", StringComparison.OrdinalIgnoreCase) || acc.Name.Contains("Stock", StringComparison.OrdinalIgnoreCase)))
            {
                changeInInventory += netCredit; 
            }
            // Payables (Liab 2-...)
            else if (acc.Code.StartsWith("2") && acc.Name.Contains("Payable", StringComparison.OrdinalIgnoreCase))
            {
                changeInPayables += netCredit;
            }
            
            // Investing (Fixed Assets 1-2...)
            else if (acc.Code.StartsWith("1-2") || acc.Type == "Fixed Asset")
            {
                netInvesting += netCredit; // Sale is (+), Purchase is (-)
            }
            
            // Financing (Long Term Liab 2-2..., Equity 3...)
            else if (acc.Code.StartsWith("2-2") || acc.Type == "Long Term Liability")
            {
                netFinancing += netCredit; // Loan taken (+)
            }
            else if (acc.Code.StartsWith("3") && !acc.Code.StartsWith("3-9")) // Equity excluding Retained Earnings (automatic)
            {
                // Capital, Dividends
                // Dividends usually Debit (Equity contraction) -> Net Credit is Negative -> Outflow. Correct.
                netFinancing += netCredit;
            }
        }

        var res = new CashFlowResponse();
        
        // Operating
        res.OperatingActivities.Add(new ReportItem { Name = "Net Income", Balance = netIncome });
        res.OperatingActivities.Add(new ReportItem { Name = "Depreciation & Amortization", Balance = depreciation });
        res.OperatingActivities.Add(new ReportItem { Name = "Change in Receivables", Balance = changeInReceivables });
        res.OperatingActivities.Add(new ReportItem { Name = "Change in Inventory", Balance = changeInInventory });
        res.OperatingActivities.Add(new ReportItem { Name = "Change in Payables", Balance = changeInPayables });
        
        // Investing
        res.InvestingActivities.Add(new ReportItem { Name = "Net Fixed Assets", Balance = netInvesting });
        
        // Financing
        res.FinancingActivities.Add(new ReportItem { Name = "Net Financing & Equity", Balance = netFinancing });

        res.NetCashChange = (netIncome + depreciation + changeInReceivables + changeInInventory + changeInPayables) + netInvesting + netFinancing;
        
        // Cash at beginning
        var cashAccounts = accounts.Values.Where(a => a.Code.StartsWith("1-1") && (a.Name.Contains("Cash") || a.Name.Contains("Bank"))).Select(a => a.Code).ToList();
        
        var openingCashQuery = _context.JournalLines
             .Where(l => cashAccounts.Contains(l.AccountId) && l.JournalEntry!.Date < start && l.JournalEntry.Status == JournalEntryStatus.Posted)
             .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        openingCashQuery = FilterAJE(openingCashQuery, excludeAdjusting, onlyAdjusting);

        var openingCashList = await openingCashQuery.ToListAsync();
        var openingCash = openingCashList.Sum(l => l.Debit - l.Credit); // Asset Normal Debit
             
        res.CashAtBeginning = openingCash;
        res.CashAtEnd = openingCash + res.NetCashChange;

        return res;
    }

    [HttpGet("equity")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<EquityChangeResponse>> GetEquity([FromQuery] DateOnly? startDate, [FromQuery] DateOnly? endDate, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var end = endDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = startDate ?? new DateOnly(end.Year, end.Month, 1);
        
        var res = new EquityChangeResponse();
        res.StartDate = start;
        res.EndDate = end;

        // 1. Opening Balance (Total Equity at Start - 1)
        var openingQuery = _context.JournalLines
            .Where(l => l.AccountId.StartsWith("3") && l.JournalEntry!.Date < start && l.JournalEntry.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        openingQuery = FilterAJE(openingQuery, excludeAdjusting, onlyAdjusting);

        var rawOpeningLines = await openingQuery.ToListAsync();
        var openingLines = rawOpeningLines
            .GroupBy(l => l.AccountId)
            .Select(g => new { Code = g.Key, Balance = g.Sum(l => l.Credit - l.Debit) }) // Credit Normal
            .ToList();
        
        // Plus previous years Retained Earnings (Rev - Exp before start)
        var prevREQuery = _context.JournalLines
            .Where(l => (l.AccountId.StartsWith("4") || l.AccountId.StartsWith("5") || l.AccountId.StartsWith("6") || l.AccountId.StartsWith("7") || l.AccountId.StartsWith("8") || l.AccountId.StartsWith("9"))
                   && l.JournalEntry!.Date < start && l.JournalEntry.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        prevREQuery = FilterAJE(prevREQuery, excludeAdjusting, onlyAdjusting);

        var prevREList = await prevREQuery.ToListAsync();
        var prevRetainedEarnings = prevREList.Sum(l => l.Credit - l.Debit);

        res.OpeningEquity = openingLines.Sum(x => x.Balance) + prevRetainedEarnings;

        // 2. Net Income for Period
         var periodNIQuery = _context.JournalLines
            .Where(l => (l.AccountId.StartsWith("4") || l.AccountId.StartsWith("5") || l.AccountId.StartsWith("6") || l.AccountId.StartsWith("7") || l.AccountId.StartsWith("8") || l.AccountId.StartsWith("9"))
                   && l.JournalEntry!.Date >= start && l.JournalEntry.Date <= end && l.JournalEntry.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

         periodNIQuery = FilterAJE(periodNIQuery, excludeAdjusting, onlyAdjusting);

         var periodNIList = await periodNIQuery.ToListAsync();
         var periodNetIncome = periodNIList.Sum(l => l.Credit - l.Debit);
        
        res.NetIncome = periodNetIncome;

        // 3. Other Equity Changes (Dividends, Capital Injection during period)
        var eqChangesQuery = _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.AccountId.StartsWith("3") && l.JournalEntry!.Date >= start && l.JournalEntry!.Date <= end && l.JournalEntry!.Status == JournalEntryStatus.Posted)
            .Where(l => !projectId.HasValue || l.JournalEntry!.ProjectId == projectId);

        eqChangesQuery = FilterAJE(eqChangesQuery, excludeAdjusting, onlyAdjusting);

        var equityChanges = await eqChangesQuery.ToListAsync();

        res.CapitalInjection = equityChanges.Where(l => l.Credit > l.Debit).Sum(l => l.Credit - l.Debit); // Net Credit
        res.Dividends = equityChanges.Where(l => l.Debit > l.Credit).Sum(l => l.Debit - l.Credit); // Net Debit (Drawings)

        res.ClosingEquity = res.OpeningEquity + res.NetIncome + res.CapitalInjection - res.Dividends;

        return res;
    }

    [HttpGet("assets-schedule")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<AssetsScheduleResponse>> GetAssetsSchedule([FromQuery] DateOnly? asOf = null)
    {
        // For now, simple snapshot of current state
        // To support "As Of", we'd need to calculate depreciation up to that date or query historical logs.
        // Given the current simple implementation of FixedAsset (which stores current values), 
        // we'll return the current state.

        var assets = await _context.FixedAssets
            .Include(a => a.Category) // Include Category for name access
            .Where(a => a.Status != AssetStatus.WrittenOff) 
            .ToListAsync();

        var report = new AssetsScheduleResponse();

        foreach (var asset in assets)
        {
            report.Items.Add(new AssetsScheduleItem
            {
                AssetId = asset.Id,
                Code = asset.Code,
                Name = asset.Name,
                Category = asset.Category?.Name ?? "Uncategorized",
                AcquisitionDate = asset.AcquisitionDate,
                Cost = asset.AcquisitionCost,
                Method = $"{asset.DepreciationMethod} ({asset.UsefulLifeMonths}m)",
                AccumulatedDepreciation = asset.AccumulatedDepreciation,
                BookValue = asset.BookValue
            });
        }

        report.TotalCost = report.Items.Sum(x => x.Cost);
        report.TotalAccumulatedDepreciation = report.Items.Sum(x => x.AccumulatedDepreciation);
        report.TotalBookValue = report.Items.Sum(x => x.BookValue);

        return report;
    }

    private IQueryable<JournalLine> FilterAJE(IQueryable<JournalLine> query, bool? excludeAdjusting, bool? onlyAdjusting)
    {
        if (excludeAdjusting == true)
        {
            return query.Where(l => !l.JournalEntry!.IsAdjustingEntry);
        }
        if (onlyAdjusting == true)
        {
            return query.Where(l => l.JournalEntry!.IsAdjustingEntry);
        }
        return query;
    }
}

public class TrialBalanceResponse
{
    public List<TrialBalanceItem> Items { get; set; } = new();
    public decimal TotalDebit { get; set; }
    public decimal TotalCredit { get; set; }
}

public class TrialBalanceItem
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

public class GeneralLedgerResponse
{
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? AccountCode { get; set; }
    public string? AccountName { get; set; }
    public decimal OpeningBalance { get; set; }
    public List<GeneralLedgerLine> Lines { get; set; } = new();
}

public class GeneralLedgerLine
{
    public DateOnly Date { get; set; }
    public string? Reference { get; set; }
    public string? Description { get; set; }
    public string AccountCode { get; set; } = "";
    public string AccountName { get; set; } = "";
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public decimal Balance { get; set; }
}

public class BalanceSheetResponse
{
    public BalanceGroup Assets { get; set; } = new BalanceGroup { Name = "Assets" };
    public BalanceGroup Liabilities { get; set; } = new BalanceGroup { Name = "Liabilities" };
    public Section Equity { get; set; } = new Section();
}

public class BalanceGroup
{
    public string Name { get; set; } = "";
    public Section Current { get; set; } = new Section { Name = "Current" };
    public Section NonCurrent { get; set; } = new Section { Name = "Non-Current" };
    public decimal Total { get; set; }
}

public class Section
{
    public string Name { get; set; } = "";
    public List<ReportItem> Accounts { get; set; } = new();
    public decimal Total { get; set; }
}

public class ReportItem
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Balance { get; set; }
}

// --- New DTOs ---

public class ProfitLossResponse
{
    public Section Revenue { get; set; } = new Section { Name = "Revenue" };
    public Section COGS { get; set; } = new Section { Name = "Cost of Goods Sold" };
    public Section Expenses { get; set; } = new Section { Name = "Expenses" };
    
    public decimal GrossProfit { get; set; }
    public decimal NetIncome { get; set; }
}

public class AgedReportResponse
{
    public List<AgedReportRow> Rows { get; set; } = new();
    public decimal TotalCurrent { get; set; }
    public decimal Total30 { get; set; }
    public decimal Total60 { get; set; }
    public decimal Total90 { get; set; }
    public decimal Total90Plus { get; set; }
    public decimal GrandTotal { get; set; }
}

public class AgedReportRow
{
    public Guid ContactId { get; set; }
    public string ContactName { get; set; } = "";
    public decimal Current { get; set; }
    public decimal Over30 { get; set; }
    public decimal Over60 { get; set; }
    public decimal Over90 { get; set; }
    public decimal Over90Plus { get; set; }
    public decimal Total { get; set; }
}

public class InventoryValuationResponse
{
    public List<InventoryReportItem> Items { get; set; } = new();
    public decimal TotalValue { get; set; }
    public int TotalItems { get; set; }
}

public class CashFlowResponse
{
    public List<ReportItem> OperatingActivities { get; set; } = new();
    public List<ReportItem> InvestingActivities { get; set; } = new();
    public List<ReportItem> FinancingActivities { get; set; } = new();
    public decimal NetCashChange { get; set; }
    public decimal CashAtBeginning { get; set; }
    public decimal CashAtEnd { get; set; }
}

public class AssetsScheduleResponse
{
    public List<AssetsScheduleItem> Items { get; set; } = new();
    public decimal TotalCost { get; set; }
    public decimal TotalAccumulatedDepreciation { get; set; }
    public decimal TotalBookValue { get; set; }
}

public class AssetsScheduleItem
{
    public Guid AssetId { get; set; }
    public string Name { get; set; } = "";
    public string Code { get; set; } = "";
    public string Category { get; set; } = "";
    public DateOnly AcquisitionDate { get; set; }
    public decimal Cost { get; set; }
    public string Method { get; set; } = "";
    public decimal AccumulatedDepreciation { get; set; }
    public decimal BookValue { get; set; }
}

public class EquityChangeResponse
{
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal OpeningEquity { get; set; }
    public decimal NetIncome { get; set; }
    public decimal CapitalInjection { get; set; }
    public decimal Dividends { get; set; }
    public decimal ClosingEquity { get; set; }
}

public class InventoryReportItem
{
    public Guid ProductId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public decimal Quantity { get; set; }
    public decimal AverageCost { get; set; }
    public decimal TotalValue { get; set; }
}
