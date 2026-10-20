using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using Microsoft.EntityFrameworkCore;
using OtpNet;

namespace BalanceIO.API.Services;

public enum AuthResultStatus
{
    Success,
    InvalidCredentials,
    RequiresTwoFactor,
    Error
}

public class AuthResult
{
    public AuthResultStatus Status { get; set; }
    public string? Token { get; set; }
    public string? Message { get; set; }
}

public class AuthService
{
    private readonly ApplicationDbContext _context;
    private readonly Argon2PasswordHasher _passwordHasher;
    private readonly JwtService _jwtService;
    private readonly SessionService _sessionService;

    public AuthService(ApplicationDbContext context, Argon2PasswordHasher passwordHasher, JwtService jwtService, SessionService sessionService)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
        _sessionService = sessionService;
    }

    public async Task<User?> RegisterAsync(string name, string email, string password)
    {
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existingUser != null)
        {
            if (existingUser.IsEmailVerified)
            {
                // Truly taken
                return null; 
            }
            else
            {
                // User exists but NOT verified -> Overwrite them!
                existingUser.Name = name;
                existingUser.PasswordHash = _passwordHasher.HashPassword(password);
                existingUser.EmailVerificationToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
                // Reset creation date to now? Maybe useful.
                existingUser.CreatedAt = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                return existingUser;
            }
        }

        // New User
        var user = new User
        {
            Name = name,
            Email = email,
            PasswordHash = _passwordHasher.HashPassword(password),
            IsEmailVerified = false,
            EmailVerificationToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N") // Long random string
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return user;
    }

    public async Task<bool> VerifyEmailAsync(string token)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.EmailVerificationToken == token);
        if (user == null) return false;

        user.IsEmailVerified = true;
        user.EmailVerificationToken = null; // Clear token after use
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || string.IsNullOrEmpty(user.PasswordHash))
            return new AuthResult { Status = AuthResultStatus.InvalidCredentials, Message = "Invalid email or password" };

        if (!_passwordHasher.VerifyPassword(password, user.PasswordHash))
            return new AuthResult { Status = AuthResultStatus.InvalidCredentials, Message = "Invalid email or password" };

        if (!user.IsEmailVerified)
            return new AuthResult { Status = AuthResultStatus.Error, Message = "Email not verified. Please check your inbox." };

        // Check MFA
        if (user.TwoFactorEnabled)
        {
            // Return temporary token for MFA verification step
            var mfaToken = _jwtService.GenerateTemporaryMfaToken(user);
            return new AuthResult { Status = AuthResultStatus.RequiresTwoFactor, Token = mfaToken };
        }

        // Login Success
        var token = _jwtService.GenerateToken(user);
        return new AuthResult { Status = AuthResultStatus.Success, Token = token };
    }

    // MFA: Step 1 - Generate Secret
    public async Task<(string Secret, string QrCodeUri)> GenerateMfaSecretAsync(Guid userId)
    {
        var key = KeyGeneration.GenerateRandomKey(20);
        var base32Secret = Base32Encoding.ToString(key);
        
        // We DON'T save it yet? Or we save it as pending?
        // Usually we verify first before saving to User entity, OR we save it but keep TwoFactorEnabled = false.
        // Let's save it but keep Enabled = false.
        
        var user = await _context.Users.FindAsync(userId);
        if (user == null) throw new Exception("User not found");

        user.TwoFactorSecret = base32Secret;
        // Don't enable yet!
        await _context.SaveChangesAsync();

        var qrCodeUri = $"otpauth://totp/BalanceIO:{user.Email}?secret={base32Secret}&issuer=BalanceIO&algorithm=SHA1&digits=6&period=30";
        return (base32Secret, qrCodeUri);
    }

    // MFA: Step 2 - Verify & Enable
    public async Task<bool> EnableMfaAsync(Guid userId, string code)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null || string.IsNullOrEmpty(user.TwoFactorSecret)) return false;

        var secretBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
        var totp = new Totp(secretBytes);
        
        // Window of 1 step (30s) before/after to allow slight clock drift
        bool valid = totp.VerifyTotp(code, out _, VerificationWindow.RfcSpecifiedNetworkDelay);

        if (valid)
        {
            user.TwoFactorEnabled = true;
            await _context.SaveChangesAsync();
            return true;
        }

        return false;
    }
    
    // MFA: Login Step - Verify Code & Get Token
    public async Task<AuthResult> VerifyTopAndLoginAsync(Guid userId, string code)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null || !user.TwoFactorEnabled || string.IsNullOrEmpty(user.TwoFactorSecret))
            return new AuthResult { Status = AuthResultStatus.Error, Message = "MFA setup invalid" };

        var secretBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
        var totp = new Totp(secretBytes);

        bool valid = totp.VerifyTotp(code, out _, VerificationWindow.RfcSpecifiedNetworkDelay);
        
        if (valid)
        {
            var token = _jwtService.GenerateToken(user);
            return new AuthResult { Status = AuthResultStatus.Success, Token = token };
        }
        
        return new AuthResult { Status = AuthResultStatus.InvalidCredentials, Message = "Invalid Code" };
    }

    public async Task<bool> ValidateMfaToken(Guid userId, string code)
    {
         var user = await _context.Users.FindAsync(userId);
        if (user == null || string.IsNullOrEmpty(user.TwoFactorSecret)) return false;
        
        var secretBytes = Base32Encoding.ToBytes(user.TwoFactorSecret);
        var totp = new Totp(secretBytes);
        return totp.VerifyTotp(code, out _, VerificationWindow.RfcSpecifiedNetworkDelay);
    }

    // Password Reset
    public async Task<User?> GeneratePasswordResetTokenAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null) return null;

        // Generate a secure random token (or use a short-lived JWT)
        // For simplicity and security, a long random string is fine if stored hashed, but here we store plain (dev).
        // Token valid for 1 hour.
        user.PasswordResetToken = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N");
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        
        await _context.SaveChangesAsync();
        return user;
    }

    /// <summary>
    /// Sets the new password and revokes every refresh-token session the user
    /// had, so a stolen session cannot be renewed after the owner resets.
    /// Returns null when the token is unknown or expired.
    /// </summary>
    public async Task<(Guid UserId, int RevokedSessions)?> ResetPasswordAsync(string token, string newPassword)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == token);

        if (user == null || user.PasswordResetTokenExpiresAt < DateTime.UtcNow)
        {
            return null;
        }

        user.PasswordHash = _passwordHasher.HashPassword(newPassword);
        user.PasswordResetToken = null; // Consume token
        user.PasswordResetTokenExpiresAt = null;

        // Same scoped context: the revocation's save also writes the new
        // password, so neither lands without the other.
        var revoked = await _sessionService.RevokeAllSessionsAsync(user.Id);
        return (user.Id, revoked);
    }

    public async Task<User?> GetUserByIdAsync(Guid userId)
    {
        return await _context.Users.FindAsync(userId);
    }
}
