using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/files")]
public class FilesController : ControllerBase
{
    private readonly BlobStorageService _blobStorageService;
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public FilesController(BlobStorageService blobStorageService, ApplicationDbContext context, IConfiguration configuration)
    {
        _blobStorageService = blobStorageService;
        _context = context;
        _configuration = configuration;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        // 0. Get User ID
        var userId = GetUserId();

        // 1. Check Total Storage Used (Configurable Limit)
        var maxStorageMB = _configuration.GetValue<int>("TierLimits:Free:MaxStorageMB");
        if (maxStorageMB == 0) maxStorageMB = 10; // Default

        var maxStorageBytes = maxStorageMB * 1024 * 1024L;

        var totalUsed = await _context.StoredFiles
            .Where(f => f.UserId == userId)
            .SumAsync(f => (long)f.Size);

        if (totalUsed + file.Length > maxStorageBytes)
        {
            return BadRequest($"Storage Limit Exceeded. You have used {totalUsed / 1024 / 1024.0:F2} MB of {maxStorageMB} MB.");
        }

        // Validate file type (optional, simple check)
        var allowedTypes = new[] { "image/jpeg", "image/png", "application/pdf" };
        if (!allowedTypes.Contains(file.ContentType))
            return BadRequest("Invalid file type. Only JPG, PNG, and PDF allowed.");

        using var stream = file.OpenReadStream();
        var (_, url) = await _blobStorageService.UploadFileAsync(stream, file.FileName, file.ContentType);

        // 2. Track File
        var storedFile = new StoredFile
        {
            Id = Guid.NewGuid(),
            FileName = file.FileName,
            ContentType = file.ContentType,
            Size = file.Length,
            Url = url,
            UserId = userId,
            UploadedAt = DateTime.UtcNow
        };
        _context.StoredFiles.Add(storedFile);
        await _context.SaveChangesAsync();

        return Ok(new { url });
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var userId = GetUserId();
        var files = await _context.StoredFiles
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.UploadedAt)
            .ToListAsync();
        
        return Ok(files);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        var file = await _context.StoredFiles.FirstOrDefaultAsync(f => f.Id == id && f.UserId == userId);

        if (file == null)
            return NotFound();

        // 1. Delete from Blob Storage
        await _blobStorageService.DeleteFileAsync(file.Url);

        // 2. Delete from DB
        _context.StoredFiles.Remove(file);
        await _context.SaveChangesAsync();

        return Ok();
    }

    private Guid GetUserId()
    {
        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) 
                      ?? User.FindFirst(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (idClaim == null) throw new UnauthorizedAccessException();
        return Guid.Parse(idClaim.Value);
    }
}
