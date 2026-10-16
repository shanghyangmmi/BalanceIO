namespace BalanceIO.API.DTOs;

/// <summary>
/// Comprehensive DTO models for Indonesian Statutory Tax Reporting & DJP Online Exports:
/// - SPT Masa PPN 1111 (Induk, Form AB, Form A1/A2, Form B1/B2/B3)
/// - PPh 21 TER, PPh 23, PPh 4(2) Final, PPh 22 Withholding Tax Summaries
/// - e-Faktur CSV Format
/// - e-Bupot Unifikasi CSV / XML Format
/// - Monthly PPN Settlement Journal Action
/// </summary>

public class SptPpn1111Response
{
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string? CompanyNpwp { get; set; }
    public bool IsPkp { get; set; } = true;
    public string Period { get; set; } = string.Empty; // "2026-08"
    public string PeriodLabel { get; set; } = string.Empty; // "Agustus 2026"
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // ── I. Induk SPT Masa PPN 1111 ──
    public decimal TotalPenyerahanDpp { get; set; }
    public decimal TotalPpnKeluaran { get; set; }
    public decimal TotalPpnMasukanDapatDikreditkan { get; set; }
    public decimal TotalPpnMasukanTidakDapatDikreditkan { get; set; }
    public decimal KompensasiKelebihanBulanLalu { get; set; }
    public decimal PpnKurangBayar { get; set; } // > 0
    public decimal PpnLebihBayar { get; set; }  // > 0
    public string TaxStatusLabel => PpnKurangBayar > 0 ? "Kurang Bayar" : (PpnLebihBayar > 0 ? "Lebih Bayar" : "Nihil");

    // ── II. Form 1111 AB (Rekapitulasi) ──
    public decimal DppPenyerahanDalamNegeriFaktur { get; set; }
    public decimal PpnPenyerahanDalamNegeriFaktur { get; set; }
    public decimal DppPenyerahanEkspor { get; set; }
    public decimal DppPenyerahanTidakTerutangPpn { get; set; }
    public decimal DppPerolehanBkpJkpDalamNegeri { get; set; }
    public decimal PpnPerolehanBkpJkpDalamNegeri { get; set; }
    public decimal DppImporBkp { get; set; }
    public decimal PpnImporBkp { get; set; }

    // ── III. Form 1111 A2: Daftar Pajak Keluaran (Faktur Keluaran) ──
    public List<SptPpn1111LineDto> FormA2Lines { get; set; } = new();

    // ── IV. Form 1111 B2: Daftar Pajak Masukan Dapat Dikreditkan ──
    public List<SptPpn1111LineDto> FormB2Lines { get; set; } = new();

    // ── V. Form 1111 B3: Daftar Pajak Masukan Tidak Dapat Dikreditkan ──
    public List<SptPpn1111LineDto> FormB3Lines { get; set; } = new();

    // Verification & Gap Metrics
    public int TotalFakturKeluaranCount { get; set; }
    public int TotalFakturMasukanCount { get; set; }
    public int MissingNpwpCounterpartiesCount { get; set; }
    public int MissingNsfpCount { get; set; }
    public bool IsSettlementJournalPosted { get; set; }
    public Guid? SettlementJournalEntryId { get; set; }
}

public class SptPpn1111LineDto
{
    public Guid DocumentId { get; set; }
    public string DocumentNumber { get; set; } = string.Empty;
    public DateOnly DocumentDate { get; set; }
    public string CounterpartyName { get; set; } = string.Empty;
    public string? CounterpartyNpwp { get; set; }
    public string? CounterpartyNik { get; set; }
    public string? FakturPajakNumber { get; set; } // NSFP
    public decimal DppAmount { get; set; }
    public decimal TaxRate { get; set; }
    public decimal PpnAmount { get; set; }
    public decimal PPnBMAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public bool IsCreditable { get; set; } = true;
    public string Currency { get; set; } = "IDR";
    public decimal ExchangeRate { get; set; } = 1;
}

public class WithholdingSummaryResponse
{
    public Guid CompanyId { get; set; }
    public string Period { get; set; } = string.Empty; // "2026-08"
    public string PeriodLabel { get; set; } = string.Empty;
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

    // Totals by Tax Category
    public decimal TotalPph21Withheld { get; set; }
    public decimal TotalPph23Withheld { get; set; }
    public decimal TotalPph42Withheld { get; set; }
    public decimal TotalPph22Withheld { get; set; }
    public decimal GrandTotalWithheld => TotalPph21Withheld + TotalPph23Withheld + TotalPph42Withheld + TotalPph22Withheld;

    public List<WithholdingTaxLineDto> Pph21Lines { get; set; } = new();
    public List<WithholdingTaxLineDto> Pph23Lines { get; set; } = new();
    public List<WithholdingTaxLineDto> Pph42Lines { get; set; } = new();
    public List<WithholdingTaxLineDto> Pph22Lines { get; set; } = new();
}

public class WithholdingTaxLineDto
{
    public Guid Id { get; set; }
    public string TaxType { get; set; } = "PPh 23"; // PPh 21, PPh 23, PPh 4(2), PPh 22
    public string KodeObjekPajak { get; set; } = string.Empty; // e.g. "24-104-01"
    public string CounterpartyName { get; set; } = string.Empty;
    public string? CounterpartyNpwp { get; set; }
    public string? CounterpartyNik { get; set; }
    public string? PtkpStatus { get; set; } // TK/0, K/1, etc.
    public string? TerCategory { get; set; } // TER A, TER B, TER C
    public string? ReferenceDocument { get; set; }
    public DateOnly TransactionDate { get; set; }
    public decimal GrossDppAmount { get; set; }
    public decimal EffectiveTaxRate { get; set; }
    public decimal TaxWithheldAmount { get; set; }
    public bool HasWithholdingExemption { get; set; }
    public string? BuktiPotongNumber { get; set; }
}

public class EFakturCsvExportResponse
{
    /// <summary>
    /// Rows exported with no Nomor Seri Faktur Pajak.
    ///
    /// Not a formatting problem. DJP allocates NSFP to the PKP, so a blank
    /// one means the faktur has not been issued yet - and this file cannot
    /// be uploaded until it has.
    /// </summary>
    public int MissingNsfpCount { get; set; }

    /// <summary>False while any row is missing its serial.</summary>
    public bool IsReadyToUpload { get; set; }

    public string Period { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string CsvContent { get; set; } = string.Empty;
    public int InvoiceCount { get; set; }
    public decimal TotalDpp { get; set; }
    public decimal TotalPpn { get; set; }
    public int MissingNpwpWarningCount { get; set; }
}

public class EBupotExportResponse
{
    public string Period { get; set; } = string.Empty;
    public string TaxType { get; set; } = "Unifikasi";
    public string FileName { get; set; } = string.Empty;
    public string ExportContent { get; set; } = string.Empty; // CSV or XML
    public string ContentType { get; set; } = "text/csv";
    public int RecordCount { get; set; }
    public decimal TotalDpp { get; set; }
    public decimal TotalTaxWithheld { get; set; }
}

public class PpnSettlementPostRequest
{
    public int Year { get; set; }
    public int Month { get; set; }
    public DateOnly SettlementDate { get; set; }
    public string? Notes { get; set; }
}

public class PpnSettlementResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public Guid? JournalEntryId { get; set; }
    public decimal TotalPpnKeluaran { get; set; }
    public decimal TotalPpnMasukan { get; set; }
    public decimal NetSettlementAmount { get; set; }
    public string SettlementAccountCode { get; set; } = string.Empty;
}
