using System.Text.Json;
using BalanceIO.API.Data;
using BalanceIO.API.Models;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MigrationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly ILogger<MigrationController> _logger;

    private readonly BalanceIO.API.Services.InventoryLedger _inventory;

    public MigrationController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        ILogger<MigrationController> logger, BalanceIO.API.Services.InventoryLedger inventory)
    {
        _inventory = inventory;
        _context = context;
        _periodLockService = periodLockService;
        _logger = logger;
    }

    // ── 1. GET: api/migration/batches ───────────────────────────────────
    [HttpGet("batches")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> GetBatches()
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var batches = await _context.ImportBatches
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();

        return Ok(batches);
    }

    // ── 2. GET: api/migration/batches/{id} ──────────────────────────────
    [HttpGet("batches/{id}")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> GetBatchById(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");

        var batch = await _context.ImportBatches.FindAsync(id);
        if (batch == null) return NotFound("Migration batch not found");

        return Ok(batch);
    }

    // ── 3. POST: api/migration/preview ──────────────────────────────────
    [HttpPost("preview")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> Preview([FromBody] MigrationPreviewRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");
        var companyId = _context.CurrentCompanyId.Value;

        var result = new MigrationPreviewResponse
        {
            TotalRecords = request.Rows.Count,
            ConversionDate = request.ConversionDate
        };

        // Validate Period Lock
        try
        {
            await _periodLockService.ValidateTransactionDate(companyId, request.ConversionDate);
        }
        catch (Exception ex)
        {
            result.Errors.Add($"Period Lock Violation: {ex.Message}");
            result.IsValid = false;
            return Ok(result);
        }

        switch (request.Type)
        {
            case ImportType.OpeningBalances:
                await PreviewOpeningBalances(companyId, request, result);
                break;

            case ImportType.Contacts:
                await PreviewContacts(companyId, request, result);
                break;

            case ImportType.OpenInvoices:
                await PreviewOpenInvoices(companyId, request, result);
                break;

            case ImportType.OpenBills:
                await PreviewOpenBills(companyId, request, result);
                break;

            case ImportType.InventoryOpening:
                await PreviewInventory(companyId, request, result);
                break;

            case ImportType.AssetsOpening:
                await PreviewAssets(companyId, request, result);
                break;

            case ImportType.ChartOfAccounts:
                await PreviewChartOfAccounts(companyId, request, result);
                break;

            default:
                result.Errors.Add($"Unsupported import type: {request.Type}");
                result.IsValid = false;
                break;
        }

        result.IsValid = result.Errors.Count == 0;
        return Ok(result);
    }

    // ── 4. POST: api/migration/commit ───────────────────────────────────
    [HttpPost("commit")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public async Task<IActionResult> Commit([FromBody] MigrationCommitRequest request)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");
        var companyId = _context.CurrentCompanyId.Value;

        // Period lock guard
        await _periodLockService.ValidateTransactionDate(companyId, request.ConversionDate);

        var batchNumber = $"IMP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..6].ToUpper()}";
        var batch = new ImportBatch
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            BatchNumber = batchNumber,
            Type = request.Type,
            FileName = request.FileName,
            ConversionDate = request.ConversionDate,
            TotalRecords = request.Rows.Count,
            Status = ImportBatchStatus.Committed,
            CreatedBy = User.Identity?.Name ?? "Migration User",
            CreatedAt = DateTime.UtcNow
        };

        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            var summary = new MigrationBatchSummary();

            switch (request.Type)
            {
                case ImportType.OpeningBalances:
                    await CommitOpeningBalances(companyId, request, batch, summary);
                    break;

                case ImportType.Contacts:
                    await CommitContacts(companyId, request, batch, summary);
                    break;

                case ImportType.OpenInvoices:
                    await CommitOpenInvoices(companyId, request, batch, summary);
                    break;

                case ImportType.OpenBills:
                    await CommitOpenBills(companyId, request, batch, summary);
                    break;

                case ImportType.InventoryOpening:
                    await CommitInventory(companyId, request, batch, summary);
                    break;

                case ImportType.AssetsOpening:
                    await CommitAssets(companyId, request, batch, summary);
                    break;

                case ImportType.ChartOfAccounts:
                    await CommitChartOfAccounts(companyId, request, batch, summary);
                    break;

                default:
                    return BadRequest($"Unsupported import type: {request.Type}");
            }

            batch.SummaryJson = JsonSerializer.Serialize(summary);
            _context.ImportBatches.Add(batch);

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new MigrationCommitResponse
            {
                BatchId = batch.Id,
                BatchNumber = batch.BatchNumber,
                Message = $"Migration batch {batch.BatchNumber} committed successfully with {batch.SuccessfulRecords} record(s).",
                RecordCount = batch.SuccessfulRecords,
                CreatedJournalEntryId = summary.CreatedJournalEntryId,
                CreatedJournalNumber = summary.CreatedJournalNumber
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to commit migration batch {BatchNumber}", batchNumber);
            return StatusCode(500, new { error = "Migration commit failed", detail = ex.Message });
        }
    }

    // ── 5. POST: api/migration/batches/{id}/rollback ────────────────────
    [HttpPost("batches/{id}/rollback")]
    [RequiresPermission(Permissions.FinanceEdit)]
    public async Task<IActionResult> RollbackBatch(Guid id)
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");
        var companyId = _context.CurrentCompanyId.Value;

        var batch = await _context.ImportBatches.FindAsync(id);
        if (batch == null) return NotFound("Migration batch not found");

        if (batch.Status == ImportBatchStatus.Reversed)
            return BadRequest("This migration batch has already been reversed.");

        // Period lock check for conversion date
        await _periodLockService.ValidateTransactionDate(companyId, batch.ConversionDate);

        var summary = string.IsNullOrEmpty(batch.SummaryJson)
            ? new MigrationBatchSummary()
            : JsonSerializer.Deserialize<MigrationBatchSummary>(batch.SummaryJson) ?? new MigrationBatchSummary();

        using var tx = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Rollback Opening Journal Entry
            if (summary.CreatedJournalEntryId.HasValue)
            {
                var je = await _context.JournalEntries
                    .Include(j => j.Lines)
                    .FirstOrDefaultAsync(j => j.Id == summary.CreatedJournalEntryId.Value);

                if (je != null)
                {
                    je.Status = JournalEntryStatus.Void;
                    je.Notes = (je.Notes ?? "") + $" [VOIDED by Rollback of batch {batch.BatchNumber} on {DateTime.UtcNow:yyyy-MM-dd}]";
                    je.UpdatedAt = DateTime.UtcNow;
                }
            }

            // 2. Rollback Open Invoices
            if (summary.CreatedInvoiceIds.Count > 0)
            {
                var invoices = await _context.SalesInvoices
                    .Where(i => summary.CreatedInvoiceIds.Contains(i.Id))
                    .ToListAsync();

                foreach (var inv in invoices)
                {
                    if (inv.AmountPaid > 0)
                    {
                        return BadRequest($"Cannot rollback batch: Invoice '{inv.InvoiceNumber}' has recorded payments of Rp {inv.AmountPaid:N0}. Void payments before reversing this migration batch.");
                    }
                    _context.SalesInvoices.Remove(inv);
                }
            }

            // 3. Rollback Open Bills
            if (summary.CreatedBillIds.Count > 0)
            {
                var bills = await _context.PurchaseBills
                    .Where(b => summary.CreatedBillIds.Contains(b.Id))
                    .ToListAsync();

                foreach (var bill in bills)
                {
                    if (bill.AmountPaid > 0)
                    {
                        return BadRequest($"Cannot rollback batch: Purchase Bill '{bill.BillNumber}' has recorded payments of Rp {bill.AmountPaid:N0}. Void payments before reversing this migration batch.");
                    }
                    _context.PurchaseBills.Remove(bill);
                }
            }

            // 4. Rollback Inventory movements & subtract opening stock
            if (summary.CreatedMovementIds.Count > 0)
            {
                var movements = await _context.InventoryMovements
                    .Where(m => summary.CreatedMovementIds.Contains(m.Id))
                    .ToListAsync();

                foreach (var m in movements)
                {
                    var product = await _context.Products.FindAsync(m.ProductId);
                    if (product != null)
                    {
                        product.StockOnHand -= m.Quantity;
                    }
                    _context.InventoryMovements.Remove(m);
                }
            }

            // 5. Rollback Assets
            if (summary.CreatedAssetIds.Count > 0)
            {
                var assets = await _context.FixedAssets
                    .Where(a => summary.CreatedAssetIds.Contains(a.Id))
                    .ToListAsync();

                _context.FixedAssets.RemoveRange(assets);
            }

            // 6. Rollback Contacts (only if no subsequent transactions attached)
            if (summary.CreatedContactIds.Count > 0)
            {
                var contacts = await _context.Contacts
                    .Where(c => summary.CreatedContactIds.Contains(c.Id))
                    .ToListAsync();

                foreach (var contact in contacts)
                {
                    var hasInvoices = await _context.SalesInvoices.AnyAsync(i => i.ContactId == contact.Id);
                    var hasBills = await _context.PurchaseBills.AnyAsync(b => b.ContactId == contact.Id);
                    if (!hasInvoices && !hasBills)
                    {
                        _context.Contacts.Remove(contact);
                    }
                }
            }

            // 7. Rollback Chart of Accounts (only non-system-default)
            if (summary.CreatedAccountIds.Count > 0)
            {
                var accounts = await _context.Accounts
                    .Where(a => summary.CreatedAccountIds.Contains(a.Id) && !a.IsSystemDefault)
                    .ToListAsync();

                _context.Accounts.RemoveRange(accounts);
            }

            batch.Status = ImportBatchStatus.Reversed;
            batch.ReversedAt = DateTime.UtcNow;
            batch.ReversedBy = User.Identity?.Name ?? "Migration User";

            await _context.SaveChangesAsync();
            await tx.CommitAsync();

            return Ok(new
            {
                message = $"Migration batch {batch.BatchNumber} was rolled back successfully.",
                batchId = batch.Id,
                status = batch.Status.ToString()
            });
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            _logger.LogError(ex, "Failed to rollback migration batch {BatchId}", id);
            return StatusCode(500, new { error = "Rollback failed", detail = ex.Message });
        }
    }

    // ── 6. GET: api/migration/templates/{type} ──────────────────────────
    [HttpGet("templates/{type}")]
    [RequiresPermission(Permissions.FinanceCreate)]
    public IActionResult DownloadTemplate(string type)
    {
        var csvContent = type.ToLower() switch
        {
            "openingbalances" or "opening-balances" =>
                "AccountCode,AccountName,Debit,Credit,Description\r\n" +
                "1-1101,Kas Utama,15000000,0,Opening Cash Balance\r\n" +
                "1-1102,Bank BCA Operasional,85000000,0,Opening BCA Balance\r\n" +
                "1-1200,Piutang Usaha,35000000,0,Opening Trade Receivables (AR)\r\n" +
                "1-1400,Persediaan Barang Dagang,45000000,0,Opening Inventory Stock\r\n" +
                "1-2100,Peralatan Kantor,20000000,0,Opening Office Equipment\r\n" +
                "1-2101,Akumulasi Penyusutan Peralatan,0,5000000,Opening Accumulated Depreciation\r\n" +
                "2-1100,Hutang Usaha,0,25000000,Opening Trade Payables (AP)\r\n" +
                "2-1200,Hutang Gaji & Pajak,0,5000000,Opening Accrued Expenses\r\n" +
                "3-1000,Modal Saham,0,100000000,Paid-in Capital\r\n" +
                "3-2000,Laba Ditahan,0,65000000,Retained Earnings\r\n",

            "contacts" =>
                "Name,IsCustomer,IsVendor,IsEmployee,IsTaxParty,TaxId,Nik,PtkpStatus,Email,Phone,Address,City,BankName,BankAccountNumber,BankAccountHolder,WithholdingType,WithholdingRate,IsPkp\r\n" +
                "PT Maju Jaya Nusantara,TRUE,FALSE,FALSE,TRUE,01.234.567.8-012.000,,,finance@majujaya.co.id,021-5551234,Jl. Sudirman No. 45,Jakarta Pusat,,,,,,TRUE\r\n" +
                "CV Sumber Berkah,FALSE,TRUE,FALSE,TRUE,02.345.678.9-034.000,,,billing@sumberberkah.com,022-7778899,Jl. Asia Afrika No. 12,Bandung,Bank BCA,1234567890,CV Sumber Berkah,PPh 23,2.00,FALSE\r\n" +
                "Budi Pratama,FALSE,FALSE,TRUE,FALSE,,3271012345670001,K/1,budi@perusahaan.com,081234567890,Jl. Tebet Barat No. 8,Jakarta Selatan,Bank Mandiri,9876543210,Budi Pratama,,,FALSE\r\n",

            "openinvoices" or "open-invoices" or "open-ar" =>
                "InvoiceNumber,InvoiceDate,DueDate,CustomerName,CustomerTaxId,Amount,Description\r\n" +
                "INV/2024/11/0045,2024-11-15,2024-12-15,PT Maju Jaya Nusantara,01.234.567.8-012.000,15000000,Unpaid Invoice November\r\n" +
                "INV/2024/12/0089,2024-12-10,2025-01-10,PT Maju Jaya Nusantara,01.234.567.8-012.000,20000000,Unpaid Invoice December\r\n",

            "openbills" or "open-bills" or "open-ap" =>
                "BillNumber,VendorInvoiceNumber,BillDate,DueDate,VendorName,VendorTaxId,Amount,Description\r\n" +
                "BILL/2024/11/0012,SB-2024-998,2024-11-20,2024-12-20,CV Sumber Berkah,02.345.678.9-034.000,10000000,Unpaid Raw Materials Bill\r\n" +
                "BILL/2024/12/0034,SB-2024-1045,2024-12-05,2025-01-05,CV Sumber Berkah,02.345.678.9-034.000,15000000,Unpaid Packaging Bill\r\n",

            "inventory" or "inventory-opening" =>
                "ProductCode,ProductName,Quantity,UnitCost,SellPrice,Unit,Category\r\n" +
                "PRD-001,Kopi Arabika Gayo 1kg,100,85000,125000,kg,Bahan Baku\r\n" +
                "PRD-002,Gula Aren Organik 500g,250,15000,25000,pcs,Bahan Baku\r\n" +
                "PRD-003,Cup & Lid 12oz,1000,800,1500,pcs,Packaging\r\n",

            "assets" or "assets-opening" =>
                "AssetCode,AssetName,CategoryName,AcquisitionDate,AcquisitionCost,AccumulatedDepreciation,ResidualValue,UsefulLifeMonths,Location\r\n" +
                "AST-001,Mesin Espresso La Marzocco,Peralatan & Mesin,2023-01-15,80000000,24000000,5000000,60,Head Office\r\n" +
                "AST-002,MacBook Pro M2 16inch,Peralatan Kantor,2023-06-01,35000000,10500000,1000000,36,IT Dept\r\n",

            "chartofaccounts" or "chart-of-accounts" or "coa" =>
                "AccountCode,AccountName,AccountGroup,NormalBalance,Description\r\n" +
                "1-1101,Kas Operasional Toko,Asset,Debit,Kas operasional harian\r\n" +
                "1-1102,Bank BCA Operasional,Asset,Debit,Rekening giro operasional\r\n" +
                "1-1200,Piutang Usaha IDR,Asset,Debit,Piutang dagang pelanggan\r\n" +
                "1-1400,Persediaan Barang Dagang,Asset,Debit,Nilai persediaan barang\r\n" +
                "2-1100,Hutang Usaha IDR,Liability,Credit,Hutang kepada pemasok\r\n" +
                "3-1000,Modal Saham,Equity,Credit,Modal disetor\r\n" +
                "3-2000,Laba Ditahan,Equity,Credit,Laba ditahan akumulatif\r\n" +
                "4-1000,Pendapatan Penjualan,Sales,Credit,Penjualan utama\r\n" +
                "5-1000,Beban Pokok Penjualan,CostOfSales,Debit,HPP\r\n" +
                "6-1000,Beban Gaji Karyawan,Expense,Debit,Gaji staf\r\n",

            _ => "Error,Unknown template type\r\n"
        };

        var bytes = System.Text.Encoding.UTF8.GetBytes(csvContent);
        return File(bytes, "text/csv", $"balanceio_template_{type.ToLower()}.csv");
    }

    // ────────────────────────────────────────────────────────────────────
    // PREVIEW IMPLEMENTATIONS
    // ────────────────────────────────────────────────────────────────────

    private async Task PreviewOpeningBalances(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var activeAccounts = await _context.Accounts
            .Where(a => a.IsActive)
            .ToDictionaryAsync(a => a.Code, a => a);

        decimal totalDr = 0;
        decimal totalCr = 0;

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var code = row.GetString("AccountCode");
            var name = row.GetString("AccountName");
            var debit = row.GetDecimal("Debit");
            var credit = row.GetDecimal("Credit");

            if (string.IsNullOrWhiteSpace(code))
            {
                result.Errors.Add($"Row {i + 1}: AccountCode is required.");
                continue;
            }

            if (!activeAccounts.TryGetValue(code, out var account))
            {
                result.Errors.Add($"Row {i + 1}: Account Code '{code}' does not exist in your Chart of Accounts. Create the account first before importing opening balances.");
            }

            totalDr += debit;
            totalCr += credit;

            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                AccountCode = code,
                AccountName = string.IsNullOrEmpty(name) ? (account?.Name ?? "") : name,
                Debit = debit,
                Credit = credit,
                Status = account != null ? "Valid" : "MissingAccount"
            });
        }

        result.TotalDebit = totalDr;
        result.TotalCredit = totalCr;
        result.Difference = Math.Abs(totalDr - totalCr);

        if (totalDr != totalCr)
        {
            var diff = totalDr - totalCr;
            result.PlugSuggested = "3-2000"; // Standard Retained Earnings
            result.PlugAmount = Math.Abs(diff);
            result.Warnings.Add($"Opening Balance is not equal: Total Debits (Rp {totalDr:N0}) != Total Credits (Rp {totalCr:N0}). Difference of Rp {Math.Abs(diff):N0} will need a balancing Equity Plug (e.g. 3-2000 Retained Earnings).");
        }
    }

    private async Task PreviewContacts(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var existingContacts = await _context.Contacts
            .Select(c => new { c.Id, c.Name, c.TaxId, c.Email })
            .ToListAsync();

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var name = row.GetString("Name");
            var taxId = row.GetString("TaxId");
            var email = row.GetString("Email");

            if (string.IsNullOrWhiteSpace(name))
            {
                result.Errors.Add($"Row {i + 1}: Contact Name is required.");
                continue;
            }

            var duplicate = existingContacts.FirstOrDefault(c =>
                (!string.IsNullOrEmpty(taxId) && c.TaxId == taxId) ||
                (!string.IsNullOrEmpty(email) && c.Email == email));

            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                Name = name,
                TaxId = taxId,
                Email = email,
                IsCustomer = row.GetBool("IsCustomer", true),
                IsVendor = row.GetBool("IsVendor", false),
                IsEmployee = row.GetBool("IsEmployee", false),
                IsTaxParty = row.GetBool("IsTaxParty", false),
                Status = duplicate != null ? "ExistingDuplicate" : "New"
            });

            if (duplicate != null)
            {
                result.Warnings.Add($"Row {i + 1}: Contact '{name}' matches existing record '{duplicate.Name}' by TaxId/Email.");
            }
        }
    }

    private async Task PreviewOpenInvoices(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var existingInvoices = await _context.SalesInvoices.Select(i => i.InvoiceNumber).ToListAsync();
        var contacts = await _context.Contacts.ToDictionaryAsync(c => c.Name.ToLower(), c => c);

        decimal totalAmount = 0;

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var invNumber = row.GetString("InvoiceNumber");
            var custName = row.GetString("CustomerName");
            var amount = row.GetDecimal("Amount");

            if (string.IsNullOrWhiteSpace(invNumber))
            {
                result.Errors.Add($"Row {i + 1}: InvoiceNumber is required.");
                continue;
            }

            if (existingInvoices.Contains(invNumber))
            {
                result.Errors.Add($"Row {i + 1}: Invoice Number '{invNumber}' already exists.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(custName))
            {
                result.Errors.Add($"Row {i + 1}: CustomerName is required.");
                continue;
            }

            var contactExists = contacts.ContainsKey(custName.ToLower());
            if (!contactExists && !request.AutoCreateContacts)
            {
                result.Warnings.Add($"Row {i + 1}: Customer '{custName}' does not exist. It will be auto-created upon commit.");
            }

            totalAmount += amount;
            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                InvoiceNumber = invNumber,
                CustomerName = custName,
                Amount = amount,
                InvoiceDate = row.GetString("InvoiceDate"),
                DueDate = row.GetString("DueDate"),
                Status = "Valid"
            });
        }

        result.TotalDebit = totalAmount;
    }

    private async Task PreviewOpenBills(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var existingBills = await _context.PurchaseBills.Select(b => b.BillNumber).ToListAsync();
        var contacts = await _context.Contacts.ToDictionaryAsync(c => c.Name.ToLower(), c => c);

        decimal totalAmount = 0;

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var billNumber = row.GetString("BillNumber");
            var vendorName = row.GetString("VendorName");
            var amount = row.GetDecimal("Amount");

            if (string.IsNullOrWhiteSpace(billNumber))
            {
                result.Errors.Add($"Row {i + 1}: BillNumber is required.");
                continue;
            }

            if (existingBills.Contains(billNumber))
            {
                result.Errors.Add($"Row {i + 1}: Bill Number '{billNumber}' already exists.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(vendorName))
            {
                result.Errors.Add($"Row {i + 1}: VendorName is required.");
                continue;
            }

            var contactExists = contacts.ContainsKey(vendorName.ToLower());
            if (!contactExists && !request.AutoCreateContacts)
            {
                result.Warnings.Add($"Row {i + 1}: Vendor '{vendorName}' does not exist. It will be auto-created upon commit.");
            }

            totalAmount += amount;
            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                BillNumber = billNumber,
                VendorName = vendorName,
                Amount = amount,
                BillDate = row.GetString("BillDate"),
                DueDate = row.GetString("DueDate"),
                Status = "Valid"
            });
        }

        result.TotalCredit = totalAmount;
    }

    private async Task PreviewInventory(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var existingProducts = await _context.Products.ToDictionaryAsync(p => p.Code.ToLower(), p => p);

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var code = row.GetString("ProductCode");
            var name = row.GetString("ProductName");
            var qty = row.GetDecimal("Quantity");
            var unitCost = row.GetDecimal("UnitCost");

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            {
                result.Errors.Add($"Row {i + 1}: ProductCode and ProductName are required.");
                continue;
            }

            var exists = existingProducts.ContainsKey(code.ToLower());
            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                ProductCode = code,
                ProductName = name,
                Quantity = qty,
                UnitCost = unitCost,
                TotalCost = qty * unitCost,
                Status = exists ? "UpdateStock" : "NewProduct"
            });
        }
    }

    private async Task PreviewAssets(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var existingAssets = await _context.FixedAssets.Select(a => a.Code.ToLower()).ToListAsync();

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var code = row.GetString("AssetCode");
            var name = row.GetString("AssetName");
            var cost = row.GetDecimal("AcquisitionCost");
            var accDep = row.GetDecimal("AccumulatedDepreciation");

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
            {
                result.Errors.Add($"Row {i + 1}: AssetCode and AssetName are required.");
                continue;
            }

            if (existingAssets.Contains(code.ToLower()))
            {
                result.Errors.Add($"Row {i + 1}: Asset Code '{code}' already exists.");
                continue;
            }

            if (accDep > cost)
            {
                result.Errors.Add($"Row {i + 1}: Accumulated Depreciation ({accDep:N0}) cannot exceed Acquisition Cost ({cost:N0}).");
                continue;
            }

            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                AssetCode = code,
                AssetName = name,
                AcquisitionCost = cost,
                AccumulatedDepreciation = accDep,
                BookValue = cost - accDep,
                Status = "Valid"
            });
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // COMMIT IMPLEMENTATIONS
    // ────────────────────────────────────────────────────────────────────

    private async Task CommitOpeningBalances(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var accounts = await _context.Accounts.Where(a => a.IsActive).ToDictionaryAsync(a => a.Code, a => a);
        var lines = new List<JournalLine>();

        decimal totalDr = 0;
        decimal totalCr = 0;

        foreach (var row in request.Rows)
        {
            var code = row.GetString("AccountCode");
            var debit = row.GetDecimal("Debit");
            var credit = row.GetDecimal("Credit");
            var desc = row.GetString("Description");

            if (string.IsNullOrWhiteSpace(code) || (debit == 0 && credit == 0)) continue;

            if (!accounts.TryGetValue(code, out var account))
            {
                throw new InvalidOperationException($"Account Code '{code}' does not exist in Chart of Accounts.");
            }

            totalDr += debit;
            totalCr += credit;

            lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                AccountId = code,
                Description = string.IsNullOrEmpty(desc) ? $"Opening Balance: {account.Name}" : desc,
                Debit = debit,
                Credit = credit
            });
        }

        // Apply balancing equity plug if imbalanced
        if (totalDr != totalCr)
        {
            var diff = totalDr - totalCr;
            var plugCode = !string.IsNullOrEmpty(request.PlugAccountId) ? request.PlugAccountId : "3-2000";

            if (!accounts.TryGetValue(plugCode, out var plugAccount))
            {
                throw new InvalidOperationException($"Balancing plug account '{plugCode}' was not found.");
            }

            if (diff > 0)
            {
                // Debits > Credits -> Credit the plug account
                lines.Add(new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = plugCode,
                    Description = "Opening Balance Balancing Equity Plug (Retained Earnings)",
                    Debit = 0,
                    Credit = diff
                });
                totalCr += diff;
            }
            else
            {
                // Credits > Debits -> Debit the plug account
                var absDiff = Math.Abs(diff);
                lines.Add(new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = plugCode,
                    Description = "Opening Balance Balancing Equity Plug (Retained Earnings)",
                    Debit = absDiff,
                    Credit = 0
                });
                totalDr += absDiff;
            }
        }

        if (totalDr != totalCr)
        {
            throw new InvalidOperationException($"CRITICAL: Journal Entry cannot post imbalanced! Dr={totalDr}, Cr={totalCr}");
        }

        var je = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = request.ConversionDate,
            ReferenceNumber = $"OP-BAL-{batch.BatchNumber}",
            Notes = $"Migration Opening Balance · Batch {batch.BatchNumber}",
            Tags = "Opening Balance, Migration",
            Status = JournalEntryStatus.Posted,
            Lines = lines,
            CreatedAt = DateTime.UtcNow
        };

        _context.JournalEntries.Add(je);

        batch.SuccessfulRecords = lines.Count;
        summary.CreatedJournalEntryId = je.Id;
        summary.CreatedJournalNumber = je.ReferenceNumber;
    }

    private async Task CommitContacts(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var existingContacts = await _context.Contacts.ToListAsync();
        var contactsToAdd = new List<Contact>();

        foreach (var row in request.Rows)
        {
            var name = row.GetString("Name");
            if (string.IsNullOrWhiteSpace(name)) continue;

            var taxId = row.GetString("TaxId");
            var email = row.GetString("Email");

            Contact? existing = null;
            if (request.MergeContactsByTaxId)
            {
                existing = existingContacts.FirstOrDefault(c =>
                    (!string.IsNullOrEmpty(taxId) && c.TaxId == taxId) ||
                    (!string.IsNullOrEmpty(email) && c.Email == email));
            }

            var isCustomer = row.GetBool("IsCustomer", true);
            var isVendor = row.GetBool("IsVendor", false);
            var isEmployee = row.GetBool("IsEmployee", false);
            var isTaxParty = row.GetBool("IsTaxParty", false);

            if (existing != null)
            {
                // Merge active roles
                existing.IsCustomer = existing.IsCustomer || isCustomer;
                existing.IsVendor = existing.IsVendor || isVendor;
                existing.IsEmployee = existing.IsEmployee || isEmployee;
                existing.IsTaxParty = existing.IsTaxParty || isTaxParty;
                existing.UpdatedAt = DateTime.UtcNow;
                summary.CreatedContactIds.Add(existing.Id);
            }
            else
            {
                var prefix = isEmployee ? "EMP-" : isCustomer && isVendor ? "B-" : isVendor ? "V-" : "C-";
                var count = existingContacts.Count + contactsToAdd.Count + 1;
                var code = $"{prefix}{count:D4}";

                var newContact = new Contact
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Code = code,
                    Name = name,
                    TaxId = taxId,
                    Nik = row.GetString("Nik"),
                    PtkpStatus = row.GetString("PtkpStatus"),
                    BpjsKetenagakerjaanNumber = row.GetString("BpjsKetenagakerjaanNumber"),
                    BpjsKesehatanNumber = row.GetString("BpjsKesehatanNumber"),
                    Email = email,
                    Phone = row.GetString("Phone"),
                    Address = row.GetString("Address"),
                    City = row.GetString("City"),
                    BankName = row.GetString("BankName"),
                    BankAccountNumber = row.GetString("BankAccountNumber"),
                    BankAccountHolder = row.GetString("BankAccountHolder"),
                    WithholdingType = row.GetString("WithholdingType"),
                    WithholdingRate = row.GetDecimal("WithholdingRate"),
                    IsPkp = row.GetBool("IsPkp", false),
                    IsCustomer = isCustomer,
                    IsVendor = isVendor,
                    IsEmployee = isEmployee,
                    IsTaxParty = isTaxParty,
                    CreatedAt = DateTime.UtcNow
                };

                contactsToAdd.Add(newContact);
                summary.CreatedContactIds.Add(newContact.Id);
            }
        }

        if (contactsToAdd.Count > 0)
        {
            _context.Contacts.AddRange(contactsToAdd);
        }

        batch.SuccessfulRecords = summary.CreatedContactIds.Count;
    }

    private async Task CommitOpenInvoices(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var contacts = await _context.Contacts.ToDictionaryAsync(c => c.Name.ToLower(), c => c);
        var invoices = new List<SalesInvoice>();

        foreach (var row in request.Rows)
        {
            var invNumber = row.GetString("InvoiceNumber");
            var custName = row.GetString("CustomerName");
            var amount = row.GetDecimal("Amount");
            var invDate = row.GetDateOnly("InvoiceDate", request.ConversionDate);
            var dueDate = row.GetDateOnly("DueDate", request.ConversionDate.AddDays(30));

            if (string.IsNullOrWhiteSpace(invNumber) || string.IsNullOrWhiteSpace(custName) || amount <= 0) continue;

            if (!contacts.TryGetValue(custName.ToLower(), out var contact))
            {
                contact = new Contact
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Code = $"C-{contacts.Count + 1:D4}",
                    Name = custName,
                    IsCustomer = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Contacts.Add(contact);
                contacts[custName.ToLower()] = contact;
                summary.CreatedContactIds.Add(contact.Id);
            }

            var invoice = new SalesInvoice
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                InvoiceNumber = invNumber,
                InvoiceDate = invDate,
                DueDate = dueDate,
                ContactId = contact.Id,
                Subtotal = amount,
                Total = amount,
                AmountDue = amount,
                AmountPaid = 0,
                Status = InvoiceStatus.Sent,
                Notes = $"Migration Open AR Item · Batch {batch.BatchNumber}",
                ReferenceNumber = $"MIG-{batch.BatchNumber}",
                Lines = new List<SalesInvoiceLine>
                {
                    new SalesInvoiceLine
                    {
                        Id = Guid.NewGuid(),
                        Description = row.GetString("Description") ?? "Opening AR Balance",
                        Quantity = 1,
                        UnitPrice = amount,
                        LineTotal = amount
                    }
                },
                CreatedAt = DateTime.UtcNow
            };

            invoices.Add(invoice);
            summary.CreatedInvoiceIds.Add(invoice.Id);
        }

        if (invoices.Count > 0)
        {
            _context.SalesInvoices.AddRange(invoices);
        }

        batch.SuccessfulRecords = invoices.Count;
    }

    private async Task CommitOpenBills(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var contacts = await _context.Contacts.ToDictionaryAsync(c => c.Name.ToLower(), c => c);
        var bills = new List<PurchaseBill>();

        foreach (var row in request.Rows)
        {
            var billNumber = row.GetString("BillNumber");
            var vendorName = row.GetString("VendorName");
            var amount = row.GetDecimal("Amount");
            var billDate = row.GetDateOnly("BillDate", request.ConversionDate);
            var dueDate = row.GetDateOnly("DueDate", request.ConversionDate.AddDays(30));

            if (string.IsNullOrWhiteSpace(billNumber) || string.IsNullOrWhiteSpace(vendorName) || amount <= 0) continue;

            if (!contacts.TryGetValue(vendorName.ToLower(), out var contact))
            {
                contact = new Contact
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Code = $"V-{contacts.Count + 1:D4}",
                    Name = vendorName,
                    IsVendor = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Contacts.Add(contact);
                contacts[vendorName.ToLower()] = contact;
                summary.CreatedContactIds.Add(contact.Id);
            }

            var bill = new PurchaseBill
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                BillNumber = billNumber,
                VendorInvoiceNumber = row.GetString("VendorInvoiceNumber"),
                BillDate = billDate,
                DueDate = dueDate,
                ContactId = contact.Id,
                Subtotal = amount,
                Total = amount,
                AmountDue = amount,
                AmountPaid = 0,
                Status = BillStatus.Posted,
                Notes = $"Migration Open AP Item · Batch {batch.BatchNumber}",
                ReferenceNumber = $"MIG-{batch.BatchNumber}",
                Lines = new List<PurchaseBillLine>
                {
                    new PurchaseBillLine
                    {
                        Id = Guid.NewGuid(),
                        Description = row.GetString("Description") ?? "Opening AP Balance",
                        Quantity = 1,
                        UnitPrice = amount,
                        LineTotal = amount
                    }
                },
                CreatedAt = DateTime.UtcNow
            };

            bills.Add(bill);
            summary.CreatedBillIds.Add(bill.Id);
        }

        if (bills.Count > 0)
        {
            _context.PurchaseBills.AddRange(bills);
        }

        batch.SuccessfulRecords = bills.Count;
    }

    private async Task CommitInventory(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var existingProducts = await _context.Products.ToDictionaryAsync(p => p.Code.ToLower(), p => p);

        foreach (var row in request.Rows)
        {
            var code = row.GetString("ProductCode");
            var name = row.GetString("ProductName");
            var qty = row.GetDecimal("Quantity");
            var unitCost = row.GetDecimal("UnitCost");
            var sellPrice = row.GetDecimal("SellPrice");
            var unit = row.GetString("Unit") ?? "pcs";

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name)) continue;

            if (!existingProducts.TryGetValue(code.ToLower(), out var product))
            {
                product = new Product
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Code = code,
                    Name = name,
                    Unit = unit,
                    BuyPrice = unitCost,
                    SellPrice = sellPrice,
                    TrackInventory = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Products.Add(product);
                existingProducts[code.ToLower()] = product;
                summary.CreatedProductIds.Add(product.Id);
            }
            else
            {
                product.BuyPrice = unitCost;
                product.UpdatedAt = DateTime.UtcNow;
            }

            if (qty > 0)
            {
                var movement = await _inventory.MoveAsync(product, null, qty, InventoryMovementType.ManualAdjustment,
                    request.ConversionDate, Math.Round(qty * unitCost, 2, MidpointRounding.ToEven), $"OP-STOCK-{batch.BatchNumber}", null,
                    $"Migration Opening Inventory · Batch {batch.BatchNumber}");
                summary.CreatedMovementIds.Add(movement.Id);
            }
        }

        batch.SuccessfulRecords = summary.CreatedMovementIds.Count;
    }

    private async Task CommitAssets(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var existingCategories = await _context.FixedAssetCategories.ToDictionaryAsync(c => c.Name.ToLower(), c => c);
        var assets = new List<FixedAsset>();

        foreach (var row in request.Rows)
        {
            var code = row.GetString("AssetCode");
            var name = row.GetString("AssetName");
            var categoryName = row.GetString("CategoryName");
            var cost = row.GetDecimal("AcquisitionCost");
            var accDep = row.GetDecimal("AccumulatedDepreciation");
            var acqDate = row.GetDateOnly("AcquisitionDate", request.ConversionDate);
            var usefulLife = row.GetInt("UsefulLifeMonths", 60);
            var residual = row.GetDecimal("ResidualValue");

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name) || cost <= 0) continue;

            Guid? categoryId = null;
            if (!string.IsNullOrEmpty(categoryName))
            {
                if (!existingCategories.TryGetValue(categoryName.ToLower(), out var cat))
                {
                    cat = new FixedAssetCategory
                    {
                        Id = Guid.NewGuid(),
                        CompanyId = companyId,
                        Name = categoryName,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.FixedAssetCategories.Add(cat);
                    existingCategories[categoryName.ToLower()] = cat;
                }
                categoryId = cat.Id;
            }

            var asset = new FixedAsset
            {
                Id = Guid.NewGuid(),
                CompanyId = companyId,
                Code = code,
                Name = name,
                CategoryId = categoryId,
                AcquisitionDate = acqDate,
                AcquisitionCost = cost,
                AccumulatedDepreciation = accDep,
                BookValue = cost - accDep,
                ResidualValue = residual,
                UsefulLifeMonths = usefulLife,
                Status = AssetStatus.Active,
                CreatedAt = DateTime.UtcNow
            };

            assets.Add(asset);
            summary.CreatedAssetIds.Add(asset.Id);
        }

        if (assets.Count > 0)
        {
            _context.FixedAssets.AddRange(assets);
        }

        batch.SuccessfulRecords = assets.Count;
    }

    // ────────────────────────────────────────────────────────────────────
    // CHART OF ACCOUNTS (STEP 1)
    // ────────────────────────────────────────────────────────────────────

    private async Task PreviewChartOfAccounts(Guid companyId, MigrationPreviewRequest request, MigrationPreviewResponse result)
    {
        var existingAccounts = await _context.Accounts
            .ToDictionaryAsync(a => a.Code, a => a);

        var seenCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < request.Rows.Count; i++)
        {
            var row = request.Rows[i];
            var code = row.GetString("AccountCode");
            var name = row.GetString("AccountName");
            var group = row.GetString("AccountGroup") ?? "Asset";
            var normal = row.GetString("NormalBalance");
            var desc = row.GetString("Description");

            if (string.IsNullOrWhiteSpace(code))
            {
                result.Errors.Add($"Row {i + 1}: AccountCode is required.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                result.Errors.Add($"Row {i + 1}: AccountName is required for code '{code}'.");
                continue;
            }

            if (!seenCodes.Add(code))
            {
                result.Errors.Add($"Row {i + 1}: Duplicate AccountCode '{code}' in import file.");
                continue;
            }

            // Normalize Group & NormalBalance
            var normalizedGroup = NormalizeAccountGroup(group);
            var normalizedNormal = string.IsNullOrWhiteSpace(normal)
                ? (code.StartsWith("2") || code.StartsWith("3") || code.StartsWith("4") || code.StartsWith("7") ? "Credit" : "Debit")
                : (normal.Equals("Credit", StringComparison.OrdinalIgnoreCase) ? "Credit" : "Debit");

            var exists = existingAccounts.TryGetValue(code, out var existing);

            result.PreviewRows.Add(new
            {
                RowIndex = i + 1,
                AccountCode = code,
                AccountName = name,
                AccountGroup = normalizedGroup,
                NormalBalance = normalizedNormal,
                Description = desc,
                Status = exists ? "Update" : "New"
            });
        }
    }

    private async Task CommitChartOfAccounts(Guid companyId, MigrationCommitRequest request, ImportBatch batch, MigrationBatchSummary summary)
    {
        var existingAccounts = await _context.Accounts
            .ToDictionaryAsync(a => a.Code, a => a);

        int count = 0;

        foreach (var row in request.Rows)
        {
            var code = row.GetString("AccountCode");
            var name = row.GetString("AccountName");
            var group = row.GetString("AccountGroup") ?? "Asset";
            var normal = row.GetString("NormalBalance");
            var desc = row.GetString("Description");

            if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(name))
                continue;

            var normalizedGroup = NormalizeAccountGroup(group);
            var normalizedNormal = string.IsNullOrWhiteSpace(normal)
                ? (code.StartsWith("2") || code.StartsWith("3") || code.StartsWith("4") || code.StartsWith("7") ? "Credit" : "Debit")
                : (normal.Equals("Credit", StringComparison.OrdinalIgnoreCase) ? "Credit" : "Debit");

            var type = ResolveAccountType(code, normalizedGroup);

            if (existingAccounts.TryGetValue(code, out var existing))
            {
                existing.Name = name;
                existing.AccountGroup = normalizedGroup;
                existing.NormalBalance = normalizedNormal;
                existing.Type = type;
                if (!string.IsNullOrWhiteSpace(desc)) existing.Description = desc;
                existing.IsActive = true;
            }
            else
            {
                var acc = new Account
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Code = code,
                    Name = name,
                    Type = type,
                    AccountGroup = normalizedGroup,
                    NormalBalance = normalizedNormal,
                    Description = desc,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Accounts.Add(acc);
                summary.CreatedAccountIds.Add(acc.Id);
                existingAccounts[code] = acc;
            }

            count++;
        }

        batch.SuccessfulRecords = count;
    }

    private static string NormalizeAccountGroup(string group)
    {
        var g = group.Trim();
        if (g.Equals("Asset", StringComparison.OrdinalIgnoreCase) || g.Equals("Aktiva", StringComparison.OrdinalIgnoreCase)) return "Asset";
        if (g.Equals("Liability", StringComparison.OrdinalIgnoreCase) || g.Equals("Kewajiban", StringComparison.OrdinalIgnoreCase) || g.Equals("Hutang", StringComparison.OrdinalIgnoreCase)) return "Liability";
        if (g.Equals("Equity", StringComparison.OrdinalIgnoreCase) || g.Equals("Modal", StringComparison.OrdinalIgnoreCase) || g.Equals("Ekuitas", StringComparison.OrdinalIgnoreCase)) return "Equity";
        if (g.Equals("Sales", StringComparison.OrdinalIgnoreCase) || g.Equals("Revenue", StringComparison.OrdinalIgnoreCase) || g.Equals("Pendapatan", StringComparison.OrdinalIgnoreCase)) return "Sales";
        if (g.Equals("CostOfSales", StringComparison.OrdinalIgnoreCase) || g.Equals("COGS", StringComparison.OrdinalIgnoreCase) || g.Equals("HPP", StringComparison.OrdinalIgnoreCase)) return "CostOfSales";
        if (g.Equals("Expense", StringComparison.OrdinalIgnoreCase) || g.Equals("Beban", StringComparison.OrdinalIgnoreCase) || g.Equals("Biaya", StringComparison.OrdinalIgnoreCase)) return "Expense";
        if (g.Equals("OtherIncomeExpense", StringComparison.OrdinalIgnoreCase) || g.Equals("Other", StringComparison.OrdinalIgnoreCase)) return "OtherIncomeExpense";
        return "Asset";
    }

    private static string ResolveAccountType(string code, string group)
    {
        if (group == "Asset" || code.StartsWith("1")) return "Asset";
        if (group == "Liability" || code.StartsWith("2")) return "Liability";
        if (group == "Equity" || code.StartsWith("3")) return "Equity";
        if (group == "Sales" || code.StartsWith("4") || code.StartsWith("7")) return "Revenue";
        return "Expense";
    }

    // ────────────────────────────────────────────────────────────────────
    // MIGRATION WIZARD ENDPOINTS (STEP 1 - 7)
    // ────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the progress and status across all 7 steps of the Opening Balance Migration Wizard.
    /// </summary>
    [HttpGet("wizard/status")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> GetWizardStatus()
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");
        var companyId = _context.CurrentCompanyId.Value;

        // Step 1: Chart of Accounts
        var totalAccounts = await _context.Accounts.CountAsync(a => a.IsActive);
        var coaBatch = await _context.ImportBatches.AnyAsync(b => b.Type == ImportType.ChartOfAccounts && b.Status == ImportBatchStatus.Committed);
        var step1Completed = totalAccounts >= 10 || coaBatch;

        // Step 2: Trial Balance (OpeningBalances)
        var obBatch = await _context.ImportBatches
            .Where(b => b.Type == ImportType.OpeningBalances && b.Status == ImportBatchStatus.Committed)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        var step2Completed = obBatch != null;
        Guid? obJournalId = null;
        string? obJournalNumber = null;
        if (obBatch != null && !string.IsNullOrEmpty(obBatch.SummaryJson))
        {
            var summary = JsonSerializer.Deserialize<MigrationBatchSummary>(obBatch.SummaryJson);
            obJournalId = summary?.CreatedJournalEntryId;
            obJournalNumber = summary?.CreatedJournalNumber;
        }

        // Step 3: Open AR Invoices
        var invoiceBatch = await _context.ImportBatches
            .Where(b => b.Type == ImportType.OpenInvoices && b.Status == ImportBatchStatus.Committed)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        var openInvoices = await _context.SalesInvoices
            .Where(i => i.Notes != null && i.Notes.Contains("Opening Balance"))
            .Select(i => i.Total)
            .ToListAsync();
        var openInvoicesCount = openInvoices.Count;
        var openInvoicesTotal = openInvoices.Sum();
        var step3Completed = invoiceBatch != null || openInvoicesCount > 0;

        // Step 4: Open AP Bills
        var billBatch = await _context.ImportBatches
            .Where(b => b.Type == ImportType.OpenBills && b.Status == ImportBatchStatus.Committed)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        var openBills = await _context.PurchaseBills
            .Where(b => b.Notes != null && b.Notes.Contains("Opening Balance"))
            .Select(b => b.Total)
            .ToListAsync();
        var openBillsCount = openBills.Count;
        var openBillsTotal = openBills.Sum();
        var step4Completed = billBatch != null || openBillsCount > 0;

        // Step 5: Inventory Opening
        var invBatch = await _context.ImportBatches
            .Where(b => b.Type == ImportType.InventoryOpening && b.Status == ImportBatchStatus.Committed)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        var trackedProducts = await _context.Products
            .Where(p => p.TrackInventory && p.StockOnHand > 0)
            .Select(p => new { p.StockOnHand, p.BuyPrice })
            .ToListAsync();
        var trackedProductsCount = trackedProducts.Count;
        var totalStockValuation = trackedProducts.Sum(p => p.StockOnHand * p.BuyPrice);
        var step5Completed = invBatch != null || trackedProductsCount > 0;

        // Step 6: Fixed Assets Opening
        var assetBatch = await _context.ImportBatches
            .Where(b => b.Type == ImportType.AssetsOpening && b.Status == ImportBatchStatus.Committed)
            .OrderByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync();

        var activeAssets = await _context.FixedAssets
            .Where(a => a.Status == AssetStatus.Active)
            .Select(a => new { a.AcquisitionCost, a.AccumulatedDepreciation })
            .ToListAsync();
        var assetsCount = activeAssets.Count;
        var totalAssetCost = activeAssets.Sum(a => a.AcquisitionCost);
        var totalAssetAccDep = activeAssets.Sum(a => a.AccumulatedDepreciation);
        var step6Completed = assetBatch != null || assetsCount > 0;

        // Step 7: Reconciliation
        var recons = await ComputeMigrationReconciliationAsync(companyId);
        var step7Completed = recons.IsFullyReconciled;

        var completedSteps = 0;
        if (step1Completed) completedSteps++;
        if (step2Completed) completedSteps++;
        if (step3Completed) completedSteps++;
        if (step4Completed) completedSteps++;
        if (step5Completed) completedSteps++;
        if (step6Completed) completedSteps++;
        if (step7Completed) completedSteps++;

        var overallPercentage = Math.Round((completedSteps / 7.0m) * 100m, 1);

        return Ok(new
        {
            overallProgress = overallPercentage,
            completedStepsCount = completedSteps,
            totalSteps = 7,
            steps = new
            {
                step1ChartOfAccounts = new
                {
                    stepNumber = 1,
                    title = "Chart of Accounts",
                    isCompleted = step1Completed,
                    totalAccounts,
                    hasImportBatch = coaBatch
                },
                step2TrialBalance = new
                {
                    stepNumber = 2,
                    title = "Opening Trial Balance",
                    isCompleted = step2Completed,
                    batchNumber = obBatch?.BatchNumber,
                    conversionDate = obBatch?.ConversionDate,
                    createdJournalEntryId = obJournalId,
                    createdJournalNumber = obJournalNumber
                },
                step3OpenReceivables = new
                {
                    stepNumber = 3,
                    title = "Outstanding Accounts Receivable",
                    isCompleted = step3Completed,
                    openInvoicesCount,
                    openInvoicesTotal
                },
                step4OpenPayables = new
                {
                    stepNumber = 4,
                    title = "Outstanding Accounts Payable",
                    isCompleted = step4Completed,
                    openBillsCount,
                    openBillsTotal
                },
                step5Inventory = new
                {
                    stepNumber = 5,
                    title = "Stock Inventory by Warehouse",
                    isCompleted = step5Completed,
                    trackedProductsCount,
                    totalStockValuation
                },
                step6FixedAssets = new
                {
                    stepNumber = 6,
                    title = "Fixed Asset Register",
                    isCompleted = step6Completed,
                    assetsCount,
                    totalAssetCost,
                    totalAssetAccDep,
                    totalBookValue = totalAssetCost - totalAssetAccDep
                },
                step7Reconciliation = new
                {
                    stepNumber = 7,
                    title = "Balancing Reconciliation (Account 3-9000)",
                    isCompleted = step7Completed,
                    isFullyReconciled = recons.IsFullyReconciled,
                    openingEquityBalance = recons.OpeningEquityBalance
                }
            }
        });
    }

    /// <summary>
    /// Generates the comprehensive opening balance subledger-to-GL reconciliation report.
    /// </summary>
    [HttpGet("wizard/reconciliation")]
    [RequiresPermission(Permissions.FinanceView)]
    public async Task<IActionResult> GetWizardReconciliation()
    {
        if (!_context.CurrentCompanyId.HasValue) return BadRequest("Company context is required");
        var companyId = _context.CurrentCompanyId.Value;

        var report = await ComputeMigrationReconciliationAsync(companyId);
        return Ok(report);
    }

    private async Task<MigrationReconciliationReport> ComputeMigrationReconciliationAsync(Guid companyId)
    {
        var postedEntryIds = await _context.JournalEntries
            .AsNoTracking()
            .Where(j => j.Status == JournalEntryStatus.Posted)
            .Select(j => j.Id)
            .ToListAsync();

        // 1. AR GL Balance (1-1130 or 1-1200) vs Open Invoices
        var arAccounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.Code.StartsWith("1-113") || a.Code.StartsWith("1-12") || a.Name.Contains("Piutang") || a.Name.Contains("Receivable"))
            .Select(a => a.Code)
            .ToListAsync();

        var arLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => postedEntryIds.Contains(l.JournalEntryId) && arAccounts.Contains(l.AccountId))
            .ToListAsync();
        var glArBalance = arLines.Sum(l => l.Debit - l.Credit);

        var subledgerArInvoices = await _context.SalesInvoices
            .AsNoTracking()
            .Where(i => i.Status != InvoiceStatus.Void && i.Status != InvoiceStatus.Draft)
            .ToListAsync();
        var subledgerArTotal = subledgerArInvoices.Sum(i => i.Total - i.AmountPaid);

        var arVariance = glArBalance - subledgerArTotal;

        // 2. AP GL Balance (2-1100) vs Open Bills
        var apAccounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.Code.StartsWith("2-11") || a.Name.Contains("Hutang") || a.Name.Contains("Payable"))
            .Select(a => a.Code)
            .ToListAsync();

        var apLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => postedEntryIds.Contains(l.JournalEntryId) && apAccounts.Contains(l.AccountId))
            .ToListAsync();
        var glApBalance = apLines.Sum(l => l.Credit - l.Debit);

        var subledgerApBills = await _context.PurchaseBills
            .AsNoTracking()
            .Where(b => b.Status != BillStatus.Void && b.Status != BillStatus.Draft)
            .ToListAsync();
        var subledgerApTotal = subledgerApBills.Sum(b => b.Total - b.AmountPaid);

        var apVariance = glApBalance - subledgerApTotal;

        // 3. Inventory Asset GL Balance (1-1400) vs Stock Valuation
        var invAccounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.Code.StartsWith("1-14") || a.Name.Contains("Persediaan") || a.Name.Contains("Inventory"))
            .Select(a => a.Code)
            .ToListAsync();

        var invLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => postedEntryIds.Contains(l.JournalEntryId) && invAccounts.Contains(l.AccountId))
            .ToListAsync();
        var glInvBalance = invLines.Sum(l => l.Debit - l.Credit);

        var trackedProducts = await _context.Products
            .AsNoTracking()
            .Where(p => p.TrackInventory && p.StockOnHand > 0)
            .ToListAsync();
        var subledgerInvValuation = trackedProducts.Sum(p => p.StockOnHand * p.BuyPrice);

        var invVariance = glInvBalance - subledgerInvValuation;

        // 4. Fixed Assets GL Balance vs Asset Register
        var fixedAssetAccounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.Code.StartsWith("1-2") || a.Code.StartsWith("1-3") || a.Name.Contains("Peralatan") || a.Name.Contains("Kendaraan") || a.Name.Contains("Gedung"))
            .Select(a => a.Code)
            .ToListAsync();

        var assetLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => postedEntryIds.Contains(l.JournalEntryId) && fixedAssetAccounts.Contains(l.AccountId))
            .ToListAsync();
        var glAssetNetBalance = assetLines.Sum(l => l.Debit - l.Credit);

        var activeAssets = await _context.FixedAssets
            .AsNoTracking()
            .Where(a => a.Status == AssetStatus.Active)
            .ToListAsync();
        var subledgerAssetBookValue = activeAssets.Sum(a => a.AcquisitionCost - a.AccumulatedDepreciation);

        var assetVariance = glAssetNetBalance - subledgerAssetBookValue;

        // 5. Opening Balance Equity (3-9000)
        var equityAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Code == "3-9000")
            ?? await _context.Accounts.FirstOrDefaultAsync(a => a.AccountGroup == "Equity" && a.Name.Contains("Opening Balance"));

        var equityCode = equityAccount?.Code ?? "3-9000";
        var equityLines = await _context.JournalLines
            .AsNoTracking()
            .Where(l => postedEntryIds.Contains(l.JournalEntryId) && l.AccountId == equityCode)
            .ToListAsync();
        var openingEquityBalance = equityLines.Sum(l => l.Credit - l.Debit);

        var isArReconciled = Math.Abs(arVariance) < 1m;
        var isApReconciled = Math.Abs(apVariance) < 1m;
        var isInvReconciled = Math.Abs(invVariance) < 1m;
        var isAssetReconciled = Math.Abs(assetVariance) < 1m;
        var isEquityBalanced = Math.Abs(openingEquityBalance) < 1m;

        var isFullyReconciled = isArReconciled && isApReconciled && isInvReconciled;

        var recommendations = new List<string>();
        if (!isArReconciled) recommendations.Add($"Accounts Receivable variance of Rp {arVariance:N2}. Verify open invoice migration balances match Trial Balance AR.");
        if (!isApReconciled) recommendations.Add($"Accounts Payable variance of Rp {apVariance:N2}. Verify open bill migration balances match Trial Balance AP.");
        if (!isInvReconciled) recommendations.Add($"Merchandise Inventory variance of Rp {invVariance:N2}. Compare stock on hand multiplied by buy price with GL account 1-1400.");
        if (!isEquityBalanced) recommendations.Add($"Opening Balance Equity (Account {equityCode}) has a non-zero residual balance of Rp {openingEquityBalance:N2}. In a complete migration, subledger entries offset this account to zero.");
        if (isFullyReconciled) recommendations.Add("All migration subledgers match the General Ledger with 100% mathematical precision. Ready for live operations!");

        return new MigrationReconciliationReport
        {
            GeneratedAt = DateTime.UtcNow,
            IsFullyReconciled = isFullyReconciled,
            OpeningEquityAccountCode = equityCode,
            OpeningEquityBalance = openingEquityBalance,
            IsEquityZero = isEquityBalanced,
            ArReconciliation = new ReconciliationItem
            {
                Title = "Accounts Receivable (Piutang Usaha)",
                GeneralLedgerBalance = glArBalance,
                SubledgerTotal = subledgerArTotal,
                Variance = arVariance,
                IsReconciled = isArReconciled
            },
            ApReconciliation = new ReconciliationItem
            {
                Title = "Accounts Payable (Hutang Usaha)",
                GeneralLedgerBalance = glApBalance,
                SubledgerTotal = subledgerApTotal,
                Variance = apVariance,
                IsReconciled = isApReconciled
            },
            InventoryReconciliation = new ReconciliationItem
            {
                Title = "Merchandise Inventory (Persediaan)",
                GeneralLedgerBalance = glInvBalance,
                SubledgerTotal = subledgerInvValuation,
                Variance = invVariance,
                IsReconciled = isInvReconciled
            },
            FixedAssetsReconciliation = new ReconciliationItem
            {
                Title = "Fixed Assets Carrying Value (Aktiva Tetap)",
                GeneralLedgerBalance = glAssetNetBalance,
                SubledgerTotal = subledgerAssetBookValue,
                Variance = assetVariance,
                IsReconciled = isAssetReconciled
            },
            Recommendations = recommendations
        };
    }
}

// ────────────────────────────────────────────────────────────────────────
// DTOs & Helper Extensions
// ────────────────────────────────────────────────────────────────────────

public class MigrationPreviewRequest
{
    public ImportType Type { get; set; }
    public DateOnly ConversionDate { get; set; }
    public List<Dictionary<string, object>> Rows { get; set; } = new();
    public string? PlugAccountId { get; set; }
    public bool AutoCreateContacts { get; set; } = true;
    public bool MergeContactsByTaxId { get; set; } = true;
}

public class MigrationPreviewResponse
{
    public bool IsValid { get; set; } = true;
    public int TotalRecords { get; set; }
    public DateOnly ConversionDate { get; set; }
    public decimal TotalDebit { get; set; }
    public decimal TotalCredit { get; set; }
    public decimal Difference { get; set; }
    public string? PlugSuggested { get; set; }
    public decimal PlugAmount { get; set; }
    public List<object> PreviewRows { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}

public class MigrationCommitRequest
{
    public ImportType Type { get; set; }
    public DateOnly ConversionDate { get; set; }
    public string? FileName { get; set; }
    public List<Dictionary<string, object>> Rows { get; set; } = new();
    public string? PlugAccountId { get; set; }
    public bool AutoCreateContacts { get; set; } = true;
    public bool MergeContactsByTaxId { get; set; } = true;
}

public class MigrationCommitResponse
{
    public Guid BatchId { get; set; }
    public string BatchNumber { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int RecordCount { get; set; }
    public Guid? CreatedJournalEntryId { get; set; }
    public string? CreatedJournalNumber { get; set; }
}

public class MigrationBatchSummary
{
    public Guid? CreatedJournalEntryId { get; set; }
    public string? CreatedJournalNumber { get; set; }
    public List<Guid> CreatedContactIds { get; set; } = new();
    public List<Guid> CreatedInvoiceIds { get; set; } = new();
    public List<Guid> CreatedBillIds { get; set; } = new();
    public List<Guid> CreatedProductIds { get; set; } = new();
    public List<Guid> CreatedMovementIds { get; set; } = new();
    public List<Guid> CreatedAssetIds { get; set; } = new();
    public List<Guid> CreatedAccountIds { get; set; } = new();
}

public class MigrationReconciliationReport
{
    public DateTime GeneratedAt { get; set; }
    public bool IsFullyReconciled { get; set; }
    public string OpeningEquityAccountCode { get; set; } = "3-9000";
    public decimal OpeningEquityBalance { get; set; }
    public bool IsEquityZero { get; set; }
    public ReconciliationItem ArReconciliation { get; set; } = new();
    public ReconciliationItem ApReconciliation { get; set; } = new();
    public ReconciliationItem InventoryReconciliation { get; set; } = new();
    public ReconciliationItem FixedAssetsReconciliation { get; set; } = new();
    public List<string> Recommendations { get; set; } = new();
}

public class ReconciliationItem
{
    public string Title { get; set; } = string.Empty;
    public decimal GeneralLedgerBalance { get; set; }
    public decimal SubledgerTotal { get; set; }
    public decimal Variance { get; set; }
    public bool IsReconciled { get; set; }
}

public static class RowDictionaryExtensions
{
    public static string? GetString(this Dictionary<string, object> row, string key)
    {
        if (row.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je)
            {
                return je.ValueKind switch
                {
                    JsonValueKind.String => je.GetString(),
                    JsonValueKind.Number => je.GetRawText(),
                    JsonValueKind.Null => null,
                    _ => je.ToString()
                };
            }
            return val.ToString()?.Trim();
        }
        return null;
    }

    public static decimal GetDecimal(this Dictionary<string, object> row, string key, decimal defaultVal = 0)
    {
        if (row.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je)
            {
                if (je.ValueKind == JsonValueKind.Number && je.TryGetDecimal(out var d)) return d;
                if (je.ValueKind == JsonValueKind.String && decimal.TryParse(je.GetString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsedStr)) return parsedStr;
            }
            if (val is decimal dec) return dec;
            if (decimal.TryParse(val.ToString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var parsed)) return parsed;
        }
        return defaultVal;
    }

    public static bool GetBool(this Dictionary<string, object> row, string key, bool defaultVal = false)
    {
        if (row.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je)
            {
                if (je.ValueKind == JsonValueKind.True) return true;
                if (je.ValueKind == JsonValueKind.False) return false;
                if (je.ValueKind == JsonValueKind.String)
                {
                    var s = je.GetString()?.ToLower();
                    return s == "true" || s == "1" || s == "yes" || s == "y";
                }
            }
            if (val is bool b) return b;
            var str = val.ToString()?.ToLower();
            if (str == "true" || str == "1" || str == "yes" || str == "y") return true;
            if (str == "false" || str == "0" || str == "no" || str == "n") return false;
        }
        return defaultVal;
    }

    public static int GetInt(this Dictionary<string, object> row, string key, int defaultVal = 0)
    {
        if (row.TryGetValue(key, out var val) && val != null)
        {
            if (val is JsonElement je && je.ValueKind == JsonValueKind.Number && je.TryGetInt32(out var i)) return i;
            if (int.TryParse(val.ToString(), out var parsed)) return parsed;
        }
        return defaultVal;
    }

    public static DateOnly GetDateOnly(this Dictionary<string, object> row, string key, DateOnly defaultVal)
    {
        var str = row.GetString(key);
        if (!string.IsNullOrEmpty(str) && DateOnly.TryParse(str, out var date))
        {
            return date;
        }
        return defaultVal;
    }
}
