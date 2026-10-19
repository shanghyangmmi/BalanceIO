using BalanceIO.API.Data;
using BalanceIO.API.Security;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Authorization was missing from this controller entirely. Nothing public
/// calls it - the marketing site only talks to /auth - so requiring a token
/// changes nothing for a signed-in user and closes the endpoint to everyone
/// else. Tenant scoping still comes from the global query filters; this is
/// the layer in front of them, not a replacement for it.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CompanyController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public CompanyController(ApplicationDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// The company named by the request's X-Company-Id, which the scope
    /// middleware has already checked the caller belongs to. Companies carry
    /// no global query filter, so every lookup here must go through this.
    /// </summary>
    private Task<Company?> CurrentCompanyAsync() =>
        _context.CurrentCompanyId is Guid id
            ? _context.Companies.FirstOrDefaultAsync(c => c.Id == id)
            : Task.FromResult<Company?>(null);

    /// <summary>
    /// Get the current company profile
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<Company?>> GetCompany()
    {
        return Ok(await CurrentCompanyAsync());
    }

    /// <summary>
    /// Check if company has been onboarded
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult<object>> GetOnboardingStatus()
    {
        var company = await CurrentCompanyAsync();
        return Ok(new
        {
            isOnboarded = company?.IsOnboarded ?? false,
            companyName = company?.Name
        });
    }

    /// <summary>
    /// Create company during onboarding
    /// </summary>
    [RequiresPermission(Permissions.SettingsManage)]
    [HttpPost("onboard")]
    public async Task<ActionResult<Company>> Onboard([FromBody] CompanyOnboardRequest request)
    {
        // Companies are created for a user by GET /api/Users/me/companies;
        // onboarding completes the profile of the company in scope.
        var company = await CurrentCompanyAsync();
        if (company == null)
            return NotFound(new { error = "Company not found. Select a company first." });

        // Update (idempotent)
        company.Name = request.Name;
        company.Industry = request.Industry;
        // Only update currency if not set or explicitly requested (usually safer to keep existing currency if transactions exist, but for onboarding we assume fresh)
        if (!string.IsNullOrEmpty(request.Currency)) company.Currency = request.Currency; 
        company.Address = request.Address;
        company.City = request.City ?? "Jakarta";
        company.Country = request.Country ?? "Indonesia";
        company.IsOnboarded = true;
        company.UpdatedAt = DateTime.UtcNow;
        
        _context.Companies.Update(company);

        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCompany), new { id = company.Id }, company);
    }

    /// <summary>
    /// Update company profile
    /// </summary>
    [RequiresPermission(Permissions.SettingsManage)]
    [HttpPut]
    public async Task<ActionResult<Company>> UpdateCompany([FromBody] CompanyUpdateRequest request)
    {
        var company = await CurrentCompanyAsync();
        if (company == null)
        {
            return NotFound(new { error = "Company not found. Complete onboarding first." });
        }

        // Update fields
        if (!string.IsNullOrWhiteSpace(request.Name))
            company.Name = request.Name;
        if (request.Industry != null)
            company.Industry = request.Industry;
        if (!string.IsNullOrWhiteSpace(request.Currency))
            company.Currency = request.Currency;
        if (request.Address != null)
            company.Address = request.Address;
        if (request.City != null)
            company.City = request.City;
        if (request.Country != null)
            company.Country = request.Country;
        if (request.Phone != null)
            company.Phone = request.Phone;
        if (request.Email != null)
            company.Email = request.Email;
        if (request.TaxId != null)
            company.TaxId = request.TaxId;
        if (request.LogoUrl != null)
            company.LogoUrl = request.LogoUrl;
        if (request.FiscalYearStartMonth.HasValue)
            company.FiscalYearStartMonth = request.FiscalYearStartMonth.Value;

        company.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(company);
    }
}

// DTOs
public class CompanyOnboardRequest
{
    public required string Name { get; set; }
    public string? Industry { get; set; }
    public string? Currency { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
}

public class CompanyUpdateRequest
{
    public string? Name { get; set; }
    public string? Industry { get; set; }
    public string? Currency { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? TaxId { get; set; }
    public string? LogoUrl { get; set; }
    public int? FiscalYearStartMonth { get; set; }
}
