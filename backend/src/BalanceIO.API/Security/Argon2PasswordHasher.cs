using System.Security.Cryptography;
using Konscious.Security.Cryptography;
using BalanceIO.API.Models;

namespace BalanceIO.API.Security;

/// <summary>
/// State-of-the-art Argon2id password hasher.
/// Configuration based on OWASP recommendations for high-security applications.
/// </summary>
public class Argon2PasswordHasher
{
    // OWASP recommended settings for high-security applications
    private const int SaltSize = 16; // 128 bits
    private const int HashSize = 32; // 256 bits
    private const int MemorySize = 65536; // 64 MB (memory-hard)
    private const int Iterations = 4; // Time cost
    private const int DegreeOfParallelism = 4; // Parallel threads

    /// <summary>
    /// Hashes a password using Argon2id.
    /// Returns a base64 encoded string containing the salt and hash.
    /// </summary>
    public string HashPassword(string password)
    {
        if (string.IsNullOrEmpty(password))
            throw new ArgumentNullException(nameof(password));

        // Generate cryptographically secure salt
        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);

        // Create Argon2id hasher
        using var argon2 = new Argon2id(System.Text.Encoding.UTF8.GetBytes(password));
        argon2.Salt = salt;
        argon2.MemorySize = MemorySize;
        argon2.Iterations = Iterations;
        argon2.DegreeOfParallelism = DegreeOfParallelism;

        // Generate hash
        byte[] hash = argon2.GetBytes(HashSize);

        // Combine salt and hash for storage
        byte[] hashBytes = new byte[SaltSize + HashSize];
        Array.Copy(salt, 0, hashBytes, 0, SaltSize);
        Array.Copy(hash, 0, hashBytes, SaltSize, HashSize);

        return Convert.ToBase64String(hashBytes);
    }

    /// <summary>
    /// Verifies a password against a stored hash.
    /// </summary>
    public bool VerifyPassword(string password, string storedHash)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(storedHash))
            return false;

        try
        {
            // Decode the stored hash
            byte[] hashBytes = Convert.FromBase64String(storedHash);
            
            if (hashBytes.Length != SaltSize + HashSize)
                return false;

            // Extract salt and hash
            byte[] salt = new byte[SaltSize];
            byte[] storedHashBytes = new byte[HashSize];
            Array.Copy(hashBytes, 0, salt, 0, SaltSize);
            Array.Copy(hashBytes, SaltSize, storedHashBytes, 0, HashSize);

            // Compute hash of provided password
            using var argon2 = new Argon2id(System.Text.Encoding.UTF8.GetBytes(password));
            argon2.Salt = salt;
            argon2.MemorySize = MemorySize;
            argon2.Iterations = Iterations;
            argon2.DegreeOfParallelism = DegreeOfParallelism;

            byte[] computedHash = argon2.GetBytes(HashSize);

            // Constant-time comparison to prevent timing attacks
            return CryptographicOperations.FixedTimeEquals(computedHash, storedHashBytes);
        }
        catch
        {
            return false;
        }
    }
}
