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

    public MigrationController(
        ApplicationDbContext context,
        IPeriodLockService periodLockService,
        ILogger<MigrationController> logger)
    {
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
                    StockOnHand = qty,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Products.Add(product);
                existingProducts[code.ToLower()] = product;
                summary.CreatedProductIds.Add(product.Id);
            }
            else
            {
                product.StockOnHand += qty;
                product.BuyPrice = unitCost;
                product.UpdatedAt = DateTime.UtcNow;
            }

            if (qty > 0)
            {
                var movement = new InventoryMovement
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    ProductId = product.Id,
                    MovementDate = request.ConversionDate,
                    Type = InventoryMovementType.ManualAdjustment,
                    Quantity = qty,
                    UnitCost = unitCost,
                    TotalCost = qty * unitCost,
                    ReferenceNumber = $"OP-STOCK-{batch.BatchNumber}",
                    Notes = $"Migration Opening Inventory · Batch {batch.BatchNumber}",
                    CreatedAt = DateTime.UtcNow
                };
                _context.InventoryMovements.Add(movement);
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
