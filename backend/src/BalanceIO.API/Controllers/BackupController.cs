using System.IO.Compression;
using System.Text.Json;
using BalanceIO.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Exports the database as a JSON archive.
///
/// This carried no authorization attribute. A single unauthenticated GET
/// returned companies, contacts, the chart of accounts, every sales
/// invoice, purchase bill and journal entry with their lines, the asset
/// register, stock counts - and the SMTP settings, whose password column
/// is stored in plain text. That last one hands over a working mail sender
/// on the company's own domain, so it is now excluded from the archive
/// outright rather than merely put behind a login.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")]
public class BackupController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public BackupController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("download")]
    public async Task<IActionResult> DownloadBackup()
    {
        var backupData = new Dictionary<string, object>();

        // Fetch data from key tables
        backupData["Companies"] = await _context.Companies.AsNoTracking().ToListAsync();
        backupData["Accounts"] = await _context.Accounts.AsNoTracking().ToListAsync();
        backupData["Contacts"] = await _context.Contacts.AsNoTracking().ToListAsync();
        backupData["Products"] = await _context.Products.AsNoTracking().ToListAsync();
        
        // Fixed Assets Metadata
        backupData["FixedAssetCategories"] = await _context.FixedAssetCategories.AsNoTracking().ToListAsync();
        backupData["FixedAssetLocations"] = await _context.FixedAssetLocations.AsNoTracking().ToListAsync();
        
        // Complex entities with lines
        backupData["SalesInvoices"] = await _context.SalesInvoices
            .Include(i => i.Lines)
            .AsNoTracking()
            .ToListAsync();
            
        backupData["PurchaseBills"] = await _context.PurchaseBills
            .Include(b => b.Lines)
            .AsNoTracking()
            .ToListAsync();

        backupData["JournalEntries"] = await _context.JournalEntries
            .Include(j => j.Lines)
            .AsNoTracking()
            .ToListAsync();

        backupData["FixedAssets"] = await _context.FixedAssets.AsNoTracking().ToListAsync();
        
        // Inventory
        backupData["ProductCategories"] = await _context.ProductCategories.AsNoTracking().ToListAsync();
        backupData["ProductUnits"] = await _context.ProductUnits.AsNoTracking().ToListAsync();
        backupData["StockOpnames"] = await _context.StockOpnames
            .Include(o => o.Lines)
            .AsNoTracking()
            .ToListAsync();
            
        // Settings, without the credentials.
        //
        // SmtpPassword is stored unencrypted, so including the row would put
        // a live mail credential inside a file people email around and drop
        // in cloud storage. The host and sender identity are enough to
        // rebuild the configuration; the password has to be re-entered, and
        // that is the correct trade.
        backupData["EmailSettings"] = await _context.EmailSettings
            .AsNoTracking()
            .Select(e => new
            {
                e.Id,
                e.SmtpHost,
                e.SmtpPort,
                e.SmtpUsername,
                e.SenderEmail,
                e.SenderName,
                e.EnableSsl,
                e.IsActive,
                e.UpdatedAt,
                SmtpPassword = (string?)null,
            })
            .ToListAsync();

        // Serialize
        // IgnoreCycles, or this throws on anything with lines. StockOpnameLine
        // carries a StockOpname back-reference with no [JsonIgnore], so the
        // serializer walks Lines -> StockOpname -> Lines forever and gives up
        // at depth 64. The endpoint only ever appeared to work because it was
        // unauthenticated: with no company context the fail-closed query
        // filters returned zero rows, so there was nothing to cycle through.
        var json = JsonSerializer.Serialize(backupData, new JsonSerializerOptions
        {
            WriteIndented = true,
            ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
        });

        // Create Zip
        using var memoryStream = new MemoryStream();
        using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            var entry = archive.CreateEntry($"balanceio_backup_{DateTime.UtcNow:yyyyMMdd_HHmmss}.json");
            using var entryStream = entry.Open();
            using var streamWriter = new StreamWriter(entryStream);
            await streamWriter.WriteAsync(json);
        }

        memoryStream.Position = 0;
        return File(memoryStream.ToArray(), "application/zip", $"backup_{DateTime.UtcNow:yyyyMMdd_HHmmss}.zip");
    }
}
