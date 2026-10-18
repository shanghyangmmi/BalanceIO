using System.Net;
using System.Net.Http.Json;
using BalanceIO.API.Controllers;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Tests;

public class CostCentersAndDimensionsTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<TestTenant> SetupTenantWithAccounts(string name)
    {
        var tenant = await factory.CreateTenantAsync(name);

        await factory.AddAccount(tenant.CompanyId, "1-1200", "Trade Receivables", "Asset");
        await factory.AddAccount(tenant.CompanyId, "1-1400", "Inventory", "Asset");
        await factory.AddAccount(tenant.CompanyId, "2-1100", "Trade Payables", "Liability");
        await factory.AddAccount(tenant.CompanyId, "2-1300", "VAT Out", "Liability");
        await factory.AddAccount(tenant.CompanyId, "1-1700", "VAT In", "Asset");
        await factory.AddAccount(tenant.CompanyId, "5-1000", "Cost of Goods Sold", "Expense");
        await factory.AddAccount(tenant.CompanyId, "6-1100", "Salaries and Wages", "Expense");
        await factory.AddAccount(tenant.CompanyId, "6-1110", "Employee Benefits", "Expense");
        await factory.AddAccount(tenant.CompanyId, "2-1410", "PPh 21 Payable", "Liability");
        await factory.AddAccount(tenant.CompanyId, "2-1510", "BPJS Payable", "Liability");
        await factory.AddAccount(tenant.CompanyId, "2-1500", "Employee Payable", "Liability");
        await factory.AddAccount(tenant.CompanyId, "6-1400", "Office Supplies", "Expense");
        await factory.AddAccount(tenant.CompanyId, "6-1600", "Depreciation Expense", "Expense");
        await factory.AddAccount(tenant.CompanyId, "1-2200", "Accumulated Depreciation", "Asset");

        return tenant;
    }

    [Fact]
    public async Task CostCenter_Crud_And_Hierarchy_Tree()
    {
        var tenant = await SetupTenantWithAccounts("PT Dim Tree Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        // 1. Create Division (Root)
        var createDivRes = await client.PostAsJsonAsync("/api/cost-centers", new CreateCostCenterRequest
        {
            Code = "DIV-OPS",
            Name = "Operations Division",
            Description = "Operations parent division"
        });
        Assert.Equal(HttpStatusCode.Created, createDivRes.StatusCode);
        var div = await createDivRes.Content.ReadFromJsonAsync<CostCenterDto>();
        Assert.NotNull(div);

        // 2. Create Department under Division
        var createDeptRes = await client.PostAsJsonAsync("/api/cost-centers", new CreateCostCenterRequest
        {
            Code = "DEPT-ENG",
            Name = "Engineering Department",
            ParentId = div.Id
        });
        Assert.Equal(HttpStatusCode.Created, createDeptRes.StatusCode);
        var dept = await createDeptRes.Content.ReadFromJsonAsync<CostCenterDto>();
        Assert.NotNull(dept);

        // 3. Query hierarchy
        var treeRes = await client.GetAsync("/api/cost-centers?hierarchy=true");
        Assert.Equal(HttpStatusCode.OK, treeRes.StatusCode);
        var roots = await treeRes.Content.ReadFromJsonAsync<List<CostCenterDto>>();
        Assert.NotNull(roots);
        var rootDiv = roots.FirstOrDefault(r => r.Id == div.Id);
        Assert.NotNull(rootDiv);
        Assert.Contains(rootDiv.Children, c => c.Id == dept.Id);

        // 4. Circular hierarchy detection
        var circularRes = await client.PutAsJsonAsync($"/api/cost-centers/{div.Id}", new UpdateCostCenterRequest
        {
            Code = div.Code,
            Name = div.Name,
            ParentId = dept.Id // Trying to make division a child of engineering
        });
        Assert.Equal(HttpStatusCode.BadRequest, circularRes.StatusCode);

        // 5. Delete protection with child
        var delDivRes = await client.DeleteAsync($"/api/cost-centers/{div.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, delDivRes.StatusCode);

        // 6. Delete child first, then parent
        var delDeptRes = await client.DeleteAsync($"/api/cost-centers/{dept.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delDeptRes.StatusCode);

        var delDivSuccess = await client.DeleteAsync($"/api/cost-centers/{div.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delDivSuccess.StatusCode);
    }

    [Fact]
    public async Task LedgerGuard_DimensionRule_Required_And_Forbidden()
    {
        var tenant = await SetupTenantWithAccounts("PT Guard Test");

        // Create Cost Center
        var costCenter = new CostCenter
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Code = "CC-TECH",
            Name = "Technology"
        };

        // Create Account with DimensionRule = Required
        var reqAccount = new Account
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Code = "6-9901",
            Name = "R&D Expense (Required CC)",
            Type = "Expense",
            AccountGroup = "Expense",
            DimensionRule = DimensionRule.Required
        };

        // Create Account with DimensionRule = Forbidden
        var forbAccount = new Account
        {
            Id = Guid.NewGuid(),
            CompanyId = tenant.CompanyId,
            Code = "6-9902",
            Name = "HQ Admin Expense (Forbidden CC)",
            Type = "Expense",
            AccountGroup = "Expense",
            DimensionRule = DimensionRule.Forbidden
        };

        await factory.WithDb(async db =>
        {
            db.CostCenters.Add(costCenter);
            db.Accounts.AddRange(reqAccount, forbAccount);
            await db.SaveChangesAsync();
        }, tenant.CompanyId);

        // 1. Post to Required account WITHOUT CostCenter -> Throws COST_CENTER_REQUIRED
        await Assert.ThrowsAsync<LedgerIntegrityException>(async () =>
        {
            await factory.WithDb(async db =>
            {
                var entry = new JournalEntry
                {
                    Id = Guid.NewGuid(),
                    CompanyId = tenant.CompanyId,
                    Date = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
                    Status = JournalEntryStatus.Posted,
                    ReferenceNumber = "JE-REQ-FAIL",
                    Lines = new List<JournalLine>
                    {
                        new() { Id = Guid.NewGuid(), AccountId = reqAccount.Code, Debit = 1_000_000m, Credit = 0m, CostCenterId = null },
                        new() { Id = Guid.NewGuid(), AccountId = "1-1000", Debit = 0m, Credit = 1_000_000m }
                    }
                };
                db.JournalEntries.Add(entry);
                await db.SaveChangesAsync();
            }, tenant.CompanyId);
        });

        // 2. Post to Required account WITH CostCenter -> Succeeds
        await factory.WithDb(async db =>
        {
            var entry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = tenant.CompanyId,
                Date = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
                Status = JournalEntryStatus.Posted,
                ReferenceNumber = "JE-REQ-PASS",
                Lines = new List<JournalLine>
                {
                    new() { Id = Guid.NewGuid(), AccountId = reqAccount.Code, Debit = 1_000_000m, Credit = 0m, CostCenterId = costCenter.Id },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1000", Debit = 0m, Credit = 1_000_000m }
                }
            };
            db.JournalEntries.Add(entry);
            await db.SaveChangesAsync();
        }, tenant.CompanyId);

        // 3. Post to Forbidden account WITH CostCenter -> Throws COST_CENTER_FORBIDDEN
        await Assert.ThrowsAsync<LedgerIntegrityException>(async () =>
        {
            await factory.WithDb(async db =>
            {
                var entry = new JournalEntry
                {
                    Id = Guid.NewGuid(),
                    CompanyId = tenant.CompanyId,
                    Date = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
                    Status = JournalEntryStatus.Posted,
                    ReferenceNumber = "JE-FORB-FAIL",
                    Lines = new List<JournalLine>
                    {
                        new() { Id = Guid.NewGuid(), AccountId = forbAccount.Code, Debit = 500_000m, Credit = 0m, CostCenterId = costCenter.Id },
                        new() { Id = Guid.NewGuid(), AccountId = "1-1000", Debit = 0m, Credit = 500_000m }
                    }
                };
                db.JournalEntries.Add(entry);
                await db.SaveChangesAsync();
            }, tenant.CompanyId);
        });
    }

    [Fact]
    public async Task LedgerGuard_TenantIsolation_InvalidCostCenter_ThrowsInvalidCostCenter()
    {
        var tenantA = await SetupTenantWithAccounts("Tenant A");
        var tenantB = await SetupTenantWithAccounts("Tenant B");

        var costCenterB = new CostCenter
        {
            Id = Guid.NewGuid(),
            CompanyId = tenantB.CompanyId,
            Code = "CC-TENANT-B",
            Name = "Tenant B CC"
        };
        await factory.WithDb(async db => { db.CostCenters.Add(costCenterB); await db.SaveChangesAsync(); }, tenantB.CompanyId);

        // Tenant A tries to post using Tenant B's cost center
        await Assert.ThrowsAsync<LedgerIntegrityException>(async () =>
        {
            await factory.WithDb(async db =>
            {
                var entry = new JournalEntry
                {
                    Id = Guid.NewGuid(),
                    CompanyId = tenantA.CompanyId,
                    Date = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
                    Status = JournalEntryStatus.Posted,
                    ReferenceNumber = "JE-TENANT-ISOLATION",
                    Lines = new List<JournalLine>
                    {
                        new() { Id = Guid.NewGuid(), AccountId = "6-1400", Debit = 100_000m, Credit = 0m, CostCenterId = costCenterB.Id },
                        new() { Id = Guid.NewGuid(), AccountId = "1-1000", Debit = 0m, Credit = 100_000m }
                    }
                };
                db.JournalEntries.Add(entry);
                await db.SaveChangesAsync();
            }, tenantA.CompanyId);
        });
    }

    [Fact]
    public async Task SalesInvoice_And_PurchaseBill_FlowDimensionsToJournalLines()
    {
        var tenant = await SetupTenantWithAccounts("PT Commercial Dimensions");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        // Create CostCenter and Project
        var costCenter = new CostCenter { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "CC-SALES", Name = "Sales Dept" };
        var project = new Project { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "PRJ-ALPHA", Name = "Alpha Project" };
        var contact = new Contact { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Name = "Client A", Type = ContactType.Customer, IsCustomer = true, IsVendor = true };

        await factory.WithDb(async db =>
        {
            db.CostCenters.Add(costCenter);
            db.Projects.Add(project);
            db.Contacts.Add(contact);
            await db.SaveChangesAsync();
        }, tenant.CompanyId);

        // 1. Sales Invoice
        var invRes = await client.PostAsJsonAsync("/api/salesinvoices", new SalesInvoice
        {
            CompanyId = tenant.CompanyId,
            ContactId = contact.Id,
            InvoiceDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            Currency = "IDR",
            ProjectId = project.Id,
            Lines = new List<SalesInvoiceLine>
            {
                new()
                {
                    Description = "Consulting Services",
                    Quantity = 1,
                    UnitPrice = 10_000_000m,
                    CostCenterId = costCenter.Id,
                    ProjectId = project.Id,
                    IsTaxable = false
                }
            }
        });
        Assert.Equal(HttpStatusCode.Created, invRes.StatusCode);
        var inv = await invRes.Content.ReadFromJsonAsync<SalesInvoice>();
        Assert.NotNull(inv);

        var postInvRes = await client.PostAsync($"/api/salesinvoices/{inv.Id}/post", null);
        Assert.Equal(HttpStatusCode.OK, postInvRes.StatusCode);

        // Verify Journal Lines on invoice journal
        await factory.WithDb(async db =>
        {
            var savedInv = await db.SalesInvoices.FindAsync(inv.Id);
            Assert.NotNull(savedInv?.JournalEntryId);

            var journal = await db.JournalEntries.Include(j => j.Lines).FirstOrDefaultAsync(j => j.Id == savedInv.JournalEntryId);
            Assert.NotNull(journal);

            var revLine = journal.Lines.FirstOrDefault(l => l.Credit > 0);
            Assert.NotNull(revLine);
            Assert.Equal(costCenter.Id, revLine.CostCenterId);
            Assert.Equal(project.Id, revLine.ProjectId);
        }, tenant.CompanyId);

        // 2. Purchase Bill
        var billRes = await client.PostAsJsonAsync("/api/purchasebills", new PurchaseBill
        {
            CompanyId = tenant.CompanyId,
            ContactId = contact.Id,
            BillDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7)),
            Currency = "IDR",
            Lines = new List<PurchaseBillLine>
            {
                new()
                {
                    Description = "Subcontractor fee",
                    Quantity = 1,
                    UnitPrice = 4_000_000m,
                    CostCenterId = costCenter.Id,
                    ProjectId = project.Id,
                    IsTaxable = false
                }
            }
        });
        Assert.Equal(HttpStatusCode.Created, billRes.StatusCode);
        var bill = await billRes.Content.ReadFromJsonAsync<PurchaseBill>();
        Assert.NotNull(bill);

        var reviewerClient = factory.ClientFor(tenant.CompanyId, tenant.Reviewer);
        var approveBillRes = await reviewerClient.PostAsync($"/api/purchasebills/{bill.Id}/post", null);
        Assert.Equal(HttpStatusCode.OK, approveBillRes.StatusCode);

        await factory.WithDb(async db =>
        {
            var savedBill = await db.PurchaseBills.FindAsync(bill.Id);
            Assert.NotNull(savedBill?.JournalEntryId);

            var journal = await db.JournalEntries.Include(j => j.Lines).FirstOrDefaultAsync(j => j.Id == savedBill.JournalEntryId);
            Assert.NotNull(journal);

            var expLine = journal.Lines.FirstOrDefault(l => l.Debit > 0);
            Assert.NotNull(expLine);
            Assert.Equal(costCenter.Id, expLine.CostCenterId);
            Assert.Equal(project.Id, expLine.ProjectId);
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task Payroll_Posting_SplitsSalaryExpenseByCostCenter()
    {
        var tenant = await SetupTenantWithAccounts("PT Payroll CC Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        // 2 Cost Centers
        var ccSales = new CostCenter { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "CC-PAY-SALES", Name = "Sales" };
        var ccTech = new CostCenter { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "CC-PAY-TECH", Name = "Tech" };

        // 2 Employees
        var emp1 = new Contact { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "EMP-01", Name = "Budi Sales", IsEmployee = true, IsActive = true, PtkpStatus = "TK/0" };
        var emp2 = new Contact { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "EMP-02", Name = "Siti Tech", IsEmployee = true, IsActive = true, PtkpStatus = "TK/0" };

        await factory.WithDb(async db =>
        {
            var plan = new Plan { Id = Guid.NewGuid(), Name = "Enterprise", Modules = "[\"accounting\",\"payroll\"]" };
            db.Plans.Add(plan);
            db.Subscriptions.Add(new Subscription
            {
                Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, PlanId = plan.Id,
                Status = SubscriptionStatus.Active, EndDate = DateTime.UtcNow.AddYears(1),
            });
            db.CostCenters.AddRange(ccSales, ccTech);
            db.Contacts.AddRange(emp1, emp2);
            await db.SaveChangesAsync();
        }, tenant.CompanyId);

        // Set compensation with CostCenterId
        await client.PutAsJsonAsync($"/api/payroll/employees/{emp1.Id}/compensation", new UpsertCompensationRequest
        {
            BaseSalary = 10_000_000m,
            FixedAllowance = 2_000_000m,
            CostCenterId = ccSales.Id,
            IsActive = true
        });

        await client.PutAsJsonAsync($"/api/payroll/employees/{emp2.Id}/compensation", new UpsertCompensationRequest
        {
            BaseSalary = 20_000_000m,
            FixedAllowance = 5_000_000m,
            CostCenterId = ccTech.Id,
            IsActive = true
        });

        // Create Payroll Run
        var runRes = await client.PostAsJsonAsync("/api/payroll/runs", new CreatePayrollRunRequest
        {
            Year = 2026,
            Month = 3,
            PostingDate = new DateOnly(2026, 3, 31)
        });
        Assert.Equal(HttpStatusCode.Created, runRes.StatusCode);
        var run = await runRes.Content.ReadFromJsonAsync<PayrollRunDetailDto>();
        Assert.NotNull(run);

        // Post Payroll Run (as reviewer for SoD)
        var reviewerClient = factory.ClientFor(tenant.CompanyId, tenant.Reviewer);
        var postRes = await reviewerClient.PostAsync($"/api/payroll/runs/{run.Id}/post", null);
        Assert.Equal(HttpStatusCode.OK, postRes.StatusCode);

        // Inspect Journal Lines
        await factory.WithDb(async db =>
        {
            var savedRun = await db.PayrollRuns.FindAsync(run.Id);
            Assert.NotNull(savedRun?.JournalEntryId);

            var journal = await db.JournalEntries.Include(j => j.Lines).FirstOrDefaultAsync(j => j.Id == savedRun.JournalEntryId);
            Assert.NotNull(journal);

            var salaryLines = journal.Lines.Where(l => l.AccountId == "6-1100" || l.AccountId.Contains("Salaries")).ToList();
            Assert.Equal(2, salaryLines.Count);

            var salesLine = salaryLines.FirstOrDefault(l => l.CostCenterId == ccSales.Id);
            var techLine = salaryLines.FirstOrDefault(l => l.CostCenterId == ccTech.Id);

            Assert.NotNull(salesLine);
            Assert.NotNull(techLine);
            Assert.Equal(12_000_000m, salesLine.Debit); // 10m + 2m
            Assert.Equal(25_000_000m, techLine.Debit); // 20m + 5m
        }, tenant.CompanyId);
    }

    [Fact]
    public async Task Reports_ProfitLossByDimension_And_ProjectProfitability()
    {
        var tenant = await SetupTenantWithAccounts("PT Reports Dimension Test");
        var client = factory.ClientFor(tenant.CompanyId, tenant.Owner);

        var cc = new CostCenter { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "CC-REP", Name = "Report CC" };
        var prj = new Project { Id = Guid.NewGuid(), CompanyId = tenant.CompanyId, Code = "PRJ-REP", Name = "Report PRJ" };

        await factory.WithDb(async db =>
        {
            db.CostCenters.Add(cc);
            db.Projects.Add(prj);

            // Post journal with revenue & expense assigned to cc & prj
            var entry = new JournalEntry
            {
                Id = Guid.NewGuid(),
                CompanyId = tenant.CompanyId,
                Date = new DateOnly(2026, 5, 15),
                Status = JournalEntryStatus.Posted,
                ReferenceNumber = "JE-REP-DIM",
                ProjectId = prj.Id,
                Lines = new List<JournalLine>
                {
                    new() { Id = Guid.NewGuid(), AccountId = "4-1000", Debit = 0m, Credit = 50_000_000m, CostCenterId = cc.Id, ProjectId = prj.Id },
                    new() { Id = Guid.NewGuid(), AccountId = "5-1000", Debit = 20_000_000m, Credit = 0m, CostCenterId = cc.Id, ProjectId = prj.Id },
                    new() { Id = Guid.NewGuid(), AccountId = "6-1400", Debit = 5_000_000m, Credit = 0m, CostCenterId = cc.Id, ProjectId = prj.Id },
                    new() { Id = Guid.NewGuid(), AccountId = "1-1000", Debit = 25_000_000m, Credit = 0m }
                }
            };
            db.JournalEntries.Add(entry);
            await db.SaveChangesAsync();
        }, tenant.CompanyId);

        // 1. Dimensional P&L
        var plRes = await client.GetAsync("/api/reports/profit-loss-by-dimension?dimensionType=CostCenter&start=2026-01-01&end=2026-12-31");
        Assert.Equal(HttpStatusCode.OK, plRes.StatusCode);
        var pl = await plRes.Content.ReadFromJsonAsync<DimensionalProfitLossResponse>();
        Assert.NotNull(pl);
        Assert.Contains(pl.Dimensions, d => d.Id == cc.Id.ToString());
        Assert.Equal(50_000_000m, pl.TotalRevenue);
        Assert.Equal(20_000_000m, pl.TotalCogs);
        Assert.Equal(30_000_000m, pl.TotalGrossProfit);
        Assert.Equal(5_000_000m, pl.TotalExpenses);
        Assert.Equal(25_000_000m, pl.TotalNetIncome);

        // 2. Project Profitability
        var prjRes = await client.GetAsync($"/api/reports/project-profitability?projectId={prj.Id}");
        Assert.Equal(HttpStatusCode.OK, prjRes.StatusCode);
        var prjReport = await prjRes.Content.ReadFromJsonAsync<ProjectProfitabilityResponse>();
        Assert.NotNull(prjReport);
        Assert.Equal(50_000_000m, prjReport.TotalRevenue);
        Assert.Equal(25_000_000m, prjReport.TotalDirectCost); // 20m COGS + 5m Office Supplies
        Assert.Equal(25_000_000m, prjReport.GrossProfit);
        Assert.Equal(50.00m, prjReport.GrossMarginPercentage);
    }
}
