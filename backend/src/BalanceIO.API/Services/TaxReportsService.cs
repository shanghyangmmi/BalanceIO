using System.Globalization;
using System.Text;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Indonesian Statutory Tax Reports & DJP Online Export Service:
/// - SPT Masa PPN 1111 (Induk, Form AB, Form A1/A2, Form B1/B2/B3)
/// - Potput Withholding Taxes (PPh 21 TER, PPh 23, PPh 4(2), PPh 22)
/// - DJP e-Faktur CSV Format (PER-03/PJ/2022)
/// - DJP e-Bupot Unifikasi CSV / XML Format
/// - Monthly PPN Clearing & Settlement Journal Entry Poster
/// </summary>
public class TaxReportsService
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;
    private readonly PayrollService _payroll;

    public TaxReportsService(ApplicationDbContext context, IPeriodLockService periodLockService, PayrollService payroll)
    {
        _context = context;
        _periodLockService = periodLockService;
        _payroll = payroll;
    }

    private static readonly CultureInfo IdCulture = new("id-ID");

    /// <summary>
    /// Generates full SPT Masa PPN 1111 with Induk, Form AB, A2, and B2/B3 drill-downs
    /// </summary>
    public async Task<SptPpn1111Response> GetSptPpn1111Async(Guid companyId, int year, int month)
    {
        var company = await _context.Companies.FindAsync(companyId);
        var companyName = company?.Name ?? "Perusahaan";
        var companyNpwp = company?.TaxId;
        var isPkp = company?.IsPkp ?? true;

        var startDate = new DateOnly(year, month, 1);
        var endDate = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        var monthLabel = new DateTime(year, month, 1).ToString("MMMM yyyy", IdCulture);

        // 1. Fetch Sales Invoices (Faktur Pajak Keluaran)
        var salesInvoices = await _context.SalesInvoices
            .AsNoTracking()
            .Include(i => i.Contact)
            .Include(i => i.Lines)
            .Where(i => i.CompanyId == companyId
                     && i.Status != InvoiceStatus.Draft
                     && i.Status != InvoiceStatus.Void
                     && i.InvoiceDate >= startDate
                     && i.InvoiceDate <= endDate)
            .OrderBy(i => i.InvoiceDate)
            .ThenBy(i => i.InvoiceNumber)
            .ToListAsync();

        var formA2Lines = new List<SptPpn1111LineDto>();
        decimal totalPenyerahanDpp = 0;
        decimal totalPpnKeluaran = 0;
        decimal totalExportDpp = 0;
        decimal totalNonTaxableDpp = 0;
        int missingNpwpCount = 0;
        int missingNsfpCount = 0;

        foreach (var inv in salesInvoices)
        {
            var invDpp = inv.Lines.Sum(l => l.DppAmount > 0 ? l.DppAmount : (l.Quantity * l.UnitPrice - l.DiscountAmount));
            var invPpn = inv.Lines.Sum(l => l.TaxAmount);
            var invPpnbm = inv.Lines.Sum(l => l.PPnBMAmount);
            var effectiveRate = inv.Lines.FirstOrDefault(l => l.TaxRate > 0)?.TaxRate ?? (invPpn > 0 ? 12m : 0m);

            if (string.IsNullOrEmpty(inv.Contact?.TaxId)) missingNpwpCount++;
            if (string.IsNullOrEmpty(inv.ReferenceNumber) && invPpn > 0) missingNsfpCount++;

            totalPenyerahanDpp += invDpp;
            totalPpnKeluaran += invPpn;

            formA2Lines.Add(new SptPpn1111LineDto
            {
                DocumentId = inv.Id,
                DocumentNumber = inv.InvoiceNumber,
                DocumentDate = inv.InvoiceDate,
                CounterpartyName = inv.Contact?.Name ?? "Pelanggan Umum",
                CounterpartyNpwp = inv.Contact?.TaxId,
                CounterpartyNik = inv.Contact?.Nik,
                FakturPajakNumber = inv.ReferenceNumber,
                DppAmount = invDpp,
                TaxRate = effectiveRate,
                PpnAmount = invPpn,
                PPnBMAmount = invPpnbm,
                TotalAmount = inv.Total,
                IsCreditable = true,
                Currency = inv.Currency,
                ExchangeRate = inv.ExchangeRate
            });
        }

        // 2. Fetch Purchase Bills (Faktur Pajak Masukan)
        var purchaseBills = await _context.PurchaseBills
            .AsNoTracking()
            .Include(b => b.Contact)
            .Include(b => b.Lines)
            .Where(b => b.CompanyId == companyId
                     && b.Status != BillStatus.Draft
                     && b.Status != BillStatus.Void
                     && b.BillDate >= startDate
                     && b.BillDate <= endDate)
            .OrderBy(b => b.BillDate)
            .ThenBy(b => b.BillNumber)
            .ToListAsync();

        var formB2Lines = new List<SptPpn1111LineDto>();
        var formB3Lines = new List<SptPpn1111LineDto>();
        decimal totalPpnMasukanCreditable = 0;
        decimal totalPpnMasukanNonCreditable = 0;
        decimal totalPerolehanDpp = 0;

        foreach (var bill in purchaseBills)
        {
            var billDpp = bill.Lines.Sum(l => l.DppAmount > 0 ? l.DppAmount : (l.Quantity * l.UnitPrice - l.DiscountAmount));
            var billPpn = bill.Lines.Sum(l => l.TaxAmount);
            var billPpnbm = bill.Lines.Sum(l => l.PPnBMAmount);
            var effectiveRate = bill.Lines.FirstOrDefault(l => l.TaxRate > 0)?.TaxRate ?? (billPpn > 0 ? 12m : 0m);

            totalPerolehanDpp += billDpp;

            var isCreditable = bill.TaxAmount > 0; // Creditable if carries tax

            var line = new SptPpn1111LineDto
            {
                DocumentId = bill.Id,
                DocumentNumber = bill.BillNumber,
                DocumentDate = bill.BillDate,
                CounterpartyName = bill.Contact?.Name ?? "Supplier",
                CounterpartyNpwp = bill.Contact?.TaxId,
                CounterpartyNik = bill.Contact?.Nik,
                FakturPajakNumber = bill.VendorInvoiceNumber,
                DppAmount = billDpp,
                TaxRate = effectiveRate,
                PpnAmount = billPpn,
                PPnBMAmount = billPpnbm,
                TotalAmount = bill.Total,
                IsCreditable = isCreditable,
                Currency = bill.Currency,
                ExchangeRate = bill.ExchangeRate
            };

            if (isCreditable)
            {
                totalPpnMasukanCreditable += billPpn;
                formB2Lines.Add(line);
            }
            else
            {
                totalPpnMasukanNonCreditable += billPpn;
                formB3Lines.Add(line);
            }
        }

        // 3. Compute Net SPT Tax
        var netDifference = totalPpnKeluaran - totalPpnMasukanCreditable;
        var ppnKurangBayar = netDifference > 0 ? netDifference : 0m;
        var ppnLebihBayar = netDifference < 0 ? Math.Abs(netDifference) : 0m;

        // Check if settlement journal exists for this period
        var settlementRef = $"PPN-CLEAR-{year}{month:D2}";
        var settlementEntry = await _context.JournalEntries
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.CompanyId == companyId && j.ReferenceNumber == settlementRef);

        return new SptPpn1111Response
        {
            CompanyId = companyId,
            CompanyName = companyName,
            CompanyNpwp = companyNpwp,
            IsPkp = isPkp,
            Period = $"{year}-{month:D2}",
            PeriodLabel = monthLabel,
            GeneratedAt = DateTime.UtcNow,

            // Induk
            TotalPenyerahanDpp = totalPenyerahanDpp,
            TotalPpnKeluaran = totalPpnKeluaran,
            TotalPpnMasukanDapatDikreditkan = totalPpnMasukanCreditable,
            TotalPpnMasukanTidakDapatDikreditkan = totalPpnMasukanNonCreditable,
            KompensasiKelebihanBulanLalu = 0,
            PpnKurangBayar = ppnKurangBayar,
            PpnLebihBayar = ppnLebihBayar,

            // Form AB
            DppPenyerahanDalamNegeriFaktur = totalPenyerahanDpp,
            PpnPenyerahanDalamNegeriFaktur = totalPpnKeluaran,
            DppPenyerahanEkspor = totalExportDpp,
            DppPenyerahanTidakTerutangPpn = totalNonTaxableDpp,
            DppPerolehanBkpJkpDalamNegeri = totalPerolehanDpp,
            PpnPerolehanBkpJkpDalamNegeri = totalPpnMasukanCreditable,

            // Details
            FormA2Lines = formA2Lines,
            FormB2Lines = formB2Lines,
            FormB3Lines = formB3Lines,

            TotalFakturKeluaranCount = formA2Lines.Count,
            TotalFakturMasukanCount = formB2Lines.Count + formB3Lines.Count,
            MissingNpwpCounterpartiesCount = missingNpwpCount,
            MissingNsfpCount = missingNsfpCount,
            IsSettlementJournalPosted = settlementEntry != null,
            SettlementJournalEntryId = settlementEntry?.Id
        };
    }

    /// <summary>
    /// Aggregates withholding tax summaries (PPh 21 TER, PPh 23, PPh 4(2) Final, PPh 22)
    /// </summary>
    public async Task<WithholdingSummaryResponse> GetWithholdingSummaryAsync(Guid companyId, int year, int month, string? taxType = null)
    {
        var startDate = new DateOnly(year, month, 1);
        var endDate = new DateOnly(year, month, DateTime.DaysInMonth(year, month));
        var monthLabel = new DateTime(year, month, 1).ToString("MMMM yyyy", IdCulture);

        var pph21Lines = new List<WithholdingTaxLineDto>();
        var pph23Lines = new List<WithholdingTaxLineDto>();
        var pph42Lines = new List<WithholdingTaxLineDto>();
        var pph22Lines = new List<WithholdingTaxLineDto>();

        // 1. Fetch Purchase Bills and Contacts with Withholding configurations
        var bills = await _context.PurchaseBills
            .AsNoTracking()
            .Include(b => b.Contact)
            .Include(b => b.Lines)
            .Where(b => b.CompanyId == companyId
                     && b.Status != BillStatus.Draft
                     && b.Status != BillStatus.Void
                     && b.BillDate >= startDate
                     && b.BillDate <= endDate)
            .ToListAsync();

        foreach (var bill in bills)
        {
            var contact = bill.Contact;
            var withholdingType = contact?.WithholdingType?.ToUpperInvariant();
            var rate = contact?.WithholdingRate ?? 0m;

            // Compute DPP
            var dpp = bill.Subtotal > 0 ? bill.Subtotal : bill.Lines.Sum(l => l.Quantity * l.UnitPrice - l.DiscountAmount);

            if (withholdingType == "PPH23" || withholdingType == "PPH 23")
            {
                var effectiveRate = rate > 0 ? rate : 2m; // Default 2% on Jasa/Sewa
                var taxWithheld = Math.Round(dpp * (effectiveRate / 100m), 2);
                pph23Lines.Add(new WithholdingTaxLineDto
                {
                    Id = bill.Id,
                    TaxType = "PPh 23",
                    KodeObjekPajak = "24-104-01", // Jasa Lainnya
                    CounterpartyName = contact?.Name ?? "Vendor",
                    CounterpartyNpwp = contact?.TaxId,
                    CounterpartyNik = contact?.Nik,
                    ReferenceDocument = bill.BillNumber,
                    TransactionDate = bill.BillDate,
                    GrossDppAmount = dpp,
                    EffectiveTaxRate = effectiveRate,
                    TaxWithheldAmount = taxWithheld,
                    HasWithholdingExemption = contact?.HasWithholdingExemption ?? false
                });
            }
            else if (withholdingType == "PPH4(2)" || withholdingType == "PPH42" || withholdingType == "PPH 4(2)")
            {
                var effectiveRate = rate > 0 ? rate : 10m; // Default 10% on Sewa Gedung
                var taxWithheld = Math.Round(dpp * (effectiveRate / 100m), 2);
                pph42Lines.Add(new WithholdingTaxLineDto
                {
                    Id = bill.Id,
                    TaxType = "PPh 4(2)",
                    KodeObjekPajak = "28-403-02", // Sewa Tanah dan/atau Bangunan
                    CounterpartyName = contact?.Name ?? "Vendor",
                    CounterpartyNpwp = contact?.TaxId,
                    CounterpartyNik = contact?.Nik,
                    ReferenceDocument = bill.BillNumber,
                    TransactionDate = bill.BillDate,
                    GrossDppAmount = dpp,
                    EffectiveTaxRate = effectiveRate,
                    TaxWithheldAmount = taxWithheld,
                    HasWithholdingExemption = contact?.HasWithholdingExemption ?? false
                });
            }
            else if (withholdingType == "PPH22" || withholdingType == "PPH 22")
            {
                var effectiveRate = rate > 0 ? rate : 1.5m; // Default 1.5%
                var taxWithheld = Math.Round(dpp * (effectiveRate / 100m), 2);
                pph22Lines.Add(new WithholdingTaxLineDto
                {
                    Id = bill.Id,
                    TaxType = "PPh 22",
                    KodeObjekPajak = "22-100-01",
                    CounterpartyName = contact?.Name ?? "Vendor",
                    CounterpartyNpwp = contact?.TaxId,
                    CounterpartyNik = contact?.Nik,
                    ReferenceDocument = bill.BillNumber,
                    TransactionDate = bill.BillDate,
                    GrossDppAmount = dpp,
                    EffectiveTaxRate = effectiveRate,
                    TaxWithheldAmount = taxWithheld,
                    HasWithholdingExemption = contact?.HasWithholdingExemption ?? false
                });
            }
        }

        // PPh 21 comes from posted payroll runs and nothing else. It once
        // emitted a line per employee contact on an invented salary, which
        // put fabricated withholding into a report destined for e-Bupot.
        pph21Lines.AddRange(await _payroll.Pph21LinesAsync(companyId, year, month));

        return new WithholdingSummaryResponse
        {
            CompanyId = companyId,
            Period = $"{year}-{month:D2}",
            PeriodLabel = monthLabel,
            GeneratedAt = DateTime.UtcNow,
            TotalPph21Withheld = pph21Lines.Sum(l => l.TaxWithheldAmount),
            TotalPph23Withheld = pph23Lines.Sum(l => l.TaxWithheldAmount),
            TotalPph42Withheld = pph42Lines.Sum(l => l.TaxWithheldAmount),
            TotalPph22Withheld = pph22Lines.Sum(l => l.TaxWithheldAmount),
            Pph21Lines = pph21Lines,
            Pph23Lines = pph23Lines,
            Pph42Lines = pph42Lines,
            Pph22Lines = pph22Lines,
            Pph21Note = pph21Lines.Count == 0 ? $"No payroll run is posted for {monthLabel}." : null
        };
    }

    /// <summary>
    /// Generates official DJP e-Faktur CSV import file format (PER-03/PJ/2022)
    /// </summary>
    public async Task<EFakturCsvExportResponse> GenerateEFakturCsvAsync(Guid companyId, int year, int month)
    {
        var spt = await GetSptPpn1111Async(companyId, year, month);
        var sb = new StringBuilder();

        // 1. Header schema for DJP e-Faktur
        sb.AppendLine("FK,KD_JENIS_TRANSAKSI,FG_PENGGANTI,NOMOR_FAKTUR,MASA_PAJAK,TAHUN_PAJAK,TANGGAL_FAKTUR,NPWP,NAMA,ALAMAT_LENGKAP,JUMLAH_DPP,JUMLAH_PPN,JUMLAH_PPNBM,ID_KETERANGAN_TAMBAHAN,FG_UANG_MUKA,UANG_MUKA_DPP,UANG_MUKA_PPN,UANG_MUKA_PPNBM,REFERENSI,KODE_DOKUMEN_PENDUKUNG");
        sb.AppendLine("LT,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM");
        sb.AppendLine("OF,KODE_OBJEK,NAMA,HARGA_SATUAN,JUMLAH_BARANG,HARGA_TOTAL,DISKON,DPP,PPN,TARIF_PPNBM,PPNBM");

        var count = 0;
        decimal totalDpp = 0;
        decimal totalPpn = 0;
        int missingNpwpWarnings = 0;
        int missingNsfpWarnings = 0;

        foreach (var inv in spt.FormA2Lines)
        {
            count++;
            totalDpp += inv.DppAmount;
            totalPpn += inv.PpnAmount;

            var npwpFormatted = (inv.CounterpartyNpwp ?? "0000000000000000").Replace(".", "").Replace("-", "");
            if (npwpFormatted == "0000000000000000") missingNpwpWarnings++;

            // A missing serial is left missing.
            //
            // This used to fall back to "010000{year}{sequence}", inventing a
            // Nomor Seri Faktur Pajak and writing it into a file destined for
            // e-Faktur. NSFP are allocated to the PKP by DJP; a number nobody
            // was granted is not a formatting default, it is a fabricated tax
            // document identity - and issuing faktur pajak is not this
            // product's role.
            //
            // The row still goes into the file so the figures reconcile, with
            // the number blank and counted, so the gap is visible before the
            // file is uploaded rather than after DJP rejects it.
            var nsfpFormatted = (inv.FakturPajakNumber ?? string.Empty)
                .Replace(".", string.Empty)
                .Replace("-", string.Empty);

            if (string.IsNullOrEmpty(nsfpFormatted)) missingNsfpWarnings++;
            var cleanName = inv.CounterpartyName.Replace(",", " ");

            // FK Header Row
            sb.AppendLine($"FK,01,0,{nsfpFormatted},{month},{year},{inv.DocumentDate:dd/MM/yyyy},{npwpFormatted},{cleanName},Indonesia,{inv.DppAmount:F0},{inv.PpnAmount:F0},{inv.PPnBMAmount:F0},,,,0,0,0,{inv.DocumentNumber},");

            // OF Line Item
            sb.AppendLine($"OF,BKP,{cleanName} Items,{inv.DppAmount:F0},1,{inv.DppAmount:F0},0,{inv.DppAmount:F0},{inv.PpnAmount:F0},0,{inv.PPnBMAmount:F0}");
        }

        return new EFakturCsvExportResponse
        {
            Period = $"{year}-{month:D2}",
            FileName = $"eFaktur_Keluaran_{year}{month:D2}.csv",
            CsvContent = sb.ToString(),
            InvoiceCount = count,
            TotalDpp = totalDpp,
            TotalPpn = totalPpn,
            MissingNpwpWarningCount = missingNpwpWarnings,
            MissingNsfpCount = missingNsfpWarnings,
            IsReadyToUpload = missingNsfpWarnings == 0,
        };
    }

    /// <summary>
    /// Generates DJP e-Bupot Unifikasi CSV / XML export format
    /// </summary>
    public async Task<EBupotExportResponse> GenerateEBupotExportAsync(Guid companyId, int year, int month, string taxType)
    {
        var summary = await GetWithholdingSummaryAsync(companyId, year, month, taxType);
        var sb = new StringBuilder();

        sb.AppendLine("ID_BUKTI_POTONG,TANGGAL_BUKTI_POTONG,JENIS_PAJAK,KODE_OBJEK_PAJAK,NPWP_PENERIMA,NIK_PENERIMA,NAMA_PENERIMA,DASAR_PENGENAAN_PAJAK,TARIF_PAJAK,PAJAK_DIPOTONG,NO_DOKUMEN_DASAR,SKB_STATUS");

        var targetList = taxType.ToLowerInvariant() switch
        {
            "pph21" => summary.Pph21Lines,
            "pph23" => summary.Pph23Lines,
            "pph42" or "pph4(2)" => summary.Pph42Lines,
            "pph22" => summary.Pph22Lines,
            _ => summary.Pph23Lines.Concat(summary.Pph42Lines).Concat(summary.Pph22Lines).Concat(summary.Pph21Lines).ToList()
        };

        foreach (var item in targetList)
        {
            var npwp = (item.CounterpartyNpwp ?? "").Replace(".", "").Replace("-", "");
            var nik = (item.CounterpartyNik ?? "").Replace(".", "").Replace("-", "");
            var cleanName = item.CounterpartyName.Replace(",", " ");

            sb.AppendLine($"{item.BuktiPotongNumber},{item.TransactionDate:dd/MM/yyyy},{item.TaxType},{item.KodeObjekPajak},{npwp},{nik},{cleanName},{item.GrossDppAmount:F0},{item.EffectiveTaxRate:F2},{item.TaxWithheldAmount:F0},{item.ReferenceDocument},{(item.HasWithholdingExemption ? "SKB" : "N")}");
        }

        return new EBupotExportResponse
        {
            Period = $"{year}-{month:D2}",
            TaxType = taxType,
            FileName = $"eBupot_{taxType}_{year}{month:D2}.csv",
            ExportContent = sb.ToString(),
            ContentType = "text/csv",
            RecordCount = targetList.Count,
            TotalDpp = targetList.Sum(l => l.GrossDppAmount),
            TotalTaxWithheld = targetList.Sum(l => l.TaxWithheldAmount)
        };
    }

    /// <summary>
    /// Posts the monthly PPN settlement journal entry (Closing PPN Keluaran & PPN Masukan)
    /// </summary>
    public async Task<PpnSettlementResult> PostPpnSettlementJournalAsync(Guid companyId, PpnSettlementPostRequest request, string? userEmail = null)
    {
        await _periodLockService.ValidateTransactionDate(companyId, request.SettlementDate);

        var spt = await GetSptPpn1111Async(companyId, request.Year, request.Month);
        if (spt.TotalPpnKeluaran == 0 && spt.TotalPpnMasukanDapatDikreditkan == 0)
        {
            return new PpnSettlementResult
            {
                Success = false,
                Message = "No PPN Keluaran or PPN Masukan activity recorded in this period."
            };
        }

        var entryNumber = $"JE-PPN-{request.Year}{request.Month:D2}";
        var refNumber = $"PPN-CLEAR-{request.Year}{request.Month:D2}";

        // Check if already posted
        var existing = await _context.JournalEntries
            .FirstOrDefaultAsync(j => j.CompanyId == companyId && j.ReferenceNumber == refNumber);

        if (existing != null)
        {
            return new PpnSettlementResult
            {
                Success = false,
                Message = $"PPN settlement journal for {request.Year}-{request.Month:D2} has already been posted ({existing.ReferenceNumber})."
            };
        }

        var ppnKeluaranAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "2-1300");
        // PPN Masukan is "VAT In" (1-1700) in the default chart, and is what purchase
        // bills debit. 1-1400 is Inventory: closing input VAT against it credited stock.
        var ppnMasukanAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "1-1700");
        var ppnKurangBayarAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "2-1400");
        var ppnLebihBayarAcc = await _context.Accounts.FirstOrDefaultAsync(a => a.CompanyId == companyId && a.Code == "1-1450");

        var netToSettle = spt.TotalPpnKeluaran - spt.TotalPpnMasukanDapatDikreditkan;
        var missing = new List<string>();
        if (spt.TotalPpnKeluaran > 0 && ppnKeluaranAcc is null) missing.Add("2-1300 (PPN Keluaran)");
        if (spt.TotalPpnMasukanDapatDikreditkan > 0 && ppnMasukanAcc is null) missing.Add("1-1700 (PPN Masukan)");
        if (netToSettle > 0 && ppnKurangBayarAcc is null) missing.Add("2-1400 (PPN Kurang Bayar)");
        if (netToSettle < 0 && ppnLebihBayarAcc is null) missing.Add("1-1450 (PPN Lebih Bayar)");
        if (missing.Count > 0)
        {
            return new PpnSettlementResult
            {
                Success = false,
                Message = $"The settlement cannot be posted: this company's chart of accounts has no {string.Join(", ", missing)}."
            };
        }

        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = request.SettlementDate,
            ReferenceNumber = refNumber,
            Currency = "IDR",
            Notes = request.Notes ?? $"SPT Masa PPN 1111 Settlement ({request.Year}-{request.Month:D2}) · by {userEmail ?? "tax@balanceio.id"}",
            Status = JournalEntryStatus.Posted,
            IsAdjustingEntry = true,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        // 1. Dr PPN Keluaran (2-1300) - Closes Output VAT
        if (spt.TotalPpnKeluaran > 0)
        {
            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = ppnKeluaranAcc!.Code,
                Debit = spt.TotalPpnKeluaran,
                Credit = 0,
                Description = $"Closing PPN Keluaran Masa {request.Month:D2}/{request.Year}"
            });
        }

        // 2. Cr PPN Masukan (1-1400) - Closes Input VAT
        if (spt.TotalPpnMasukanDapatDikreditkan > 0)
        {
            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = ppnMasukanAcc!.Code,
                Debit = 0,
                Credit = spt.TotalPpnMasukanDapatDikreditkan,
                Description = $"Closing PPN Masukan Masa {request.Month:D2}/{request.Year}"
            });
        }

        // 3. Balancing line: Kurang Bayar (Cr 2-1400) or Lebih Bayar (Dr 1-1450)
        var netDelta = spt.TotalPpnKeluaran - spt.TotalPpnMasukanDapatDikreditkan;
        string settlementAccCode = "";

        if (netDelta > 0)
        {
            // Kurang Bayar: Cr Hutang PPN (2-1400)
            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = ppnKurangBayarAcc!.Code,
                Debit = 0,
                Credit = netDelta,
                Description = $"PPN Kurang Bayar Masa {request.Month:D2}/{request.Year}"
            });
            settlementAccCode = "2-1400 (PPN Kurang Bayar)";
        }
        else if (netDelta < 0)
        {
            // Lebih Bayar: Dr Piutang PPN (1-1450)
            var overpayment = Math.Abs(netDelta);
            journalEntry.Lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = ppnLebihBayarAcc!.Code,
                Debit = overpayment,
                Credit = 0,
                Description = $"PPN Lebih Bayar Masa {request.Month:D2}/{request.Year}"
            });
            settlementAccCode = "1-1450 (PPN Lebih Bayar)";
        }

        _context.JournalEntries.Add(journalEntry);
        await _context.SaveChangesAsync();

        return new PpnSettlementResult
        {
            Success = true,
            Message = $"PPN Settlement Journal posted successfully for Masa {request.Month:D2}/{request.Year} ({refNumber}).",
            JournalEntryId = journalEntry.Id,
            TotalPpnKeluaran = spt.TotalPpnKeluaran,
            TotalPpnMasukan = spt.TotalPpnMasukanDapatDikreditkan,
            NetSettlementAmount = Math.Abs(netDelta),
            SettlementAccountCode = settlementAccCode
        };
    }
}
