using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Models;

public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public bool IsAdmin { get; set; } = false; // SuperAdmin Flag

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? PasswordHash { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // MFA / 2FA
    public bool TwoFactorEnabled { get; set; } = false;
    
    [MaxLength(100)]
    public string? TwoFactorSecret { get; set; } // Stores the Base32 TOTP Secret Key

    // Email Verification
    public bool IsEmailVerified { get; set; } = false;
    
    [MaxLength(100)]
    public string? EmailVerificationToken { get; set; }
    
    // Password Reset
    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAt { get; set; }

    // Navigation
    // ── Suspension ────────────────────────────────────────────────────
    // A suspended user keeps every row it owns. Nothing is deleted and
    // nothing is anonymised: the books have to survive a billing dispute,
    // and a hard delete of a user would leave journal entries pointing at
    // an author who no longer exists.

    public bool IsSuspended { get; set; } = false;

    public DateTime? SuspendedAt { get; set; }

    [MaxLength(300)]
    public string? SuspensionReason { get; set; }

    public ICollection<UserCompany> UserCompanies { get; set; } = new List<UserCompany>();
}
