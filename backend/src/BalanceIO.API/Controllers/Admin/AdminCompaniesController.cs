using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

/// <summary>
/// Admin Companies Management - View and manage all companies
/// Requires Superadmin role
/// </summary>
[ApiController]
[Route("api/admin/companies")]
[Authorize(Roles = "SuperAdmin")]
public class AdminCompaniesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminCompaniesController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get all companies in the system
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetAllCompanies(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var query = _context.Companies.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => c.Name.Contains(search));
        }

        var totalCount = await query.CountAsync();

        var companies = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.Industry,
                c.Currency,
                c.City,
                c.Country,
                c.IsOnboarded,
                c.CreatedAt,
                c.IsSuspended,
                c.SuspendedAt,
                c.SuspensionReason,
                JournalEntryCount = _context.JournalEntries
                    .IgnoreQueryFilters().Count(j => j.CompanyId == c.Id),
                UserCount = _context.UserCompanies.Count(uc => uc.CompanyId == c.Id),
                Subscription = _context.Subscriptions
                    .Where(s => s.CompanyId == c.Id && s.Status == SubscriptionStatus.Active)
                    .Select(s => new { s.Plan!.Name, s.EndDate })
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new
        {
            data = companies,
            pagination = new
            {
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            }
        });
    }

    /// <summary>
    /// Get company details with all related data
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<object>> GetCompanyDetails(Guid id)
    {
        var company = await _context.Companies.FindAsync(id);
        if (company == null) return NotFound();

        var users = await _context.UserCompanies
            .Include(uc => uc.User)
            .Where(uc => uc.CompanyId == id)
            .Select(uc => new
            {
                uc.UserId,
                Name = uc.User != null ? uc.User.Name : "N/A",
                Email = uc.User != null ? uc.User.Email : "N/A",
                uc.Role,
                uc.JoinedAt
            })
            .ToListAsync();

        var subscription = await _context.Subscriptions
            .Include(s => s.Plan)
            .Where(s => s.CompanyId == id && s.Status == SubscriptionStatus.Active)
            .FirstOrDefaultAsync();

        // This endpoint describes one company, so the count is that
        // company's - it was previously a platform-wide total, which the
        // disabled query filter made look correct. Admin screens read
        // across tenants explicitly.
        var transactionCount = await _context.JournalEntries
            .IgnoreQueryFilters()
            .CountAsync(j => j.CompanyId == id);

        return Ok(new
        {
            company,
            users,
            subscription = subscription != null ? new
            {
                subscription.Id,
                PlanName = subscription.Plan?.Name,
                subscription.Status,
                subscription.StartDate,
                subscription.EndDate,
                subscription.BillingCycle
            } : null,
            stats = new
            {
                transactionCount,
                userCount = users.Count
            }
        });
    }

    public record SuspensionRequest(string? Reason, bool CancelSubscription);

    /// <summary>
    /// Suspend a company.
    ///
    /// This used to cancel the subscription and nothing else, which meant
    /// the company stayed fully usable - every member could sign in and
    /// keep posting. It suspends the tenant now, checked per request, and
    /// cancelling the subscription is a separate decision: suspending for a
    /// support investigation should not end a contract that is paid up.
    /// </summary>
    [HttpPost("{id}/suspend")]
    public async Task<ActionResult> SuspendCompany(Guid id, [FromBody] SuspensionRequest? request)
    {
        var company = await _context.Companies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id);
        if (company == null) return NotFound();

        company.IsSuspended = true;
        company.SuspendedAt = DateTime.UtcNow;
        company.SuspensionReason = request?.Reason;

        if (request?.CancelSubscription == true)
        {
            var subscription = await _context.Subscriptions
                .FirstOrDefaultAsync(s => s.CompanyId == id && s.Status == SubscriptionStatus.Active);

            if (subscription != null)
            {
                subscription.Status = SubscriptionStatus.Cancelled;
                subscription.CancelledAt = DateTime.UtcNow;
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Company suspended.",
            subscriptionCancelled = request?.CancelSubscription == true,
            effectiveWithinSeconds = 30,
        });
    }

    [HttpPost("{id}/restore")]
    public async Task<ActionResult> RestoreCompany(Guid id)
    {
        var company = await _context.Companies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id);
        if (company == null) return NotFound();

        company.IsSuspended = false;
        company.SuspendedAt = null;
        company.SuspensionReason = null;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Company restored. Its subscription is unchanged." });
    }

    /// <summary>
    /// Delete a company permanently.
    ///
    /// The comment this replaces said "in production, you would want soft
    /// delete" and then hard-deleted anyway, on an unconfirmed DELETE, for a
    /// row that owns an entire set of books. Refused outright once anything
    /// has been posted: those journals are somebody's statutory records, and
    /// a tax audit can reach back years.
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteCompany(Guid id, [FromQuery] string? confirm)
    {
        var company = await _context.Companies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Id == id);
        if (company == null) return NotFound();

        if (confirm != company.Name)
            return BadRequest(new
            {
                error = "Pass the company's exact name as confirm to delete it. " +
                        "Suspending is almost always what you want instead.",
            });

        var journals = await _context.JournalEntries
            .IgnoreQueryFilters()
            .CountAsync(j => j.CompanyId == id);

        if (journals > 0)
            return Conflict(new
            {
                error = $"This company has {journals:N0} journal entries. Books that have been " +
                        "posted to are not deletable from here. Suspend it instead.",
                journals,
            });

        var userCompanies = await _context.UserCompanies
            .Where(uc => uc.CompanyId == id)
            .ToListAsync();

        _context.UserCompanies.RemoveRange(userCompanies);
        _context.Companies.Remove(company);

        await _context.SaveChangesAsync();

        return Ok(new { message = "Company deleted." });
    }
}
