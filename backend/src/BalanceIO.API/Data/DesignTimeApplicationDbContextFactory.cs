using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace BalanceIO.API.Data;

/// <summary>
/// Design-time factory for EF Core migrations tooling.
/// BalanceIO migrations are PostgreSQL-only (PostgreSQL in production, SQLite in development EnsureCreated).
/// This ensures `dotnet ef migrations add` scaffolds PostgreSQL operations and types.
/// </summary>
public class DesignTimeApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=balanceio_design_time");
        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
