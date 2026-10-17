using System.Net;
using System.Reflection;
using BalanceIO.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;

namespace BalanceIO.API.Tests;

public class PermissionCoverageTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    /// <summary>
    /// Actions open to any signed-in member on purpose. Each is about the caller
    /// themselves, a public catalogue, or the company-selection step that
    /// precedes having a company scope.
    /// </summary>
    private static readonly HashSet<string> OpenToAnyMember =
    [
        "UsersController.GetMe", "UsersController.GetMyCompanies",
        "PermissionsController.GetMyPermissions",
        "NotificationsController.GetUnread", "NotificationsController.GetAll",
        "NotificationsController.MarkAsRead", "NotificationsController.MarkAllAsRead",
        "PlansController.GetPlans", "PlansController.GetPlan",
        "CompanyController.GetCompany", "CompanyController.GetOnboardingStatus",
        "DashboardController.GetModuleDoors",
        "FilesController.Upload", "FilesController.List", "FilesController.Delete",
    ];

    /// <summary>Sign-in, registration and password flows: anonymous or about the caller's own account.</summary>
    private static readonly HashSet<string> AuthenticationControllers = ["AuthController", "AdminAuthController"];

    [Fact]
    public void Every_action_names_a_permission_or_is_deliberately_open()
    {
        var unprotected = new List<string>();
        var controllers = typeof(Program).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);

        foreach (var controller in controllers)
        {
            var classOk = controller.GetCustomAttributes<RequiresPermissionAttribute>(true).Any()
                          || controller.GetCustomAttributes<AuthorizeAttribute>(true).Any(a => !string.IsNullOrEmpty(a.Roles))
                          || controller.GetCustomAttributes<AllowAnonymousAttribute>(true).Any();
            if (classOk || AuthenticationControllers.Contains(controller.Name)) continue;

            foreach (var action in controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
                         .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any()))
            {
                var ok = action.GetCustomAttributes<RequiresPermissionAttribute>().Any()
                         || action.GetCustomAttributes<AllowAnonymousAttribute>().Any()
                         || action.GetCustomAttributes<AuthorizeAttribute>().Any(a => !string.IsNullOrEmpty(a.Roles));
                if (!ok && !OpenToAnyMember.Contains($"{controller.Name}.{action.Name}"))
                    unprotected.Add($"{controller.Name}.{action.Name}");
            }
        }

        Assert.True(unprotected.Count == 0, "Actions without [RequiresPermission]:\n" + string.Join("\n", unprotected));
    }

    [Fact]
    public async Task Viewer_can_read_reports_but_not_change_the_chart_of_accounts()
    {
        var t = factory.CreateTenant();
        var viewer = await factory.AddMember(t.CompanyId, "viewer", role: "Viewer");
        var client = factory.ClientFor(t.CompanyId, viewer);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Reports/trial-balance")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Accounts")).StatusCode);

        var create = await client.PostJson("/api/Accounts", new { code = "9-0001", name = "X", type = "Expense", accountGroup = "Expense" });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/Accounts/{t.Cash.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostJson("/api/BankReconciliation/finalize", new { })).StatusCode);
    }

    [Fact]
    public async Task Staff_can_work_but_cannot_delete_accounts_or_manage_the_subscription()
    {
        var t = factory.CreateTenant();
        var staff = await factory.AddMember(t.CompanyId, "staff", role: "Staff");
        var client = factory.ClientFor(t.CompanyId, staff);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"/api/Accounts/{t.Cash.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostJson("/api/Subscriptions/upgrade", new { companyId = t.CompanyId, planId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Products")).StatusCode);
    }

    [Fact]
    public async Task Subscription_endpoints_refuse_another_companys_id()
    {
        var mine = factory.CreateTenant();
        var theirs = factory.CreateTenant();
        Assert.Equal(HttpStatusCode.Forbidden, (await mine.OwnerClient().GetAsync($"/api/Subscriptions/current/{theirs.CompanyId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await mine.OwnerClient().PostJson("/api/Subscriptions/upgrade", new { companyId = theirs.CompanyId, planId = Guid.NewGuid() })).StatusCode);
    }
}
