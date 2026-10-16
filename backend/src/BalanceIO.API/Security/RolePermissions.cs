namespace BalanceIO.API.Security;

/// <summary>
/// RBAC Role-to-Permissions Mapping:
/// Enforces the 4 canonical roles defined in the Blueprint:
/// 1. Superadmin - Omnipotent system-wide platform administrator
/// 2. Admin - Company administrator (full company & user management)
/// 3. Finance - Accounting & finance operator (strictly blocked from user management and subscription settings)
/// 4. Auditor - Read-only auditor across all accounting modules (zero mutation permissions)
/// </summary>
public static class RolePermissions
{
    // Canonical Roles
    public const string RoleSuperadmin = "Superadmin";
    public const string RoleAdmin = "Admin";
    public const string RoleFinance = "Finance";
    public const string RoleAuditor = "Auditor";

    // Legacy Aliases
    public const string RoleOwner = "Owner";
    public const string RoleManager = "Manager";
    public const string RoleStaff = "Staff";
    public const string RoleViewer = "Viewer";

    private static readonly HashSet<string> SuperadminPermissions = new()
    {
        Permissions.SalesView, Permissions.SalesCreate, Permissions.SalesEdit, Permissions.SalesDelete, Permissions.SalesApprove,
        Permissions.PurchasesView, Permissions.PurchasesCreate, Permissions.PurchasesEdit, Permissions.PurchasesDelete, Permissions.PurchasesApprove,
        Permissions.FinanceView, Permissions.FinanceCreate, Permissions.FinanceEdit, Permissions.FinanceDelete, Permissions.FinanceReport,
        Permissions.InventoryView, Permissions.InventoryManage, Permissions.InventoryOpname,
        Permissions.AssetsView, Permissions.AssetsManage, Permissions.AssetsDepreciate,
        Permissions.ContactsView, Permissions.ContactsManage,
        Permissions.SettingsView, Permissions.SettingsManage,
        Permissions.UsersView, Permissions.UsersManage,
        Permissions.AuditView,
        Permissions.SystemAdmin
    };

    private static readonly HashSet<string> AdminPermissions = new()
    {
        Permissions.SalesView, Permissions.SalesCreate, Permissions.SalesEdit, Permissions.SalesDelete, Permissions.SalesApprove,
        Permissions.PurchasesView, Permissions.PurchasesCreate, Permissions.PurchasesEdit, Permissions.PurchasesDelete, Permissions.PurchasesApprove,
        Permissions.FinanceView, Permissions.FinanceCreate, Permissions.FinanceEdit, Permissions.FinanceDelete, Permissions.FinanceReport,
        Permissions.InventoryView, Permissions.InventoryManage, Permissions.InventoryOpname,
        Permissions.AssetsView, Permissions.AssetsManage, Permissions.AssetsDepreciate,
        Permissions.ContactsView, Permissions.ContactsManage,
        Permissions.SettingsView, Permissions.SettingsManage,
        Permissions.UsersView, Permissions.UsersManage,
        Permissions.AuditView
    };

    private static readonly HashSet<string> FinancePermissions = new()
    {
        // Full accounting operations, but NO User Management (UsersView/Manage) and NO Subscription Settings (SettingsManage)
        Permissions.SalesView, Permissions.SalesCreate, Permissions.SalesEdit, Permissions.SalesApprove,
        Permissions.PurchasesView, Permissions.PurchasesCreate, Permissions.PurchasesEdit, Permissions.PurchasesApprove,
        Permissions.FinanceView, Permissions.FinanceCreate, Permissions.FinanceEdit, Permissions.FinanceReport,
        Permissions.InventoryView, Permissions.InventoryManage, Permissions.InventoryOpname,
        Permissions.AssetsView, Permissions.AssetsManage, Permissions.AssetsDepreciate,
        Permissions.ContactsView, Permissions.ContactsManage,
        Permissions.SettingsView,
        Permissions.AuditView
    };

    private static readonly HashSet<string> AuditorPermissions = new()
    {
        // Strictly Read-Only across all modules (Zero write/post/delete permissions)
        Permissions.SalesView,
        Permissions.PurchasesView,
        Permissions.FinanceView,
        Permissions.FinanceReport,
        Permissions.InventoryView,
        Permissions.AssetsView,
        Permissions.ContactsView,
        Permissions.AuditView
    };

    public static bool HasPermission(string role, string permission)
    {
        if (string.IsNullOrEmpty(role) || string.IsNullOrEmpty(permission)) return false;
        return GetPermissions(role).Contains(permission);
    }
    
    public static IEnumerable<string> GetPermissions(string role)
    {
        if (string.IsNullOrWhiteSpace(role)) return Enumerable.Empty<string>();

        return role.Trim().ToLowerInvariant() switch
        {
            "superadmin" or "owner" => SuperadminPermissions,
            "admin" or "manager" => AdminPermissions,
            "finance" or "staff" => FinancePermissions,
            "auditor" or "viewer" => AuditorPermissions,
            _ => Enumerable.Empty<string>()
        };
    }
}
