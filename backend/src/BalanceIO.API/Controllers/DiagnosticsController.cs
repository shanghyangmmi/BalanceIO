using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace BalanceIO.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class DiagnosticsController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public DiagnosticsController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("run")]
    public async Task<IActionResult> RunDiagnostics()
    {
        if (!_context.CurrentCompanyId.HasValue)
            return BadRequest("Company context is required");

        var companyId = _context.CurrentCompanyId.Value;

        // 1. Sequence Gaps
        var invoiceGaps = await FindInvoiceGaps(companyId);
        var billGaps = await FindBillGaps(companyId);

        // 2. Weekend and Off-Hours Postings
        var unusualPostings = await FindUnusualPostings(companyId);

        // 3. Negative Balances
        var negativeBalances = await FindNegativeBalances(companyId);

        // 4. Unposted Draft Entries
        var unpostedDrafts = await FindUnpostedDrafts(companyId);

        return Ok(new
        {
            invoiceGaps,
            billGaps,
            unusualPostings,
            negativeBalances,
            unpostedDrafts
        });
    }

    private async Task<List<string>> FindInvoiceGaps(Guid companyId)
    {
        var numbers = await _context.SalesInvoices
            .Where(i => i.CompanyId == companyId && i.Status != InvoiceStatus.Void && i.Status != InvoiceStatus.Draft)
            .Select(i => i.InvoiceNumber)
            .ToListAsync();

        return FindGapsInSequence(numbers, "INV");
    }

    private async Task<List<string>> FindBillGaps(Guid companyId)
    {
        var numbers = await _context.PurchaseBills
            .Where(b => b.CompanyId == companyId && b.Status != BillStatus.Void && b.Status != BillStatus.Draft)
            .Select(b => b.BillNumber)
            .ToListAsync();

        return FindGapsInSequence(numbers, "BIL");
    }

    private List<string> FindGapsInSequence(List<string> codes, string defaultPrefix)
    {
        var gaps = new List<string>();
        if (codes == null || codes.Count < 2) return gaps;

        var parsed = new List<(string Prefix, int Number, string Original)>();
        foreach (var code in codes)
        {
            var match = Regex.Match(code, @"^(?<prefix>.*?)(?<num>\d+)$");
            if (match.Success)
            {
                var prefix = match.Groups["prefix"].Value;
                if (int.TryParse(match.Groups["num"].Value, out var num))
                {
                    parsed.Add((prefix, num, code));
                }
            }
        }

        var groups = parsed.GroupBy(p => p.Prefix);
        foreach (var group in groups)
        {
            var sorted = group.OrderBy(x => x.Number).ToList();
            for (int i = 0; i < sorted.Count - 1; i++)
            {
                var current = sorted[i].Number;
                var next = sorted[i + 1].Number;
                if (next > current + 1)
                {
                    for (int gap = current + 1; gap < next; gap++)
                    {
                        if (gaps.Count >= 20) break;
                        var padLength = sorted[i].Original.Length - sorted[i].Prefix.Length;
                        var numStr = gap.ToString().PadLeft(padLength > 0 ? padLength : 1, '0');
                        gaps.Add($"{sorted[i].Prefix}{numStr}");
                    }
                }
            }
        }

        return gaps;
    }

    private async Task<List<object>> FindUnusualPostings(Guid companyId)
    {
        var entries = await _context.JournalEntries
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Posted)
            .ToListAsync();

        var unusual = new List<object>();
        foreach (var entry in entries)
        {
            var date = entry.Date;
            var dayOfWeek = date.DayOfWeek;
            var isWeekend = dayOfWeek == DayOfWeek.Saturday || dayOfWeek == DayOfWeek.Sunday;

            // WIB (UTC+7) off-hours estimation: local hour >= 22 or local hour < 5
            var localTime = entry.CreatedAt.AddHours(7);
            var isOffHours = localTime.Hour >= 22 || localTime.Hour < 5;

            if (isWeekend || isOffHours)
            {
                unusual.Add(new
                {
                    entryId = entry.Id,
                    reference = entry.ReferenceNumber ?? entry.Id.ToString().Substring(0, 8),
                    date = entry.Date,
                    createdAt = entry.CreatedAt,
                    reason = isWeekend && isOffHours ? "Weekend & Off-Hours" : (isWeekend ? "Weekend Posting" : "Off-Hours Posting"),
                    day = dayOfWeek.ToString(),
                    time = localTime.ToString("HH:mm")
                });
            }
        }

        return unusual;
    }

    private async Task<List<object>> FindNegativeBalances(Guid companyId)
    {
        var cashAccounts = await _context.Accounts
            .Where(a => a.CompanyId == companyId && a.IsActive && 
                        (a.Code.StartsWith("1-1") || a.Name.Contains("Cash") || a.Name.Contains("Bank")))
            .ToListAsync();

        if (!cashAccounts.Any()) return new List<object>();

        var codes = cashAccounts.Select(a => a.Code).ToList();

        var lines = await _context.JournalLines
            .Where(l => codes.Contains(l.AccountId) && l.JournalEntry!.Status == JournalEntryStatus.Posted)
            .ToListAsync();

        var balances = lines
            .GroupBy(l => l.AccountId)
            .Select(g => new
            {
                AccountCode = g.Key,
                Balance = g.Sum(l => l.Debit - l.Credit)
            })
            .ToList();

        var negative = new List<object>();
        foreach (var b in balances.Where(x => x.Balance < 0))
        {
            var acc = cashAccounts.FirstOrDefault(a => a.Code == b.AccountCode);
            if (acc != null)
            {
                negative.Add(new
                {
                    accountCode = b.AccountCode,
                    accountName = acc.Name,
                    balance = b.Balance
                });
            }
        }

        return negative;
    }

    private async Task<List<object>> FindUnpostedDrafts(Guid companyId)
    {
        var thresholdDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-30));

        var drafts = await _context.JournalEntries
            .Where(j => j.CompanyId == companyId && j.Status == JournalEntryStatus.Draft && j.Date < thresholdDate)
            .OrderBy(j => j.Date)
            .Select(j => new
            {
                entryId = j.Id,
                reference = j.ReferenceNumber ?? j.Id.ToString().Substring(0, 8),
                date = j.Date,
                ageDays = (DateTime.UtcNow - new DateTime(j.Date.Year, j.Date.Month, j.Date.Day)).Days,
                notes = j.Notes
            })
            .ToListAsync();

        return drafts.Cast<object>().ToList();
    }
}
