using BalanceIO.API.Models;
using BalanceIO.API.Security;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Data;

/// <summary>
/// Boot-time database work. Schema comes from EF migrations in Production
/// (PostgreSQL) and from the model directly in other environments (SQLite
/// via EnsureCreated; the migrations are Npgsql-only). Nothing here issues
/// DDL, and nothing here swallows a failure: a database that cannot be
/// brought to the expected schema must stop the process.
/// </summary>
public static class DatabaseInitializer
{
    public static async Task RunAsync(IServiceProvider services, IHostEnvironment env, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        if (env.IsProduction())
        {
            logger.LogInformation("Applying migrations to PostgreSQL database...");
            await db.Database.MigrateAsync();
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        await ReferenceDataSeeder.SeedAsync(db, logger);

        var hasher = scope.ServiceProvider.GetRequiredService<Argon2PasswordHasher>();
        await SeedPlatformAdminAsync(db, hasher, env, logger);

        if (env.IsDevelopment())
        {
            await SeedDevelopmentUsersAsync(db, hasher, logger);
        }
    }

    private static async Task SeedPlatformAdminAsync(ApplicationDbContext db, Argon2PasswordHasher hasher, IHostEnvironment env, ILogger logger)
    {
        var credentials = AdminBootstrap.Resolve(env.IsDevelopment(), Environment.GetEnvironmentVariable);
        if (credentials is null)
        {
            logger.LogWarning(
                "No platform admin was created: set {EmailVar} and {PasswordVar} to bootstrap one.",
                AdminBootstrap.EmailVar, AdminBootstrap.PasswordVar);
            return;
        }

        var (email, password) = credentials.Value;
        var admin = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (admin is null)
        {
            db.Users.Add(new User
            {
                Name = "Super Admin", Email = email, IsAdmin = true, IsEmailVerified = true,
                PasswordHash = hasher.HashPassword(password),
            });
            await db.SaveChangesAsync();
            logger.LogInformation("Platform admin {Email} created.", email);
        }
        else if (env.IsDevelopment())
        {
            // Local convenience only: an existing account is never touched elsewhere.
            admin.PasswordHash = hasher.HashPassword(password);
            admin.IsEmailVerified = true;
            await db.SaveChangesAsync();
        }
    }

    private static async Task SeedDevelopmentUsersAsync(ApplicationDbContext db, Argon2PasswordHasher hasher, ILogger logger)
    {
        // Email verification is bypassed in Development so a fresh clone can sign in.
        await db.Users.Where(u => !u.IsEmailVerified).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsEmailVerified, true));

        const string demoEmail = "demo@balanceio.id";
        var demo = await db.Users.FirstOrDefaultAsync(u => u.Email == demoEmail);
        if (demo is null)
        {
            db.Users.Add(new User { Name = "Demo User", Email = demoEmail, IsEmailVerified = true, PasswordHash = hasher.HashPassword("password123") });
            logger.LogInformation("Development demo user created.");
        }
        else
        {
            demo.PasswordHash = hasher.HashPassword("password123");
        }
        await db.SaveChangesAsync();
    }
}
