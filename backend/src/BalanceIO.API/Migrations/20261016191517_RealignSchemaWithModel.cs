using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BalanceIO.API.Migrations
{
    /// <summary>
    /// Brings a PostgreSQL database in line with the model from either of the
    /// two states production can be in: the migration chain alone, or the chain
    /// plus the raw DDL that Program.cs used to run at every boot.
    ///
    /// Migrations after InitialPostgres were generated against SQLite, so their
    /// snapshot disagreed with the model and later schema changes were made by
    /// boot-time DDL instead. Every statement here is idempotent, so the same
    /// migration is correct for a fresh database and for one already patched.
    /// The snapshot in this commit is generated against Npgsql.
    /// </summary>
    public partial class RealignSchemaWithModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
        // create JobRuns
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "JobRuns" (
                "Id" uuid NOT NULL,
                "ScheduledJobId" uuid NOT NULL,
                "JobKey" character varying(60) NOT NULL,
                "StartedAt" timestamp with time zone NOT NULL,
                "FinishedAt" timestamp with time zone,
                "Status" character varying(20) NOT NULL,
                "Message" character varying(2000),
                "WasManual" boolean NOT NULL,
                "TriggeredByUserId" uuid,
                "DurationMs" bigint NOT NULL,
                CONSTRAINT "PK_JobRuns" PRIMARY KEY ("Id")
            )
            """);

        // create PlatformFeatures
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "PlatformFeatures" (
                "Key" character varying(80) NOT NULL,
                "Name" character varying(120) NOT NULL,
                "Description" character varying(500),
                "Module" character varying(40) NOT NULL,
                "PriceMonthly" numeric(19,4) NOT NULL,
                "PriceYearly" numeric(19,4) NOT NULL,
                "IsAddOn" boolean NOT NULL,
                "IsActive" boolean NOT NULL,
                "SortOrder" integer NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone,
                CONSTRAINT "PK_PlatformFeatures" PRIMARY KEY ("Key")
            )
            """);

        // create ScheduledJobs
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "ScheduledJobs" (
                "Id" uuid NOT NULL,
                "JobKey" character varying(60) NOT NULL,
                "Name" character varying(120) NOT NULL,
                "Description" character varying(400),
                "IntervalMinutes" integer NOT NULL,
                "PreferredMinuteOfDay" integer,
                "IsEnabled" boolean NOT NULL,
                "LastRunAt" timestamp with time zone,
                "NextRunAt" timestamp with time zone,
                "LastStatus" character varying(20),
                "LastMessage" character varying(1000),
                "ConsecutiveFailures" integer NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone,
                CONSTRAINT "PK_ScheduledJobs" PRIMARY KEY ("Id")
            )
            """);

        // create EvidenceAttachments
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "EvidenceAttachments" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "EntityType" character varying(50) NOT NULL,
                "EntityId" uuid NOT NULL,
                "AttachmentType" character varying(50) NOT NULL,
                "FileName" character varying(255) NOT NULL,
                "FileExtension" character varying(20) NOT NULL,
                "ContentType" character varying(100) NOT NULL,
                "FileSize" bigint NOT NULL,
                "FileUrl" character varying(500) NOT NULL,
                "StoragePath" character varying(500) NOT NULL,
                "Notes" character varying(500),
                "UploadedBy" character varying(100),
                "UploadedByUserId" uuid,
                "UploadedAt" timestamp with time zone NOT NULL,
                "IsVerified" boolean NOT NULL,
                "VerifiedBy" character varying(100),
                "VerifiedAt" timestamp with time zone,
                CONSTRAINT "PK_EvidenceAttachments" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_EvidenceAttachments_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
            )
            """);

        // create ImportBatches
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "ImportBatches" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "BatchNumber" character varying(50) NOT NULL,
                "Type" integer NOT NULL,
                "FileName" character varying(255),
                "ConversionDate" date NOT NULL,
                "TotalRecords" integer NOT NULL,
                "SuccessfulRecords" integer NOT NULL,
                "Status" integer NOT NULL,
                "SummaryJson" text,
                "CreatedBy" character varying(100),
                "CreatedAt" timestamp with time zone NOT NULL,
                "ReversedAt" timestamp with time zone,
                "ReversedBy" character varying(100),
                CONSTRAINT "PK_ImportBatches" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ImportBatches_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE
            )
            """);

        // create TaxRates
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "TaxRates" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid,
                "Name" character varying(100) NOT NULL,
                "Rate" numeric(5,2) NOT NULL,
                "DppScheme" integer NOT NULL,
                "EffectiveFrom" date NOT NULL,
                "EffectiveTo" date,
                "IsActive" boolean NOT NULL,
                "IsSystemDefault" boolean NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_TaxRates" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_TaxRates_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id")
            )
            """);

        // create PlanFeatures
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "PlanFeatures" (
                "Id" uuid NOT NULL,
                "PlanId" uuid NOT NULL,
                "FeatureKey" character varying(80) NOT NULL,
                "Included" boolean NOT NULL,
                "Quota" integer,
                CONSTRAINT "PK_PlanFeatures" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_PlanFeatures_Plans_PlanId" FOREIGN KEY ("PlanId") REFERENCES "Plans" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_PlanFeatures_PlatformFeatures_FeatureKey" FOREIGN KEY ("FeatureKey") REFERENCES "PlatformFeatures" ("Key") ON DELETE CASCADE
            )
            """);

        // create BankReconciliationSessions
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "BankReconciliationSessions" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "AccountId" uuid NOT NULL,
                "ReconciliationDate" date NOT NULL,
                "StatementEndingBalance" numeric(19,4) NOT NULL,
                "LedgerEndingBalance" numeric(19,4) NOT NULL,
                "OutstandingDeposits" numeric(19,4) NOT NULL,
                "OutstandingPayments" numeric(19,4) NOT NULL,
                "UnrecordedBankCredits" numeric(19,4) NOT NULL,
                "UnrecordedBankDebits" numeric(19,4) NOT NULL,
                "AdjustedBankBalance" numeric(19,4) NOT NULL,
                "AdjustedLedgerBalance" numeric(19,4) NOT NULL,
                "Difference" numeric(19,4) NOT NULL,
                "Status" integer NOT NULL,
                "Notes" character varying(500),
                "ReconciledBy" character varying(100),
                "CreatedAt" timestamp with time zone NOT NULL,
                "FinalizedAt" timestamp with time zone,
                CONSTRAINT "PK_BankReconciliationSessions" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_BankReconciliationSessions_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE
            )
            """);

        // create BankStatements
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "BankStatements" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "AccountId" uuid NOT NULL,
                "StatementDate" date NOT NULL,
                "PeriodStart" date NOT NULL,
                "PeriodEnd" date NOT NULL,
                "OpeningBalance" numeric(19,4) NOT NULL,
                "ClosingBalance" numeric(19,4) NOT NULL,
                "Format" integer NOT NULL,
                "FileName" character varying(255),
                "Checksum" character varying(64),
                "TotalLines" integer NOT NULL,
                "TotalDebits" numeric(19,4) NOT NULL,
                "TotalCredits" numeric(19,4) NOT NULL,
                "Status" integer NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "ReconciledAt" timestamp with time zone,
                CONSTRAINT "PK_BankStatements" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_BankStatements_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE
            )
            """);

        // create Budgets
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "Budgets" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "Name" character varying(150) NOT NULL,
                "FiscalYear" integer NOT NULL,
                "PeriodType" integer NOT NULL,
                "Status" integer NOT NULL,
                "ProjectId" uuid,
                "Notes" character varying(500),
                "TotalBudgetAmount" numeric(18,2) NOT NULL,
                "CreatedBy" character varying(100),
                "CreatedByUserId" uuid,
                "CreatedAt" timestamp with time zone NOT NULL,
                "ApprovedBy" character varying(100),
                "ApprovedByUserId" uuid,
                "ApprovedAt" timestamp with time zone,
                CONSTRAINT "PK_Budgets" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_Budgets_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_Budgets_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Projects" ("Id")
            )
            """);

        // create SubscriptionAddOns
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "SubscriptionAddOns" (
                "Id" uuid NOT NULL,
                "SubscriptionId" uuid NOT NULL,
                "FeatureKey" character varying(80) NOT NULL,
                "PricePaid" numeric(19,4) NOT NULL,
                "BillingCycle" character varying(20) NOT NULL,
                "StartsAt" timestamp with time zone NOT NULL,
                "EndsAt" timestamp with time zone,
                "IsActive" boolean NOT NULL,
                "Note" character varying(200),
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_SubscriptionAddOns" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_SubscriptionAddOns_PlatformFeatures_FeatureKey" FOREIGN KEY ("FeatureKey") REFERENCES "PlatformFeatures" ("Key") ON DELETE RESTRICT,
                CONSTRAINT "FK_SubscriptionAddOns_Subscriptions_SubscriptionId" FOREIGN KEY ("SubscriptionId") REFERENCES "Subscriptions" ("Id") ON DELETE CASCADE
            )
            """);

        // create BudgetLines
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "BudgetLines" (
                "Id" uuid NOT NULL,
                "BudgetId" uuid NOT NULL,
                "AccountId" uuid NOT NULL,
                "Month" integer NOT NULL,
                "Quarter" integer,
                "Amount" numeric(18,2) NOT NULL,
                "WarningThresholdPercentage" numeric(5,2) NOT NULL,
                "CriticalThresholdPercentage" numeric(5,2) NOT NULL,
                "Notes" character varying(250),
                CONSTRAINT "PK_BudgetLines" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_BudgetLines_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_BudgetLines_Budgets_BudgetId" FOREIGN KEY ("BudgetId") REFERENCES "Budgets" ("Id") ON DELETE CASCADE
            )
            """);

        // create InventoryMovements
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "InventoryMovements" (
                "Id" uuid NOT NULL,
                "CompanyId" uuid NOT NULL,
                "ProductId" uuid NOT NULL,
                "MovementDate" date NOT NULL,
                "Type" integer NOT NULL,
                "Quantity" numeric(19,4) NOT NULL,
                "UnitCost" numeric(19,4) NOT NULL,
                "TotalCost" numeric(19,4) NOT NULL,
                "ReferenceNumber" character varying(100),
                "JournalEntryId" uuid,
                "Notes" character varying(500),
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_InventoryMovements" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_InventoryMovements_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_InventoryMovements_JournalEntries_JournalEntryId" FOREIGN KEY ("JournalEntryId") REFERENCES "JournalEntries" ("Id"),
                CONSTRAINT "FK_InventoryMovements_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE
            )
            """);

        // create BankStatementLines
        migrationBuilder.Sql("""
            CREATE TABLE IF NOT EXISTS "BankStatementLines" (
                "Id" uuid NOT NULL,
                "BankStatementId" uuid NOT NULL,
                "TransactionDate" date NOT NULL,
                "ValueDate" date,
                "Description" character varying(500) NOT NULL,
                "ReferenceNumber" character varying(100),
                "Debit" numeric(19,4) NOT NULL,
                "Credit" numeric(19,4) NOT NULL,
                "Amount" numeric(19,4) NOT NULL,
                "RunningBalance" numeric(19,4) NOT NULL,
                "Status" integer NOT NULL,
                "MatchedJournalLineId" uuid,
                "MatchedDocumentType" character varying(50),
                "MatchedDocumentId" uuid,
                "MatchConfidence" integer NOT NULL,
                "BankFeeAmount" numeric(19,4) NOT NULL,
                "CreatedJournalEntryId" uuid,
                "LineHash" character varying(64),
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_BankStatementLines" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_BankStatementLines_BankStatements_BankStatementId" FOREIGN KEY ("BankStatementId") REFERENCES "BankStatements" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_BankStatementLines_JournalEntries_CreatedJournalEntryId" FOREIGN KEY ("CreatedJournalEntryId") REFERENCES "JournalEntries" ("Id"),
                CONSTRAINT "FK_BankStatementLines_JournalLines_MatchedJournalLineId" FOREIGN KEY ("MatchedJournalLineId") REFERENCES "JournalLines" ("Id")
            )
            """);

        // add Companies.IsPkp
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "IsPkp" boolean NOT NULL DEFAULT true;
            ALTER TABLE "Companies" ALTER COLUMN "IsPkp" DROP DEFAULT;
            """);

        // add Companies.PkpNumber
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "PkpNumber" character varying(50);
            """);

        // add Companies.PkpDate
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "PkpDate" date;
            """);

        // add Companies.TaxOffice
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "TaxOffice" character varying(150);
            """);

        // add Companies.EnforceSegregationOfDuties
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "EnforceSegregationOfDuties" boolean NOT NULL DEFAULT true;
            ALTER TABLE "Companies" ALTER COLUMN "EnforceSegregationOfDuties" DROP DEFAULT;
            """);

        // add Companies.ApprovalThresholdAmount
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "ApprovalThresholdAmount" numeric(19,4);
            """);

        // add Companies.IsSuspended
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "IsSuspended" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Companies" ALTER COLUMN "IsSuspended" DROP DEFAULT;
            """);

        // add Companies.SuspendedAt
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "SuspendedAt" timestamp with time zone;
            """);

        // add Companies.SuspensionReason
        migrationBuilder.Sql("""
            ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "SuspensionReason" character varying(300);
            """);

        // add ExchangeRates.RateType
        migrationBuilder.Sql("""
            ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "RateType" integer NOT NULL DEFAULT 1;
            ALTER TABLE "ExchangeRates" ALTER COLUMN "RateType" DROP DEFAULT;
            """);

        // add ExchangeRates.KmkNumber
        migrationBuilder.Sql("""
            ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "KmkNumber" character varying(100);
            """);

        // add ExchangeRates.ValidFrom
        migrationBuilder.Sql("""
            ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "ValidFrom" date;
            """);

        // add ExchangeRates.ValidTo
        migrationBuilder.Sql("""
            ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "ValidTo" date;
            """);

        // add ExchangeRates.Provenance
        migrationBuilder.Sql("""
            ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "Provenance" character varying(200);
            """);

        // add ExchangeRates.IsLockedByPostedEntry
        migrationBuilder.Sql("""
            ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "IsLockedByPostedEntry" boolean NOT NULL DEFAULT false;
            ALTER TABLE "ExchangeRates" ALTER COLUMN "IsLockedByPostedEntry" DROP DEFAULT;
            """);

        // add Plans.Modules
        migrationBuilder.Sql("""
            ALTER TABLE "Plans" ADD COLUMN IF NOT EXISTS "Modules" text;
            """);

        // add Users.IsSuspended
        migrationBuilder.Sql("""
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "IsSuspended" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Users" ALTER COLUMN "IsSuspended" DROP DEFAULT;
            """);

        // add Users.SuspendedAt
        migrationBuilder.Sql("""
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SuspendedAt" timestamp with time zone;
            """);

        // add Users.SuspensionReason
        migrationBuilder.Sql("""
            ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SuspensionReason" character varying(300);
            """);

        // add Accounts.IsInterestBearingDebt
        migrationBuilder.Sql("""
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "IsInterestBearingDebt" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Accounts" ALTER COLUMN "IsInterestBearingDebt" DROP DEFAULT;
            """);

        // add Accounts.FiscalCorrection
        migrationBuilder.Sql("""
            ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "FiscalCorrection" character varying(10);
            """);

        // add FixedAssetCategories.IsIntangible
        migrationBuilder.Sql("""
            ALTER TABLE "FixedAssetCategories" ADD COLUMN IF NOT EXISTS "IsIntangible" boolean NOT NULL DEFAULT false;
            ALTER TABLE "FixedAssetCategories" ALTER COLUMN "IsIntangible" DROP DEFAULT;
            """);

        // add AuditLogs.CompanyId
        migrationBuilder.Sql("""
            ALTER TABLE "AuditLogs" ADD COLUMN IF NOT EXISTS "CompanyId" uuid;
            """);

        // add Contacts.IsCustomer
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsCustomer" boolean NOT NULL DEFAULT true;
            ALTER TABLE "Contacts" ALTER COLUMN "IsCustomer" DROP DEFAULT;
            """);

        // add Contacts.IsVendor
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsVendor" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Contacts" ALTER COLUMN "IsVendor" DROP DEFAULT;
            """);

        // add Contacts.IsEmployee
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsEmployee" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Contacts" ALTER COLUMN "IsEmployee" DROP DEFAULT;
            """);

        // add Contacts.IsTaxParty
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsTaxParty" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Contacts" ALTER COLUMN "IsTaxParty" DROP DEFAULT;
            """);

        // add Contacts.Nik
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "Nik" character varying(16);
            """);

        // add Contacts.PtkpStatus
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "PtkpStatus" character varying(10);
            """);

        // add Contacts.BpjsKetenagakerjaanNumber
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BpjsKetenagakerjaanNumber" character varying(50);
            """);

        // add Contacts.BpjsKesehatanNumber
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BpjsKesehatanNumber" character varying(50);
            """);

        // add Contacts.BankName
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BankName" character varying(50);
            """);

        // add Contacts.BankAccountNumber
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BankAccountNumber" character varying(50);
            """);

        // add Contacts.BankAccountHolder
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BankAccountHolder" character varying(100);
            """);

        // add Contacts.WithholdingType
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "WithholdingType" character varying(50);
            """);

        // add Contacts.WithholdingRate
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "WithholdingRate" numeric(5,2) NOT NULL DEFAULT 0;
            ALTER TABLE "Contacts" ALTER COLUMN "WithholdingRate" DROP DEFAULT;
            """);

        // add Contacts.HasWithholdingExemption
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "HasWithholdingExemption" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Contacts" ALTER COLUMN "HasWithholdingExemption" DROP DEFAULT;
            """);

        // add Contacts.ExemptionExpiryDate
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "ExemptionExpiryDate" date;
            """);

        // add Contacts.IsPkp
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsPkp" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Contacts" ALTER COLUMN "IsPkp" DROP DEFAULT;
            """);

        // add Contacts.PkpDate
        migrationBuilder.Sql("""
            ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "PkpDate" date;
            """);

        // add Products.DppScheme
        migrationBuilder.Sql("""
            ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "DppScheme" integer NOT NULL DEFAULT 0;
            ALTER TABLE "Products" ALTER COLUMN "DppScheme" DROP DEFAULT;
            """);

        // add Products.IsLuxuryGood
        migrationBuilder.Sql("""
            ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "IsLuxuryGood" boolean NOT NULL DEFAULT false;
            ALTER TABLE "Products" ALTER COLUMN "IsLuxuryGood" DROP DEFAULT;
            """);

        // add Products.PPnBMRate
        migrationBuilder.Sql("""
            ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "PPnBMRate" numeric(5,2) NOT NULL DEFAULT 0;
            ALTER TABLE "Products" ALTER COLUMN "PPnBMRate" DROP DEFAULT;
            """);

        // add JournalEntries.IdempotencyKey
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "IdempotencyKey" character varying(100);
            """);

        // add JournalEntries.CreatedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "CreatedByUserId" uuid;
            """);

        // add JournalEntries.CreatedBy
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "CreatedBy" character varying(100);
            """);

        // add JournalEntries.ApprovedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "ApprovedByUserId" uuid;
            """);

        // add JournalEntries.ApprovedBy
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "ApprovedBy" character varying(100);
            """);

        // add JournalEntries.ApprovedAt
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp with time zone;
            """);

        // add JournalEntries.RejectionReason
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "RejectionReason" character varying(500);
            """);

        // add JournalEntries.RejectedBy
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "RejectedBy" character varying(100);
            """);

        // add JournalEntries.RejectedAt
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "RejectedAt" timestamp with time zone;
            """);

        // add JournalEntries.IsAdjustingEntry
        migrationBuilder.Sql("""
            ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "IsAdjustingEntry" boolean NOT NULL DEFAULT false;
            ALTER TABLE "JournalEntries" ALTER COLUMN "IsAdjustingEntry" DROP DEFAULT;
            """);

        // add PaymentVouchers.CompanyId
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "CompanyId" uuid;
            """);

        // add PaymentVouchers.CreatedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "CreatedByUserId" uuid;
            """);

        // add PaymentVouchers.CreatedBy
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "CreatedBy" character varying(100);
            """);

        // add PaymentVouchers.ApprovedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "ApprovedByUserId" uuid;
            """);

        // add PaymentVouchers.ApprovedBy
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "ApprovedBy" character varying(100);
            """);

        // add PaymentVouchers.ApprovedAt
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp with time zone;
            """);

        // add PaymentVouchers.RejectionReason
        migrationBuilder.Sql("""
            ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "RejectionReason" character varying(500);
            """);

        // add ReceiptVouchers.CompanyId
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "CompanyId" uuid;
            """);

        // add ReceiptVouchers.CreatedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "CreatedByUserId" uuid;
            """);

        // add ReceiptVouchers.CreatedBy
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "CreatedBy" character varying(100);
            """);

        // add ReceiptVouchers.ApprovedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "ApprovedByUserId" uuid;
            """);

        // add ReceiptVouchers.ApprovedBy
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "ApprovedBy" character varying(100);
            """);

        // add ReceiptVouchers.ApprovedAt
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp with time zone;
            """);

        // add ReceiptVouchers.RejectionReason
        migrationBuilder.Sql("""
            ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "RejectionReason" character varying(500);
            """);

        // add PurchaseBills.CreatedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBills" ADD COLUMN IF NOT EXISTS "CreatedByUserId" uuid;
            """);

        // add PurchaseBills.CreatedBy
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBills" ADD COLUMN IF NOT EXISTS "CreatedBy" character varying(100);
            """);

        // add PurchaseBills.ApprovedByUserId
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBills" ADD COLUMN IF NOT EXISTS "ApprovedByUserId" uuid;
            """);

        // add PurchaseBills.ApprovedBy
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBills" ADD COLUMN IF NOT EXISTS "ApprovedBy" character varying(100);
            """);

        // add PurchaseBills.ApprovedAt
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBills" ADD COLUMN IF NOT EXISTS "ApprovedAt" timestamp with time zone;
            """);

        // add PurchaseBills.RejectionReason
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBills" ADD COLUMN IF NOT EXISTS "RejectionReason" character varying(500);
            """);

        // add SalesInvoiceLines.DppScheme
        migrationBuilder.Sql("""
            ALTER TABLE "SalesInvoiceLines" ADD COLUMN IF NOT EXISTS "DppScheme" integer NOT NULL DEFAULT 0;
            ALTER TABLE "SalesInvoiceLines" ALTER COLUMN "DppScheme" DROP DEFAULT;
            """);

        // add SalesInvoiceLines.DppAmount
        migrationBuilder.Sql("""
            ALTER TABLE "SalesInvoiceLines" ADD COLUMN IF NOT EXISTS "DppAmount" numeric(19,4) NOT NULL DEFAULT 0;
            ALTER TABLE "SalesInvoiceLines" ALTER COLUMN "DppAmount" DROP DEFAULT;
            """);

        // add SalesInvoiceLines.PPnBMAmount
        migrationBuilder.Sql("""
            ALTER TABLE "SalesInvoiceLines" ADD COLUMN IF NOT EXISTS "PPnBMAmount" numeric(19,4) NOT NULL DEFAULT 0;
            ALTER TABLE "SalesInvoiceLines" ALTER COLUMN "PPnBMAmount" DROP DEFAULT;
            """);

        // add PurchaseBillLines.DppScheme
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBillLines" ADD COLUMN IF NOT EXISTS "DppScheme" integer NOT NULL DEFAULT 0;
            ALTER TABLE "PurchaseBillLines" ALTER COLUMN "DppScheme" DROP DEFAULT;
            """);

        // add PurchaseBillLines.DppAmount
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBillLines" ADD COLUMN IF NOT EXISTS "DppAmount" numeric(19,4) NOT NULL DEFAULT 0;
            ALTER TABLE "PurchaseBillLines" ALTER COLUMN "DppAmount" DROP DEFAULT;
            """);

        // add PurchaseBillLines.PPnBMAmount
        migrationBuilder.Sql("""
            ALTER TABLE "PurchaseBillLines" ADD COLUMN IF NOT EXISTS "PPnBMAmount" numeric(19,4) NOT NULL DEFAULT 0;
            ALTER TABLE "PurchaseBillLines" ALTER COLUMN "PPnBMAmount" DROP DEFAULT;
            """);

        // fk FK_EvidenceAttachments_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_EvidenceAttachments_Companies_CompanyId' AND conrelid = '"EvidenceAttachments"'::regclass) THEN
                ALTER TABLE "EvidenceAttachments" ADD CONSTRAINT "FK_EvidenceAttachments_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_ImportBatches_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ImportBatches_Companies_CompanyId' AND conrelid = '"ImportBatches"'::regclass) THEN
                ALTER TABLE "ImportBatches" ADD CONSTRAINT "FK_ImportBatches_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_TaxRates_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_TaxRates_Companies_CompanyId' AND conrelid = '"TaxRates"'::regclass) THEN
                ALTER TABLE "TaxRates" ADD CONSTRAINT "FK_TaxRates_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id");
              END IF;
            END $fk$;
            """);

        // fk FK_PlanFeatures_Plans_PlanId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PlanFeatures_Plans_PlanId' AND conrelid = '"PlanFeatures"'::regclass) THEN
                ALTER TABLE "PlanFeatures" ADD CONSTRAINT "FK_PlanFeatures_Plans_PlanId" FOREIGN KEY ("PlanId") REFERENCES "Plans" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_PlanFeatures_PlatformFeatures_FeatureKey
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PlanFeatures_PlatformFeatures_FeatureKey' AND conrelid = '"PlanFeatures"'::regclass) THEN
                ALTER TABLE "PlanFeatures" ADD CONSTRAINT "FK_PlanFeatures_PlatformFeatures_FeatureKey" FOREIGN KEY ("FeatureKey") REFERENCES "PlatformFeatures" ("Key") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_AuditLogs_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_AuditLogs_Companies_CompanyId' AND conrelid = '"AuditLogs"'::regclass) THEN
                ALTER TABLE "AuditLogs" ADD CONSTRAINT "FK_AuditLogs_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id");
              END IF;
            END $fk$;
            """);

        // fk FK_BankReconciliationSessions_Accounts_AccountId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BankReconciliationSessions_Accounts_AccountId' AND conrelid = '"BankReconciliationSessions"'::regclass) THEN
                ALTER TABLE "BankReconciliationSessions" ADD CONSTRAINT "FK_BankReconciliationSessions_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_BankStatements_Accounts_AccountId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BankStatements_Accounts_AccountId' AND conrelid = '"BankStatements"'::regclass) THEN
                ALTER TABLE "BankStatements" ADD CONSTRAINT "FK_BankStatements_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_Budgets_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Budgets_Companies_CompanyId' AND conrelid = '"Budgets"'::regclass) THEN
                ALTER TABLE "Budgets" ADD CONSTRAINT "FK_Budgets_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_Budgets_Projects_ProjectId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_Budgets_Projects_ProjectId' AND conrelid = '"Budgets"'::regclass) THEN
                ALTER TABLE "Budgets" ADD CONSTRAINT "FK_Budgets_Projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES "Projects" ("Id");
              END IF;
            END $fk$;
            """);

        // fk FK_SubscriptionAddOns_PlatformFeatures_FeatureKey
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SubscriptionAddOns_PlatformFeatures_FeatureKey' AND conrelid = '"SubscriptionAddOns"'::regclass) THEN
                ALTER TABLE "SubscriptionAddOns" ADD CONSTRAINT "FK_SubscriptionAddOns_PlatformFeatures_FeatureKey" FOREIGN KEY ("FeatureKey") REFERENCES "PlatformFeatures" ("Key") ON DELETE RESTRICT;
              END IF;
            END $fk$;
            """);

        // fk FK_SubscriptionAddOns_Subscriptions_SubscriptionId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_SubscriptionAddOns_Subscriptions_SubscriptionId' AND conrelid = '"SubscriptionAddOns"'::regclass) THEN
                ALTER TABLE "SubscriptionAddOns" ADD CONSTRAINT "FK_SubscriptionAddOns_Subscriptions_SubscriptionId" FOREIGN KEY ("SubscriptionId") REFERENCES "Subscriptions" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_BudgetLines_Accounts_AccountId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BudgetLines_Accounts_AccountId' AND conrelid = '"BudgetLines"'::regclass) THEN
                ALTER TABLE "BudgetLines" ADD CONSTRAINT "FK_BudgetLines_Accounts_AccountId" FOREIGN KEY ("AccountId") REFERENCES "Accounts" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_BudgetLines_Budgets_BudgetId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BudgetLines_Budgets_BudgetId' AND conrelid = '"BudgetLines"'::regclass) THEN
                ALTER TABLE "BudgetLines" ADD CONSTRAINT "FK_BudgetLines_Budgets_BudgetId" FOREIGN KEY ("BudgetId") REFERENCES "Budgets" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_InventoryMovements_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_InventoryMovements_Companies_CompanyId' AND conrelid = '"InventoryMovements"'::regclass) THEN
                ALTER TABLE "InventoryMovements" ADD CONSTRAINT "FK_InventoryMovements_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_InventoryMovements_JournalEntries_JournalEntryId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_InventoryMovements_JournalEntries_JournalEntryId' AND conrelid = '"InventoryMovements"'::regclass) THEN
                ALTER TABLE "InventoryMovements" ADD CONSTRAINT "FK_InventoryMovements_JournalEntries_JournalEntryId" FOREIGN KEY ("JournalEntryId") REFERENCES "JournalEntries" ("Id");
              END IF;
            END $fk$;
            """);

        // fk FK_InventoryMovements_Products_ProductId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_InventoryMovements_Products_ProductId' AND conrelid = '"InventoryMovements"'::regclass) THEN
                ALTER TABLE "InventoryMovements" ADD CONSTRAINT "FK_InventoryMovements_Products_ProductId" FOREIGN KEY ("ProductId") REFERENCES "Products" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_PaymentVouchers_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_PaymentVouchers_Companies_CompanyId' AND conrelid = '"PaymentVouchers"'::regclass) THEN
                ALTER TABLE "PaymentVouchers" ADD CONSTRAINT "FK_PaymentVouchers_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_ReceiptVouchers_Companies_CompanyId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ReceiptVouchers_Companies_CompanyId' AND conrelid = '"ReceiptVouchers"'::regclass) THEN
                ALTER TABLE "ReceiptVouchers" ADD CONSTRAINT "FK_ReceiptVouchers_Companies_CompanyId" FOREIGN KEY ("CompanyId") REFERENCES "Companies" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_BankStatementLines_BankStatements_BankStatementId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BankStatementLines_BankStatements_BankStatementId' AND conrelid = '"BankStatementLines"'::regclass) THEN
                ALTER TABLE "BankStatementLines" ADD CONSTRAINT "FK_BankStatementLines_BankStatements_BankStatementId" FOREIGN KEY ("BankStatementId") REFERENCES "BankStatements" ("Id") ON DELETE CASCADE;
              END IF;
            END $fk$;
            """);

        // fk FK_BankStatementLines_JournalEntries_CreatedJournalEntryId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BankStatementLines_JournalEntries_CreatedJournalEntryId' AND conrelid = '"BankStatementLines"'::regclass) THEN
                ALTER TABLE "BankStatementLines" ADD CONSTRAINT "FK_BankStatementLines_JournalEntries_CreatedJournalEntryId" FOREIGN KEY ("CreatedJournalEntryId") REFERENCES "JournalEntries" ("Id");
              END IF;
            END $fk$;
            """);

        // fk FK_BankStatementLines_JournalLines_MatchedJournalLineId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_BankStatementLines_JournalLines_MatchedJournalLineId' AND conrelid = '"BankStatementLines"'::regclass) THEN
                ALTER TABLE "BankStatementLines" ADD CONSTRAINT "FK_BankStatementLines_JournalLines_MatchedJournalLineId" FOREIGN KEY ("MatchedJournalLineId") REFERENCES "JournalLines" ("Id");
              END IF;
            END $fk$;
            """);

        // index IX_AuditLogs_CompanyId_Timestamp
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_AuditLogs_CompanyId_Timestamp" ON "AuditLogs" ("CompanyId", "Timestamp");
            """);

        // index IX_ExchangeRates_RateDate_FromCurrency_RateType
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_ExchangeRates_RateDate_FromCurrency_RateType" ON "ExchangeRates" ("RateDate", "FromCurrency", "RateType");
            """);

        // index IX_ExchangeRates_ValidFrom_ValidTo_FromCurrency
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_ExchangeRates_ValidFrom_ValidTo_FromCurrency" ON "ExchangeRates" ("ValidFrom", "ValidTo", "FromCurrency");
            """);

        // index IX_JournalEntries_CompanyId_IdempotencyKey
        migrationBuilder.Sql("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_JournalEntries_CompanyId_IdempotencyKey" ON "JournalEntries" ("CompanyId", "IdempotencyKey");
            """);

        // index IX_PaymentVouchers_CompanyId_PaymentDate
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_PaymentVouchers_CompanyId_PaymentDate" ON "PaymentVouchers" ("CompanyId", "PaymentDate");
            """);

        // index IX_ReceiptVouchers_CompanyId_ReceiptDate
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_ReceiptVouchers_CompanyId_ReceiptDate" ON "ReceiptVouchers" ("CompanyId", "ReceiptDate");
            """);

        // index IX_BankReconciliationSessions_AccountId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BankReconciliationSessions_AccountId" ON "BankReconciliationSessions" ("AccountId");
            """);

        // index IX_BankStatementLines_BankStatementId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BankStatementLines_BankStatementId" ON "BankStatementLines" ("BankStatementId");
            """);

        // index IX_BankStatementLines_CreatedJournalEntryId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BankStatementLines_CreatedJournalEntryId" ON "BankStatementLines" ("CreatedJournalEntryId");
            """);

        // index IX_BankStatementLines_MatchedJournalLineId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BankStatementLines_MatchedJournalLineId" ON "BankStatementLines" ("MatchedJournalLineId");
            """);

        // index IX_BankStatements_AccountId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BankStatements_AccountId" ON "BankStatements" ("AccountId");
            """);

        // index IX_BudgetLines_AccountId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BudgetLines_AccountId" ON "BudgetLines" ("AccountId");
            """);

        // index IX_BudgetLines_BudgetId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_BudgetLines_BudgetId" ON "BudgetLines" ("BudgetId");
            """);

        // index IX_Budgets_CompanyId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_Budgets_CompanyId" ON "Budgets" ("CompanyId");
            """);

        // index IX_Budgets_ProjectId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_Budgets_ProjectId" ON "Budgets" ("ProjectId");
            """);

        // index IX_EvidenceAttachments_CompanyId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_EvidenceAttachments_CompanyId" ON "EvidenceAttachments" ("CompanyId");
            """);

        // index IX_ImportBatches_CompanyId_BatchNumber
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_ImportBatches_CompanyId_BatchNumber" ON "ImportBatches" ("CompanyId", "BatchNumber");
            """);

        // index IX_ImportBatches_CompanyId_ConversionDate
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_ImportBatches_CompanyId_ConversionDate" ON "ImportBatches" ("CompanyId", "ConversionDate");
            """);

        // index IX_InventoryMovements_CompanyId_ProductId_MovementDate
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_CompanyId_ProductId_MovementDate" ON "InventoryMovements" ("CompanyId", "ProductId", "MovementDate");
            """);

        // index IX_InventoryMovements_JournalEntryId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_JournalEntryId" ON "InventoryMovements" ("JournalEntryId");
            """);

        // index IX_InventoryMovements_ProductId
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_InventoryMovements_ProductId" ON "InventoryMovements" ("ProductId");
            """);

        // index IX_JobRuns_JobKey_StartedAt
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_JobRuns_JobKey_StartedAt" ON "JobRuns" ("JobKey", "StartedAt");
            """);

        // index IX_PlanFeatures_FeatureKey
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_PlanFeatures_FeatureKey" ON "PlanFeatures" ("FeatureKey");
            """);

        // index IX_PlanFeatures_PlanId_FeatureKey
        migrationBuilder.Sql("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_PlanFeatures_PlanId_FeatureKey" ON "PlanFeatures" ("PlanId", "FeatureKey");
            """);

        // index IX_ScheduledJobs_JobKey
        migrationBuilder.Sql("""
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ScheduledJobs_JobKey" ON "ScheduledJobs" ("JobKey");
            """);

        // index IX_SubscriptionAddOns_FeatureKey
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_SubscriptionAddOns_FeatureKey" ON "SubscriptionAddOns" ("FeatureKey");
            """);

        // index IX_SubscriptionAddOns_SubscriptionId_FeatureKey
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_SubscriptionAddOns_SubscriptionId_FeatureKey" ON "SubscriptionAddOns" ("SubscriptionId", "FeatureKey");
            """);

        // index IX_TaxRates_CompanyId_EffectiveFrom_EffectiveTo
        migrationBuilder.Sql("""
            CREATE INDEX IF NOT EXISTS "IX_TaxRates_CompanyId_EffectiveFrom_EffectiveTo" ON "TaxRates" ("CompanyId", "EffectiveFrom", "EffectiveTo");
            """);

        // tighten JournalEntries.IsAdjustingEntry
        migrationBuilder.Sql("""
            UPDATE "JournalEntries" SET "IsAdjustingEntry" = false WHERE "IsAdjustingEntry" IS NULL;
            ALTER TABLE "JournalEntries" ALTER COLUMN "IsAdjustingEntry" SET NOT NULL;
            """);

        // tighten PlatformFeatures.Module
        migrationBuilder.Sql("""
            UPDATE "PlatformFeatures" SET "Module" = 'platform' WHERE "Module" IS NULL;
            ALTER TABLE "PlatformFeatures" ALTER COLUMN "Module" SET NOT NULL;
            """);

        // tighten SubscriptionAddOns.BillingCycle
        migrationBuilder.Sql("""
            UPDATE "SubscriptionAddOns" SET "BillingCycle" = 'Monthly' WHERE "BillingCycle" IS NULL;
            ALTER TABLE "SubscriptionAddOns" ALTER COLUMN "BillingCycle" SET NOT NULL;
            """);

        // Users.EmailVerificationToken length
        migrationBuilder.Sql("""
            ALTER TABLE "Users" ALTER COLUMN "EmailVerificationToken" TYPE character varying(100);
            """);

        // backfill PaymentVouchers.CompanyId
        migrationBuilder.Sql("""
            UPDATE "PaymentVouchers" v SET "CompanyId" = c."CompanyId" FROM "Contacts" c WHERE v."CompanyId" IS NULL AND v."ContactId" = c."Id";
            DO $bf$ BEGIN
              IF EXISTS (SELECT 1 FROM "PaymentVouchers" WHERE "CompanyId" IS NULL) THEN
                IF (SELECT count(*) FROM "Companies") = 1 THEN
                  UPDATE "PaymentVouchers" SET "CompanyId" = (SELECT "Id" FROM "Companies") WHERE "CompanyId" IS NULL;
                ELSE
                  RAISE EXCEPTION 'PaymentVouchers rows have no CompanyId and cannot be attributed to a company automatically; assign them manually, then re-run the migration.';
                END IF;
              END IF;
            END $bf$;
            ALTER TABLE "PaymentVouchers" ALTER COLUMN "CompanyId" SET NOT NULL;
            """);

        // backfill ReceiptVouchers.CompanyId
        migrationBuilder.Sql("""
            UPDATE "ReceiptVouchers" v SET "CompanyId" = c."CompanyId" FROM "Contacts" c WHERE v."CompanyId" IS NULL AND v."ContactId" = c."Id";
            DO $bf$ BEGIN
              IF EXISTS (SELECT 1 FROM "ReceiptVouchers" WHERE "CompanyId" IS NULL) THEN
                IF (SELECT count(*) FROM "Companies") = 1 THEN
                  UPDATE "ReceiptVouchers" SET "CompanyId" = (SELECT "Id" FROM "Companies") WHERE "CompanyId" IS NULL;
                ELSE
                  RAISE EXCEPTION 'ReceiptVouchers rows have no CompanyId and cannot be attributed to a company automatically; assign them manually, then re-run the migration.';
                END IF;
              END IF;
            END $bf$;
            ALTER TABLE "ReceiptVouchers" ALTER COLUMN "CompanyId" SET NOT NULL;
            """);

        // fk delete behaviour FK_FixedAssets_FixedAssetCategories_CategoryId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_FixedAssets_FixedAssetCategories_CategoryId' AND confdeltype = 'c') THEN
                ALTER TABLE "FixedAssets" DROP CONSTRAINT "FK_FixedAssets_FixedAssetCategories_CategoryId";
                ALTER TABLE "FixedAssets" ADD CONSTRAINT "FK_FixedAssets_FixedAssetCategories_CategoryId" FOREIGN KEY ("CategoryId") REFERENCES "FixedAssetCategories" ("Id");
              END IF;
            END $fk$;
            """);

        // fk delete behaviour FK_FixedAssets_FixedAssetLocations_LocationId
        migrationBuilder.Sql("""
            DO $fk$ BEGIN
              IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_FixedAssets_FixedAssetLocations_LocationId' AND confdeltype = 'c') THEN
                ALTER TABLE "FixedAssets" DROP CONSTRAINT "FK_FixedAssets_FixedAssetLocations_LocationId";
                ALTER TABLE "FixedAssets" ADD CONSTRAINT "FK_FixedAssets_FixedAssetLocations_LocationId" FOREIGN KEY ("LocationId") REFERENCES "FixedAssetLocations" ("Id");
              END IF;
            END $fk$;
            """);

        // backfill Plans.Modules
        migrationBuilder.Sql("""
            UPDATE "Plans" SET "Modules" = '["accounting","tax","inventory","fixedAssets"]' WHERE "Modules" IS NULL;
            """);

        // backfill Contacts roles
        migrationBuilder.Sql("""
            UPDATE "Contacts" SET "IsCustomer" = true WHERE "Type" IN (0, 2) AND "IsCustomer" = false;
            UPDATE "Contacts" SET "IsVendor" = true WHERE "Type" IN (1, 2) AND "IsVendor" = false;
            UPDATE "Contacts" SET "IsTaxParty" = true WHERE "TaxId" IS NOT NULL AND "TaxId" <> '' AND "IsTaxParty" = false;
            """);

        // backfill AuditLogs.CompanyId
        migrationBuilder.Sql("""
            UPDATE "AuditLogs" SET "CompanyId" = (SELECT uc."CompanyId" FROM "UserCompanies" uc WHERE uc."UserId" = "AuditLogs"."UserId")
            WHERE "CompanyId" IS NULL AND "UserId" IS NOT NULL
              AND (SELECT count(*) FROM "UserCompanies" uc WHERE uc."UserId" = "AuditLogs"."UserId") = 1;
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "RealignSchemaWithModel adds columns, tables and constraints that live data may already use. " +
                "Restore from backup instead of reverting.");
        }
    }
}
