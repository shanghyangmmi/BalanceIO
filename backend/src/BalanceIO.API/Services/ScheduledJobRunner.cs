using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The set of things the server is allowed to run on a schedule.
///
/// A closed set, matched by key. The alternative - a schedule row naming a
/// command or a script path - turns the admin panel into remote code
/// execution with a cron field, where anyone who can edit a row can run
/// anything the service account can run. The button says "backup" because
/// backup is one of the five things this can do, not because somebody
/// typed the word.
/// </summary>
public static class JobCatalogue
{
    public const string Backup = "backup";
    public const string ExchangeRates = "exchange-rates";
    public const string SubscriptionSweep = "subscription-sweep";
    public const string AuditPrune = "audit-prune";

    public static readonly IReadOnlyList<(string Key, string Name, string Description, int IntervalMinutes, int? MinuteOfDay)>
        Defaults = new List<(string, string, string, int, int?)>
        {
            (Backup, "Database backup",
             "Writes a snapshot of the database to the backup directory and prunes older ones.",
             1440, 60 * 18),

            (ExchangeRates, "Exchange rate sync",
             "Pulls the day's rates from the configured market source.",
             1440, 60 * 2),

            (SubscriptionSweep, "Subscription sweep",
             "Marks subscriptions Expired once their end date has passed. Nothing else moves them.",
             360, null),

            (AuditPrune, "Audit log retention",
             "Removes audit rows older than the configured retention. Disabled by default: an audit trail you trimmed is one you cannot rely on.",
             1440, 60 * 3),
        };

    public static bool IsKnown(string key) => Defaults.Any(d => d.Key == key);
}

/// <summary>
/// Runs the scheduled jobs.
///
/// A plain interval loop rather than a cron library, because the schedules
/// here are "every night" and "every few hours" and a cron parser would be
/// a dependency and a class of bug bought for nothing.
///
/// Two things this deliberately does:
///
///   It records every run, including the failures, in JobRuns. A backup
///   that failed on Tuesday and worked on Wednesday must still be visible
///   on Thursday, or the panel shows a green tick over a gap.
///
///   It backs off after repeated failures. A job that cannot reach an
///   external API should not retry every sixty seconds for a week and fill
///   the log with the same error - the doubling stops at roughly a day.
/// </summary>
public class ScheduledJobRunner : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<ScheduledJobRunner> _logger;

    public ScheduledJobRunner(IServiceScopeFactory scopes, ILogger<ScheduledJobRunner> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let the schema patches in Program.cs finish before touching the
        // tables they create.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        await EnsureDefaultsAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunDueJobsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // The loop itself must survive anything a job throws, or one
                // bad night stops every schedule until the next deployment.
                _logger.LogError(ex, "Scheduled job sweep failed.");
            }

            try
            {
                await Task.Delay(Tick, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task EnsureDefaultsAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var existing = await db.ScheduledJobs.Select(j => j.JobKey).ToListAsync(ct);

            foreach (var (key, name, description, interval, minuteOfDay) in JobCatalogue.Defaults)
            {
                if (existing.Contains(key)) continue;

                db.ScheduledJobs.Add(new ScheduledJob
                {
                    JobKey = key,
                    Name = name,
                    Description = description,
                    IntervalMinutes = interval,
                    PreferredMinuteOfDay = minuteOfDay,
                    // Retention starts off. Deleting audit rows is a policy
                    // decision with legal weight, and it should not begin
                    // happening because a default said so.
                    IsEnabled = key != JobCatalogue.AuditPrune,
                    NextRunAt = DateTime.UtcNow.AddMinutes(5),
                });
            }

            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not seed the default job schedule.");
        }
    }

    private async Task RunDueJobsAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var now = DateTime.UtcNow;

        var due = await db.ScheduledJobs
            .Where(j => j.IsEnabled && (j.NextRunAt == null || j.NextRunAt <= now))
            .ToListAsync(ct);

        foreach (var job in due)
        {
            await ExecuteJobAsync(job, manual: false, triggeredBy: null, ct);
        }
    }

    /// <summary>
    /// Runs one job now, whether the clock asked for it or a person did.
    /// Shared so that pressing the button in the panel and the schedule
    /// firing take exactly the same path - a manual run that behaved
    /// differently would prove nothing about the scheduled one.
    /// </summary>
    public async Task<JobRun> ExecuteJobAsync(
        ScheduledJob job, bool manual, Guid? triggeredBy, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var provider = scope.ServiceProvider;
        var db = provider.GetRequiredService<ApplicationDbContext>();

        var tracked = await db.ScheduledJobs.FirstOrDefaultAsync(j => j.Id == job.Id, ct)
                   ?? await db.ScheduledJobs.FirstOrDefaultAsync(j => j.JobKey == job.JobKey, ct);

        var run = new JobRun
        {
            ScheduledJobId = tracked?.Id ?? job.Id,
            JobKey = job.JobKey,
            StartedAt = DateTime.UtcNow,
            Status = "Running",
            WasManual = manual,
            TriggeredByUserId = triggeredBy,
        };

        db.JobRuns.Add(run);
        await db.SaveChangesAsync(ct);

        var started = DateTime.UtcNow;
        string message;
        bool success;

        try
        {
            message = await DispatchAsync(job.JobKey, provider, db, ct);
            success = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scheduled job {Job} failed.", job.JobKey);
            message = ex.Message;
            success = false;
        }

        run.FinishedAt = DateTime.UtcNow;
        run.DurationMs = (long)(run.FinishedAt.Value - started).TotalMilliseconds;
        run.Status = success ? "Success" : "Failed";
        run.Message = Truncate(message, 2000);

        if (tracked is not null)
        {
            tracked.LastRunAt = run.FinishedAt;
            tracked.LastStatus = run.Status;
            tracked.LastMessage = Truncate(message, 1000);
            tracked.ConsecutiveFailures = success ? 0 : tracked.ConsecutiveFailures + 1;
            tracked.NextRunAt = NextRun(tracked, DateTime.UtcNow);
        }

        await db.SaveChangesAsync(ct);
        return run;
    }

    /// <summary>
    /// When to try again. Backs off by doubling after a failure, capped at
    /// a day, so a job that cannot reach an API stops retrying every
    /// minute without stopping altogether.
    /// </summary>
    private static DateTime NextRun(ScheduledJob job, DateTime now)
    {
        if (job.ConsecutiveFailures > 0)
        {
            var minutes = Math.Min(
                job.IntervalMinutes * Math.Pow(2, Math.Min(job.ConsecutiveFailures, 10)),
                1440);
            return now.AddMinutes(minutes);
        }

        if (job.PreferredMinuteOfDay is int preferred)
        {
            var today = now.Date.AddMinutes(preferred);
            return today > now ? today : today.AddDays(1);
        }

        return now.AddMinutes(Math.Max(1, job.IntervalMinutes));
    }

    private static async Task<string> DispatchAsync(
        string key, IServiceProvider provider, ApplicationDbContext db, CancellationToken ct)
    {
        switch (key)
        {
            case JobCatalogue.Backup:
            {
                var backup = provider.GetRequiredService<DatabaseBackupService>();
                var result = await backup.RunAsync(ct);
                if (!result.Success) throw new InvalidOperationException(result.Message);
                return result.Pruned > 0
                    ? $"{result.Message} {result.Pruned} older snapshot(s) removed."
                    : result.Message;
            }

            case JobCatalogue.ExchangeRates:
            {
                // The interface, not the class. ExchangeRateService is
                // registered only against IExchangeRateService, so asking
                // for the concrete type threw on every run - the job
                // failed nightly and the reason was a DI registration,
                // not the rate source.
                var rates = provider.GetRequiredService<IExchangeRateService>();
                var result = await rates.SyncRatesFromMarketApiAsync();

                if (!result.Success)
                    throw new InvalidOperationException(result.Error ?? "The rate source did not answer.");

                return $"{result.RatesSynced} rate(s) synchronised from {result.Source}.";
            }

            case JobCatalogue.SubscriptionSweep:
            {
                var now = DateTime.UtcNow;
                var stale = await db.Subscriptions
                    .Where(s => s.Status == SubscriptionStatus.Active && s.EndDate < now)
                    .ToListAsync(ct);

                foreach (var subscription in stale)
                {
                    subscription.Status = SubscriptionStatus.Expired;
                    subscription.UpdatedAt = now;
                }

                await db.SaveChangesAsync(ct);
                return stale.Count == 0
                    ? "Nothing had lapsed."
                    : $"{stale.Count} subscription(s) marked Expired.";
            }

            case JobCatalogue.AuditPrune:
            {
                var configuration = provider.GetRequiredService<IConfiguration>();
                var days = configuration.GetValue("Audit:RetentionDays", 0);

                if (days <= 0)
                {
                    return "No retention configured; nothing removed.";
                }

                var cutoff = DateTime.UtcNow.AddDays(-days);
                var removed = await db.AuditLogs
                    .IgnoreQueryFilters()
                    .Where(a => a.Timestamp < cutoff)
                    .ExecuteDeleteAsync(ct);

                return $"{removed} audit row(s) older than {days} days removed.";
            }

            default:
                throw new InvalidOperationException($"No handler is registered for the job \"{key}\".");
        }
    }

    private static string Truncate(string value, int max) =>
        string.IsNullOrEmpty(value) || value.Length <= max ? value : value[..max];
}
