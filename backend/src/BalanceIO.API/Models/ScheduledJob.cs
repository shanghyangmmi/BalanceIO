using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

/// <summary>
/// Something the server does on its own, on a schedule.
///
/// The schedule lives in the database rather than in appsettings so that
/// changing it does not need a deployment, and so that the last run and
/// its outcome sit beside the definition. A backup you cannot see the
/// result of is not a backup; it is a hope.
/// </summary>
public class ScheduledJob
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Which handler runs. Matched against a fixed set in the runner -
    /// a job name is not a command, and nothing here can name an
    /// arbitrary executable.
    /// </summary>
    [Required]
    [MaxLength(60)]
    public string JobKey { get; set; } = string.Empty;

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(400)]
    public string? Description { get; set; }

    /// <summary>
    /// How often, in minutes. A plain interval rather than cron: the jobs
    /// here are "every night" and "every hour", and a cron parser would be
    /// a dependency and a class of bug bought for nothing.
    /// </summary>
    public int IntervalMinutes { get; set; } = 1440;

    /// <summary>
    /// Minutes past midnight UTC to prefer, for daily jobs. Null runs on
    /// the interval from whenever it last ran.
    /// </summary>
    public int? PreferredMinuteOfDay { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }

    [MaxLength(20)]
    public string? LastStatus { get; set; }   // Success, Failed, Running

    [MaxLength(1000)]
    public string? LastMessage { get; set; }

    public int ConsecutiveFailures { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// One execution. Kept so a failure that fixed itself on the next run is
/// still visible afterwards.
/// </summary>
public class JobRun
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ScheduledJobId { get; set; }

    [MaxLength(60)]
    public string JobKey { get; set; } = string.Empty;

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? FinishedAt { get; set; }

    [MaxLength(20)]
    public string Status { get; set; } = "Running";

    [MaxLength(2000)]
    public string? Message { get; set; }

    /// <summary>Whether a person pressed the button rather than the clock.</summary>
    public bool WasManual { get; set; }

    public Guid? TriggeredByUserId { get; set; }

    public long DurationMs { get; set; }
}
