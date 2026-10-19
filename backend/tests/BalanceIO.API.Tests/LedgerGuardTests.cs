using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>C5: invariants hold at SaveChangesAsync, whichever code path built the change.</summary>
public class LedgerGuardTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static JournalEntry Entry(TestTenant t, JournalEntryStatus status, params (string account, decimal dr, decimal cr)[] lines) => new()
    {
        Id = Guid.NewGuid(), CompanyId = t.CompanyId, Date = new DateOnly(2026, 3, 1), ReferenceNumber = "G-" + Guid.NewGuid().ToString("N")[..6],
        Status = status,
        Lines = lines.Select(l => new JournalLine { Id = Guid.NewGuid(), AccountId = l.account, Debit = l.dr, Credit = l.cr }).ToList(),
    };

    private Task Save(TestTenant t, Func<Data.ApplicationDbContext, Task> change) =>
        factory.WithDb(async db => { await change(db); await db.SaveChangesAsync(); }, t.CompanyId);

    [Fact]
    public async Task Posted_entry_with_no_lines_is_rejected()
    {
        var t = factory.CreateTenant();
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, db => { db.JournalEntries.Add(Entry(t, JournalEntryStatus.Posted)); return Task.CompletedTask; }));
    }

    [Fact]
    public async Task Unbalanced_posted_entry_is_rejected()
    {
        var t = factory.CreateTenant();
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, db => { db.JournalEntries.Add(Entry(t, JournalEntryStatus.Posted, ("1-1000", 100m, 0), ("4-1000", 0, 99.9999m))); return Task.CompletedTask; }));
    }

    [Fact]
    public async Task Draft_cannot_be_posted_without_lines_even_when_only_the_header_changes()
    {
        var t = factory.CreateTenant();
        var draft = Entry(t, JournalEntryStatus.Draft);
        await Save(t, db => { db.JournalEntries.Add(draft); return Task.CompletedTask; });

        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, async db => (await db.JournalEntries.FindAsync(draft.Id))!.Status = JournalEntryStatus.Posted));
    }

    [Fact]
    public async Task Line_of_a_posted_entry_cannot_be_edited_directly()
    {
        var t = factory.CreateTenant();
        var id = await factory.SeedPosted(t);
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, async db => (await db.JournalLines.FirstAsync(l => l.JournalEntryId == id)).Debit += 1));
    }

    [Fact]
    public async Task Line_cannot_be_added_to_or_removed_from_a_posted_entry()
    {
        var t = factory.CreateTenant();
        var id = await factory.SeedPosted(t);
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, db => { db.JournalLines.Add(new JournalLine { Id = Guid.NewGuid(), JournalEntryId = id, AccountId = "1-1000", Debit = 1 }); return Task.CompletedTask; }));
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, async db => db.JournalLines.Remove(await db.JournalLines.FirstAsync(l => l.JournalEntryId == id))));
    }

    [Fact]
    public async Task Posted_entry_cannot_be_deleted_or_returned_to_draft_and_void_cannot_reopen()
    {
        var t = factory.CreateTenant();
        var id = await factory.SeedPosted(t);
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, async db => db.JournalEntries.Remove((await db.JournalEntries.FindAsync(id))!)));
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, async db => (await db.JournalEntries.FindAsync(id))!.Status = JournalEntryStatus.Draft));

        await Save(t, async db => (await db.JournalEntries.FindAsync(id))!.Status = JournalEntryStatus.Void);
        await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
            Save(t, async db => (await db.JournalEntries.FindAsync(id))!.Status = JournalEntryStatus.Draft));
    }

    [Fact]
    public async Task Line_with_unknown_or_foreign_account_is_rejected()
    {
        var t = factory.CreateTenant();
        var other = factory.CreateTenant();
        await factory.AddAccount(other.CompanyId, "7-7777", "Foreign", "Expense");
        foreach (var bad in new[] { "no-such-account", "7-7777", Guid.Empty.ToString() })
        {
            await Assert.ThrowsAnyAsync<InvalidOperationException>(() =>
                Save(t, db => { db.JournalEntries.Add(Entry(t, JournalEntryStatus.Draft, (bad, 1, 0), ("4-1000", 0, 1))); return Task.CompletedTask; }));
        }
    }

    [Fact]
    public async Task Account_referenced_by_id_is_stored_by_code()
    {
        var t = factory.CreateTenant();
        var entry = Entry(t, JournalEntryStatus.Posted, (t.Cash.Id.ToString(), 5, 0), (t.Revenue.Code, 0, 5));
        await Save(t, db => { db.JournalEntries.Add(entry); return Task.CompletedTask; });

        var stored = await factory.WithDb(db => db.JournalLines.Where(l => l.JournalEntryId == entry.Id).Select(l => l.AccountId).ToListAsync(), t.CompanyId);
        Assert.Contains(t.Cash.Code, stored);
        Assert.DoesNotContain(t.Cash.Id.ToString(), stored);
    }

    [Fact]
    public async Task New_row_without_company_is_stamped_with_the_request_scope()
    {
        var t = factory.CreateTenant();
        var entry = Entry(t, JournalEntryStatus.Draft, ("1-1000", 1, 0), ("4-1000", 0, 1));
        entry.CompanyId = Guid.Empty;
        await Save(t, db => { db.JournalEntries.Add(entry); return Task.CompletedTask; });
        Assert.Equal(t.CompanyId, await factory.WithDb(db => db.JournalEntries.Where(j => j.Id == entry.Id).Select(j => j.CompanyId).SingleAsync(), t.CompanyId));
    }
}
