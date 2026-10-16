using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace BalanceIO.API.Controllers.Admin;

[Authorize(Roles = "SuperAdmin")]
[ApiController]
[Route("api/admin/system")]
public class AdminSystemController : ControllerBase
{
    private readonly AuditService _auditService;
    private readonly IWebHostEnvironment _env;
    private readonly BalanceIO.API.Data.ApplicationDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminSystemController> _logger;

    public AdminSystemController(AuditService auditService, IWebHostEnvironment env, BalanceIO.API.Data.ApplicationDbContext context, IConfiguration configuration, ILogger<AdminSystemController> logger)
    {
        _logger = logger;
        _auditService = auditService;
        _env = env;
        _context = context;
        _configuration = configuration;
    }

    /// <summary>
    /// Destructive operations are POST, and POST only.
    ///
    /// These were GET. A link prefetch, a browser that reopened its tabs, a
    /// crawler following the Swagger page - any of them could have dropped
    /// the production database, because a GET is what the web performs
    /// speculatively on your behalf. Authentication does not help: the
    /// request carries the administrator's own cookie.
    ///
    /// The typed confirmation is the second lock. It is not security
    /// theatre against an attacker who already holds a SuperAdmin token;
    /// it is there so that no single click, anywhere, is enough.
    /// </summary>
    public record DestructiveRequest(string Confirm);

    private const string ResetPhrase = "DELETE ALL DATA";

    [HttpPost("migrate")]
    public async Task<IActionResult> TriggerMigration()
    {
        try
        {
            _context.Database.Migrate();
            await AuditAsync("DB_MIGRATE", "Database", "Pending migrations applied.");
            return Ok(new { message = "Database migration applied successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Migration failed.");
            return StatusCode(500, new { error = "Migration failed", details = ex.Message });
        }
    }

    [HttpPost("reset-database")]
    public async Task<IActionResult> ResetDatabase([FromBody] DestructiveRequest request)
    {
        if (_env.IsProduction())
            return StatusCode(403, new { error = "Refused. A database reset is not available in production." });

        if (request?.Confirm != ResetPhrase)
            return BadRequest(new { error = $"Refused. Send confirm exactly as \"{ResetPhrase}\"." });

        try
        {
            await AuditAsync("DB_RESET", "Database", "Database dropped and re-migrated.");
            _context.Database.EnsureDeleted();
            _context.Database.Migrate();
            return Ok(new { message = "Database reset and re-migrated." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database reset failed.");
            return StatusCode(500, new { error = "Reset failed", details = ex.Message });
        }
    }

    /// <summary>
    /// A one-off PostgreSQL repair from an early migration, kept because a
    /// long-running instance may still need it. It is not a general tool -
    /// every statement here is specific to that one broken schema.
    /// </summary>
    [HttpPost("force-schema-fix")]
    public async Task<IActionResult> ForceSchemaFix([FromBody] DestructiveRequest request)
    {
        if (request?.Confirm != "FIX SCHEMA")
            return BadRequest(new { error = "Refused. Send confirm exactly as \"FIX SCHEMA\"." });

        if (!_context.Database.IsNpgsql())
            return BadRequest(new { error = "This repair only applies to PostgreSQL." });

        try
        {
            try { _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"IsAdmin\" DROP DEFAULT;"); } catch { }
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"IsAdmin\" TYPE boolean USING \"IsAdmin\"::boolean;");
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"IsAdmin\" SET DEFAULT false;");

            try { _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"TwoFactorEnabled\" DROP DEFAULT;"); } catch { }
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"TwoFactorEnabled\" TYPE boolean USING \"TwoFactorEnabled\"::boolean;");
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"TwoFactorEnabled\" SET DEFAULT false;");

            try { _context.Database.ExecuteSqlRaw("ALTER TABLE \"AuditLogs\" DROP CONSTRAINT \"FK_AuditLogs_Users_UserId\";"); } catch { }
            try { _context.Database.ExecuteSqlRaw("ALTER TABLE \"UserCompanies\" DROP CONSTRAINT \"FK_UserCompanies_Users_UserId\";"); } catch { }

            _context.Database.ExecuteSqlRaw("ALTER TABLE \"Users\" ALTER COLUMN \"Id\" TYPE uuid USING \"Id\"::uuid;");
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"AuditLogs\" ALTER COLUMN \"Id\" TYPE uuid USING \"Id\"::uuid;");
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"AuditLogs\" ALTER COLUMN \"UserId\" TYPE uuid USING \"UserId\"::uuid;");
            _context.Database.ExecuteSqlRaw("ALTER TABLE \"UserCompanies\" ALTER COLUMN \"UserId\" TYPE uuid USING \"UserId\"::uuid;");

            try { _context.Database.ExecuteSqlRaw("ALTER TABLE \"AuditLogs\" ADD CONSTRAINT \"FK_AuditLogs_Users_UserId\" FOREIGN KEY (\"UserId\") REFERENCES \"Users\" (\"Id\");"); } catch { }
            try { _context.Database.ExecuteSqlRaw("ALTER TABLE \"UserCompanies\" ADD CONSTRAINT \"FK_UserCompanies_Users_UserId\" FOREIGN KEY (\"UserId\") REFERENCES \"Users\" (\"Id\") ON DELETE CASCADE;"); } catch { }

            await AuditAsync("DB_SCHEMA_FIX", "Database", "Booleans and UUIDs corrected.");
            return Ok(new { message = "Schema repair applied: booleans and UUIDs corrected." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Schema repair failed.");
            return StatusCode(500, new { error = "Schema repair failed", details = ex.Message });
        }
    }

    private Task AuditAsync(string action, string target, string details) =>
        _auditService.LogAsync(
            CurrentUserId(),
            action,
            target,
            details,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"].ToString());

    private Guid? CurrentUserId()
    {
        var raw = User.FindFirst("UserId")?.Value
               ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(raw, out var id) ? id : null;
    }

    // ===================================================================
    // SQL SCRIPT RUNNER — Lists and executes SQL files from scripts folder
    // ===================================================================

    /// <summary>
    /// List available SQL scripts on the server
    /// </summary>
    [HttpGet("sql-scripts")]
    public IActionResult ListSqlScripts()
    {
        try
        {
            var scriptsDir = Path.Combine(_env.ContentRootPath, "..", "scripts");
            if (!Directory.Exists(scriptsDir))
            {
                // Try alternate location
                scriptsDir = Path.Combine(_env.ContentRootPath, "scripts");
            }

            if (!Directory.Exists(scriptsDir))
                return Ok(new { scripts = Array.Empty<object>(), message = "No scripts directory found." });

            var scripts = Directory.GetFiles(scriptsDir, "*.sql")
                .Select(f => new
                {
                    fileName = Path.GetFileName(f),
                    size = new FileInfo(f).Length,
                    lastModified = new FileInfo(f).LastWriteTimeUtc
                })
                .OrderBy(s => s.fileName)
                .ToList();

            return Ok(new { scripts, directory = scriptsDir });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to list scripts", details = ex.Message });
        }
    }

    /// <summary>
    /// Execute a specific SQL script file (must exist on server)
    /// </summary>
    [HttpPost("sql-scripts/run")]
    public async Task<IActionResult> RunSqlScript([FromBody] RunScriptRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.FileName))
                return BadRequest(new { error = "fileName is required" });

            // Prevent path traversal
            var safeFileName = Path.GetFileName(request.FileName);
            if (safeFileName != request.FileName || safeFileName.Contains(".."))
                return BadRequest(new { error = "Invalid file name" });

            var scriptsDir = Path.Combine(_env.ContentRootPath, "..", "scripts");
            if (!Directory.Exists(scriptsDir))
                scriptsDir = Path.Combine(_env.ContentRootPath, "scripts");

            var filePath = Path.Combine(scriptsDir, safeFileName);
            if (!System.IO.File.Exists(filePath))
                return NotFound(new { error = $"Script '{safeFileName}' not found" });

            var sql = await System.IO.File.ReadAllTextAsync(filePath);

            // Execute using raw connection for multi-statement scripts
            var connectionString = _configuration.GetConnectionString("DefaultConnection");
            using var conn = new NpgsqlConnection(connectionString);
            await conn.OpenAsync();
            using var cmd = new NpgsqlCommand(sql, conn);
            cmd.CommandTimeout = 120;
            var affected = await cmd.ExecuteNonQueryAsync();

            // Audit log
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers["User-Agent"].ToString();
            await _auditService.LogAsync(null, "SQL_SCRIPT_EXECUTED", safeFileName, $"Affected rows: {affected}", ip, userAgent);

            return Ok(new { message = $"Script '{safeFileName}' executed successfully", rowsAffected = affected });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Script execution failed", details = ex.Message, inner = ex.InnerException?.Message });
        }
    }

    // ===================================================================
    // CLEAN OLD FILES — Remove leftover .old_ files from deployment
    // ===================================================================

    /// <summary>
    /// List .old_ deployment artifacts taking up disk space
    /// </summary>
    [HttpGet("old-files")]
    public IActionResult ListOldFiles()
    {
        try
        {
            var apiDir = _env.ContentRootPath;
            var oldFiles = Directory.GetFiles(apiDir, "*.old_*", SearchOption.AllDirectories)
                .Select(f => new
                {
                    path = f.Replace(apiDir, "~"),
                    size = new FileInfo(f).Length,
                    created = new FileInfo(f).CreationTimeUtc
                })
                .ToList();

            var totalSizeMb = Math.Round(oldFiles.Sum(f => f.size) / 1024.0 / 1024.0, 2);

            return Ok(new { files = oldFiles, totalCount = oldFiles.Count, totalSizeMb });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to scan old files", details = ex.Message });
        }
    }

    /// <summary>
    /// Delete all .old_ deployment artifacts
    /// </summary>
    [HttpDelete("old-files")]
    public async Task<IActionResult> CleanOldFiles()
    {
        try
        {
            var apiDir = _env.ContentRootPath;
            var oldFiles = Directory.GetFiles(apiDir, "*.old_*", SearchOption.AllDirectories);
            
            var deleted = 0;
            var errors = new List<string>();
            long totalSize = 0;

            foreach (var file in oldFiles)
            {
                try
                {
                    totalSize += new FileInfo(file).Length;
                    System.IO.File.Delete(file);
                    deleted++;
                }
                catch (Exception ex)
                {
                    errors.Add($"{Path.GetFileName(file)}: {ex.Message}");
                }
            }

            var freedMb = Math.Round(totalSize / 1024.0 / 1024.0, 2);

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers["User-Agent"].ToString();
            await _auditService.LogAsync(null, "OLD_FILES_CLEANED", "Server", $"Deleted {deleted} files, freed {freedMb}MB", ip, userAgent);

            return Ok(new { message = $"Cleaned {deleted} files, freed {freedMb}MB", deleted, freedMb, errors });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to clean old files", details = ex.Message });
        }
    }

    // ===================================================================
    // SERVER INFO — Disk space and system status
    // ===================================================================

    /// <summary>
    /// Get server disk space and basic system info
    /// </summary>
    [HttpGet("server-info")]
    public IActionResult GetServerInfo()
    {
        try
        {
            var drives = DriveInfo.GetDrives()
                .Where(d => d.IsReady)
                .Select(d => new
                {
                    name = d.Name,
                    totalGb = Math.Round(d.TotalSize / 1024.0 / 1024.0 / 1024.0, 2),
                    freeGb = Math.Round(d.AvailableFreeSpace / 1024.0 / 1024.0 / 1024.0, 2),
                    usedGb = Math.Round((d.TotalSize - d.AvailableFreeSpace) / 1024.0 / 1024.0 / 1024.0, 2),
                    usedPercent = Math.Round((d.TotalSize - d.AvailableFreeSpace) * 100.0 / d.TotalSize, 1)
                })
                .ToList();

            return Ok(new
            {
                server = new
                {
                    machineName = Environment.MachineName,
                    os = Environment.OSVersion.ToString(),
                    runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription,
                    uptime = TimeSpan.FromMilliseconds(Environment.TickCount64).ToString(@"d\.hh\:mm\:ss")
                },
                drives
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to get server info", details = ex.Message });
        }
    }

    // ===================================================================
    // EXISTING: Restart & Maintenance
    // ===================================================================

    [HttpPost("restart")]
    public async Task<IActionResult> TriggerRestart()
    {
        try
        {
            var triggerFile = Path.Combine(_env.ContentRootPath, "restart.trigger");
            await System.IO.File.WriteAllTextAsync(triggerFile, $"Requested by {User.Identity?.Name ?? "Unknown"} at {DateTime.UtcNow}");

            var userAgent = Request.Headers["User-Agent"].ToString();
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            
            try 
            {
                await _auditService.LogAsync(null, "SYSTEM_RESTART_REQUESTED", "Server", "Restart Trigger File Created", ip, userAgent);
            }
            catch (Exception auditEx)
            {
                Console.WriteLine($"Audit Log Warning: {auditEx.Message}");
            }

            return Ok(new { message = "Restart sequence initiated. System will reboot in approx 60 seconds." });
        }
        catch (UnauthorizedAccessException authEx)
        {
             return StatusCode(500, $"Permission Denied: Cannot write to server root. Details: {authEx.Message}");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Failed to initiate restart: {ex.Message}. Path: {_env.ContentRootPath}");
        }
    }

    [HttpGet("maintenance")]
    public IActionResult GetMaintenanceStatus()
    {
        var lockFile = Path.Combine(_env.ContentRootPath, "maintenance.lock");
        return Ok(new { isMaintenanceOn = System.IO.File.Exists(lockFile) });
    }

    [HttpPost("maintenance")]
    public async Task<IActionResult> ToggleMaintenance([FromBody] MaintenanceRequest request)
    {
        var lockFile = Path.Combine(_env.ContentRootPath, "maintenance.lock");
        var userAgent = Request.Headers["User-Agent"].ToString();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

        try 
        {
            if (request.Enable)
            {
                if (!System.IO.File.Exists(lockFile))
                {
                    await System.IO.File.WriteAllTextAsync(lockFile, $"Maintenance Mode Enabled by {User.Identity?.Name} at {DateTime.UtcNow}");
                    await _auditService.LogAsync(null, "MAINTENANCE_ENABLED", "Server", "System put into maintenance mode", ip, userAgent);
                }
            }
            else
            {
                if (System.IO.File.Exists(lockFile))
                {
                    System.IO.File.Delete(lockFile);
                    await _auditService.LogAsync(null, "MAINTENANCE_DISABLED", "Server", "System restored from maintenance mode", ip, userAgent);
                }
            }
            return Ok(new { isMaintenanceOn = request.Enable });
        }
        catch (Exception ex)
        {
             return StatusCode(500, $"Failed to toggle maintenance: {ex.Message}");
        }
    }

    public class MaintenanceRequest
    {
        public bool Enable { get; set; }
    }

    public class RunScriptRequest
    {
        public string FileName { get; set; } = string.Empty;
    }
}
