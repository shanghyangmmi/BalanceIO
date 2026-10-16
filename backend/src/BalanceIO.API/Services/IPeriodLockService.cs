
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
}
