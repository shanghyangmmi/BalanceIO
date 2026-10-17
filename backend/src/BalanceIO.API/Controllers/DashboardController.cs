using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<DashboardController> _logger;
    private readonly ModuleHealthService _moduleHealth;
    private readonly ModuleEntitlementService _entitlement;
    private readonly TaxEqualisationService _equalisation;
    private readonly AssetChargeService _assetCharge;
    private readonly TaxAnalysisService _taxAnalysis;

    public DashboardController(
        ApplicationDbContext context,
        ILogger<DashboardController> logger,
        ModuleHealthService moduleHealth,
        ModuleEntitlementService entitlement,
        TaxEqualisationService equalisation,
        AssetChargeService assetCharge,
        TaxAnalysisService taxAnalysis)
    {
        _context = context;
        _logger = logger;
        _moduleHealth = moduleHealth;
        _entitlement = entitlement;
        _equalisation = equalisation;
        _assetCharge = assetCharge;
        _taxAnalysis = taxAnalysis;
    }

    /// <summary>What is behind each door, and which of them open.</summary>
    private static readonly (string Key, string Name, string Description, string Href, string[] Contents)[] Catalogue =
    {
        ("accounting",  "Accounting",   "Journals, the general ledger, the chart of accounts and the period close.", "/dashboard/accounting",
            new[] { "Journal entries", "General ledger", "Chart of accounts", "Approvals", "Recurring", "Period lock" }),
        ("tax",         "Tax",          "PPN Keluaran and PPN Masukan, period by period, against the SPT Masa deadline.", "/dashboard/tax",
            new[] { "PPN Keluaran", "PPN Masukan", "Ekualisasi", "Rekonsiliasi fiskal", "Debt to equity" }),
        ("inventory",   "Inventory",    "Stock on hand, counted against the shelf, and the COGS it produces.",        "/dashboard/inventory",
            new[] { "Items", "Stock opname", "Adjustments" }),
        ("fixedAssets", "Assets",       "The register at cost, and the depreciation it posts each period.",           "/dashboard/assets",
            new[] { "Register", "Depreciation", "Amortization", "Disposal" }),
        ("payroll",     "Payroll",      "Salary expense, PPh 21 and BPJS.",                                           "/dashboard/payroll",
            new[] { "Salary expense", "PPh 21", "BPJS" }),
    };

    /// <summary>
    /// The hub. A list of doors and nothing else.
    ///
    /// No figures here on purpose: the hub answers "where do I go", and the
    /// module you walk into answers "how is it going". Putting both on one
    /// page is what made the old KPI dashboard unreadable.
    /// </summary>
    [HttpGet("modules")]
    public async Task<ActionResult<ModuleDoorsResponse>> GetModuleDoors()
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        var companyId  = _context.CurrentCompanyId.Value;
        var entitlement = await _entitlement.GetAsync(companyId);

        var response = new ModuleDoorsResponse
        {
            CompanyId   = companyId,
            GeneratedAt = DateTime.UtcNow,
            PlanName    = entitlement.PlanName,
        };

        foreach (var (key, name, description, href, contents) in Catalogue)
        {
            var implemented = !ModuleEntitlementService.UnbuiltModules.Contains(key);
            var entitled    = implemented && entitlement.Has(key);

            response.Doors.Add(new ModuleDoor
            {
                Key         = key,
                Name        = name,
                Description = description,
                Contents    = contents.ToList(),
                Primary     = key == ModuleEntitlementService.CoreModule,
                Implemented = implemented,
                Entitled    = entitled,
                Href        = entitled ? href : null,
                LockedReason = !implemented
                    ? "Not built yet."
                    : entitled
                        ? null
                        : entitlement.PlanName is null
                            ? "Not included. Your company has no active plan."
                            : $"Not included in {entitlement.PlanName}.",
            });
        }

        return Ok(response);
    }

    /// <summary>
    /// 402 with a code the frontend can branch on. The lock is enforced
    /// here as well as drawn on the hub, because a door that is only shut
    /// in the UI is open to anyone who types the URL.
    /// </summary>
    private async Task<ActionResult?> RequireModuleAsync(Guid companyId, string moduleKey)
    {
        if (await _entitlement.HasAsync(companyId, moduleKey)) return null;

        return StatusCode(StatusCodes.Status402PaymentRequired, new
        {
            error   = "MODULE_NOT_ENTITLED",
            module  = moduleKey,
            message = "This module is not included in the company's current plan.",
        });
    }

    /// <summary>
    /// The balance state of every module, in one call.
    ///
    /// One call rather than five because the hub shows them together: five
    /// requests would let the cards disagree with each other while they
    /// settled, and the figures have to be consistent with the reports.
    /// </summary>
    [HttpGet("module-health")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<ModuleHealthResponse>> GetModuleHealth()
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        // Period boundaries and filing deadlines are calendar facts, so
        // "today" has to be the company's calendar day, not the server's.
        // On UTC this endpoint reports the previous day for the first
        // seven hours of every Indonesian morning, which would put the
        // wrong month on the PPN card each time a period rolls over.
        //
        // WIB is UTC+7 with no daylight saving. Company carries no
        // timezone field yet; when it does, read it here.
        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var health = await _moduleHealth.GetAsync(_context.CurrentCompanyId.Value, todayWib);

        return Ok(health);
    }

    /// <summary>
    /// The Accounting module dashboard: the same card the hub shows, plus
    /// the work left and the shape of the ledger under it.
    ///
    /// Separate from module-health because the hub asks five modules a
    /// shallow question, and this asks one module a deep one. Loading the
    /// deep answer for every module on every hub visit would pay for four
    /// modules nobody opened.
    /// </summary>
    [HttpGet("accounting")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<AccountingOverviewResponse>> GetAccountingOverview()
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        // WIB, for the same reason as above: period boundaries are calendar
        // facts and the server clock is UTC.
        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var overview = await _moduleHealth.GetAccountingOverviewAsync(_context.CurrentCompanyId.Value, todayWib);

        return Ok(overview);
    }

    /// <summary>
    /// The Tax module dashboard: the hub's card, the six-month PPN run, the
    /// SPT Masa PPN deadline, and the gaps that would stop this period being
    /// reported.
    ///
    /// Nothing in the response decides how a transaction should be taxed.
    /// </summary>
    [HttpGet("tax")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<TaxOverviewResponse>> GetTaxOverview()
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        // WIB. A PPN period boundary is a calendar fact, and the filing
        // deadline is counted in whole days from it.
        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "tax");
        if (denied is not null) return denied;

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var overview = await _moduleHealth.GetTaxOverviewAsync(_context.CurrentCompanyId.Value, todayWib);

        return Ok(overview);
    }

    /// <summary>
    /// Ekualisasi PPN: ledger revenue against reported DPP, month by month,
    /// for one year.
    ///
    /// Behind the Tax entitlement, like the rest of the module.
    /// </summary>
    [HttpGet("tax/equalisation")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<TaxEqualisationResponse>> GetTaxEqualisation([FromQuery] int? year)
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "tax");
        if (denied is not null) return denied;

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var resolved = year ?? todayWib.Year;

        // A year outside this range is a typed URL, not a request worth
        // building twelve months for.
        if (resolved < 2000 || resolved > todayWib.Year + 1)
        {
            return BadRequest(new { error = "YEAR_OUT_OF_RANGE", message = "Year must be between 2000 and next year." });
        }

        var report = await _equalisation.GetAsync(_context.CurrentCompanyId.Value, resolved);

        return Ok(report);
    }

    /// <summary>
    /// Rekonsiliasi fiskal: commercial profit reconciled to fiscal profit
    /// through the corrections marked on the chart of accounts.
    /// </summary>
    [HttpGet("tax/reconciliation")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<FiscalReconciliationResponse>> GetFiscalReconciliation([FromQuery] int? year)
    {
        var guard = await TaxYearGuardAsync(year);
        if (guard.Error is not null) return guard.Error;

        return Ok(await _taxAnalysis.ReconcileAsync(_context.CurrentCompanyId!.Value, guard.Year));
    }

    /// <summary>
    /// Debt to equity under PMK-169, on average balances, with the share of
    /// interest that falls outside the 4:1 cap.
    /// </summary>
    [HttpGet("tax/debt-to-equity")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<DebtToEquityResponse>> GetDebtToEquity([FromQuery] int? year)
    {
        var guard = await TaxYearGuardAsync(year);
        if (guard.Error is not null) return guard.Error;

        return Ok(await _taxAnalysis.DebtToEquityAsync(_context.CurrentCompanyId!.Value, guard.Year));
    }

    /// <summary>
    /// Company context, the Tax entitlement and a sane year, in one place —
    /// three tax reports were about to repeat the same twenty lines.
    /// </summary>
    private async Task<(ActionResult? Error, int Year)> TaxYearGuardAsync(int? year)
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return (BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." }), 0);
        }

        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "tax");
        if (denied is not null) return (denied, 0);

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        var resolved = year ?? todayWib.Year;

        if (resolved < 2000 || resolved > todayWib.Year + 1)
        {
            return (BadRequest(new { error = "YEAR_OUT_OF_RANGE", message = "Year must be between 2000 and next year." }), 0);
        }

        return (null, resolved);
    }

    /// <summary>
    /// The periodic charge against the register: what is on it, what is due
    /// this period, and what would stop a run.
    ///
    /// One endpoint pair for both classes. Depreciation and amortisation
    /// are the same machine — same arithmetic, same rounding, same entry —
    /// so giving them separate implementations would only let them drift.
    /// </summary>
    [HttpGet("assets/depreciation")]
    [RequiresPermission(Permissions.AssetsView)]
    public Task<ActionResult<AssetChargeOverviewResponse>> GetDepreciation() => AssetChargeAsync(intangible: false);

    [HttpGet("assets/amortisation")]
    [RequiresPermission(Permissions.AssetsView)]
    public Task<ActionResult<AssetChargeOverviewResponse>> GetAmortisation() => AssetChargeAsync(intangible: true);

    /// <summary>
    /// Run the charge for the current period and post the entry.
    ///
    /// Writes one balanced, posted journal entry for the whole run and
    /// links every charge row to it. Depreciation used to update the
    /// register and stop, so the charge never reached the ledger at all.
    /// </summary>
    [HttpPost("assets/depreciation/run")]
    [RequiresPermission(Permissions.AssetsDepreciate)]
    public Task<ActionResult<AssetChargeRunResult>> RunDepreciation() => RunAssetChargeAsync(intangible: false);

    [HttpPost("assets/amortisation/run")]
    [RequiresPermission(Permissions.AssetsDepreciate)]
    public Task<ActionResult<AssetChargeRunResult>> RunAmortisation() => RunAssetChargeAsync(intangible: true);

    private async Task<ActionResult<AssetChargeOverviewResponse>> AssetChargeAsync(bool intangible)
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "fixedAssets");
        if (denied is not null) return denied;

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        return Ok(await _assetCharge.GetAsync(_context.CurrentCompanyId.Value, todayWib, intangible));
    }

    private async Task<ActionResult<AssetChargeRunResult>> RunAssetChargeAsync(bool intangible)
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "fixedAssets");
        if (denied is not null) return denied;

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        try
        {
            return Ok(await _assetCharge.RunAsync(_context.CurrentCompanyId.Value, todayWib, intangible));
        }
        catch (System.ComponentModel.DataAnnotations.ValidationException ex)
        {
            // The period lock refused. That is an answer, not a fault.
            return BadRequest(new { error = "PERIOD_LOCKED", message = ex.Message });
        }
    }

    /// <summary>
    /// The Inventory module dashboard: the position, the state of counting,
    /// and the items whose movements cannot reach the ledger.
    /// </summary>
    [HttpGet("inventory")]
    [RequiresPermission(Permissions.InventoryView)]
    public async Task<ActionResult<StockOverviewResponse>> GetStockOverview()
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "inventory");
        if (denied is not null) return denied;

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var overview = await _moduleHealth.GetStockOverviewAsync(_context.CurrentCompanyId.Value, todayWib);

        return Ok(overview);
    }

    /// <summary>
    /// The Fixed Assets module dashboard: the register at cost, what is
    /// behind on depreciation, and what could not post if it were run.
    /// </summary>
    [HttpGet("assets")]
    [RequiresPermission(Permissions.AssetsView)]
    public async Task<ActionResult<AssetOverviewResponse>> GetAssetOverview()
    {
        if (!_context.CurrentCompanyId.HasValue)
        {
            return BadRequest(new { error = "COMPANY_REQUIRED", message = "Company context is required. Send the X-Company-Id header." });
        }

        var denied = await RequireModuleAsync(_context.CurrentCompanyId.Value, "fixedAssets");
        if (denied is not null) return denied;

        var todayWib = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var overview = await _moduleHealth.GetAssetOverviewAsync(_context.CurrentCompanyId.Value, todayWib);

        return Ok(overview);
    }

    [HttpGet("metrics")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult> GetMetrics()
    {
        try
        {
            var invoices = await _context.SalesInvoices
                .Where(i => i.Status != InvoiceStatus.Void && i.Status != InvoiceStatus.Draft)
                .ToListAsync();

            var totalRevenue = invoices.Sum(i => i.Total);
            var salesCount = invoices.Count;
                
            var lastMonth = DateTime.UtcNow.AddMonths(-1);
            var startOfLastMonth = new DateOnly(lastMonth.Year, lastMonth.Month, 1);
            var endOfLastMonth = startOfLastMonth.AddMonths(1).AddDays(-1);

            var prevRevenue = invoices
                 .Where(i => i.InvoiceDate >= startOfLastMonth && i.InvoiceDate <= endOfLastMonth)
                 .Sum(i => i.Total);

            double revenueGrowth = 0;
            if (prevRevenue > 0)
            {
                revenueGrowth = (double)((totalRevenue - prevRevenue) / prevRevenue) * 100;
            }
            else if (totalRevenue > 0)
            {
                revenueGrowth = 100;
            }

            var expenseAccountCodes = await _context.Accounts
                .Where(a => a.Code.StartsWith("5") || a.Code.StartsWith("6"))
                .Select(a => a.Code)
                .ToListAsync();

            var postedJournalEntryIds = await _context.JournalEntries
                .Where(j => j.Status == JournalEntryStatus.Posted)
                .Select(j => j.Id)
                .ToListAsync();

            var totalExpenses = 0m;
            if (expenseAccountCodes.Any() && postedJournalEntryIds.Any())
            {
                totalExpenses = await _context.JournalLines
                    .Where(l => expenseAccountCodes.Contains(l.AccountId) 
                             && postedJournalEntryIds.Contains(l.JournalEntryId)
                             && l.Debit > 0)
                    .SumAsync(l => l.Debit);
            }

            var activeSubscriptions = 0; 
            var activeUsers = 1;

            return Ok(new 
            {
                TotalRevenue = totalRevenue,
                TotalExpenses = totalExpenses,
                RevenueGrowth = revenueGrowth,
                SalesCount = salesCount,
                Subscriptions = activeSubscriptions,
                ActiveNow = activeUsers
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard GetMetrics failed");
            return StatusCode(500, new { error = "GetMetrics failed", detail = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("recent-sales")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult> GetRecentSales()
    {
        try
        {
            var recentSales = await _context.SalesInvoices
                .Include(i => i.Contact)
                .Where(i => i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Void)
                .OrderByDescending(i => i.CreatedAt)
                .Take(5)
                .ToListAsync();
                
            var response = recentSales.Select(i => new {
                    Name = i.Contact?.Name ?? "Unknown Client",
                    Email = i.Contact?.Email ?? "",
                    Amount = i.Total,
                    Avatar = "" 
                });

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard GetRecentSales failed");
            return StatusCode(500, new { error = "GetRecentSales failed", detail = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("overview")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult> GetOverview()
    {
        try
        {
            var year = DateTime.UtcNow.Year;
            
            var invoices = await _context.SalesInvoices
                .Where(i => i.Status != InvoiceStatus.Void && i.Status != InvoiceStatus.Draft)
                .ToListAsync();

            var data = invoices
                .Where(i => i.InvoiceDate.Year == year)
                .ToList() // Force client-side evaluation for GroupBy
                .GroupBy(i => i.InvoiceDate.Month)
                .Select(g => new {
                    Month = g.Key,
                    Total = g.Sum(i => i.Total)
                })
                .ToList();
                
            var result = Enumerable.Range(1, 12).Select(month => new {
                name = CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(month),
                total = data.FirstOrDefault(d => d.Month == month)?.Total ?? 0
            }).ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard GetOverview failed");
            return StatusCode(500, new { error = "GetOverview failed", detail = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("expense-breakdown")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult> GetExpenseBreakdown()
    {
        try
        {
            var expenseAccounts = await _context.Accounts
                .Where(a => a.Code.StartsWith("5") || a.Code.StartsWith("6"))
                .ToListAsync();

            if (!expenseAccounts.Any())
            {
                return Ok(new List<object>());
            }

            var expenseAccountIds = expenseAccounts.Select(a => a.Code).ToList();

            var postedJournalEntryIds = await _context.JournalEntries
                .Where(j => j.Status == JournalEntryStatus.Posted)
                .Select(j => j.Id)
                .ToListAsync();

            var journalLines = await _context.JournalLines
                .Where(l => expenseAccountIds.Contains(l.AccountId) 
                         && postedJournalEntryIds.Contains(l.JournalEntryId)
                         && l.Debit > 0)
                .ToListAsync();

            var breakdown = journalLines
                .GroupBy(l => l.AccountId)
                .Select(g => new 
                {
                    AccountName = expenseAccounts.FirstOrDefault(a => a.Code == g.Key)?.Name ?? "Unknown Account",
                    Total = g.Sum(l => l.Debit)
                })
                .OrderByDescending(x => x.Total)
                .Take(5)
                .ToList();

            return Ok(breakdown);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard GetExpenseBreakdown failed");
            return StatusCode(500, new { error = "GetExpenseBreakdown failed", detail = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("top-products")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult> GetTopProducts()
    {
        try
        {
            var validInvoiceIds = await _context.SalesInvoices
                .Where(i => i.Status != InvoiceStatus.Draft && i.Status != InvoiceStatus.Void)
                .Select(i => i.Id)
                .ToListAsync();

            var invoiceLines = await _context.SalesInvoiceLines
                .Where(l => l.ProductId != null && validInvoiceIds.Contains(l.SalesInvoiceId))
                .ToListAsync();

            var topProducts = invoiceLines
                .GroupBy(l => l.ProductId!.Value)
                .Select(g => new 
                {
                    ProductId = g.Key,
                    Quantity = g.Sum(l => l.Quantity),
                    Revenue = g.Sum(l => l.LineTotal)
                })
                .OrderByDescending(x => x.Revenue)
                .Take(5)
                .ToList();

            var productIds = topProducts.Select(x => x.ProductId).ToList();
            var products = await _context.Products
                .Where(p => productIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => p.Name);

            var result = topProducts.Select(x => new 
            {
                ProductName = products.ContainsKey(x.ProductId) ? products[x.ProductId] : "Unknown Product",
                x.Quantity,
                x.Revenue
            }).ToList();
            
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard GetTopProducts failed");
            return StatusCode(500, new { error = "GetTopProducts failed", detail = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    [HttpGet("sales-trend")]
    [RequiresPermission(Permissions.SalesView)]
    public async Task<ActionResult> GetSalesTrend()
    {
        try
        {
            var startOfMonth = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
            var endOfMonth = startOfMonth.AddMonths(1).AddDays(-1);

            var invoices = await _context.SalesInvoices
                .Where(i => i.InvoiceDate >= startOfMonth 
                         && i.InvoiceDate <= endOfMonth
                         && i.Status != InvoiceStatus.Draft 
                         && i.Status != InvoiceStatus.Void)
                .ToListAsync();

            var dailyTrend = invoices
                .GroupBy(i => i.InvoiceDate.Day)
                .Select(g => new 
                {
                    Day = g.Key,
                    Total = g.Sum(i => i.Total)
                })
                .OrderBy(x => x.Day)
                .ToList();

            var result = Enumerable.Range(1, DateTime.DaysInMonth(DateTime.UtcNow.Year, DateTime.UtcNow.Month))
                .Select(day => new 
                {
                    Date = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, day).ToString("dd MMM"),
                    Total = dailyTrend.FirstOrDefault(d => d.Day == day)?.Total ?? 0
                })
                .ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Dashboard GetSalesTrend failed");
            return StatusCode(500, new { error = "GetSalesTrend failed", detail = ex.Message, inner = ex.InnerException?.Message });
        }
    }
}
