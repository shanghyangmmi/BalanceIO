# BalanceIO

Accounting platform for the Indonesian market. Multi-tenant. .NET 8 Web API
(EF Core; SQLite in Development, PostgreSQL in Production) and a Next.js 16
App Router frontend built as a static export.

```
backend/BalanceIO.sln
backend/src/BalanceIO.API/   Controllers, Services, Models, DTOs, Data, Middleware, Security, Migrations
frontend/                    Next.js app. UI rules: frontend/CLAUDE.md, frontend/DESIGN-SYSTEM.md
BALANCEIO_WIKI.md            architecture overview
SECRETS.md                   environment variables, rotation
```

## Build, run, test

```bash
# backend (http://localhost:5210, Swagger at /swagger, SQLite file balanceio.db in the cwd)
dotnet build backend/BalanceIO.sln
cd backend/src/BalanceIO.API && dotnet run --launch-profile http

# frontend (http://localhost:3000; API base is NEXT_PUBLIC_API_URL, default http://localhost:5210/api)
cd frontend && npm ci && npm run dev
npm run build      # static export to frontend/out
npm run lint
```

There is no launcher script in the repo (`*.bat` is gitignored). In
Development the API calls `EnsureCreated()`, patches missing columns with raw
SQL, and seeds two known-password users (`Program.cs`). Do not rely on that
path to exercise migrations; it never runs them.

Baseline as of this audit: `dotnet build` is clean; `next build` passes;
`npm run lint` fails with 453 errors, 414 of them `no-explicit-any`.

## Scope rule

A module belongs only if it posts to the general ledger. Inventory (COGS),
Fixed Assets (depreciation) and Tax qualify; Payroll qualifies and is not
built. CRM, attendance and storefronts do not. The moat is Indonesian
compliance (PPN, PPh, e-Faktur, Coretax, PSAK). `ModuleEntitlementService`
gates modules by plan: `accounting`, `tax`, `inventory`, `fixedAssets`,
`payroll` (`UnbuiltModules` = payroll).

## Accounting integrity

- `Sum(Debit) == Sum(Credit)`, compared with `!=`. No tolerance.
- Money is `decimal`; `float`/`double` are not used for money. Rounding is
  `MidpointRounding.ToEven` unless a regulation says otherwise.
- Journal status: `0 Draft`, `1 Posted`, `2 Void`. Posted and Void entries
  reject `PUT` (`POSTED_IMMUTABLE`, `VOID_IMMUTABLE`). Corrections use
  `POST /{id}/void` or `POST /{id}/reverse` (swapped Dr/Cr, `REV-` prefix,
  created as Draft). Only Drafts are deletable.
- Tenant isolation: `CompanyScopeMiddleware` reads `X-Company-Id`, verifies
  membership in `UserCompanies` (platform admins excepted), and sets
  `ApplicationDbContext.CurrentCompanyId`. Global query filters compare
  `CompanyId == CurrentCompanyId`, so a missing scope returns no rows. Entities
  without a filter must be queried with an explicit `CompanyId` predicate.
- Segregation of duties: `Company.EnforceSegregationOfDuties` (default true)
  blocks the creator of an entry from posting it.

### Choke points

| Concern | Where | Covers |
|---|---|---|
| Balance of Posted entries, journal quota, audit rows | `ApplicationDbContext.SaveChangesAsync` | every writer |
| Period lock | `IPeriodLockService.ValidateTransactionDate`, called by each controller/service | **only the callers that remember** (15 files) |
| Tenant scope | `CompanyScopeMiddleware` + query filters | reads; writes depend on the writer setting `CompanyId` |
| Permissions | `[RequiresPermission]` → `PermissionFilter` | per action |
| Plan limit → 402 | `PlanLimitMiddleware` catches `PlanLimitExceededException` | |

A new posting path must call the period lock itself and set `CompanyId`.

### Audit trail

`SaveChangesAsync` writes `AuditLogs` rows for Accounts, JournalEntries,
JournalLines, Contacts, Products, SalesInvoices, PurchaseBills, FixedAssets.
`AuditService` records explicit events. Nothing in the API edits audit rows,
but the `AuditPrune` scheduled job deletes rows older than
`Audit:RetentionDays` when that setting is positive (default 0: off).

## Migrations

Production runs `Database.Migrate()` at boot; a failure is logged and boot
continues. Development uses `EnsureCreated()`. `Program.cs` additionally runs
idempotent raw DDL (`ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`) at every
boot on both providers. See the audit report for why this is a liability.
Policy for new schema: add an EF migration generated against Npgsql
(`dotnet ef migrations add`), never a new raw DDL patch.

## Tax module state

Implemented: SPT Masa PPN 1111 summary, e-Faktur CSV export, e-Bupot CSV
export, withholding summary (PPh 21/22/23/4(2)), PPN settlement journal,
ekualisasi PPN, rekonsiliasi fiskal, DER test (PMK-169). Product-level
`DppScheme` (11/12 nilai lain) and PPnBM fields exist.
Not implemented: Coretax integration, faktur pajak numbering (NSFP is
entered, never generated), real bukti potong numbers, payroll-driven PPh 21.
Several outputs are derived from bills at report time rather than from the
ledger. Tax logic needs practitioner review before reliance.

## Frontend conventions

- Server state belongs in TanStack Query (`staleTime` 30 s, `gcTime` 10 min,
  `components/providers/query-provider.tsx`). Only 14 files use it so far;
  91 files still call `apiClient` from `useEffect`. New code uses Query.
- `VirtualDataTable` (`components/ui/virtual-data-table.tsx`) for large lists.
  Server paging (`?page=&pageSize=&search=&status=`) exists on journal entries
  and audit logs only. The general ledger report is unpaged.
- Money uses `.font-money` or sits in a `<table>`. Do arithmetic on money in
  integer minor units or a decimal library, not JS floats.
- `⌘K` palette: `components/command-palette.tsx`, mounted in
  `app/dashboard/layout.tsx`.
- The module hub exists: `app/dashboard/(hub)`, backed by
  `GET /api/Dashboard/module-health` (`ModuleHealthService`). Workspaces live
  under `app/dashboard/(workspace)`.

## Model-only entities

Tables and EF models, no controller, no UI, and no tenant query filter:
`SalesOrder`, `CreditNote`, `DebitNote`, `DeliveryOrder`, `GoodsReceipt`,
`JournalVoucher`, `FundTransfer`. Add the filter in the same change as the
controller. (`PaymentVoucher` and `ReceiptVoucher` have controllers.)

## Roadmap

1. Finish the model-only entities.
2. Tax: real NSFP handling, Coretax readiness, ledger-sourced withholding.
3. Bank reconciliation: exists (`BankReconciliationService`); hardening for
   Indonesian number formats, import de-duplication, timing differences.
4. Payroll.

## Known issues

| Issue | Where |
|---|---|
| Runtime DDL and swallowed migration failure | `Program.cs`, `JournalEntriesController` (GET), `RepairController`, `AdminSystemController` |
| Journal create/update binds the entity; no server-stamped `CompanyId` | `JournalEntriesController` |
| Sales invoice, purchase bill, stock opname, recurring journal create entries without `CompanyId` | those controllers |
| `JournalLine.AccountId` holds an account Code in some writers and an account Id in others; reports key on Code | writers vs `ReportsController` |
| Production seeds `admin@balanceio.id` with a hard-coded password when absent | `Program.cs` |
| 500 handler returns `ex.ToString()`; period-lock violations surface as 500 | `Program.cs` |
| PPh 21 summary uses a fixed sample salary per employee | `TaxReportsService` |
| Deploy workflow sets the API URL with `set` on a self-hosted Windows runner | `.github/workflows/deploy.yml` |
| `.text-gradient` in 40 files, shadows on in-flow cards (57 uses in 20 files under `app/dashboard`, plus `card.tsx`, `tabs.tsx`), raw hex (31 uses in `components/dashboard`) | frontend |
| `components/landing/ledger-core.tsx` is unreferenced | frontend |
| i18n covers navigation labels only | frontend |
| `lint` baseline fails (see above) | frontend |
