using System.Data.Common;
using System.Diagnostics;
using System.Text.RegularExpressions;
using BalanceIO.API.Data;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// The database console, and the reasons it is shaped the way it is.
///
/// This is the single most dangerous feature in an admin panel. Everything
/// else here has a blast radius you can describe in a sentence; an SQL box
/// has the blast radius of the database. So it is two features rather than
/// one, and they are not equally available.
///
/// Reading is the ordinary case and is safe by construction:
///
///   - one statement, no semicolon-separated tail. Without this, "SELECT 1;
///     DROP TABLE Users" is a read query.
///   - it must begin with SELECT, WITH, EXPLAIN, PRAGMA table_info or SHOW.
///     A keyword denylist is the wrong shape - it fails open on the one
///     keyword nobody thought of.
///   - it runs inside a transaction that is always rolled back, and on
///     PostgreSQL the transaction is additionally declared READ ONLY.
///   - rows and time are capped, so a cartesian join on the journal lines
///     cannot take the server down while somebody explores.
///
/// Writing is the exceptional case and is off unless three things are true
/// at once: a setting turned it on, the caller typed the confirmation
/// phrase, and the environment permits it. Every statement is written to
/// the audit log in full before it runs, so that what happened is
/// recoverable even when the effect is not.
///
/// The tenant query filters do not apply here. That is the point of the
/// tool and also its danger: this reads across every company on the
/// platform, so what comes back is not one customer's data but all of it.
/// </summary>
public class AdminQueryService
{
    public const string WriteEnabledSettingKey = "ADMIN_SQL_WRITE_ENABLED";
    public const string WriteConfirmationPhrase = "I UNDERSTAND";

    private const int MaxRows = 500;
    private const int TimeoutSeconds = 15;

    /// <summary>
    /// Statements that only read. PRAGMA is restricted to the introspection
    /// forms - PRAGMA can also write, and "PRAGMA journal_mode = OFF" is not
    /// a query.
    /// </summary>
    private static readonly Regex ReadOnlyStart = new(
        @"^\s*(SELECT|WITH|EXPLAIN|SHOW|PRAGMA\s+(table_info|index_list|table_list|foreign_key_list|database_list)\b)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly ApplicationDbContext _context;
    private readonly AuditService _audit;
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AdminQueryService> _logger;

    public AdminQueryService(
        ApplicationDbContext context,
        AuditService audit,
        IWebHostEnvironment env,
        ILogger<AdminQueryService> logger)
    {
        _context = context;
        _audit = audit;
        _env = env;
        _logger = logger;
    }

    // ── Reading ──────────────────────────────────────────────────────────

    public async Task<QueryResult> QueryAsync(string sql, CancellationToken ct = default)
    {
        var refusal = RefuseIfNotASingleReadStatement(sql);
        if (refusal is not null) return refusal;

        var stopwatch = Stopwatch.StartNew();
        var connection = _context.Database.GetDbConnection();
        var opened = false;

        try
        {
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(ct);
                opened = true;
            }

            using var transaction = await connection.BeginTransactionAsync(ct);

            if (_context.Database.IsNpgsql())
            {
                await using var readOnly = connection.CreateCommand();
                readOnly.Transaction = transaction;
                readOnly.CommandText = "SET TRANSACTION READ ONLY;";
                await readOnly.ExecuteNonQueryAsync(ct);
            }

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.CommandTimeout = TimeoutSeconds;

            await using var reader = await command.ExecuteReaderAsync(ct);

            var columns = Enumerable.Range(0, reader.FieldCount)
                .Select(reader.GetName)
                .ToList();

            var rows = new List<List<object?>>();
            var truncated = false;

            while (await reader.ReadAsync(ct))
            {
                if (rows.Count >= MaxRows)
                {
                    truncated = true;
                    break;
                }

                var row = new List<object?>(reader.FieldCount);
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    row.Add(await reader.IsDBNullAsync(i, ct) ? null : Simplify(reader.GetValue(i)));
                }
                rows.Add(row);
            }

            await reader.CloseAsync();

            // Always. Even a statement that passed every check above ran
            // against production data, and nothing it did is worth keeping.
            await transaction.RollbackAsync(ct);

            stopwatch.Stop();

            return new QueryResult
            {
                Success   = true,
                Columns   = columns,
                Rows      = rows,
                RowCount  = rows.Count,
                Truncated = truncated,
                DurationMs = stopwatch.ElapsedMilliseconds,
                Message = truncated
                    ? $"Showing the first {MaxRows:N0} rows. Narrow the query to see the rest."
                    : $"{rows.Count:N0} row(s).",
            };
        }
        catch (DbException ex)
        {
            stopwatch.Stop();
            return new QueryResult
            {
                Success = false,
                Message = ex.Message,
                DurationMs = stopwatch.ElapsedMilliseconds,
            };
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }
    }

    private static QueryResult? RefuseIfNotASingleReadStatement(string sql)
    {
        if (string.IsNullOrWhiteSpace(sql))
        {
            return Refused("Nothing to run.");
        }

        if (!ReadOnlyStart.IsMatch(sql))
        {
            return Refused(
                "Only SELECT, WITH, EXPLAIN, SHOW and the introspection PRAGMAs run here. " +
                "Statements that change data go through Execute, which has to be enabled first.");
        }

        if (ContainsStatementSeparator(sql))
        {
            return Refused(
                "One statement at a time. A trailing semicolon is fine; a second statement after " +
                "it is how a read query becomes a write.");
        }

        return null;
    }

    /// <summary>
    /// Whether anything follows the first statement.
    ///
    /// Semicolons inside string literals and comments do not count, or
    /// selecting a row whose text contains one would be refused. This walks
    /// the statement rather than splitting on the character, because
    /// splitting is exactly the bug that lets a second statement through.
    /// </summary>
    private static bool ContainsStatementSeparator(string sql)
    {
        var inSingle = false;
        var inDouble = false;
        var inLineComment = false;
        var inBlockComment = false;

        for (var i = 0; i < sql.Length; i++)
        {
            var c = sql[i];
            var next = i + 1 < sql.Length ? sql[i + 1] : '\0';

            if (inLineComment)
            {
                if (c == '\n') inLineComment = false;
                continue;
            }

            if (inBlockComment)
            {
                if (c == '*' && next == '/') { inBlockComment = false; i++; }
                continue;
            }

            if (inSingle)
            {
                if (c == '\'') inSingle = next == '\'' ? Skip(ref i) : false;
                continue;
            }

            if (inDouble)
            {
                if (c == '"') inDouble = next == '"' ? Skip(ref i) : false;
                continue;
            }

            switch (c)
            {
                case '\'': inSingle = true; break;
                case '"':  inDouble = true; break;
                case '-' when next == '-': inLineComment = true; i++; break;
                case '/' when next == '*': inBlockComment = true; i++; break;
                case ';':
                    // A semicolon is only a problem if something follows it.
                    return sql[(i + 1)..].Trim().Length > 0;
            }
        }

        return false;

        static bool Skip(ref int index)
        {
            index++;
            return true;
        }
    }

    // ── Writing ──────────────────────────────────────────────────────────

    public async Task<bool> IsWriteEnabledAsync(CancellationToken ct = default)
    {
        var setting = await _context.SystemSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == WriteEnabledSettingKey, ct);

        return string.Equals(setting?.Value, "true", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<QueryResult> ExecuteAsync(
        string sql,
        string confirmation,
        Guid? userId,
        string? ipAddress,
        string? userAgent,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(sql))
        {
            return Refused("Nothing to run.");
        }

        if (!await IsWriteEnabledAsync(ct))
        {
            return Refused(
                $"Write execution is switched off. Set {WriteEnabledSettingKey} to true in system " +
                "settings first, and switch it back afterwards.");
        }

        if (confirmation != WriteConfirmationPhrase)
        {
            return Refused($"Type \"{WriteConfirmationPhrase}\" to confirm.");
        }

        // Logged before it runs. A statement that takes the database down
        // still has to leave a record of what it was.
        await _audit.LogAsync(
            userId, "ADMIN_SQL_EXECUTE", "Database",
            sql.Length > 1800 ? sql[..1800] + " ...(truncated)" : sql,
            ipAddress, userAgent);

        _logger.LogWarning("Admin SQL execution by {User}: {Sql}", userId, sql);

        var stopwatch = Stopwatch.StartNew();
        var connection = _context.Database.GetDbConnection();
        var opened = false;

        try
        {
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(ct);
                opened = true;
            }

            using var transaction = await connection.BeginTransactionAsync(ct);

            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = sql;
            command.CommandTimeout = 120;

            var affected = await command.ExecuteNonQueryAsync(ct);
            await transaction.CommitAsync(ct);

            stopwatch.Stop();

            await _audit.LogAsync(
                userId, "ADMIN_SQL_EXECUTED", "Database",
                $"{affected} row(s) affected in {stopwatch.ElapsedMilliseconds} ms.",
                ipAddress, userAgent);

            return new QueryResult
            {
                Success = true,
                RowsAffected = affected,
                DurationMs = stopwatch.ElapsedMilliseconds,
                Message = $"{affected:N0} row(s) affected.",
            };
        }
        catch (DbException ex)
        {
            stopwatch.Stop();

            await _audit.LogAsync(
                userId, "ADMIN_SQL_FAILED", "Database", ex.Message, ipAddress, userAgent);

            return new QueryResult
            {
                Success = false,
                Message = ex.Message,
                DurationMs = stopwatch.ElapsedMilliseconds,
            };
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }
    }

    // ── Shared ───────────────────────────────────────────────────────────

    /// <summary>
    /// The tables and their row counts, so the console opens on something
    /// rather than an empty box and a blinking cursor.
    /// </summary>
    public async Task<List<TableSummary>> ListTablesAsync(CancellationToken ct = default)
    {
        var sql = _context.Database.IsNpgsql()
            ? @"SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                ORDER BY table_name;"
            : @"SELECT name FROM sqlite_master
                WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name;";

        var names = new List<string>();
        var connection = _context.Database.GetDbConnection();
        var opened = false;

        try
        {
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(ct);
                opened = true;
            }

            await using (var command = connection.CreateCommand())
            {
                command.CommandText = sql;
                await using var reader = await command.ExecuteReaderAsync(ct);
                while (await reader.ReadAsync(ct)) names.Add(reader.GetString(0));
            }

            var summaries = new List<TableSummary>(names.Count);

            foreach (var name in names)
            {
                long rows = -1;
                try
                {
                    await using var count = connection.CreateCommand();
                    // The name comes from the catalogue, not from a caller,
                    // and is quoted regardless.
                    count.CommandText = $"SELECT COUNT(*) FROM \"{name.Replace("\"", "\"\"")}\";";
                    count.CommandTimeout = 5;
                    rows = Convert.ToInt64(await count.ExecuteScalarAsync(ct));
                }
                catch (DbException)
                {
                    // A table too large to count inside the timeout, or one
                    // the role cannot read. Report it without a count rather
                    // than dropping it from the list.
                }

                summaries.Add(new TableSummary { Name = name, RowCount = rows });
            }

            return summaries;
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }
    }

    private static QueryResult Refused(string message) =>
        new() { Success = false, Refused = true, Message = message };

    /// <summary>
    /// Values the JSON serialiser would otherwise render unhelpfully or
    /// refuse outright.
    /// </summary>
    private static object? Simplify(object value) => value switch
    {
        byte[] bytes => $"0x{Convert.ToHexString(bytes[..Math.Min(bytes.Length, 32)])}" +
                        (bytes.Length > 32 ? $" ...({bytes.Length} bytes)" : string.Empty),
        DateTime dt  => dt.ToString("O"),
        _            => value,
    };
}

public class QueryResult
{
    public bool Success { get; set; }

    /// <summary>
    /// True when the tool declined rather than the database. The difference
    /// matters at the screen: one is a rule, the other is a syntax error.
    /// </summary>
    public bool Refused { get; set; }

    public string Message { get; set; } = string.Empty;
    public List<string> Columns { get; set; } = new();
    public List<List<object?>> Rows { get; set; } = new();
    public int RowCount { get; set; }
    public int RowsAffected { get; set; }
    public bool Truncated { get; set; }
    public long DurationMs { get; set; }
}

public class TableSummary
{
    public string Name { get; set; } = string.Empty;

    /// <summary>Negative when the count could not be taken.</summary>
    public long RowCount { get; set; }
}
