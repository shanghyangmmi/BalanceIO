using BalanceIO.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.Extensions.DependencyInjection;
using Xunit.Abstractions;

namespace BalanceIO.API.Tests;

/// <summary>
/// C7: the PostgreSQL migrations must describe the model exactly. The
/// database is never contacted; the snapshot and the model are diffed in memory.
/// </summary>
public class MigrationDriftTests(ITestOutputHelper output)
{
    private static ApplicationDbContext NpgsqlContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql("Host=unused;Database=unused").Options);

    [Fact]
    public void Model_has_no_changes_missing_from_migrations()
    {
        using var db = NpgsqlContext();
        var snapshot = db.GetService<IMigrationsAssembly>().ModelSnapshot;
        Assert.NotNull(snapshot);

        var differ = db.GetService<IMigrationsModelDiffer>();
        var current = db.GetService<IDesignTimeModel>().Model;
        var pending = differ.GetDifferences(
            db.GetService<IModelRuntimeInitializer>().Initialize(snapshot!.Model).GetRelationalModel(),
            current.GetRelationalModel());

        if (Environment.GetEnvironmentVariable("DRIFT_DUMP") is { } path) File.WriteAllLines(path, pending.Select(Describe));
        foreach (var op in pending) output.WriteLine(Describe(op));
        Assert.True(pending.Count == 0, $"{pending.Count} schema difference(s) between the model and the migrations:\n"
            + string.Join("\n", pending.Select(Describe)));
    }

    private static string Describe(MigrationOperation op) => op switch
    {
        AddColumnOperation a => $"AddColumn {a.Table}.{a.Name}",
        DropColumnOperation d => $"DropColumn {d.Table}.{d.Name}",
        AlterColumnOperation c => $"AlterColumn {c.Table}.{c.Name}",
        CreateTableOperation t => $"CreateTable {t.Name}",
        DropTableOperation t => $"DropTable {t.Name}",
        CreateIndexOperation i => $"CreateIndex {i.Table}.{i.Name}",
        DropIndexOperation i => $"DropIndex {i.Table}.{i.Name}",
        AddForeignKeyOperation f => $"AddFK {f.Table}.{f.Name}",
        DropForeignKeyOperation f => $"DropFK {f.Table}.{f.Name}",
        _ => op.GetType().Name,
    };
}
