using System.Net;
using System.Text.Json;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace BalanceIO.API.Tests;

/// <summary>
/// Phase 5: Tax Compliance & Payroll Hardening tests:
/// 5.1 Ledger-Sourced Withholding Taxes (PPh 21/22/23/4(2))
/// 5.2 Real NSFP Range Management & Coretax Export
/// 5.3 Payroll Hardening: Leavers Annualisation, THR & Yearly WHT 21 Slip (1721-A1 / BPA1)
/// </summary>
public class TaxComplianceAndPayrollTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly PayrollRates Rates = new(12_000_000m, 10_547_400m);

    // ── 5.1 Ledger-Sourced Withholding Taxes ───────────────────────────

    [Fact]
    public async Task PurchaseBill_WithholdingTax_PostsToLiabilityAccount_AndBalancesJournal()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "2-1100", "Trade Payables", "Liability");
        await factory.AddAccount(t.CompanyId, "1-1700", "PPN Masukan", "Asset");
        await factory.AddAccount(t.CompanyId, "6-1300", "Professional Fees", "Expense");
        await factory.AddAccount(t.CompanyId, "2-1423", "PPh 23 Payable", "Liability");
        await factory.AddAccount(t.CompanyId, "1-1100", "Bank", "Asset");

        var vendorId = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact
            {
                Id = vendorId,
                CompanyId = t.CompanyId,
                Code = "VND-01",
                Name = "Kantor Jasa Akuntan",
                IsVendor = true,
                TaxId = "01.234.567.8-012.000",
                WithholdingType = "PPh 23",
                WithholdingRate = 2m
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        // Professional fee Rp 10.000.000 subject to PPN 12% (Rp 1.200.000) and PPh 23 2% (Rp 200.000)
        var billBody = new
        {
            vendorInvoiceNumber = "INV-VND-001",
            billDate = "2026-04-10",
            dueDate = "2026-05-10",
            contactId = vendorId,
            currency = "IDR",
            exchangeRate = 1m,
            withholdingTaxType = "PPh 23",
            withholdingTaxRate = 2m,
            withholdingTaxAmount = 200_000m,
            lines = new[]
            {
                new
                {
                    description = "Accounting Audit Services",
                    quantity = 1m,
                    unitPrice = 10_000_000m,
                    isTaxable = true,
                    taxRate = 12m,
                    dppScheme = 1 // Standard DPP
                }
            }
        };

        var postRes = await t.OwnerClient().PostJson("/api/PurchaseBills", billBody);
        Assert.Equal(HttpStatusCode.Created, postRes.StatusCode);
        var billJson = await postRes.Json();
        var billId = billJson.GetProperty("id").GetGuid();

        // Check computed totals before posting
        Assert.Equal(10_000_000m, billJson.GetProperty("subtotal").GetDecimal());
        Assert.Equal(1_200_000m, billJson.GetProperty("taxAmount").GetDecimal());
        Assert.Equal(11_200_000m, billJson.GetProperty("total").GetDecimal());
        Assert.Equal(200_000m, billJson.GetProperty("withholdingTaxAmount").GetDecimal());
        Assert.Equal(11_000_000m, billJson.GetProperty("amountDue").GetDecimal()); // Net payable to vendor

        // Post bill as finance reviewer
        var reviewer = t.ReviewerClient();
        var approveRes = await reviewer.PostJson($"/api/PurchaseBills/{billId}/post", new { });
        Assert.True(approveRes.IsSuccessStatusCode);

        // Verify Journal Entry
        var approvedBill = await (await t.OwnerClient().GetAsync($"/api/PurchaseBills/{billId}")).Json();
        var journalId = approvedBill.GetProperty("journalEntryId").GetGuid();

        await factory.WithDb(async db =>
        {
            var journal = await db.JournalEntries
                .Include(j => j.Lines)
                .FirstAsync(j => j.Id == journalId);

            var totalDebit = journal.Lines.Sum(l => l.Debit);
            var totalCredit = journal.Lines.Sum(l => l.Credit);
            Assert.Equal(totalDebit, totalCredit);
            Assert.Equal(11_200_000m, totalDebit);

            // Verify lines
            var apLine = journal.Lines.First(l => l.AccountId == "2-1100" || (l.Description != null && l.Description.Contains("Kantor Jasa Akuntan")));
            Assert.Equal(11_000_000m, apLine.Credit);

            var whtLine = journal.Lines.First(l => l.AccountId == "2-1423" || (l.Description != null && l.Description.Contains("PPh 23")));
            Assert.Equal(200_000m, whtLine.Credit);
        }, t.CompanyId);

        // Verify ledger-sourced withholding report queries account 2-1423 directly
        var whtSummaryRes = await t.OwnerClient().GetAsync("/api/TaxReports/withholding-summary?year=2026&month=4");
        Assert.True(whtSummaryRes.IsSuccessStatusCode);
        var whtSummary = await whtSummaryRes.Json();

        Assert.Equal(200_000m, whtSummary.GetProperty("totalPph23Withheld").GetDecimal());
        var pph23Lines = whtSummary.GetProperty("pph23Lines");
        Assert.True(pph23Lines.GetArrayLength() > 0);
        Assert.Equal(200_000m, pph23Lines[0].GetProperty("taxWithheldAmount").GetDecimal());
        Assert.Equal(10_000_000m, pph23Lines[0].GetProperty("grossDppAmount").GetDecimal());

        // Settlement via Payment Voucher of net payable Rp 11.000.000
        var voucherBody = new
        {
            companyId = t.CompanyId,
            voucherNumber = "PV-" + Guid.NewGuid().ToString("N")[..6],
            paymentDate = "2026-04-20",
            paymentMethod = 1, // BankTransfer
            currency = "IDR",
            contactId = vendorId,
            paymentAccountId = t.Cash.Id,
            lines = new[]
            {
                new
                {
                    purchaseBillId = billId,
                    amount = 11_000_000m,
                    description = "Full settlement of net AP"
                }
            }
        };

        var pvRes = await t.OwnerClient().PostJson("/api/PaymentVouchers", voucherBody);
        Assert.Equal(HttpStatusCode.Created, pvRes.StatusCode);
        var pvId = (await pvRes.Json()).GetProperty("id").GetGuid();

        var pvApproveRes = await t.ReviewerClient().PostJson($"/api/PaymentVouchers/{pvId}/post", new { });
        Assert.True(pvApproveRes.IsSuccessStatusCode);

        // Bill must now be Paid and AmountDue == 0
        var settledBill = await (await t.OwnerClient().GetAsync($"/api/PurchaseBills/{billId}")).Json();
        Assert.Equal(11_000_000m, settledBill.GetProperty("amountPaid").GetDecimal());
        Assert.Equal(0m, settledBill.GetProperty("amountDue").GetDecimal());
        Assert.Equal((int)BillStatus.Paid, settledBill.GetProperty("status").GetInt32());
    }

    // ── 5.2 Real NSFP Range Management & Coretax Export ───────────────

    [Fact]
    public void NsfpHelper_AllocatesSequentially_AndHandlesExhaustion()
    {
        var start = "0100002600000001";
        var end = "0100002600000003";

        // Allocation 1: first number in range
        var (next1, isExhausted1, rem1) = NsfpHelper.AllocateNext(string.Empty, start, end);
        Assert.Equal("0100002600000001", next1);
        Assert.False(isExhausted1);
        Assert.Equal(2, rem1);

        // Allocation 2
        var (next2, isExhausted2, rem2) = NsfpHelper.AllocateNext(next1, start, end);
        Assert.Equal("0100002600000002", next2);
        Assert.False(isExhausted2);
        Assert.Equal(1, rem2);

        // Allocation 3: last number
        var (next3, isExhausted3, rem3) = NsfpHelper.AllocateNext(next2, start, end);
        Assert.Equal("0100002600000003", next3);
        Assert.True(isExhausted3);
        Assert.Equal(0, rem3);

        // Allocation 4: exhausted
        var (next4, isExhausted4, rem4) = NsfpHelper.AllocateNext(next3, start, end);
        Assert.True(isExhausted4);
        Assert.Equal(0, rem4);

        // Formatting
        Assert.Equal("010.000-26.00000001", NsfpHelper.Format(next1));
    }

    [Fact]
    public async Task SalesInvoice_Posting_ClaimsNextNsfp_OrMarksPendingWhenNoRange()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "1-1130", "Accounts Receivable", "Asset");
        await factory.AddAccount(t.CompanyId, "4-1000", "Product Sales", "Revenue");
        await factory.AddAccount(t.CompanyId, "2-1300", "VAT Out", "Liability");

        var customerId = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            db.Contacts.Add(new Contact
            {
                Id = customerId,
                CompanyId = t.CompanyId,
                Code = "CST-01",
                Name = "PT Klien Sejahtera",
                IsCustomer = true,
                TaxId = "02.345.678.9-012.000"
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        // 1. Post taxable invoice when NO NSFP range is configured -> marks PENDING_NSFP and null, never invents!
        var invBody1 = new
        {
            invoiceNumber = "INV-NSFP-001",
            invoiceDate = "2026-06-15",
            dueDate = "2026-07-15",
            contactId = customerId,
            currency = "IDR",
            lines = new[] { new { description = "Services", quantity = 1m, unitPrice = 5_000_000m, isTaxable = true, taxRate = 12m, dppScheme = 1 } }
        };

        var invRes1 = await t.OwnerClient().PostJson("/api/SalesInvoices", invBody1);
        Assert.Equal(HttpStatusCode.Created, invRes1.StatusCode);
        var invId1 = (await invRes1.Json()).GetProperty("id").GetGuid();

        var postRes1 = await t.OwnerClient().PostJson($"/api/SalesInvoices/{invId1}/post", new { });
        Assert.True(postRes1.IsSuccessStatusCode);

        var postedInv1 = await (await t.OwnerClient().GetAsync($"/api/SalesInvoices/{invId1}")).Json();
        Assert.Equal(JsonValueKind.Null, postedInv1.GetProperty("fakturPajakNumber").ValueKind);
        Assert.Equal("PENDING_NSFP", postedInv1.GetProperty("nsfpStatus").GetString());

        // 2. Add allocated NSFP range from DJP Online
        var rangeBody = new
        {
            startNumber = "0100002600000100",
            endNumber = "0100002600000105",
            year = 2026
        };

        var rangeRes = await t.OwnerClient().PostJson("/api/TaxReports/nsfp-ranges", rangeBody);
        Assert.True(rangeRes.IsSuccessStatusCode);
        var rangeJson = await rangeRes.Json();
        Assert.Equal("010.000-26.00000100", rangeJson.GetProperty("startNumber").GetString());
        Assert.Equal(6, rangeJson.GetProperty("totalNumbers").GetInt64());

        // 3. Post second taxable invoice -> claims next sequential NSFP number
        var invBody2 = new
        {
            invoiceNumber = "INV-NSFP-002",
            invoiceDate = "2026-06-16",
            dueDate = "2026-07-16",
            contactId = customerId,
            currency = "IDR",
            lines = new[] { new { description = "Software License", quantity = 1m, unitPrice = 10_000_000m, isTaxable = true, taxRate = 12m, dppScheme = 1 } }
        };

        var invRes2 = await t.OwnerClient().PostJson("/api/SalesInvoices", invBody2);
        var invId2 = (await invRes2.Json()).GetProperty("id").GetGuid();

        var postRes2 = await t.OwnerClient().PostJson($"/api/SalesInvoices/{invId2}/post", new { });
        Assert.True(postRes2.IsSuccessStatusCode);

        var postedInv2 = await (await t.OwnerClient().GetAsync($"/api/SalesInvoices/{invId2}")).Json();
        Assert.Equal("010.000-26.00000100", postedInv2.GetProperty("fakturPajakNumber").GetString());
        Assert.Equal("ALLOCATED", postedInv2.GetProperty("nsfpStatus").GetString());

        // 4. Test Coretax Export
        var coretaxRes = await t.OwnerClient().GetAsync("/api/TaxReports/coretax-export?year=2026&month=6");
        Assert.True(coretaxRes.IsSuccessStatusCode);
        var coretax = await coretaxRes.Json();

        Assert.Equal(2, coretax.GetProperty("invoiceCount").GetInt32());
        Assert.Equal(1, coretax.GetProperty("missingNsfpCount").GetInt32()); // 1 pending, 1 allocated
        var xmlContent = coretax.GetProperty("xmlContent").GetString();
        Assert.Contains("<TaxInvoiceBulk", xmlContent);
        Assert.Contains("0100002600000100", xmlContent);
        Assert.Contains("PT Klien Sejahtera", xmlContent);
    }

    // ── 5.3 Payroll Hardening: Leavers Annualisation, THR & 1721-A1 ───

    [Fact]
    public void LeaverAnnualisation_CalculatesAccuratePasal17FinalSettlement()
    {
        // Employee with TK/0 (PTKP Rp 54.000.000) earning Rp 15.000.000/month
        // Resigns in month 6 (June).
        // Months 1-5 withheld via TER A (Gross ~15.681.000, TER A 6% = Rp 940.860/month * 5 = Rp 4.704.300)
        var ytd = new PayrollYearToDate(
            MonthsPaid: 5,
            TaxableGross: 15_681_000m * 5,
            EmployeePension: 450_000m * 5,
            Pph21Withheld: 4_704_300m
        );

        var input = new PayrollInput(15_000_000m, 0m, 0m, "TK/0", 0.24m, true, true, true);
        var result = PayrollCalculator.Calculate(input, month: 6, ytd, Rates, isTermination: true);

        Assert.Equal("LeaverAnnual", result.Pph21Method);
        // Annualised settlement calculates tax based on 6 months total actual income against full annual PTKP (Rp 54m),
        // which produces an overwithheld tax refund (lebih bayar, negative PPh 21) refunded in final paycheck.
        Assert.True(result.Pph21 < 0);
        Assert.True(result.NetPay > input.BaseSalary);
    }

    [Fact]
    public void BonusThr_CalculatesSeparateTaxBreakdown()
    {
        // Base salary Rp 10.000.000, Bonus Rp 10.000.000, Category A
        var regularGross = 10_000_000m;
        var bonusGross = 10_000_000m;

        var (totalTax, regularTax, bonusTax, bonusRate) = PayrollCalculator.CalculateBonusThr(regularGross, bonusGross, "A");

        Assert.Equal(20_000_000m, regularGross + bonusGross);
        Assert.True(totalTax > regularTax);
        Assert.Equal(totalTax - regularTax, bonusTax);
        Assert.True(bonusRate > 0);
    }

    [Fact]
    public async Task YearlyWht21Slip_GeneratesCompliant1721A1_BPA1()
    {
        var t = factory.CreateTenant();
        await factory.AddAccount(t.CompanyId, "6-1100", "Salaries & Wages", "Expense");
        await factory.AddAccount(t.CompanyId, "6-1110", "Employee Benefits (BPJS)", "Expense");
        await factory.AddAccount(t.CompanyId, "2-1410", "PPh 21 Payable", "Liability");
        await factory.AddAccount(t.CompanyId, "2-1510", "BPJS Payable", "Liability");
        await factory.AddAccount(t.CompanyId, "2-1500", "Employee Payable", "Liability");

        var empId = Guid.NewGuid();
        await factory.WithDb(async db =>
        {
            var plan = new Plan { Id = Guid.NewGuid(), Name = "Enterprise", Modules = "[\"accounting\",\"payroll\"]" };
            db.Plans.Add(plan);
            db.Subscriptions.Add(new Subscription
            {
                Id = Guid.NewGuid(), CompanyId = t.CompanyId, PlanId = plan.Id,
                Status = SubscriptionStatus.Active, EndDate = DateTime.UtcNow.AddYears(1),
            });
            db.Contacts.Add(new Contact
            {
                Id = empId,
                CompanyId = t.CompanyId,
                Code = "EMP-001",
                Name = "Ahmad Santoso",
                IsEmployee = true,
                Nik = "3171012345670001",
                TaxId = "01.234.567.8-011.000",
                PtkpStatus = "K/1", // Category B
                Address = "Jl. Sudirman No. 45, Jakarta Selatan"
            });
            db.EmployeeCompensations.Add(new EmployeeCompensation
            {
                Id = Guid.NewGuid(),
                CompanyId = t.CompanyId,
                ContactId = empId,
                BaseSalary = 12_000_000m,
                FixedAllowance = 2_000_000m,
                IsActive = true
            });
            await db.SaveChangesAsync();
        }, t.CompanyId);

        // Run payroll for January and February
        var run1Res = await t.OwnerClient().PostJson("/api/Payroll/runs", new { year = 2026, month = 1 });
        Assert.Equal(HttpStatusCode.Created, run1Res.StatusCode);
        var run1Id = (await run1Res.Json()).GetProperty("id").GetGuid();
        Assert.True((await t.ReviewerClient().PostJson($"/api/Payroll/runs/{run1Id}/post", new { })).IsSuccessStatusCode);

        var run2Res = await t.OwnerClient().PostJson("/api/Payroll/runs", new { year = 2026, month = 2 });
        Assert.Equal(HttpStatusCode.Created, run2Res.StatusCode);
        var run2Id = (await run2Res.Json()).GetProperty("id").GetGuid();
        Assert.True((await t.ReviewerClient().PostJson($"/api/Payroll/runs/{run2Id}/post", new { })).IsSuccessStatusCode);

        // Fetch Yearly WHT 21 Slip (1721-A1 / BPA1)
        var slipRes = await t.OwnerClient().GetAsync($"/api/Payroll/employees/{empId}/yearly-wht21-slip?year=2026");
        Assert.True(slipRes.IsSuccessStatusCode);
        var slip = await slipRes.Json();

        // Check Form Names and Titles
        Assert.Equal("1721-A1 / BPA1", slip.GetProperty("formCode").GetString());
        Assert.Equal("Yearly WHT 21 Slip (1721-A1 / BPA1)", slip.GetProperty("formTitle").GetString());
        Assert.Equal("Bukti Pemotongan PPh Pasal 21 Formulir 1721-A1 / BPA1", slip.GetProperty("formTitleId").GetString());

        // Check values
        Assert.Equal(2026, slip.GetProperty("taxYear").GetInt32());
        Assert.Equal(1, slip.GetProperty("periodStartMonth").GetInt32());
        Assert.Equal(2, slip.GetProperty("periodEndMonth").GetInt32());
        Assert.Equal("3171012345670001", slip.GetProperty("employeeNik").GetString());
        Assert.Equal("Ahmad Santoso", slip.GetProperty("employeeName").GetString());
        Assert.Equal("K/1", slip.GetProperty("ptkpStatus").GetString());

        Assert.Equal(24_000_000m, slip.GetProperty("baseSalary").GetDecimal()); // 12m * 2
        Assert.Equal(4_000_000m, slip.GetProperty("fixedAllowance").GetDecimal()); // 2m * 2
        Assert.True(slip.GetProperty("totalGrossIncome").GetDecimal() > 28_000_000m);
        Assert.Equal(1_000_000m, slip.GetProperty("biayaJabatan").GetDecimal()); // 500k * 2 months
        Assert.True(slip.GetProperty("totalAnnualTaxWithheld").GetDecimal() > 0m);

        // Test CSV export for DJP import
        var csvRes = await t.OwnerClient().GetAsync("/api/Payroll/yearly-wht21-slips/export-csv?year=2026");
        Assert.True(csvRes.IsSuccessStatusCode);
        var csvContent = await csvRes.Content.ReadAsStringAsync();

        Assert.Contains("NOMOR_BUKTI_POTONG,MASA_AWAL,MASA_AKHIR", csvContent);
        Assert.Contains("Ahmad Santoso", csvContent);
        Assert.Contains("3171012345670001", csvContent);
    }
}
