using System;

namespace BalanceIO.API.Models;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // Multi-Tenancy
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }

    // Who performed the action (Nullable for system/legacy actions)
    public Guid? UserId { get; set; }
    public User? User { get; set; }
    
    // What action was performed (e.g., "MFA_UPDATE", "LOGIN_SUCCESS")
    public string Action { get; set; } = string.Empty;
    
    // Which entity was affected (e.g., Target User ID, Company ID)
    public string? TargetEntity { get; set; }
    
    // Additional details (JSON or text)
    public string? Details { get; set; }
    
    public string? IpAddress { get; set; }
    
    // Enhanced Tracking
    public string? UserAgent { get; set; }
    public string? Device { get; set; } // Desktop, Mobile, Tablet
    public string? OperatingSystem { get; set; } // Windows, iOS, Android
    
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
