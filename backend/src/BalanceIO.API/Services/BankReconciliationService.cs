using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Bank Reconciliation Service:
/// - Statement import & parser (BCA KlikBCA, Mandiri MCM, BRI, BNI, Generic CSV)
/// - Indonesian number formatting ('1.234.567,89' & '1,234,567.89')
/// - MD5 de-duplication hash engine
/// - Bank-side sign inversion (Bank CR = Book Dr; Bank DB = Book Cr)
/// - Multi-pass automated matching (Exact, Timing ±3 days, Virtual Account extraction)
/// - 1-click GL adjustment poster for bank fees / interest
/// - Mathematical reconciliation equation generator
/// </summary>
public class BankReconciliationService
{
    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLockService;

    public BankReconciliationService(ApplicationDbContext context, IPeriodLockService periodLockService)
    {
        _context = context;
        _periodLockService = periodLockService;
    }

    /// <summary>
    /// Lists all Cash & Bank accounts with GL balances, latest statement balances, and unreconciled counts
    /// </summary>
    public async Task<List<BankAccountSummaryDto>> GetAccountsSummaryAsync(Guid companyId)
    {
        var accounts = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId
                     && (a.AccountGroup == "Cash & Cash Equivalents" || a.Code.StartsWith("1-11")))
            .OrderBy(a => a.Code)
            .ToListAsync();

        var result = new List<BankAccountSummaryDto>();

        foreach (var acc in accounts)
        {
            var accKey = acc.Id.ToString();
            var accCode = acc.Code;

            // Calculate GL Balance (Normal: Debit - Credit)
            var glLines = await _context.JournalLines
                .AsNoTracking()
                .Where(l => l.JournalEntry!.CompanyId == companyId
                         && l.JournalEntry.Status == JournalEntryStatus.Posted
                         && (l.AccountId == accCode || l.AccountId == accKey))
                .Select(l => new { l.Debit, l.Credit })
                .ToListAsync();

            var glBalance = glLines.Sum(l => l.Debit - l.Credit);

            // Fetch latest statement for this account
            var latestStatement = await _context.BankStatements
                .AsNoTracking()
                .Where(s => s.CompanyId == companyId && s.AccountId == acc.Id)
                .OrderByDescending(s => s.StatementDate)
                .FirstOrDefaultAsync();

            // Count unmatched statement lines
            var unmatchedStatementCount = await _context.BankStatementLines
                .AsNoTracking()
                .Where(l => l.BankStatement!.CompanyId == companyId 
                         && l.BankStatement.AccountId == acc.Id
                         && l.Status == StatementLineStatus.Unmatched)
                .CountAsync();

            // Count unreconciled GL lines
            var matchedJournalLineIds = await _context.BankStatementLines
                .AsNoTracking()
                .Where(l => l.BankStatement!.CompanyId == companyId
                         && l.BankStatement.AccountId == acc.Id
                         && l.MatchedJournalLineId != null)
                .Select(l => l.MatchedJournalLineId!.Value)
                .ToListAsync();

            var totalGlLinesCount = await _context.JournalLines
                .AsNoTracking()
                .Where(l => l.JournalEntry!.CompanyId == companyId
                         && l.JournalEntry.Status == JournalEntryStatus.Posted
                         && (l.AccountId == accCode || l.AccountId == accKey))
                .CountAsync();

            var unreconciledGlCount = Math.Max(0, totalGlLinesCount - matchedJournalLineIds.Count);

            result.Add(new BankAccountSummaryDto
            {
                AccountId = acc.Id,
                AccountCode = acc.Code,
                AccountName = acc.Name,
                AccountGroup = acc.AccountGroup,
                Currency = "IDR",
                GeneralLedgerBalance = glBalance,
                LatestStatementBalance = latestStatement?.ClosingBalance,
                LatestStatementDate = latestStatement?.StatementDate,
                UnmatchedStatementLinesCount = unmatchedStatementCount,
                UnreconciledLedgerLinesCount = unreconciledGlCount,
                IsReconciled = unmatchedStatementCount == 0 && unreconciledGlCount == 0 && latestStatement != null && Math.Abs(glBalance - latestStatement.ClosingBalance) < 0.01m
            });
        }

        return result;
    }

    /// <summary>
    /// Loads the interactive 2-pane reconciliation workspace for a specific bank account
    /// </summary>
    public async Task<BankReconciliationWorkspaceResponse> GetWorkspaceAsync(Guid companyId, Guid accountId, DateOnly? asOfDate = null)
    {
        var targetDate = asOfDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var account = await _context.Accounts.FindAsync(accountId);
        if (account == null || account.CompanyId != companyId)
        {
            throw new ArgumentException("Bank account not found.");
        }

        var accCode = account.Code;
        var accKey = account.Id.ToString();

        // 1. Fetch Bank Statement Lines
        var statementLines = await _context.BankStatementLines
            .AsNoTracking()
            .Include(l => l.BankStatement)
            .Where(l => l.BankStatement!.CompanyId == companyId
                     && l.BankStatement.AccountId == accountId
                     && l.TransactionDate <= targetDate)
            .OrderByDescending(l => l.TransactionDate)
            .ThenByDescending(l => l.CreatedAt)
            .ToListAsync();

        var latestStatement = await _context.BankStatements
            .AsNoTracking()
            .Where(s => s.CompanyId == companyId && s.AccountId == accountId && s.StatementDate <= targetDate)
            .OrderByDescending(s => s.StatementDate)
            .FirstOrDefaultAsync();

        var statementEndingBal = latestStatement?.ClosingBalance ?? 0m;

        // 2. Fetch General Ledger Lines for this Bank Account
        var glLines = await _context.JournalLines
            .AsNoTracking()
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && (l.AccountId == accCode || l.AccountId == accKey)
                     && l.JournalEntry.Date <= targetDate)
            .OrderByDescending(l => l.JournalEntry!.Date)
            .ThenByDescending(l => l.JournalEntry!.CreatedAt)
            .ToListAsync();

        var glEndingBal = glLines.Sum(l => l.Debit - l.Credit);

        // Map matched links
        var matchedGlMap = statementLines
            .Where(l => l.MatchedJournalLineId != null)
            .ToDictionary(l => l.MatchedJournalLineId!.Value, l => l.Id);

        var statementLineDtos = statementLines.Select(l => new BankStatementLineDto
        {
            Id = l.Id,
            BankStatementId = l.BankStatementId,
            TransactionDate = l.TransactionDate,
            ValueDate = l.ValueDate,
            Description = l.Description,
            ReferenceNumber = l.ReferenceNumber,
            Debit = l.Debit,
            Credit = l.Credit,
            Amount = l.Amount,
            RunningBalance = l.RunningBalance,
            Status = l.Status,
            MatchedJournalLineId = l.MatchedJournalLineId,
            MatchedDocumentType = l.MatchedDocumentType,
            MatchedDocumentId = l.MatchedDocumentId,
            MatchConfidence = l.MatchConfidence,
            BankFeeAmount = l.BankFeeAmount,
            CreatedJournalEntryId = l.CreatedJournalEntryId,
            ExtractedVirtualAccount = ExtractVirtualAccount(l.Description)
        }).ToList();

        var ledgerLineDtos = glLines.Select(l => new LedgerReconciliationLineDto
        {
            JournalLineId = l.Id,
            JournalEntryId = l.JournalEntryId,
            JournalNumber = l.JournalEntry?.ReferenceNumber ?? l.JournalEntryId.ToString()[..8],
            ReferenceNumber = l.JournalEntry?.ReferenceNumber,
            Date = l.JournalEntry!.Date,
            Description = l.Description ?? l.JournalEntry?.Notes ?? "Journal posting",
            Debit = l.Debit,
            Credit = l.Credit,
            IsReconciled = matchedGlMap.ContainsKey(l.Id),
            MatchedStatementLineId = matchedGlMap.GetValueOrDefault(l.Id),
            DocumentType = DetermineDocumentType(l.JournalEntry?.ReferenceNumber)
        }).ToList();

        // 3. Compute Formal Reconciliation Statement Equation
        // Deposits in Transit: In ledger (Dr > 0), not on bank statement
        var depositsInTransit = ledgerLineDtos
            .Where(l => !l.IsReconciled && l.Debit > 0)
            .Sum(l => l.Debit);

        // Outstanding Payments: In ledger (Cr > 0), not on bank statement
        var outstandingPayments = ledgerLineDtos
            .Where(l => !l.IsReconciled && l.Credit > 0)
            .Sum(l => l.Credit);

        // Unrecorded Bank Credits: On statement (Credit > 0), not in ledger
        var unrecordedCredits = statementLineDtos
            .Where(l => l.Status == StatementLineStatus.Unmatched && l.Credit > 0)
            .Sum(l => l.Credit);

        // Unrecorded Bank Debits: On statement (Debit > 0), not in ledger
        var unrecordedDebits = statementLineDtos
            .Where(l => l.Status == StatementLineStatus.Unmatched && l.Debit > 0)
            .Sum(l => l.Debit);

        var adjustedBank = statementEndingBal + depositsInTransit - outstandingPayments;
        var adjustedLedger = glEndingBal + unrecordedCredits - unrecordedDebits;
        var difference = adjustedBank - adjustedLedger;

        return new BankReconciliationWorkspaceResponse
        {
            CompanyId = companyId,
            AccountId = accountId,
            AccountCode = account.Code,
            AccountName = account.Name,
            Currency = "IDR",
            AsOfDate = targetDate,

            StatementEndingBalance = statementEndingBal,
            GeneralLedgerEndingBalance = glEndingBal,
            DepositsInTransit = depositsInTransit,
            OutstandingPayments = outstandingPayments,
            UnrecordedBankCredits = unrecordedCredits,
            UnrecordedBankDebits = unrecordedDebits,
            AdjustedBankBalance = adjustedBank,
            AdjustedLedgerBalance = adjustedLedger,
            Difference = difference,

            StatementLines = statementLineDtos,
            LedgerLines = ledgerLineDtos,

            TotalStatementLines = statementLineDtos.Count,
            MatchedStatementLines = statementLineDtos.Count(l => l.Status != StatementLineStatus.Unmatched),
            UnmatchedStatementLines = statementLineDtos.Count(l => l.Status == StatementLineStatus.Unmatched),

            TotalLedgerLines = ledgerLineDtos.Count,
            MatchedLedgerLines = ledgerLineDtos.Count(l => l.IsReconciled),
            UnmatchedLedgerLines = ledgerLineDtos.Count(l => !l.IsReconciled)
        };
    }

    /// <summary>
    /// Imports and parses a bank statement CSV with de-duplication
    /// </summary>
    public async Task<StatementImportResponse> ImportStatementCsvAsync(Guid companyId, StatementImportRequest request)
    {
        var account = await _context.Accounts.FindAsync(request.AccountId);
        if (account == null || account.CompanyId != companyId)
        {
            return new StatementImportResponse { Success = false, Message = "Bank account not found." };
        }

        if (string.IsNullOrWhiteSpace(request.CsvContent))
        {
            return new StatementImportResponse { Success = false, Message = "CSV content cannot be empty." };
        }

        var lines = request.CsvContent.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2)
        {
            return new StatementImportResponse { Success = false, Message = "CSV file must contain at least a header and one row." };
        }

        var parsedLines = new List<BankStatementLine>();
        decimal totalDebits = 0;
        decimal totalCredits = 0;
        int duplicatesCount = 0;

        DateOnly minDate = DateOnly.MaxValue;
        DateOnly maxDate = DateOnly.MinValue;
        decimal runningBal = request.InitialOpeningBalance ?? 0m;

        // Existing hashes for de-duplication
        var hashList = await _context.BankStatementLines
            .AsNoTracking()
            .Where(l => l.BankStatement!.CompanyId == companyId && l.BankStatement.AccountId == request.AccountId)
            .Select(l => l.LineHash)
            .Where(h => h != null)
            .ToListAsync();
        var existingHashes = hashList.ToHashSet();

        var header = lines[0];
        for (int i = 1; i < lines.Length; i++)
        {
            var rawLine = lines[i].Trim();
            if (string.IsNullOrWhiteSpace(rawLine)) continue;

            var cols = ParseCsvRow(rawLine);
            if (cols.Count < 3) continue;

            if (TryParseStatementRow(cols, request.Format, out var txDate, out var desc, out var refNo, out var debit, out var credit, out var rowBal))
            {
                if (txDate < minDate) minDate = txDate;
                if (txDate > maxDate) maxDate = txDate;

                if (rowBal.HasValue) runningBal = rowBal.Value;
                else runningBal += (credit - debit);

                var signedAmount = credit - debit;
                var lineHash = ComputeLineHash(txDate, signedAmount, desc, runningBal);

                if (existingHashes.Contains(lineHash))
                {
                    duplicatesCount++;
                    continue; // Skip duplicate
                }

                totalDebits += debit;
                totalCredits += credit;

                var statementLine = new BankStatementLine
                {
                    Id = Guid.NewGuid(),
                    TransactionDate = txDate,
                    ValueDate = txDate,
                    Description = desc,
                    ReferenceNumber = refNo,
                    Debit = debit,
                    Credit = credit,
                    Amount = signedAmount,
                    RunningBalance = runningBal,
                    Status = StatementLineStatus.Unmatched,
                    LineHash = lineHash,
                    CreatedAt = DateTime.UtcNow
                };

                parsedLines.Add(statementLine);
                existingHashes.Add(lineHash);
            }
        }

        if (parsedLines.Count == 0)
        {
            return new StatementImportResponse
            {
                Success = false,
                Message = duplicatesCount > 0 
                    ? $"All {duplicatesCount} transactions in this statement file were already imported (de-duplicated)." 
                    : "Failed to parse any valid transactions from the provided CSV file."
            };
        }

        var statement = new BankStatement
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            AccountId = request.AccountId,
            StatementDate = maxDate,
            PeriodStart = minDate,
            PeriodEnd = maxDate,
            OpeningBalance = request.InitialOpeningBalance ?? (runningBal - totalCredits + totalDebits),
            ClosingBalance = runningBal,
            Format = request.Format,
            FileName = request.FileName ?? "statement.csv",
            TotalLines = parsedLines.Count,
            TotalDebits = totalDebits,
            TotalCredits = totalCredits,
            Status = BankStatementStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        foreach (var l in parsedLines)
        {
            l.BankStatementId = statement.Id;
        }

        statement.Lines = parsedLines;

        _context.BankStatements.Add(statement);
        await _context.SaveChangesAsync();

        return new StatementImportResponse
        {
            Success = true,
            Message = $"Successfully imported {parsedLines.Count} bank statement lines ({duplicatesCount} duplicate lines skipped).",
            BankStatementId = statement.Id,
            TotalLinesParsed = lines.Length - 1,
            ImportedLinesCount = parsedLines.Count,
            DuplicateLinesSkipped = duplicatesCount,
            OpeningBalance = statement.OpeningBalance,
            ClosingBalance = statement.ClosingBalance,
            TotalDebits = totalDebits,
            TotalCredits = totalCredits
        };
    }

    /// <summary>
    /// Multi-pass auto matching algorithm
    /// </summary>
    public async Task<AutoMatchResponse> RunAutoMatchAsync(Guid companyId, AutoMatchRequest request)
    {
        var account = await _context.Accounts.FindAsync(request.AccountId);
        if (account == null || account.CompanyId != companyId)
        {
            throw new ArgumentException("Bank account not found.");
        }

        var accCode = account.Code;
        var accKey = account.Id.ToString();

        // 1. Unmatched Statement lines
        var statementLines = await _context.BankStatementLines
            .Include(l => l.BankStatement)
            .Where(l => l.BankStatement!.CompanyId == companyId
                     && l.BankStatement.AccountId == request.AccountId
                     && l.Status == StatementLineStatus.Unmatched)
            .OrderBy(l => l.TransactionDate)
            .ToListAsync();

        // 2. Unmatched GL lines
        var matchedGlIdList = await _context.BankStatementLines
            .Where(l => l.BankStatement!.CompanyId == companyId
                     && l.BankStatement.AccountId == request.AccountId
                     && l.MatchedJournalLineId != null)
            .Select(l => l.MatchedJournalLineId!.Value)
            .ToListAsync();
        var matchedGlIds = matchedGlIdList.ToHashSet();

        var glLines = await _context.JournalLines
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry!.CompanyId == companyId
                     && l.JournalEntry.Status == JournalEntryStatus.Posted
                     && (l.AccountId == accCode || l.AccountId == accKey)
                     && !matchedGlIds.Contains(l.Id))
            .OrderBy(l => l.JournalEntry!.Date)
            .ToListAsync();

        int exactMatches = 0;
        int timingMatches = 0;
        int vaMatches = 0;
        decimal totalMatchedAmt = 0;

        var availableGlLines = new List<JournalLine>(glLines);

        foreach (var sLine in statementLines)
        {
            // Note the inverted sign:
            // Bank Credit (+sLine.Credit) = Book Debit (+glLine.Debit)
            // Bank Debit (+sLine.Debit) = Book Credit (+glLine.Credit)
            bool isDeposit = sLine.Credit > 0;
            decimal targetAmount = isDeposit ? sLine.Credit : sLine.Debit;

            // Pass 1: Exact Date + Exact Inverted Amount
            var exactMatch = availableGlLines.FirstOrDefault(g =>
                g.JournalEntry!.Date == sLine.TransactionDate &&
                (isDeposit ? (g.Debit == targetAmount && g.Credit == 0) : (g.Credit == targetAmount && g.Debit == 0)));

            if (exactMatch != null)
            {
                sLine.MatchedJournalLineId = exactMatch.Id;
                sLine.Status = StatementLineStatus.Matched;
                sLine.MatchConfidence = MatchConfidence.Exact;
                sLine.MatchedDocumentType = DetermineDocumentType(exactMatch.JournalEntry?.ReferenceNumber);

                availableGlLines.Remove(exactMatch);
                exactMatches++;
                totalMatchedAmt += targetAmount;
                continue;
            }

            // Pass 2: Timing Difference (Date within ±tolerance days) + Exact Inverted Amount
            var tolerance = request.DateToleranceDays;
            var timingMatch = availableGlLines.FirstOrDefault(g =>
                Math.Abs((g.JournalEntry!.Date.ToDateTime(TimeOnly.MinValue) - sLine.TransactionDate.ToDateTime(TimeOnly.MinValue)).TotalDays) <= tolerance &&
                (isDeposit ? (g.Debit == targetAmount && g.Credit == 0) : (g.Credit == targetAmount && g.Debit == 0)));

            if (timingMatch != null)
            {
                sLine.MatchedJournalLineId = timingMatch.Id;
                sLine.Status = StatementLineStatus.Matched;
                sLine.MatchConfidence = MatchConfidence.High;
                sLine.MatchedDocumentType = DetermineDocumentType(timingMatch.JournalEntry?.ReferenceNumber);

                availableGlLines.Remove(timingMatch);
                timingMatches++;
                totalMatchedAmt += targetAmount;
                continue;
            }

            // Pass 3: Virtual Account Reference Match
            var va = ExtractVirtualAccount(sLine.Description);
            if (!string.IsNullOrEmpty(va))
            {
                var vaMatch = availableGlLines.FirstOrDefault(g =>
                    (g.Description?.Contains(va) == true || g.JournalEntry?.Notes?.Contains(va) == true || g.JournalEntry?.ReferenceNumber?.Contains(va) == true) &&
                    (isDeposit ? (g.Debit == targetAmount) : (g.Credit == targetAmount)));

                if (vaMatch != null)
                {
                    sLine.MatchedJournalLineId = vaMatch.Id;
                    sLine.Status = StatementLineStatus.Matched;
                    sLine.MatchConfidence = MatchConfidence.Exact;
                    sLine.MatchedDocumentType = DetermineDocumentType(vaMatch.JournalEntry?.ReferenceNumber);

                    availableGlLines.Remove(vaMatch);
                    vaMatches++;
                    totalMatchedAmt += targetAmount;
                }
            }
        }

        await _context.SaveChangesAsync();

        return new AutoMatchResponse
        {
            ExactMatchesFound = exactMatches,
            TimingMatchesFound = timingMatches,
            VirtualAccountMatchesFound = vaMatches,
            TotalMatchedAmount = totalMatchedAmt,
            Message = $"Auto-matched {exactMatches + timingMatches + vaMatches} transactions totaling Rp {totalMatchedAmt:N0}."
        };
    }

    /// <summary>
    /// Manually links a statement line to a GL journal line
    /// </summary>
    public async Task<bool> ManualMatchAsync(Guid companyId, ManualMatchRequest request)
    {
        var sLine = await _context.BankStatementLines
            .Include(l => l.BankStatement)
            .FirstOrDefaultAsync(l => l.Id == request.StatementLineId && l.BankStatement!.CompanyId == companyId);

        if (sLine == null) throw new ArgumentException("Bank statement line not found.");

        var glLine = await _context.JournalLines
            .Include(l => l.JournalEntry)
            .FirstOrDefaultAsync(l => l.Id == request.JournalLineId && l.JournalEntry!.CompanyId == companyId);

        if (glLine == null) throw new ArgumentException("General ledger line not found.");

        sLine.MatchedJournalLineId = glLine.Id;
        sLine.Status = StatementLineStatus.ManuallyMatched;
        sLine.MatchConfidence = MatchConfidence.Manual;
        sLine.MatchedDocumentType = DetermineDocumentType(glLine.JournalEntry?.ReferenceNumber);

        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Unlinks a matched statement line
    /// </summary>
    public async Task<bool> UnmatchAsync(Guid companyId, UnmatchRequest request)
    {
        var sLine = await _context.BankStatementLines
            .Include(l => l.BankStatement)
            .FirstOrDefaultAsync(l => l.Id == request.StatementLineId && l.BankStatement!.CompanyId == companyId);

        if (sLine == null) throw new ArgumentException("Bank statement line not found.");

        sLine.MatchedJournalLineId = null;
        sLine.Status = StatementLineStatus.Unmatched;
        sLine.MatchConfidence = MatchConfidence.None;
        sLine.MatchedDocumentType = null;

        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// 1-Click GL adjustment posting for unrecorded bank fee or interest income
    /// </summary>
    public async Task<PostBankAdjustmentResponse> PostBankAdjustmentAsync(Guid companyId, PostBankAdjustmentRequest request, string? userEmail = null)
    {
        var sLine = await _context.BankStatementLines
            .Include(l => l.BankStatement)
            .FirstOrDefaultAsync(l => l.Id == request.StatementLineId && l.BankStatement!.CompanyId == companyId);

        if (sLine == null) throw new ArgumentException("Bank statement line not found.");
        if (sLine.Status != StatementLineStatus.Unmatched) throw new InvalidOperationException("Line is already matched.");

        await _periodLockService.ValidateTransactionDate(companyId, sLine.TransactionDate);

        var bankAccount = await _context.Accounts.FindAsync(sLine.BankStatement!.AccountId);
        var bankAccKey = (bankAccount?.Id ?? Guid.Empty).ToString();

        var isCharge = request.AdjustmentType.Equals("BankCharge", StringComparison.OrdinalIgnoreCase) || sLine.Debit > 0;
        var amount = isCharge ? sLine.Debit : sLine.Credit;

        // Default Target Accounts:
        // Bank Charge: 6-1900 Bank Charges (or 6-2000 Administration Expenses)
        // Interest Income: 7-1000 Interest Income (Pendapatan Bunga)
        var targetCode = request.AccountCode ?? (isCharge ? "6-1900" : "7-1000");
        var targetAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.CompanyId == companyId && (a.Code == targetCode || a.Name.Contains(isCharge ? "Bank Charge" : "Interest")));

        var targetAccKey = (targetAccount?.Id ?? Guid.Empty).ToString();

        var refNo = $"ADJ-BANK-{sLine.TransactionDate:yyyyMMdd}-{sLine.Id.ToString()[..4].ToUpper()}";
        var notes = request.Notes ?? $"{sLine.Description} (Auto-posted from Bank Reconciliation by {userEmail ?? "system"})";

        var journalEntry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = sLine.TransactionDate,
            ReferenceNumber = refNo,
            Currency = "IDR",
            Notes = notes,
            Status = JournalEntryStatus.Posted,
            IsAdjustingEntry = true,
            CreatedAt = DateTime.UtcNow,
            Lines = new List<JournalLine>()
        };

        if (isCharge)
        {
            // Dr 6-1900 Bank Charges / Cr 1-1102 Bank Account
            var drLine = new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = targetAccKey,
                Debit = amount,
                Credit = 0,
                Description = $"Bank Fee: {sLine.Description}"
            };

            var crLine = new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = bankAccKey,
                Debit = 0,
                Credit = amount,
                Description = $"Bank Fee withdrawal: {sLine.Description}"
            };

            journalEntry.Lines.Add(drLine);
            journalEntry.Lines.Add(crLine);

            // Link to the Bank GL line
            sLine.MatchedJournalLineId = crLine.Id;
        }
        else
        {
            // Dr 1-1102 Bank Account / Cr 7-1000 Interest Income
            var drLine = new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = bankAccKey,
                Debit = amount,
                Credit = 0,
                Description = $"Interest received: {sLine.Description}"
            };

            var crLine = new JournalLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = journalEntry.Id,
                AccountId = targetAccKey,
                Debit = 0,
                Credit = amount,
                Description = $"Interest Income: {sLine.Description}"
            };

            journalEntry.Lines.Add(drLine);
            journalEntry.Lines.Add(crLine);

            sLine.MatchedJournalLineId = drLine.Id;
        }

        sLine.Status = StatementLineStatus.CreatedFromStatement;
        sLine.MatchConfidence = MatchConfidence.Exact;
        sLine.CreatedJournalEntryId = journalEntry.Id;

        _context.JournalEntries.Add(journalEntry);
        await _context.SaveChangesAsync();

        return new PostBankAdjustmentResponse
        {
            Success = true,
            Message = $"Posted adjustment entry {refNo} for Rp {amount:N0}.",
            JournalEntryId = journalEntry.Id,
            JournalNumber = refNo,
            Amount = amount
        };
    }

    /// <summary>
    /// Finalizes and locks a formal bank reconciliation session
    /// </summary>
    public async Task<FinalizeReconciliationResponse> FinalizeReconciliationAsync(Guid companyId, FinalizeReconciliationRequest request, string? userEmail = null)
    {
        var workspace = await GetWorkspaceAsync(companyId, request.AccountId, request.ReconciliationDate);

        if (!workspace.IsBalanced)
        {
            return new FinalizeReconciliationResponse
            {
                Success = false,
                Message = $"Reconciliation is not balanced (Difference of Rp {workspace.Difference:N2}). Please match or adjust all items before finalizing."
            };
        }

        var session = new BankReconciliationSession
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            AccountId = request.AccountId,
            ReconciliationDate = request.ReconciliationDate,
            StatementEndingBalance = workspace.StatementEndingBalance,
            LedgerEndingBalance = workspace.GeneralLedgerEndingBalance,
            OutstandingDeposits = workspace.DepositsInTransit,
            OutstandingPayments = workspace.OutstandingPayments,
            UnrecordedBankCredits = workspace.UnrecordedBankCredits,
            UnrecordedBankDebits = workspace.UnrecordedBankDebits,
            AdjustedBankBalance = workspace.AdjustedBankBalance,
            AdjustedLedgerBalance = workspace.AdjustedLedgerBalance,
            Difference = workspace.Difference,
            Status = ReconciliationStatus.Finalized,
            Notes = request.Notes,
            ReconciledBy = userEmail ?? "Accountant",
            CreatedAt = DateTime.UtcNow,
            FinalizedAt = DateTime.UtcNow
        };

        _context.BankReconciliationSessions.Add(session);

        // Mark statements up to date as reconciled
        var statements = await _context.BankStatements
            .Where(s => s.CompanyId == companyId && s.AccountId == request.AccountId && s.StatementDate <= request.ReconciliationDate)
            .ToListAsync();

        foreach (var s in statements)
        {
            s.Status = BankStatementStatus.Reconciled;
            s.ReconciledAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return new FinalizeReconciliationResponse
        {
            Success = true,
            Message = $"Bank Reconciliation finalized and locked successfully for as of {request.ReconciliationDate}.",
            SessionId = session.Id,
            ReconciledBalance = workspace.AdjustedBankBalance
        };
    }

    #region Parsers and Helpers

    private static bool TryParseStatementRow(
        List<string> cols, 
        BankStatementFormat format, 
        out DateOnly txDate, 
        out string desc, 
        out string? refNo, 
        out decimal debit, 
        out decimal credit, 
        out decimal? balance)
    {
        txDate = DateOnly.MinValue;
        desc = "";
        refNo = null;
        debit = 0;
        credit = 0;
        balance = null;

        try
        {
            if (format == BankStatementFormat.BcaKlikBca)
            {
                // BCA format: Date(0), Description(1), Branch(2), Amount(3), Type(4 DB/CR), Balance(5)
                if (cols.Count >= 5)
                {
                    txDate = ParseIndonesianDate(cols[0]);
                    desc = cols[1].Trim();
                    var amt = ParseIndonesianNumber(cols[3]);
                    var type = cols[4].Trim().ToUpperInvariant();
                    if (type == "CR") credit = amt;
                    else debit = amt;

                    if (cols.Count >= 6 && !string.IsNullOrWhiteSpace(cols[5]))
                    {
                        balance = ParseIndonesianNumber(cols[5]);
                    }
                    return true;
                }
            }
            else if (format == BankStatementFormat.MandiriMcm)
            {
                // Mandiri MCM: Date(0), ValueDate(1), Ref(2), Description(3), Debit(4), Credit(5), Balance(6)
                if (cols.Count >= 6)
                {
                    txDate = ParseIndonesianDate(cols[0]);
                    refNo = cols[2].Trim();
                    desc = cols[3].Trim();
                    debit = ParseIndonesianNumber(cols[4]);
                    credit = ParseIndonesianNumber(cols[5]);
                    if (cols.Count >= 7) balance = ParseIndonesianNumber(cols[6]);
                    return true;
                }
            }
            
            // Generic 5-Column CSV: Date(0), Description(1), Reference(2), Debit(3), Credit(4), [Balance(5)]
            if (cols.Count >= 4)
            {
                txDate = ParseIndonesianDate(cols[0]);
                desc = cols[1].Trim();
                refNo = cols[2].Trim();

                if (cols.Count >= 5)
                {
                    debit = ParseIndonesianNumber(cols[3]);
                    credit = ParseIndonesianNumber(cols[4]);
                    if (cols.Count >= 6) balance = ParseIndonesianNumber(cols[5]);
                }
                else
                {
                    // 4 columns: Date, Description, Ref, SignedAmount
                    var signed = ParseIndonesianNumber(cols[3]);
                    if (signed >= 0) credit = signed;
                    else debit = Math.Abs(signed);
                }
                return true;
            }
        }
        catch
        {
            return false;
        }

        return false;
    }

    private static decimal ParseIndonesianNumber(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return 0m;
        var clean = input.Replace("Rp", "").Replace("IDR", "").Trim();

        // Check if Indonesian format (dots for thousand, comma for decimal: 1.234.567,89)
        if (clean.Contains(',') && clean.IndexOf(',') == clean.Length - 3)
        {
            clean = clean.Replace(".", "").Replace(',', '.');
        }
        else if (clean.Contains(',') && !clean.Contains('.'))
        {
            clean = clean.Replace(',', '.');
        }
        else if (clean.Contains('.') && clean.Contains(','))
        {
            // US Format: 1,234,567.89
            clean = clean.Replace(",", "");
        }

        return decimal.TryParse(clean, NumberStyles.Any, CultureInfo.InvariantCulture, out var val) ? val : 0m;
    }

    private static DateOnly ParseIndonesianDate(string input)
    {
        var clean = input.Trim();
        var formats = new[] { "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yy" };
        if (DateTime.TryParseExact(clean, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
        {
            return DateOnly.FromDateTime(dt);
        }
        if (DateTime.TryParse(clean, out var dtAny))
        {
            return DateOnly.FromDateTime(dtAny);
        }
        return DateOnly.FromDateTime(DateTime.UtcNow);
    }

    private static string ComputeLineHash(DateOnly date, decimal amount, string desc, decimal balance)
    {
        var raw = $"{date:yyyyMMdd}|{amount:F2}|{desc.Trim().ToUpperInvariant()}|{balance:F2}";
        using var md5 = MD5.Create();
        var hash = md5.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash);
    }

    private static string? ExtractVirtualAccount(string desc)
    {
        if (string.IsNullOrWhiteSpace(desc)) return null;
        var match = Regex.Match(desc, @"\b(\d{11,16})\b");
        return match.Success ? match.Value : null;
    }

    private static string DetermineDocumentType(string? refNo)
    {
        if (string.IsNullOrEmpty(refNo)) return "Journal";
        if (refNo.StartsWith("RV-") || refNo.StartsWith("REC-")) return "ReceiptVoucher";
        if (refNo.StartsWith("PV-") || refNo.StartsWith("PAY-")) return "PaymentVoucher";
        if (refNo.StartsWith("EXP-")) return "Expense";
        if (refNo.StartsWith("INV-")) return "SalesInvoice";
        if (refNo.StartsWith("BILL-")) return "PurchaseBill";
        return "Journal";
    }

    private static List<string> ParseCsvRow(string row)
    {
        var result = new List<string>();
        var current = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < row.Length; i++)
        {
            char c = row[i];
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if ((c == ',' || c == ';') && !inQuotes)
            {
                result.Add(current.ToString().Trim('"', ' '));
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }
        result.Add(current.ToString().Trim('"', ' '));
        return result;
    }

    #endregion
}
