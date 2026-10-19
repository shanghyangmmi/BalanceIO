using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "SuperAdmin")]
public class AdminSubscriptionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly BalanceIO.API.Services.Payments.PaymentService _payments;

    public AdminSubscriptionController(ApplicationDbContext context, BalanceIO.API.Services.Payments.PaymentService payments)
    {
        _context = context;
        _payments = payments;
    }

    // --- Payments ---

    /// <summary>Payments not yet settled, newest first, with the company and plan.</summary>
    [HttpGet("payments")]
    public async Task<IActionResult> GetPayments([FromQuery] string? status = "Pending")
    {
        var query = _context.Payments.AsNoTracking().AsQueryable();
        if (Enum.TryParse<PaymentStatus>(status, true, out var s)) query = query.Where(p => p.Status == s);

        var payments = await query.OrderByDescending(p => p.CreatedAt).Take(200).ToListAsync();
        var companyIds = payments.Where(p => p.CompanyId.HasValue).Select(p => p.CompanyId!.Value).Distinct().ToList();
        var planIds = payments.Where(p => p.PlanId.HasValue).Select(p => p.PlanId!.Value).Distinct().ToList();
        var companies = await _context.Companies.AsNoTracking().Where(c => companyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name);
        var plans = await _context.Plans.AsNoTracking().Where(p => planIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);

        return Ok(payments.Select(p => new
        {
            p.Id, orderId = p.GatewayOrderId, p.Provider, p.Amount, p.Currency, status = p.Status.ToString(),
            p.BillingCycle, p.CreatedAt, p.PaidAt,
            company = p.CompanyId is Guid c && companies.TryGetValue(c, out var cn) ? cn : null,
            plan = p.PlanId is Guid pl && plans.TryGetValue(pl, out var pn) ? pn : null,
        }));
    }

    /// <summary>Confirms a manual transfer has arrived; the plan activates.</summary>
    [HttpPost("payments/{id:guid}/confirm")]
    public async Task<IActionResult> ConfirmPayment(Guid id)
    {
        var who = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? "platform admin";
        var payment = await _payments.ConfirmManualAsync(id, who);
        return Ok(new { payment.Id, status = payment.Status.ToString(), payment.SubscriptionId, payment.PaidAt });
    }

    // --- Subscriptions ---

    [HttpGet("subscriptions")]
    public async Task<ActionResult> GetSubscriptions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        // We need to disable global query filters to see ALL companies
        var query = _context.Subscriptions
            .IgnoreQueryFilters()
            .Include(s => s.Company)
            .Include(s => s.Plan)
            .AsQueryable();

        var totalCount = await query.CountAsync();
        
        var subs = await query
            .OrderByDescending(s => s.StartDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new
            {
                s.Id,
                CompanyName = s.Company != null ? s.Company.Name : "Unknown",
                CompanyId = s.CompanyId,
                PlanName = s.Plan != null ? s.Plan.Name : "Unknown",
                Status = s.Status.ToString(),
                s.StartDate,
                s.EndDate,
                // Stats
                // StorageUsed? We don't track explicitly yet in Subscription, maybe in StoredFile
                // JournalCount?
                JournalCount = _context.JournalEntries.IgnoreQueryFilters().Count(j => j.CompanyId == s.CompanyId),
                // TODO: Implement Storage Tracking per Company (StoredFile needs CompanyId)
                StorageUsedMB = 0 
                // _context.StoredFiles.IgnoreQueryFilters()
                //    .Where(f => f.CompanyId == s.CompanyId)
                //    .Sum(f => f.Size) / (1024 * 1024)  
            })
            .ToListAsync();

        return Ok(new
        {
            data = subs,
            pagination = new { page, pageSize, totalCount, totalPages = (int)Math.Ceiling(totalCount / (double)pageSize) }
        });
    }

    [HttpPost("subscriptions/{id}/suspend")]
    public async Task<ActionResult> SuspendSubscription(Guid id)
    {
        var sub = await _context.Subscriptions.FindAsync(id);
        if (sub == null) return NotFound();

        // Toggle Suspend
        if (sub.Status == SubscriptionStatus.Suspended)
        {
            sub.Status = SubscriptionStatus.Active; // Or Previous State? Assume Active for now.
        }
        else
        {
            sub.Status = SubscriptionStatus.Suspended;
        }
        
        await _context.SaveChangesAsync();
        return Ok(new { message = $"Subscription is now {sub.Status}", status = sub.Status });
    }

    // --- Audit Logs (Login History) ---

    [HttpGet("audit-logs")]
    public async Task<ActionResult> GetAuditLogs([FromQuery] Guid? companyId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.AuditLogs.IgnoreQueryFilters().AsQueryable();

        if (companyId.HasValue)
        {
            query = query.Where(l => l.CompanyId == companyId.Value);
        }
        
        query = query.Where(l => l.Action.Contains("LOGIN") || l.Action.Contains("AUTH"));

        var totalCount = await query.CountAsync();
        
        var logs = await query
            .OrderByDescending(l => l.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new 
            {
                l.Id,
                l.Action,
                UserName = l.User != null ? l.User.Name : "System",
                l.IpAddress,
                l.Device,
                l.OperatingSystem,
                l.Timestamp,
                l.Details
            })
            .ToListAsync();

        return Ok(new
        {
            data = logs,
            pagination = new { page, pageSize, totalCount, totalPages = (int)Math.Ceiling(totalCount / (double)pageSize) }
        });
    }

    // --- Plans ---

    [HttpGet("plans")]
    public async Task<ActionResult> GetPlans()
    {
        var plans = await _context.Plans
            .OrderBy(p => p.SortOrder)
            .ToListAsync();
        return Ok(plans);
    }

    [HttpPut("plans/{id}")]
    public async Task<ActionResult> UpdatePlan(Guid id, [FromBody] Plan update)
    {
        var plan = await _context.Plans.FindAsync(id);
        if (plan == null) return NotFound();

        plan.Name = update.Name;
        plan.Description = update.Description;
        plan.PriceMonthly = update.PriceMonthly;
        plan.PriceYearly = update.PriceYearly;
        plan.MaxUsers = update.MaxUsers;
        plan.MaxCompanies = update.MaxCompanies; // Usually 1
        plan.MaxStorageMB = update.MaxStorageMB;
        plan.MaxJournalEntries = update.MaxJournalEntries;
        plan.Features = update.Features; // JSON string
        plan.IsActive = update.IsActive;
        plan.IsPopular = update.IsPopular;
        
        plan.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(plan);
    }

    // --- System Settings ---

    [HttpGet("settings")]
    public async Task<ActionResult> GetSettings()
    {
        var settings = await _context.SystemSettings.ToListAsync();
        return Ok(settings);
    }

    /// <summary>
    /// Write one setting.
    ///
    /// Look-then-insert is a race: two requests both find nothing and both
    /// insert, and the second one hits the primary key. That is what the
    /// admin panel was returning as "an error occurred while saving the
    /// entity changes" - a unique constraint violation dressed up as a
    /// server fault.
    ///
    /// An UPDATE is attempted first and only inserts when it changed no
    /// rows, so the ordinary case does not depend on a prior read at all.
    /// The insert is still guarded, because a row can appear between the
    /// two statements.
    /// </summary>
    [HttpPost("settings")]
    public async Task<ActionResult> UpdateSetting([FromBody] SystemSetting setting)
    {
        if (string.IsNullOrWhiteSpace(setting?.Key))
            return BadRequest(new { error = "A key is required." });

        var existing = await _context.SystemSettings
            .FirstOrDefaultAsync(s => s.Key == setting.Key);

        if (existing != null)
        {
            existing.Value = setting.Value;
            existing.Description = setting.Description ?? existing.Description;
            // DataType is not taken from the request. Changing it would
            // reinterpret a value the server already reads one way.
            await _context.SaveChangesAsync();
            return Ok(existing);
        }

        _context.SystemSettings.Add(setting);

        try
        {
            await _context.SaveChangesAsync();
            return Ok(setting);
        }
        catch (DbUpdateException)
        {
            // Somebody else created it in between. Their row is as good as
            // ours would have been; write our value onto it.
            _context.Entry(setting).State = EntityState.Detached;

            var raced = await _context.SystemSettings
                .FirstOrDefaultAsync(s => s.Key == setting.Key);

            if (raced == null) throw;

            raced.Value = setting.Value;
            await _context.SaveChangesAsync();
            return Ok(raced);
        }
    }
    
    // Helper to init default settings if missing
    [HttpPost("settings/init")]
    public async Task<ActionResult> InitSettings()
    {
        var defaults = new List<SystemSetting>
        {
            new() { Key = "PAYMENT_GATEWAY_ENABLED", Value = "false", DataType = "bool", Description = "Enable Payment Gateway Integration" },
            new() { Key = "ALLOW_SIGNUPS", Value = "true", DataType = "bool", Description = "Allow new company registrations" },
            new() { Key = "MAINTENANCE_MODE", Value = "false", DataType = "bool", Description = "System Maintenance Mode" },

            // How Plan.MaxJournalEntries is counted. Month makes the free
            // tier something a small business can stay on; Total makes it a
            // trial that ends. The column name does not say which was meant,
            // so the choice is left to whoever is running the business.
            new() { Key = "JOURNAL_LIMIT_WINDOW", Value = "Month", DataType = "string", Description = "Month or Total" },

            // Off. While it is on, an administrator can commit arbitrary SQL
            // against production from the browser.
            new() { Key = "ADMIN_SQL_WRITE_ENABLED", Value = "false", DataType = "bool", Description = "Allow write execution in the database console" }
        };

        // One read, compared in memory. A query per default was both
        // needless and wrong: each check is a separate check-then-act, so
        // two people pressing the button at once produced a primary key
        // violation and lost every default in the batch, including the
        // ones that were genuinely missing.
        var existing = await _context.SystemSettings
            .Select(s => s.Key)
            .ToListAsync();

        var missing = defaults.Where(d => !existing.Contains(d.Key)).ToList();

        if (missing.Count == 0)
        {
            return Ok(new { message = "Every default already exists.", added = 0 });
        }

        _context.SystemSettings.AddRange(missing);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Two administrators at once. Nothing here is worth failing a
            // request over - the rows exist either way, which is all this
            // endpoint was asked to guarantee.
            return Ok(new { message = "Every default already exists.", added = 0 });
        }

        return Ok(new
        {
            message = $"{missing.Count} default(s) created.",
            added = missing.Count,
        });
    }

    // --- Subscription Management ---

    [HttpPut("subscriptions/{id}/change-plan")]
    public async Task<ActionResult> ChangePlan(Guid id, [FromBody] ChangePlanRequest request)
    {
        var subscription = await _context.Subscriptions.FindAsync(id);
        if (subscription == null) return NotFound();

        var newPlan = await _context.Plans.FindAsync(request.PlanId);
        if (newPlan == null) return NotFound(new { message = "Plan not found" });

        subscription.PlanId = request.PlanId;
        subscription.UpdatedAt = DateTime.UtcNow;

        if (request.ExtendDays > 0)
        {
            subscription.EndDate = subscription.EndDate.AddDays(request.ExtendDays);
        }

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "ADMIN_OVERRIDE",
            TargetEntity = "Subscription:" + id,
            Timestamp = DateTime.UtcNow,
            Details = $"Plan changed to {newPlan.Name} by admin. Reason: {request.Reason}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Subscription changed to {newPlan.Name}" });
    }

    [HttpPost("subscriptions/{id}/extend")]
    public async Task<ActionResult> ExtendSubscription(Guid id, [FromBody] ExtendRequest request)
    {
        var subscription = await _context.Subscriptions.FindAsync(id);
        if (subscription == null) return NotFound();

        subscription.EndDate = subscription.EndDate.AddDays(request.Days);
        subscription.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "ADMIN_EXTEND",
            TargetEntity = "Subscription:" + id,
            Timestamp = DateTime.UtcNow,
            Details = $"Extended by {request.Days} days. Reason: {request.Reason}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Subscription extended by {request.Days} days", newEndDate = subscription.EndDate });
    }

    [HttpPost("subscriptions/{id}/cancel")]
    public async Task<ActionResult> CancelSubscription(Guid id, [FromBody] CancelRequest? request = null)
    {
        var subscription = await _context.Subscriptions.FindAsync(id);
        if (subscription == null) return NotFound();

        subscription.Status = SubscriptionStatus.Cancelled;
        subscription.CancelledAt = DateTime.UtcNow;
        subscription.UpdatedAt = DateTime.UtcNow;

        _context.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            Action = "ADMIN_CANCEL",
            TargetEntity = "Subscription:" + id,
            Timestamp = DateTime.UtcNow,
            Details = $"Cancelled by admin. Reason: {request?.Reason ?? "No reason provided"}",
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString()
        });

        await _context.SaveChangesAsync();

        return Ok(new { message = "Subscription cancelled" });
    }

    [HttpGet("subscriptions/payments")]
    public async Task<ActionResult<object>> GetAllPayments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null)
    {
        var query = _context.Payments
            .Include(p => p.Subscription)
            .ThenInclude(s => s!.Company)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<PaymentStatus>(status, true, out var statusEnum))
        {
            query = query.Where(p => p.Status == statusEnum);
        }

        var totalCount = await query.CountAsync();

        var payments = await query
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                p.Id,
                CompanyName = p.Subscription != null && p.Subscription.Company != null 
                    ? p.Subscription.Company.Name : "N/A",
                p.Amount,
                p.Currency,
                p.Status,
                p.PaymentMethod,
                p.GatewayOrderId,
                p.InvoiceNumber,
                p.CreatedAt,
                p.PaidAt
            })
            .ToListAsync();

        return Ok(new
        {
            data = payments,
            pagination = new
            {
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            }
        });
    }
}

public class ChangePlanRequest
{
    public Guid PlanId { get; set; }
    public int ExtendDays { get; set; } = 0;
    public string? Reason { get; set; }
}

public class ExtendRequest
{
    public int Days { get; set; }
    public string? Reason { get; set; }
}

public class CancelRequest
{
    public string? Reason { get; set; }
}

