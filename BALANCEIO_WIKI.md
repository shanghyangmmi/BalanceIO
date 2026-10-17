# BalanceIO architecture

Operating rules for contributors live in `CLAUDE.md`. This file describes
how the system is put together.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui | `output: "export"`; static files, served separately from the API |
| API | .NET 8 Web API, controllers | Swagger in Development only |
| Data | EF Core 8; SQLite (non-Production), PostgreSQL (Production) | Provider is chosen by `IsProduction()` in `Program.cs` |
| Auth | JWT bearer; Argon2id password hashes (`Konscious`); optional TOTP (`Otp.NET`) | Custom `User` table, not ASP.NET Identity |
| Email / files | MailKit SMTP; S3-compatible object storage (`AWSSDK.S3`) | Both optional; boot continues without them |

The production deployment is a Windows VPS driven by `.github/workflows/deploy.yml`
(self-hosted runner). The workflow calls `scripts/deploy.ps1`, which is gitignored
and therefore not in this repository.

## Backend layout

```
Controllers/   HTTP surface; Admin/ holds SuperAdmin endpoints
Services/      posting engines, tax, reconciliation, licensing, jobs
Models/        EF entities
DTOs/          response/request shapes for newer endpoints
Data/          ApplicationDbContext, DefaultCoASeeder
Middleware/    Maintenance, Suspension, PlanLimit, CompanyScope, RequestMetrics
Security/      SecretsBootstrap, permissions, Argon2 hasher
Migrations/    EF migrations (Npgsql snapshot)
```

Pipeline order (`Program.cs`): metrics, CORS, maintenance, authentication,
authorization, suspension, plan-limit, company scope, controllers.

## Tenancy and roles

`UserCompany(UserId, CompanyId, Role)` with roles `Owner`, `Manager`,
`Staff`, `Viewer` (`RolePermissions`). A platform admin (`User.IsAdmin`,
JWT role `SuperAdmin`) may scope to any company. Permissions are checked per
action with `[RequiresPermission(Permissions.X)]`.

## Ledger

`JournalEntries` (header, status Draft/Posted/Void, SoD fields) and
`JournalLines` (`AccountId` string, `Debit`, `Credit`, both `decimal(19,4)`).
Reports aggregate lines by account code.

Invariants are enforced in `ApplicationDbContext.SaveChangesAsync` (tenant
stamp, account resolution, balance, immutability, plan quota, audit rows), by
PostgreSQL constraint triggers (balance), and in controllers (period lock,
segregation of duties). See `CLAUDE.md`.

`POST /api/JournalEntries` honours `X-Idempotency-Key`.

## Modules

| Module | Posts to GL | State |
|---|---|---|
| Accounting | yes | journals, CoA, ledger, statements, budgets, recurring entries, bank reconciliation |
| Sales / Purchases | yes | invoices, bills, receipt and payment vouchers, purchase orders |
| Inventory | COGS, opname variance | products, movements, stock opname |
| Fixed Assets | depreciation | register, depreciation, disposal, revaluation |
| Tax | settlement journal | see `CLAUDE.md` |
| Payroll | salary expense, PPh 21, BPJS | compensation, monthly runs, TER and December settlement, posting and void; see `CLAUDE.md` |

Plans gate modules through `ModuleEntitlementService`; the licensing catalogue
(`PlatformFeature`, `PlanFeature`, `SubscriptionAddOn`) is platform-wide.
Billing (Midtrans) is a stub: `SubscriptionsController` returns a "coming soon"
response.

## Operations

`ScheduledJobRunner` (hosted service) runs jobs from `ScheduledJobs`
(`backup`, `exchange-rates`, `subscription-sweep`, `audit-prune`). `DatabaseBackupService` and
`BackupController` back up the SQLite file. `ServerMetricsService` feeds the
admin dashboard. `MaintenanceMiddleware` returns 503 when maintenance mode is on.

## Frontend layout

```
src/app/          routes; dashboard/(hub) and dashboard/(workspace)
src/components/   ui/ primitives, landing/, dashboard/, accounting/, ...
src/lib/          api-client.ts (fetch wrapper, auth + X-Company-Id headers), types, utils
src/contexts/     language (nav labels only)
```

`api-client.ts` attaches the JWT from `localStorage`, `X-Company-Id` from
`selectedCompanyId`, shows a toast on every failed request, and redirects to
`/maintenance` on 503.
