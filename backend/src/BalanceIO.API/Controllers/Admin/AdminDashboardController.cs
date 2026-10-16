using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

/// <summary>
/// Admin Dashboard - System-wide analytics and stats
/// Requires Superadmin role
/// </summary>
[ApiController]
[Authorize(Roles = "SuperAdmin")]
[Route("api/admin/dashboard")]
public class AdminDashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public AdminDashboardController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get system-wide statistics
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetDashboardStats()
    {
        // TODO: Add Superadmin role check middleware

        var totalUsers = await _context.Users.CountAsync();
        var totalCompanies = await _context.Companies.CountAsync();
        var totalSubscriptions = await _context.Subscriptions.CountAsync();
        var activeSubscriptions = await _context.Subscriptions
            .CountAsync(s => s.Status == SubscriptionStatus.Active);

        var subscriptionsByPlan = await _context.Subscriptions
            .Include(s => s.Plan)
            .Where(s => s.Status == SubscriptionStatus.Active)
            .GroupBy(s => s.Plan!.Name)
            .Select(g => new { Plan = g.Key, Count = g.Count() })
            .ToListAsync();

        var recentPayments = await _context.Payments
            .OrderByDescending(p => p.CreatedAt)
            .Take(10)
            .Select(p => new
            {
                p.Id,
                p.Amount,
                p.Status,
                p.CreatedAt,
                p.PaidAt
            })
            .ToListAsync();

        // SUM over a decimal is summed in memory rather than in SQL.
        //
        // SQLite has no decimal type: EF stores money as TEXT to keep it
        // exact, and refuses to translate SUM or ORDER BY over it because
        // adding text is not addition. The alternative EF suggests - a
        // floating point column - is the one thing this codebase will not
        // do with money.
        //
        // The rows are read and added here instead. Payment volume is the
        // count of successful subscription charges, not a transaction
        // ledger, so this stays small; if it ever does not, the fix is a
        // stored monthly total rather than a float.
        var now = DateTime.UtcNow;

        var successfulPayments = await _context.Payments
            .Where(p => p.Status == PaymentStatus.Success)
            .Select(p => new { p.Amount, p.PaidAt })
            .ToListAsync();

        var totalRevenue = successfulPayments.Sum(p => p.Amount);

        var monthlyRevenue = successfulPayments
            .Where(p => p.PaidAt.HasValue
                     && p.PaidAt.Value.Month == now.Month
                     && p.PaidAt.Value.Year == now.Year)
            .Sum(p => p.Amount);

        return Ok(new
        {
            overview = new
            {
                totalUsers,
                totalCompanies,
                totalSubscriptions,
                activeSubscriptions
            },
            revenue = new
            {
                total = totalRevenue,
                thisMonth = monthlyRevenue,
                currency = "IDR"
            },
            subscriptionsByPlan,
            recentPayments
        });
    }

    /// <summary>
    /// Get growth metrics
    /// </summary>
    [HttpGet("growth")]
    public async Task<ActionResult<object>> GetGrowthMetrics()
    {
        var today = DateTime.UtcNow.Date;
        var lastMonth = today.AddMonths(-1);
        var lastWeek = today.AddDays(-7);

        var newUsersThisMonth = await _context.Users
            .CountAsync();

        var newCompaniesThisMonth = await _context.Companies
            .CountAsync(c => c.CreatedAt >= lastMonth);

        return Ok(new
        {
            newUsersThisMonth,
            newCompaniesThisMonth,
            period = "last_30_days"
        });
    }
}
