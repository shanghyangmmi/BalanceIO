using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

/// <summary>
/// Unit and integration tests for PSAK 118 (IFRS 18) Financial Statement Presentation:
/// - Categorisation: Operating, Investing, Financing, Income Tax
/// - Mandatory subtotals: Operating Profit, Profit Before Financing and Income Taxes
/// - Discontinued Operations single line presentation per PSAK 105
/// - Indirect Cash Flow starting with Operating Profit and exact cash reconciliation
/// </summary>
public class Psak118FinancialStatementsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const decimal M = 1_000_000m;

    private static JsonElement Statement(JsonElement pack, string key) =>
        pack.GetProperty("statements").EnumerateArray().Single(s => s.GetProperty("key").GetString() == key);

    private static JsonElement Line(JsonElement statement, string labelEn) =>
        statement.GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("labelEn").GetString() == labelEn);

    private static decimal Cur(JsonElement line) => line.GetProperty("current").GetDecimal();

    private async Task<JsonElement> FetchStatementsAsync(TestTenant t, string start = "2026-01-01", string end = "2026-12-31")
    {
        var res = await t.OwnerClient().GetAsync($"/api/Reports/financial-statements?start={start}&end={end}&comparative=false");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await res.Json();
    }

    [Fact]
    public async Task Psak118_Pnl_Structure_Mandatory_Subtotals_And_Categories()
    {
        var t = await factory.CreateTenantAsync("PT PSAK 118 Mandiri");
        var id = t.CompanyId;

        await factory.AddAccount(id, "1-1102", "Cash in Bank", "Asset");
        await factory.AddAccount(id, "4-1000", "Product Sales", "Revenue");
        await factory.AddAccount(id, "5-1000", "Cost of Goods Sold", "Expense");
        await factory.AddAccount(id, "6-1100", "Salaries & Wages", "Expense");
        await factory.AddAccount(id, "7-3000", "Gain on Asset Disposal", "Revenue");
        await factory.AddAccount(id, "7-1000", "Interest Income", "Revenue");
        await factory.AddAccount(id, "7-2000", "Dividend Income", "Revenue");
        await factory.AddAccount(id, "8-1000", "Bank Charges", "Expense");
        await factory.AddAccount(id, "8-2000", "Interest Expense", "Expense");
        await factory.AddAccount(id, "8-5000", "Tax Expense", "Expense");

        // Post entries throughout 2026
        await factory.WithDb(async db =>
        {
            var je = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = id,
                Date = new DateOnly(2026, 6, 15),
                Status = JournalEntryStatus.Posted,
                Lines = new List<JournalLine>
                {
                    // Revenue (Operating): +100M
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 100 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "4-1000", Credit = 100 * M },

                    // COGS (Operating): -40M
                    new() { Id = Guid.NewGuid(), AccountId = "5-1000", Debit = 40 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 40 * M },

                    // Operating Expenses (Salaries): -15M
                    new() { Id = Guid.NewGuid(), AccountId = "6-1100", Debit = 15 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 15 * M },

                    // Gain on PP&E Disposal (Operating): +5M
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 5 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "7-3000", Credit = 5 * M },

                    // Investing: Interest Income +3M, Dividend Income +2M = +5M
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 5 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "7-1000", Credit = 3 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "7-2000", Credit = 2 * M },

                    // Financing: Bank charges -1M, Interest expense -4M = -5M
                    new() { Id = Guid.NewGuid(), AccountId = "8-1000", Debit = 1 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "8-2000", Debit = 4 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 5 * M },

                    // Income Tax: -6M
                    new() { Id = Guid.NewGuid(), AccountId = "8-5000", Debit = 6 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 6 * M },
                }
            };
            db.JournalEntries.Add(je);
            await db.SaveChangesAsync();
        }, id);

        var pack = await FetchStatementsAsync(t);
        var pl = Statement(pack, "pl");

        // 1. Operating Category
        Assert.Equal(100 * M, Cur(Line(pl, "Total operating revenue")));
        Assert.Equal(-40 * M, Cur(Line(pl, "Total cost of sales")));
        Assert.Equal(60 * M, Cur(Line(pl, "GROSS PROFIT")));
        Assert.Equal(-15 * M, Cur(Line(pl, "Total operating expenses")));
        Assert.Equal(5 * M, Cur(Line(pl, "Total other operating income (expenses)")));

        // Mandatory Subtotal 1: Operating Profit / Loss
        Assert.Equal(50 * M, Cur(Line(pl, "OPERATING PROFIT (LOSS)")));

        // 2. Investing Category
        Assert.Equal(5 * M, Cur(Line(pl, "Total investing income (expenses)")));

        // Mandatory Subtotal 2: Profit / Loss Before Financing and Income Taxes
        Assert.Equal(55 * M, Cur(Line(pl, "PROFIT (LOSS) BEFORE FINANCING AND INCOME TAXES")));

        // 3. Financing Category
        Assert.Equal(-5 * M, Cur(Line(pl, "Total financing expenses")));

        // Profit / Loss Before Income Tax
        Assert.Equal(50 * M, Cur(Line(pl, "PROFIT (LOSS) BEFORE INCOME TAX")));

        // 4. Income Taxes
        Assert.Equal(-6 * M, Cur(Line(pl, "Income tax expense")));

        // Continuing Operations Subtotal
        Assert.Equal(44 * M, Cur(Line(pl, "PROFIT (LOSS) FROM CONTINUING OPERATIONS")));

        // 5. Discontinued Operations
        Assert.Equal(0m, Cur(Line(pl, "Discontinued operations (net of tax)")));

        // 6. Bottom line: Profit / Loss for the year
        Assert.Equal(44 * M, Cur(Line(pl, "PROFIT (LOSS) FOR THE YEAR")));

        // Assert all statement checks passed
        foreach (var check in pl.GetProperty("checks").EnumerateArray())
        {
            Assert.True(check.GetProperty("passed").GetBoolean());
            Assert.Equal(0m, check.GetProperty("difference").GetDecimal());
        }
    }

    [Fact]
    public async Task Psak118_Discontinued_Operations_Isolated_To_Single_PostTax_Line()
    {
        var t = await factory.CreateTenantAsync("PT Divisi Discontinued");
        var id = t.CompanyId;

        await factory.AddAccount(id, "1-1102", "Cash in Bank", "Asset");
        await factory.AddAccount(id, "4-1000", "Product Sales", "Revenue");
        await factory.AddAccount(id, "5-1000", "Cost of Goods Sold", "Expense");
        await factory.AddAccount(id, "6-1100", "Operating Expense", "Expense");

        Guid discontinuedCcId = Guid.Empty;

        // Create a discontinued Cost Centre (PSAK 105)
        await factory.WithDb(async db =>
        {
            var cc = new CostCenter
            {
                Id = Guid.NewGuid(),
                CompanyId = id,
                Code = "DIV-DISC",
                Name = "Divisi Operasi Dihentikan",
                IsDiscontinued = true,
                DiscontinuedDate = new DateOnly(2026, 3, 31),
                IsActive = true
            };
            db.CostCenters.Add(cc);
            await db.SaveChangesAsync();
            discontinuedCcId = cc.Id;
        }, id);

        // Post entries:
        // 1. Continuing operations: Sales 100M, COGS 50M -> Continuing Profit 50M
        // 2. Discontinued division: Sales 30M, Expense 10M -> Discontinued Profit 20M
        await factory.WithDb(async db =>
        {
            var je = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = id,
                Date = new DateOnly(2026, 5, 20),
                Status = JournalEntryStatus.Posted,
                Lines = new List<JournalLine>
                {
                    // Continuing Lines
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 100 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "4-1000", Credit = 100 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "5-1000", Debit = 50 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 50 * M },

                    // Discontinued Unit Lines (marked with CostCenterId of discontinued unit)
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 30 * M, CostCenterId = discontinuedCcId },
                    new() { Id = Guid.NewGuid(), AccountId = "4-1000", Credit = 30 * M, CostCenterId = discontinuedCcId },
                    new() { Id = Guid.NewGuid(), AccountId = "6-1100", Debit = 10 * M, CostCenterId = discontinuedCcId },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 10 * M, CostCenterId = discontinuedCcId },
                }
            };
            db.JournalEntries.Add(je);
            await db.SaveChangesAsync();
        }, id);

        var pack = await FetchStatementsAsync(t);
        var pl = Statement(pack, "pl");

        // Continuing revenue must only be 100M (not 130M)
        Assert.Equal(100 * M, Cur(Line(pl, "Total operating revenue")));
        Assert.Equal(-50 * M, Cur(Line(pl, "Total cost of sales")));
        Assert.Equal(50 * M, Cur(Line(pl, "OPERATING PROFIT (LOSS)")));
        Assert.Equal(50 * M, Cur(Line(pl, "PROFIT (LOSS) FROM CONTINUING OPERATIONS")));

        // Discontinued operations: single net line of 20M (30M sales - 10M expenses)
        Assert.Equal(20 * M, Cur(Line(pl, "Discontinued operations (net of tax)")));

        // Bottom Line = 50M continuing + 20M discontinued = 70M total
        Assert.Equal(70 * M, Cur(Line(pl, "PROFIT (LOSS) FOR THE YEAR")));

        // Statement checks pass
        foreach (var check in pl.GetProperty("checks").EnumerateArray())
        {
            Assert.True(check.GetProperty("passed").GetBoolean());
            Assert.Equal(0m, check.GetProperty("difference").GetDecimal());
        }
    }

    [Fact]
    public async Task Psak118_Cash_Flow_Starts_With_Operating_Profit_And_Reconciles()
    {
        var t = await factory.CreateTenantAsync("PT Arus Kas PSAK 118");
        var id = t.CompanyId;

        await factory.AddAccount(id, "1-1102", "Cash in Bank", "Asset");
        await factory.AddAccount(id, "1-1200", "Trade Receivables", "Asset");
        await factory.AddAccount(id, "1-2100", "Equipment", "Asset");
        await factory.AddAccount(id, "1-2200", "Accumulated Depreciation", "Asset");
        await factory.AddAccount(id, "2-1100", "Trade Payables", "Liability");
        await factory.AddAccount(id, "2-2100", "Bank Loans", "Liability");
        await factory.AddAccount(id, "3-1000", "Share Capital", "Equity");
        await factory.AddAccount(id, "4-1000", "Product Sales", "Revenue");
        await factory.AddAccount(id, "5-1000", "Cost of Goods Sold", "Expense");
        await factory.AddAccount(id, "6-1600", "Depreciation Expense", "Expense");
        await factory.AddAccount(id, "7-1000", "Interest Income", "Revenue");
        await factory.AddAccount(id, "8-2000", "Interest Expense", "Expense");

        await factory.WithDb(async db =>
        {
            var acc = await db.Accounts.SingleAsync(a => a.Code == "1-2200" && a.CompanyId == id);
            acc.NormalBalance = "Credit";
            await db.SaveChangesAsync();
        }, id);

        // Initial equity injection
        await factory.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = id,
                Date = new DateOnly(2026, 1, 1),
                Status = JournalEntryStatus.Posted,
                Lines = new List<JournalLine>
                {
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 200 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "3-1000", Credit = 200 * M },
                }
            });
            await db.SaveChangesAsync();
        }, id);

        // Operations: Sales 100M (80M cash, 20M AR), COGS 40M (unpaid AP), Depreciation 10M, Interest Inc 5M, Interest Exp 3M
        await factory.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = id,
                Date = new DateOnly(2026, 6, 30),
                Status = JournalEntryStatus.Posted,
                Lines = new List<JournalLine>
                {
                    // Sales
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 80 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1200", Debit = 20 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "4-1000", Credit = 100 * M },

                    // COGS on credit
                    new() { Id = Guid.NewGuid(), AccountId = "5-1000", Debit = 40 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "2-1100", Credit = 40 * M },

                    // Non-cash depreciation
                    new() { Id = Guid.NewGuid(), AccountId = "6-1600", Debit = 10 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-2200", Credit = 10 * M },

                    // Investing Interest Income
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 5 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "7-1000", Credit = 5 * M },

                    // Financing Interest Expense
                    new() { Id = Guid.NewGuid(), AccountId = "8-2000", Debit = 3 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 3 * M },
                }
            });
            await db.SaveChangesAsync();
        }, id);

        var pack = await FetchStatementsAsync(t);
        var cf = Statement(pack, "cashflow");

        // Starting line must be Operating Profit (Sales 100M - COGS 40M - Depr 10M = 50M)
        Assert.Equal(50 * M, Cur(Line(cf, "Operating profit (loss) for the year")));

        // Non-cash adjustment: Depreciation added back +10M
        Assert.Equal(10 * M, Cur(Line(cf, "Depreciation and amortisation")));

        // Working Capital: AR (+20M asset -> -20M cash), AP (+40M liab -> +40M cash) -> net +20M
        Assert.Equal(-20 * M, Cur(Line(cf, "Trade Receivables")));
        Assert.Equal(40 * M, Cur(Line(cf, "Trade Payables")));

        // Net cash from operations = 50M + 10M - 20M + 40M = 80M
        Assert.Equal(80 * M, Cur(Line(cf, "Net cash from operating activities")));

        // Investing cash flow = Interest income +5M
        Assert.Equal(5 * M, Cur(Line(cf, "Interest Income")));
        Assert.Equal(5 * M, Cur(Line(cf, "Net cash from investing activities")));

        // Financing cash flow = Share Capital 200M - Interest expense 3M = 197M
        Assert.Equal(200 * M, Cur(Line(cf, "Share Capital")));
        Assert.Equal(-3 * M, Cur(Line(cf, "Interest Expense")));
        Assert.Equal(197 * M, Cur(Line(cf, "Net cash from financing activities")));

        // Net change in cash = 80M (operating) + 5M (investing) + 197M (financing) = 282M
        Assert.Equal(282 * M, Cur(Line(cf, "NET INCREASE (DECREASE) IN CASH AND CASH EQUIVALENTS")));

        // Opening cash: 0 (since 2026-01-01 starts with 200M on Jan 1)
        // Closing cash: 200M + 82M = 282M
        Assert.Equal(282 * M, Cur(Line(cf, "CASH AND CASH EQUIVALENTS AT END OF PERIOD")));

        // Cash flow statement check passed with zero difference
        var cfCheck = cf.GetProperty("checks").EnumerateArray().Single();
        Assert.True(cfCheck.GetProperty("passed").GetBoolean());
        Assert.Equal(0m, cfCheck.GetProperty("difference").GetDecimal());
    }

    [Fact]
    public async Task Psak118_Category_Override_Dynamic_Reclassification()
    {
        var t = await factory.CreateTenantAsync("PT Override Category");
        var id = t.CompanyId;

        await factory.AddAccount(id, "1-1102", "Cash in Bank", "Asset");
        await factory.AddAccount(id, "4-1000", "Product Sales", "Revenue");
        // Create account 8-2000 (default Financing)
        var intExp = await factory.AddAccount(id, "8-2000", "Special Interest", "Expense");

        // Post entry with 8-2000
        await factory.WithDb(async db =>
        {
            db.JournalEntries.Add(new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = id,
                Date = new DateOnly(2026, 4, 1),
                Status = JournalEntryStatus.Posted,
                Lines = new List<JournalLine>
                {
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Debit = 50 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "4-1000", Credit = 50 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "8-2000", Debit = 10 * M },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1102", Credit = 10 * M },
                }
            });
            await db.SaveChangesAsync();
        }, id);

        // Initial fetch: 8-2000 is in Financing Category
        var pack1 = await FetchStatementsAsync(t);
        var pl1 = Statement(pack1, "pl");
        Assert.Equal(50 * M, Cur(Line(pl1, "OPERATING PROFIT (LOSS)")));
        Assert.Equal(-10 * M, Cur(Line(pl1, "Total financing expenses")));

        // Reclassify 8-2000 to Operating Category via API
        intExp.Psak118Category = Psak118Category.Operating;
        var putRes = await t.OwnerClient().PutAsJsonAsync($"/api/Accounts/{intExp.Id}", intExp);
        Assert.Equal(HttpStatusCode.NoContent, putRes.StatusCode);

        // Fetch again: 8-2000 must now be in Operating Category!
        var pack2 = await FetchStatementsAsync(t);
        var pl2 = Statement(pack2, "pl");

        // Operating profit now includes the 10M expense -> 50M - 10M = 40M!
        Assert.Equal(40 * M, Cur(Line(pl2, "OPERATING PROFIT (LOSS)")));
        Assert.Equal(0m, Cur(Line(pl2, "Total financing expenses")));
    }
}
