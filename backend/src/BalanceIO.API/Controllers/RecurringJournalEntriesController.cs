using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using BalanceIO.API.Security;
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
public class RecurringJournalEntriesController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public RecurringJournalEntriesController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<IEnumerable<RecurringJournalEntry>>> GetAll()
    {
        return await _context.RecurringJournalEntries
            .Include(r => r.Lines)
            .ThenInclude(l => l.Account)
            .OrderBy(r => r.NextRunDate)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<ActionResult<RecurringJournalEntry>> GetById(Guid id)
    {
        var entry = await _context.RecurringJournalEntries
            .Include(r => r.Lines)
            .ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (entry == null) return NotFound();

        return Ok(entry);
    }

    [HttpPost]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<ActionResult<RecurringJournalEntry>> Create(RecurringJournalEntry entry)
    {
        if (entry.Id == Guid.Empty) entry.Id = Guid.NewGuid();
        
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        entry.CompanyId = _context.CurrentCompanyId.Value;
        
        // Ensure lines have IDs
        foreach (var line in entry.Lines)
        {
            if (line.Id == Guid.Empty) line.Id = Guid.NewGuid();
            line.RecurringJournalEntryId = entry.Id;
            // Prevent validation error on Account navigation
            line.Account = null!; 
        }

        entry.CreatedAt = DateTime.UtcNow;
        _context.RecurringJournalEntries.Add(entry);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = entry.Id }, entry);
    }

    [HttpPut("{id}")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> Update(Guid id, RecurringJournalEntry entry)
    {
        if (id != entry.Id) return BadRequest();

        var existing = await _context.RecurringJournalEntries
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (existing == null) return NotFound();

        existing.Description = entry.Description;
        existing.Frequency = entry.Frequency;
        existing.NextRunDate = entry.NextRunDate;
        existing.EndDate = entry.EndDate;
        existing.Reference = entry.Reference;
        existing.Amount = entry.Amount;
        existing.IsActive = entry.IsActive;
        existing.UpdatedAt = DateTime.UtcNow;

        // Update lines - Simple delete and recreate for now
        _context.RecurringJournalEntryLines.RemoveRange(existing.Lines);
        
        foreach (var line in entry.Lines)
        {
            line.Id = Guid.NewGuid();
            line.RecurringJournalEntryId = existing.Id;
            line.Account = null!;
            _context.RecurringJournalEntryLines.Add(line);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequiresPermission(Permissions.FinanceDelete)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var entry = await _context.RecurringJournalEntries.FindAsync(id);
        if (entry == null) return NotFound();

        _context.RecurringJournalEntries.Remove(entry);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // Process Manually Endpoint (Simplified Logic)
    [HttpPost("{id}/process")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> Process(Guid id)
    {
        var template = await _context.RecurringJournalEntries
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (template == null) return NotFound();

        // Create actual Journal Entry
        var je = new JournalEntry
        {
            Id = Guid.NewGuid(),
            // DateOnly conversion
            Date = DateOnly.FromDateTime(template.NextRunDate), 
            // Map Description to Notes as JournalEntry doesn't have Description
            Notes = template.Description + " (Recurring)",
            // Map Reference to ReferenceNumber
            ReferenceNumber = template.Reference,
            Status = JournalEntryStatus.Draft, 
            Lines = template.Lines.Select(l => new JournalLine
            {
                Id = Guid.NewGuid(),
                AccountId = l.AccountId.ToString(), // Convert Guid to string
                Description = l.Description,
                Debit = l.Debit,
                Credit = l.Credit
            }).ToList()
        };

        _context.JournalEntries.Add(je);

        // Update Template
        template.LastPostedDate = DateTime.UtcNow;
        template.NextRunDate = CalculateNextRunDate(template.Frequency, template.NextRunDate);

        await _context.SaveChangesAsync();

        return Ok(new { message = "Processed successfully", journalEntryId = je.Id });
    }

    private DateTime CalculateNextRunDate(RecurringFrequency frequency, DateTime current)
    {
        return frequency switch
        {
            RecurringFrequency.Daily => current.AddDays(1),
            RecurringFrequency.Weekly => current.AddDays(7),
            RecurringFrequency.Monthly => current.AddMonths(1),
            RecurringFrequency.Quarterly => current.AddMonths(3),
            RecurringFrequency.Yearly => current.AddYears(1),
            _ => current
        };
    }
}
