using System.Diagnostics;

namespace BalanceIO.API.Services;

/// <summary>
/// What the box is doing right now.
///
/// The panel already had a "server info" card, which reported the machine
/// name, an uptime and how full the disk was. None of that tells you
/// whether the VPS is coping - a server can be at 100% CPU with a
/// half-empty disk and a perfectly respectable uptime.
///
/// CPU cannot be read as an instantaneous value. It is a ratio of processor
/// time consumed to wall-clock time elapsed, so it only exists between two
/// samples. This holds the previous sample and reports the interval
/// between calls; the first call after start has nothing to compare
/// against and returns null rather than a fabricated zero.
///
/// Registered as a singleton because that history is the whole point. A
/// scoped instance would take its first sample on every request and never
/// have a second one.
/// </summary>
public class ServerMetricsService
{
    private readonly object _gate = new();

    private DateTime _lastSampleAt;
    private TimeSpan _lastProcessorTime;
    private double? _lastCpuPercent;

    private readonly DateTime _startedAt = DateTime.UtcNow;

    // Request accounting. Interlocked rather than a lock: this is touched
    // on every request and must not become the thing that slows the server
    // down while measuring how slow the server is.
    private long _totalRequests;
    private long _totalErrors;
    private long _totalDurationMs;
    private long _windowRequests;
    private DateTime _windowStartedAt = DateTime.UtcNow;
    private double _lastRequestsPerSecond;

    public void RecordRequest(long durationMs, int statusCode)
    {
        Interlocked.Increment(ref _totalRequests);
        Interlocked.Increment(ref _windowRequests);
        Interlocked.Add(ref _totalDurationMs, durationMs);

        if (statusCode >= 500)
        {
            Interlocked.Increment(ref _totalErrors);
        }
    }

    public ServerMetrics Read()
    {
        var process = Process.GetCurrentProcess();
        var now = DateTime.UtcNow;

        double? cpuPercent;
        double requestsPerSecond;

        lock (_gate)
        {
            var processorTime = process.TotalProcessorTime;

            if (_lastSampleAt != default)
            {
                var elapsed = (now - _lastSampleAt).TotalMilliseconds;
                var consumed = (processorTime - _lastProcessorTime).TotalMilliseconds;

                if (elapsed > 0)
                {
                    // Divided by processor count so the figure is a share of
                    // the whole machine. Without it an eight-core box pegged
                    // on one thread reads as 100% busy while seven cores sit
                    // idle.
                    _lastCpuPercent = Math.Round(
                        Math.Clamp(consumed / (elapsed * Environment.ProcessorCount) * 100, 0, 100), 1);
                }
            }

            _lastSampleAt = now;
            _lastProcessorTime = processorTime;
            cpuPercent = _lastCpuPercent;

            var windowSeconds = (now - _windowStartedAt).TotalSeconds;
            if (windowSeconds >= 1)
            {
                _lastRequestsPerSecond =
                    Math.Round(Interlocked.Exchange(ref _windowRequests, 0) / windowSeconds, 2);
                _windowStartedAt = now;
            }

            requestsPerSecond = _lastRequestsPerSecond;
        }

        var gc = GC.GetGCMemoryInfo();
        var machineMemoryBytes = gc.TotalAvailableMemoryBytes;
        var managedBytes = GC.GetTotalMemory(forceFullCollection: false);
        var workingSetBytes = process.WorkingSet64;

        var totalRequests = Interlocked.Read(ref _totalRequests);
        var totalDuration = Interlocked.Read(ref _totalDurationMs);

        return new ServerMetrics
        {
            MachineName      = Environment.MachineName,
            OperatingSystem  = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            Runtime          = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
            Architecture     = System.Runtime.InteropServices.RuntimeInformation.OSArchitecture.ToString(),
            ProcessorCount   = Environment.ProcessorCount,

            ProcessStartedAt = process.StartTime.ToUniversalTime(),
            UptimeSeconds    = (long)(now - process.StartTime.ToUniversalTime()).TotalSeconds,
            SampledSince     = _startedAt,

            CpuPercent       = cpuPercent,
            ThreadCount      = process.Threads.Count,

            WorkingSetMB     = Math.Round(workingSetBytes / 1024d / 1024d, 1),
            ManagedHeapMB    = Math.Round(managedBytes / 1024d / 1024d, 1),
            MachineMemoryMB  = machineMemoryBytes > 0
                                 ? Math.Round(machineMemoryBytes / 1024d / 1024d, 1)
                                 : null,
            MemoryPercent    = machineMemoryBytes > 0
                                 ? Math.Round(workingSetBytes * 100d / machineMemoryBytes, 1)
                                 : null,

            Gen0Collections  = GC.CollectionCount(0),
            Gen1Collections  = GC.CollectionCount(1),
            Gen2Collections  = GC.CollectionCount(2),

            TotalRequests      = totalRequests,
            TotalServerErrors  = Interlocked.Read(ref _totalErrors),
            AverageResponseMs  = totalRequests == 0 ? 0 : Math.Round((double)totalDuration / totalRequests, 1),
            RequestsPerSecond  = requestsPerSecond,

            Drives = ReadDrives(),
        };
    }

    private static List<DriveUsage> ReadDrives()
    {
        var drives = new List<DriveUsage>();

        foreach (var drive in DriveInfo.GetDrives())
        {
            // A CD drive with no disc, a network share that went away, a
            // container mount the process cannot stat: asking throws, and
            // one unreadable mount must not take the whole metrics call
            // down with it.
            try
            {
                if (!drive.IsReady || drive.TotalSize <= 0) continue;

                var used = drive.TotalSize - drive.AvailableFreeSpace;

                drives.Add(new DriveUsage
                {
                    Name        = drive.Name,
                    Format      = drive.DriveFormat,
                    TotalGB     = Math.Round(drive.TotalSize / 1024d / 1024d / 1024d, 1),
                    FreeGB      = Math.Round(drive.AvailableFreeSpace / 1024d / 1024d / 1024d, 1),
                    UsedGB      = Math.Round(used / 1024d / 1024d / 1024d, 1),
                    UsedPercent = Math.Round(used * 100d / drive.TotalSize, 1),
                });
            }
            catch
            {
                // Skip it.
            }
        }

        return drives;
    }
}

public class ServerMetrics
{
    public string MachineName { get; set; } = string.Empty;
    public string OperatingSystem { get; set; } = string.Empty;
    public string Runtime { get; set; } = string.Empty;
    public string Architecture { get; set; } = string.Empty;
    public int ProcessorCount { get; set; }

    public DateTime ProcessStartedAt { get; set; }
    public long UptimeSeconds { get; set; }
    public DateTime SampledSince { get; set; }

    /// <summary>Null until a second sample exists to compare against.</summary>
    public double? CpuPercent { get; set; }
    public int ThreadCount { get; set; }

    public double WorkingSetMB { get; set; }
    public double ManagedHeapMB { get; set; }
    public double? MachineMemoryMB { get; set; }
    public double? MemoryPercent { get; set; }

    public int Gen0Collections { get; set; }
    public int Gen1Collections { get; set; }
    public int Gen2Collections { get; set; }

    public long TotalRequests { get; set; }
    public long TotalServerErrors { get; set; }
    public double AverageResponseMs { get; set; }
    public double RequestsPerSecond { get; set; }

    public List<DriveUsage> Drives { get; set; } = new();
}

public class DriveUsage
{
    public string Name { get; set; } = string.Empty;
    public string Format { get; set; } = string.Empty;
    public double TotalGB { get; set; }
    public double FreeGB { get; set; }
    public double UsedGB { get; set; }
    public double UsedPercent { get; set; }
}
