using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AccountsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IMemoryCache _cache;

    public AccountsController(ApplicationDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    // GET: api/accounts
    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<object>>> GetAccounts()
    {
        try
        {
            var companyId = _context.CurrentCompanyId;
            var cacheKey = $"accounts_list_{companyId}";
            
            if (!_cache.TryGetValue(cacheKey, out List<object>? accounts))
            {
                var rawAccounts = await _context.Accounts
                    .OrderBy(a => a.Code)
                    .Select(a => new {
                        a.Id,
                        a.Code,
                        a.Name,
                        a.Type,
                        a.AccountGroup,
                        a.Level,
                        a.IsHeader,
                        a.NormalBalance,
                        a.Description,
                        a.IsSystemDefault,
                        a.CurrentBalance,
                        a.ParentAccountId,
                        a.IsActive,
                        a.DimensionRule,
                        a.Psak118Category
                    })
                    .ToListAsync();
                
                accounts = rawAccounts.Cast<object>().ToList();

                var cacheOptions = new MemoryCacheEntryOptions()
                    .SetAbsoluteExpiration(TimeSpan.FromMinutes(5))
                    .SetSlidingExpiration(TimeSpan.FromSeconds(30));

                _cache.Set(cacheKey, accounts, cacheOptions);
            }

            return Ok(accounts);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to load accounts", detail = ex.Message });
        }
    }

    // GET: api/accounts/tree
    [HttpGet("tree")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult> GetAccountsTree()
    {
        try
        {
            var accounts = await _context.Accounts
                .OrderBy(a => a.Code)
                .Select(a => new {
                    a.Id,
                    a.Code,
                    a.Name,
                    a.Type,
                    a.AccountGroup,
                    a.Level,
                    a.IsHeader,
                    a.NormalBalance,
                    a.Description,
                    a.IsSystemDefault,
                    a.CurrentBalance,
                    a.ParentAccountId,
                    a.IsActive,
                    a.DimensionRule,
                    a.Psak118Category
                })
                .ToListAsync();

            // Group by AccountGroup for frontend tree rendering
            var grouped = accounts
                .GroupBy(a => a.AccountGroup)
                .Select(g => new
                {
                    Group = g.Key,
                    Accounts = g.OrderBy(a => a.Code).ToList()
                })
                .OrderBy(g => GetGroupOrder(g.Group))
                .ToList();

            return Ok(new { groups = grouped, total = accounts.Count });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to load accounts tree", detail = ex.Message });
        }
    }

    // POST: api/accounts/initialize — Seed default CoA for current company
    [HttpPost("initialize")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult> InitializeDefaultCoA()
    {
        try
        {
            if (!_context.CurrentCompanyId.HasValue)
                return BadRequest("Company context is required");

            var companyId = _context.CurrentCompanyId.Value;

            // Check if already has accounts
            var existingCount = await _context.Accounts.CountAsync();
            if (existingCount > 0)
                return BadRequest(new { error = "Company already has accounts. Cannot re-initialize.", existingCount });

            await DefaultCoASeeder.SeedDefaultCoA(_context, companyId);

            // Invalidate cache
            _cache.Remove($"accounts_list_{companyId}");

            var count = await _context.Accounts.CountAsync();
            return Ok(new { message = "Default Chart of Accounts initialized successfully", accountCount = count });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to initialize CoA", detail = ex.Message });
        }
    }

    // GET: api/accounts/{id}
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<Account>> GetById(Guid id)
    {
        var account = await _context.Accounts.FindAsync(id);
        if (account == null) return NotFound();
        return Ok(account);
    }

    // POST: api/accounts
    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<Account>> Create(Account account)
    {
        if (account.Id == Guid.Empty)
            account.Id = Guid.NewGuid();

        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        account.CompanyId = _context.CurrentCompanyId.Value;

        // Validate level
        if (account.Level < 1 || account.Level > 5)
            return BadRequest("Account level must be between 1 and 5");

        // Validate AccountGroup
        var validGroups = new[] { "Asset", "Liability", "Equity", "Sales", "CostOfSales", "Expense", "OtherIncomeExpense" };
        if (!validGroups.Contains(account.AccountGroup))
            return BadRequest($"Invalid account group. Must be one of: {string.Join(", ", validGroups)}");

        // If parent is specified, validate level
        if (account.ParentAccountId.HasValue)
        {
            var parent = await _context.Accounts.FindAsync(account.ParentAccountId.Value);
            if (parent == null)
                return BadRequest("Parent account not found");
            if (parent.Level >= 5)
                return BadRequest("Cannot create sub-account: maximum 5 levels reached");
            
            account.Level = parent.Level + 1;
            account.AccountGroup = parent.AccountGroup; // Inherit group from parent

            // Mark parent as header if not already
            if (!parent.IsHeader)
            {
                parent.IsHeader = true;
                parent.UpdatedAt = DateTime.UtcNow;
            }
        }

        // Auto-set NormalBalance based on group if not provided
        if (string.IsNullOrEmpty(account.NormalBalance))
        {
            account.NormalBalance = account.AccountGroup switch
            {
                "Asset" or "CostOfSales" or "Expense" => "Debit",
                _ => "Credit"
            };
        }

        if (account.Psak118Category == Psak118Category.Operating)
        {
            account.Psak118Category = Psak118CategoryHelper.GetDefaultCategory(account.Code, account.Name);
        }

        account.CreatedAt = DateTime.UtcNow;
        _context.Accounts.Add(account);
        await _context.SaveChangesAsync();

        _cache.Remove($"accounts_list_{_context.CurrentCompanyId}");

        return CreatedAtAction(nameof(GetById), new { id = account.Id }, account);
    }

    // PUT: api/accounts/{id}
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> Update(Guid id, Account account)
    {
        if (id != account.Id) return BadRequest("ID mismatch");

        var existing = await _context.Accounts.FindAsync(id);
        if (existing == null) return NotFound();

        // Journal lines reference the account by code. Changing the code of
        // an account in use would detach its history from every report.
        if (!string.Equals(existing.Code, account.Code, StringComparison.Ordinal)
            && await HasJournalLinesAsync(existing))
        {
            return BadRequest(new { code = "ACCOUNT_CODE_IN_USE", message = $"Account {existing.Code} has journal lines; its code cannot change." });
        }

        existing.Code = account.Code;
        existing.Name = account.Name;
        existing.Type = account.Type;
        existing.AccountGroup = account.AccountGroup;
        existing.Level = account.Level;
        existing.IsHeader = account.IsHeader;
        existing.NormalBalance = account.NormalBalance;
        existing.Description = account.Description;
        existing.NameId = string.IsNullOrWhiteSpace(account.NameId) ? null : account.NameId.Trim();
        existing.ParentAccountId = account.ParentAccountId;
        existing.IsActive = account.IsActive;
        existing.DimensionRule = account.DimensionRule;
        existing.Psak118Category = account.Psak118Category;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        _cache.Remove($"accounts_list_{_context.CurrentCompanyId}");
        
        return NoContent();
    }

    // DELETE: api/accounts/{id}
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var account = await _context.Accounts.FindAsync(id);
        if (account == null) return NotFound();

        // Lines reference the account by code; deleting it would leave them
        // pointing at nothing. Deactivate it instead.
        if (await HasJournalLinesAsync(account))
            return BadRequest(new { code = "ACCOUNT_IN_USE", message = $"Account {account.Code} has journal lines and cannot be deleted. Deactivate it instead." });

        // Check if account has children
        var hasChildren = await _context.Accounts.AnyAsync(a => a.ParentAccountId == id);
        if (hasChildren)
            return BadRequest("Cannot delete account with sub-accounts. Delete children first.");

        _context.Accounts.Remove(account);
        await _context.SaveChangesAsync();
        _cache.Remove($"accounts_list_{_context.CurrentCompanyId}");
        
        return NoContent();
    }

    private Task<bool> HasJournalLinesAsync(Account account) =>
        _context.JournalLines.AnyAsync(l => l.AccountId == account.Code
                                         && l.JournalEntry!.CompanyId == account.CompanyId);

    private static int GetGroupOrder(string group) => group switch
    {
        "Asset" => 1,
        "Liability" => 2,
        "Equity" => 3,
        "Sales" => 4,
        "CostOfSales" => 5,
        "Expense" => 6,
        "OtherIncomeExpense" => 7,
        _ => 99
    };
}
