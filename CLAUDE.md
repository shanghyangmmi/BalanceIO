# BalanceIO

Accounting and bookkeeping platform for the Indonesian market. .NET 8
Web API + Next.js 16 frontend, multi-tenant, SQLite in development and
PostgreSQL in production.

```
backend/src/BalanceIO.API/   .NET 8 · EF Core · Controllers, Services, Models
frontend/                    Next.js 16 · App Router · static export
BALANCEIO_WIKI.md            longer-form project documentation
```

`frontend/CLAUDE.md` and `frontend/DESIGN-SYSTEM.md` cover everything
visual. Read those before touching the UI.

**Run everything:** `start-dev.bat` (backend on :5210, frontend on :3000).

---

## Product scope — the rule that decides what gets built

BalanceIO is **accounting-first**, not an ERP. It already carries
Inventory, Fixed Assets and Projects, which puts it in light-ERP
territory, but breadth is not the strategy.

A module earns its place only if it answers yes to one question:

> **Does it post to the general ledger?**

| Qualifies | Does not |
|---|---|
| Inventory (produces COGS) | CRM — a sales pipeline generates no journal |
| Fixed Assets (depreciation) | Attendance / leave management |
| Payroll (salary expense, PPh 21) | Website or storefront building |
| Manufacturing (in principle — too complex for now) | |

The reasoning behind the rule: a shallow module damages trust in the
deep ones. In most categories that is a disappointment; in accounting
software the stakes are audit and tax, so trust *is* the product.

The defensible moat is **Indonesian compliance** — Coretax, e-Faktur,
PPN, PPh, PSAK. Foreign competitors will not do this work seriously.
It is also currently the weakest module.

---

## Accounting integrity — non-negotiable

- **Double entry is exact.** `Sum(Debit) == Sum(Credit)`, compared with
  `!=`, never a tolerance. A `0.0001m` tolerance was removed
  deliberately.
- **Money is `decimal`.** `float`/`double` are banned throughout. Use
  Bankers rounding (`MidpointRounding.ToEven`).
- **Posted entries are immutable.** `PUT` on a Posted or Void entry
  returns `POSTED_IMMUTABLE` / `VOID_IMMUTABLE`. Corrections go through
  `POST /{id}/void` or `POST /{id}/reverse` (Dr/Cr swapped, `REV-`
  prefix, lands as Draft). Only Draft entries are deletable.
- **Period locking.** `PeriodLockService` rejects transactions dated
  inside a locked period. Call it from any new posting path.
- **Audit trail is append-only.** `AuditService` records mutations.

Journal status enum: `0 = Draft, 1 = Posted, 2 = Void`.

---

## Frontend conventions

- **TanStack Query owns server state.** 30s `staleTime`, 10min
  `gcTime`. Do not reintroduce `useEffect` + `fetch` — that pattern
  caused a skeleton flash on every navigation and was removed.
- **Large tables are virtualised** (`VirtualDataTable`, TanStack
  Virtual). Journal and ledger endpoints support
  `?page=&pageSize=&search=&status=`.
- **Money always uses `.font-money`** or sits in a `<table>` — tabular,
  lining, slashed-zero numerals.
- `⌘K` command palette is global inside `/dashboard`.
- Motion, colour semantics and typography: see `frontend/CLAUDE.md`.

---

## Known issues

| Issue | Where | Notes |
|---|---|---|
| **`Jwt.Key` hard-coded in `appsettings.json`** | backend | Anyone with the repo can forge a token for any user. Move to an environment variable and keep it out of git. **Highest-priority security item.** |
| `.text-gradient` heading pattern | 44 files in `frontend/src/app/dashboard` | Legacy. Canonical is a Merriweather display heading with one italic gradient span. Fix incrementally. |
| `shadow-sm` on in-flow cards | `card.tsx`, `tabs.tsx`, ~22 dashboard files | Contradicts the hairline rule in the design system. |
| Raw hex colours | 31 in `components/dashboard`, 7 in `app/dashboard` | Do not respond to the theme. Replace with semantic tokens. |
| Serif mis-mapped in Claude Design | design system export | Reports `Cambria (--font-serif)`; the real display serif is **Merriweather** via `--font-document-serif`. |
| `ledger-core.tsx` | `frontend/src/components/landing` | Dead code since the hero was rebuilt. Safe to delete. |
| i18n covers nav labels only | frontend | Everything else is hardcoded English. |
| `journal/edit/page.tsx` hardcodes `status: "POSTED"` | frontend | Contract drift; should map the real status. |

---

## Model-only entities — built but unreachable

These have EF models and database tables, but no controller and no UI.
Finishing them adds real capability at low cost and is the recommended
next work:

`SalesOrder` · `CreditNote` · `DeliveryOrder` · `GoodsReceipt` ·
`PaymentVoucher`

---

## Roadmap

1. **Finish the model-only entities above.** Cheapest capability gain
   available.
2. **Deepen tax compliance.** e-Faktur export, faktur pajak numbering,
   PPh 21/23 withholding automation, Coretax readiness. This is the
   moat.
3. **Bank reconciliation.** The single biggest daily pain for anyone
   keeping books. Watch for: Indonesian number format (`1.234.567,89`),
   import de-duplication, timing differences, bank-side sign
   convention, transfer fees, statement continuity, and VA numbers
   buried in free-text descriptions.
4. **Payroll.** Qualifies under the ledger rule, and PPh 21 / BPJS are
   compliance problems.

None of steps 1–3 add a new module — and they are what users will feel
most.

### Module hub (agreed, not yet built)

`/dashboard` becomes a map of the five modules rather than a KPI
dashboard. Each card shows that module's **balance state** and doubles
as its entry point.

| Module | In balance when |
|---|---|
| Accounting | Dr = Cr, nothing unposted, period lock current |
| Payroll | staff paid, PPh 21 accrued — **not built, show inactive** |
| Inventory | book quantity matches the last stock count |
| Fixed Assets | depreciation posted through the current period |
| Tax | PPN output/input reconciled, no filing overdue |

Backend supplies this in one call (`GET /Dashboard/module-health`) so
the figures are computed server-side and stay consistent with the
reports. Accounting logic does not belong in the frontend.

Build order agreed: hub first, then Accounting and Tax as pilot
modules, so the pattern is proven twice before it is replicated.
