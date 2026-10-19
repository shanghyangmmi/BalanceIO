namespace BalanceIO.API.DTOs;

/// <summary>
/// Client input for creating or editing a Draft journal entry. Tenant, status,
/// identity and approval fields are server-owned and deliberately absent.
/// </summary>
public class JournalEntryRequest
{
    public DateOnly Date { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Tags { get; set; }
    public string? ContactId { get; set; }
    public string? Currency { get; set; }
    public string? Notes { get; set; }
    public Guid? ProjectId { get; set; }
    public bool IsAdjustingEntry { get; set; }

    /// <summary>Accepted for older clients; only 0 (Draft) is valid. Post via /{id}/post.</summary>
    public int? Status { get; set; }

    public List<JournalLineRequest> Lines { get; set; } = new();
}

public class JournalLineRequest
{
    /// <summary>An account Code, or the account's Id; stored as the Code.</summary>
    public string AccountId { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public string? Tax { get; set; }
    public Guid? CostCenterId { get; set; }
    public Guid? ProjectId { get; set; }
}
