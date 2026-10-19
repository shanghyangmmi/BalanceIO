using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
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
    private readonly BalanceIO.API.Services.Payments.PaymentService _payments;

    public SubscriptionsController(ApplicationDbContext context, BalanceIO.API.Services.Payments.PaymentService payments)
    {
        _context = context;
        _payments = payments;
    }

    /// <summary>
    /// Get current user's company subscription
    /// </summary>
    [HttpGet("current/{companyId}")]
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<ActionResult<object>> GetCurrentSubscription(Guid companyId)
    {
        if (companyId != _context.CurrentCompanyId) return Forbid();

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
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<ActionResult<object>> CheckLimits(Guid companyId)
    {
        if (companyId != _context.CurrentCompanyId) return Forbid();

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
    /// Starts paying for a plan through the configured gateway. The answer
    /// says what the payer does next: follow redirectUrl (hosted payment
    /// page), or read instructions (manual transfer). The plan activates
    /// when the payment is confirmed, not here.
    /// </summary>
    [HttpPost("upgrade")]
    [RequiresPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<object>> UpgradeSubscription([FromBody] UpgradeRequest request)
    {
        // The permission was checked for the company in scope; only that company may be changed.
        if (request.CompanyId != _context.CurrentCompanyId) return Forbid();

        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
        var checkout = await _payments.StartCheckoutAsync(request.CompanyId, request.PlanId, request.BillingCycle, email);

        return Ok(new
        {
            checkout.PaymentId,
            checkout.OrderId,
            checkout.Provider,
            checkout.Amount,
            checkout.Status,
            checkout.RedirectUrl,
            checkout.Token,
            checkout.Instructions,
            message = checkout.Status == "Success"
                ? "The plan is active."
                : checkout.RedirectUrl is not null
                    ? "Complete the payment on the provider's page."
                    : "Follow the payment instructions; the plan activates when payment is confirmed.",
        });
    }

    /// <summary>The state of one payment, for the page the payer returns to.</summary>
    [HttpGet("payments/status/{orderId}")]
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<ActionResult<object>> GetPaymentStatus(string orderId)
    {
        var payment = await _context.Payments.AsNoTracking()
            .FirstOrDefaultAsync(p => p.GatewayOrderId == orderId && p.CompanyId == _context.CurrentCompanyId);
        if (payment is null) return NotFound();
        return Ok(new { payment.Id, orderId = payment.GatewayOrderId, status = payment.Status.ToString(), payment.Amount, payment.Provider, payment.PaidAt, payment.CheckoutUrl });
    }

    /// <summary>
    /// Get payment history for a company
    /// </summary>
    [HttpGet("payments/{companyId}")]
    [RequiresPermission(Permissions.SettingsView)]
    public async Task<ActionResult<IEnumerable<object>>> GetPaymentHistory(Guid companyId)
    {
        if (companyId != _context.CurrentCompanyId) return Forbid();

        var payments = await _context.Payments
            .Where(p => p.CompanyId == companyId || (p.Subscription != null && p.Subscription.CompanyId == companyId))
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
                p.Provider,
                OrderId = p.GatewayOrderId,
                p.CheckoutUrl,
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
