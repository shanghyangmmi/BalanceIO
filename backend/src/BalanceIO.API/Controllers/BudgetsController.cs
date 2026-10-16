using System.Security.Claims;
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
[Route("api/[controller]")]
[Authorize]
public class BudgetsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly BudgetingService _budgetingService;
    private readonly AuditService _auditService;

    public BudgetsController(
        ApplicationDbContext context,
        BudgetingService budgetingService,
        AuditService auditService)
    {
        _context = context;
        _budgetingService = budgetingService;
        _auditService = auditService;
    }

    private Guid? GetCurrentCompanyId()
    {
        return _context.CurrentCompanyId;
    }

    private Guid? GetCurrentUserId()
    {
        var claim = User.FindFirst("id")?.Value 
                 ?? User.FindFirst("sub")?.Value 
                 ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    private string GetCurrentUserEmail()
    {
        return User.FindFirst(ClaimTypes.Email)?.Value 
            ?? User.FindFirst("email")?.Value 
            ?? User.Identity?.Name 
            ?? "accountant@balanceio.id";
    }

    /// <summary>
    /// List all budgets for current company
    /// </summary>
    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<List<BudgetSummaryDto>>> GetAll([FromQuery] int? fiscalYear = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        var query = _context.Budgets
            .Include(b => b.Project)
            .Include(b => b.Lines)
            .Where(b => b.CompanyId == companyId.Value);

        if (fiscalYear.HasValue)
        {
            query = query.Where(b => b.FiscalYear == fiscalYear.Value);
        }

        var list = await query
            .OrderByDescending(b => b.FiscalYear)
            .ThenByDescending(b => b.CreatedAt)
            .Select(b => new BudgetSummaryDto
            {
                Id = b.Id,
                Name = b.Name,
                FiscalYear = b.FiscalYear,
                PeriodType = b.PeriodType.ToString(),
                Status = b.Status.ToString(),
                ProjectId = b.ProjectId,
                ProjectName = b.Project != null ? b.Project.Name : null,
                TotalBudgetAmount = b.TotalBudgetAmount,
                CreatedBy = b.CreatedBy,
                CreatedAt = b.CreatedAt,
                ApprovedBy = b.ApprovedBy,
                ApprovedAt = b.ApprovedAt,
                TotalAllocatedAccounts = b.Lines.Select(l => l.AccountId).Distinct().Count()
            })
            .ToListAsync();

        return Ok(list);
    }

    /// <summary>
    /// Get single budget by ID with lines
    /// </summary>
    [HttpGet("{id}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<Budget>> GetById(Guid id)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        var budget = await _context.Budgets
            .Include(b => b.Project)
            .Include(b => b.Lines)
                .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId.Value);

        if (budget == null) return NotFound();

        return Ok(budget);
    }

    /// <summary>
    /// Create new corporate budget
    /// </summary>
    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<Budget>> Create([FromBody] CreateBudgetDto dto)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("Nama anggaran / RKAP wajib diisi.");

        var budget = new Budget
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId.Value,
            Name = dto.Name.Trim(),
            FiscalYear = dto.FiscalYear,
            PeriodType = dto.PeriodType,
            Status = BudgetStatus.Draft,
            ProjectId = dto.ProjectId,
            Notes = dto.Notes,
            CreatedBy = GetCurrentUserEmail(),
            CreatedByUserId = GetCurrentUserId(),
            CreatedAt = DateTime.UtcNow
        };

        decimal total = 0;
        foreach (var lineDto in dto.Lines)
        {
            var line = new BudgetLine
            {
                Id = Guid.NewGuid(),
                BudgetId = budget.Id,
                AccountId = lineDto.AccountId,
                Month = lineDto.Month,
                Quarter = lineDto.Quarter ?? (((lineDto.Month - 1) / 3) + 1),
                Amount = lineDto.Amount,
                WarningThresholdPercentage = lineDto.WarningThresholdPercentage > 0 ? lineDto.WarningThresholdPercentage : 80m,
                CriticalThresholdPercentage = lineDto.CriticalThresholdPercentage > 0 ? lineDto.CriticalThresholdPercentage : 100m,
                Notes = lineDto.Notes
            };
            total += line.Amount;
            budget.Lines.Add(line);
        }

        budget.TotalBudgetAmount = total;

        _context.Budgets.Add(budget);
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(GetCurrentUserId() ?? Guid.Empty, "BUDGET_CREATED", budget.Id.ToString(), $"Created budget {budget.Name} for fiscal year {budget.FiscalYear}");

        return CreatedAtAction(nameof(GetById), new { id = budget.Id }, budget);
    }

    /// <summary>
    /// Update existing budget
    /// </summary>
    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBudgetDto dto)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        var budget = await _context.Budgets
            .Include(b => b.Lines)
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId.Value);

        if (budget == null) return NotFound();

        if (budget.Status == BudgetStatus.Closed)
            return BadRequest("Anggaran yang sudah ditutup tidak dapat diubah.");

        budget.Name = dto.Name.Trim();
        budget.FiscalYear = dto.FiscalYear;
        budget.PeriodType = dto.PeriodType;
        budget.ProjectId = dto.ProjectId;
        budget.Notes = dto.Notes;

        // Replace lines
        _context.BudgetLines.RemoveRange(budget.Lines);
        budget.Lines.Clear();

        decimal total = 0;
        foreach (var lineDto in dto.Lines)
        {
            var line = new BudgetLine
            {
                Id = Guid.NewGuid(),
                BudgetId = budget.Id,
                AccountId = lineDto.AccountId,
                Month = lineDto.Month,
                Quarter = lineDto.Quarter ?? (((lineDto.Month - 1) / 3) + 1),
                Amount = lineDto.Amount,
                WarningThresholdPercentage = lineDto.WarningThresholdPercentage > 0 ? lineDto.WarningThresholdPercentage : 80m,
                CriticalThresholdPercentage = lineDto.CriticalThresholdPercentage > 0 ? lineDto.CriticalThresholdPercentage : 100m,
                Notes = lineDto.Notes
            };
            total += line.Amount;
            budget.Lines.Add(line);
        }

        budget.TotalBudgetAmount = total;

        await _context.SaveChangesAsync();
        await _auditService.LogAsync(GetCurrentUserId() ?? Guid.Empty, "BUDGET_UPDATED", budget.Id.ToString(), $"Updated budget {budget.Name}");

        return Ok(budget);
    }

    /// <summary>
    /// Approve budget (authorizes allocations)
    /// </summary>
    [HttpPost("{id}/approve")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> Approve(Guid id)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        var budget = await _context.Budgets
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId.Value);

        if (budget == null) return NotFound();

        budget.Status = BudgetStatus.Approved;
        budget.ApprovedBy = GetCurrentUserEmail();
        budget.ApprovedByUserId = GetCurrentUserId();
        budget.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        await _auditService.LogAsync(GetCurrentUserId() ?? Guid.Empty, "BUDGET_APPROVED", budget.Id.ToString(), $"Approved budget {budget.Name}");

        return Ok(new { success = true, message = "Anggaran RKAP berhasil disetujui.", budget });
    }

    /// <summary>
    /// Delete draft budget
    /// </summary>
    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        var budget = await _context.Budgets
            .Include(b => b.Lines)
            .FirstOrDefaultAsync(b => b.Id == id && b.CompanyId == companyId.Value);

        if (budget == null) return NotFound();

        if (budget.Status == BudgetStatus.Approved)
            return BadRequest("Anggaran yang telah disetujui tidak dapat dihapus. Silakan tutup (close) anggaran.");

        _context.BudgetLines.RemoveRange(budget.Lines);
        _context.Budgets.Remove(budget);
        await _context.SaveChangesAsync();

        return Ok(new { success = true, message = "Anggaran berhasil dihapus." });
    }

    /// <summary>
    /// Generate real-time Actual vs Budget Variance Report
    /// </summary>
    [HttpGet("variance-report")]
    [RequiresPermission(Permissions.FinanceReport)]
    public async Task<ActionResult<BudgetVarianceReportDto>> GetVarianceReport(
        [FromQuery] int? fiscalYear = null,
        [FromQuery] int? month = null,
        [FromQuery] int? quarter = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? budgetId = null)
    {
        var companyId = GetCurrentCompanyId();
        if (!companyId.HasValue) return BadRequest("Company context is required.");

        int year = fiscalYear ?? DateTime.UtcNow.Year;
        var report = await _budgetingService.GetVarianceReportAsync(
            companyId.Value,
            year,
            month,
            quarter,
            projectId,
            budgetId);

        return Ok(report);
    }
}
