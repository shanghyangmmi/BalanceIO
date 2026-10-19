using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace BalanceIO.API.Tests;

/// <summary>Runs only when BALANCEIO_TEST_POSTGRES names a server, e.g. "Host=localhost;Username=postgres;Password=pg".</summary>
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (string.IsNullOrEmpty(PostgresServer.Connection)) Skip = "BALANCEIO_TEST_POSTGRES is not set";
    }
}

public static class PostgresServer
{
    public static readonly string? Connection = Environment.GetEnvironmentVariable("BALANCEIO_TEST_POSTGRES");

    public static async Task<string> CreateDatabase()
    {
        var name = "bio_test_" + Guid.NewGuid().ToString("N")[..12];
        await using var conn = new NpgsqlConnection(Connection);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"CREATE DATABASE {name}", conn);
        await cmd.ExecuteNonQueryAsync();
        return name;
    }

    public static async Task DropDatabase(string name)
    {
        NpgsqlConnection.ClearAllPools();
        await using var conn = new NpgsqlConnection(Connection);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS {name} WITH (FORCE)", conn);
        await cmd.ExecuteNonQueryAsync();
    }

    public static string ConnectionTo(string database) => $"{Connection};Database={database}";

    public static ApplicationDbContext Context(string database) =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(ConnectionTo(database)).Options);

    public static async Task<List<string>> Columns(string database)
    {
        await using var conn = new NpgsqlConnection(ConnectionTo(database));
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("""
            SELECT table_name || '.' || column_name || ' ' || data_type || ' ' || COALESCE(character_maximum_length::text, '') ||
                   ' ' || COALESCE(numeric_precision::text, '') || ',' || COALESCE(numeric_scale::text, '') || ' ' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name <> '__EFMigrationsHistory'
            ORDER BY 1
            """, conn);
        var rows = new List<string>();
        await using var r = await cmd.ExecuteReaderAsync();
        while (await r.ReadAsync()) rows.Add(r.GetString(0));
        return rows;
    }

    public static async Task Exec(string database, string sql)
    {
        await using var conn = new NpgsqlConnection(ConnectionTo(database));
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }
}

/// <summary>C7: the migrations produce the model's schema from every state production can be in.</summary>
public class PostgresSchemaTests
{
    private static async Task<List<string>> ModelSchema()
    {
        var name = await PostgresServer.CreateDatabase();
        try
        {
            await using var db = PostgresServer.Context(name);
            await PostgresServer.Exec(name, db.Database.GenerateCreateScript());
            return await PostgresServer.Columns(name);
        }
        finally { await PostgresServer.DropDatabase(name); }
    }

    [PostgresFact]
    public async Task Fresh_database_built_by_migrations_matches_the_model()
    {
        var expected = await ModelSchema();
        var name = await PostgresServer.CreateDatabase();
        try
        {
            await using var db = PostgresServer.Context(name);
            await db.Database.MigrateAsync();
            Assert.Equal(expected, await PostgresServer.Columns(name));
        }
        finally { await PostgresServer.DropDatabase(name); }
    }

    [PostgresFact]
    public async Task Database_left_by_the_old_boot_patches_upgrades_to_the_model()
    {
        var expected = await ModelSchema();
        var name = await PostgresServer.CreateDatabase();
        try
        {
            await using var db = PostgresServer.Context(name);
            await db.GetService<IMigrator>().MigrateAsync("20260215191249_AddSubscriptionFeatures");
            await PostgresServer.Exec(name, await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Resources", "LegacyBootPatches.sql")));

            await db.Database.MigrateAsync();
            Assert.Equal(expected, await PostgresServer.Columns(name));
        }
        finally { await PostgresServer.DropDatabase(name); }
    }

    [PostgresFact]
    public async Task Upgrade_keeps_existing_rows_and_attributes_orphan_vouchers_to_their_contacts_company()
    {
        var name = await PostgresServer.CreateDatabase();
        try
        {
            await using var db = PostgresServer.Context(name);
            await db.GetService<IMigrator>().MigrateAsync("20260215191249_AddSubscriptionFeatures");
            await PostgresServer.Exec(name, await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Resources", "LegacyBootPatches.sql")));

            var company = Guid.NewGuid(); var other = Guid.NewGuid(); var contact = Guid.NewGuid(); var voucher = Guid.NewGuid(); var account = Guid.NewGuid();
            await PostgresServer.Exec(name, $"""
                INSERT INTO "Companies" ("Id","Name","Currency","IsOnboarded","FiscalYearStartMonth","CreatedAt","UpdatedAt") VALUES ('{company}','A','IDR',true,1,now(),now()), ('{other}','B','IDR',true,1,now(),now());
                """);
            await PostgresServer.Exec(name, $"""
                INSERT INTO "Contacts" ("Id","CompanyId","Code","Name","Type","Category","Scope","CreditLimit","PaymentTermDays","DefaultCurrency","IsActive","CreatedAt")
                VALUES ('{contact}','{company}','V-1','Vendor',1,0,0,0,30,'IDR',true,now());
                """);
            await PostgresServer.Exec(name, $"""
                INSERT INTO "Accounts" ("Id","CompanyId","Code","Name","Type","AccountGroup","Level","IsHeader","NormalBalance","CurrentBalance","IsSystemDefault","IsActive","CreatedAt")
                VALUES ('{account}','{company}','1-1000','Cash','Asset','Asset',1,false,'Debit',0,false,true,now());
                """);
            await PostgresServer.Exec(name, $"""
                INSERT INTO "PaymentVouchers" ("Id","ContactId","VoucherNumber","PaymentDate","PaymentType","PaymentMethod","PaymentAccountId","Currency","ExchangeRate","TotalAmount","Status","TemplateName","CreatedAt")
                VALUES ('{voucher}','{contact}','PV-1','2026-03-01',0,0,'{account}','IDR',1,100,0,'default',now());
                """);

            await db.Database.MigrateAsync();

            await using var conn = new NpgsqlConnection(PostgresServer.ConnectionTo(name));
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"""SELECT "CompanyId" FROM "PaymentVouchers" WHERE "Id" = '{voucher}'""", conn);
            Assert.Equal(company, (Guid)(await cmd.ExecuteScalarAsync())!);
        }
        finally { await PostgresServer.DropDatabase(name); }
    }
}

/// <summary>C5 (database-level balance), C6 (unique key) and the C1 foreign key, against real PostgreSQL.</summary>
public class PostgresLedgerTests : IAsyncLifetime
{
    private string _db = null!;
    private readonly Guid _company = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        if (string.IsNullOrEmpty(PostgresServer.Connection)) return;
        _db = await PostgresServer.CreateDatabase();
        await using var ctx = PostgresServer.Context(_db);
        await ctx.Database.MigrateAsync();
        await PostgresServer.Exec(_db, $"""
            INSERT INTO "Companies" ("Id","Name","Currency","IsOnboarded","FiscalYearStartMonth","CreatedAt","UpdatedAt","EnforceSegregationOfDuties","IsPkp","IsSuspended")
            VALUES ('{_company}','PT Uji','IDR',true,1,now(),now(),true,true,false)
            """);
    }

    public async Task DisposeAsync()
    {
        if (_db != null) await PostgresServer.DropDatabase(_db);
    }

    private static string Entry(Guid id, Guid company, int status, string? key = null) => $"""
        INSERT INTO "JournalEntries" ("Id","CompanyId","Date","Currency","CreatedAt","Status","IsAdjustingEntry","IdempotencyKey")
        VALUES ('{id}','{company}','2026-03-01','IDR',now(),{status},false,{(key == null ? "NULL" : $"'{key}'")});
        """;

    private static string Line(Guid entry, decimal debit, decimal credit) => $"""
        INSERT INTO "JournalLines" ("Id","JournalEntryId","AccountId","Debit","Credit") VALUES ('{Guid.NewGuid()}','{entry}','1-1000',{debit},{credit});
        """;

    private Task InTransaction(params string[] statements) => PostgresServer.Exec(_db, "BEGIN;\n" + string.Join("\n", statements) + "\nCOMMIT;");

    [PostgresFact]
    public async Task Balanced_posted_entry_commits_whatever_the_insert_order()
    {
        var inOrder = Guid.NewGuid();
        await InTransaction(Entry(inOrder, _company, 1), Line(inOrder, 5, 0), Line(inOrder, 0, 5));

        // Lines first would break the foreign key, so reverse order is exercised
        // by inserting the Draft first and posting it after its lines exist.
        var posted = Guid.NewGuid();
        await InTransaction(Entry(posted, _company, 0), Line(posted, 7, 0), Line(posted, 0, 7),
            $"""UPDATE "JournalEntries" SET "Status" = 1 WHERE "Id" = '{posted}';""");
    }

    [PostgresFact]
    public async Task Unbalanced_posted_entry_cannot_commit()
    {
        var id = Guid.NewGuid();
        var ex = await Assert.ThrowsAsync<PostgresException>(() => InTransaction(Entry(id, _company, 1), Line(id, 5, 0), Line(id, 0, 4)));
        Assert.Equal("23514", ex.SqlState);
    }

    [PostgresFact]
    public async Task Posted_entry_with_no_lines_cannot_commit()
    {
        var ex = await Assert.ThrowsAsync<PostgresException>(() => InTransaction(Entry(Guid.NewGuid(), _company, 1)));
        Assert.Equal("23514", ex.SqlState);
    }

    [PostgresFact]
    public async Task Draft_may_be_unbalanced_but_not_posted_that_way()
    {
        var id = Guid.NewGuid();
        await InTransaction(Entry(id, _company, 0), Line(id, 5, 0));
        var ex = await Assert.ThrowsAsync<PostgresException>(() =>
            PostgresServer.Exec(_db, $"""UPDATE "JournalEntries" SET "Status" = 1 WHERE "Id" = '{id}'"""));
        Assert.Equal("23514", ex.SqlState);
    }

    [PostgresFact]
    public async Task Deleting_a_line_of_a_posted_entry_cannot_unbalance_it()
    {
        var id = Guid.NewGuid();
        await InTransaction(Entry(id, _company, 1), Line(id, 5, 0), Line(id, 0, 5));
        var ex = await Assert.ThrowsAsync<PostgresException>(() =>
            PostgresServer.Exec(_db, $"""DELETE FROM "JournalLines" WHERE "JournalEntryId" = '{id}' AND "Credit" = 5"""));
        Assert.Equal("23514", ex.SqlState);
    }

    [PostgresFact]
    public async Task Duplicate_idempotency_key_in_one_company_is_refused()
    {
        await PostgresServer.Exec(_db, Entry(Guid.NewGuid(), _company, 0, "k1"));
        var ex = await Assert.ThrowsAsync<PostgresException>(() => PostgresServer.Exec(_db, Entry(Guid.NewGuid(), _company, 0, "k1")));
        Assert.Equal("23505", ex.SqlState);
    }

    [PostgresFact]
    public async Task Entry_without_a_company_violates_the_foreign_key_and_the_context_prevents_it()
    {
        var ex = await Assert.ThrowsAsync<PostgresException>(() => PostgresServer.Exec(_db, Entry(Guid.NewGuid(), Guid.Empty, 0)));
        Assert.Equal("23503", ex.SqlState);

        await using var ctx = PostgresServer.Context(_db);
        ctx.CurrentCompanyId = _company;
        var entry = new JournalEntry { Id = Guid.NewGuid(), Date = new DateOnly(2026, 3, 1) };
        ctx.JournalEntries.Add(entry);
        await ctx.SaveChangesAsync();
        Assert.Equal(_company, entry.CompanyId);
    }
}
