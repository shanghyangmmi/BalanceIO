using BalanceIO.API.Services;

namespace BalanceIO.API.Middleware;

/// <summary>
/// Turns a plan limit into the answer it deserves.
///
/// The quota is enforced deep inside SaveChangesAsync, where there is no
/// HTTP response to write. Left alone that surfaces as a 500, which tells
/// the customer the product is broken when what actually happened is that
/// they need a larger plan - and buries the one thing worth showing them.
///
/// 402 rather than 403, matching MODULE_NOT_ENTITLED: the request was
/// legitimate and the caller is who they say they are. The only thing
/// missing is payment.
/// </summary>
public class PlanLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<PlanLimitMiddleware> _logger;

    public PlanLimitMiddleware(RequestDelegate next, ILogger<PlanLimitMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (PlanLimitExceededException ex)
        {
            if (context.Response.HasStarted)
            {
                // Too late to say anything useful. Log it and let the
                // truncated response speak for itself.
                _logger.LogWarning(ex, "Plan limit reached after the response had started.");
                throw;
            }

            _logger.LogInformation(
                "Plan limit reached: {Limit} at {Used} of {Allowed}.",
                ex.LimitName, ex.Used, ex.Allowed);

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
            context.Response.ContentType = "application/json";

            await context.Response.WriteAsJsonAsync(new
            {
                error = "PLAN_LIMIT_REACHED",
                limit = ex.LimitName,
                used = ex.Used,
                allowed = ex.Allowed,
                message = ex.Message,
            });
        }
    }
}
