-- Verbatim copy of the raw DDL Program.cs ran at every Production boot before
-- the schema was moved into EF migrations. Used only to reproduce the state of
-- a database that was brought up by the old boot sequence.

                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailVerificationToken" text;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "IsEmailVerified" boolean DEFAULT false;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "TwoFactorEnabled" boolean DEFAULT false;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "TwoFactorSecret" text;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PasswordResetToken" text;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PasswordResetTokenExpiresAt" timestamp with time zone;
                    CREATE TABLE IF NOT EXISTS "Projects" (
                        "Id" uuid NOT NULL,
                        "Name" character varying(100) NOT NULL,
                        "Code" character varying(20),
                        "Description" character varying(500),
                        "Status" integer NOT NULL DEFAULT 0,
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                        "UpdatedAt" timestamp with time zone,
                        CONSTRAINT "PK_Projects" PRIMARY KEY ("Id")
                    );
                    CREATE TABLE IF NOT EXISTS "InventoryMovements" (
                        "Id" uuid NOT NULL,
                        "CompanyId" uuid NOT NULL,
                        "ProductId" uuid NOT NULL,
                        "MovementDate" date NOT NULL,
                        "Type" integer NOT NULL,
                        "Quantity" numeric(19,4) NOT NULL DEFAULT 0,
                        "UnitCost" numeric(19,4) NOT NULL DEFAULT 0,
                        "TotalCost" numeric(19,4) NOT NULL DEFAULT 0,
                        "ReferenceNumber" character varying(100),
                        "JournalEntryId" uuid,
                        "Notes" character varying(500),
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                        CONSTRAINT "PK_InventoryMovements" PRIMARY KEY ("Id")
                    );
                    CREATE TABLE IF NOT EXISTS "TaxRates" (
                        "Id" uuid NOT NULL,
                        "CompanyId" uuid,
                        "Name" character varying(100) NOT NULL,
                        "Rate" numeric(5,2) NOT NULL DEFAULT 12.00,
                        "DppScheme" integer NOT NULL DEFAULT 0,
                        "EffectiveFrom" date NOT NULL,
                        "EffectiveTo" date,
                        "IsActive" boolean NOT NULL DEFAULT true,
                        "IsSystemDefault" boolean NOT NULL DEFAULT true,
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                        CONSTRAINT "PK_TaxRates" PRIMARY KEY ("Id")
                    );
                    CREATE TABLE IF NOT EXISTS "ImportBatches" (
                        "Id" uuid NOT NULL,
                        "CompanyId" uuid NOT NULL,
                        "BatchNumber" character varying(50) NOT NULL,
                        "Type" integer NOT NULL,
                        "FileName" character varying(255),
                        "ConversionDate" date NOT NULL,
                        "TotalRecords" integer NOT NULL DEFAULT 0,
                        "SuccessfulRecords" integer NOT NULL DEFAULT 0,
                        "Status" integer NOT NULL DEFAULT 0,
                        "SummaryJson" text,
                        "CreatedBy" character varying(100),
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                        "ReversedAt" timestamp with time zone,
                        "ReversedBy" character varying(100),
                        CONSTRAINT "PK_ImportBatches" PRIMARY KEY ("Id")
                    );
                   ALTER TABLE "SalesInvoices" ADD COLUMN IF NOT EXISTS "ProjectId" uuid;
                   ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "ProjectId" uuid;
                   ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "LockDate" date;
                   ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "IsAdjustingEntry" boolean DEFAULT false;
                   ALTER TABLE "JournalEntries" ADD COLUMN IF NOT EXISTS "IdempotencyKey" character varying(100);
                   ALTER TABLE "Plans" ADD COLUMN IF NOT EXISTS "Modules" text;
                   ALTER TABLE "FixedAssetCategories" ADD COLUMN IF NOT EXISTS "IsIntangible" boolean NOT NULL DEFAULT false;
                   ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "IsInterestBearingDebt" boolean NOT NULL DEFAULT false;
                   ALTER TABLE "Accounts" ADD COLUMN IF NOT EXISTS "FiscalCorrection" character varying(10);
                   ALTER TABLE "AuditLogs" ADD COLUMN IF NOT EXISTS "CompanyId" uuid;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "IsSuspended" boolean NOT NULL DEFAULT false;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SuspendedAt" timestamp with time zone;
                   ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "SuspensionReason" character varying(300);
                   ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "IsSuspended" boolean NOT NULL DEFAULT false;
                   ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "SuspendedAt" timestamp with time zone;
                   ALTER TABLE "Companies" ADD COLUMN IF NOT EXISTS "SuspensionReason" character varying(300);

                   CREATE TABLE IF NOT EXISTS "PlatformFeatures" (
                        "Key" character varying(80) NOT NULL,
                        "Name" character varying(120) NOT NULL,
                        "Description" character varying(500),
                        "Module" character varying(40),
                        "PriceMonthly" numeric(19,4) NOT NULL DEFAULT 0,
                        "PriceYearly" numeric(19,4) NOT NULL DEFAULT 0,
                        "IsAddOn" boolean NOT NULL DEFAULT true,
                        "IsActive" boolean NOT NULL DEFAULT true,
                        "SortOrder" integer NOT NULL DEFAULT 0,
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                        "UpdatedAt" timestamp with time zone,
                        CONSTRAINT "PK_PlatformFeatures" PRIMARY KEY ("Key")
                   );
                   CREATE TABLE IF NOT EXISTS "PlanFeatures" (
                        "Id" uuid NOT NULL,
                        "PlanId" uuid NOT NULL,
                        "FeatureKey" character varying(80) NOT NULL,
                        "Included" boolean NOT NULL DEFAULT true,
                        "Quota" integer,
                        CONSTRAINT "PK_PlanFeatures" PRIMARY KEY ("Id")
                   );
                   CREATE UNIQUE INDEX IF NOT EXISTS "IX_PlanFeatures_PlanId_FeatureKey"
                        ON "PlanFeatures" ("PlanId", "FeatureKey");
                   CREATE TABLE IF NOT EXISTS "SubscriptionAddOns" (
                        "Id" uuid NOT NULL,
                        "SubscriptionId" uuid NOT NULL,
                        "FeatureKey" character varying(80) NOT NULL,
                        "PricePaid" numeric(19,4) NOT NULL DEFAULT 0,
                        "BillingCycle" character varying(20),
                        "StartsAt" timestamp with time zone NOT NULL DEFAULT now(),
                        "EndsAt" timestamp with time zone,
                        "IsActive" boolean NOT NULL DEFAULT true,
                        "Note" character varying(200),
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                        CONSTRAINT "PK_SubscriptionAddOns" PRIMARY KEY ("Id")
                   );
                   CREATE INDEX IF NOT EXISTS "IX_SubscriptionAddOns_SubscriptionId_FeatureKey"
                        ON "SubscriptionAddOns" ("SubscriptionId", "FeatureKey");
                   CREATE TABLE IF NOT EXISTS "ScheduledJobs" (
                        "Id" uuid NOT NULL,
                        "JobKey" character varying(60) NOT NULL,
                        "Name" character varying(120) NOT NULL,
                        "Description" character varying(400),
                        "IntervalMinutes" integer NOT NULL DEFAULT 1440,
                        "PreferredMinuteOfDay" integer,
                        "IsEnabled" boolean NOT NULL DEFAULT true,
                        "LastRunAt" timestamp with time zone,
                        "NextRunAt" timestamp with time zone,
                        "LastStatus" character varying(20),
                        "LastMessage" character varying(1000),
                        "ConsecutiveFailures" integer NOT NULL DEFAULT 0,
                        "CreatedAt" timestamp with time zone NOT NULL DEFAULT now(),
                        "UpdatedAt" timestamp with time zone,
                        CONSTRAINT "PK_ScheduledJobs" PRIMARY KEY ("Id")
                   );
                   CREATE UNIQUE INDEX IF NOT EXISTS "IX_ScheduledJobs_JobKey"
                        ON "ScheduledJobs" ("JobKey");
                   CREATE TABLE IF NOT EXISTS "JobRuns" (
                        "Id" uuid NOT NULL,
                        "ScheduledJobId" uuid NOT NULL,
                        "JobKey" character varying(60) NOT NULL,
                        "StartedAt" timestamp with time zone NOT NULL DEFAULT now(),
                        "FinishedAt" timestamp with time zone,
                        "Status" character varying(20) NOT NULL DEFAULT 'Running',
                        "Message" character varying(2000),
                        "WasManual" boolean NOT NULL DEFAULT false,
                        "TriggeredByUserId" uuid,
                        "DurationMs" bigint NOT NULL DEFAULT 0,
                        CONSTRAINT "PK_JobRuns" PRIMARY KEY ("Id")
                   );
                   CREATE INDEX IF NOT EXISTS "IX_JobRuns_JobKey_StartedAt"
                        ON "JobRuns" ("JobKey", "StartedAt");
                   ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "DppScheme" integer NOT NULL DEFAULT 0;
                   ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "IsLuxuryGood" boolean NOT NULL DEFAULT false;
                   ALTER TABLE "Products" ADD COLUMN IF NOT EXISTS "PPnBMRate" numeric(5,2) NOT NULL DEFAULT 0;
                   ALTER TABLE "SalesInvoiceLines" ADD COLUMN IF NOT EXISTS "DppScheme" integer NOT NULL DEFAULT 0;
                   ALTER TABLE "SalesInvoiceLines" ADD COLUMN IF NOT EXISTS "DppAmount" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE "SalesInvoiceLines" ADD COLUMN IF NOT EXISTS "PPnBMAmount" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE "PurchaseBillLines" ADD COLUMN IF NOT EXISTS "DppScheme" integer NOT NULL DEFAULT 0;
                   ALTER TABLE "PurchaseBillLines" ADD COLUMN IF NOT EXISTS "DppAmount" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE "PurchaseBillLines" ADD COLUMN IF NOT EXISTS "PPnBMAmount" numeric(19,4) NOT NULL DEFAULT 0;
                   ALTER TABLE "ReceiptVouchers" ADD COLUMN IF NOT EXISTS "CompanyId" uuid;
                   ALTER TABLE "PaymentVouchers" ADD COLUMN IF NOT EXISTS "CompanyId" uuid;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsCustomer" boolean NOT NULL DEFAULT true;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsVendor" boolean NOT NULL DEFAULT false;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsEmployee" boolean NOT NULL DEFAULT false;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsTaxParty" boolean NOT NULL DEFAULT false;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "Nik" character varying(16);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "PtkpStatus" character varying(10);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BpjsKetenagakerjaanNumber" character varying(50);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BpjsKesehatanNumber" character varying(50);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BankName" character varying(50);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BankAccountNumber" character varying(50);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "BankAccountHolder" character varying(100);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "WithholdingType" character varying(50);
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "WithholdingRate" numeric(5,2) NOT NULL DEFAULT 0;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "HasWithholdingExemption" boolean NOT NULL DEFAULT false;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "ExemptionExpiryDate" date;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "IsPkp" boolean NOT NULL DEFAULT false;
                    ALTER TABLE "Contacts" ADD COLUMN IF NOT EXISTS "PkpDate" date;
                    ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "RateType" integer NOT NULL DEFAULT 1;
                    ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "KmkNumber" character varying(100);
                    ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "ValidFrom" date;
                    ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "ValidTo" date;
                    ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "Provenance" character varying(200);
                    ALTER TABLE "ExchangeRates" ADD COLUMN IF NOT EXISTS "IsLockedByPostedEntry" boolean NOT NULL DEFAULT false;
                    UPDATE "Contacts" SET "IsCustomer" = true WHERE "Type" IN (0, 2) AND "IsCustomer" = false;
                    UPDATE "Contacts" SET "IsVendor" = true WHERE "Type" IN (1, 2) AND "IsVendor" = false;
                    UPDATE "Contacts" SET "IsTaxParty" = true WHERE "TaxId" IS NOT NULL AND "TaxId" != '' AND "IsTaxParty" = false;
                   UPDATE "Plans" SET "Modules" = '["accounting","tax","inventory","fixedAssets"]' WHERE "Modules" IS NULL;
                   UPDATE "AuditLogs"
                   SET "CompanyId" = (
                       SELECT uc."CompanyId"
                       FROM "UserCompanies" uc
                       WHERE uc."UserId" = "AuditLogs"."UserId"
                   )
                   WHERE "CompanyId" IS NULL
                     AND "UserId" IS NOT NULL
                      AND (
                          SELECT COUNT(*)
                          FROM "UserCompanies" uc
                          WHERE uc."UserId" = "AuditLogs"."UserId"
                      ) = 1;
                    INSERT INTO "Accounts" ("Id", "CompanyId", "Code", "Name", "Type", "AccountGroup", "Level", "IsHeader", "NormalBalance", "CurrentBalance", "Description", "IsSystemDefault", "IsActive", "CreatedAt")
                    SELECT gen_random_uuid(), c."Id", '5-9000', 'Inventory Variance', 'Expense', 'CostOfSales', 2, false, 'Debit', 0, 'Selisih Persediaan', true, true, NOW()
                    FROM "Companies" c
                    WHERE NOT EXISTS (
                        SELECT 1 FROM "Accounts" a WHERE a."CompanyId" = c."Id" AND a."Code" = '5-9000'
                    );

                    INSERT INTO "TaxRates" ("Id", "CompanyId", "Name", "Rate", "DppScheme", "EffectiveFrom", "EffectiveTo", "IsActive", "IsSystemDefault", "CreatedAt")
                    SELECT gen_random_uuid(), NULL, 'PPN 11% (UU HPP)', 11.00, 1, '2022-04-01', '2024-12-31', true, true, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM "TaxRates" WHERE "Name" = 'PPN 11% (UU HPP)');

                    INSERT INTO "TaxRates" ("Id", "CompanyId", "Name", "Rate", "DppScheme", "EffectiveFrom", "EffectiveTo", "IsActive", "IsSystemDefault", "CreatedAt")
                    SELECT gen_random_uuid(), NULL, 'PPN 12% (PMK 131/2024)', 12.00, 0, '2025-01-01', NULL, true, true, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM "TaxRates" WHERE "Name" = 'PPN 12% (PMK 131/2024)');

                    INSERT INTO "TaxRates" ("Id", "CompanyId", "Name", "Rate", "DppScheme", "EffectiveFrom", "EffectiveTo", "IsActive", "IsSystemDefault", "CreatedAt")
                    SELECT gen_random_uuid(), NULL, 'PPN 12% Luxury (Standard DPP)', 12.00, 1, '2025-01-01', NULL, true, true, NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM "TaxRates" WHERE "Name" = 'PPN 12% Luxury (Standard DPP)');
                 