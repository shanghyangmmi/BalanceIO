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

# backend tests (xUnit, real pipeline on a throwaway SQLite file)
dotnet test backend/tests/BalanceIO.API.Tests
# add the PostgreSQL migration/trigger tests (they skip when this is unset):
BALANCEIO_TEST_POSTGRES="Host=localhost;Username=postgres;Password=..." dotnet test backend/tests/BalanceIO.API.Tests

# frontend (http://localhost:3000; API base is NEXT_PUBLIC_API_URL, default http://localhost:5210/api)
cd frontend && npm ci && npm run dev
npm test           # node:test, money arithmetic
npm run build      # static export to frontend/out
npm run lint       # currently failing, see Known issues
```

There is no launcher script in the repo (`*.bat` is gitignored). In
Development the API calls `EnsureCreated()` and seeds two known-password users
(`DatabaseInitializer`); it never runs migrations, and it does not alter an
existing `balanceio.db`, so delete the file after pulling model changes.
CI (`.github/workflows/ci.yml`) runs the backend tests against PostgreSQL 16.

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
| Tenant stamp, account resolution, balance, immutability, status transitions | `ApplicationDbContext.SaveChangesAsync` → `ApplicationDbContext.LedgerGuards.cs` | every writer; throws `LedgerIntegrityException` (400 with a `code`) |
| Journal quota, audit rows | same method | every writer |
| Balance of Posted entries in the database | PostgreSQL deferred constraint triggers (`EnforceLedgerBalanceInDatabase`) | anything, including raw SQL. Not present on SQLite |
| Period lock | `IPeriodLockService.ValidateTransactionDate`, called by each controller/service | **only the callers that remember** (15 files). Throws `PeriodLockedException` (400 `PERIOD_LOCKED`) |
| Tenant scope | `CompanyScopeMiddleware` + query filters | reads. `Companies` has no filter: look it up by `CurrentCompanyId` |
| Permissions | `[RequiresPermission]` → `PermissionFilter` | per action. `PermissionCoverageTests` fails on any action without one, other than the listed self-service ones |
| Plan limit → 402 | `PlanLimitMiddleware` | |
| Exceptions → JSON | `ApiExceptionMiddleware` | no stack trace outside Development |

A new posting path must call the period lock itself. `JournalLine.AccountId`
is stored as the account **Code**; the choke point converts an account Id to
its Code and rejects unknown or foreign accounts. Do not call the synchronous
`SaveChanges()` on ledger entities (it throws): the guards are async.

### Audit trail

`SaveChangesAsync` writes `AuditLogs` rows for Accounts, JournalEntries,
JournalLines, Contacts, Products, SalesInvoices, PurchaseBills, FixedAssets.
`AuditService` records explicit events. Nothing in the API edits audit rows,
but the `AuditPrune` scheduled job deletes rows older than
`Audit:RetentionDays` when that setting is positive (default 0: off).

## Migrations

Production runs `MigrateAsync()` at boot and stops if it fails. Migrations are
PostgreSQL-only. Generate them with the Npgsql provider, never in
Development (that is how the snapshot once came to carry SQLite types):

```bash
ASPNETCORE_ENVIRONMENT=Production BALANCEIO_JWT_KEY=<32+ chars> \
BALANCEIO_DB_CONNECTION="Host=localhost;Database=scratch;Username=postgres;Password=..." \
dotnet ef migrations add <Name> --project backend/src/BalanceIO.API
```

`MigrationDriftTests` fails when the model and the snapshot differ. Do not add
DDL to `Program.cs` or a controller. Reference rows go in
`ReferenceDataSeeder`. The first platform admin comes from
`BALANCEIO_ADMIN_EMAIL` / `BALANCEIO_ADMIN_PASSWORD` (see `SECRETS.md`).

## Tax module state

Implemented: SPT Masa PPN 1111 summary, e-Faktur CSV export, e-Bupot CSV
export, withholding summary (PPh 21/22/23/4(2)), PPN settlement journal,
ekualisasi PPN, rekonsiliasi fiskal, DER test (PMK-169). Product-level
`DppScheme` (11/12 nilai lain) and PPnBM fields exist.
Not implemented: Coretax integration, faktur pajak numbering (NSFP is
entered, never generated), real bukti potong numbers, payroll-driven PPh 21.
Several outputs are derived from bills at report time rather than from the
ledger. Missing faktur numbers and bukti potong numbers are reported as
missing, never generated. Tax logic needs practitioner review before reliance.

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

Details and evidence: `docs/AUDIT-2026-10.md`.

| Issue | Where |
|---|---|
| Invoice-level and bill-level discount unbalances the journal; refused with `UNBALANCED` | `SalesInvoicesController`, `PurchaseBillsController` |
| Withholding (PPh 22/23/4(2)) is not journaled; reports derive from bills | `TaxReportsService` |
| PPN: luxury goods/PPnBM never computed, `TaxRates` table unused, rounding rule unconfirmed, kurang/lebih bayar accounts unconfirmed | tax services |
| PPh 21 not computed (no payroll) | `TaxReportsService` |
| Historical journal lines may hold an account Id instead of a Code and be invisible to reports | database (detection query in the audit report) |
| `deploy.yml` calls `scripts/deploy.ps1`, which is gitignored | `.github/workflows/deploy.yml` |
| Write actions are not hidden by permission (`RBACGuard` exists, unused); a refused click shows a 403 toast | frontend |
| 91 files fetch with `useEffect` instead of TanStack Query | frontend |
| `npm run lint` fails: 449 errors, mostly `no-explicit-any` | frontend |
| `.text-gradient` in 40 files, shadows on in-flow cards (57 uses in 20 files under `app/dashboard`, plus `card.tsx`, `tabs.tsx`), raw hex (31 uses in `components/dashboard`) | frontend |
| i18n covers navigation labels only | frontend |
