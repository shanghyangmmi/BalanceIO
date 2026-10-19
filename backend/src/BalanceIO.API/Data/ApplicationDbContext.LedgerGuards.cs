using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Data;

// Ledger invariants enforced where every writer has to pass: SaveChangesAsync.
// Controllers validate for friendly errors; these guards are the backstop for
// the other dozen places that add journal entries.
public partial class ApplicationDbContext
{
    /// <summary>
    /// A new tenant-owned row that arrives without a company belongs to the
    /// request's company. Without this, Guid.Empty reaches the foreign key.
    /// Rows that name a company explicitly are left alone: admin and
    /// simulation code legitimately writes for companies other than the scope.
    /// </summary>
    private void StampTenantScope()
    {
        if (!CurrentCompanyId.HasValue) return;
        var scope = CurrentCompanyId.Value;

        foreach (var entry in ChangeTracker.Entries().Where(e => e.State == EntityState.Added))
        {
            var property = entry.Metadata.FindProperty("CompanyId");
            if (property?.ClrType != typeof(Guid)) continue;

            var companyId = entry.Property("CompanyId");
            if ((Guid)companyId.CurrentValue! == Guid.Empty) companyId.CurrentValue = scope;
        }
    }

    /// <summary>
    /// Maps account keys (an account Code, or the account's Id) to the Code
    /// that reports aggregate on. Only accounts of the given company match.
    /// </summary>
    public async Task<Dictionary<string, string>> ResolveAccountCodesAsync(
        Guid companyId, IEnumerable<string> keys, CancellationToken ct = default)
    {
        var wanted = keys.Where(k => !string.IsNullOrWhiteSpace(k)).Distinct().ToList();
        var ids = wanted.Select(k => Guid.TryParse(k, out var g) ? g : (Guid?)null)
                        .Where(g => g.HasValue).Select(g => g!.Value).ToList();

        var accounts = await Accounts.IgnoreQueryFilters().AsNoTracking()
            .Where(a => a.CompanyId == companyId && (wanted.Contains(a.Code) || ids.Contains(a.Id)))
            .Select(a => new { a.Id, a.Code })
            .ToListAsync(ct);

        var map = new Dictionary<string, string>();
        foreach (var key in wanted)
        {
            var hit = accounts.FirstOrDefault(a => a.Code == key)
                      ?? (Guid.TryParse(key, out var id) ? accounts.FirstOrDefault(a => a.Id == id) : null);
            if (hit is not null) map[key] = hit.Code;
        }
        return map;
    }

    private async Task EnforceLedgerInvariantsAsync(CancellationToken ct)
    {
        ChangeTracker.DetectChanges();

        var headers = ChangeTracker.Entries<JournalEntry>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList();
        var lines = ChangeTracker.Entries<JournalLine>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted).ToList();
        if (headers.Count == 0 && lines.Count == 0) return;

        EnforceStatusRules(headers);
        await EnforceFrozenLinesAsync(headers, lines, ct);
        await ResolveLineAccountsAsync(headers, lines, ct);
        await EnforceBalanceAsync(headers, ct);
        await EnforceDimensionRulesAsync(headers, lines, ct);
    }

    private static void EnforceStatusRules(List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalEntry>> headers)
    {
        foreach (var entry in headers)
        {
            if (entry.State == EntityState.Added) continue;
            var original = (JournalEntryStatus)entry.Property(e => e.Status).OriginalValue!;

            if (entry.State == EntityState.Deleted && original != JournalEntryStatus.Draft)
                throw new LedgerIntegrityException("LEDGER_DELETE_FORBIDDEN",
                    "Posted and Void entries are part of the permanent ledger and cannot be deleted.");

            if (entry.State != EntityState.Modified) continue;
            var current = entry.Entity.Status;
            var illegal = (original == JournalEntryStatus.Void && current != JournalEntryStatus.Void)
                       || (original == JournalEntryStatus.Posted && current == JournalEntryStatus.Draft);
            if (illegal)
                throw new LedgerIntegrityException("ILLEGAL_STATUS_TRANSITION",
                    $"A {original} journal entry cannot become {current}. Void or reverse it instead.");
        }
    }

    /// <summary>Lines of a Posted or Void entry never change, whatever route the change takes.</summary>
    private async Task EnforceFrozenLinesAsync(
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalEntry>> headers,
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalLine>> lines,
        CancellationToken ct)
    {
        if (lines.Count == 0) return;

        var persistedStatus = new Dictionary<Guid, JournalEntryStatus?>();
        foreach (var h in headers)
            persistedStatus[h.Entity.Id] = h.State == EntityState.Added ? null : (JournalEntryStatus)h.Property(e => e.Status).OriginalValue!;

        var unknown = lines.Select(l => l.Entity.JournalEntryId).Distinct().Where(id => !persistedStatus.ContainsKey(id)).ToList();
        if (unknown.Count > 0)
        {
            var rows = await JournalEntries.IgnoreQueryFilters().AsNoTracking()
                .Where(e => unknown.Contains(e.Id)).Select(e => new { e.Id, e.Status }).ToListAsync(ct);
            foreach (var r in rows) persistedStatus[r.Id] = r.Status;
        }

        foreach (var line in lines)
        {
            if (persistedStatus.TryGetValue(line.Entity.JournalEntryId, out var status)
                && status is JournalEntryStatus.Posted or JournalEntryStatus.Void)
            {
                throw new LedgerIntegrityException("POSTED_IMMUTABLE",
                    "Lines of a Posted or Void journal entry cannot be added, changed or removed.");
            }
        }
    }

    /// <summary>
    /// Every new line must name an account of the entry's own company, and is
    /// stored by account Code, the key all reports aggregate on.
    /// </summary>
    private async Task ResolveLineAccountsAsync(
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalEntry>> headers,
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalLine>> lines,
        CancellationToken ct)
    {
        var written = lines.Where(l => l.State == EntityState.Added
                                       || (l.State == EntityState.Modified && l.Property(x => x.AccountId).IsModified)).ToList();
        if (written.Count == 0) return;

        var companyOf = headers.Where(h => h.State != EntityState.Deleted).ToDictionary(h => h.Entity.Id, h => h.Entity.CompanyId);
        var missingParents = written.Select(l => l.Entity.JournalEntryId).Distinct().Where(id => !companyOf.ContainsKey(id)).ToList();
        if (missingParents.Count > 0)
        {
            var rows = await JournalEntries.IgnoreQueryFilters().AsNoTracking()
                .Where(e => missingParents.Contains(e.Id)).Select(e => new { e.Id, e.CompanyId }).ToListAsync(ct);
            foreach (var r in rows) companyOf[r.Id] = r.CompanyId;
        }

        foreach (var group in written.GroupBy(l => companyOf[l.Entity.JournalEntryId]))
        {
            var map = await ResolveAccountCodesAsync(group.Key, group.Select(l => l.Entity.AccountId), ct);
            foreach (var line in group)
            {
                if (!map.TryGetValue(line.Entity.AccountId, out var code))
                    throw new LedgerIntegrityException("ACCOUNT_NOT_FOUND",
                        $"Account '{line.Entity.AccountId}' does not exist in this company's chart of accounts.");
                line.Entity.AccountId = code;
            }
        }
    }

    private async Task EnforceBalanceAsync(
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalEntry>> headers, CancellationToken ct)
    {
        foreach (var entry in headers.Where(h => h.State is EntityState.Added or EntityState.Modified
                                                 && h.Entity.Status == JournalEntryStatus.Posted))
        {
            var journal = entry.Entity;
            var effective = ChangeTracker.Entries<JournalLine>()
                .Where(l => l.State != EntityState.Deleted && l.State != EntityState.Detached && l.Entity.JournalEntryId == journal.Id)
                .Select(l => l.Entity).ToList();

            if (entry.State == EntityState.Modified)
            {
                var tracked = effective.Select(l => l.Id).ToHashSet();
                var removed = ChangeTracker.Entries<JournalLine>().Where(l => l.State == EntityState.Deleted).Select(l => l.Entity.Id).ToHashSet();
                effective.AddRange(await JournalLines.IgnoreQueryFilters().AsNoTracking()
                    .Where(l => l.JournalEntryId == journal.Id && !tracked.Contains(l.Id) && !removed.Contains(l.Id))
                    .ToListAsync(ct));
            }

            if (effective.Count == 0)
                throw new LedgerIntegrityException("EMPTY_ENTRY",
                    $"Journal Entry '{journal.ReferenceNumber}' has no lines and cannot be Posted.");

            var totalDebit = effective.Sum(l => l.Debit);
            var totalCredit = effective.Sum(l => l.Credit);
            if (totalDebit != totalCredit)
                throw new LedgerIntegrityException("UNBALANCED",
                    $"Journal Entry '{journal.ReferenceNumber}' is unbalanced: total debit {totalDebit} != total credit {totalCredit}.");
        }
    }

    private async Task EnforceDimensionRulesAsync(
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalEntry>> headers,
        List<Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<JournalLine>> lines,
        CancellationToken ct)
    {
        var postedHeaders = headers.Where(h => h.State is EntityState.Added or EntityState.Modified
                                               && h.Entity.Status == JournalEntryStatus.Posted).ToList();
        if (postedHeaders.Count == 0) return;

        foreach (var header in postedHeaders)
        {
            var journal = header.Entity;
            var effectiveLines = ChangeTracker.Entries<JournalLine>()
                .Where(l => l.State != EntityState.Deleted && l.State != EntityState.Detached && l.Entity.JournalEntryId == journal.Id)
                .Select(l => l.Entity).ToList();

            if (header.State == EntityState.Modified)
            {
                var tracked = effectiveLines.Select(l => l.Id).ToHashSet();
                var removed = ChangeTracker.Entries<JournalLine>().Where(l => l.State == EntityState.Deleted).Select(l => l.Entity.Id).ToHashSet();
                effectiveLines.AddRange(await JournalLines.IgnoreQueryFilters().AsNoTracking()
                    .Where(l => l.JournalEntryId == journal.Id && !tracked.Contains(l.Id) && !removed.Contains(l.Id))
                    .ToListAsync(ct));
            }

            if (effectiveLines.Count == 0) continue;

            // Load accounts to inspect DimensionRule
            var accountKeys = effectiveLines.Select(l => l.AccountId).Distinct().ToList();
            var guidKeys = accountKeys.Where(k => Guid.TryParse(k, out _)).Select(Guid.Parse).ToList();

            var accountsList = await Accounts.IgnoreQueryFilters().AsNoTracking()
                .Where(a => a.CompanyId == journal.CompanyId && (accountKeys.Contains(a.Code) || guidKeys.Contains(a.Id)))
                .ToListAsync(ct);

            var accountByCode = accountsList.GroupBy(a => a.Code).ToDictionary(g => g.Key, g => g.First());
            var accountById = accountsList.ToDictionary(a => a.Id.ToString(), a => a);

            // Check DimensionRules on each line
            foreach (var line in effectiveLines)
            {
                Account? acc = null;
                if (!accountByCode.TryGetValue(line.AccountId, out acc))
                {
                    accountById.TryGetValue(line.AccountId, out acc);
                }

                if (acc != null)
                {
                    if (acc.DimensionRule == DimensionRule.Required && !line.CostCenterId.HasValue)
                    {
                        throw new LedgerIntegrityException("COST_CENTER_REQUIRED",
                            $"Account '{acc.Code}' requires a cost center.");
                    }

                    if (acc.DimensionRule == DimensionRule.Forbidden && line.CostCenterId.HasValue)
                    {
                        throw new LedgerIntegrityException("COST_CENTER_FORBIDDEN",
                            $"Account '{acc.Code}' cannot carry a cost center.");
                    }
                }
            }

            // Tenant boundary validation for line-level CostCenterId and ProjectId
            var costCenterIds = effectiveLines.Where(l => l.CostCenterId.HasValue).Select(l => l.CostCenterId!.Value).Distinct().ToList();
            if (costCenterIds.Count > 0)
            {
                var trackedCc = ChangeTracker.Entries<CostCenter>()
                    .Where(c => c.State != EntityState.Deleted && c.Entity.CompanyId == journal.CompanyId && costCenterIds.Contains(c.Entity.Id))
                    .Select(c => c.Entity.Id).ToHashSet();

                var remainingCcIds = costCenterIds.Where(id => !trackedCc.Contains(id)).ToList();
                if (remainingCcIds.Count > 0)
                {
                    var validCount = await CostCenters.IgnoreQueryFilters().AsNoTracking()
                        .CountAsync(c => c.CompanyId == journal.CompanyId && remainingCcIds.Contains(c.Id), ct);
                    if (validCount != remainingCcIds.Count)
                    {
                        throw new LedgerIntegrityException("INVALID_COST_CENTER",
                            "One or more cost centers do not belong to this company.");
                    }
                }
            }

            var projectIds = effectiveLines.Where(l => l.ProjectId.HasValue).Select(l => l.ProjectId!.Value).Distinct().ToList();
            if (projectIds.Count > 0)
            {
                var trackedProjects = ChangeTracker.Entries<Project>()
                    .Where(p => p.State != EntityState.Deleted && p.Entity.CompanyId == journal.CompanyId && projectIds.Contains(p.Entity.Id))
                    .Select(p => p.Entity.Id).ToHashSet();

                var remainingProjectIds = projectIds.Where(id => !trackedProjects.Contains(id)).ToList();
                if (remainingProjectIds.Count > 0)
                {
                    var validCount = await Projects.IgnoreQueryFilters().AsNoTracking()
                        .CountAsync(p => p.CompanyId == journal.CompanyId && remainingProjectIds.Contains(p.Id), ct);
                    if (validCount != remainingProjectIds.Count)
                    {
                        throw new LedgerIntegrityException("INVALID_PROJECT",
                            "One or more projects do not belong to this company.");
                    }
                }
            }
        }
    }
}
