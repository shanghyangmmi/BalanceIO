using BalanceIO.API.Models;
using BalanceIO.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using System.Text.Json;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;

namespace BalanceIO.API.Data;

public partial class ApplicationDbContext : DbContext
{
    private readonly IHttpContextAccessor? _httpContextAccessor;

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options, IHttpContextAccessor? httpContextAccessor = null) : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public DbSet<JournalEntry> JournalEntries { get; set; }
    public DbSet<JournalLine> JournalLines { get; set; }
    public DbSet<Account> Accounts { get; set; }
    public DbSet<CostCenter> CostCenters { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<Notification> Notifications { get; set; }

    // Finance Documents - Core
    public DbSet<Contact> Contacts { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<DocumentTemplate> DocumentTemplates { get; set; }
    public DbSet<DocumentNumberSequence> DocumentNumberSequences { get; set; }

    // Sales Documents
    public DbSet<SalesOrder> SalesOrders { get; set; }
    public DbSet<SalesOrderLine> SalesOrderLines { get; set; }
    public DbSet<SalesInvoice> SalesInvoices { get; set; }
    public DbSet<SalesInvoiceLine> SalesInvoiceLines { get; set; }
    public DbSet<DeliveryOrder> DeliveryOrders { get; set; }
    public DbSet<DeliveryOrderLine> DeliveryOrderLines { get; set; }
    public DbSet<CreditNote> CreditNotes { get; set; }
    public DbSet<CreditNoteLine> CreditNoteLines { get; set; }
    public DbSet<ReceiptVoucher> ReceiptVouchers { get; set; }
    public DbSet<ReceiptVoucherLine> ReceiptVoucherLines { get; set; }

    // Purchase Documents
    public DbSet<PurchaseOrder> PurchaseOrders { get; set; }
    public DbSet<PurchaseOrderLine> PurchaseOrderLines { get; set; }
    public DbSet<GoodsReceipt> GoodsReceipts { get; set; }
    public DbSet<GoodsReceiptLine> GoodsReceiptLines { get; set; }
    public DbSet<PurchaseBill> PurchaseBills { get; set; }
    public DbSet<PurchaseBillLine> PurchaseBillLines { get; set; }
    public DbSet<DebitNote> DebitNotes { get; set; }
    public DbSet<DebitNoteLine> DebitNoteLines { get; set; }
    public DbSet<PaymentVoucher> PaymentVouchers { get; set; }
    public DbSet<PaymentVoucherLine> PaymentVoucherLines { get; set; }

    // Banking, Reconciliation & Adjustments
    public DbSet<FundTransfer> FundTransfers { get; set; }
    public DbSet<JournalVoucher> JournalVouchers { get; set; }
    public DbSet<JournalVoucherLine> JournalVoucherLines { get; set; }
    public DbSet<BankStatement> BankStatements { get; set; }
    public DbSet<BankStatementLine> BankStatementLines { get; set; }
    public DbSet<BankReconciliationSession> BankReconciliationSessions { get; set; }

    // Exchange Rates & Currencies
    public DbSet<ExchangeRate> ExchangeRates { get; set; }
    public DbSet<Currency> Currencies { get; set; }

    // Company Settings
    public DbSet<Company> Companies { get; set; }
    
    // Auth & Multi-Tenancy
    public DbSet<User> Users { get; set; }
    public DbSet<UserCompany> UserCompanies { get; set; }

    // Fixed Assets
    public DbSet<FixedAsset> FixedAssets { get; set; }
    public DbSet<AssetDepreciation> AssetDepreciations { get; set; }
    public DbSet<FixedAssetCategory> FixedAssetCategories { get; set; }
    public DbSet<FixedAssetLocation> FixedAssetLocations { get; set; }

    // File & Evidence Storage Tracking
    public DbSet<StoredFile> StoredFiles { get; set; }
    public DbSet<EvidenceAttachment> EvidenceAttachments { get; set; }

    // Billing & Subscriptions
    public DbSet<Plan> Plans { get; set; }
    public DbSet<Subscription> Subscriptions { get; set; }
    public DbSet<Payment> Payments { get; set; }

    // Projects / Cost Centers
    public DbSet<Project> Projects { get; set; }

    // Advanced Accounting & Budgeting
    public DbSet<Budget> Budgets { get; set; }
    public DbSet<BudgetLine> BudgetLines { get; set; }
    public DbSet<RecurringJournalEntry> RecurringJournalEntries { get; set; }
    public DbSet<RecurringJournalEntryLine> RecurringJournalEntryLines { get; set; }

    // Inventory Management
    public DbSet<ProductCategory> ProductCategories { get; set; }
    public DbSet<ProductUnit> ProductUnits { get; set; }
    public DbSet<StockOpname> StockOpnames { get; set; }
    public DbSet<Warehouse> Warehouses { get; set; }
    public DbSet<StockOpnameLine> StockOpnameLines { get; set; }
    public DbSet<InventoryMovement> InventoryMovements { get; set; }

    // Tax & Compliance
    public DbSet<TaxRate> TaxRates { get; set; }
    public DbSet<TaxInvoiceNumberRange> TaxInvoiceNumberRanges { get; set; }

    // Settings
    public DbSet<EmailSettings> EmailSettings { get; set; }
    public DbSet<SystemSetting> SystemSettings { get; set; }

    // Migration & Import
    public DbSet<ImportBatch> ImportBatches { get; set; }

    // Licensing. Platform-wide, deliberately outside the tenant filter:
    // the catalogue and its pricing are the same object for everybody.
    public DbSet<PlatformFeature> PlatformFeatures { get; set; }
    public DbSet<PlanFeature> PlanFeatures { get; set; }
    public DbSet<SubscriptionAddOn> SubscriptionAddOns { get; set; }

    // Operations
    public DbSet<ScheduledJob> ScheduledJobs { get; set; }
    public DbSet<JobRun> JobRuns { get; set; }

    // Payroll
    public DbSet<EmployeeCompensation> EmployeeCompensations { get; set; }
    public DbSet<PayrollRun> PayrollRuns { get; set; }
    public DbSet<PayrollLine> PayrollLines { get; set; }

    // Sessions & Security Grants
    public DbSet<UserSession> UserSessions { get; set; }
    public DbSet<SupportAccessGrant> SupportAccessGrants { get; set; }

    // Audit History & In-App Support Ticketing
    public DbSet<DocumentHistoryEvent> DocumentHistoryEvents { get; set; }
    public DbSet<SupportTicket> SupportTickets { get; set; }
    public DbSet<SupportTicketMessage> SupportTicketMessages { get; set; }
    public DbSet<SupportTicketAttachment> SupportTicketAttachments { get; set; }

    public Guid? CurrentCompanyId { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Licensing ────────────────────────────────────────────────
        // A plan pairs with a feature at most once. Without this a careless
        // double-post could leave the same feature both included and
        // excluded, and which row won would depend on ordering.
        modelBuilder.Entity<PlanFeature>()
            .HasIndex(pf => new { pf.PlanId, pf.FeatureKey })
            .IsUnique();

        modelBuilder.Entity<PlanFeature>()
            .HasOne(pf => pf.Feature)
            .WithMany(f => f.PlanFeatures)
            .HasForeignKey(pf => pf.FeatureKey)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SubscriptionAddOn>()
            .HasIndex(a => new { a.SubscriptionId, a.FeatureKey });

        // Retiring a feature must not delete what a company paid for.
        modelBuilder.Entity<SubscriptionAddOn>()
            .HasOne(a => a.Feature)
            .WithMany()
            .HasForeignKey(a => a.FeatureKey)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ScheduledJob>()
            .HasIndex(j => j.JobKey)
            .IsUnique();

        modelBuilder.Entity<JobRun>()
            .HasIndex(r => new { r.JobKey, r.StartedAt });

        // UserCompany Composite Key
        modelBuilder.Entity<UserCompany>()
            .HasKey(uc => new { uc.UserId, uc.CompanyId });
            
        // Relationships
        modelBuilder.Entity<UserCompany>()
            .HasOne(uc => uc.User)
            .WithMany(u => u.UserCompanies)
            .HasForeignKey(uc => uc.UserId);

        modelBuilder.Entity<UserCompany>()
            .HasOne(uc => uc.Company)
            .WithMany()
            .HasForeignKey(uc => uc.CompanyId);

        // --- Global Query Filters for Multi-Tenancy ---
        //
        // These fail CLOSED. The filter used to read
        //   !CurrentCompanyId.HasValue || e.CompanyId == CurrentCompanyId
        // which disabled itself whenever no company scope was set, so a
        // request that simply omitted the X-Company-Id header read every
        // tenant's rows. That was demonstrable: a user of one company
        // could pull another company's Trial Balance by deleting a header.
        //
        // With the comparison alone, a null scope translates to
        // `CompanyId = NULL`, which is never true for a non-nullable Guid
        // column, so no company context means no tenant rows.
        //
        // Code that genuinely needs to read across tenants - the platform
        // admin screens - must say so with .IgnoreQueryFilters(), which
        // makes the intent visible at the call site instead of depending
        // on a header being absent.
        
        // Finance
        modelBuilder.Entity<Account>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<JournalEntry>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        
        // Sales
        modelBuilder.Entity<SalesInvoice>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<Contact>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<Product>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        
        // Purchases
        modelBuilder.Entity<PurchaseOrder>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<PurchaseBill>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        
        // Inventory
        modelBuilder.Entity<ProductCategory>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<ProductUnit>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<StockOpname>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<InventoryMovement>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<Warehouse>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        
        // Assets
        modelBuilder.Entity<FixedAsset>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<FixedAssetCategory>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<FixedAssetLocation>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        
        // Projects & Cost Centers
        modelBuilder.Entity<Project>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<CostCenter>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        // Recurring
        modelBuilder.Entity<RecurringJournalEntry>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        // Vouchers & Settlements (Multi-tenant scoped)
        modelBuilder.Entity<ReceiptVoucher>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<PaymentVoucher>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        // Security & Audit (Multi-tenant scoped, fail-closed)
        modelBuilder.Entity<AuditLog>().HasQueryFilter(e => CurrentCompanyId.HasValue && e.CompanyId == CurrentCompanyId);

        // Migration Batches
        modelBuilder.Entity<ImportBatch>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        // ── Entities that arrived without a filter ────────────────────
        //
        // Evidence, budgets and bank statements all carry a CompanyId and
        // all shipped relying on each query remembering to use it. That is
        // fail-open: the tenant boundary holds only where somebody wrote it
        // out, and it had already been missed twice - the attachment
        // preview and download endpoints read across tenants by id.
        //
        // The filter makes forgetting return nothing instead of everything.
        modelBuilder.Entity<EvidenceAttachment>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<Budget>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<BankStatement>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<BankReconciliationSession>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        // The line tables hold no CompanyId of their own, so they are
        // scoped through the parent they belong to. BankStatementLines in
        // particular is queried directly in a dozen places; each of those
        // does join to the statement and check the company, but a filter
        // that only holds while every author remembers is the thing being
        // fixed here.
        modelBuilder.Entity<BankStatementLine>()
            .HasQueryFilter(e => e.BankStatement!.CompanyId == CurrentCompanyId);

        modelBuilder.Entity<BudgetLine>()
            .HasQueryFilter(e => e.Budget!.CompanyId == CurrentCompanyId);

        modelBuilder.Entity<EmployeeCompensation>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<PayrollRun>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<PayrollLine>()
            .HasQueryFilter(e => e.PayrollRun!.CompanyId == CurrentCompanyId);

        modelBuilder.Entity<UserSession>().HasQueryFilter(e => !e.IsRevoked);
        modelBuilder.Entity<SupportAccessGrant>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        modelBuilder.Entity<DocumentHistoryEvent>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<SupportTicket>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<SupportTicketMessage>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<SupportTicketAttachment>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);
        modelBuilder.Entity<TaxInvoiceNumberRange>().HasQueryFilter(e => e.CompanyId == CurrentCompanyId);

        // --- Indexes for Performance ---
        modelBuilder.Entity<TaxInvoiceNumberRange>().HasIndex(e => new { e.CompanyId, e.Year, e.IsExhausted });
        modelBuilder.Entity<UserSession>().HasIndex(e => e.UserId);
        modelBuilder.Entity<UserSession>().HasIndex(e => e.RefreshTokenHash);
        modelBuilder.Entity<SupportAccessGrant>().HasIndex(e => new { e.CompanyId, e.ValidUntil });
        modelBuilder.Entity<SupportAccessGrant>()
            .HasOne<SupportTicket>()
            .WithMany()
            .HasForeignKey(g => g.TicketId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<DocumentHistoryEvent>().HasIndex(e => new { e.CompanyId, e.DocumentType, e.DocumentId });
        modelBuilder.Entity<DocumentHistoryEvent>().HasIndex(e => new { e.CompanyId, e.Timestamp });

        modelBuilder.Entity<SupportTicket>().HasIndex(e => new { e.CompanyId, e.TicketNumber }).IsUnique();
        modelBuilder.Entity<SupportTicket>().HasIndex(e => new { e.CompanyId, e.Status });
        modelBuilder.Entity<SupportTicket>().HasIndex(e => new { e.CompanyId, e.CreatedAt });
        modelBuilder.Entity<SupportTicket>()
            .HasOne(t => t.CreatedByUser)
            .WithMany()
            .HasForeignKey(t => t.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<SupportTicket>()
            .HasOne(t => t.AssignedAdminUser)
            .WithMany()
            .HasForeignKey(t => t.AssignedAdminUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<SupportTicketMessage>().HasIndex(e => e.TicketId);
        modelBuilder.Entity<SupportTicketMessage>().HasIndex(e => new { e.CompanyId, e.CreatedAt });
        modelBuilder.Entity<SupportTicketMessage>()
            .HasOne(m => m.Ticket)
            .WithMany(t => t.Messages)
            .HasForeignKey(m => m.TicketId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SupportTicketMessage>()
            .HasOne(m => m.SenderUser)
            .WithMany()
            .HasForeignKey(m => m.SenderUserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<SupportTicketAttachment>().HasIndex(e => e.TicketMessageId);
        modelBuilder.Entity<SupportTicketAttachment>()
            .HasOne(a => a.TicketMessage)
            .WithMany(m => m.Attachments)
            .HasForeignKey(a => a.TicketMessageId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SupportTicketAttachment>()
            .HasOne(a => a.StoredFile)
            .WithMany()
            .HasForeignKey(a => a.StoredFileId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<JournalEntry>().HasIndex(e => new { e.CompanyId, e.Date });
        modelBuilder.Entity<JournalEntry>().HasIndex(e => e.ProjectId);

        // Idempotency is decided by this index, not by a check-then-insert in
        // the controller. NULL keys are distinct in both SQLite and
        // PostgreSQL, so entries without a key are unaffected.
        modelBuilder.Entity<JournalEntry>()
            .HasIndex(e => new { e.CompanyId, e.IdempotencyKey })
            .IsUnique();
        
        modelBuilder.Entity<JournalLine>().HasIndex(e => e.AccountId);
        modelBuilder.Entity<JournalLine>().HasIndex(e => e.JournalEntryId);
        modelBuilder.Entity<JournalLine>().HasIndex(e => e.CostCenterId);
        modelBuilder.Entity<JournalLine>().HasIndex(e => e.ProjectId);

        modelBuilder.Entity<CostCenter>().HasIndex(e => new { e.CompanyId, e.Code }).IsUnique();
        modelBuilder.Entity<CostCenter>().HasIndex(e => e.ParentId);
        modelBuilder.Entity<CostCenter>().HasIndex(e => e.ManagerContactId);

        modelBuilder.Entity<SalesInvoiceLine>().HasIndex(e => e.CostCenterId);
        modelBuilder.Entity<SalesInvoiceLine>().HasIndex(e => e.ProjectId);

        modelBuilder.Entity<PurchaseBillLine>().HasIndex(e => e.CostCenterId);
        modelBuilder.Entity<PurchaseBillLine>().HasIndex(e => e.ProjectId);

        modelBuilder.Entity<FixedAsset>().HasIndex(e => e.CostCenterId);
        modelBuilder.Entity<EmployeeCompensation>().HasIndex(e => e.CostCenterId);

        modelBuilder.Entity<SalesInvoice>().HasIndex(e => new { e.CompanyId, e.InvoiceDate });
        modelBuilder.Entity<SalesInvoice>().HasIndex(e => new { e.CompanyId, e.Status });
        modelBuilder.Entity<SalesInvoice>().HasIndex(e => e.ContactId);

        modelBuilder.Entity<PurchaseBill>().HasIndex(e => new { e.CompanyId, e.BillDate });
        modelBuilder.Entity<PurchaseBill>().HasIndex(e => new { e.CompanyId, e.Status });
        modelBuilder.Entity<PurchaseBill>().HasIndex(e => e.ContactId);

        modelBuilder.Entity<Product>().HasIndex(e => new { e.CompanyId, e.Code });
        modelBuilder.Entity<Product>().HasIndex(e => new { e.CompanyId, e.Name });

        modelBuilder.Entity<Contact>().HasIndex(e => new { e.CompanyId, e.Name });

        modelBuilder.Entity<Account>().HasIndex(e => new { e.CompanyId, e.Code });

        modelBuilder.Entity<AuditLog>().HasIndex(e => new { e.CompanyId, e.Timestamp });
        modelBuilder.Entity<InventoryMovement>().HasIndex(e => new { e.CompanyId, e.ProductId, e.MovementDate });
        modelBuilder.Entity<TaxRate>().HasIndex(e => new { e.CompanyId, e.EffectiveFrom, e.EffectiveTo });
        modelBuilder.Entity<ReceiptVoucher>().HasIndex(e => new { e.CompanyId, e.ReceiptDate });
        modelBuilder.Entity<PaymentVoucher>().HasIndex(e => new { e.CompanyId, e.PaymentDate });
        modelBuilder.Entity<ImportBatch>().HasIndex(e => new { e.CompanyId, e.BatchNumber });
        modelBuilder.Entity<ImportBatch>().HasIndex(e => new { e.CompanyId, e.ConversionDate });
        modelBuilder.Entity<ExchangeRate>().HasIndex(e => new { e.RateDate, e.FromCurrency, e.RateType });
        modelBuilder.Entity<ExchangeRate>().HasIndex(e => new { e.ValidFrom, e.ValidTo, e.FromCurrency });

        modelBuilder.Entity<EmployeeCompensation>()
            .HasIndex(e => new { e.CompanyId, e.ContactId })
            .IsUnique();

        // One live run per month. A voided run steps aside so the month can
        // be run again; the filter is the same SQL on SQLite and PostgreSQL.
        modelBuilder.Entity<PayrollRun>()
            .HasIndex(e => new { e.CompanyId, e.Year, e.Month })
            .IsUnique()
            .HasFilter("\"Status\" <> 2");

        modelBuilder.Entity<PayrollLine>().HasIndex(e => e.ContactId);

        modelBuilder.Entity<Warehouse>().HasIndex(e => new { e.CompanyId, e.Code }).IsUnique();
        modelBuilder.Entity<InventoryMovement>().HasIndex(e => new { e.CompanyId, e.WarehouseId, e.ProductId });
    }

    /// <summary>
    /// The synchronous overload skips every async ledger guard, so it may not
    /// be used for anything that touches the ledger.
    /// </summary>
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        if (ChangeTracker.Entries().Any(e => e.State != EntityState.Unchanged && e.State != EntityState.Detached
                                             && (e.Entity is JournalEntry || e.Entity is JournalLine)))
        {
            throw new InvalidOperationException("Ledger writes must use SaveChangesAsync so the ledger guards run.");
        }

        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTenantScope();
        await EnforceLedgerInvariantsAsync(cancellationToken);
        await EnforceJournalQuotaAsync(cancellationToken);
        StampAuditLogCompanyScope();
        var auditEntries = OnBeforeSaveChanges();
        var result = await base.SaveChangesAsync(cancellationToken);
        await OnAfterSaveChanges(auditEntries);
        return result;
    }

    /// <summary>
    /// The plan's journal allowance, enforced where every posting path has
    /// to pass.
    ///
    /// Thirteen places in this codebase add a JournalEntry - controllers,
    /// the depreciation engine, bank reconciliation, the recurring runner.
    /// Checking a quota in each of them is a promise to remember it in the
    /// fourteenth, so the check lives at the single choke point instead,
    /// next to the double-entry validation that is enforced the same way
    /// and for the same reason.
    ///
    /// Only entries created inside a company scope are counted. A seeder,
    /// a migration or an admin task runs with no CurrentCompanyId and is
    /// not billable work.
    /// </summary>
    private async Task EnforceJournalQuotaAsync(CancellationToken cancellationToken)
    {
        if (!CurrentCompanyId.HasValue) return;

        var incoming = ChangeTracker.Entries<JournalEntry>()
            .Count(e => e.State == EntityState.Added);

        if (incoming == 0) return;

        var companyId = CurrentCompanyId.Value;
        var now = DateTime.UtcNow;

        var plan = await Subscriptions
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(sub => sub.CompanyId == companyId
                       && sub.Status == SubscriptionStatus.Active
                       && sub.EndDate >= now)
            .OrderByDescending(sub => sub.StartDate)
            .Select(sub => new { sub.Plan!.Name, sub.Plan.MaxJournalEntries })
            .FirstOrDefaultAsync(cancellationToken);

        // No live subscription is not the same as no allowance. Cutting off
        // a company whose card failed at midnight would lock them out of
        // their own books, which is a support incident rather than a
        // collection strategy. Dunning belongs elsewhere.
        if (plan is null || PlanLimitService.IsUnlimited(plan.MaxJournalEntries)) return;

        var windowSetting = await SystemSettings
            .AsNoTracking()
            .Where(setting => setting.Key == PlanLimitService.WindowSettingKey)
            .Select(setting => setting.Value)
            .FirstOrDefaultAsync(cancellationToken);

        var from = PlanLimitService.WindowStart(windowSetting, now);

        var query = JournalEntries
            .IgnoreQueryFilters()
            .Where(entry => entry.CompanyId == companyId);

        if (from is not null)
        {
            query = query.Where(entry => entry.CreatedAt >= from);
        }

        var used = await query.CountAsync(cancellationToken);

        if (used + incoming <= plan.MaxJournalEntries) return;

        var period = from is null ? "in total" : "this month";

        throw new PlanLimitExceededException(
            "JournalEntries",
            used,
            plan.MaxJournalEntries,
            $"The {plan.Name} plan allows {plan.MaxJournalEntries:N0} journal entries {period}. " +
            $"{used:N0} have been recorded" +
            (incoming == 1 ? "." : $", and this request would add {incoming:N0} more."));
    }

    private void StampAuditLogCompanyScope()
    {
        if (!CurrentCompanyId.HasValue) return;

        foreach (var entry in ChangeTracker.Entries<AuditLog>().Where(e => e.State == EntityState.Added))
        {
            if (!entry.Entity.CompanyId.HasValue)
            {
                entry.Entity.CompanyId = CurrentCompanyId.Value;
            }
        }
    }

    private List<AuditEntry> OnBeforeSaveChanges()
    {
        ChangeTracker.DetectChanges();
        var auditEntries = new List<AuditEntry>();
        
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is AuditLog || entry.State == EntityState.Detached || entry.State == EntityState.Unchanged)
                continue;

            // Only audit important operational tables to avoid log bloat
            var tableName = entry.Metadata.GetTableName() ?? entry.Entity.GetType().Name;
            var allowedTables = new[] { "Accounts", "CostCenters", "JournalEntries", "JournalLines", "Contacts", "Products", "SalesInvoices", "PurchaseBills", "FixedAssets", "EmployeeCompensations", "PayrollRuns" };
            if (!allowedTables.Contains(tableName))
                continue;

            var auditEntry = new AuditEntry(entry, _httpContextAccessor, CurrentCompanyId) { TableName = tableName };
            auditEntries.Add(auditEntry);

            foreach (var property in entry.Properties)
            {
                if (property.Metadata.IsPrimaryKey())
                {
                    auditEntry.KeyValues[property.Metadata.Name] = property.CurrentValue;
                    continue;
                }

                if (property.IsTemporary)
                {
                    auditEntry.TemporaryProperties.Add(property);
                    continue;
                }

                string propertyName = property.Metadata.Name;
                switch (entry.State)
                {
                    case EntityState.Added:
                        auditEntry.NewValues[propertyName] = property.CurrentValue;
                        break;

                    case EntityState.Deleted:
                        auditEntry.OldValues[propertyName] = property.OriginalValue;
                        break;

                    case EntityState.Modified:
                        if (property.IsModified)
                        {
                            auditEntry.OldValues[propertyName] = property.OriginalValue;
                            auditEntry.NewValues[propertyName] = property.CurrentValue;
                        }
                        break;
                }
            }
        }

        // Add entries that don't have temporary keys (e.g. existing records being modified/deleted)
        foreach (var auditEntry in auditEntries.Where(_ => !_.HasTemporaryProperties))
        {
            AuditLogs.Add(auditEntry.ToAuditLog());
        }

        // Return entries that have temporary keys (e.g. new records awaiting DB-generated IDs)
        return auditEntries.Where(_ => _.HasTemporaryProperties).ToList();
    }

    private async Task OnAfterSaveChanges(List<AuditEntry> auditEntries)
    {
        if (auditEntries == null || auditEntries.Count == 0)
            return;

        foreach (var auditEntry in auditEntries)
        {
            foreach (var prop in auditEntry.TemporaryProperties)
            {
                if (prop.Metadata.IsPrimaryKey())
                {
                    auditEntry.KeyValues[prop.Metadata.Name] = prop.CurrentValue;
                }
                else
                {
                    auditEntry.NewValues[prop.Metadata.Name] = prop.CurrentValue;
                }
            }
            AuditLogs.Add(auditEntry.ToAuditLog());
        }

        await base.SaveChangesAsync();
    }
}

public class AuditEntry
{
    private readonly IHttpContextAccessor? _httpContextAccessor;

    public AuditEntry(Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry entry, IHttpContextAccessor? httpContextAccessor, Guid? companyId = null)
    {
        Entry = entry;
        _httpContextAccessor = httpContextAccessor;
        CompanyId = companyId;

        // If companyId was not passed explicitly, attempt to read from the entity's CompanyId property
        if (!CompanyId.HasValue)
        {
            var compProp = entry.Properties.FirstOrDefault(p => p.Metadata.Name == "CompanyId");
            if (compProp?.CurrentValue is Guid cid)
            {
                CompanyId = cid;
            }
        }
    }

    public Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry Entry { get; }
    public string TableName { get; set; } = string.Empty;
    public Guid? CompanyId { get; set; }
    public Dictionary<string, object?> KeyValues { get; } = new();
    public Dictionary<string, object?> OldValues { get; } = new();
    public Dictionary<string, object?> NewValues { get; } = new();
    public List<Microsoft.EntityFrameworkCore.ChangeTracking.PropertyEntry> TemporaryProperties { get; } = new();

    public bool HasTemporaryProperties => TemporaryProperties.Any();

    public AuditLog ToAuditLog()
    {
        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = CompanyId,
            Timestamp = DateTime.UtcNow,
            TargetEntity = $"{TableName}:{string.Join(",", KeyValues.Select(k => k.Value))}"
        };

        switch (Entry.State)
        {
            case EntityState.Added:
                log.Action = $"CREATE_{TableName.ToUpper()}";
                break;
            case EntityState.Deleted:
                log.Action = $"DELETE_{TableName.ToUpper()}";
                break;
            case EntityState.Modified:
                log.Action = $"UPDATE_{TableName.ToUpper()}";
                break;
        }

        if (_httpContextAccessor?.HttpContext != null)
        {
            var user = _httpContextAccessor.HttpContext.User;
            var sub = user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value 
                      ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(sub, out var guid))
            {
                log.UserId = guid;
            }
            log.IpAddress = _httpContextAccessor.HttpContext.Connection.RemoteIpAddress?.ToString();
            log.UserAgent = _httpContextAccessor.HttpContext.Request.Headers["User-Agent"].ToString();

            var (device, os) = ParseUserAgent(log.UserAgent);
            log.Device = device;
            log.OperatingSystem = os;
        }

        var detailsObj = new
        {
            tableName = TableName,
            keys = KeyValues,
            oldValues = OldValues,
            newValues = NewValues
        };

        log.Details = JsonSerializer.Serialize(detailsObj);
        return log;
    }

    private (string Device, string OS) ParseUserAgent(string? ua)
    {
        if (string.IsNullOrEmpty(ua)) return ("Unknown", "Unknown");

        string os = "Unknown";
        if (ua.Contains("Windows")) os = "Windows";
        else if (ua.Contains("Mac OS")) os = "macOS";
        else if (ua.Contains("Android")) os = "Android";
        else if (ua.Contains("iOS") || ua.Contains("iPhone") || ua.Contains("iPad")) os = "iOS";
        else if (ua.Contains("Linux")) os = "Linux";

        string device = "Desktop";
        if (ua.Contains("Mobile") || ua.Contains("Android") || ua.Contains("iPhone")) device = "Mobile";
        else if (ua.Contains("iPad") || ua.Contains("Tablet")) device = "Tablet";

        return (device, os);
    }
}


