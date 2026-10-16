# BalanceIO - Project Wiki & Documentation

| Field | Value |
|-------|-------|
| **Project Name** | BalanceIO |
| **Description** | Professional Accounting Suite (SaaS Ready) |
| **Version** | 0.1.0 (Alpha) |
| **Last Updated** | 2026-02-01 |

---

## 🏗️ 1. System Architecture

### High Level Overview: Hybrid Separation
We utilize a split architecture to combine the best of modern frontend UX with enterprise-grade backend stability, deployed on a Windows Server VPS to minimize cost and maximize I/O performance.

### Tech Stack

| Component | Technology | Rationale | Deployment Strategy |
|-----------|------------|-----------|---------------------|
| **Frontend** | Next.js 16 (App Router) | Static Export, Zero Latency UI | Served via IIS URL Rewrite |
| **UI Library** | Shadcn/UI + Tailwind v4 | Premium "Mewah" Aesthetics | - |
| **Animations** | Framer Motion | Silky smooth micro-animations | - |
| **Backend** | .NET 8 Web API | High Performance Calculation Engine | Self-Contained Executable |
| **Database** | SQLite (Dev) / PostgreSQL 16 (Prod) | Lightweight Dev, "Anti-Lag" Production | Native Windows Service |
| **ORM** | Entity Framework Core | Type-Safe Database Interaction | Code-First Migrations |
| **Notifications** | Sonner | Modern, sleek toast alerts | - |
| **Gateway** | IIS Reverse Proxy | Unified Entry Point (Port 443) | Native Windows |

### Directory Structure
```
BalanceIO/
├── backend/
│   ├── BalanceIO.sln
│   └── src/
│       └── BalanceIO.API/
│           ├── Controllers/      # API endpoints
│           ├── Models/           # Entity models
│           ├── Data/             # DbContext
│           ├── Services/         # Business logic
│           ├── Security/         # Auth helpers
│           └── Migrations/       # EF migrations
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js pages
│   │   ├── components/           # React components
│   │   └── lib/                  # Utilities
│   └── package.json
└── start-dev.bat                 # Dev server launcher
```

---

## 🔒 2. Security Architecture

> Security is engineered into the core, not added as an afterthought.

### Identity & Access Management (IAM)
| Aspect | Implementation |
|--------|----------------|
| Protocol | JWT (JSON Web Tokens) with detailed claims (Role, CompanyID) |
| Authentication | ASP.NET Core Identity |
| Password Hashing | **Argon2id** (memory-hard, GPU-resistant) |
| Roles | Owner, Manager, Staff (via `UserCompany` junction table) |

### Network Security
- **Transport**: TLS 1.3 Required (HTTPS Only)
- **CORS Policy**: Strict Origin allowlist
- **API Gateway**: IIS acts as a shield, hiding internal ports (5000/5210)

### Data Protection
- **In-Transit**: All API traffic encrypted via SSL/TLS
- **At-Rest**: Sensitive columns (e.g., Bank Data) encrypted using AES-256
- **Sanitization**: All inputs validated via Zod (Frontend) and DataAnnotations (Backend)

### Audit Trails
- **Immutable Logs**: Every POST, PUT, DELETE recorded in `AuditLogs` table
- **Traceability**: Who changed what, when, and from which IP address

---

## ⚖️ 3. Accounting Integrity Standards

> These are non-negotiable architectural constraints to ensure financial accuracy.

### Hybrid Data Access Strategy
| Operation | Technology | Reason |
|-----------|------------|--------|
| Write (CRUD) | EF Core | Full change tracking, validation |
| Heavy IO Reports | Dapper / Raw SQL | Max speed, no tracking overhead |

### Idempotency & Concurrency
- **Double-Entry Guard**: DB constraint ensures `sum(debit) == sum(credit)`
- **Idempotency**: API endpoints accept unique `idempotency-key` header
- **Optimistic Concurrency**: Version tokens prevent "Lost Updates"

### Financial Precision
- **Decimal Only**: `float`/`double` types are **BANNED**
- **Rounding**: Bankers Rounding applied consistently at Transaction level

### Future Roadmap
- Period Locking: "Month Closing" feature to freeze modified transactions

---

## 🗄️ 4. Database Schema Rules

### Multi-Tenancy
All transactional tables include `CompanyId` (Guid) to separate data logically.

### Primary Keys
- Use **GUID** for modern multi-tenancy (facilitates syncing & migration)

### Data Types
| Type | Standard |
|------|----------|
| Money | `DECIMAL(19, 4)` - **No FLOAT** |
| Timestamps | UTC with timezone |

### Key Tables
- `Users` - User accounts
- `Companies` - Multi-tenant workspaces
- `UserCompanies` - RBAC junction (role per company)
- `Accounts` - Chart of Accounts (CoA)
- `JournalEntries` / `JournalLines` - Double-entry ledger
- `Contacts` - Customers & Vendors
- `Products` - Inventory items
- `SalesInvoices` / `PurchaseBills` - AR/AP documents
- `Notifications` - In-app notification system
- `AuditLogs` - Immutable audit trail

---

## ✅ 5. Feature Status

### 🟢 Completed
- **Core UI**: Premium Dashboard, Glassmorphism 2.0, Aurora Gradients
- **Accounting Engine**: CoA (Tree View), Journal Entries, Ledger
- **Reports**: PSAK Financial Position, Profit & Loss, Cash Flow, Trial Balance
- **User Management**: Live RBAC (Owner, Manager, Staff) with API Integration
- **Multi-Currency**: Exchange rates with live update support
- **Notification System**: Real-time in-app notifications
- **Sticky UI**: Fixed Navbar & Sidebar with premium loading states

### 🟡 In Progress
- Full Backend Migration: Moving legacy logic to .NET API
- Auth Integration: JWT Bridge between Next.js and .NET
- Google OAuth: Social login integration

### 🔴 Planned
- Period Locking (Month Close)
- Multi-language support (i18n)
- Mobile responsive optimization
- PDF export for all reports
- **💳 Midtrans Payment Integration**
  - Subscription plans (Free, Pro, Enterprise)
  - Payment history & transaction tracking
  - Auto-renewal via recurring payment
  - Invoice generation post-payment
- **🛠️ Admin Panel (Superadmin)**
  - Manage all companies/users
  - Approve/manage subscriptions
  - View subscription database
  - System-wide analytics

---

## 🚀 Quick Start (Development)

```bash
# Start both backend and frontend
./start-dev.bat

# Or manually:
# Backend (Terminal 1)
cd backend/src/BalanceIO.API
dotnet watch run

# Frontend (Terminal 2)
cd frontend
npm run dev
```

**URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5210
- Swagger Docs: http://localhost:5210/swagger

---

> 📝 *This Wiki is a living document. Updated by the development team.*
