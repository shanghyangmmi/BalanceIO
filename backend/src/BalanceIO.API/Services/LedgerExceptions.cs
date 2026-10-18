using System.ComponentModel.DataAnnotations;

namespace BalanceIO.API.Services;

/// <summary>
/// A write that would corrupt the ledger. Thrown from
/// <c>ApplicationDbContext.SaveChangesAsync</c>, so it reaches every posting
/// path. Derives from <see cref="InvalidOperationException"/> because the
/// balance guard has always thrown that type.
/// </summary>
public sealed class LedgerIntegrityException(string code, string message) : InvalidOperationException(message)
{
    public string Code { get; } = code;
}

/// <summary>The transaction date falls on or before the company's lock date.</summary>
public sealed class PeriodLockedException(string message) : ValidationException(message);

/// <summary>A payroll request the rules refuse. Carries its own status: 400, 403 or 409.</summary>
public sealed class PayrollRuleException(string code, string message, int status = 400) : InvalidOperationException(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}

/// <summary>An inventory request the rules refuse (unknown warehouse, insufficient stock).</summary>
public sealed class InventoryRuleException(string code, string message, int status = 400) : InvalidOperationException(message)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}
