using System.Net;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BalanceIO.API.Tests;

public class PeriodClosingAndMigrationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private Task Post(TestTenant t, string date, params (string Code, decimal Amount)[] lines) =>
        factory.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = t.CompanyId,
                Date = DateOnly.Parse(date),
                ReferenceNumber = "J-" + Guid.NewGuid().ToString("N")[..6],
                Currency = "IDR",
                Status = JournalEntryStatus.Posted,
                Lines = lines.Select(l => new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = l.Code,
                    Debit = l.Amount > 0 ? l.Amount : 0m,
                    Credit = l.Amount < 0 ? -l.Amount : 0m,
                }).ToList(),
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

    [Fact]
    public async Task YearEndClosing_CalculatesNetIncome_PostsBalancedClosingEntry_AndLocksPeriod()
    {
        var t = factory.CreateTenant();

        // Seed missing accounts for test
        await factory.AddAccount(t.CompanyId, "6-1000", "Operating Expenses", "Expense");
        await factory.AddAccount(t.CompanyId, "3-2000", "Retained Earnings", "Equity");

        // 1. Post Revenue in FY 2025: Dr 1-1000 Cash Rp 100.000.000 / Cr 4-1000 Sales Revenue Rp 100.000.000
        await Post(t, "2025-06-15", ("1-1000", 100_000_000m), ("4-1000", -100_000_000m));

        // 2. Post Operating Expense in FY 2025: Dr 6-1000 Expense Rp 35.000.000 / Cr 1-1000 Cash Rp 35.000.000
        await Post(t, "2025-08-20", ("6-1000", 35_000_000m), ("1-1000", -35_000_000m));

        // 3. Preview Year-End Closing for FY 2025
        var previewRes = await t.OwnerClient().GetAsync("/api/accounting/period-close/preview?fiscalYear=2025");
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        var preview = await previewRes.Json();

        Assert.Equal(100_000_000m, preview.GetProperty("totalRevenue").GetDecimal());
        Assert.Equal(35_000_000m, preview.GetProperty("totalExpenses").GetDecimal());
        Assert.Equal(65_000_000m, preview.GetProperty("netIncome").GetDecimal());
        Assert.False(preview.GetProperty("isAlreadyClosed").GetBoolean());

        // 4. Execute Year-End Closing
        var closeBody = new
        {
            fiscalYear = 2025,
            closingDate = "2025-12-31",
            retainedEarningsAccountId = "3-2000",
            notes = "Formal Year-End Close FY 2025",
            lockPeriod = true
        };

        var closeRes = await t.OwnerClient().PostJson("/api/accounting/period-close/year-end", closeBody);
        Assert.Equal(HttpStatusCode.OK, closeRes.StatusCode);
        var closeResult = await closeRes.Json();

        var closingJournalId = closeResult.GetProperty("journalEntryId").GetGuid();
        Assert.Equal("CLOSE-2025", closeResult.GetProperty("referenceNumber").GetString());
        Assert.Equal(65_000_000m, closeResult.GetProperty("netIncome").GetDecimal());

        // 5. Verify the posted Closing Journal Entry in DB
        await factory.WithDb(async db =>
        {
            var closingEntry = await db.JournalEntries
                .Include(j => j.Lines)
                .FirstOrDefaultAsync(j => j.Id == closingJournalId);

            Assert.NotNull(closingEntry);
            Assert.Equal(JournalEntryStatus.Posted, closingEntry.Status);
            Assert.True(closingEntry.IsAdjustingEntry);

            var totalDr = closingEntry.Lines.Sum(l => l.Debit);
            var totalCr = closingEntry.Lines.Sum(l => l.Credit);
            Assert.Equal(100_000_000m, totalDr);
            Assert.Equal(100_000_000m, totalCr); // Exactly balanced!

            // Revenue closed with Debit 100m
            var revCloseLine = closingEntry.Lines.First(l => l.AccountId == "4-1000");
            Assert.Equal(100_000_000m, revCloseLine.Debit);
            Assert.Equal(0m, revCloseLine.Credit);

            // Expense closed with Credit 35m
            var expCloseLine = closingEntry.Lines.First(l => l.AccountId == "6-1000");
            Assert.Equal(0m, expCloseLine.Debit);
            Assert.Equal(35_000_000m, expCloseLine.Credit);

            // Retained Earnings credited with Net Profit 65m
            var reCloseLine = closingEntry.Lines.First(l => l.AccountId == "3-2000");
            Assert.Equal(0m, reCloseLine.Debit);
            Assert.Equal(65_000_000m, reCloseLine.Credit);

            // 6. Verify Period Lock was enforced
            var comp = await db.Companies.FindAsync(t.CompanyId);
            Assert.NotNull(comp?.LockDate);
            Assert.Equal(new DateOnly(2025, 12, 31), comp.LockDate.Value);
        }, t.CompanyId);

        // 7. Verify that transactions in locked period are refused
        var lockedTrans = new
        {
            date = "2025-05-10",
            referenceNumber = "LOCKED-TEST",
            currency = "IDR",
            lines = new[]
            {
                new { accountId = "1-1000", debit = 1_000_000m, credit = 0m, description = "Late test" },
                new { accountId = "4-1000", debit = 0m, credit = 1_000_000m, description = "Late test" }
            }
        };

        var lockedRes = await t.OwnerClient().PostJson("/api/JournalEntries", lockedTrans);
        Assert.Equal(HttpStatusCode.BadRequest, lockedRes.StatusCode);
        var lockedErr = await lockedRes.Content.ReadAsStringAsync();
        Assert.Contains("PERIOD_LOCKED", lockedErr);
    }

    [Fact]
    public async Task YearEndClosing_PreventsDuplicateClosing()
    {
        var t = factory.CreateTenant();

        await factory.AddAccount(t.CompanyId, "3-2000", "Retained Earnings", "Equity");

        // Post minimal revenue
        await Post(t, "2024-05-01", ("1-1000", 10_000_000m), ("4-1000", -10_000_000m));

        // Close 2024
        var closeRes1 = await t.OwnerClient().PostJson("/api/accounting/period-close/year-end", new
        {
            fiscalYear = 2024,
            lockPeriod = false
        });
        Assert.Equal(HttpStatusCode.OK, closeRes1.StatusCode);

        // Attempting to close 2024 again must fail
        var closeRes2 = await t.OwnerClient().PostJson("/api/accounting/period-close/year-end", new
        {
            fiscalYear = 2024,
            lockPeriod = false
        });
        Assert.Equal(HttpStatusCode.BadRequest, closeRes2.StatusCode);
        var errJson = await closeRes2.Content.ReadAsStringAsync();
        Assert.Contains("YEAR_ALREADY_CLOSED", errJson);
    }

    [Fact]
    public async Task PeriodLock_CanLockAndUnlockExplicitly()
    {
        var t = factory.CreateTenant();

        // 1. Lock period up to 2026-06-30
        var lockRes = await t.OwnerClient().PostJson("/api/accounting/period-close/lock", new
        {
            lockDate = "2026-06-30"
        });
        Assert.Equal(HttpStatusCode.OK, lockRes.StatusCode);

        // Check history reflects lock
        var histRes = await t.OwnerClient().GetAsync("/api/accounting/period-close/history");
        Assert.Equal(HttpStatusCode.OK, histRes.StatusCode);
        var hist = await histRes.Json();
        Assert.True(hist.GetProperty("isLocked").GetBoolean());
        Assert.Equal("2026-06-30", hist.GetProperty("currentLockDate").GetString());

        // Attempt transaction in locked period -> fails
        var failRes = await t.OwnerClient().PostJson("/api/JournalEntries", new
        {
            date = "2026-04-15",
            currency = "IDR",
            lines = new[]
            {
                new { accountId = "1-1000", debit = 500_000m, credit = 0m, description = "Blocked" },
                new { accountId = "4-1000", debit = 0m, credit = 500_000m, description = "Blocked" }
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, failRes.StatusCode);

        // 2. Unlock period
        var unlockRes = await t.OwnerClient().PostJson("/api/accounting/period-close/unlock", new { });
        Assert.Equal(HttpStatusCode.OK, unlockRes.StatusCode);

        // Transaction now succeeds
        var okRes = await t.OwnerClient().PostJson("/api/JournalEntries", new
        {
            date = "2026-04-15",
            currency = "IDR",
            lines = new[]
            {
                new { accountId = "1-1000", debit = 500_000m, credit = 0m, description = "Allowed" },
                new { accountId = "4-1000", debit = 0m, credit = 500_000m, description = "Allowed" }
            }
        });
        Assert.Equal(HttpStatusCode.Created, okRes.StatusCode);
    }

    [Fact]
    public async Task MigrationWizard_ChartOfAccountsImport_PreviewAndCommit()
    {
        var t = factory.CreateTenant();

        // 1. Download template
        var tplRes = await t.OwnerClient().GetAsync("/api/migration/templates/chart-of-accounts");
        Assert.Equal(HttpStatusCode.OK, tplRes.StatusCode);
        var csv = await tplRes.Content.ReadAsStringAsync();
        Assert.Contains("AccountCode,AccountName,AccountGroup", csv);

        // 2. Preview COA import
        var previewReq = new
        {
            type = (int)ImportType.ChartOfAccounts,
            conversionDate = "2026-01-01",
            rows = new[]
            {
                new Dictionary<string, object>
                {
                    ["AccountCode"] = "1-1109",
                    ["AccountName"] = "Kas Cabang Surabaya",
                    ["AccountGroup"] = "Asset",
                    ["NormalBalance"] = "Debit",
                    ["Description"] = "Petty cash cabang"
                },
                new Dictionary<string, object>
                {
                    ["AccountCode"] = "6-2005",
                    ["AccountName"] = "Beban Internet & Cloud",
                    ["AccountGroup"] = "Expense",
                    ["NormalBalance"] = "Debit",
                    ["Description"] = "Langganan AWS dan Internet"
                }
            }
        };

        var previewRes = await t.OwnerClient().PostJson("/api/migration/preview", previewReq);
        Assert.Equal(HttpStatusCode.OK, previewRes.StatusCode);
        var preview = await previewRes.Json();
        Assert.True(preview.GetProperty("isValid").GetBoolean());
        Assert.Equal(2, preview.GetProperty("totalRecords").GetInt32());

        // 3. Commit COA import
        var commitReq = new
        {
            type = (int)ImportType.ChartOfAccounts,
            conversionDate = "2026-01-01",
            fileName = "coa-migration.csv",
            rows = previewReq.rows
        };

        var commitRes = await t.OwnerClient().PostJson("/api/migration/commit", commitReq);
        Assert.Equal(HttpStatusCode.OK, commitRes.StatusCode);
        var committed = await commitRes.Json();
        Assert.Equal(2, committed.GetProperty("recordCount").GetInt32());

        // 4. Verify accounts exist in DB
        await factory.WithDb(async db =>
        {
            var acc1 = await db.Accounts.FirstOrDefaultAsync(a => a.Code == "1-1109");
            Assert.NotNull(acc1);
            Assert.Equal("Kas Cabang Surabaya", acc1.Name);
            Assert.Equal("Asset", acc1.AccountGroup);

            var acc2 = await db.Accounts.FirstOrDefaultAsync(a => a.Code == "6-2005");
            Assert.NotNull(acc2);
            Assert.Equal("Beban Internet & Cloud", acc2.Name);
            Assert.Equal("Expense", acc2.AccountGroup);
        }, t.CompanyId);
    }

    [Fact]
    public async Task MigrationWizard_StatusAndReconciliation_ReportAccurately()
    {
        var t = factory.CreateTenant();

        // 1. Query Wizard Status
        var statusRes = await t.OwnerClient().GetAsync("/api/migration/wizard/status");
        Assert.True(statusRes.IsSuccessStatusCode, await statusRes.Content.ReadAsStringAsync());
        var status = await statusRes.Json();

        Assert.Equal(7, status.GetProperty("totalSteps").GetInt32());
        var steps = status.GetProperty("steps");
        Assert.True(steps.TryGetProperty("step1ChartOfAccounts", out _));
        Assert.True(steps.TryGetProperty("step2TrialBalance", out _));
        Assert.True(steps.TryGetProperty("step3OpenReceivables", out _));
        Assert.True(steps.TryGetProperty("step4OpenPayables", out _));
        Assert.True(steps.TryGetProperty("step5Inventory", out _));
        Assert.True(steps.TryGetProperty("step6FixedAssets", out _));
        Assert.True(steps.TryGetProperty("step7Reconciliation", out _));

        // 2. Query Wizard Reconciliation Report
        var recRes = await t.OwnerClient().GetAsync("/api/migration/wizard/reconciliation");
        Assert.True(recRes.IsSuccessStatusCode, await recRes.Content.ReadAsStringAsync());
        var rec = await recRes.Json();

        Assert.Equal("3-9000", rec.GetProperty("openingEquityAccountCode").GetString());
        Assert.True(rec.TryGetProperty("arReconciliation", out _));
        Assert.True(rec.TryGetProperty("apReconciliation", out _));
        Assert.True(rec.TryGetProperty("inventoryReconciliation", out _));
        Assert.True(rec.TryGetProperty("fixedAssetsReconciliation", out _));
        Assert.True(rec.TryGetProperty("recommendations", out var recs) && recs.GetArrayLength() > 0);
    }
}
