using System.Diagnostics;
using BalanceIO.API.Data;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Takes a backup of the database to a file on disk.
///
/// The panel already had a "download backup" button, which serialised the
/// tables to JSON through the API. That is an export, not a backup: it goes
/// through EF, it is only as complete as the DbSets someone remembered to
/// include, and restoring from it means writing an importer. It also only
/// exists while somebody is sitting at the screen pressing it.
///
/// This is the other thing. Each provider gets the mechanism it actually
/// has:
///
///   SQLite uses VACUUM INTO, which produces a consistent snapshot without
///   blocking writers and without copying a file that is being written to
///   underneath us.
///
///   PostgreSQL uses pg_dump, because there is no in-database equivalent.
///   If pg_dump is not on the host, this says so plainly rather than
///   writing an empty file and reporting success. A backup that silently
///   did not happen is worse than no backup at all - it is a false
///   assurance you only discover the value of on the day you need it.
/// </summary>
public class DatabaseBackupService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<DatabaseBackupService> _logger;

    public DatabaseBackupService(
        ApplicationDbContext context,
        IConfiguration configuration,
        IWebHostEnvironment env,
        ILogger<DatabaseBackupService> logger)
    {
        _context = context;
        _configuration = configuration;
        _env = env;
        _logger = logger;
    }

    public string BackupDirectory =>
        Path.Combine(_env.ContentRootPath, _configuration["Backup:Directory"] ?? "backups");

    /// <summary>How many snapshots to keep. Zero or less keeps everything.</summary>
    public int Retention => _configuration.GetValue("Backup:Retention", 14);

    public async Task<BackupResult> RunAsync(CancellationToken ct = default)
    {
        Directory.CreateDirectory(BackupDirectory);

        var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var result = _context.Database.IsSqlite()
                ? await BackupSqliteAsync(stamp, ct)
                : await BackupPostgresAsync(stamp, ct);

            stopwatch.Stop();
            result.DurationMs = stopwatch.ElapsedMilliseconds;

            if (result.Success)
            {
                result.Pruned = Prune();
            }

            return result;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "Backup failed.");
            return new BackupResult
            {
                Success = false,
                Message = $"Backup failed: {ex.Message}",
                DurationMs = stopwatch.ElapsedMilliseconds,
            };
        }
    }

    private async Task<BackupResult> BackupSqliteAsync(string stamp, CancellationToken ct)
    {
        var path = Path.Combine(BackupDirectory, $"balanceio-{stamp}.db");

        // VACUUM INTO takes no parameters, so the path is interpolated. It
        // is built here from a timestamp and a configured directory and
        // never from anything a caller sends; the single quotes are still
        // doubled in case the deployment path contains one.
        var quoted = path.Replace("'", "''");

        // EF1002 is correct in general and not applicable here: VACUUM INTO
        // accepts no parameters, so there is nothing to bind. The path is
        // composed above from a configured directory and a timestamp.
#pragma warning disable EF1002
        await _context.Database.ExecuteSqlRawAsync($"VACUUM INTO '{quoted}';", ct);
#pragma warning restore EF1002

        var size = new FileInfo(path).Length;

        return new BackupResult
        {
            Success = true,
            FilePath = path,
            FileName = Path.GetFileName(path),
            SizeBytes = size,
            Message = $"SQLite snapshot written ({Format(size)}).",
        };
    }

    private async Task<BackupResult> BackupPostgresAsync(string stamp, CancellationToken ct)
    {
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return new BackupResult { Success = false, Message = "No connection string configured." };
        }

        var executable = _configuration["Backup:PgDumpPath"] ?? "pg_dump";
        var path = Path.Combine(BackupDirectory, $"balanceio-{stamp}.sql");

        var start = new ProcessStartInfo
        {
            FileName = executable,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        // Passed as a separate argument rather than concatenated, so a
        // password containing a shell metacharacter cannot become one.
        start.ArgumentList.Add($"--dbname={connectionString}");
        start.ArgumentList.Add("--format=custom");
        start.ArgumentList.Add($"--file={path}");
        start.ArgumentList.Add("--no-owner");

        try
        {
            using var process = Process.Start(start);
            if (process is null)
            {
                return new BackupResult { Success = false, Message = "pg_dump could not be started." };
            }

            var stderr = await process.StandardError.ReadToEndAsync(ct);
            await process.WaitForExitAsync(ct);

            if (process.ExitCode != 0)
            {
                return new BackupResult
                {
                    Success = false,
                    Message = $"pg_dump exited with {process.ExitCode}. {stderr.Trim()}",
                };
            }

            var size = File.Exists(path) ? new FileInfo(path).Length : 0;

            return new BackupResult
            {
                Success = true,
                FilePath = path,
                FileName = Path.GetFileName(path),
                SizeBytes = size,
                Message = $"pg_dump completed ({Format(size)}).",
            };
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return new BackupResult
            {
                Success = false,
                Message =
                    $"pg_dump was not found (looked for \"{executable}\"). Install the PostgreSQL " +
                    "client tools on this host, or set Backup:PgDumpPath to its full path.",
            };
        }
    }

    /// <summary>
    /// Removes the oldest snapshots beyond the retention count.
    ///
    /// Only files this service wrote are considered - the pattern is
    /// anchored to the name it generates. A backup directory somebody also
    /// keeps other things in must not become a directory this quietly
    /// empties.
    /// </summary>
    private int Prune()
    {
        if (Retention <= 0) return 0;

        var files = Directory
            .GetFiles(BackupDirectory, "balanceio-*.*")
            .Where(f => f.EndsWith(".db", StringComparison.OrdinalIgnoreCase)
                     || f.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(f => new FileInfo(f).CreationTimeUtc)
            .Skip(Retention)
            .ToList();

        var removed = 0;
        foreach (var file in files)
        {
            try
            {
                File.Delete(file);
                removed++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not remove old backup {File}.", file);
            }
        }

        return removed;
    }

    public List<BackupFile> List()
    {
        if (!Directory.Exists(BackupDirectory)) return new List<BackupFile>();

        return Directory
            .GetFiles(BackupDirectory, "balanceio-*.*")
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.CreationTimeUtc)
            .Select(f => new BackupFile
            {
                FileName  = f.Name,
                SizeBytes = f.Length,
                CreatedAt = f.CreationTimeUtc,
            })
            .ToList();
    }

    private static string Format(long bytes) =>
        bytes >= 1024L * 1024 * 1024 ? $"{bytes / 1024d / 1024 / 1024:N1} GB"
      : bytes >= 1024L * 1024        ? $"{bytes / 1024d / 1024:N1} MB"
      : $"{bytes / 1024d:N1} KB";
}

public class BackupResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? FilePath { get; set; }
    public string? FileName { get; set; }
    public long SizeBytes { get; set; }
    public long DurationMs { get; set; }
    public int Pruned { get; set; }
}

public class BackupFile
{
    public string FileName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
}
