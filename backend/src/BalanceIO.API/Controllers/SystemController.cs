using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

/// <summary>
/// Diagnostics for the database and the tenant query filters.
///
/// This controller carried no authorization attribute at all. Anyone who
/// could reach the API could call <c>debug-data</c>, which uses
/// <c>IgnoreQueryFilters()</c> on four tables and therefore reads across
/// every tenant by design - the exact isolation the global filters exist to
/// enforce. It also returned stack traces to the caller.
///
/// SuperAdmin now, and the filter-bypassing endpoint is Development-only on
/// top of that: a diagnostic whose whole purpose is to defeat tenant
/// isolation has no business being reachable in production, whoever is
/// holding the token.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperAdmin")]
public class SystemController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IWebHostEnvironment _env;

    public SystemController(ApplicationDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [HttpGet("debug-db")]
    public async Task<ActionResult> DebugDatabase()
    {
        try
        {
            var canConnect = await _context.Database.CanConnectAsync();
            if (!canConnect) return Ok("Database Connection FAILED.");

            var companyCount = await _context.Companies.CountAsync();
            var invoiceCount = await _context.SalesInvoices.CountAsync();
            var invoices = await _context.SalesInvoices.ToListAsync();
            var grouped = invoices.GroupBy(i => i.InvoiceDate.Month).ToList();

            return Ok(new
            {
                Status = "Success",
                CanConnect = canConnect,
                CompanyCount = companyCount,
                InvoiceCount = invoiceCount,
                GroupedCount = grouped.Count,
                Message = "Database is HEALTHY. No exceptions thrown."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, Failure("Database Integrity Check Failed", ex));
        }
    }

    /// <summary>
    /// Reads four tables with the tenant filters switched off, to show
    /// whether any row carries a null or mismatched CompanyId.
    ///
    /// Development only. The response is cross-tenant by construction.
    /// </summary>
    [HttpGet("debug-data")]
    public async Task<ActionResult> DebugData()
    {
        if (!_env.IsDevelopment())
        {
            // 404 rather than 403: outside Development this endpoint does
            // not exist, and saying so does not confirm it exists elsewhere.
            return NotFound();
        }

        try
        {
            var rawInvoices = await _context.SalesInvoices.IgnoreQueryFilters()
                .Select(i => new { i.Id, i.CompanyId, i.ProjectId, i.Total })
                .Take(5)
                .ToListAsync();

            var rawContacts = await _context.Contacts.IgnoreQueryFilters()
                .Select(c => new { c.Id, c.CompanyId, c.Name })
                .Take(5)
                .ToListAsync();

            var rawAccounts = await _context.Accounts.IgnoreQueryFilters()
                .Select(a => new { a.Code, a.CompanyId, a.Name })
                .Take(5)
                .ToListAsync();

            var rawJournalEntries = await _context.JournalEntries.IgnoreQueryFilters()
                .Select(j => new { j.Id, j.CompanyId })
                .Take(5)
                .ToListAsync();

            var currentCompanyId = _context.CurrentCompanyId;

            return Ok(new
            {
                CurrentContextCompanyId = currentCompanyId,
                SalesInvoices = rawInvoices,
                Contacts = rawContacts,
                Accounts = rawAccounts,
                JournalEntries = rawJournalEntries,
                Message = "If CompanyId is NULL in any rows, those rows won't match the global filter and could cause errors."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, Failure("Debug read failed", ex));
        }
    }

    /// <summary>
    /// A stack trace tells the caller the framework versions, the file
    /// layout and often the shape of the query that failed. In Development
    /// that is the point; anywhere else it is reconnaissance.
    /// </summary>
    private object Failure(string error, Exception ex) => _env.IsDevelopment()
        ? new
        {
            Error = error,
            Type = (string?)ex.GetType().Name,
            Message = ex.Message,
            StackTrace = ex.StackTrace,
            InnerException = ex.InnerException?.Message,
        }
        : new
        {
            Error = error,
            Type = (string?)null,
            Message = "See the server log.",
            StackTrace = (string?)null,
            InnerException = (string?)null,
        };
}
