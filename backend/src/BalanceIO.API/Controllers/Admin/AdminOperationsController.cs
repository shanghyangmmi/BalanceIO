using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers.Admin;

/// <summary>
/// Running the server: what it is doing, what it does on a schedule, what
/// it has backed up, and the database console.
/// </summary>
[ApiController]
[Route("api/admin/operations")]
[Authorize(Roles = "SuperAdmin")]
public class AdminOperationsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ServerMetricsService _metrics;
    private readonly ScheduledJobRunner _runner;
    private readonly DatabaseBackupService _backups;
    private readonly AdminQueryService _query;
    private readonly AuditService _audit;

    public AdminOperationsController(
        ApplicationDbContext context,
        ServerMetricsService metrics,
        ScheduledJobRunner runner,
        DatabaseBackupService backups,
        AdminQueryService query,
        AuditService audit)
    {
        _context = context;
        _metrics = metrics;
        _runner = runner;
        _backups = backups;
        _query = query;
        _audit = audit;
    }

    // ── Load ─────────────────────────────────────────────────────────────

    [HttpGet("metrics")]
    public IActionResult GetMetrics() => Ok(_metrics.Read());

    // ── Schedule ─────────────────────────────────────────────────────────

    [HttpGet("jobs")]
    public async Task<IActionResult> ListJobs()
    {
        var jobs = await _context.ScheduledJobs
            .AsNoTracking()
            .OrderBy(j => j.Name)
            .ToListAsync();

        var recent = await _context.JobRuns
            .AsNoTracking()
            .OrderByDescending(r => r.StartedAt)
            .Take(50)
            .ToListAsync();

        return Ok(new { jobs, recentRuns = recent });
    }

    public record JobUpdate(bool IsEnabled, int IntervalMinutes, int? PreferredMinuteOfDay);

    [HttpPut("jobs/{id}")]
    public async Task<IActionResult> UpdateJob(Guid id, [FromBody] JobUpdate update)
    {
        var job = await _context.ScheduledJobs.FindAsync(id);
        if (job is null) return NotFound();

        if (update.IntervalMinutes < 1)
            return BadRequest(new { error = "An interval below one minute is not a schedule." });

        job.IsEnabled = update.IsEnabled;
        job.IntervalMinutes = update.IntervalMinutes;
        job.PreferredMinuteOfDay = update.PreferredMinuteOfDay;
        job.UpdatedAt = DateTime.UtcNow;

        // Re-enabling clears the backoff. Whoever turned it back on has
        // usually just fixed whatever it was failing on.
        if (update.IsEnabled)
        {
            job.ConsecutiveFailures = 0;
            job.NextRunAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        await Audit("JOB_UPDATED", job.JobKey,
            $"Enabled={job.IsEnabled}, every {job.IntervalMinutes} min.");

        return Ok(job);
    }

    [HttpPost("jobs/{id}/run")]
    public async Task<IActionResult> RunJob(Guid id, CancellationToken ct)
    {
        var job = await _context.ScheduledJobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == id, ct);
        if (job is null) return NotFound();

        await Audit("JOB_RUN_MANUAL", job.JobKey, "Started from the admin panel.");

        // The same path the scheduler takes. A manual run that behaved
        // differently would prove nothing about the scheduled one.
        var run = await _runner.ExecuteJobAsync(job, manual: true, triggeredBy: CurrentUserId(), ct);

        return Ok(run);
    }

    [HttpGet("jobs/{id}/runs")]
    public async Task<IActionResult> JobHistory(Guid id, [FromQuery] int take = 50)
    {
        var runs = await _context.JobRuns
            .AsNoTracking()
            .Where(r => r.ScheduledJobId == id)
            .OrderByDescending(r => r.StartedAt)
            .Take(Math.Clamp(take, 1, 200))
            .ToListAsync();

        return Ok(runs);
    }

    // ── Backups ──────────────────────────────────────────────────────────

    [HttpGet("backups")]
    public IActionResult ListBackups() => Ok(new
    {
        directory = _backups.BackupDirectory,
        retention = _backups.Retention,
        files = _backups.List(),
    });

    [HttpPost("backups/run")]
    public async Task<IActionResult> RunBackup(CancellationToken ct)
    {
        var result = await _backups.RunAsync(ct);

        await Audit(result.Success ? "BACKUP_TAKEN" : "BACKUP_FAILED",
            result.FileName ?? "Database", result.Message);

        // A failed backup is not a server error - the request was handled
        // correctly and the answer is that it did not work.
        return result.Success ? Ok(result) : StatusCode(StatusCodes.Status409Conflict, result);
    }

    // ── Database console ─────────────────────────────────────────────────

    [HttpGet("database")]
    public async Task<IActionResult> DatabaseOverview(CancellationToken ct)
    {
        return Ok(new
        {
            provider = _context.Database.ProviderName,
            writeEnabled = await _query.IsWriteEnabledAsync(ct),
            writeSettingKey = AdminQueryService.WriteEnabledSettingKey,
            writeConfirmationPhrase = AdminQueryService.WriteConfirmationPhrase,
            tables = await _query.ListTablesAsync(ct),
        });
    }

    public record SqlRequest(string Sql, string? Confirm);

    [HttpPost("database/query")]
    public async Task<IActionResult> RunQuery([FromBody] SqlRequest request, CancellationToken ct)
    {
        var result = await _query.QueryAsync(request.Sql ?? string.Empty, ct);

        // Reads are not audited individually. They are constrained to a
        // rolled-back read-only transaction, and logging every exploratory
        // SELECT would bury the writes - which are the rows that matter.
        return result.Success
            ? Ok(result)
            : StatusCode(result.Refused ? StatusCodes.Status400BadRequest
                                        : StatusCodes.Status422UnprocessableEntity, result);
    }

    [HttpPost("database/execute")]
    public async Task<IActionResult> Execute([FromBody] SqlRequest request, CancellationToken ct)
    {
        var result = await _query.ExecuteAsync(
            request.Sql ?? string.Empty,
            request.Confirm ?? string.Empty,
            CurrentUserId(),
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"].ToString(),
            ct);

        return result.Success
            ? Ok(result)
            : StatusCode(result.Refused ? StatusCodes.Status400BadRequest
                                        : StatusCodes.Status422UnprocessableEntity, result);
    }

    private Task Audit(string action, string target, string details) =>
        _audit.LogAsync(
            CurrentUserId(), action, target, details,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"].ToString());

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirst("UserId")?.Value
               ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }
}
