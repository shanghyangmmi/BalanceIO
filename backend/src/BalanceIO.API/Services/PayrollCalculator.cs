using System.Text.RegularExpressions;

namespace BalanceIO.API.Services;

/// <summary>
/// Monthly payroll for one employee: BPJS contributions, PPh 21 and net pay.
/// Pure arithmetic, no database, so every rule can be tested on its own.
///
/// PPh 21 follows PP 58/2023 and PMK 168/2023. January to November withhold
/// at the monthly Tarif Efektif Rata-rata on gross income. December settles
/// the year: Pasal 17 rates on annual net income less PTKP, minus what TER
/// already withheld. The December figure can be negative; the excess goes
/// back to the employee in net pay.
///
/// Gross for PPh 21 includes the JKK, JKM and BPJS Kesehatan premiums the
/// employer pays, because those are benefits in kind to the employee. The
/// employer's JHT and JP are not; the employee's own JHT and JP reduce
/// annual net income.
///
/// Amounts round to the whole rupiah, half to even. PKP rounds down to the
/// thousand, as the regulation requires. Practitioner review is needed
/// before reliance, as with the rest of the tax module.
/// </summary>
public static class PayrollCalculator
{
    // BPJS percentages of the monthly wage (gaji pokok plus tunjangan tetap).
    public const decimal KesehatanEmployerRate = 4m;
    public const decimal KesehatanEmployeeRate = 1m;
    public const decimal JhtEmployerRate = 3.7m;
    public const decimal JhtEmployeeRate = 2m;
    public const decimal JpEmployerRate = 2m;
    public const decimal JpEmployeeRate = 1m;
    public const decimal JkmRate = 0.3m;

    // Biaya jabatan: 5% of gross, at most Rp 500.000 a month.
    private const decimal BiayaJabatanRate = 5m;
    private const decimal BiayaJabatanMonthlyCap = 500_000m;

    private const decimal PtkpBase = 54_000_000m;
    private const decimal PtkpAddition = 4_500_000m;

    private static readonly Regex PtkpPattern = new(@"^(TK|K)/([0-3])$", RegexOptions.Compiled);

    public static PayrollResult Calculate(PayrollInput input, int month, PayrollYearToDate ytd, PayrollRates rates)
    {
        var (ptkp, category, ptkpWarning) = ReadPtkp(input.PtkpStatus);

        var wage = input.BaseSalary + input.FixedAllowance;
        var kesehatanWage = Math.Min(wage, rates.KesehatanWageCap);
        var pensionWage = Math.Min(wage, rates.JpWageCap);

        var result = new PayrollResult
        {
            PtkpStatus = ptkp,
            TerCategory = category,
            Warning = ptkpWarning,
        };

        if (input.BpjsKetenagakerjaan)
        {
            result.EmployerJkk = Percent(wage, input.JkkRate);
            result.EmployerJkm = Percent(wage, JkmRate);
            result.EmployerJht = Percent(wage, JhtEmployerRate);
            result.EmployeeJht = Percent(wage, JhtEmployeeRate);
        }

        if (input.BpjsPension)
        {
            result.EmployerJp = Percent(pensionWage, JpEmployerRate);
            result.EmployeeJp = Percent(pensionWage, JpEmployeeRate);
        }

        if (input.BpjsKesehatan)
        {
            result.EmployerKesehatan = Percent(kesehatanWage, KesehatanEmployerRate);
            result.EmployeeKesehatan = Percent(kesehatanWage, KesehatanEmployeeRate);
        }

        var earnings = wage + input.OtherEarnings;
        result.TaxableGross = earnings + result.EmployerJkk + result.EmployerJkm + result.EmployerKesehatan;

        if (month == 12)
        {
            result.Pph21Method = "Annual";
            result.Pph21 = DecemberSettlement(result, ptkp, ytd);
        }
        else
        {
            result.Pph21Method = "TER";
            result.TerRate = TerRate(category, result.TaxableGross);
            result.Pph21 = Percent(result.TaxableGross, result.TerRate.Value);
        }

        result.NetPay = earnings - result.Pph21 - result.EmployeeBpjs;
        return result;
    }

    /// <summary>Tax due for the year under Pasal 17, less what TER withheld.</summary>
    private static decimal DecemberSettlement(PayrollResult december, string ptkp, PayrollYearToDate ytd)
    {
        var annualGross = ytd.TaxableGross + december.TaxableGross;
        var months = ytd.MonthsPaid + 1;

        var biayaJabatan = Math.Min(Percent(annualGross, BiayaJabatanRate), BiayaJabatanMonthlyCap * months);
        var pensionContributions = ytd.EmployeePension + december.EmployeeJht + december.EmployeeJp;

        var annualNet = annualGross - biayaJabatan - pensionContributions;
        var pkp = Math.Floor((annualNet - PtkpAmount(ptkp)) / 1000m) * 1000m;
        if (pkp < 0m) pkp = 0m;

        return Pasal17(pkp) - ytd.Pph21Withheld;
    }

    /// <summary>UU HPP brackets.</summary>
    public static decimal Pasal17(decimal pkp)
    {
        (decimal UpTo, decimal Rate)[] brackets =
        {
            (60_000_000m, 5m),
            (250_000_000m, 15m),
            (500_000_000m, 25m),
            (5_000_000_000m, 30m),
            (decimal.MaxValue, 35m),
        };

        decimal tax = 0m, lower = 0m;
        foreach (var (upTo, rate) in brackets)
        {
            if (pkp <= lower) break;
            tax += (Math.Min(pkp, upTo) - lower) * rate / 100m;
            lower = upTo;
        }

        return Math.Round(tax, 0, MidpointRounding.ToEven);
    }

    public static decimal PtkpAmount(string ptkp)
    {
        var match = PtkpPattern.Match(ptkp);
        if (!match.Success) return PtkpBase;

        var married = match.Groups[1].Value == "K";
        var dependants = int.Parse(match.Groups[2].Value);
        return PtkpBase + (married ? PtkpAddition : 0m) + dependants * PtkpAddition;
    }

    /// <summary>
    /// The PTKP status, its TER category, and a warning when the status was
    /// missing or unreadable. An unknown status is treated as TK/0, which
    /// falls in category A: the lowest thresholds, so the most withheld.
    /// Over-withholding is returned at year end; under-withholding is the
    /// company's liability.
    /// </summary>
    public static (string Ptkp, string Category, string? Warning) ReadPtkp(string? status)
    {
        var normalised = (status ?? string.Empty).Trim().ToUpperInvariant().Replace(" ", "");
        if (!PtkpPattern.IsMatch(normalised))
        {
            var warning = string.IsNullOrEmpty(normalised)
                ? "No PTKP status on the employee; withheld as TK/0."
                : $"PTKP status \"{status}\" is not recognised; withheld as TK/0.";
            return ("TK/0", "A", warning);
        }

        var category = normalised switch
        {
            "TK/0" or "TK/1" or "K/0" => "A",
            "TK/2" or "TK/3" or "K/1" or "K/2" => "B",
            _ => "C",
        };

        return (normalised, category, null);
    }

    /// <summary>
    /// Tarif Efektif Rata-rata bulanan, from the Lampiran to PP 58/2023.
    /// Above the final bracket in every category the rate is 34%.
    /// </summary>
    public static decimal TerRate(string category, decimal grossMonthly)
    {
        var table = category switch
        {
            "B" => TerB,
            "C" => TerC,
            _ => TerA,
        };

        foreach (var (upperBound, rate) in table)
        {
            if (grossMonthly <= upperBound) return rate;
        }

        return 34m;
    }

    private static decimal Percent(decimal amount, decimal rate) =>
        Math.Round(amount * rate / 100m, 0, MidpointRounding.ToEven);


    /// <summary>
    /// Each row is the inclusive upper bound of the bracket and its rate.
    /// The regulation states the lower bound as the previous bound plus one
    /// rupiah, so the bounds alone describe the table without ambiguity.
    /// </summary>
    private static readonly (decimal UpperBound, decimal Rate)[] TerA =
    {
        (5_400_000m, 0m),      (5_650_000m, 0.25m),   (5_950_000m, 0.50m),
        (6_300_000m, 0.75m),   (6_750_000m, 1.00m),   (7_500_000m, 1.25m),
        (8_550_000m, 1.50m),   (9_650_000m, 1.75m),   (10_050_000m, 2.00m),
        (10_350_000m, 2.25m),  (10_700_000m, 2.50m),  (11_050_000m, 3.00m),
        (11_600_000m, 3.50m),  (12_500_000m, 4.00m),  (13_750_000m, 5.00m),
        (15_100_000m, 6.00m),  (16_950_000m, 7.00m),  (19_750_000m, 8.00m),
        (24_150_000m, 9.00m),  (26_450_000m, 10.00m), (28_000_000m, 11.00m),
        (30_050_000m, 12.00m), (32_400_000m, 13.00m), (35_400_000m, 14.00m),
        (39_100_000m, 15.00m), (43_850_000m, 16.00m), (47_800_000m, 17.00m),
        (51_400_000m, 18.00m), (56_300_000m, 19.00m), (62_200_000m, 20.00m),
        (68_600_000m, 21.00m), (77_500_000m, 22.00m), (89_000_000m, 23.00m),
        (103_000_000m, 24.00m), (125_000_000m, 25.00m), (157_000_000m, 26.00m),
        (206_000_000m, 27.00m), (337_000_000m, 28.00m), (454_000_000m, 29.00m),
        (550_000_000m, 30.00m), (695_000_000m, 31.00m), (910_000_000m, 32.00m),
        (1_400_000_000m, 33.00m),
    };

    private static readonly (decimal UpperBound, decimal Rate)[] TerB =
    {
        (6_200_000m, 0m),      (6_500_000m, 0.25m),   (6_850_000m, 0.50m),
        (7_300_000m, 0.75m),   (9_200_000m, 1.00m),   (10_750_000m, 1.50m),
        (11_250_000m, 2.00m),  (11_600_000m, 2.50m),  (12_600_000m, 3.00m),
        (13_600_000m, 4.00m),  (14_950_000m, 5.00m),  (16_400_000m, 6.00m),
        (18_450_000m, 7.00m),  (21_850_000m, 8.00m),  (26_000_000m, 9.00m),
        (27_700_000m, 10.00m), (29_350_000m, 11.00m), (31_450_000m, 12.00m),
        (33_950_000m, 13.00m), (37_100_000m, 14.00m), (41_100_000m, 15.00m),
        (45_800_000m, 16.00m), (49_500_000m, 17.00m), (53_800_000m, 18.00m),
        (58_500_000m, 19.00m), (64_000_000m, 20.00m), (71_000_000m, 21.00m),
        (80_000_000m, 22.00m), (93_000_000m, 23.00m), (109_000_000m, 24.00m),
        (129_000_000m, 25.00m), (163_000_000m, 26.00m), (211_000_000m, 27.00m),
        (374_000_000m, 28.00m), (459_000_000m, 29.00m), (555_000_000m, 30.00m),
        (704_000_000m, 31.00m), (957_000_000m, 32.00m), (1_405_000_000m, 33.00m),
    };

    private static readonly (decimal UpperBound, decimal Rate)[] TerC =
    {
        (6_600_000m, 0m),      (6_950_000m, 0.25m),   (7_350_000m, 0.50m),
        (7_800_000m, 0.75m),   (8_850_000m, 1.00m),   (9_800_000m, 1.25m),
        (10_950_000m, 1.50m),  (11_200_000m, 1.75m),  (12_050_000m, 2.00m),
        (12_950_000m, 3.00m),  (14_150_000m, 4.00m),  (15_550_000m, 5.00m),
        (17_050_000m, 6.00m),  (19_500_000m, 7.00m),  (22_700_000m, 8.00m),
        (26_600_000m, 9.00m),  (28_100_000m, 10.00m), (30_100_000m, 11.00m),
        (32_600_000m, 12.00m), (35_400_000m, 13.00m), (38_900_000m, 14.00m),
        (43_000_000m, 15.00m), (47_400_000m, 16.00m), (51_200_000m, 17.00m),
        (55_800_000m, 18.00m), (60_400_000m, 19.00m), (66_700_000m, 20.00m),
        (74_500_000m, 21.00m), (83_200_000m, 22.00m), (95_600_000m, 23.00m),
        (110_000_000m, 24.00m), (134_000_000m, 25.00m), (169_000_000m, 26.00m),
        (221_000_000m, 27.00m), (390_000_000m, 28.00m), (463_000_000m, 29.00m),
        (561_000_000m, 30.00m), (709_000_000m, 31.00m), (965_000_000m, 32.00m),
        (1_419_000_000m, 33.00m),
    };
}

public sealed record PayrollInput(
    decimal BaseSalary,
    decimal FixedAllowance,
    decimal OtherEarnings,
    string? PtkpStatus,
    decimal JkkRate,
    bool BpjsKetenagakerjaan,
    bool BpjsPension,
    bool BpjsKesehatan);

/// <summary>Posted payroll for the employee earlier in the same calendar year.</summary>
public sealed record PayrollYearToDate(
    int MonthsPaid,
    decimal TaxableGross,
    decimal EmployeePension,
    decimal Pph21Withheld)
{
    public static readonly PayrollYearToDate None = new(0, 0m, 0m, 0m);
}

/// <summary>
/// Wage caps change every year (JP each March by regulation, Kesehatan by
/// Perpres), so they come from configuration rather than code.
/// </summary>
public sealed record PayrollRates(decimal KesehatanWageCap, decimal JpWageCap)
{
    public static PayrollRates From(IConfiguration configuration) => new(
        configuration.GetValue("Payroll:KesehatanWageCap", 12_000_000m),
        configuration.GetValue("Payroll:JpWageCap", 10_547_400m));
}

public sealed class PayrollResult
{
    public string PtkpStatus { get; set; } = "TK/0";
    public string TerCategory { get; set; } = "A";
    public string? Warning { get; set; }

    public decimal EmployerJkk { get; set; }
    public decimal EmployerJkm { get; set; }
    public decimal EmployerJht { get; set; }
    public decimal EmployerJp { get; set; }
    public decimal EmployerKesehatan { get; set; }
    public decimal EmployeeJht { get; set; }
    public decimal EmployeeJp { get; set; }
    public decimal EmployeeKesehatan { get; set; }

    public decimal TaxableGross { get; set; }
    public decimal? TerRate { get; set; }
    public string Pph21Method { get; set; } = "TER";
    public decimal Pph21 { get; set; }
    public decimal NetPay { get; set; }

    public decimal EmployerBpjs => EmployerJkk + EmployerJkm + EmployerJht + EmployerJp + EmployerKesehatan;
    public decimal EmployeeBpjs => EmployeeJht + EmployeeJp + EmployeeKesehatan;
}
