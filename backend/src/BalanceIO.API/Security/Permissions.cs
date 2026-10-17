namespace BalanceIO.API.Security;

public static class Permissions
{
    // Sales
    public const string SalesView = "Sales.View";
    public const string SalesCreate = "Sales.Create";
    public const string SalesEdit = "Sales.Edit";
    public const string SalesDelete = "Sales.Delete";
    public const string SalesApprove = "Sales.Approve";

    // Purchases
    public const string PurchasesView = "Purchases.View";
    public const string PurchasesCreate = "Purchases.Create";
    public const string PurchasesEdit = "Purchases.Edit";
    public const string PurchasesDelete = "Purchases.Delete";
    public const string PurchasesApprove = "Purchases.Approve";

    // Finance (GL, Journals)
    public const string FinanceView = "Finance.View";
    public const string FinanceCreate = "Finance.Create";
    public const string FinanceEdit = "Finance.Edit"; // e.g. Voiding
    public const string FinanceDelete = "Finance.Delete"; // e.g. Deleting Drafts
    public const string FinanceReport = "Finance.Report";

    // Inventory
    public const string InventoryView = "Inventory.View";
    public const string InventoryManage = "Inventory.Manage"; // Create/Edit Items
    public const string InventoryOpname = "Inventory.Opname"; // Stock Adjustments

    // Fixed Assets
    public const string AssetsView = "Assets.View";
    public const string AssetsManage = "Assets.Manage";
    public const string AssetsDepreciate = "Assets.Depreciate";

    // Payroll
    public const string PayrollView = "Payroll.View";
    public const string PayrollManage = "Payroll.Manage"; // Compensation, draft runs
    public const string PayrollApprove = "Payroll.Approve"; // Post or void a run

    // Contacts
    public const string ContactsView = "Contacts.View";
    public const string ContactsManage = "Contacts.Manage";

    // Settings & System
    public const string SettingsView = "Settings.View";
    public const string SettingsManage = "Settings.Manage"; // Company Profile
    public const string UsersView = "Users.View";
    public const string UsersManage = "Users.Manage"; // Invite/Role changes
    public const string AuditView = "Audit.View";
    
    // Admin Only
    public const string SystemAdmin = "System.Admin";
}
