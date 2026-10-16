using System.Diagnostics;
using BalanceIO.API.Services;

namespace BalanceIO.API.Middleware;

/// <summary>
/// Counts requests so the panel can show throughput rather than uptime.
///
/// Sits at the very front of the pipeline, so a request refused by
/// authentication, suspension or the plan quota still counts. Load is load
/// regardless of what the server decided about it - a tenant hammering a
/// 403 costs the same CPU as one being served.
/// </summary>
public class RequestMetricsMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ServerMetricsService _metrics;

    public RequestMetricsMiddleware(RequestDelegate next, ServerMetricsService metrics)
    {
        _next = next;
        _metrics = metrics;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            await _next(context);
        }
        finally
        {
            stopwatch.Stop();
            _metrics.RecordRequest(stopwatch.ElapsedMilliseconds, context.Response.StatusCode);
        }
    }
}
