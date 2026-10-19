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
Fixed Assets (depreciation), Tax and Payroll (salary expense, PPh 21, BPJS)
qualify. CRM, attendance and storefronts do not. The moat is Indonesian
compliance (PPN, PPh, e-Faktur, Coretax, PSAK). `ModuleEntitlementService`
gates modules by plan: `accounting`, `tax`, `inventory`, `fixedAssets`,
`payroll`. `UnbuiltModules` is empty.

## Accounting integrity

- `Sum(Debit) == Sum(Credit)`, compared with `!=`. No tolerance.
- Money is `decimal`; `float`/`double` are not used for money. Rounding is
  `MidpointRounding.ToEven` unless a regulation says otherwise.
- Journal status: `0 Draft`, `1 Posted`, `2 Void`. Posted and Void entries
  reject `PUT` (`POSTED_IMMUTABLE`, `VOID_IMMUTABLE`). Corrections use
  `POST /{id}/void` or `POST /{id}/reverse` (swapped Dr/Cr, `REV-` prefix,
  created as Draft). Only Drafts are deletable.
- Tenant isolation: `CompanyScopeMiddleware` reads `X-Company-Id`, verifies
  membership in `UserCompanies`, and sets `ApplicationDbContext.CurrentCompanyId`.
  Platform administrators are barred from silent bypass: access requires an active
  customer-consented `SupportAccessGrant` or explicit break-glass emergency header
  (`X-Break-Glass-Reason`), both logged to the audit log. Global query filters compare
  `CompanyId == CurrentCompanyId`, so a missing scope returns no rows. Entities
  without a filter must be queried with an explicit `CompanyId` predicate.
- Sessions and Tokens: JWT tokens (15-minute access token) and rotating refresh
  tokens (30-day session) are transmitted via `HttpOnly`, `SameSite=Lax` cookies.
  Refresh tokens are stored as SHA-256 hashes in `UserSessions`. Presentation of an
  already-revoked token triggers reuse breach detection and revokes all active sessions.
  The access lifetime is `Jwt:AccessTokenMinutes` (default 15), read by `JwtService`
  for both the token and its cookie; validation allows 30 s of clock skew. Access
  tokens are not checked against `UserSessions`, so revocation (logout, reuse,
  password reset) ends renewal and a token already issued works until it expires.
  An `Authorization` header takes precedence over the access cookies.
  The frontend keeps the access token in localStorage as well (the UI reads its
  claims with `parseJwt`, which ignores `exp`). `sessionFetch` in `lib/api-client.ts`
  answers a 401 with `POST /api/Auth/refresh` (refresh cookie, no body token) and
  repeats the call once; refreshes are serialised across tabs with the Web Locks
  API because a second use of a rotated token revokes every session. A refused
  refresh sends the user to `/login` (`/sys-control/login` for the admin client).
  Login calls must use `credentials: "include"` or the cookies are never stored.
- Segregation of duties: `Company.EnforceSegregationOfDuties` (default true)
  blocks the creator of an entry from posting it.
- Discounts & FX Conversion: Sales invoice discounts post to contra-revenue (`4-4000 Sales Discounts`, Dr),
  purchase bill discounts post to contra-expense (`5-5000 Purchase Discounts`, Cr). Invoices/bills in foreign
  currencies convert line amounts, discounts, and taxes by `ExchangeRate` to post GL in base IDR.
- Opening Stock: Product creation with opening inventory posts a balanced journal (Dr `1-1400 Inventory`,
  Cr `3-9000 Opening Balance Equity`) linked to `InventoryLedger`.
- Fixed Assets: Initial `BookValue` equals `AcquisitionCost`. Acquisition posting via `POST /api/assets/{id}/post-acquisition`
  creates Dr Asset / Cr Cash or Payable journal entry and transitions asset to Active.

### Choke points

| Concern | Where | Covers |
|---|---|---|
| Tenant stamp, account resolution, balance, immutability, status transitions | `ApplicationDbContext.SaveChangesAsync` → `ApplicationDbContext.LedgerGuards.cs` | every writer; throws `LedgerIntegrityException` (400 with a `code`) |
| Journal quota, audit rows | same method | every writer |
| Balance of Posted entries in the database | PostgreSQL deferred constraint triggers (`EnforceLedgerBalanceInDatabase`) | anything, including raw SQL. Not present on SQLite |
| Period lock | `IPeriodLockService.ValidateTransactionDate`, called by each controller/service | **only the callers that remember** (14 files). Throws `PeriodLockedException` (400 `PERIOD_LOCKED`) |
| Tenant scope | `CompanyScopeMiddleware` + query filters | reads. `Companies` has no filter: look it up by `CurrentCompanyId` |
| Permissions | `[RequiresPermission]` → `PermissionFilter` | per action. `PermissionCoverageTests` fails on any action without one, other than the listed self-service ones |
| Plan limit → 402 | `PlanLimitMiddleware` | |
| Exceptions → JSON | `ApiExceptionMiddleware` | no stack trace outside Development |

A new posting path must call the period lock itself. `JournalLine.AccountId`
is stored as the account **Code**; the choke point converts an account Id to
its Code and rejects unknown or foreign accounts. For the same reason an
account with journal lines cannot change its code or be deleted
(`ACCOUNT_CODE_IN_USE`, `ACCOUNT_IN_USE`); deactivate it instead. Reports
include inactive accounts that still hold a balance. Do not call the synchronous
`SaveChanges()` on ledger entities (it throws): the guards are async.

### Audit trail & document history

`SaveChangesAsync` writes `AuditLogs` rows for Accounts, JournalEntries,
JournalLines, Contacts, Products, SalesInvoices, PurchaseBills, FixedAssets,
EmployeeCompensations, PayrollRuns.
`DocumentHistoryEvents` records append-only business document lifecycles (Created, Updated,
Posted, Voided, Reversed, Rejected, AcquisitionPosted, Disposed) secured with cryptographic
SHA-256 hash chaining (`RowHash`, `PreviousHash`) compliant with UU KUP Pasal 28.
`GET /api/documents/{documentType}/{id}/history` returns the timeline for any document.
`GET /api/audit-logs/events` provides multi-criteria filterable query over audit events.
`AuditPrune` enforces Indonesian statutory 10-year retention (3,650 days) under UU KUP Pasal 28:
any configuration specifying less than 3,650 days is rejected.

### In-app support ticketing & diagnostic consent

Tenants can raise support requests via `SupportTicketsController` (`/api/support/tickets`).
Platform engineers triage via `AdminSupportTicketsController` (`/api/admin/support/tickets`).
Under UU KUP and tenant isolation safeguards, support staff cannot inspect financial data
without consent: ticket creation allows tenants to check a 24-hour diagnostic consent box,
which issues a temporary `SupportAccessGrant` scoped strictly to support technicians.

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
PPh 21 in the withholding summary comes from posted payroll runs.
Not implemented: Coretax integration, faktur pajak numbering (NSFP is
entered, never generated), real bukti potong numbers.
Several outputs are derived from bills at report time rather than from the
ledger. Missing faktur numbers and bukti potong numbers are reported as
missing, never generated. Tax logic needs practitioner review before reliance.

## Financial statements and reports

`GET /api/Reports/financial-statements?start=&end=&comparative=`
(`FinancialStatementsService`) builds the statement set from posted lines:
financial position, profit or loss and OCI, changes in equity, cash flows
(indirect), trial balance. Every label is bilingual: `Account.NameId` is the
Indonesian name (default accounts take it from the seeded description),
`Account.Name` the English. Each statement carries arithmetic checks that
must pass (assets = liabilities + equity, equity roll-forward, closing cash =
cash accounts, Dr = Cr). Classification is by code: `1-11` cash, `1-1`
current assets, other `1` non-current (credit-normal ones are contra, e.g.
accumulated depreciation), `2-1` current liabilities, `3` equity, `4`
revenue, `5` cost of revenue, `6` operating expenses, `7` other income,
`8`/`9` other expenses, `8-5000` income tax. Unclosed profit shows as
retained earnings (before the fiscal year) and profit for the year.

The page `reports/financial-statements` prints A4 (Indonesian left, figures,
English right; reversible or monolingual) and exports Excel. Printing works
from any dashboard page: the shell and sidebar are released under `print:`.
`GET /api/Reports/cash-position` serves the cash dashboard.
`TradeReportsController` serves `sales-by-customer`, `sales-by-product`
(with cost of sales from the invoices' stock movements), `purchases-by-vendor`
and `purchases-by-product` for `?start=&end=`: posted documents only, net of
PPN, totalled in decimal per currency. The older
`/Reports/cash-flow` endpoint still classifies by account name and does not
reconcile; the statements endpoint does.

## Payroll

`PayrollController` (`/api/Payroll`, module `payroll`, permissions
`Payroll.View` / `Payroll.Manage` / `Payroll.Approve`), `PayrollService`,
`PayrollCalculator`. Employees are Contacts with `IsEmployee`; PTKP, NIK and
bank details live on the contact, pay on `EmployeeCompensation`.

- One live run per month (filtered unique index; a Void run steps aside).
  Draft → Posted → Void. Posting checks the period lock, segregation of duties
  (the calculator cannot post), and refuses `RUN_STALE` when a fresh
  calculation differs from the draft. Voiding is refused while a later month
  of the same year is posted (its December settlement depends on it).
- Entry: Dr `6-1100` earnings, Dr `6-1110` employer BPJS; Cr `2-1410` PPh 21,
  Cr `2-1510` BPJS (both sides), Cr `2-1500` net pay. `ReferenceDataSeeder`
  adds the three new accounts to existing companies.
- PPh 21: TER (PP 58/2023) January–November on gross including employer JKK,
  JKM and Kesehatan; December settles under Pasal 17 less TER withheld and may
  be negative. Unknown PTKP is withheld as TK/0 with a warning.
- BPJS: JKK (per-employee rate), JKM 0.3 %, JHT 3.7/2 %, JP 2/1 %, Kesehatan
  4/1 %. Wage caps are configuration: `Payroll:JpWageCap` (default 10,547,400)
  and `Payroll:KesehatanWageCap` (12,000,000). Update them when they change.
- Not handled: leavers mid-year (no final-month annualisation), PPh 26,
  NPWP/NIK surcharge, THR and bonus treatment beyond "other earnings",
  1721-A1, payslips, bank transfer files. Needs practitioner review.

## Inventory and warehouses

Every stock change goes through `InventoryLedger` (`MoveAsync`, `ReverseAsync`,
`TransferAsync`): it updates `Product.StockOnHand` and writes an
`InventoryMovement` carrying a `WarehouseId`. Stock per warehouse is the sum
of movements; `StockOnHand` is the company total. Sales invoices, purchase
bills, purchase orders and stock opname take an optional `WarehouseId`; none
means the company's default warehouse (created as `MAIN` when missing; one per
company, `DEFAULT_WAREHOUSE`). Outflows are refused with `NEGATIVE_STOCK` /
`INSUFFICIENT_STOCK` per warehouse. A warehouse holding stock cannot be
deleted (`WAREHOUSE_IN_USE`). `ReferenceDataSeeder` assigns older movements
to the default warehouse and adds an `OpeningBalance` for any gap.

Valuation is moving-average cost, company-wide. `Product.InventoryValue` is
the carrying value and `AverageCost` the unit cost; only `InventoryLedger`
changes them. `MoveAsync` takes the signed value change (`totalCost`): the
net purchase amount for a receipt, the original value for a reversal, null
for an issue at the average. The movement's `TotalCost` is what the caller
posts, so COGS, adjustments and opname equal the stock they move. An issue
that empties the stock takes the whole value. A purchase order receipt adds
stock at the order price and posts Dr inventory, Cr `2-1150` Goods Received
Not Invoiced (period-locked, `MISSING_ACCOUNT` without the accounts). The
bill for a received order debits `2-1150` with the receipt value, puts the
price difference on inventory with a value-only movement, and its void
restores both. Receipts made before this journal existed are billed the old
way, straight to inventory. Transfers carry no
value. Reports: `GET /api/Reports/inventory-movements` (stock card),
`/inventory-aging` (receipt dates), `/inventory-valuation`.

## Fixed assets

Commercial depreciation is `AssetChargeService` (straight line, posted
monthly). Tax depreciation is separate: each asset and category carries a
`FiscalGroup` (Kelompok 1–4, permanent / non-permanent building, not
depreciable) and `FiscalMethod`, and `FiscalDepreciation` computes the
schedule under Pasal 11 as amended by UU HPP (from the month of acquisition,
straight line or double-rate declining balance with the remainder in the last
year, buildings straight line, whole rupiah, disposal stops at the month
before). `GET /api/Assets/fiscal-depreciation?year=` sets it beside the
commercial charge per asset and group (Lampiran 1A), and
`TaxAnalysisService.ReconcileAsync` adds the difference, including book value
written off on disposal, as correction `ASET`. Assets without a group are left
out and counted. `POST /api/Assets/{id}/dispose` posts Dr accumulated
depreciation, Dr proceeds (`proceedsAccountId`), Cr cost, gain `7-3000` or
loss `8-4000`; it checks the period lock and refuses a date before
depreciation already charged (`DEPRECIATED_PAST_DISPOSAL`). Fiscal rules need
practitioner review.

## Payments

`PaymentService` is gateway-agnostic; gateways implement `IPaymentGateway`
(`ManualPaymentGateway`, `MidtransPaymentGateway`). `Payments:Provider`
chooses one; an unconfigured choice falls back to manual transfer. Checkout
(`POST /api/Subscriptions/upgrade`) saves a Pending `Payment` before calling
the gateway. Notifications arrive at `POST /api/payments/webhook/{provider}`
(anonymous; rejected with 401 unless the signature verifies and the amount
equals the payment). Manual transfers are confirmed by a platform admin
(`POST /api/admin/payments/{id}/confirm`). Success activates the plan once.
A new gateway is one class plus a registration in `Program.cs`.

## Frontend conventions

- Server state belongs in TanStack Query (`staleTime` 30 s, `gcTime` 10 min,
  `components/providers/query-provider.tsx`). 25 files use it so far;
  about 70 still call `apiClient` from `useEffect`. New code uses Query.
- Reach the API through `apiClient` (JSON) or `sessionFetch` (blobs, FormData),
  never a bare `fetch`: only those renew the 15-minute access token on a 401.
- No screen may render sample data. `lib/data/*` was deleted; an empty
  result is shown as empty, a failed request as an error.
- `VirtualDataTable` (`components/ui/virtual-data-table.tsx`) for large lists.
  Server paging (`?page=&pageSize=&search=&status=`) exists on journal entries
  and audit logs only. The general ledger report is unpaged.
- Money uses `.font-money` or sits in a `<table>`. Do arithmetic on money in
  integer minor units or a decimal library, not JS floats.
- Gate every write control with `useCan()(PERMISSIONS.X)` or `<RBACGuard>`
  (`components/auth/rbac-guard.tsx`), using the permission the endpoint
  requires. A page that exists only to perform an action uses `NoPermission`
  as the guard's fallback.
- `⌘K` palette: `components/command-palette.tsx`, mounted in
  `app/dashboard/layout.tsx`.
- The hub: `app/dashboard/(hub)/page.tsx`. Doors and entitlement from
  `GET /api/Dashboard/modules`, status and figures from
  `GET /api/Dashboard/module-health` (`ModuleHealthService`). Accounting is the
  anchor card; the other four sit beneath it. Workspaces live under
  `app/dashboard/(workspace)`.
- Query keys for the hub and payroll carry the company id and wait for a
  selected company; switching company resets the query cache
  (`contexts/company-context.tsx`).

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
4. Payroll: leavers, THR, 1721-A1, bank transfer files.

## Known issues

Details and evidence: `docs/AUDIT-2026-10.md`.

| Issue | Where |
|---|---|
| Withholding (PPh 22/23/4(2)) is not journaled; reports derive from bills | `TaxReportsService` |
| PPN: luxury goods/PPnBM never computed, `TaxRates` table unused, rounding rule unconfirmed, kurang/lebih bayar accounts unconfirmed | tax services |
| Payroll: no leaver annualisation, PPh 26 or 1721-A1; BPJS wage caps are configuration that must be kept current | `PayrollCalculator` |
| Historical journal lines may hold an account Id instead of a Code and be invisible to reports | database (detection query in the audit report) |
| `deploy.yml` calls `scripts/deploy.ps1`, which is gitignored | `.github/workflows/deploy.yml` |
| About 70 files fetch with `useEffect` instead of TanStack Query | frontend |
| Midtrans is implemented but untested against the live sandbox; no recurring billing or auto-renew | `MidtransPaymentGateway` |
| `npm run lint` fails: 444 errors, mostly `no-explicit-any` | frontend |
| `.text-gradient` in 40 files, shadows on in-flow cards (57 uses in 20 files under `app/dashboard`, plus `card.tsx`, `tabs.tsx`), raw hex (31 uses in `components/dashboard`) | frontend |
| i18n covers navigation labels only | frontend |
