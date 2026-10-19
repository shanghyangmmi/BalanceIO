using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/accounting/period-close")]
[Authorize]
public class PeriodClosingController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly IDocumentHistoryService _historyService;
    private readonly ILogger<PeriodClosingController> _logger;

    public PeriodClosingController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        IDocumentHistoryService historyService,
        ILogger<PeriodClosingController> logger)
    {
        _context = context;
        _periodLockService = periodLockService;
        _historyService = historyService;
        _logger = logger;
    }

    /// <summary>
    /// Previews the year-end closing entries and net income/loss before committing.
    /// </summary>
    [HttpGet("preview")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> PreviewYearEndClosing([FromQuery] int fiscalYear)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        if (fiscalYear < 2000 || fiscalYear > 2100)
            return BadRequest("Invalid fiscal year");

        var company = await _context.Companies.FindAsync(companyId);
        var startMonth = company?.FiscalYearStartMonth ?? 1;
        var startDate = new DateOnly(fiscalYear, startMonth, 1);
        var endDate = startDate.AddMonths(12).AddDays(-1);

        // Check if closing journal already exists
        var existingCloseRef = $"CLOSE-{fiscalYear}";
        var existingClose = await _context.JournalEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.ReferenceNumber == existingCloseRef && j.Status == JournalEntryStatus.Posted);

        var preview = await ComputeClosingLinesAsync(companyId, startDate, endDate, fiscalYear, null);
        preview.IsAlreadyClosed = existingClose != null;
        preview.ExistingClosingJournalId = existingClose?.Id;
        preview.CurrentLockDate = company?.LockDate;
        preview.IsPeriodLocked = company?.LockDate.HasValue == true && company.LockDate.Value >= endDate;

        return Ok(preview);
    }

    /// <summary>
    /// Executes the formal Year-End Closing: transfers nominal balances (Revenue & Expenses)
    /// into Retained Earnings (3-2000) and locks the fiscal period.
    /// </summary>
    [HttpPost("year-end")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> ExecuteYearEndClosing([FromBody] YearEndCloseRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        if (request.FiscalYear < 2000 || request.FiscalYear > 2100)
            return BadRequest("Invalid fiscal year");

        var company = await _context.Companies.FindAsync(companyId);
        var startMonth = company?.FiscalYearStartMonth ?? 1;
        var startDate = new DateOnly(request.FiscalYear, startMonth, 1);
        var endDate = startDate.AddMonths(12).AddDays(-1);
        var closingDate = request.ClosingDate ?? endDate;

        // Check if closing already executed
        var closeRef = $"CLOSE-{request.FiscalYear}";
        var existing = await _context.JournalEntries
            .FirstOrDefaultAsync(j => j.ReferenceNumber == closeRef && j.Status == JournalEntryStatus.Posted);

        if (existing != null)
        {
            return BadRequest(new
            {
                code = "YEAR_ALREADY_CLOSED",
                message = $"Fiscal year {request.FiscalYear} has already been closed by Journal Entry {existing.ReferenceNumber} (ID: {existing.Id}). Void the previous closing journal before re-closing."
            });
        }

        // Compute closing lines
        var closingData = await ComputeClosingLinesAsync(companyId, startDate, endDate, request.FiscalYear, request.RetainedEarningsAccountId);
        if (closingData.Lines.Count == 0)
        {
            return BadRequest(new
            {
                code = "NO_NOMINAL_ACTIVITY",
                message = $"No posted nominal transactions found for fiscal year {request.FiscalYear}. Year-end closing is not needed."
            });
        }

        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var userId = GetCurrentUserId();
            var userEmail = GetCurrentUserEmail();
            var userName = GetCurrentUserName();

            var closingJournal = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Date = closingDate,
                ReferenceNumber = closeRef,
                Tags = "YearEndClosing,System",
                Currency = company?.Currency ?? "IDR",
                Notes = string.IsNullOrWhiteSpace(request.Notes)
                    ? $"Year-End Nominal Closing for FY {request.FiscalYear} into Retained Earnings. Net Income: Rp {closingData.NetIncome:N2}"
                    : request.Notes,
                IsAdjustingEntry = true,
                Status = JournalEntryStatus.Posted,
                CreatedByUserId = userId,
                CreatedBy = userEmail,
                ApprovedAt = DateTime.UtcNow,
                ApprovedByUserId = userId,
                ApprovedBy = userEmail,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            foreach (var line in closingData.Lines)
            {
                closingJournal.Lines.Add(new JournalLine
                {
                    Id = Guid.NewGuid(),
                    JournalEntryId = closingJournal.Id,
                    AccountId = line.AccountId,
                    Description = line.Description,
                    Debit = line.Debit,
                    Credit = line.Credit
                });
            }

            // Ensure exact balanced ledger
            var totalDr = closingJournal.Lines.Sum(l => l.Debit);
            var totalCr = closingJournal.Lines.Sum(l => l.Credit);
            if (totalDr != totalCr)
            {
                var diff = Math.Abs(totalDr - totalCr);
                return BadRequest(new
                {
                    code = "CLOSING_UNBALANCED",
                    message = $"Closing entry is unbalanced by {diff:N4}. Debits={totalDr:N4}, Credits={totalCr:N4}."
                });
            }

            _context.JournalEntries.Add(closingJournal);
            await _context.SaveChangesAsync();

            // Lock Period if requested
            if (request.LockPeriod)
            {
                await _periodLockService.LockPeriod(companyId, closingDate);
            }

            await tx.CommitAsync();

            await _historyService.RecordEventAsync(
                companyId,
                "YearEndClose",
                closingJournal.Id,
                "Executed",
                userId ?? Guid.Empty,
                userName,
                $"Year-End closing completed for FY {request.FiscalYear}. Net Income: Rp {closingData.NetIncome:N2}. Journal {closeRef}. Period locked until {closingDate:yyyy-MM-dd}.");

            return Ok(new
            {
                message = $"Fiscal year {request.FiscalYear} successfully closed.",
                journalEntryId = closingJournal.Id,
                referenceNumber = closingJournal.ReferenceNumber,
                closingDate = closingDate,
                totalRevenue = closingData.TotalRevenue,
                totalExpenses = closingData.TotalExpenses,
                netIncome = closingData.NetIncome,
                linesCount = closingJournal.Lines.Count,
                periodLockedUntil = request.LockPeriod ? closingDate : company?.LockDate
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to execute year-end closing for company {CompanyId}, year {Year}", companyId, request.FiscalYear);
            return StatusCode(500, new { error = "Year-end closing execution failed", detail = ex.Message });
        }
    }

    /// <summary>
    /// Gets closing history and current lock status.
    /// </summary>
    [HttpGet("history")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> GetClosingHistory()
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        var company = await _context.Companies.FindAsync(companyId);

        var rawEntries = await _context.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .Where(j => j.ReferenceNumber != null && j.ReferenceNumber.StartsWith("CLOSE-"))
            .OrderByDescending(j => j.Date)
            .ToListAsync();

        var closingEntries = rawEntries.Select(j => new
        {
            j.Id,
            j.ReferenceNumber,
            j.Date,
            j.Status,
            j.Notes,
            TotalDebit = j.Lines.Sum(l => l.Debit),
            TotalCredit = j.Lines.Sum(l => l.Credit),
            j.ApprovedBy,
            j.ApprovedAt,
            j.CreatedAt
        }).ToList();

        return Ok(new
        {
            currentLockDate = company?.LockDate,
            isLocked = company?.LockDate.HasValue == true,
            closingEntries
        });
    }

    /// <summary>
    /// Explicitly sets the accounting period lock date.
    /// </summary>
    [HttpPost("lock")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> SetPeriodLock([FromBody] PeriodLockRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        await _periodLockService.LockPeriod(companyId, request.LockDate);

        var userId = GetCurrentUserId();
        var userName = GetCurrentUserName();

        await _historyService.RecordEventAsync(
            companyId,
            "PeriodLock",
            companyId,
            "Locked",
            userId ?? Guid.Empty,
            userName,
            $"Period locked up to {request.LockDate:yyyy-MM-dd}");

        return Ok(new
        {
            message = $"Period locked successfully up to {request.LockDate:yyyy-MM-dd}.",
            lockDate = request.LockDate
        });
    }

    /// <summary>
    /// Removes or unlocks the period lock.
    /// </summary>
    [HttpPost("unlock")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> UnlockPeriod()
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;
        await _periodLockService.UnlockPeriod(companyId);

        var userId = GetCurrentUserId();
        var userName = GetCurrentUserName();

        await _historyService.RecordEventAsync(
            companyId,
            "PeriodLock",
            companyId,
            "Unlocked",
            userId ?? Guid.Empty,
            userName,
            "Period lock removed");

        return Ok(new
        {
            message = "Period lock removed successfully.",
            lockDate = (DateOnly?)null
        });
    }

    // ────────────────────────────────────────────────────────────────────
    // COMPUTATION ENGINE
    // ────────────────────────────────────────────────────────────────────

    private async Task<ClosingCalculationResult> ComputeClosingLinesAsync(
        Guid companyId,
        DateOnly startDate,
        DateOnly endDate,
        int fiscalYear,
        string? customRetainedEarningsAccount)
    {
        // 1. Fetch all nominal accounts (Revenue 4xxx, COGS 5xxx, Expenses 6xxx, Other Income 7xxx, Other Expense 8xxx, Tax 9xxx)
        var nominalAccounts = await _context.Accounts
            .Where(a => a.Code.StartsWith("4") || a.Code.StartsWith("5") ||
                        a.Code.StartsWith("6") || a.Code.StartsWith("7") ||
                        a.Code.StartsWith("8") || a.Code.StartsWith("9"))
            .ToListAsync();

        var accountDict = nominalAccounts.ToDictionary(a => a.Code, a => a);

        // 2. Resolve Retained Earnings Account (Default 3-2000)
        var targetReCode = customRetainedEarningsAccount ?? "3-2000";
        var reAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == targetReCode)
            ?? await _context.Accounts
                .FirstOrDefaultAsync(a => a.AccountGroup == "Equity" &&
                    (a.Name.Contains("Retained") || a.Name.Contains("Laba Ditahan") || a.Code.StartsWith("3-2")))
            ?? new Account { Code = "3-2000", Name = "Laba Ditahan / Retained Earnings" };

        // 3. Fetch all posted journal entries in the period (excluding existing CLOSE- entries)
        var postedEntryIds = await _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.Date >= startDate &&
                        j.Date <= endDate &&
                        j.Status == JournalEntryStatus.Posted &&
                        (j.ReferenceNumber == null || !j.ReferenceNumber.StartsWith("CLOSE-")))
            .Select(j => j.Id)
            .ToListAsync();

        var journalLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => postedEntryIds.Contains(l.JournalEntryId))
            .ToListAsync();

        // 4. Group by account code
        var activityMap = journalLines
            .GroupBy(l => l.AccountId)
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    TotalDebit = g.Sum(l => l.Debit),
                    TotalCredit = g.Sum(l => l.Credit)
                });

        var result = new ClosingCalculationResult
        {
            FiscalYear = fiscalYear,
            StartDate = startDate,
            EndDate = endDate,
            ClosingDate = endDate,
            RetainedEarningsAccountId = reAccount.Code,
            RetainedEarningsAccountName = reAccount.Name
        };

        decimal totalRevenue = 0;
        decimal totalExpenses = 0;

        foreach (var acc in nominalAccounts)
        {
            if (!activityMap.TryGetValue(acc.Code, out var act))
                continue;

            var netCredit = act.TotalCredit - act.TotalDebit; // Positive means Credit balance
            var netDebit = act.TotalDebit - act.TotalCredit;  // Positive means Debit balance

            if (netCredit == 0 && netDebit == 0)
                continue;

            // Classify Revenue vs Expense
            bool isIncomeClass = acc.Code.StartsWith("4") || acc.Code.StartsWith("7");

            if (isIncomeClass)
            {
                totalRevenue += netCredit;

                if (netCredit > 0)
                {
                    // To close a credit balance, we DEBIT the revenue account
                    result.Lines.Add(new ClosingLineDto
                    {
                        AccountId = acc.Code,
                        AccountName = acc.Name,
                        CurrentBalance = netCredit,
                        Debit = netCredit,
                        Credit = 0,
                        Description = $"Close {acc.Name} ({acc.Code}) FY {fiscalYear}"
                    });
                }
                else if (netCredit < 0)
                {
                    // Negative credit = debit balance (e.g. Sales Discount/Returns), close by CREDIT
                    result.Lines.Add(new ClosingLineDto
                    {
                        AccountId = acc.Code,
                        AccountName = acc.Name,
                        CurrentBalance = netCredit,
                        Debit = 0,
                        Credit = Math.Abs(netCredit),
                        Description = $"Close {acc.Name} ({acc.Code}) FY {fiscalYear}"
                    });
                }
            }
            else // Expense class (5, 6, 8, 9)
            {
                totalExpenses += netDebit;

                if (netDebit > 0)
                {
                    // To close a debit balance, we CREDIT the expense account
                    result.Lines.Add(new ClosingLineDto
                    {
                        AccountId = acc.Code,
                        AccountName = acc.Name,
                        CurrentBalance = netDebit,
                        Debit = 0,
                        Credit = netDebit,
                        Description = $"Close {acc.Name} ({acc.Code}) FY {fiscalYear}"
                    });
                }
                else if (netDebit < 0)
                {
                    // Negative debit = credit balance (e.g. Purchase Discount / Rebate), close by DEBIT
                    result.Lines.Add(new ClosingLineDto
                    {
                        AccountId = acc.Code,
                        AccountName = acc.Name,
                        CurrentBalance = netDebit,
                        Debit = Math.Abs(netDebit),
                        Credit = 0,
                        Description = $"Close {acc.Name} ({acc.Code}) FY {fiscalYear}"
                    });
                }
            }
        }

        var netIncome = totalRevenue - totalExpenses;
        result.TotalRevenue = totalRevenue;
        result.TotalExpenses = totalExpenses;
        result.NetIncome = netIncome;

        // 5. Add balancing line to Retained Earnings (3-2000)
        if (netIncome > 0)
        {
            // Profit: Credit Retained Earnings
            result.Lines.Add(new ClosingLineDto
            {
                AccountId = reAccount.Code,
                AccountName = reAccount.Name,
                CurrentBalance = 0,
                Debit = 0,
                Credit = netIncome,
                Description = $"Transfer Net Profit FY {fiscalYear} to {reAccount.Name}"
            });
        }
        else if (netIncome < 0)
        {
            // Loss: Debit Retained Earnings
            var absLoss = Math.Abs(netIncome);
            result.Lines.Add(new ClosingLineDto
            {
                AccountId = reAccount.Code,
                AccountName = reAccount.Name,
                CurrentBalance = 0,
                Debit = absLoss,
                Credit = 0,
                Description = $"Transfer Net Loss FY {fiscalYear} to {reAccount.Name}"
            });
        }

        return result;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value
                 ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string? GetCurrentUserEmail() =>
        User.FindFirst("email")?.Value
     ?? User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
     ?? User.Identity?.Name;

    private string GetCurrentUserName() =>
        User.FindFirst("name")?.Value
     ?? GetCurrentUserEmail()
     ?? "System";
}

public class YearEndCloseRequest
{
    public int FiscalYear { get; set; }
    public DateOnly? ClosingDate { get; set; }
    public string? RetainedEarningsAccountId { get; set; }
    public string? Notes { get; set; }
    public bool LockPeriod { get; set; } = true;
}

public class PeriodLockRequest
{
    public DateOnly LockDate { get; set; }
}

public class ClosingCalculationResult
{
    public int FiscalYear { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public DateOnly ClosingDate { get; set; }
    public bool IsAlreadyClosed { get; set; }
    public Guid? ExistingClosingJournalId { get; set; }
    public DateOnly? CurrentLockDate { get; set; }
    public bool IsPeriodLocked { get; set; }
    public string RetainedEarningsAccountId { get; set; } = string.Empty;
    public string RetainedEarningsAccountName { get; set; } = string.Empty;
    public decimal TotalRevenue { get; set; }
    public decimal TotalExpenses { get; set; }
    public decimal NetIncome { get; set; }
    public List<ClosingLineDto> Lines { get; set; } = new();
}

public class ClosingLineDto
{
    public string AccountId { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public decimal CurrentBalance { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string Description { get; set; } = string.Empty;
}
