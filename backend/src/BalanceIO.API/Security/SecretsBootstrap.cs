using System.Security.Cryptography;
using System.Text;

namespace BalanceIO.API.Security;

/// <summary>
/// Resolves the secrets that must never live in a tracked configuration
/// file. Every value here is read from the environment; the committed
/// <c>appsettings*.json</c> files hold empty placeholders only.
///
/// The rule this class enforces: in Production a missing or known-burned
/// secret is a startup failure, never a silent fallback to a default.
/// A silent fallback is how a leaked signing key comes back unnoticed
/// behind a green build.
/// </summary>
public static class SecretsBootstrap
{
    // Environment variable names.
    //
    // The framework's own double-underscore convention (Jwt__Key,
    // SmtpSettings__Password, ...) also binds to the same configuration
    // keys and is accepted. These explicit names are the documented ones
    // because they survive being passed through a shell, a Windows
    // service definition and `docker run -e` without escaping games.
    public const string JwtKeyVar       = "BALANCEIO_JWT_KEY";
    public const string DbConnectionVar = "BALANCEIO_DB_CONNECTION";
    public const string SmtpPasswordVar = "BALANCEIO_SMTP_PASSWORD";
    public const string SmtpUserVar     = "BALANCEIO_SMTP_USER";
    public const string AwsAccessKeyVar = "BALANCEIO_AWS_ACCESS_KEY";
    public const string AwsSecretKeyVar = "BALANCEIO_AWS_SECRET_KEY";

    /// <summary>
    /// Minimum length for the HMAC-SHA256 signing key. Below 256 bits the
    /// algorithm is weaker than advertised and the JWT library throws
    /// anyway - better to say so at startup than at first login.
    /// </summary>
    private const int MinJwtKeyBytes = 32;

    /// <summary>
    /// SHA-256 of the signing keys that were committed to this repository
    /// and are therefore public forever. Stored as hashes so the literals
    /// are not re-planted in a tracked file for a future reader to copy.
    ///
    ///   acec3981... from appsettings.json
    ///   fd45b412... from appsettings.Production.json
    /// </summary>
    private static readonly string[] BurnedJwtKeyHashes =
    {
        "acec3981bca260f2f5de288262682be013ca27f8f0dea9594ecd9230352b90ce",
        "fd45b4125b2066d90f2247d77f1d3803a76bab4b08d08796fc319a797202c82e",
    };

    /// <summary>
    /// Development-only signing key. Stable across restarts on purpose -
    /// a random per-boot key would invalidate every session on each
    /// <c>dotnet watch</c> reload. It is safe precisely because
    /// <see cref="Apply"/> refuses to let it reach Production.
    /// </summary>
    private const string DevelopmentJwtKey =
        "balanceio-local-development-signing-key-not-for-any-deployed-environment";

    /// <summary>
    /// Placeholder left in the committed Production connection string.
    /// Booting with it means the deployment never supplied real
    /// credentials.
    /// </summary>
    private const string ConnectionPlaceholder = "SetYourStrongPasswordHere";

    public static void Apply(WebApplicationBuilder builder)
    {
        var isProduction = builder.Environment.IsProduction();
        var config = builder.Configuration;

        ResolveJwtKey(config, isProduction);
        ResolveConnectionString(config, isProduction);
        ResolveOptionalSecrets(config);
    }

    // ---- JWT signing key: fatal in Production ------------------------

    private static void ResolveJwtKey(ConfigurationManager config, bool isProduction)
    {
        // Environment wins over configuration so a deployment can override
        // without editing a file baked into the image.
        var key = FirstNonEmpty(
            Environment.GetEnvironmentVariable(JwtKeyVar),
            config["Jwt:Key"]);

        if (isProduction)
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                throw new InvalidOperationException(
                    $"JWT signing key missing. Set the {JwtKeyVar} environment variable to a " +
                    $"random secret of at least {MinJwtKeyBytes} bytes. " +
                    "Production will not start with a default key.");
            }

            if (IsBurned(key))
            {
                throw new InvalidOperationException(
                    "JWT signing key rejected: this value was committed to the repository and is " +
                    $"public. Rotate it and set {JwtKeyVar} to a freshly generated secret.");
            }

            if (Encoding.UTF8.GetByteCount(key) < MinJwtKeyBytes)
            {
                throw new InvalidOperationException(
                    $"JWT signing key too short for HMAC-SHA256: {Encoding.UTF8.GetByteCount(key)} bytes, " +
                    $"minimum {MinJwtKeyBytes}. Set {JwtKeyVar} to a longer secret.");
            }
        }
        else
        {
            // Development and Staging keep working with no setup, but a
            // burned key is still never honoured - it would let a token
            // forged from the leaked key authenticate locally.
            if (string.IsNullOrWhiteSpace(key) || IsBurned(key) ||
                Encoding.UTF8.GetByteCount(key) < MinJwtKeyBytes)
            {
                key = DevelopmentJwtKey;
            }
        }

        // Both Program.cs and JwtService read Jwt:Key, so writing the
        // resolved value back keeps a single source of truth.
        config["Jwt:Key"] = key;
    }

    // ---- Database credentials: fatal in Production -------------------

    private static void ResolveConnectionString(ConfigurationManager config, bool isProduction)
    {
        var connection = FirstNonEmpty(
            Environment.GetEnvironmentVariable(DbConnectionVar),
            config.GetConnectionString("DefaultConnection"));

        if (isProduction)
        {
            if (string.IsNullOrWhiteSpace(connection))
            {
                throw new InvalidOperationException(
                    $"Database connection string missing. Set {DbConnectionVar}.");
            }

            if (connection.Contains(ConnectionPlaceholder, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    "Database connection string still contains the committed placeholder password. " +
                    $"Set {DbConnectionVar} to the real connection string.");
            }
        }

        if (!string.IsNullOrWhiteSpace(connection))
        {
            config["ConnectionStrings:DefaultConnection"] = connection;
        }
    }

    // ---- SMTP and object storage: degrade, do not crash --------------

    private static void ResolveOptionalSecrets(ConfigurationManager config)
    {
        // Outbound email and file upload are not on the critical path for
        // an accounting API. Refusing to boot because email is
        // unconfigured would take the ledger down with it, so these are
        // resolved quietly and reported by MissingOptionalSecrets.
        CopyIfSet(config, SmtpUserVar,     "SmtpSettings:User");
        CopyIfSet(config, SmtpPasswordVar, "SmtpSettings:Password");
        CopyIfSet(config, AwsAccessKeyVar, "AWS:AccessKey");
        CopyIfSet(config, AwsSecretKeyVar, "AWS:SecretKey");
    }

    /// <summary>
    /// Optional secrets that were not supplied, for a startup warning.
    /// Returns the feature that is degraded and the variable that fixes it.
    /// </summary>
    public static IEnumerable<(string Feature, string Variable)> MissingOptionalSecrets(
        IConfiguration config)
    {
        if (string.IsNullOrWhiteSpace(config["SmtpSettings:Password"]))
            yield return ("Outbound email (verification, password reset)", SmtpPasswordVar);

        if (string.IsNullOrWhiteSpace(config["AWS:SecretKey"]))
            yield return ("Object storage (file upload)", AwsSecretKeyVar);
    }

    // ---- helpers -----------------------------------------------------

    private static void CopyIfSet(ConfigurationManager config, string variable, string configKey)
    {
        var value = Environment.GetEnvironmentVariable(variable);
        if (!string.IsNullOrWhiteSpace(value)) config[configKey] = value;
    }

    private static string? FirstNonEmpty(params string?[] candidates) =>
        candidates.FirstOrDefault(c => !string.IsNullOrWhiteSpace(c));

    private static bool IsBurned(string key)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(key)))
            .ToLowerInvariant();
        return BurnedJwtKeyHashes.Contains(hash);
    }
}
