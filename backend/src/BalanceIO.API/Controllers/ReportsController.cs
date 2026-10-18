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
    private readonly BalanceIO.API.Services.FinancialStatementsService _statements;

    public ReportsController(ApplicationDbContext context, BalanceIO.API.Services.FinancialStatementsService statements)
    {
        _context = context;
        _statements = statements;
    }

    /// <summary>
    /// The full statement set, bilingual (Bahasa Indonesia and English), with
    /// the prior year alongside when <paramref name="comparative"/> is set.
    /// Defaults to the fiscal year to date.
    /// </summary>
    [HttpGet("financial-statements")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<BalanceIO.API.DTOs.FinancialStatementPack>> GetFinancialStatements(
        [FromQuery] DateOnly? start, [FromQuery] DateOnly? end, [FromQuery] bool comparative = true)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });

        var to = end ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var from = start ?? new DateOnly(to.Year, 1, 1);
        var who = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;

        return Ok(await _statements.BuildAsync(_context.CurrentCompanyId.Value, from, to, comparative, who));
    }

    /// <summary>Cash and cash equivalents over a period, per account, with weekly balances.</summary>
    [HttpGet("cash-position")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<BalanceIO.API.DTOs.CashPositionResponse>> GetCashPosition([FromQuery] DateOnly? start, [FromQuery] DateOnly? end)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });

        var to = end ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var from = start ?? new DateOnly(to.Year, to.Month, 1);
        return Ok(await _statements.CashPositionAsync(_context.CurrentCompanyId.Value, from, to));
    }

    [HttpGet("balance-sheet")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<BalanceSheetResponse>> GetBalanceSheet([FromQuery] DateTime? asOf = null, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var reportDate = asOf ?? DateTime.UtcNow;
        var dateDateOnly = DateOnly.FromDateTime(reportDate);

        // 1. Fetch all Accounts
        var accounts = await _context.Accounts.ToListAsync();

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
            .Where(a => (a.Code.StartsWith("4") || a.Code.StartsWith("5") || 
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
            .Where(p => p.Type == ProductType.Product && p.TrackInventory && (p.IsActive || p.StockOnHand != 0m || p.InventoryValue != 0m))
            .ToListAsync();

        var report = new InventoryValuationResponse();

        foreach (var p in products)
        {
            report.Items.Add(new InventoryReportItem
            {
                ProductId = p.Id,
                Code = p.Code,
                Name = p.Name,
                Quantity = p.StockOnHand,
                AverageCost = p.AverageCost,
                TotalValue = p.InventoryValue
            });
        }

        report.TotalValue = report.Items.Sum(x => x.TotalValue);
        report.TotalItems = report.Items.Count;

        return report;
    }
    /// <summary>
    /// Stock card from the movement ledger: per product, the balance before
    /// the period, every movement in it with the running quantity and value,
    /// and the closing balance. Value runs company-wide (the average is
    /// company-wide), so a warehouse filter returns quantities only.
    /// </summary>
    [HttpGet("inventory-movements")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<IActionResult> GetInventoryMovements([FromQuery] DateOnly? start, [FromQuery] DateOnly? end,
        [FromQuery] Guid? productId, [FromQuery] Guid? warehouseId)
    {
        var to = end ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var from = start ?? new DateOnly(to.Year, to.Month, 1);
        if (from > to)
            return BadRequest(new { code = "VALIDATION_FAILED", message = "Start is after end." });
        var withValue = !warehouseId.HasValue;

        // Read in memory: SQLite stores decimal(19,4) as REAL.
        var movements = await _context.InventoryMovements.AsNoTracking()
            .Where(m => m.MovementDate <= to
                     && (!productId.HasValue || m.ProductId == productId)
                     && (!warehouseId.HasValue || m.WarehouseId == warehouseId))
            .OrderBy(m => m.MovementDate).ThenBy(m => m.CreatedAt)
            .Select(m => new
            {
                m.Id, m.ProductId, m.WarehouseId, m.MovementDate, m.Type, m.Quantity, m.UnitCost, m.TotalCost,
                m.ReferenceNumber, m.Notes,
            })
            .ToListAsync();

        var productIds = movements.Select(m => m.ProductId).Distinct().ToList();
        var products = await _context.Products.AsNoTracking()
            .Where(p => productIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Code, p.Name, p.Unit })
            .ToDictionaryAsync(p => p.Id);
        var warehouses = await _context.Warehouses.AsNoTracking()
            .Select(w => new { w.Id, w.Code })
            .ToDictionaryAsync(w => w.Id, w => w.Code);

        var cards = movements
            .Where(m => products.ContainsKey(m.ProductId))
            .GroupBy(m => m.ProductId)
            .Select(g =>
            {
                var p = products[g.Key];
                var before = g.Where(m => m.MovementDate < from).ToList();
                var qty = before.Sum(m => m.Quantity);
                var value = before.Sum(m => m.TotalCost);
                var openingQty = qty;
                var openingValue = value;
                var lines = new List<object>();
                decimal qtyIn = 0m, qtyOut = 0m, valueIn = 0m, valueOut = 0m;

                foreach (var m in g.Where(m => m.MovementDate >= from))
                {
                    qty += m.Quantity;
                    value += m.TotalCost;
                    if (m.Quantity > 0m) qtyIn += m.Quantity; else qtyOut -= m.Quantity;
                    if (m.TotalCost > 0m) valueIn += m.TotalCost; else valueOut -= m.TotalCost;
                    lines.Add(new
                    {
                        m.Id, Date = m.MovementDate, Type = m.Type.ToString(), Reference = m.ReferenceNumber, m.Notes,
                        Warehouse = m.WarehouseId.HasValue && warehouses.TryGetValue(m.WarehouseId.Value, out var code) ? code : null,
                        QuantityIn = m.Quantity > 0m ? m.Quantity : 0m,
                        QuantityOut = m.Quantity < 0m ? -m.Quantity : 0m,
                        m.UnitCost,
                        Value = withValue ? m.TotalCost : (decimal?)null,
                        BalanceQuantity = qty,
                        BalanceValue = withValue ? value : (decimal?)null,
                    });
                }

                return new
                {
                    ProductId = p.Id, p.Code, p.Name, p.Unit,
                    OpeningQuantity = openingQty,
                    OpeningValue = withValue ? openingValue : (decimal?)null,
                    QuantityIn = qtyIn, QuantityOut = qtyOut,
                    ValueIn = withValue ? valueIn : (decimal?)null,
                    ValueOut = withValue ? valueOut : (decimal?)null,
                    ClosingQuantity = qty,
                    ClosingValue = withValue ? value : (decimal?)null,
                    Movements = lines,
                };
            })
            .Where(c => c.Movements.Count > 0 || c.OpeningQuantity != 0m || (c.OpeningValue ?? 0m) != 0m)
            .OrderBy(c => c.Code)
            .ToList();

        return Ok(new
        {
            Start = from, End = to, WarehouseId = warehouseId, WithValue = withValue,
            OpeningValue = withValue ? cards.Sum(c => c.OpeningValue ?? 0m) : (decimal?)null,
            ValueIn = withValue ? cards.Sum(c => c.ValueIn ?? 0m) : (decimal?)null,
            ValueOut = withValue ? cards.Sum(c => c.ValueOut ?? 0m) : (decimal?)null,
            ClosingValue = withValue ? cards.Sum(c => c.ClosingValue ?? 0m) : (decimal?)null,
            Products = cards,
        });
    }

    /// <summary>
    /// Age of the stock on hand. Units on hand are taken to be the most
    /// recently received (first in, first out for ageing; cost stays at the
    /// moving average), so each unit's age is the age of the receipt it is
    /// attributed to. Transfers do not reset age. Value per bucket is at the
    /// average, with the last bucket taking the rounding so the buckets add
    /// up to the carrying value.
    /// </summary>
    [HttpGet("inventory-aging")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<IActionResult> GetInventoryAging([FromQuery] DateOnly? asOf)
    {
        var date = asOf ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        int[] limits = [30, 60, 90];

        var products = await _context.Products.AsNoTracking()
            .Where(p => p.TrackInventory && p.StockOnHand > 0m)
            .Select(p => new { p.Id, p.Code, p.Name, p.Unit, p.StockOnHand, p.InventoryValue, p.AverageCost })
            .ToListAsync();
        var ids = products.Select(p => p.Id).ToList();

        // Read in memory: SQLite stores decimal(19,4) as REAL.
        var movements = await _context.InventoryMovements.AsNoTracking()
            .Where(m => ids.Contains(m.ProductId) && m.MovementDate <= date && m.Type != InventoryMovementType.Transfer)
            .Select(m => new { m.ProductId, m.MovementDate, m.Quantity, m.Type })
            .ToListAsync();
        var byProduct = movements.ToLookup(m => m.ProductId);

        var rows = products.OrderBy(p => p.Code).Select(p =>
        {
            var buckets = new decimal[limits.Length + 1];
            var remaining = p.StockOnHand;
            foreach (var receipt in byProduct[p.Id].Where(m => m.Quantity > 0m).OrderByDescending(m => m.MovementDate))
            {
                if (remaining <= 0m) break;
                var take = Math.Min(remaining, receipt.Quantity);
                var age = date.DayNumber - receipt.MovementDate.DayNumber;
                var bucket = Array.FindIndex(limits, l => age <= l);
                buckets[bucket < 0 ? limits.Length : bucket] += take;
                remaining -= take;
            }
            // Stock with no receipt on record is of unknown age; it is shown as the oldest.
            buckets[limits.Length] += remaining;

            var values = new decimal[buckets.Length];
            var last = Array.FindLastIndex(buckets, q => q != 0m);
            for (var i = 0; i < buckets.Length; i++)
                values[i] = i == last ? 0m : Math.Round(buckets[i] * p.AverageCost, 2, MidpointRounding.ToEven);
            if (last >= 0) values[last] = p.InventoryValue - values.Sum();

            var lastSale = byProduct[p.Id].Where(m => m.Type == InventoryMovementType.Sale && m.Quantity < 0m)
                .Select(m => (DateOnly?)m.MovementDate).Max();

            return new
            {
                ProductId = p.Id, p.Code, p.Name, p.Unit,
                Quantity = p.StockOnHand, Value = p.InventoryValue, p.AverageCost,
                Buckets = buckets.Select((q, i) => new { Quantity = q, Value = values[i] }).ToList(),
                LastSale = lastSale,
                DaysSinceLastSale = lastSale.HasValue ? date.DayNumber - lastSale.Value.DayNumber : (int?)null,
            };
        }).ToList();

        return Ok(new
        {
            AsOf = date,
            Buckets = new[] { "0-30", "31-60", "61-90", "90+" },
            Totals = Enumerable.Range(0, limits.Length + 1).Select(i => new
            {
                Quantity = rows.Sum(r => r.Buckets[i].Quantity),
                Value = rows.Sum(r => r.Buckets[i].Value),
            }).ToList(),
            Value = rows.Sum(r => r.Value),
            Rows = rows,
        });
    }

    [HttpGet("trial-balance")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<TrialBalanceResponse>> GetTrialBalance([FromQuery] DateTime? asOf = null, [FromQuery] Guid? projectId = null, [FromQuery] bool? excludeAdjusting = null, [FromQuery] bool? onlyAdjusting = null)
    {
        var reportDate = asOf ?? DateTime.UtcNow;
        var dateDateOnly = DateOnly.FromDateTime(reportDate);

        var accounts = await _context.Accounts.ToListAsync();

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
        var accounts = await _context.Accounts.ToDictionaryAsync(a => a.Code, a => a);
        
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

    /// <summary>
    /// Columnar Profit & Loss matrix breaking down revenue and expenses by dimension (CostCenter or Project).
    /// </summary>
    [HttpGet("profit-loss-by-dimension")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<DimensionalProfitLossResponse>> GetProfitLossByDimension(
        [FromQuery] string dimensionType = "CostCenter",
        [FromQuery] DateOnly? start = null,
        [FromQuery] DateOnly? end = null,
        [FromQuery] bool? excludeAdjusting = null,
        [FromQuery] bool? onlyAdjusting = null)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });

        var companyId = _context.CurrentCompanyId.Value;
        var to = end ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var from = start ?? new DateOnly(to.Year, 1, 1);

        var isCostCenter = string.Equals(dimensionType, "CostCenter", StringComparison.OrdinalIgnoreCase);

        // Fetch accounts
        var accounts = await _context.Accounts
            .Where(a => a.CompanyId == companyId && (a.Code.StartsWith("4") || a.Code.StartsWith("5") ||
                        a.Code.StartsWith("6") || a.Code.StartsWith("7") ||
                        a.Code.StartsWith("8") || a.Code.StartsWith("9")))
            .OrderBy(a => a.Code)
            .ToListAsync();

        // Fetch dimension headers
        var dimensionHeaders = new List<DimensionColumnHeader>();
        if (isCostCenter)
        {
            var costCenters = await _context.CostCenters
                .Where(c => c.CompanyId == companyId && c.IsActive)
                .OrderBy(c => c.Code)
                .ToListAsync();

            dimensionHeaders.AddRange(costCenters.Select(c => new DimensionColumnHeader
            {
                Id = c.Id.ToString(),
                Code = c.Code,
                Name = c.Name
            }));
        }
        else // Project
        {
            var projects = await _context.Projects
                .Where(p => p.CompanyId == companyId)
                .OrderBy(p => p.Code)
                .ToListAsync();

            dimensionHeaders.AddRange(projects.Select(p => new DimensionColumnHeader
            {
                Id = p.Id.ToString(),
                Code = p.Code ?? p.Name,
                Name = p.Name
            }));
        }

        // Always include an unassigned column header
        var unassignedHeader = new DimensionColumnHeader
        {
            Id = "unassigned",
            Code = "UNASSIGNED",
            Name = "Unassigned / General"
        };
        dimensionHeaders.Add(unassignedHeader);

        // Fetch posted lines in date range
        var query = _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.CompanyId == companyId &&
                        l.JournalEntry.Date >= from && l.JournalEntry.Date <= to &&
                        l.JournalEntry.Status == JournalEntryStatus.Posted);

        query = FilterAJE(query, excludeAdjusting, onlyAdjusting);
        var lines = await query.ToListAsync();

        // Group lines by AccountCode and DimensionKey
        var matrix = new Dictionary<string, Dictionary<string, decimal>>(); // accountCode -> (dimensionKey -> net)

        foreach (var line in lines)
        {
            string dimKey;
            if (isCostCenter)
            {
                dimKey = line.CostCenterId.HasValue ? line.CostCenterId.Value.ToString() : "unassigned";
            }
            else
            {
                var pId = line.ProjectId ?? line.JournalEntry?.ProjectId;
                dimKey = pId.HasValue ? pId.Value.ToString() : "unassigned";
            }

            if (!matrix.TryGetValue(line.AccountId, out var dimDict))
            {
                dimDict = new Dictionary<string, decimal>();
                matrix[line.AccountId] = dimDict;
            }

            dimDict.TryGetValue(dimKey, out var curr);
            // Revenue (4xxx, 7xxx) -> Credit normal (Credit - Debit)
            // Expense / COGS (5xxx, 6xxx, 8xxx, 9xxx) -> Debit normal (Debit - Credit)
            var isRevenue = line.AccountId.StartsWith("4") || line.AccountId.StartsWith("7");
            var change = isRevenue ? (line.Credit - line.Debit) : (line.Debit - line.Credit);
            dimDict[dimKey] = curr + change;
        }

        var response = new DimensionalProfitLossResponse
        {
            StartDate = from,
            EndDate = to,
            DimensionType = isCostCenter ? "CostCenter" : "Project",
            Dimensions = dimensionHeaders
        };

        // Initialize dimension total dictionaries
        foreach (var dim in dimensionHeaders)
        {
            response.TotalRevenueByDimension[dim.Id] = 0m;
            response.TotalCogsByDimension[dim.Id] = 0m;
            response.TotalExpensesByDimension[dim.Id] = 0m;
        }

        foreach (var acc in accounts)
        {
            if (!matrix.TryGetValue(acc.Code, out var dimDict)) continue;
            var rowTotal = dimDict.Values.Sum();
            if (rowTotal == 0m && dimDict.Values.All(v => v == 0m)) continue;

            var row = new DimensionalReportRow
            {
                AccountCode = acc.Code,
                AccountName = acc.Name,
                Total = rowTotal,
                BalancesByDimension = new Dictionary<string, decimal>()
            };

            foreach (var dim in dimensionHeaders)
            {
                dimDict.TryGetValue(dim.Id, out var val);
                row.BalancesByDimension[dim.Id] = val;
            }

            if (acc.Code.StartsWith("4") || acc.Code.StartsWith("7")) // Revenue
            {
                row.Category = "Revenue";
                response.RevenueRows.Add(row);
                foreach (var dim in dimensionHeaders)
                {
                    row.BalancesByDimension.TryGetValue(dim.Id, out var val);
                    response.TotalRevenueByDimension[dim.Id] += val;
                }
            }
            else if (acc.Code.StartsWith("5")) // COGS
            {
                row.Category = "COGS";
                response.CogsRows.Add(row);
                foreach (var dim in dimensionHeaders)
                {
                    row.BalancesByDimension.TryGetValue(dim.Id, out var val);
                    response.TotalCogsByDimension[dim.Id] += val;
                }
            }
            else // Operating & other expenses
            {
                row.Category = "Expense";
                response.ExpenseRows.Add(row);
                foreach (var dim in dimensionHeaders)
                {
                    row.BalancesByDimension.TryGetValue(dim.Id, out var val);
                    response.TotalExpensesByDimension[dim.Id] += val;
                }
            }
        }

        // Totals
        response.TotalRevenue = response.RevenueRows.Sum(r => r.Total);
        response.TotalCogs = response.CogsRows.Sum(r => r.Total);
        response.TotalGrossProfit = response.TotalRevenue - response.TotalCogs;
        response.TotalExpenses = response.ExpenseRows.Sum(r => r.Total);
        response.TotalNetIncome = response.TotalGrossProfit - response.TotalExpenses;

        foreach (var dim in dimensionHeaders)
        {
            var rev = response.TotalRevenueByDimension[dim.Id];
            var cogs = response.TotalCogsByDimension[dim.Id];
            var exp = response.TotalExpensesByDimension[dim.Id];
            response.GrossProfitByDimension[dim.Id] = rev - cogs;
            response.NetIncomeByDimension[dim.Id] = rev - cogs - exp;
        }

        return Ok(response);
    }

    /// <summary>
    /// Direct revenue vs direct expenses and gross margin for a given project.
    /// </summary>
    [HttpGet("project-profitability")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<ProjectProfitabilityResponse>> GetProjectProfitability(
        [FromQuery] Guid projectId,
        [FromQuery] DateOnly? start = null,
        [FromQuery] DateOnly? end = null)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest(new { code = "COMPANY_REQUIRED", message = "Company context is required." });

        var companyId = _context.CurrentCompanyId.Value;

        var project = await _context.Projects
            .FirstOrDefaultAsync(p => p.CompanyId == companyId && p.Id == projectId);

        if (project == null)
            return NotFound(new { code = "PROJECT_NOT_FOUND", message = "Project not found." });

        var query = _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.CompanyId == companyId &&
                        l.JournalEntry.Status == JournalEntryStatus.Posted &&
                        (l.ProjectId == projectId || l.JournalEntry.ProjectId == projectId));

        if (start.HasValue)
            query = query.Where(l => l.JournalEntry!.Date >= start.Value);
        if (end.HasValue)
            query = query.Where(l => l.JournalEntry!.Date <= end.Value);

        var lines = await query.ToListAsync();

        var accountCodes = lines.Select(l => l.AccountId).Distinct().ToList();
        var accounts = await _context.Accounts
            .Where(a => a.CompanyId == companyId && accountCodes.Contains(a.Code))
            .ToDictionaryAsync(a => a.Code, a => a.Name);

        var revenueBreakdown = new List<ProjectCostBreakdownItem>();
        var costBreakdown = new List<ProjectCostBreakdownItem>();

        var grouped = lines.GroupBy(l => l.AccountId).ToList();
        foreach (var g in grouped)
        {
            var accCode = g.Key;
            var accName = accounts.TryGetValue(accCode, out var name) ? name : accCode;

            if (accCode.StartsWith("4") || accCode.StartsWith("7")) // Revenue / Other Income
            {
                var netRevenue = g.Sum(l => l.Credit - l.Debit);
                if (netRevenue != 0m)
                {
                    revenueBreakdown.Add(new ProjectCostBreakdownItem
                    {
                        AccountCode = accCode,
                        AccountName = accName,
                        Amount = netRevenue
                    });
                }
            }
            else if (accCode.StartsWith("5") || accCode.StartsWith("6") || accCode.StartsWith("8") || accCode.StartsWith("9")) // Cost of Sales / Expense
            {
                var netCost = g.Sum(l => l.Debit - l.Credit);
                if (netCost != 0m)
                {
                    costBreakdown.Add(new ProjectCostBreakdownItem
                    {
                        AccountCode = accCode,
                        AccountName = accName,
                        Amount = netCost
                    });
                }
            }
        }

        var totalRev = revenueBreakdown.Sum(r => r.Amount);
        var totalCost = costBreakdown.Sum(c => c.Amount);
        var grossProfit = totalRev - totalCost;
        var marginPct = totalRev != 0m ? Math.Round((grossProfit / totalRev) * 100m, 2) : 0m;

        var response = new ProjectProfitabilityResponse
        {
            ProjectId = project.Id,
            ProjectCode = project.Code ?? "",
            ProjectName = project.Name,
            StartDate = start,
            EndDate = end,
            TotalRevenue = totalRev,
            TotalDirectCost = totalCost,
            GrossProfit = grossProfit,
            GrossMarginPercentage = marginPct,
            RevenueBreakdown = revenueBreakdown.OrderBy(r => r.AccountCode).ToList(),
            CostBreakdown = costBreakdown.OrderBy(c => c.AccountCode).ToList()
        };

        return Ok(response);
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

public class DimensionalProfitLossResponse
{
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string DimensionType { get; set; } = "CostCenter";
    public List<DimensionColumnHeader> Dimensions { get; set; } = new();
    public List<DimensionalReportRow> RevenueRows { get; set; } = new();
    public List<DimensionalReportRow> CogsRows { get; set; } = new();
    public List<DimensionalReportRow> ExpenseRows { get; set; } = new();
    public Dictionary<string, decimal> TotalRevenueByDimension { get; set; } = new();
    public Dictionary<string, decimal> TotalCogsByDimension { get; set; } = new();
    public Dictionary<string, decimal> GrossProfitByDimension { get; set; } = new();
    public Dictionary<string, decimal> TotalExpensesByDimension { get; set; } = new();
    public Dictionary<string, decimal> NetIncomeByDimension { get; set; } = new();
    public decimal TotalRevenue { get; set; }
    public decimal TotalCogs { get; set; }
    public decimal TotalGrossProfit { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal TotalNetIncome { get; set; }
}

public class DimensionColumnHeader
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}

public class DimensionalReportRow
{
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public Dictionary<string, decimal> BalancesByDimension { get; set; } = new();
    public decimal Total { get; set; }
}

public class ProjectProfitabilityResponse
{
    public Guid ProjectId { get; set; }
    public string ProjectCode { get; set; } = string.Empty;
    public string ProjectName { get; set; } = string.Empty;
    public string? CustomerName { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public decimal ContractAmount { get; set; }
    public decimal TotalRevenue { get; set; }
    public decimal TotalDirectCost { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal GrossMarginPercentage { get; set; }
    public List<ProjectCostBreakdownItem> RevenueBreakdown { get; set; } = new();
    public List<ProjectCostBreakdownItem> CostBreakdown { get; set; } = new();
}

public class ProjectCostBreakdownItem
{
    public string AccountCode { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}

