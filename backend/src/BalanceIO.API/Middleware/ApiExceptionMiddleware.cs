using System.ComponentModel.DataAnnotations;
using BalanceIO.API.Services;

namespace BalanceIO.API.Middleware;

/// <summary>
/// Last-resort translation of exceptions into JSON responses.
///
/// Domain rejections (period lock, ledger integrity) are client errors and
/// say so with a stable <c>code</c>. Anything else is a 500 whose body carries
/// no stack trace outside Development; the exception is logged instead.
/// </summary>
public class ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex) when (!context.Response.HasStarted)
        {
            var (status, code) = ex switch
            {
                PeriodLockedException => (StatusCodes.Status400BadRequest, "PERIOD_LOCKED"),
                LedgerIntegrityException l => (StatusCodes.Status400BadRequest, l.Code),
                PayrollRuleException p => (p.Status, p.Code),
                InventoryRuleException i => (i.Status, i.Code),
                PaymentRuleException pr => (pr.Status, pr.Code),
                ValidationException => (StatusCodes.Status400BadRequest, "VALIDATION_FAILED"),
                _ => (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR"),
            };

            if (status == StatusCodes.Status500InternalServerError)
                logger.LogError(ex, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);

            context.Response.Clear();
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new
            {
                code,
                message = status == StatusCodes.Status500InternalServerError && !env.IsDevelopment()
                    ? "An unexpected error occurred."
                    : ex.Message,
                detail = env.IsDevelopment() && status == StatusCodes.Status500InternalServerError ? ex.ToString() : null,
            });
        }
    }
}
