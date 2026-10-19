
using BalanceIO.API.Data;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Services;

public class PeriodLockService : IPeriodLockService
{
    private readonly ApplicationDbContext _context;

    public PeriodLockService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task ValidateTransactionDate(Guid companyId, DateOnly transactionDate)
    {
        // Cache this? For now, DB call is fast enough given it's a primary key lookup
        var company = await _context.Companies.FindAsync(companyId);

        if (company != null && company.LockDate.HasValue)
        {
            if (transactionDate <= company.LockDate.Value)
            {
                throw new PeriodLockedException($"The transaction date {transactionDate:dd/MM/yyyy} is within a locked period (Locked until: {company.LockDate.Value:dd/MM/yyyy}). Action denied.");
            }
        }
    }

    public async Task ValidateTransactionDate(Guid companyId, DateTime transactionDate)
    {
        await ValidateTransactionDate(companyId, DateOnly.FromDateTime(transactionDate));
    }

    public async Task<DateOnly?> GetLockDateAsync(Guid companyId)
    {
        var company = await _context.Companies.FindAsync(companyId);
        return company?.LockDate;
    }

    public async Task LockPeriod(Guid companyId, DateOnly lockDate)
    {
        var company = await _context.Companies.FindAsync(companyId);
        if (company != null)
        {
            company.LockDate = lockDate;
            await _context.SaveChangesAsync();
        }
    }

    public async Task UnlockPeriod(Guid companyId)
    {
        var company = await _context.Companies.FindAsync(companyId);
        if (company != null)
        {
            company.LockDate = null;
            await _context.SaveChangesAsync();
        }
    }
}
