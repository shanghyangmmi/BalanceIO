using BalanceIO.API.Data;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Optional untracked overrides for local work. Gitignored, so a developer
// can hold a real SMTP password without it ever reaching a commit.
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

// Secrets come from the environment, never from a tracked file. In
// Production this throws before the app is built if the JWT signing key
// or the database credentials are missing or still set to a value that
// was committed to this repository.
BalanceIO.API.Security.SecretsBootstrap.Apply(builder);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.CustomSchemaIds(type => type.FullName?.Replace("+", "."));
});
builder.Services.AddHttpContextAccessor();

// Performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
});
builder.Services.AddMemoryCache();

// Database Context
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    if (builder.Environment.IsProduction())
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }
    options.ConfigureWarnings(warnings =>
        warnings.Ignore(new Microsoft.Extensions.Logging.EventId(10622)));
});

// HTTP Client for external APIs
builder.Services.AddHttpClient<IExchangeRateService, ExchangeRateService>();

// Register services
builder.Services.AddScoped<IExchangeRateService, ExchangeRateService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IPeriodLockService, PeriodLockService>();
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<BlobStorageService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<ModuleHealthService>();
builder.Services.AddScoped<ModuleEntitlementService>();
builder.Services.AddScoped<PlanLimitService>();
builder.Services.AddScoped<DatabaseBackupService>();
builder.Services.AddScoped<AdminQueryService>();

// Singleton: CPU is a ratio between two samples, so the previous sample is
// the whole value of the object. A scoped instance would take its first
// sample on every request and never have a second one.
builder.Services.AddSingleton<ServerMetricsService>();
builder.Services.AddSingleton<ScheduledJobRunner>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<ScheduledJobRunner>());
builder.Services.AddScoped<TaxEqualisationService>();
builder.Services.AddScoped<AssetChargeService>();
builder.Services.AddScoped<TaxAnalysisService>();
builder.Services.AddScoped<TaxReportsService>();
builder.Services.AddScoped<BankReconciliationService>();
builder.Services.AddScoped<BudgetingService>();
builder.Services.AddScoped<E2EAccountingValidationService>();

// Security: Argon2id Password Hasher
builder.Services.AddSingleton<Argon2PasswordHasher>();

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
    };
});

// Dynamic CORS based on Configuration
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp",
        policy => policy
            .WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials());
});

builder.Services.AddControllers();

var app = builder.Build();

// Say plainly which features are degraded for want of a secret. These do
// not block startup - taking the ledger down because email is
// unconfigured would be the wrong trade - but they must not be silent.
foreach (var (feature, variable) in
         BalanceIO.API.Security.SecretsBootstrap.MissingOptionalSecrets(app.Configuration))
{
    app.Logger.LogWarning(
        "{Feature} is disabled: {Variable} is not set.", feature, variable);
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseResponseCompression();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

    // Global Exception Handler for JSON
    app.Use(async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (Exception ex)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = 500;
            var error = new { message = ex.Message, detail = ex.ToString() };
            await context.Response.WriteAsJsonAsync(error);
        }
    });

app.UseHttpsRedirection();

// First in the pipeline: a request refused by authentication or by the
// plan quota still cost the server something, and load is load.
app.UseMiddleware<BalanceIO.API.Middleware.RequestMetricsMiddleware>();
app.UseCors("AllowReactApp");
app.UseMiddleware<BalanceIO.API.Middleware.MaintenanceMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
// Order matters. Suspension runs before the tenant scope is established so
// a suspended account never reaches a query filter at all, and the plan
// limit wraps everything downstream because the quota is enforced inside
// SaveChangesAsync, far below any controller.
app.UseMiddleware<BalanceIO.API.Middleware.SuspensionMiddleware>();
app.UseMiddleware<BalanceIO.API.Middleware.PlanLimitMiddleware>();
app.UseMiddleware<BalanceIO.API.Middleware.CompanyScopeMiddleware>();

app.MapControllers();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.MapGet("/api/health", async (ApplicationDbContext db) => 
{
    try 
    {
        await db.Database.CanConnectAsync();
        return Results.Ok(new { status = "Healthy", database = "Connected" });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "Unhealthy", error = ex.Message }, statusCode: 500);
    }
});

// ── SQLite schema introspection ───────────────────────────────────────
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so the startup patcher used
// to fire every ALTER blindly and swallow the resulting exception. That
// worked, but it logged a wall of `fail:` lines on every boot after the
// first, and — far worse — an empty `catch` cannot tell "column already
// exists" apart from a genuine failure (locked file, renamed table,
// typo in the DDL). Probing first means every exception that still
// escapes is real and gets logged as such.

static bool SqliteTableExists(ApplicationDbContext ctx, string table)
{
    var conn = ctx.Database.GetDbConnection();
    var mustOpen = conn.State != System.Data.ConnectionState.Open;
    if (mustOpen) conn.Open();
    try
    {
        using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $name;";
        var p = cmd.CreateParameter();
        p.ParameterName = "$name";
        p.Value = table;
        cmd.Parameters.Add(p);
        return Convert.ToInt64(cmd.ExecuteScalar()) > 0;
    }
    finally { if (mustOpen) conn.Close(); }
}

static bool SqliteColumnExists(ApplicationDbContext ctx, string table, string column)
{
    var conn = ctx.Database.GetDbConnection();
    var mustOpen = conn.State != System.Data.ConnectionState.Open;
    if (mustOpen) conn.Open();
    try
    {
        using var cmd = conn.CreateCommand();
        // PRAGMA arguments cannot be parameterised; the table name here is
        // a compile-time constant from the patch list, never user input.
        cmd.CommandText = $"PRAGMA table_info(\"{table}\");";
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            // table_info columns: cid, name, type, notnull, dflt_value, pk
            if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
    finally { if (mustOpen) conn.Close(); }
}

// Auto-migrate Database in Production
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        if (app.Environment.IsProduction())
        {
             logger.LogInformation("Applying migrations to PostgreSQL database...");
             try 
             {
                 context.Database.Migrate();
                 logger.LogInformation("Migrations applied successfully.");
             }
             catch (Exception ex)
             {
                 logger.LogError($"Migration Failed: {ex.Message}. Proceeding to Manual Patch...");
             }
        }
        else
        {
             try
             {
                 context.Database.EnsureCreated();
             }
             catch (Exception ex)
             {
                 // Swallowing this silently meant a broken dev database
                 // surfaced later as confusing "no such table" errors.
                 logger.LogWarning(ex, "EnsureCreated failed; schema patches may not apply cleanly.");
             }
        }

        // Schema Patches (runs in all environments)
        try {
            if (context.Database.IsSqlite())
            {
                // Idempotent on its own — SQLite does support IF NOT EXISTS
                // for CREATE TABLE.
                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""Projects"" (""Id"" TEXT NOT NULL, ""Name"" TEXT NOT NULL, ""Code"" TEXT, ""Description"" TEXT, ""Status"" INTEGER NOT NULL DEFAULT 0, ""CreatedAt"" TEXT NOT NULL, ""UpdatedAt"" TEXT, CONSTRAINT ""PK_Projects"" PRIMARY KEY (""Id""));");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""InventoryMovements"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT NOT NULL,
                        ""ProductId"" TEXT NOT NULL,
                        ""MovementDate"" TEXT NOT NULL,
                        ""Type"" INTEGER NOT NULL,
                        ""Quantity"" TEXT NOT NULL DEFAULT '0',
                        ""UnitCost"" TEXT NOT NULL DEFAULT '0',
                        ""TotalCost"" TEXT NOT NULL DEFAULT '0',
                        ""ReferenceNumber"" TEXT,
                        ""JournalEntryId"" TEXT,
                        ""Notes"" TEXT,
                        ""CreatedAt"" TEXT NOT NULL,
                        CONSTRAINT ""PK_InventoryMovements"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""TaxRates"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT,
                        ""Name"" TEXT NOT NULL,
                        ""Rate"" TEXT NOT NULL DEFAULT '12.00',
                        ""DppScheme"" INTEGER NOT NULL DEFAULT 0,
                        ""EffectiveFrom"" TEXT NOT NULL,
                        ""EffectiveTo"" TEXT,
                        ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                        ""IsSystemDefault"" INTEGER NOT NULL DEFAULT 1,
                        ""CreatedAt"" TEXT NOT NULL,
                        CONSTRAINT ""PK_TaxRates"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""ImportBatches"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT NOT NULL,
                        ""BatchNumber"" TEXT NOT NULL,
                        ""Type"" INTEGER NOT NULL,
                        ""FileName"" TEXT,
                        ""ConversionDate"" TEXT NOT NULL,
                        ""TotalRecords"" INTEGER NOT NULL DEFAULT 0,
                        ""SuccessfulRecords"" INTEGER NOT NULL DEFAULT 0,
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""SummaryJson"" TEXT,
                        ""CreatedBy"" TEXT,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""ReversedAt"" TEXT,
                        ""ReversedBy"" TEXT,
                        CONSTRAINT ""PK_ImportBatches"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""BankStatements"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT NOT NULL,
                        ""AccountId"" TEXT NOT NULL,
                        ""StatementDate"" TEXT NOT NULL,
                        ""PeriodStart"" TEXT NOT NULL,
                        ""PeriodEnd"" TEXT NOT NULL,
                        ""OpeningBalance"" TEXT NOT NULL DEFAULT '0',
                        ""ClosingBalance"" TEXT NOT NULL DEFAULT '0',
                        ""Format"" INTEGER NOT NULL DEFAULT 1,
                        ""FileName"" TEXT,
                        ""Checksum"" TEXT,
                        ""TotalLines"" INTEGER NOT NULL DEFAULT 0,
                        ""TotalDebits"" TEXT NOT NULL DEFAULT '0',
                        ""TotalCredits"" TEXT NOT NULL DEFAULT '0',
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""ReconciledAt"" TEXT,
                        CONSTRAINT ""PK_BankStatements"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""BankStatementLines"" (
                        ""Id"" TEXT NOT NULL,
                        ""BankStatementId"" TEXT NOT NULL,
                        ""TransactionDate"" TEXT NOT NULL,
                        ""ValueDate"" TEXT,
                        ""Description"" TEXT NOT NULL,
                        ""ReferenceNumber"" TEXT,
                        ""Debit"" TEXT NOT NULL DEFAULT '0',
                        ""Credit"" TEXT NOT NULL DEFAULT '0',
                        ""Amount"" TEXT NOT NULL DEFAULT '0',
                        ""RunningBalance"" TEXT NOT NULL DEFAULT '0',
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""MatchedJournalLineId"" TEXT,
                        ""MatchedDocumentType"" TEXT,
                        ""MatchedDocumentId"" TEXT,
                        ""MatchConfidence"" INTEGER NOT NULL DEFAULT 0,
                        ""BankFeeAmount"" TEXT NOT NULL DEFAULT '0',
                        ""CreatedJournalEntryId"" TEXT,
                        ""LineHash"" TEXT,
                        ""CreatedAt"" TEXT NOT NULL,
                        CONSTRAINT ""PK_BankStatementLines"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""BankReconciliationSessions"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT NOT NULL,
                        ""AccountId"" TEXT NOT NULL,
                        ""ReconciliationDate"" TEXT NOT NULL,
                        ""StatementEndingBalance"" TEXT NOT NULL DEFAULT '0',
                        ""LedgerEndingBalance"" TEXT NOT NULL DEFAULT '0',
                        ""OutstandingDeposits"" TEXT NOT NULL DEFAULT '0',
                        ""OutstandingPayments"" TEXT NOT NULL DEFAULT '0',
                        ""UnrecordedBankCredits"" TEXT NOT NULL DEFAULT '0',
                        ""UnrecordedBankDebits"" TEXT NOT NULL DEFAULT '0',
                        ""AdjustedBankBalance"" TEXT NOT NULL DEFAULT '0',
                        ""AdjustedLedgerBalance"" TEXT NOT NULL DEFAULT '0',
                        ""Difference"" TEXT NOT NULL DEFAULT '0',
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""Notes"" TEXT,
                        ""ReconciledBy"" TEXT,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""FinalizedAt"" TEXT,
                        CONSTRAINT ""PK_BankReconciliationSessions"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""EvidenceAttachments"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT NOT NULL,
                        ""EntityType"" TEXT NOT NULL,
                        ""EntityId"" TEXT NOT NULL,
                        ""AttachmentType"" TEXT NOT NULL DEFAULT 'Receipt',
                        ""FileName"" TEXT NOT NULL,
                        ""FileExtension"" TEXT,
                        ""ContentType"" TEXT NOT NULL,
                        ""FileSize"" INTEGER NOT NULL DEFAULT 0,
                        ""FileUrl"" TEXT NOT NULL,
                        ""StoragePath"" TEXT NOT NULL,
                        ""Notes"" TEXT,
                        ""UploadedBy"" TEXT,
                        ""UploadedByUserId"" TEXT,
                        ""UploadedAt"" TEXT NOT NULL,
                        ""IsVerified"" INTEGER NOT NULL DEFAULT 0,
                        ""VerifiedBy"" TEXT,
                        ""VerifiedAt"" TEXT,
                        CONSTRAINT ""PK_EvidenceAttachments"" PRIMARY KEY (""Id"")
                    );");

                // -- Licensing and operations -------------------------
                // The catalogue that makes "which plans include this
                // feature" and "what does this feature cost on its own"
                // answerable, plus the schedule the server runs itself on.
                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""PlatformFeatures"" (
                        ""Key"" TEXT NOT NULL,
                        ""Name"" TEXT NOT NULL,
                        ""Description"" TEXT,
                        ""Module"" TEXT,
                        ""PriceMonthly"" TEXT NOT NULL DEFAULT '0',
                        ""PriceYearly"" TEXT NOT NULL DEFAULT '0',
                        ""IsAddOn"" INTEGER NOT NULL DEFAULT 1,
                        ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                        ""SortOrder"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""UpdatedAt"" TEXT,
                        CONSTRAINT ""PK_PlatformFeatures"" PRIMARY KEY (""Key"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""PlanFeatures"" (
                        ""Id"" TEXT NOT NULL,
                        ""PlanId"" TEXT NOT NULL,
                        ""FeatureKey"" TEXT NOT NULL,
                        ""Included"" INTEGER NOT NULL DEFAULT 1,
                        ""Quota"" INTEGER,
                        CONSTRAINT ""PK_PlanFeatures"" PRIMARY KEY (""Id"")
                    );");
                context.Database.ExecuteSqlRaw(
                    @"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PlanFeatures_PlanId_FeatureKey""
                      ON ""PlanFeatures"" (""PlanId"", ""FeatureKey"");");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""SubscriptionAddOns"" (
                        ""Id"" TEXT NOT NULL,
                        ""SubscriptionId"" TEXT NOT NULL,
                        ""FeatureKey"" TEXT NOT NULL,
                        ""PricePaid"" TEXT NOT NULL DEFAULT '0',
                        ""BillingCycle"" TEXT,
                        ""StartsAt"" TEXT NOT NULL,
                        ""EndsAt"" TEXT,
                        ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                        ""Note"" TEXT,
                        ""CreatedAt"" TEXT NOT NULL,
                        CONSTRAINT ""PK_SubscriptionAddOns"" PRIMARY KEY (""Id"")
                    );");
                context.Database.ExecuteSqlRaw(
                    @"CREATE INDEX IF NOT EXISTS ""IX_SubscriptionAddOns_SubscriptionId_FeatureKey""
                      ON ""SubscriptionAddOns"" (""SubscriptionId"", ""FeatureKey"");");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""ScheduledJobs"" (
                        ""Id"" TEXT NOT NULL,
                        ""JobKey"" TEXT NOT NULL,
                        ""Name"" TEXT NOT NULL,
                        ""Description"" TEXT,
                        ""IntervalMinutes"" INTEGER NOT NULL DEFAULT 1440,
                        ""PreferredMinuteOfDay"" INTEGER,
                        ""IsEnabled"" INTEGER NOT NULL DEFAULT 1,
                        ""LastRunAt"" TEXT,
                        ""NextRunAt"" TEXT,
                        ""LastStatus"" TEXT,
                        ""LastMessage"" TEXT,
                        ""ConsecutiveFailures"" INTEGER NOT NULL DEFAULT 0,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""UpdatedAt"" TEXT,
                        CONSTRAINT ""PK_ScheduledJobs"" PRIMARY KEY (""Id"")
                    );");
                context.Database.ExecuteSqlRaw(
                    @"CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ScheduledJobs_JobKey""
                      ON ""ScheduledJobs"" (""JobKey"");");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""JobRuns"" (
                        ""Id"" TEXT NOT NULL,
                        ""ScheduledJobId"" TEXT NOT NULL,
                        ""JobKey"" TEXT NOT NULL,
                        ""StartedAt"" TEXT NOT NULL,
                        ""FinishedAt"" TEXT,
                        ""Status"" TEXT NOT NULL,
                        ""Message"" TEXT,
                        ""WasManual"" INTEGER NOT NULL DEFAULT 0,
                        ""TriggeredByUserId"" TEXT,
                        ""DurationMs"" INTEGER NOT NULL DEFAULT 0,
                        CONSTRAINT ""PK_JobRuns"" PRIMARY KEY (""Id"")
                    );");
                context.Database.ExecuteSqlRaw(
                    @"CREATE INDEX IF NOT EXISTS ""IX_JobRuns_JobKey_StartedAt""
                      ON ""JobRuns"" (""JobKey"", ""StartedAt"");");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""Budgets"" (
                        ""Id"" TEXT NOT NULL,
                        ""CompanyId"" TEXT NOT NULL,
                        ""Name"" TEXT NOT NULL,
                        ""FiscalYear"" INTEGER NOT NULL,
                        ""PeriodType"" INTEGER NOT NULL DEFAULT 0,
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""ProjectId"" TEXT,
                        ""Notes"" TEXT,
                        ""TotalBudgetAmount"" TEXT NOT NULL DEFAULT '0',
                        ""CreatedBy"" TEXT,
                        ""CreatedByUserId"" TEXT,
                        ""CreatedAt"" TEXT NOT NULL,
                        ""ApprovedBy"" TEXT,
                        ""ApprovedByUserId"" TEXT,
                        ""ApprovedAt"" TEXT,
                        CONSTRAINT ""PK_Budgets"" PRIMARY KEY (""Id"")
                    );");

                context.Database.ExecuteSqlRaw(
                    @"CREATE TABLE IF NOT EXISTS ""BudgetLines"" (
                        ""Id"" TEXT NOT NULL,
                        ""BudgetId"" TEXT NOT NULL,
                        ""AccountId"" TEXT NOT NULL,
                        ""Month"" INTEGER NOT NULL DEFAULT 1,
                        ""Quarter"" INTEGER,
                        ""Amount"" TEXT NOT NULL DEFAULT '0',
                        ""WarningThresholdPercentage"" TEXT NOT NULL DEFAULT '80',
                        ""CriticalThresholdPercentage"" TEXT NOT NULL DEFAULT '100',
                        ""Notes"" TEXT,
                        CONSTRAINT ""PK_BudgetLines"" PRIMARY KEY (""Id"")
                    );");

                var columnPatches = new[]
                {
                    (Table: "SalesInvoices",  Column: "ProjectId",        Ddl: @"ALTER TABLE ""SalesInvoices"" ADD COLUMN ""ProjectId"" TEXT;"),
                    (Table: "JournalEntries", Column: "ProjectId",        Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""ProjectId"" TEXT;"),
                    (Table: "Companies",      Column: "LockDate",         Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""LockDate"" TEXT;"),
                    (Table: "JournalEntries", Column: "IsAdjustingEntry", Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""IsAdjustingEntry"" INTEGER DEFAULT 0;"),
                    // Without this, POST /api/JournalEntries fails outright
                    // on any pre-existing dev database: the model has the
                    // column, the table does not, so both the idempotency
                    // lookup and the INSERT hit "no such column".
                    (Table: "JournalEntries", Column: "IdempotencyKey",   Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""IdempotencyKey"" TEXT;"),
                    // Which module doors a plan opens. Null on an existing
                    // row resolves to the core set, so adding the column
                    // never silently widens anybody's access.
                    (Table: "Plans",          Column: "Modules",          Ddl: @"ALTER TABLE ""Plans"" ADD COLUMN ""Modules"" TEXT;"),
                    // Intangibles amortise rather than depreciate. Existing
                    // categories default to tangible, which is what they were.
                    (Table: "FixedAssetCategories", Column: "IsIntangible", Ddl: @"ALTER TABLE ""FixedAssetCategories"" ADD COLUMN ""IsIntangible"" INTEGER NOT NULL DEFAULT 0;"),
                    // Tax classification lives on the account so it is
                    // recorded once and read by every tax report.
                    (Table: "Accounts", Column: "IsInterestBearingDebt", Ddl: @"ALTER TABLE ""Accounts"" ADD COLUMN ""IsInterestBearingDebt"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Accounts", Column: "FiscalCorrection",      Ddl: @"ALTER TABLE ""Accounts"" ADD COLUMN ""FiscalCorrection"" TEXT;"),
                    // Multi-tenant audit trail. Null on system events (e.g. login);
                    // scoped to CompanyId on operational mutations.
                    (Table: "AuditLogs", Column: "CompanyId",            Ddl: @"ALTER TABLE ""AuditLogs"" ADD COLUMN ""CompanyId"" TEXT;"),
                    // D3: PPN 12% with DPP Nilai Lain & PPnBM support
                    (Table: "Products",          Column: "DppScheme",    Ddl: @"ALTER TABLE ""Products"" ADD COLUMN ""DppScheme"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Products",          Column: "IsLuxuryGood", Ddl: @"ALTER TABLE ""Products"" ADD COLUMN ""IsLuxuryGood"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Products",          Column: "PPnBMRate",    Ddl: @"ALTER TABLE ""Products"" ADD COLUMN ""PPnBMRate"" TEXT NOT NULL DEFAULT '0';"),
                    (Table: "SalesInvoiceLines", Column: "DppScheme",    Ddl: @"ALTER TABLE ""SalesInvoiceLines"" ADD COLUMN ""DppScheme"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "SalesInvoiceLines", Column: "DppAmount",    Ddl: @"ALTER TABLE ""SalesInvoiceLines"" ADD COLUMN ""DppAmount"" TEXT NOT NULL DEFAULT '0';"),
                    (Table: "SalesInvoiceLines", Column: "PPnBMAmount",  Ddl: @"ALTER TABLE ""SalesInvoiceLines"" ADD COLUMN ""PPnBMAmount"" TEXT NOT NULL DEFAULT '0';"),
                    (Table: "PurchaseBillLines", Column: "DppScheme",    Ddl: @"ALTER TABLE ""PurchaseBillLines"" ADD COLUMN ""DppScheme"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "PurchaseBillLines", Column: "DppAmount",    Ddl: @"ALTER TABLE ""PurchaseBillLines"" ADD COLUMN ""DppAmount"" TEXT NOT NULL DEFAULT '0';"),
                    (Table: "PurchaseBillLines", Column: "PPnBMAmount",  Ddl: @"ALTER TABLE ""PurchaseBillLines"" ADD COLUMN ""PPnBMAmount"" TEXT NOT NULL DEFAULT '0';"),
                    // Item 1: Payments & Receipts multi-tenant CompanyId
                    (Table: "ReceiptVouchers",   Column: "CompanyId",    Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""CompanyId"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "CompanyId",    Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""CompanyId"" TEXT;"),
                    // Item 2: Contact roles & attributes
                    (Table: "Contacts",          Column: "IsCustomer",   Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""IsCustomer"" INTEGER NOT NULL DEFAULT 1;"),
                    (Table: "Contacts",          Column: "IsVendor",     Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""IsVendor"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Contacts",          Column: "IsEmployee",   Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""IsEmployee"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Contacts",          Column: "IsTaxParty",   Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""IsTaxParty"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Contacts",          Column: "Nik",          Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""Nik"" TEXT;"),
                    (Table: "Contacts",          Column: "PtkpStatus",   Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""PtkpStatus"" TEXT;"),
                    (Table: "Contacts",          Column: "BpjsKetenagakerjaanNumber", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""BpjsKetenagakerjaanNumber"" TEXT;"),
                    (Table: "Contacts",          Column: "BpjsKesehatanNumber", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""BpjsKesehatanNumber"" TEXT;"),
                    (Table: "Contacts",          Column: "BankName",     Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""BankName"" TEXT;"),
                    (Table: "Contacts",          Column: "BankAccountNumber", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""BankAccountNumber"" TEXT;"),
                    (Table: "Contacts",          Column: "BankAccountHolder", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""BankAccountHolder"" TEXT;"),
                    (Table: "Contacts",          Column: "WithholdingType", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""WithholdingType"" TEXT;"),
                    (Table: "Contacts",          Column: "WithholdingRate", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""WithholdingRate"" TEXT NOT NULL DEFAULT '0';"),
                    (Table: "Contacts",          Column: "HasWithholdingExemption", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""HasWithholdingExemption"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Contacts",          Column: "ExemptionExpiryDate", Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""ExemptionExpiryDate"" TEXT;"),
                    (Table: "Contacts",          Column: "IsPkp",        Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""IsPkp"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Contacts",          Column: "PkpDate",      Ddl: @"ALTER TABLE ""Contacts"" ADD COLUMN ""PkpDate"" TEXT;"),
                    // Item 4: Kurs BI & Kurs Pajak (KMK) statutory provenance
                    (Table: "ExchangeRates",     Column: "RateType",     Ddl: @"ALTER TABLE ""ExchangeRates"" ADD COLUMN ""RateType"" INTEGER NOT NULL DEFAULT 1;"),
                    (Table: "ExchangeRates",     Column: "KmkNumber",    Ddl: @"ALTER TABLE ""ExchangeRates"" ADD COLUMN ""KmkNumber"" TEXT;"),
                    (Table: "ExchangeRates",     Column: "ValidFrom",    Ddl: @"ALTER TABLE ""ExchangeRates"" ADD COLUMN ""ValidFrom"" TEXT;"),
                    (Table: "ExchangeRates",     Column: "ValidTo",      Ddl: @"ALTER TABLE ""ExchangeRates"" ADD COLUMN ""ValidTo"" TEXT;"),
                    (Table: "ExchangeRates",     Column: "Provenance",   Ddl: @"ALTER TABLE ""ExchangeRates"" ADD COLUMN ""Provenance"" TEXT;"),
                    (Table: "ExchangeRates",     Column: "IsLockedByPostedEntry", Ddl: @"ALTER TABLE ""ExchangeRates"" ADD COLUMN ""IsLockedByPostedEntry"" INTEGER NOT NULL DEFAULT 0;"),
                    // Item 6: Company PKP and Tax Office settings
                    (Table: "Companies",         Column: "IsPkp",        Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""IsPkp"" INTEGER NOT NULL DEFAULT 1;"),
                    (Table: "Companies",         Column: "PkpNumber",    Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""PkpNumber"" TEXT;"),
                    (Table: "Companies",         Column: "PkpDate",      Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""PkpDate"" TEXT;"),
                    (Table: "Companies",         Column: "TaxOffice",    Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""TaxOffice"" TEXT;"),
                    // Item 8: Segregation of Duties (SoD) Internal Controls
                    (Table: "Companies",         Column: "EnforceSegregationOfDuties", Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""EnforceSegregationOfDuties"" INTEGER NOT NULL DEFAULT 1;"),
                    (Table: "Companies",         Column: "ApprovalThresholdAmount",    Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""ApprovalThresholdAmount"" TEXT;"),
                    (Table: "JournalEntries",    Column: "CreatedByUserId",  Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""CreatedByUserId"" TEXT;"),
                    (Table: "JournalEntries",    Column: "CreatedBy",        Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""CreatedBy"" TEXT;"),
                    (Table: "JournalEntries",    Column: "ApprovedByUserId", Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""ApprovedByUserId"" TEXT;"),
                    (Table: "JournalEntries",    Column: "ApprovedBy",       Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""ApprovedBy"" TEXT;"),
                    (Table: "JournalEntries",    Column: "ApprovedAt",       Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""ApprovedAt"" TEXT;"),
                    (Table: "JournalEntries",    Column: "RejectionReason",  Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""RejectionReason"" TEXT;"),
                    (Table: "JournalEntries",    Column: "RejectedBy",       Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""RejectedBy"" TEXT;"),
                    (Table: "JournalEntries",    Column: "RejectedAt",       Ddl: @"ALTER TABLE ""JournalEntries"" ADD COLUMN ""RejectedAt"" TEXT;"),
                    (Table: "PurchaseBills",     Column: "CreatedByUserId",  Ddl: @"ALTER TABLE ""PurchaseBills"" ADD COLUMN ""CreatedByUserId"" TEXT;"),
                    (Table: "PurchaseBills",     Column: "CreatedBy",        Ddl: @"ALTER TABLE ""PurchaseBills"" ADD COLUMN ""CreatedBy"" TEXT;"),
                    (Table: "PurchaseBills",     Column: "ApprovedByUserId", Ddl: @"ALTER TABLE ""PurchaseBills"" ADD COLUMN ""ApprovedByUserId"" TEXT;"),
                    (Table: "PurchaseBills",     Column: "ApprovedBy",       Ddl: @"ALTER TABLE ""PurchaseBills"" ADD COLUMN ""ApprovedBy"" TEXT;"),
                    (Table: "PurchaseBills",     Column: "ApprovedAt",       Ddl: @"ALTER TABLE ""PurchaseBills"" ADD COLUMN ""ApprovedAt"" TEXT;"),
                    (Table: "PurchaseBills",     Column: "RejectionReason",  Ddl: @"ALTER TABLE ""PurchaseBills"" ADD COLUMN ""RejectionReason"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "CreatedByUserId",  Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""CreatedByUserId"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "CreatedBy",        Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""CreatedBy"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "ApprovedByUserId", Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""ApprovedByUserId"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "ApprovedBy",       Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""ApprovedBy"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "ApprovedAt",       Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""ApprovedAt"" TEXT;"),
                    (Table: "PaymentVouchers",   Column: "RejectionReason",  Ddl: @"ALTER TABLE ""PaymentVouchers"" ADD COLUMN ""RejectionReason"" TEXT;"),
                    (Table: "ReceiptVouchers",   Column: "CreatedByUserId",  Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""CreatedByUserId"" TEXT;"),
                    (Table: "ReceiptVouchers",   Column: "CreatedBy",        Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""CreatedBy"" TEXT;"),
                    (Table: "ReceiptVouchers",   Column: "ApprovedByUserId", Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""ApprovedByUserId"" TEXT;"),
                    (Table: "ReceiptVouchers",   Column: "ApprovedBy",       Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""ApprovedBy"" TEXT;"),
                    (Table: "ReceiptVouchers",   Column: "ApprovedAt",       Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""ApprovedAt"" TEXT;"),
                    (Table: "ReceiptVouchers",   Column: "RejectionReason",  Ddl: @"ALTER TABLE ""ReceiptVouchers"" ADD COLUMN ""RejectionReason"" TEXT;"),
                    // Suspension. Nothing is deleted: the books have to
                    // survive a billing dispute, and a removed user would
                    // leave journal entries pointing at nobody.
                    (Table: "Users",     Column: "IsSuspended",      Ddl: @"ALTER TABLE ""Users"" ADD COLUMN ""IsSuspended"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Users",     Column: "SuspendedAt",      Ddl: @"ALTER TABLE ""Users"" ADD COLUMN ""SuspendedAt"" TEXT;"),
                    (Table: "Users",     Column: "SuspensionReason", Ddl: @"ALTER TABLE ""Users"" ADD COLUMN ""SuspensionReason"" TEXT;"),
                    (Table: "Companies", Column: "IsSuspended",      Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""IsSuspended"" INTEGER NOT NULL DEFAULT 0;"),
                    (Table: "Companies", Column: "SuspendedAt",      Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""SuspendedAt"" TEXT;"),
                    (Table: "Companies", Column: "SuspensionReason", Ddl: @"ALTER TABLE ""Companies"" ADD COLUMN ""SuspensionReason"" TEXT;"),
                };

                var applied = 0;
                foreach (var (table, column, ddl) in columnPatches)
                {
                    if (!SqliteTableExists(context, table))
                    {
                        logger.LogWarning(
                            "Schema patch skipped: table {Table} does not exist.", table);
                        continue;
                    }
                    if (SqliteColumnExists(context, table, column)) continue;

                    try
                    {
                        context.Database.ExecuteSqlRaw(ddl);
                        applied++;
                        logger.LogInformation(
                            "Schema patch applied: added {Table}.{Column}.", table, column);
                    }
                    catch (Exception ex)
                    {
                        // Reaching here now means something genuinely went
                        // wrong, so it is an error rather than routine noise.
                        logger.LogError(ex,
                            "Schema patch FAILED: {Table}.{Column}.", table, column);
                    }
                }

                logger.LogInformation(
                    applied == 0
                        ? "Database schema already up to date."
                        : $"Database schema patched: {applied} column(s) added.");

                // ── One-time entitlement backfill ─────────────────────
                // Plans created before the Modules column exist with it
                // NULL, and the entitlement service reads NULL as "core
                // only". Left alone, deploying this would quietly take Tax,
                // Inventory and Fixed Assets away from customers who are
                // already paying for them.
                //
                // So: rows that predate the column are opened to everything
                // that is built, once. The strict reading still governs
                // every plan written from here on - this is a migration,
                // not the rule.
                if (SqliteColumnExists(context, "Accounts", "IsInterestBearingDebt"))
                {
                    // Only the borrowing accounts this product seeds itself,
                    // and only where nothing has been marked yet. A company
                    // that has classified its own chart is left alone.
                    var anyMarked = Convert.ToInt64(context.Database
                        .SqlQueryRaw<long>(@"SELECT COUNT(*) AS ""Value"" FROM ""Accounts"" WHERE ""IsInterestBearingDebt"" = 1")
                        .AsEnumerable().FirstOrDefault());

                    if (anyMarked == 0)
                    {
                        var marked = context.Database.ExecuteSqlRaw(
                            @"UPDATE ""Accounts"" SET ""IsInterestBearingDebt"" = 1
                              WHERE ""Type"" = 'Liability' AND ""Code"" IN ('2-2100','2-2200');");
                        if (marked > 0)
                        {
                            logger.LogInformation(
                                "Marked {Count} seeded borrowing account(s) as interest-bearing debt.", marked);
                        }
                    }
                }

                if (SqliteColumnExists(context, "Plans", "Modules"))
                {
                    var backfilled = context.Database.ExecuteSqlRaw(
                        @"UPDATE ""Plans"" SET ""Modules"" = '[""accounting"",""tax"",""inventory"",""fixedAssets""]' WHERE ""Modules"" IS NULL;");
                    if (backfilled > 0)
                    {
                        logger.LogInformation(
                            "Entitlement backfill: {Count} pre-existing plan(s) opened to every built module.",
                            backfilled);
                    }
                }

                if (SqliteColumnExists(context, "AuditLogs", "CompanyId"))
                {
                    // Backfill CompanyId for existing audit log rows where UserId belongs to exactly one company.
                    // Rows that cannot be attributed stay null - never guessed.
                    var backfilledLogs = context.Database.ExecuteSqlRaw(@"
                        UPDATE ""AuditLogs""
                        SET ""CompanyId"" = (
                            SELECT uc.""CompanyId""
                            FROM ""UserCompanies"" uc
                            WHERE uc.""UserId"" = ""AuditLogs"".""UserId""
                        )
                        WHERE ""CompanyId"" IS NULL
                          AND ""UserId"" IS NOT NULL
                          AND (
                              SELECT COUNT(*)
                              FROM ""UserCompanies"" uc
                              WHERE uc.""UserId"" = ""AuditLogs"".""UserId""
                          ) = 1;");
                    if (backfilledLogs > 0)
                    {
                        logger.LogInformation(
                            "Audit log backfill: {Count} log entry/entries attributed to company.",
                            backfilledLogs);
                    }
                }

                if (SqliteColumnExists(context, "Contacts", "IsCustomer"))
                {
                    context.Database.ExecuteSqlRaw(@"
                        UPDATE ""Contacts"" SET ""IsCustomer"" = 1 WHERE ""Type"" IN (0, 2) AND ""IsCustomer"" = 0;
                        UPDATE ""Contacts"" SET ""IsVendor"" = 1 WHERE ""Type"" IN (1, 2) AND ""IsVendor"" = 0;
                        UPDATE ""Contacts"" SET ""IsTaxParty"" = 1 WHERE ""TaxId"" IS NOT NULL AND ""TaxId"" != '' AND ""IsTaxParty"" = 0;
                    ");
                }

                // ── Seed 5-9000 Inventory Variance for existing companies ──────────
                if (SqliteTableExists(context, "Accounts"))
                {
                    context.Database.ExecuteSqlRaw(@"
                        INSERT INTO ""Accounts"" (""Id"", ""CompanyId"", ""Code"", ""Name"", ""Type"", ""AccountGroup"", ""Level"", ""IsHeader"", ""NormalBalance"", ""CurrentBalance"", ""Description"", ""IsSystemDefault"", ""IsActive"", ""CreatedAt"")
                        SELECT hex(randomblob(16)), c.""Id"", '5-9000', 'Inventory Variance', 'Expense', 'CostOfSales', 2, 0, 'Debit', '0', 'Selisih Persediaan', 1, 1, datetime('now')
                        FROM ""Companies"" c
                        WHERE NOT EXISTS (
                            SELECT 1 FROM ""Accounts"" a WHERE a.""CompanyId"" = c.""Id"" AND a.""Code"" = '5-9000'
                        );");
                }

                // ── Seed standard TaxRates (UU HPP 11% & PMK 131/2024 12%) ──────────
                if (SqliteTableExists(context, "TaxRates"))
                {
                    context.Database.ExecuteSqlRaw(@"
                        INSERT INTO ""TaxRates"" (""Id"", ""CompanyId"", ""Name"", ""Rate"", ""DppScheme"", ""EffectiveFrom"", ""EffectiveTo"", ""IsActive"", ""IsSystemDefault"", ""CreatedAt"")
                        SELECT hex(randomblob(16)), NULL, 'PPN 11% (UU HPP)', '11.00', 1, '2022-04-01', '2024-12-31', 1, 1, datetime('now')
                        WHERE NOT EXISTS (SELECT 1 FROM ""TaxRates"" WHERE ""Name"" = 'PPN 11% (UU HPP)');

                        INSERT INTO ""TaxRates"" (""Id"", ""CompanyId"", ""Name"", ""Rate"", ""DppScheme"", ""EffectiveFrom"", ""EffectiveTo"", ""IsActive"", ""IsSystemDefault"", ""CreatedAt"")
                        SELECT hex(randomblob(16)), NULL, 'PPN 12% (PMK 131/2024)', '12.00', 0, '2025-01-01', NULL, 1, 1, datetime('now')
                        WHERE NOT EXISTS (SELECT 1 FROM ""TaxRates"" WHERE ""Name"" = 'PPN 12% (PMK 131/2024)');

                        INSERT INTO ""TaxRates"" (""Id"", ""CompanyId"", ""Name"", ""Rate"", ""DppScheme"", ""EffectiveFrom"", ""EffectiveTo"", ""IsActive"", ""IsSystemDefault"", ""CreatedAt"")
                        SELECT hex(randomblob(16)), NULL, 'PPN 12% Luxury (Standard DPP)', '12.00', 1, '2025-01-01', NULL, 1, 1, datetime('now')
                        WHERE NOT EXISTS (SELECT 1 FROM ""TaxRates"" WHERE ""Name"" = 'PPN 12% Luxury (Standard DPP)');
                    ");
                }
            }
            else
            {
                var postgresPatches = @"
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailVerificationToken"" text;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""IsEmailVerified"" boolean DEFAULT false;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""TwoFactorEnabled"" boolean DEFAULT false;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""TwoFactorSecret"" text;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PasswordResetToken"" text;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PasswordResetTokenExpiresAt"" timestamp with time zone;
                    CREATE TABLE IF NOT EXISTS ""Projects"" (
                        ""Id"" uuid NOT NULL,
                        ""Name"" character varying(100) NOT NULL,
                        ""Code"" character varying(20),
                        ""Description"" character varying(500),
                        ""Status"" integer NOT NULL DEFAULT 0,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""PK_Projects"" PRIMARY KEY (""Id"")
                    );
                    CREATE TABLE IF NOT EXISTS ""InventoryMovements"" (
                        ""Id"" uuid NOT NULL,
                        ""CompanyId"" uuid NOT NULL,
                        ""ProductId"" uuid NOT NULL,
                        ""MovementDate"" date NOT NULL,
                        ""Type"" integer NOT NULL,
                        ""Quantity"" numeric(19,4) NOT NULL DEFAULT 0,
                        ""UnitCost"" numeric(19,4) NOT NULL DEFAULT 0,
                        ""TotalCost"" numeric(19,4) NOT NULL DEFAULT 0,
                        ""ReferenceNumber"" character varying(100),
                        ""JournalEntryId"" uuid,
                        ""Notes"" character varying(500),
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        CONSTRAINT ""PK_InventoryMovements"" PRIMARY KEY (""Id"")
                    );
                    CREATE TABLE IF NOT EXISTS ""TaxRates"" (
                        ""Id"" uuid NOT NULL,
                        ""CompanyId"" uuid,
                        ""Name"" character varying(100) NOT NULL,
                        ""Rate"" numeric(5,2) NOT NULL DEFAULT 12.00,
                        ""DppScheme"" integer NOT NULL DEFAULT 0,
                        ""EffectiveFrom"" date NOT NULL,
                        ""EffectiveTo"" date,
                        ""IsActive"" boolean NOT NULL DEFAULT true,
                        ""IsSystemDefault"" boolean NOT NULL DEFAULT true,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        CONSTRAINT ""PK_TaxRates"" PRIMARY KEY (""Id"")
                    );
                    CREATE TABLE IF NOT EXISTS ""ImportBatches"" (
                        ""Id"" uuid NOT NULL,
                        ""CompanyId"" uuid NOT NULL,
                        ""BatchNumber"" character varying(50) NOT NULL,
                        ""Type"" integer NOT NULL,
                        ""FileName"" character varying(255),
                        ""ConversionDate"" date NOT NULL,
                        ""TotalRecords"" integer NOT NULL DEFAULT 0,
                        ""SuccessfulRecords"" integer NOT NULL DEFAULT 0,
                        ""Status"" integer NOT NULL DEFAULT 0,
                        ""SummaryJson"" text,
                        ""CreatedBy"" character varying(100),
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT NOW(),
                        ""ReversedAt"" timestamp with time zone,
                        ""ReversedBy"" character varying(100),
                        CONSTRAINT ""PK_ImportBatches"" PRIMARY KEY (""Id"")
                    );
                   ALTER TABLE ""SalesInvoices"" ADD COLUMN IF NOT EXISTS ""ProjectId"" uuid;
                   ALTER TABLE ""JournalEntries"" ADD COLUMN IF NOT EXISTS ""ProjectId"" uuid;
                   ALTER TABLE ""Companies"" ADD COLUMN IF NOT EXISTS ""LockDate"" date;
                   ALTER TABLE ""JournalEntries"" ADD COLUMN IF NOT EXISTS ""IsAdjustingEntry"" boolean DEFAULT false;
                   ALTER TABLE ""JournalEntries"" ADD COLUMN IF NOT EXISTS ""IdempotencyKey"" character varying(100);
                   ALTER TABLE ""Plans"" ADD COLUMN IF NOT EXISTS ""Modules"" text;
                   ALTER TABLE ""FixedAssetCategories"" ADD COLUMN IF NOT EXISTS ""IsIntangible"" boolean NOT NULL DEFAULT false;
                   ALTER TABLE ""Accounts"" ADD COLUMN IF NOT EXISTS ""IsInterestBearingDebt"" boolean NOT NULL DEFAULT false;
                   ALTER TABLE ""Accounts"" ADD COLUMN IF NOT EXISTS ""FiscalCorrection"" character varying(10);
                   ALTER TABLE ""AuditLogs"" ADD COLUMN IF NOT EXISTS ""CompanyId"" uuid;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""IsSuspended"" boolean NOT NULL DEFAULT false;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SuspendedAt"" timestamp with time zone;
                   ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""SuspensionReason"" character varying(300);
                   ALTER TABLE ""Companies"" ADD COLUMN IF NOT EXISTS ""IsSuspended"" boolean NOT NULL DEFAULT false;
                   ALTER TABLE ""Companies"" ADD COLUMN IF NOT EXISTS ""SuspendedAt"" timestamp with time zone;
                   ALTER TABLE ""Companies"" ADD COLUMN IF NOT EXISTS ""SuspensionReason"" character varying(300);

                   CREATE TABLE IF NOT EXISTS ""PlatformFeatures"" (
                        ""Key"" character varying(80) NOT NULL,
                        ""Name"" character varying(120) NOT NULL,
                        ""Description"" character varying(500),
                        ""Module"" character varying(40),
                        ""PriceMonthly"" numeric(19,4) NOT NULL DEFAULT 0,
                        ""PriceYearly"" numeric(19,4) NOT NULL DEFAULT 0,
                        ""IsAddOn"" boolean NOT NULL DEFAULT true,
                        ""IsActive"" boolean NOT NULL DEFAULT true,
                        ""SortOrder"" integer NOT NULL DEFAULT 0,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""PK_PlatformFeatures"" PRIMARY KEY (""Key"")
                   );
                   CREATE TABLE IF NOT EXISTS ""PlanFeatures"" (
                        ""Id"" uuid NOT NULL,
                        ""PlanId"" uuid NOT NULL,
                        ""FeatureKey"" character varying(80) NOT NULL,
                        ""Included"" boolean NOT NULL DEFAULT true,
                        ""Quota"" integer,
                        CONSTRAINT ""PK_PlanFeatures"" PRIMARY KEY (""Id"")
                   );
                   CREATE UNIQUE INDEX IF NOT EXISTS ""IX_PlanFeatures_PlanId_FeatureKey""
                        ON ""PlanFeatures"" (""PlanId"", ""FeatureKey"");
                   CREATE TABLE IF NOT EXISTS ""SubscriptionAddOns"" (
                        ""Id"" uuid NOT NULL,
                        ""SubscriptionId"" uuid NOT NULL,
                        ""FeatureKey"" character varying(80) NOT NULL,
                        ""PricePaid"" numeric(19,4) NOT NULL DEFAULT 0,
                        ""BillingCycle"" character varying(20),
                        ""StartsAt"" timestamp with time zone NOT NULL DEFAULT now(),
                        ""EndsAt"" timestamp with time zone,
                        ""IsActive"" boolean NOT NULL DEFAULT true,
                        ""Note"" character varying(200),
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                        CONSTRAINT ""PK_SubscriptionAddOns"" PRIMARY KEY (""Id"")
                   );
                   CREATE INDEX IF NOT EXISTS ""IX_SubscriptionAddOns_SubscriptionId_FeatureKey""
                        ON ""SubscriptionAddOns"" (""SubscriptionId"", ""FeatureKey"");
                   CREATE TABLE IF NOT EXISTS ""ScheduledJobs"" (
                        ""Id"" uuid NOT NULL,
                        ""JobKey"" character varying(60) NOT NULL,
                        ""Name"" character varying(120) NOT NULL,
                        ""Description"" character varying(400),
                        ""IntervalMinutes"" integer NOT NULL DEFAULT 1440,
                        ""PreferredMinuteOfDay"" integer,
                        ""IsEnabled"" boolean NOT NULL DEFAULT true,
                        ""LastRunAt"" timestamp with time zone,
                        ""NextRunAt"" timestamp with time zone,
                        ""LastStatus"" character varying(20),
                        ""LastMessage"" character varying(1000),
                        ""ConsecutiveFailures"" integer NOT NULL DEFAULT 0,
                        ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                        ""UpdatedAt"" timestamp with time zone,
                        CONSTRAINT ""PK_ScheduledJobs"" PRIMARY KEY (""Id"")
                   );
                   CREATE UNIQUE INDEX IF NOT EXISTS ""IX_ScheduledJobs_JobKey""
                        ON ""ScheduledJobs"" (""JobKey"");
                   CREATE TABLE IF NOT EXISTS ""JobRuns"" (
                        ""Id"" uuid NOT NULL,
                        ""ScheduledJobId"" uuid NOT NULL,
                        ""JobKey"" character varying(60) NOT NULL,
                        ""StartedAt"" timestamp with time zone NOT NULL DEFAULT now(),
                        ""FinishedAt"" timestamp with time zone,
                        ""Status"" character varying(20) NOT NULL DEFAULT 'Running',
                        ""Message"" character varying(2000),
                        ""WasManual"" boolean NOT NULL DEFAULT false,
                        ""TriggeredByUserId"" uuid,
                        ""DurationMs"" bigint NOT NULL DEFAULT 0,
                        CONSTRAINT ""PK_JobRuns"" PRIMARY KEY (""Id"")
                   );
                   CREATE INDEX IF NOT EXISTS ""IX_JobRuns_JobKey_StartedAt""
                        ON ""JobRuns"" (""JobKey"", ""StartedAt"");
                   ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""DppScheme"" integer NOT NULL DEFAULT 0;
                   ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""IsLuxuryGood"" boolean NOT NULL DEFAULT false;
                   ALTER TABLE ""Products"" ADD COLUMN IF NOT EXISTS ""PPnBMRate"" numeric(5,2) NOT NULL DEFAULT 0;
                   ALTER TABLE ""SalesInvoiceLines"" ADD COLUMN IF NOT EXISTS ""DppScheme"" integer NOT NULL DEFAULT 0;
                   ALTER TABLE ""SalesInvoiceLines"" ADD COLUMN IF NOT EXISTS ""DppAmount"" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE ""SalesInvoiceLines"" ADD COLUMN IF NOT EXISTS ""PPnBMAmount"" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE ""PurchaseBillLines"" ADD COLUMN IF NOT EXISTS ""DppScheme"" integer NOT NULL DEFAULT 0;
                   ALTER TABLE ""PurchaseBillLines"" ADD COLUMN IF NOT EXISTS ""DppAmount"" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE ""PurchaseBillLines"" ADD COLUMN IF NOT EXISTS ""PPnBMAmount"" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE ""ReceiptVouchers"" ADD COLUMN IF NOT EXISTS ""CompanyId"" uuid;
                   ALTER TABLE ""PaymentVouchers"" ADD COLUMN IF NOT EXISTS ""CompanyId"" uuid;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""IsCustomer"" boolean NOT NULL DEFAULT true;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""IsVendor"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""IsEmployee"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""IsTaxParty"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""Nik"" character varying(16);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""PtkpStatus"" character varying(10);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""BpjsKetenagakerjaanNumber"" character varying(50);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""BpjsKesehatanNumber"" character varying(50);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""BankName"" character varying(50);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""BankAccountNumber"" character varying(50);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""BankAccountHolder"" character varying(100);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""WithholdingType"" character varying(50);
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""WithholdingRate"" numeric(5,2) NOT NULL DEFAULT 0;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""HasWithholdingExemption"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""ExemptionExpiryDate"" date;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""IsPkp"" boolean NOT NULL DEFAULT false;
                    ALTER TABLE ""Contacts"" ADD COLUMN IF NOT EXISTS ""PkpDate"" date;
                    ALTER TABLE ""ExchangeRates"" ADD COLUMN IF NOT EXISTS ""RateType"" integer NOT NULL DEFAULT 1;
                    ALTER TABLE ""ExchangeRates"" ADD COLUMN IF NOT EXISTS ""KmkNumber"" character varying(100);
                    ALTER TABLE ""ExchangeRates"" ADD COLUMN IF NOT EXISTS ""ValidFrom"" date;
                    ALTER TABLE ""ExchangeRates"" ADD COLUMN IF NOT EXISTS ""ValidTo"" date;
                    ALTER TABLE ""ExchangeRates"" ADD COLUMN IF NOT EXISTS ""Provenance"" character varying(200);
                    ALTER TABLE ""ExchangeRates"" ADD COLUMN IF NOT EXISTS ""IsLockedByPostedEntry"" boolean NOT NULL DEFAULT false;
                    UPDATE ""Contacts"" SET ""IsCustomer"" = true WHERE ""Type"" IN (0, 2) AND ""IsCustomer"" = false;
                    UPDATE ""Contacts"" SET ""IsVendor"" = true WHERE ""Type"" IN (1, 2) AND ""IsVendor"" = false;
                    UPDATE ""Contacts"" SET ""IsTaxParty"" = true WHERE ""TaxId"" IS NOT NULL AND ""TaxId"" != '' AND ""IsTaxParty"" = false;
                   UPDATE ""Plans"" SET ""Modules"" = '[""accounting"",""tax"",""inventory"",""fixedAssets""]' WHERE ""Modules"" IS NULL;
                   UPDATE ""AuditLogs""
                   SET ""CompanyId"" = (
                       SELECT uc.""CompanyId""
                       FROM ""UserCompanies"" uc
                       WHERE uc.""UserId"" = ""AuditLogs"".""UserId""
                   )
                   WHERE ""CompanyId"" IS NULL
                     AND ""UserId"" IS NOT NULL
                      AND (
                          SELECT COUNT(*)
                          FROM ""UserCompanies"" uc
                          WHERE uc.""UserId"" = ""AuditLogs"".""UserId""
                      ) = 1;
                    INSERT INTO ""Accounts"" (""Id"", ""CompanyId"", ""Code"", ""Name"", ""Type"", ""AccountGroup"", ""Level"", ""IsHeader"", ""NormalBalance"", ""CurrentBalance"", ""Description"", ""IsSystemDefault"", ""IsActive"", ""CreatedAt"")
                    SELECT gen_random_uuid(), c.""Id"", '5-9000', 'Inventory Variance', 'Expense', 'CostOfSales', 2, false, 'Debit', 0, 'Selisih Persediaan', true, true, NOW()
                    FROM ""Companies"" c
                    WHERE NOT EXISTS (
                        SELECT 1 FROM ""Accounts"" a WHERE a.""CompanyId"" = c.""Id"" AND a.""Code"" = '5-9000'
                    );

                    INSERT INTO ""TaxRates"" (""Id"", ""CompanyId"", ""Name"", ""Rate"", ""DppScheme"", ""EffectiveFrom"", ""EffectiveTo"", ""IsActive"", ""IsSystemDefault"", ""CreatedAt"")
                    SELECT gen_random_uuid(), NULL, 'PPN 11% (UU HPP)', 11.00, 1, '2022-04-01', '2024-12-31', true, true, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM ""TaxRates"" WHERE ""Name"" = 'PPN 11% (UU HPP)');

                    INSERT INTO ""TaxRates"" (""Id"", ""CompanyId"", ""Name"", ""Rate"", ""DppScheme"", ""EffectiveFrom"", ""EffectiveTo"", ""IsActive"", ""IsSystemDefault"", ""CreatedAt"")
                    SELECT gen_random_uuid(), NULL, 'PPN 12% (PMK 131/2024)', 12.00, 0, '2025-01-01', NULL, true, true, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM ""TaxRates"" WHERE ""Name"" = 'PPN 12% (PMK 131/2024)');

                    INSERT INTO ""TaxRates"" (""Id"", ""CompanyId"", ""Name"", ""Rate"", ""DppScheme"", ""EffectiveFrom"", ""EffectiveTo"", ""IsActive"", ""IsSystemDefault"", ""CreatedAt"")
                    SELECT gen_random_uuid(), NULL, 'PPN 12% Luxury (Standard DPP)', 12.00, 1, '2025-01-01', NULL, true, true, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM ""TaxRates"" WHERE ""Name"" = 'PPN 12% Luxury (Standard DPP)');
                 ";
                // Postgres supports IF NOT EXISTS throughout, so this batch
                // is already idempotent and silent on repeat runs.
                context.Database.ExecuteSqlRaw(postgresPatches);
                logger.LogInformation("Database schema patch batch executed.");
            }
        } catch (Exception ex) {
            logger.LogWarning($"Schema Patch Warning: {ex.Message}");
        }

        // Auto-verify every user. This defeats email verification entirely,
        // so it must never run outside Development — it was previously
        // unguarded and executed on every production boot.
        if (app.Environment.IsDevelopment())
        {
            try {
                context.Database.ExecuteSqlRaw(@"UPDATE ""Users"" SET ""IsEmailVerified"" = true");
            } catch (Exception ex) {
                logger.LogWarning(ex, "Dev auto-verify of users failed.");
            }
        }

        // SEED SUPERADMIN
        var adminEmail = "admin@balanceio.id";
        var hasher = services.GetRequiredService<Argon2PasswordHasher>();
        var defaultPassword = "Admin123!"; // Default Password for First Login

        var adminUser = context.Users.FirstOrDefault(u => u.Email == adminEmail);
        if (adminUser == null)
        {
            var superAdmin = new BalanceIO.API.Models.User
            {
                Name = "Super Admin",
                Email = adminEmail,
                IsAdmin = true,
                IsEmailVerified = true,
                PasswordHash = hasher.HashPassword(defaultPassword) 
            };
            context.Users.Add(superAdmin);
            context.SaveChanges();
            logger.LogInformation("Super Admin User Seeded Successfully.");
        }
        else if (app.Environment.IsDevelopment())
        {
            // Convenience reset for local work only. Unguarded, this reset
            // the production superadmin back to a hard-coded password on
            // every single boot — anyone who read this file owned the
            // account. Creating the admin when absent (above) is safe in
            // any environment; silently resetting an existing one is not.
            adminUser.PasswordHash = hasher.HashPassword(defaultPassword);
            adminUser.IsEmailVerified = true;
            context.SaveChanges();
            logger.LogInformation("Super Admin password reset to default (Development only).");
        }

        // SEED DEMO USER — a known-password account has no business
        // existing in production, so this is Development-only too.
        if (app.Environment.IsDevelopment())
        {
            var demoEmail = "demo@balanceio.id";
            var demoPass = "password123";
            var demoUser = context.Users.FirstOrDefault(u => u.Email == demoEmail);
            if (demoUser == null)
            {
                context.Users.Add(new BalanceIO.API.Models.User
                {
                    Name = "Demo User",
                    Email = demoEmail,
                    IsAdmin = false,
                    IsEmailVerified = true,
                    PasswordHash = hasher.HashPassword(demoPass)
                });
                context.SaveChanges();
                logger.LogInformation("Demo User Seeded Successfully.");
            }
            else
            {
                demoUser.IsEmailVerified = true;
                demoUser.PasswordHash = hasher.HashPassword(demoPass);
                context.SaveChanges();
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "An error occurred while initializing the database (Migration/Seeding).");
    }
}

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
