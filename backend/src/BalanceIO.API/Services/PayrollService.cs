using System.Globalization;
using BalanceIO.API.Data;
using BalanceIO.API.DTOs;
using BalanceIO.API.Models;
using Microsoft.EntityFrameworkCore;

namespace BalanceIO.API.Services;

/// <summary>
/// Monthly payroll runs and the journal entry each one posts.
///
/// A run is calculated as a Draft from each employee's compensation, can be
/// recalculated while it is a Draft, and posts one balanced entry:
///
///   Dr 6-1100 Salaries &amp; Wages           earnings
///   Dr 6-1110 Employee Benefits (BPJS)  employer BPJS
///      Cr 2-1410 PPh 21 Payable         PPh 21 withheld
///      Cr 2-1510 BPJS Payable           employer and employee BPJS
///      Cr 2-1500 Employee Payable       net pay
///
/// Posting checks the period lock and segregation of duties itself; the
/// ledger guards in SaveChangesAsync check balance and accounts again.
/// </summary>
public class PayrollService
{
    public const string SalaryAccount = "6-1100";
    public const string BenefitsAccount = "6-1110";
    public const string Pph21Account = "2-1410";
    public const string BpjsAccount = "2-1510";
    public const string NetPayAccount = "2-1500";

    private static readonly string[] RequiredAccounts =
        { SalaryAccount, BenefitsAccount, Pph21Account, BpjsAccount, NetPayAccount };

    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;

    private readonly ApplicationDbContext _context;
    private readonly IPeriodLockService _periodLock;
    private readonly PayrollRates _rates;

    public PayrollService(ApplicationDbContext context, IPeriodLockService periodLock, IConfiguration configuration)
    {
        _context = context;
        _periodLock = periodLock;
        _rates = PayrollRates.From(configuration);
    }

    public sealed record Actor(Guid UserId, string Label);

    // ── employees ─────────────────────────────────────────────────────

    public async Task<List<PayrollEmployeeDto>> GetEmployeesAsync(Guid companyId)
    {
        var employees = await _context.Contacts
            .AsNoTracking()
            .Where(c => c.CompanyId == companyId && c.IsEmployee && c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();

        var compensation = await _context.EmployeeCompensations
            .AsNoTracking()
            .Where(e => e.CompanyId == companyId)
            .ToDictionaryAsync(e => e.ContactId);

        return employees.Select(c =>
        {
            compensation.TryGetValue(c.Id, out var comp);
            var (_, category, ptkpWarning) = PayrollCalculator.ReadPtkp(c.PtkpStatus);

            var issues = new List<string>();
            if (comp is null) issues.Add("No compensation recorded.");
            else if (!comp.IsActive) issues.Add("Excluded from payroll runs.");
            if (ptkpWarning is not null) issues.Add(ptkpWarning);
            if (string.IsNullOrWhiteSpace(c.Nik)) issues.Add("No NIK, which e-Bupot 21 requires.");
            if (string.IsNullOrWhiteSpace(c.BankAccountNumber)) issues.Add("No bank account for net pay.");

            return new PayrollEmployeeDto
            {
                ContactId = c.Id,
                Code = c.Code,
                Name = c.Name,
                Nik = c.Nik,
                PtkpStatus = c.PtkpStatus,
                TerCategory = category,
                BpjsKetenagakerjaanNumber = c.BpjsKetenagakerjaanNumber,
                BpjsKesehatanNumber = c.BpjsKesehatanNumber,
                BankName = c.BankName,
                BankAccountNumber = c.BankAccountNumber,
                Compensation = comp is null ? null : ToDto(comp),
                Issues = issues,
            };
        }).ToList();
    }

    public async Task<PayrollCompensationDto> UpsertCompensationAsync(Guid companyId, Guid contactId, UpsertCompensationRequest request)
    {
        if (request.BaseSalary < 0m || request.FixedAllowance < 0m)
            throw new PayrollRuleException("INVALID_AMOUNT", "Salary and allowance cannot be negative.");

        if (request.JkkRate is < 0m or > 10m)
            throw new PayrollRuleException("INVALID_JKK_RATE", "The JKK rate is a percentage of wage between 0.24 and 1.74.");

        var contact = await _context.Contacts
            .FirstOrDefaultAsync(c => c.CompanyId == companyId && c.Id == contactId)
            ?? throw new PayrollRuleException("EMPLOYEE_NOT_FOUND", "Employee not found.", StatusCodes.Status404NotFound);

        if (!contact.IsEmployee)
            throw new PayrollRuleException("NOT_AN_EMPLOYEE", $"{contact.Name} is not marked as an employee.");

        var comp = await _context.EmployeeCompensations
            .FirstOrDefaultAsync(e => e.CompanyId == companyId && e.ContactId == contactId);

        if (comp is null)
        {
            comp = new EmployeeCompensation { Id = Guid.NewGuid(), CompanyId = companyId, ContactId = contactId };
            _context.EmployeeCompensations.Add(comp);
        }
        else
        {
            comp.UpdatedAt = DateTime.UtcNow;
        }

        if (request.CostCenterId.HasValue)
        {
            var valid = await _context.CostCenters.AnyAsync(c => c.CompanyId == companyId && c.Id == request.CostCenterId.Value);
            if (!valid)
                throw new PayrollRuleException("INVALID_COST_CENTER", "Cost center not found.", StatusCodes.Status400BadRequest);
        }

        comp.BaseSalary = request.BaseSalary;
        comp.FixedAllowance = request.FixedAllowance;
        comp.JkkRate = request.JkkRate;
        comp.BpjsKetenagakerjaan = request.BpjsKetenagakerjaan;
        comp.BpjsPension = request.BpjsPension;
        comp.BpjsKesehatan = request.BpjsKesehatan;
        comp.IsActive = request.IsActive;
        comp.CostCenterId = request.CostCenterId;

        await _context.SaveChangesAsync();
        return ToDto(comp);
    }

    // ── runs ──────────────────────────────────────────────────────────

    public async Task<PayrollOverviewDto> GetOverviewAsync(Guid companyId, DateOnly today)
    {
        var currency = await CurrencyAsync(companyId);
        var employees = await GetEmployeesAsync(companyId);
        var runs = await RunSummariesAsync(companyId);

        var previousMonth = new DateOnly(today.Year, today.Month, 1).AddMonths(-1);
        var live = runs.Where(r => r.Status != nameof(PayrollRunStatus.Void)).ToList();
        var yearPosted = live.Where(r => r.Year == today.Year && r.Status == nameof(PayrollRunStatus.Posted)).ToList();

        var overview = new PayrollOverviewDto
        {
            Currency = currency,
            Year = today.Year,
            Month = today.Month,
            Period = PeriodLabel(today.Year, today.Month),
            Employees = employees.Count,
            EmployeesWithoutCompensation = employees.Count(e => e.Compensation is null),
            EmployeesWithIssues = employees.Count(e => e.Issues.Count > 0),
            MonthlyBaseCost = employees
                .Where(e => e.Compensation is { IsActive: true })
                .Sum(e => e.Compensation!.BaseSalary + e.Compensation.FixedAllowance),
            CurrentRun = live.FirstOrDefault(r => r.Year == today.Year && r.Month == today.Month),
            PreviousRun = live.FirstOrDefault(r => r.Year == previousMonth.Year && r.Month == previousMonth.Month),
            YearGross = yearPosted.Sum(r => r.TotalGross),
            YearPph21 = yearPosted.Sum(r => r.TotalPph21),
            YearEmployerBpjs = yearPosted.Sum(r => r.TotalEmployerBpjs),
            YearEmployeeBpjs = yearPosted.Sum(r => r.TotalEmployeeBpjs),
            YearNetPay = yearPosted.Sum(r => r.TotalNetPay),
            Runs = runs.Take(12).ToList(),
        };

        // Remittance and filing for the most recent posted month: PPh 21 is
        // deposited by the 15th and the SPT Masa filed by the 20th of the
        // following month (PMK 81/2024); BPJS Ketenagakerjaan by the 15th.
        var lastPosted = live.FirstOrDefault(r => r.Status == nameof(PayrollRunStatus.Posted));
        if (lastPosted is not null)
        {
            var next = new DateOnly(lastPosted.Year, lastPosted.Month, 1).AddMonths(1);
            var period = PeriodLabel(lastPosted.Year, lastPosted.Month);
            overview.Deadlines.Add(Deadline($"PPh 21 deposit, {period}", next.AddDays(14), today));
            overview.Deadlines.Add(Deadline($"BPJS Ketenagakerjaan, {period}", next.AddDays(14), today));
            overview.Deadlines.Add(Deadline($"SPT Masa PPh 21/26, {period}", next.AddDays(19), today));
        }

        return overview;
    }

    public async Task<List<PayrollRunSummaryDto>> RunSummariesAsync(Guid companyId)
    {
        var runs = await _context.PayrollRuns
            .AsNoTracking()
            .Where(r => r.CompanyId == companyId)
            .OrderByDescending(r => r.Year).ThenByDescending(r => r.Month).ThenByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                Run = r,
                Employees = r.Lines.Count,
                Warnings = r.Lines.Count(l => l.Warning != null),
            })
            .ToListAsync();

        var references = await JournalReferencesAsync(runs.Select(r => r.Run.JournalEntryId));

        return runs.Select(r => Summary(r.Run, r.Employees, r.Warnings, references, new PayrollRunSummaryDto())).ToList();
    }

    public async Task<PayrollRunDetailDto> GetRunAsync(Guid companyId, Guid runId, Actor? actor = null)
    {
        var run = await _context.PayrollRuns
            .AsNoTracking()
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Id == runId)
            ?? throw NotFound();

        var references = await JournalReferencesAsync(new[] { run.JournalEntryId });
        var detail = Summary(run, run.Lines.Count, run.Lines.Count(l => l.Warning != null), references,
            new PayrollRunDetailDto { Currency = await CurrencyAsync(companyId) });

        detail.Lines = run.Lines.OrderBy(l => l.EmployeeName).Select(ToDto).ToList();

        var names = await _context.Accounts
            .AsNoTracking()
            .Where(a => a.CompanyId == companyId && RequiredAccounts.Contains(a.Code))
            .ToDictionaryAsync(a => a.Code, a => a.Name);

        detail.Journal = JournalFor(run).Select(l => new PayrollJournalLineDto
        {
            AccountCode = l.Code,
            AccountName = names.TryGetValue(l.Code, out var name) ? name : "Missing from chart of accounts",
            Description = l.Description,
            Debit = l.Debit,
            Credit = l.Credit,
        }).ToList();

        if (run.Status == PayrollRunStatus.Draft)
        {
            var missing = RequiredAccounts.Where(code => !names.ContainsKey(code)).ToList();
            if (missing.Count > 0)
                detail.Blockers.Add($"Account {string.Join(", ", missing)} is missing from the chart of accounts.");

            var lockDate = await _context.Companies.AsNoTracking()
                .Where(c => c.Id == companyId).Select(c => c.LockDate).FirstOrDefaultAsync();
            if (lockDate.HasValue && run.PostingDate <= lockDate.Value)
                detail.Blockers.Add(string.Format(Invariant,
                    "{0:d MMM yyyy} falls inside the locked period, which ends {1:d MMM yyyy}.", run.PostingDate, lockDate.Value));

            if (actor is not null && await SegregationBlocksAsync(companyId, run, actor))
                detail.Blockers.Add("You calculated this run. A second person has to post it.");

            if (run.Lines.Count == 0)
                detail.Blockers.Add("The run has no employees.");
        }

        return detail;
    }

    public async Task<PayrollRunDetailDto> CreateRunAsync(Guid companyId, CreatePayrollRunRequest request, Actor actor)
    {
        if (request.Month is < 1 or > 12 || request.Year is < 2000 or > 2100)
            throw new PayrollRuleException("INVALID_PERIOD", "Month must be 1 to 12 and year a four-digit year.");

        var periodStart = new DateOnly(request.Year, request.Month, 1);
        var postingDate = request.PostingDate ?? periodStart.AddMonths(1).AddDays(-1);

        if (postingDate < periodStart)
            throw new PayrollRuleException("INVALID_POSTING_DATE", "The posting date cannot fall before the month being paid.");

        await _periodLock.ValidateTransactionDate(companyId, postingDate);

        var exists = await _context.PayrollRuns.AnyAsync(r => r.CompanyId == companyId
            && r.Year == request.Year && r.Month == request.Month && r.Status != PayrollRunStatus.Void);
        if (exists)
            throw new PayrollRuleException("RUN_EXISTS",
                $"{PeriodLabel(request.Year, request.Month)} already has a payroll run. Void it to run the month again.",
                StatusCodes.Status409Conflict);

        var run = new PayrollRun
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Year = request.Year,
            Month = request.Month,
            PostingDate = postingDate,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedByUserId = actor.UserId,
            CreatedBy = actor.Label,
        };

        run.Lines = await CalculateLinesAsync(companyId, run, new Dictionary<Guid, decimal>());
        if (run.Lines.Count == 0)
            throw new PayrollRuleException("NO_EMPLOYEES",
                "No active employee has compensation recorded. Mark contacts as employees and set their salary first.");

        Total(run);
        _context.PayrollRuns.Add(run);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // The filtered unique index decided a race the check above lost.
            throw new PayrollRuleException("RUN_EXISTS",
                $"{PeriodLabel(request.Year, request.Month)} already has a payroll run.", StatusCodes.Status409Conflict);
        }

        return await GetRunAsync(companyId, run.Id, actor);
    }

    /// <summary>
    /// Rebuilds a Draft from current compensation and year-to-date figures,
    /// keeping each employee's other earnings. When <paramref name="lineId"/>
    /// is given, that line's other earnings are replaced first.
    /// </summary>
    public async Task<PayrollRunDetailDto> RecalculateAsync(Guid companyId, Guid runId, Actor actor, Guid? lineId = null, decimal? otherEarnings = null)
    {
        var run = await LoadDraftAsync(companyId, runId);

        var keep = run.Lines.ToDictionary(l => l.ContactId, l => l.OtherEarnings);
        if (lineId.HasValue)
        {
            var line = run.Lines.FirstOrDefault(l => l.Id == lineId.Value)
                ?? throw new PayrollRuleException("LINE_NOT_FOUND", "That employee is not on this run.", StatusCodes.Status404NotFound);
            if (otherEarnings is < 0m)
                throw new PayrollRuleException("INVALID_AMOUNT", "Other earnings cannot be negative.");
            keep[line.ContactId] = otherEarnings ?? 0m;
        }

        _context.PayrollLines.RemoveRange(run.Lines);
        var lines = await CalculateLinesAsync(companyId, run, keep);
        run.Lines = lines;
        _context.PayrollLines.AddRange(lines);

        Total(run);
        run.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetRunAsync(companyId, run.Id, actor);
    }

    public async Task DeleteDraftAsync(Guid companyId, Guid runId)
    {
        var run = await LoadDraftAsync(companyId, runId);
        _context.PayrollLines.RemoveRange(run.Lines);
        _context.PayrollRuns.Remove(run);
        await _context.SaveChangesAsync();
    }

    public async Task<PayrollRunDetailDto> PostAsync(Guid companyId, Guid runId, Actor actor)
    {
        var run = await LoadDraftAsync(companyId, runId);

        if (run.Lines.Count == 0)
            throw new PayrollRuleException("EMPTY_RUN", "The run has no employees.");

        if (await SegregationBlocksAsync(companyId, run, actor))
            throw new PayrollRuleException("SEGREGATION_OF_DUTIES_VIOLATION",
                $"You calculated this run ({run.CreatedBy}). Internal controls require a second authorised person to post it.",
                StatusCodes.Status403Forbidden);

        await _periodLock.ValidateTransactionDate(companyId, run.PostingDate);

        // What is posted has to be what the reviewer saw. A run calculated
        // before an earlier month was posted or voided carries stale
        // year-to-date figures, which matters most for the December
        // settlement.
        var fresh = await CalculateLinesAsync(companyId, run, run.Lines.ToDictionary(l => l.ContactId, l => l.OtherEarnings));
        if (!SameFigures(run.Lines, fresh))
            throw new PayrollRuleException("RUN_STALE",
                "Compensation or year-to-date figures changed since this run was calculated. Recalculate and review it before posting.",
                StatusCodes.Status409Conflict);

        var codes = await _context.ResolveAccountCodesAsync(companyId, RequiredAccounts);
        var missing = RequiredAccounts.Where(code => !codes.ContainsKey(code)).ToList();
        if (missing.Count > 0)
            throw new PayrollRuleException("MISSING_ACCOUNT",
                $"Account {string.Join(", ", missing)} is missing from the chart of accounts.");

        var contactIds = run.Lines.Select(l => l.ContactId).Distinct().ToList();
        var compCostCenters = await _context.EmployeeCompensations
            .AsNoTracking()
            .Where(e => e.CompanyId == companyId && contactIds.Contains(e.ContactId))
            .ToDictionaryAsync(e => e.ContactId, e => e.CostCenterId);

        var period = PeriodLabel(run.Year, run.Month);
        var lines = new List<JournalLine>();

        // Split 6-1100 Salary Expense by employee CostCenterId
        var salaryGroups = run.Lines
            .GroupBy(l => compCostCenters.TryGetValue(l.ContactId, out var ccId) ? ccId : null)
            .ToList();

        foreach (var group in salaryGroups)
        {
            var groupGross = group.Sum(l => l.BaseSalary + l.FixedAllowance + l.OtherEarnings);
            if (groupGross > 0m)
            {
                lines.Add(new JournalLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = codes[SalaryAccount],
                    Description = $"Salaries and wages, {period}",
                    Debit = groupGross,
                    Credit = 0m,
                    CostCenterId = group.Key,
                });
            }
        }

        // Remaining lines from JournalFor (Benefits, PPh 21, BPJS, Net Pay)
        foreach (var posting in JournalFor(run).Where(p => p.Code != SalaryAccount))
        {
            lines.Add(new JournalLine
            {
                Id = Guid.NewGuid(),
                AccountId = codes[posting.Code],
                Description = posting.Description,
                Debit = posting.Debit,
                Credit = posting.Credit,
            });
        }

        if (lines.Sum(l => l.Debit) != lines.Sum(l => l.Credit))
            throw new InvalidOperationException("Payroll produced an unbalanced entry; nothing was posted.");

        var now = DateTime.UtcNow;
        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Date = run.PostingDate,
            ReferenceNumber = $"PAY-{run.Year}{run.Month:D2}",
            IdempotencyKey = $"payroll:{run.Id}",
            Notes = $"Payroll for {PeriodLabel(run.Year, run.Month)}, {run.Lines.Count} employee(s).",
            Currency = "IDR",
            Status = JournalEntryStatus.Posted,
            CreatedAt = now,
            CreatedByUserId = run.CreatedByUserId,
            CreatedBy = run.CreatedBy,
            ApprovedByUserId = actor.UserId,
            ApprovedBy = actor.Label,
            ApprovedAt = now,
            Lines = lines,
        };

        _context.JournalEntries.Add(entry);

        run.Status = PayrollRunStatus.Posted;
        run.JournalEntryId = entry.Id;
        run.ApprovedByUserId = actor.UserId;
        run.ApprovedBy = actor.Label;
        run.ApprovedAt = now;
        run.UpdatedAt = now;

        await _context.SaveChangesAsync();
        return await GetRunAsync(companyId, run.Id, actor);
    }

    /// <summary>
    /// Voids the run and its journal entry together. A later posted run in
    /// the same year was calculated on this one's year-to-date figures, so
    /// it has to be voided first.
    /// </summary>
    public async Task<PayrollRunDetailDto> VoidAsync(Guid companyId, Guid runId, Actor actor, string? reason)
    {
        var run = await _context.PayrollRuns
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Id == runId)
            ?? throw NotFound();

        if (run.Status == PayrollRunStatus.Void)
            throw new PayrollRuleException("ALREADY_VOID", "The run is already void.");
        if (run.Status == PayrollRunStatus.Draft)
            throw new PayrollRuleException("DRAFT_NOT_VOIDABLE", "A Draft run is deleted, not voided.");

        var later = await _context.PayrollRuns.AnyAsync(r => r.CompanyId == companyId
            && r.Year == run.Year && r.Month > run.Month && r.Status == PayrollRunStatus.Posted);
        if (later)
            throw new PayrollRuleException("LATER_RUN_POSTED",
                "A later month of the same year is posted and carries this run in its year-to-date PPh 21. Void that run first.",
                StatusCodes.Status409Conflict);

        await _periodLock.ValidateTransactionDate(companyId, run.PostingDate);

        if (run.JournalEntryId.HasValue)
        {
            var entry = await _context.JournalEntries
                .FirstOrDefaultAsync(e => e.CompanyId == companyId && e.Id == run.JournalEntryId.Value);
            if (entry is not null && entry.Status == JournalEntryStatus.Posted)
            {
                entry.Status = JournalEntryStatus.Void;
                entry.UpdatedAt = DateTime.UtcNow;
            }
        }

        run.Status = PayrollRunStatus.Void;
        run.UpdatedAt = DateTime.UtcNow;
        var note = $"Voided by {actor.Label}" + (string.IsNullOrWhiteSpace(reason) ? "." : $": {reason.Trim()}");
        run.Notes = string.IsNullOrEmpty(run.Notes) ? note : $"{run.Notes} {note}";
        if (run.Notes.Length > 500) run.Notes = run.Notes[..500];

        await _context.SaveChangesAsync();
        return await GetRunAsync(companyId, run.Id, actor);
    }

    // ── PPh 21 for the withholding report ─────────────────────────────

    public async Task<List<WithholdingTaxLineDto>> Pph21LinesAsync(Guid companyId, int year, int month)
    {
        var lines = await _context.PayrollLines
            .AsNoTracking()
            .Where(l => l.PayrollRun!.CompanyId == companyId
                     && l.PayrollRun.Year == year && l.PayrollRun.Month == month
                     && l.PayrollRun.Status == PayrollRunStatus.Posted)
            .Select(l => new { Line = l, l.PayrollRun!.PostingDate })
            .ToListAsync();

        return lines.OrderBy(l => l.Line.EmployeeName).Select(l => new WithholdingTaxLineDto
        {
            Id = l.Line.Id,
            TaxType = "PPh 21",
            KodeObjekPajak = "21-100-01",
            CounterpartyName = l.Line.EmployeeName,
            CounterpartyNik = l.Line.Nik,
            PtkpStatus = l.Line.PtkpStatus,
            TerCategory = $"TER {l.Line.TerCategory}",
            ReferenceDocument = $"PAY-{year}{month:D2}",
            TransactionDate = l.PostingDate,
            GrossDppAmount = l.Line.TaxableGross,
            EffectiveTaxRate = l.Line.TerRate ?? 0m,
            TaxWithheldAmount = l.Line.Pph21,
        }).ToList();
    }

    // ── calculation ───────────────────────────────────────────────────

    private async Task<List<PayrollLine>> CalculateLinesAsync(Guid companyId, PayrollRun run, Dictionary<Guid, decimal> otherEarnings)
    {
        var employees = await _context.EmployeeCompensations
            .AsNoTracking()
            .Where(e => e.CompanyId == companyId && e.IsActive
                     && e.Contact!.IsEmployee && e.Contact.IsActive)
            .Select(e => new { Comp = e, e.Contact!.Name, e.Contact.Nik, e.Contact.PtkpStatus })
            .ToListAsync();

        // Posted earlier months of the same year, per employee.
        var history = await _context.PayrollLines
            .AsNoTracking()
            .Where(l => l.PayrollRun!.CompanyId == companyId
                     && l.PayrollRun.Year == run.Year && l.PayrollRun.Month < run.Month
                     && l.PayrollRun.Status == PayrollRunStatus.Posted)
            .Select(l => new { l.ContactId, l.TaxableGross, l.EmployeeJht, l.EmployeeJp, l.Pph21 })
            .ToListAsync();

        var ytd = history
            .GroupBy(h => h.ContactId)
            .ToDictionary(g => g.Key, g => new PayrollYearToDate(
                g.Count(),
                g.Sum(h => h.TaxableGross),
                g.Sum(h => h.EmployeeJht + h.EmployeeJp),
                g.Sum(h => h.Pph21)));

        var lines = new List<PayrollLine>();
        foreach (var e in employees.OrderBy(e => e.Name))
        {
            var other = otherEarnings.TryGetValue(e.Comp.ContactId, out var o) ? o : 0m;
            var input = new PayrollInput(
                e.Comp.BaseSalary, e.Comp.FixedAllowance, other, e.PtkpStatus, e.Comp.JkkRate,
                e.Comp.BpjsKetenagakerjaan, e.Comp.BpjsPension, e.Comp.BpjsKesehatan);

            var r = PayrollCalculator.Calculate(input, run.Month,
                ytd.TryGetValue(e.Comp.ContactId, out var y) ? y : PayrollYearToDate.None, _rates);

            lines.Add(new PayrollLine
            {
                Id = Guid.NewGuid(),
                PayrollRunId = run.Id,
                ContactId = e.Comp.ContactId,
                EmployeeName = e.Name,
                Nik = e.Nik,
                PtkpStatus = r.PtkpStatus,
                TerCategory = r.TerCategory,
                BaseSalary = e.Comp.BaseSalary,
                FixedAllowance = e.Comp.FixedAllowance,
                OtherEarnings = other,
                EmployerJkk = r.EmployerJkk,
                EmployerJkm = r.EmployerJkm,
                EmployerJht = r.EmployerJht,
                EmployerJp = r.EmployerJp,
                EmployerKesehatan = r.EmployerKesehatan,
                EmployeeJht = r.EmployeeJht,
                EmployeeJp = r.EmployeeJp,
                EmployeeKesehatan = r.EmployeeKesehatan,
                TaxableGross = r.TaxableGross,
                TerRate = r.TerRate,
                Pph21Method = r.Pph21Method,
                Pph21 = r.Pph21,
                NetPay = r.NetPay,
                Warning = r.Warning,
            });
        }

        return lines;
    }

    private static bool SameFigures(List<PayrollLine> stored, List<PayrollLine> fresh)
    {
        if (stored.Count != fresh.Count) return false;
        var byContact = fresh.ToDictionary(l => l.ContactId);
        return stored.All(s => byContact.TryGetValue(s.ContactId, out var f)
            && s.BaseSalary == f.BaseSalary && s.FixedAllowance == f.FixedAllowance
            && s.TaxableGross == f.TaxableGross && s.Pph21 == f.Pph21 && s.NetPay == f.NetPay
            && s.EmployerJkk + s.EmployerJkm + s.EmployerJht + s.EmployerJp + s.EmployerKesehatan
               == f.EmployerJkk + f.EmployerJkm + f.EmployerJht + f.EmployerJp + f.EmployerKesehatan);
    }

    private static void Total(PayrollRun run)
    {
        run.TotalGross = run.Lines.Sum(l => l.BaseSalary + l.FixedAllowance + l.OtherEarnings);
        run.TotalPph21 = run.Lines.Sum(l => l.Pph21);
        run.TotalEmployeeBpjs = run.Lines.Sum(l => l.EmployeeJht + l.EmployeeJp + l.EmployeeKesehatan);
        run.TotalEmployerBpjs = run.Lines.Sum(l => l.EmployerJkk + l.EmployerJkm + l.EmployerJht + l.EmployerJp + l.EmployerKesehatan);
        run.TotalNetPay = run.Lines.Sum(l => l.NetPay);
    }

    private sealed record Posting(string Code, string Description, decimal Debit, decimal Credit);

    /// <summary>
    /// The entry for a run, from its stored totals. A negative PPh 21 total
    /// (a December refund larger than the month's withholding) is a debit
    /// to the payable rather than a negative credit.
    /// </summary>
    private static List<Posting> JournalFor(PayrollRun run)
    {
        var period = PeriodLabel(run.Year, run.Month);
        var postings = new List<Posting>();

        void Add(string code, string description, decimal debitSide)
        {
            if (debitSide > 0m) postings.Add(new Posting(code, description, debitSide, 0m));
            else if (debitSide < 0m) postings.Add(new Posting(code, description, 0m, -debitSide));
        }

        Add(SalaryAccount, $"Salaries and wages, {period}", run.TotalGross);
        Add(BenefitsAccount, $"Employer BPJS, {period}", run.TotalEmployerBpjs);
        Add(Pph21Account, $"PPh 21 withheld, {period}", -run.TotalPph21);
        Add(BpjsAccount, $"BPJS payable, {period}", -(run.TotalEmployerBpjs + run.TotalEmployeeBpjs));
        Add(NetPayAccount, $"Net pay, {period}", -run.TotalNetPay);

        return postings;
    }

    // ── shared ────────────────────────────────────────────────────────

    private async Task<PayrollRun> LoadDraftAsync(Guid companyId, Guid runId)
    {
        var run = await _context.PayrollRuns
            .Include(r => r.Lines)
            .FirstOrDefaultAsync(r => r.CompanyId == companyId && r.Id == runId)
            ?? throw NotFound();

        return run.Status switch
        {
            PayrollRunStatus.Posted => throw new PayrollRuleException("POSTED_IMMUTABLE", "A posted run cannot change. Void it and run the month again."),
            PayrollRunStatus.Void => throw new PayrollRuleException("VOID_IMMUTABLE", "A void run cannot change."),
            _ => run,
        };
    }

    private async Task<bool> SegregationBlocksAsync(Guid companyId, PayrollRun run, Actor actor)
    {
        var enforce = await _context.Companies.AsNoTracking()
            .Where(c => c.Id == companyId).Select(c => c.EnforceSegregationOfDuties).FirstOrDefaultAsync();

        return enforce
            && ((run.CreatedByUserId.HasValue && run.CreatedByUserId == actor.UserId)
                || (!string.IsNullOrEmpty(run.CreatedBy) && string.Equals(run.CreatedBy, actor.Label, StringComparison.OrdinalIgnoreCase)));
    }

    private async Task<Dictionary<Guid, string?>> JournalReferencesAsync(IEnumerable<Guid?> ids)
    {
        var wanted = ids.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        if (wanted.Count == 0) return new();

        return await _context.JournalEntries
            .AsNoTracking()
            .Where(e => wanted.Contains(e.Id))
            .ToDictionaryAsync(e => e.Id, e => e.ReferenceNumber);
    }

    private async Task<string> CurrencyAsync(Guid companyId) =>
        await _context.Companies.AsNoTracking()
            .Where(c => c.Id == companyId).Select(c => c.Currency).FirstOrDefaultAsync() ?? "IDR";

    private static T Summary<T>(PayrollRun run, int employees, int warnings, Dictionary<Guid, string?> references, T dto)
        where T : PayrollRunSummaryDto
    {
        dto.Id = run.Id;
        dto.Year = run.Year;
        dto.Month = run.Month;
        dto.Period = PeriodLabel(run.Year, run.Month);
        dto.PostingDate = run.PostingDate;
        dto.Status = run.Status.ToString();
        dto.Employees = employees;
        dto.Warnings = warnings;
        dto.TotalGross = run.TotalGross;
        dto.TotalPph21 = run.TotalPph21;
        dto.TotalEmployeeBpjs = run.TotalEmployeeBpjs;
        dto.TotalEmployerBpjs = run.TotalEmployerBpjs;
        dto.TotalNetPay = run.TotalNetPay;
        dto.TotalCost = run.TotalGross + run.TotalEmployerBpjs;
        dto.JournalEntryId = run.JournalEntryId;
        dto.JournalReference = run.JournalEntryId is Guid id && references.TryGetValue(id, out var reference) ? reference : null;
        dto.Notes = run.Notes;
        dto.CreatedBy = run.CreatedBy;
        dto.ApprovedBy = run.ApprovedBy;
        dto.ApprovedAt = run.ApprovedAt;
        dto.CreatedAt = run.CreatedAt;
        return dto;
    }

    private static PayrollLineDto ToDto(PayrollLine l) => new()
    {
        Id = l.Id,
        ContactId = l.ContactId,
        EmployeeName = l.EmployeeName,
        Nik = l.Nik,
        PtkpStatus = l.PtkpStatus,
        TerCategory = l.TerCategory,
        BaseSalary = l.BaseSalary,
        FixedAllowance = l.FixedAllowance,
        OtherEarnings = l.OtherEarnings,
        EmployerJkk = l.EmployerJkk,
        EmployerJkm = l.EmployerJkm,
        EmployerJht = l.EmployerJht,
        EmployerJp = l.EmployerJp,
        EmployerKesehatan = l.EmployerKesehatan,
        EmployeeJht = l.EmployeeJht,
        EmployeeJp = l.EmployeeJp,
        EmployeeKesehatan = l.EmployeeKesehatan,
        TaxableGross = l.TaxableGross,
        TerRate = l.TerRate,
        Pph21Method = l.Pph21Method,
        Pph21 = l.Pph21,
        NetPay = l.NetPay,
        Warning = l.Warning,
    };

    private static PayrollCompensationDto ToDto(EmployeeCompensation c) => new()
    {
        BaseSalary = c.BaseSalary,
        FixedAllowance = c.FixedAllowance,
        JkkRate = c.JkkRate,
        BpjsKetenagakerjaan = c.BpjsKetenagakerjaan,
        BpjsPension = c.BpjsPension,
        BpjsKesehatan = c.BpjsKesehatan,
        IsActive = c.IsActive,
        CostCenterId = c.CostCenterId,
        UpdatedAt = c.UpdatedAt ?? c.CreatedAt,
    };

    private static PayrollDeadlineDto Deadline(string label, DateOnly due, DateOnly today) => new()
    {
        Label = label,
        Due = due,
        DaysRemaining = due.DayNumber - today.DayNumber,
    };

    public static string PeriodLabel(int year, int month) =>
        new DateTime(year, month, 1).ToString("MMMM yyyy", Invariant);

    private static PayrollRuleException NotFound() =>
        new("RUN_NOT_FOUND", "Payroll run not found.", StatusCodes.Status404NotFound);
}
