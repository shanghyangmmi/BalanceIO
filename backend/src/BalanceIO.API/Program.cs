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
builder.Services.AddScoped<FiscalDepreciationService>();
builder.Services.AddScoped<TaxAnalysisService>();
builder.Services.AddScoped<TaxReportsService>();
builder.Services.AddScoped<PayrollService>();
builder.Services.AddScoped<FinancialStatementsService>();
builder.Services.AddScoped<InventoryLedger>();

// Payment gateways. Each implements IPaymentGateway; Payments:Provider picks
// the active one (manual when unset). Adding a provider is one class and
// one line here.
builder.Services.AddScoped<BalanceIO.API.Services.Payments.IPaymentGateway, BalanceIO.API.Services.Payments.ManualPaymentGateway>();
builder.Services.AddHttpClient<BalanceIO.API.Services.Payments.MidtransPaymentGateway>(c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddScoped<BalanceIO.API.Services.Payments.IPaymentGateway>(sp => sp.GetRequiredService<BalanceIO.API.Services.Payments.MidtransPaymentGateway>());
builder.Services.AddScoped<BalanceIO.API.Services.Payments.PaymentService>();
builder.Services.AddScoped<BankReconciliationService>();
builder.Services.AddScoped<BudgetingService>();
builder.Services.AddScoped<E2EAccountingValidationService>();

// Security: Argon2id Password Hasher
builder.Services.AddSingleton<Argon2PasswordHasher>();

builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<IDocumentHistoryService, DocumentHistoryService>();
builder.Services.AddScoped<ISupportTicketService, SupportTicketService>();

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
        // The default five-minute skew would stretch a 15-minute token to 20.
        // This API signs and checks its own tokens, so its clocks agree.
        ClockSkew = TimeSpan.FromSeconds(30),
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
    };
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // The cookies serve requests without an Authorization header. A
            // header is the caller's choice (the MFA step's temporary token,
            // the tenant or admin token the SPA holds) and must not be
            // overridden by whatever session cookie the browser still has.
            if (string.IsNullOrEmpty(context.Token) && !context.Request.Headers.ContainsKey("Authorization"))
            {
                if (context.Request.Cookies.TryGetValue(SessionService.TenantAccessTokenCookie, out var token) && !string.IsNullOrEmpty(token))
                {
                    context.Token = token;
                }
                else if (context.Request.Cookies.TryGetValue(SessionService.AdminAccessTokenCookie, out var adminToken) && !string.IsNullOrEmpty(adminToken))
                {
                    context.Token = adminToken;
                }
            }
            return Task.CompletedTask;
        }
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

// EF fixes up back-references (a line's parent document), so any action
// that returns a document with its lines produced a cycle and a 500 after
// the work had already been saved: purchase order receipt, stock opname
// initialise, vouchers. Cycles are written once and then cut.
builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

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

// Without object storage, uploads fall back to local disk only where that
// is allowed (Development, or Storage:AllowLocalDisk); elsewhere they are
// refused. Say which, so "disabled" above is not misread either way.
using (var scope = app.Services.CreateScope())
{
    var storage = scope.ServiceProvider.GetRequiredService<BlobStorageService>();
    if (storage.UsesLocalDisk)
        app.Logger.LogWarning("File uploads are stored on local disk at {Directory}.", storage.LocalUploadDirectory);
    else if (!storage.IsAvailable)
        app.Logger.LogWarning("File uploads are refused: no object storage, and local disk is not allowed (Storage:AllowLocalDisk).");
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

app.UseMiddleware<BalanceIO.API.Middleware.ApiExceptionMiddleware>();

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

await DatabaseInitializer.RunAsync(app.Services, app.Environment, app.Configuration, app.Logger);

app.Run();

// Exposes the entry point to WebApplicationFactory in the test project.
public partial class Program;
