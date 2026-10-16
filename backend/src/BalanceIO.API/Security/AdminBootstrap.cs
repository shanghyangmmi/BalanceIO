namespace BalanceIO.API.Security;

/// <summary>
/// Decides which platform-admin account, if any, is created at boot.
///
/// A known password may exist only in Development. Everywhere else the
/// operator supplies both values; with neither set no account is created,
/// because a default credential on a fresh production database is a
/// working login for anyone who has read the repository.
/// </summary>
public static class AdminBootstrap
{
    public const string EmailVar = "BALANCEIO_ADMIN_EMAIL";
    public const string PasswordVar = "BALANCEIO_ADMIN_PASSWORD";
    public const int MinPasswordLength = 12;

    public const string DevelopmentEmail = "admin@balanceio.id";
    public const string DevelopmentPassword = "Admin123!";

    public static (string Email, string Password)? Resolve(bool isDevelopment, Func<string, string?> env)
    {
        var email = env(EmailVar);
        var password = env(PasswordVar);

        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(password))
            return isDevelopment ? (DevelopmentEmail, DevelopmentPassword) : null;

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
            throw new InvalidOperationException($"{EmailVar} and {PasswordVar} must be set together.");

        if (password.Length < MinPasswordLength)
            throw new InvalidOperationException($"{PasswordVar} must be at least {MinPasswordLength} characters.");

        return (email.Trim(), password);
    }
}
