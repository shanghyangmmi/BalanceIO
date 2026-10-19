using System.Security.Cryptography;
using System.Text;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

public interface IDocumentHistoryService
{
    /// <summary>
    /// Appends a new tamper-evident event into the document's history trail.
    /// Cryptographically chains the new row to the prior event's hash.
    /// </summary>
    Task<DocumentHistoryEvent> RecordEventAsync(
        Guid companyId,
        string documentType,
        Guid documentId,
        string action,
        Guid actorUserId,
        string actorName,
        string? reason = null,
        string? diffSummaryJson = null,
        Guid? reversalDocumentId = null,
        CancellationToken ct = default);

    /// <summary>
    /// Retrieves the chronological history of events for a specific document.
    /// </summary>
    Task<IReadOnlyList<DocumentHistoryEvent>> GetDocumentHistoryAsync(
        Guid companyId,
        string documentType,
        Guid documentId,
        CancellationToken ct = default);
}

public class DocumentHistoryService : IDocumentHistoryService
{
    private readonly ApplicationDbContext _db;

    public DocumentHistoryService(ApplicationDbContext db)
    {
        _db = db;
    }

    public async Task<DocumentHistoryEvent> RecordEventAsync(
        Guid companyId,
        string documentType,
        Guid documentId,
        string action,
        Guid actorUserId,
        string actorName,
        string? reason = null,
        string? diffSummaryJson = null,
        Guid? reversalDocumentId = null,
        CancellationToken ct = default)
    {
        // 1. Fetch previous event for this document to build the hash chain
        var previousEvent = await _db.DocumentHistoryEvents
            .IgnoreQueryFilters()
            .Where(e => e.CompanyId == companyId && e.DocumentType == documentType && e.DocumentId == documentId)
            .OrderByDescending(e => e.Timestamp)
            .ThenByDescending(e => e.Id)
            .FirstOrDefaultAsync(ct);

        var previousHash = previousEvent?.RowHash ?? string.Empty;
        var timestamp = DateTime.UtcNow;

        // 2. Compute SHA-256 tamper-evident hash
        var payload = $"{previousHash}|{companyId}|{documentType}|{documentId}|{action}|{actorUserId}|{timestamp.Ticks}|{reason}|{diffSummaryJson}|{reversalDocumentId}";
        using var sha256 = SHA256.Create();
        var rowHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();

        var historyEvent = new DocumentHistoryEvent
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            DocumentType = documentType,
            DocumentId = documentId,
            Action = action,
            ActorUserId = actorUserId,
            ActorName = actorName,
            Timestamp = timestamp,
            Reason = reason,
            DiffSummaryJson = diffSummaryJson,
            ReversalDocumentId = reversalDocumentId,
            RowHash = rowHash,
            PreviousHash = previousHash
        };

        _db.DocumentHistoryEvents.Add(historyEvent);
        await _db.SaveChangesAsync(ct);

        return historyEvent;
    }

    public async Task<IReadOnlyList<DocumentHistoryEvent>> GetDocumentHistoryAsync(
        Guid companyId,
        string documentType,
        Guid documentId,
        CancellationToken ct = default)
    {
        return await _db.DocumentHistoryEvents
            .Where(e => e.CompanyId == companyId && e.DocumentType == documentType && e.DocumentId == documentId)
            .OrderBy(e => e.Timestamp)
            .ThenBy(e => e.Id)
            .AsNoTracking()
            .ToListAsync(ct);
    }
}
