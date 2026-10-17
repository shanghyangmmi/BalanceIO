using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ExpensesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly AuditService _auditService;

    public ExpensesController(ApplicationDbContext context, IPeriodLockService periodLockService, AuditService auditService)
    {
        _context = context;
        _periodLockService = periodLockService;
        _auditService = auditService;
    }

    // GET: api/expenses
    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<object>>> GetAll(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string? accountId = null)
    {
        // Get all expense accounts (5xxx and 6xxx codes)
        var expenseAccounts = await _context.Accounts
            .Where(a => a.Code.StartsWith("5") || a.Code.StartsWith("6"))
            .Select(a => a.Code)
            .ToListAsync();

        // Get journal entries with lines
        var query = _context.JournalEntries
            .Include(j => j.Lines)
            .Where(j => j.Status == JournalEntryStatus.Posted)
            .AsQueryable();

        if (startDate.HasValue)
        {
            var start = DateOnly.FromDateTime(startDate.Value);
            query = query.Where(j => j.Date >= start);
        }

        if (endDate.HasValue)
        {
            var end = DateOnly.FromDateTime(endDate.Value);
            query = query.Where(j => j.Date <= end);
        }

        var entries = await query
            .OrderByDescending(j => j.Date)
            .ToListAsync();

        // Filter to entries with expense account lines
        var accountsDict = await _context.Accounts.ToDictionaryAsync(a => a.Code, a => a.Name);

        var expenseEntries = entries
            .Where(j => j.Lines.Any(l => expenseAccounts.Contains(l.AccountId) && l.Debit > 0))
            .Select(j => new
            {
                j.Id,
                j.ReferenceNumber,
                j.Date,
                Description = j.Notes ?? "Expense Entry",
                Accounts = j.Lines
                    .Where(l => l.Debit > 0 && expenseAccounts.Contains(l.AccountId))
                    .Select(l => new { 
                        Code = l.AccountId, 
                        Name = accountsDict.TryGetValue(l.AccountId, out var name) ? name : l.AccountId 
                    })
                    .Distinct()
                    .ToList(),
                Amount = j.Lines.Where(l => expenseAccounts.Contains(l.AccountId)).Sum(l => l.Debit),
                j.Status
            })
            .ToList();

        if (!string.IsNullOrEmpty(accountId))
        {
            expenseEntries = expenseEntries
                .Where(e => e.Accounts.Any(a => a.Code == accountId))
                .ToList();
        }

        return Ok(expenseEntries);
    }

    // GET: api/expenses/summary
    [HttpGet("summary")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<object>> GetSummary(
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;
        var targetMonth = month ?? DateTime.UtcNow.Month;

        var startDate = new DateOnly(targetYear, targetMonth, 1);
        var endDate = startDate.AddMonths(1).AddDays(-1);

        // Get expense accounts
        var expenseAccounts = await _context.Accounts
            .Where(a => a.Code.StartsWith("5") || a.Code.StartsWith("6"))
            .ToDictionaryAsync(a => a.Code, a => a.Name);

        var entries = await _context.JournalEntries
            .Include(j => j.Lines)
            .Where(j => j.Status == JournalEntryStatus.Posted)
            .Where(j => j.Date >= startDate && j.Date <= endDate)
            .ToListAsync();

        // Group by expense account
        var expensesByCategory = entries
            .SelectMany(j => j.Lines)
            .Where(l => expenseAccounts.ContainsKey(l.AccountId) && l.Debit > 0)
            .GroupBy(l => l.AccountId)
            .Select(g => new
            {
                AccountCode = g.Key,
                AccountName = expenseAccounts.TryGetValue(g.Key, out var name) ? name : g.Key,
                Total = g.Sum(l => l.Debit)
            })
            .OrderByDescending(x => x.Total)
            .ToList();

        var totalExpenses = expensesByCategory.Sum(x => x.Total);

        return Ok(new
        {
            Period = $"{targetYear}-{targetMonth:D2}",
            TotalExpenses = totalExpenses,
            Categories = expensesByCategory
        });
    }

    // GET: api/expenses/by-period
    [HttpGet("by-period")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<object>>> GetByPeriod([FromQuery] int months = 6)
    {
        var periods = new List<object>();
        var now = DateTime.UtcNow;

        // Get expense accounts
        var expenseAccountCodes = await _context.Accounts
            .Where(a => a.Code.StartsWith("5") || a.Code.StartsWith("6"))
            .Select(a => a.Code)
            .ToListAsync();

        for (int i = 0; i < months; i++)
        {
            var date = now.AddMonths(-i);
            var startDate = new DateOnly(date.Year, date.Month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            var entries = await _context.JournalEntries
                .Include(j => j.Lines)
                .Where(j => j.Status == JournalEntryStatus.Posted)
                .Where(j => j.Date >= startDate && j.Date <= endDate)
                .ToListAsync();

            var total = entries
                .SelectMany(j => j.Lines)
                .Where(l => expenseAccountCodes.Contains(l.AccountId) && l.Debit > 0)
                .Sum(l => l.Debit);

            periods.Add(new
            {
                Period = $"{date.Year}-{date.Month:D2}",
                Month = date.ToString("MMM yyyy"),
                Total = total
            });
        }

        return Ok(periods.OrderBy(p => ((dynamic)p).Period));
    }

    // POST: api/expenses (Quick expense entry)
    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<JournalEntry>> CreateQuickExpense([FromBody] QuickExpenseDto dto)
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        // Validate Period Lock
        await _periodLockService.ValidateTransactionDate(_context.CurrentCompanyId.Value, dto.Date);

        // Validate expense account
        var expenseAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.Code == dto.ExpenseAccountCode);
        if (expenseAccount == null)
            return BadRequest("Invalid expense account");

        // Validate payment account (bank/cash)
        var paymentAccount = await _context.Accounts.FirstOrDefaultAsync(a => a.Code == dto.PaymentAccountCode);
        if (paymentAccount == null)
            return BadRequest("Invalid payment account");

        // Get logged in user id
        var sub = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                  ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        Guid? userId = Guid.TryParse(sub, out var guid) ? guid : null;

        // Create journal entry
        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = _context.CurrentCompanyId.Value,
            ReferenceNumber = await GenerateReferenceNumber(),
            Date = dto.Date,
            Notes = dto.Description,
            Status = JournalEntryStatus.Posted,
            CreatedAt = DateTime.UtcNow,
            ProjectId = dto.ProjectId,
            Lines = new List<JournalLine>
            {
                new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = dto.ExpenseAccountCode,
                    Description = dto.Description,
                    Debit = dto.Amount,
                    Credit = 0
                },
                new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = dto.PaymentAccountCode,
                    Description = dto.Description,
                    Debit = 0,
                    Credit = dto.Amount
                }
            }
        };

        _context.JournalEntries.Add(entry);
        await _context.SaveChangesAsync();

        // Audit log using unified service
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var ua = Request.Headers["User-Agent"].ToString();
        await _auditService.LogAsync(userId, "CREATE_EXPENSE", "JournalEntry:" + entry.Id, $"Quick expense: {dto.Description} - {dto.Amount:N2}", ip, ua);

        return CreatedAtAction("GetAll", new { id = entry.Id }, entry);
    }

    private async Task<string> GenerateReferenceNumber()
    {
        var year = DateTime.UtcNow.Year;
        var month = DateTime.UtcNow.Month;
        var prefix = $"EXP-{year}{month:D2}";
        
        var count = await _context.JournalEntries
            .CountAsync(j => j.ReferenceNumber != null && j.ReferenceNumber.StartsWith(prefix));
        
        return $"{prefix}-{(count + 1).ToString().PadLeft(4, '0')}";
    }
}

public class QuickExpenseDto
{
    public DateOnly Date { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string ExpenseAccountCode { get; set; } = string.Empty; // Account code like "5101"
    public string PaymentAccountCode { get; set; } = string.Empty; // Account code like "1101" (Cash)
    public Guid? ProjectId { get; set; }
}
