using BalanceIO.API.Middleware;
using BalanceIO.API.Security;
using BalanceIO.API.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;

namespace BalanceIO.API.Tests;

public class AdminBootstrapTests
{
    private static Func<string, string?> Env(string? email = null, string? password = null) =>
        name => name switch { AdminBootstrap.EmailVar => email, AdminBootstrap.PasswordVar => password, _ => null };

    [Fact]
    public void Production_without_credentials_creates_no_admin() =>
        Assert.Null(AdminBootstrap.Resolve(isDevelopment: false, Env()));

    [Fact]
    public void Development_without_credentials_uses_the_local_account()
    {
        var admin = AdminBootstrap.Resolve(isDevelopment: true, Env());
        Assert.Equal(AdminBootstrap.DevelopmentEmail, admin!.Value.Email);
    }

    [Fact]
    public void Supplied_credentials_win_everywhere()
    {
        var admin = AdminBootstrap.Resolve(false, Env("ops@example.id", "a-long-enough-secret"));
        Assert.Equal(("ops@example.id", "a-long-enough-secret"), admin!.Value);
    }

    [Theory]
    [InlineData("ops@example.id", null)]
    [InlineData(null, "a-long-enough-secret")]
    [InlineData("ops@example.id", "short")]
    public void Partial_or_weak_credentials_stop_startup(string? email, string? password) =>
        Assert.Throws<InvalidOperationException>(() => AdminBootstrap.Resolve(false, Env(email, password)));
}

public class ApiExceptionMiddlewareTests
{
    private sealed class Env(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;
        public string ApplicationName { get; set; } = "t";
        public string ContentRootPath { get; set; } = "";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
    }

    private static async Task<(int status, string body)> Run(Exception ex, string environment)
    {
        var middleware = new ApiExceptionMiddleware(_ => throw ex, NullLogger<ApiExceptionMiddleware>.Instance, new Env(environment));
        var ctx = new DefaultHttpContext();
        ctx.Response.Body = new MemoryStream();
        await middleware.InvokeAsync(ctx);
        ctx.Response.Body.Position = 0;
        return (ctx.Response.StatusCode, await new StreamReader(ctx.Response.Body).ReadToEndAsync());
    }

    [Fact]
    public async Task Unexpected_error_in_production_hides_message_and_stack()
    {
        var (status, body) = await Run(new InvalidOperationException("secret table name"), Environments.Production);
        Assert.Equal(500, status);
        Assert.DoesNotContain("secret table name", body);
        Assert.DoesNotContain("at BalanceIO", body);
    }

    [Fact]
    public async Task Period_lock_is_a_client_error_with_a_stable_code()
    {
        var (status, body) = await Run(new PeriodLockedException("locked until 31/12/2026"), Environments.Production);
        Assert.Equal(400, status);
        Assert.Contains("PERIOD_LOCKED", body);
        Assert.Contains("locked until 31/12/2026", body);
    }

    [Fact]
    public async Task Ledger_violation_carries_its_code()
    {
        var (status, body) = await Run(new LedgerIntegrityException("UNBALANCED", "x"), Environments.Production);
        Assert.Equal(400, status);
        Assert.Contains("UNBALANCED", body);
    }
}
