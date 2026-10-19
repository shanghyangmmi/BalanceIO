
using BalanceIO.API.Models;

namespace BalanceIO.API.Services;

public interface IPeriodLockService
{
    /// <summary>
    /// Checks if a transaction date is within a locked period for the given company.
    /// Throws ValidationException if locked.
    /// </summary>
    Task ValidateTransactionDate(Guid companyId, DateOnly transactionDate);

    /// <summary>
    /// Checks if a transaction date is within a locked period for the given company.
    /// Throws ValidationException if locked.
    /// Overload for DateTime (converts to DateOnly).
    /// </summary>
    Task ValidateTransactionDate(Guid companyId, DateTime transactionDate);

    /// <summary>
    /// Gets the current locked through date for the company, or null if unlocked.
    /// </summary>
    Task<DateOnly?> GetLockDateAsync(Guid companyId);

    /// <summary>
    /// Sets a hard period lock up to and including lockDate.
    /// </summary>
    Task LockPeriod(Guid companyId, DateOnly lockDate);

    /// <summary>
    /// Removes the period lock for the company.
    /// </summary>
    Task UnlockPeriod(Guid companyId);
}

