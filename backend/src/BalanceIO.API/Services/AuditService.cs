using BalanceIO.API.Data;
using BalanceIO.API.Models;

namespace BalanceIO.API.Services;

public class AuditService
{
    private readonly ApplicationDbContext _context;

    public AuditService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(Guid? userId, string action, string? targetEntity = null, string? details = null, string? ipAddress = null, string? userAgent = null, Guid? companyId = null)
    {
        var (device, os) = ParseUserAgent(userAgent);

        var log = new AuditLog
        {
            UserId = userId,
            CompanyId = companyId ?? _context.CurrentCompanyId,
            Action = action,
            TargetEntity = targetEntity,
            Details = details,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Device = device,
            OperatingSystem = os,
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Records an immutable audit log with full Before / After JSON Diff Snapshots.
    /// Essential for Big 4 financial audits ("who changed what, from which value to which value").
    /// </summary>
    public async Task LogChangeAsync<T>(
        Guid? userId,
        string action,
        string targetEntity,
        T? oldState,
        T? newState,
        string? ipAddress = null,
        string? userAgent = null,
        Guid? companyId = null)
    {
        var (device, os) = ParseUserAgent(userAgent);

        var diff = new
        {
            entityType = typeof(T).Name,
            targetEntity = targetEntity,
            beforeSnapshot = oldState,
            afterSnapshot = newState,
            changedProperties = GetPropertyDifferences(oldState, newState)
        };

        var log = new AuditLog
        {
            UserId = userId,
            CompanyId = companyId ?? _context.CurrentCompanyId,
            Action = action,
            TargetEntity = targetEntity,
            Details = System.Text.Json.JsonSerializer.Serialize(diff),
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Device = device,
            OperatingSystem = os,
            Timestamp = DateTime.UtcNow
        };

        _context.AuditLogs.Add(log);
        await _context.SaveChangesAsync();
    }

    private Dictionary<string, object?> GetPropertyDifferences<T>(T? oldObj, T? newObj)
    {
        var diffs = new Dictionary<string, object?>();
        if (oldObj == null || newObj == null) return diffs;

        var props = typeof(T).GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance);
        foreach (var prop in props)
        {
            // Skip navigation properties / collections
            if (prop.PropertyType.IsGenericType && prop.PropertyType.GetGenericTypeDefinition() == typeof(List<>))
                continue;

            var oldVal = prop.GetValue(oldObj);
            var newVal = prop.GetValue(newObj);
            if (!Equals(oldVal, newVal))
            {
                diffs[prop.Name] = new { from = oldVal, to = newVal };
            }
        }
        return diffs;
    }

    private (string Device, string OS) ParseUserAgent(string? ua)
    {
        if (string.IsNullOrEmpty(ua)) return ("Unknown", "Unknown");

        string os = "Unknown";
        if (ua.Contains("Windows")) os = "Windows";
        else if (ua.Contains("Mac OS")) os = "macOS";
        else if (ua.Contains("Android")) os = "Android";
        else if (ua.Contains("iOS") || ua.Contains("iPhone") || ua.Contains("iPad")) os = "iOS";
        else if (ua.Contains("Linux")) os = "Linux";

        string device = "Desktop";
        if (ua.Contains("Mobile") || ua.Contains("Android") || ua.Contains("iPhone")) device = "Mobile";
        else if (ua.Contains("iPad") || ua.Contains("Tablet")) device = "Tablet";

        return (device, os);
    }
}
