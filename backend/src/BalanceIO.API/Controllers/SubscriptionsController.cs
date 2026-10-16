using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
public class SubscriptionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SubscriptionsController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// Get current user's company subscription
    /// </summary>
    [HttpGet("current/{companyId}")]
    public async Task<ActionResult<object>> GetCurrentSubscription(Guid companyId)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.Plan)
            .Where(s => s.CompanyId == companyId && s.Status == SubscriptionStatus.Active)
            .Select(s => new
            {
                s.Id,
                s.CompanyId,
                Plan = new
                {
                    s.Plan!.Id,
                    s.Plan.Name,
                    s.Plan.PriceMonthly,
                    s.Plan.PriceYearly,
                    s.Plan.Features,
                    s.Plan.MaxUsers,
                    s.Plan.MaxCompanies
                },
                s.Status,
                s.StartDate,
                s.EndDate,
                s.BillingCycle,
                s.AutoRenew
            })
            .FirstOrDefaultAsync();

        if (subscription == null)
        {
            // Create free plan subscription if none exists
            var freePlan = await _context.Plans.FirstOrDefaultAsync(p => p.Name == "Free" && p.IsActive);
            if (freePlan != null)
            {
                var newSub = new Subscription
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    PlanId = freePlan.Id,
                    Status = SubscriptionStatus.Active,
                    StartDate = DateTime.UtcNow,
                    EndDate = DateTime.UtcNow.AddYears(99), // Free = unlimited
                    BillingCycle = BillingCycle.Monthly,
                    AutoRenew = false
                };
                _context.Subscriptions.Add(newSub);
                await _context.SaveChangesAsync();

                return await GetCurrentSubscription(companyId);
            }
            return NotFound(new { message = "No subscription found and no free plan available" });
        }

        return Ok(subscription);
    }

    /// <summary>
    /// Check if company can add more users based on subscription
    /// </summary>
    [HttpGet("check-limits/{companyId}")]
    public async Task<ActionResult<object>> CheckLimits(Guid companyId)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Status == SubscriptionStatus.Active);

        if (subscription?.Plan == null)
        {
            return Ok(new { canAddUsers = true, canAddCompanies = true, maxUsers = 1, maxCompanies = 1 });
        }

        var currentUserCount = await _context.UserCompanies.CountAsync(uc => uc.CompanyId == companyId);

        return Ok(new
        {
            canAddUsers = currentUserCount < subscription.Plan.MaxUsers,
            currentUsers = currentUserCount,
            maxUsers = subscription.Plan.MaxUsers,
            planName = subscription.Plan.Name
        });
    }

    /// <summary>
    /// Request subscription upgrade (placeholder for Midtrans)
    /// </summary>
    [HttpPost("upgrade")]
    public async Task<ActionResult<object>> UpgradeSubscription([FromBody] UpgradeRequest request)
    {
        var company = await _context.Companies.FindAsync(request.CompanyId);
        if (company == null) return NotFound(new { message = "Company not found" });

        var newPlan = await _context.Plans.FindAsync(request.PlanId);
        if (newPlan == null) return NotFound(new { message = "Plan not found" });

        var currentSub = await _context.Subscriptions
            .FirstOrDefaultAsync(s => s.CompanyId == request.CompanyId && s.Status == SubscriptionStatus.Active);

        // For now, just create payment record and return "pending"
        // When Midtrans is integrated, this will redirect to payment page
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            SubscriptionId = currentSub?.Id ?? Guid.Empty,
            Amount = request.BillingCycle == "yearly" ? newPlan.PriceYearly : newPlan.PriceMonthly,
            Currency = "IDR",
            Status = PaymentStatus.Pending,
            Description = $"Upgrade to {newPlan.Name} ({request.BillingCycle})"
        };

        // TODO: When Midtrans integrated:
        // 1. Create Midtrans Snap transaction
        // 2. Return snap token/redirect URL
        // 3. Wait for webhook to confirm payment
        // 4. On success, update subscription to new plan

        return Ok(new
        {
            message = "Payment feature coming soon! Midtrans integration pending.",
            paymentId = payment.Id,
            amount = payment.Amount,
            planName = newPlan.Name,
            status = "pending_integration"
        });
    }

    /// <summary>
    /// Get payment history for a company
    /// </summary>
    [HttpGet("payments/{companyId}")]
    public async Task<ActionResult<IEnumerable<object>>> GetPaymentHistory(Guid companyId)
    {
        var payments = await _context.Payments
            .Include(p => p.Subscription)
            .Where(p => p.Subscription != null && p.Subscription.CompanyId == companyId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.Amount,
                p.Currency,
                p.Status,
                p.PaymentMethod,
                p.InvoiceNumber,
                p.Description,
                p.CreatedAt,
                p.PaidAt
            })
            .ToListAsync();

        return Ok(payments);
    }
}

public class UpgradeRequest
{
    public Guid CompanyId { get; set; }
    public Guid PlanId { get; set; }
    public string BillingCycle { get; set; } = "monthly"; // "monthly" or "yearly"
}
