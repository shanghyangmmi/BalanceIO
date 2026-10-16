export const PERMISSIONS = {
    // Sales
    SalesView: "Sales.View",
    SalesCreate: "Sales.Create",
    SalesEdit: "Sales.Edit",
    SalesDelete: "Sales.Delete",
    SalesApprove: "Sales.Approve",

    // Purchases
    PurchasesView: "Purchases.View",
    PurchasesCreate: "Purchases.Create",
    PurchasesEdit: "Purchases.Edit",
    PurchasesDelete: "Purchases.Delete",
    PurchasesApprove: "Purchases.Approve",

    // Finance
    FinanceView: "Finance.View",
    FinanceCreate: "Finance.Create",
    FinanceEdit: "Finance.Edit",
    FinanceReport: "Finance.Report",

    // Inventory
    InventoryView: "Inventory.View",
    InventoryManage: "Inventory.Manage",
    InventoryOpname: "Inventory.Opname",

    // Assets
    AssetsView: "Assets.View",
    AssetsManage: "Assets.Manage",
    AssetsDepreciate: "Assets.Depreciate",

    // Contacts
    ContactsView: "Contacts.View",
    ContactsManage: "Contacts.Manage",

    // Settings & System
    SettingsView: "Settings.View",
    SettingsManage: "Settings.Manage",
    UsersView: "Users.View",
    UsersManage: "Users.Manage",
    AuditView: "Audit.View",

    // System
    SystemAdmin: "System.Admin"
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
