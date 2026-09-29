# Nexis Global - Digital Investment & Wallet Platform

Nexis Global is a digital investment and fintech platform built with Next.js, Node.js, Express, Prisma ORM, and MariaDB. The platform features an immutable double-entry ledger, fixed-term digital investment packages with automated return distributions, an internal multi-currency wallet, a USDT/Fiat currency exchange desk with physical counter pickup options in Tbilisi, Georgia, and peer-to-peer (P2P) transfers.

---

## 📑 Table of Contents
1. [Core Features](#-core-features)
2. [Architecture & Design Principles](#-architecture--design-principles)
3. [Tech Stack](#-tech-stack)
4. [Project Structure](#-project-structure)
5. [Getting Started](#-getting-started)
   - [Prerequisites](#prerequisites)
   - [Environment Variables](#environment-variables)
   - [Installation & Setup](#installation--setup)
   - [Running the Services](#running-the-services)
6. [Testing the Ledger](#-testing-the-ledger)
7. [API Endpoints Overview](#-api-endpoints-overview)
8. [Compliance & Risk Guidelines](#-compliance--risk-guidelines)
9. [License](#-license)

---

## 🚀 Core Features

### 1. Digital Investment Packages
- **Configurable Tiers**: Admin-configurable minimum (\$1,000) and maximum (\$10,000) thresholds per package. Users can purchase multiple independent packages.
- **Fixed Lock-in & Proposed Returns**: 6-month minimum lock-in with a target monthly return rate (default 1.0%/month), calculated independently per package from purchase date.
- **Automated Payout Engine**: Cron-driven monthly returns scheduler (`00:05` UTC on the 1st of each month) crediting wallet balances idempotently without double-credits.
- **Deposit Flexibility**: Fund packages directly from existing wallet balances or via manual deposits (Bank Wire, USDT TRC-20, or Tbilisi cash counter) with receipt proof upload and administrative verification.

### 2. Wallet & Immutable Double-Entry Ledger
- **Multi-Currency Support**: Base currency in USD, structured for multi-currency handling (USD, USDT, EUR, INR, GEL).
- **Strict Double-Entry Bookkeeping**: Every transaction requires balanced journal entries ($\sum \text{Debits} == \sum \text{Credits}$).
- **Concurrency & Integrity Safeguards**: Row-level locking (`SELECT ... FOR UPDATE`) prevents race conditions and negative balances under simultaneous operations.
- **Idempotency Keys**: All financial operations require unique idempotency keys to eliminate duplicate credits or debits.
- **Reconciliation Engine**: Admin audit tool verifying net-zero balances across all chart-of-accounts and wallet liability parity.

### 3. Currency & USDT Exchange Desk (GeCrypto-Style)
- **Supported Pairs**: USDT $\leftrightarrow$ USD, EUR, INR, GEL.
- **Transparent Fee Structure**: Configurable spread margins and base rates with live conversion calculation.
- **Multiple Settlement Channels**: Bank transfer, platform wallet balance, or cash pickup at our counter in Tbilisi, Georgia.

### 4. Public Web Portal & CMS
- **Responsive Next.js 15 UI**: Mobile-first design inspired by modern fintech leaders (Wise, Revolut, Trust Wallet).
- **Multilingual (i18n)**: Native language support for English (`en`), Georgian (`ka`), and Hindi (`hi`).
- **Accessible Theming**: WCAG AA compliant Light and Dark mode toggle.
- **Compliance-Safe Copy**: Strictly enforces legally compliant terminology ("proposed / target return", "market risk disclosures") across all user touchpoints.

---

## 🏛 Architecture & Design Principles

```mermaid
flowchart TD
    Client["Next.js Web Frontend (Port 3000)"]
    API["Express REST API (Port 5000)"]
    DB[(MariaDB / MySQL InnoDB)]
    Cron["Returns Cron Job (node-cron)"]

    subgraph Adapters ["Provider-Agnostic Adapters"]
        Notif["NotificationProvider (SMTP/Nodemailer)"]
        Payment["PaymentProvider (Wire, USDT, Tbilisi)"]
        Settlement["SettlementProvider (Payout Queue)"]
        Kyc["KycProvider (Manual Review)"]
        Rate["RateFeedProvider (Configurable Margins)"]
    end

    Client -->|HTTP / JSON| API
    API --> Adapters
    API -->|Prisma ORM (Transactions & Locks)| DB
    Cron -->|Monthly Payouts| API
```

- **Provider-Agnostic Isolation**: External dependencies (Email, Blockchain, KYC, Payments, Settlement) sit behind strict adapter interfaces (`apps/server/src/adapters/`). Swapping a third-party vendor requires zero changes to core ledger or wallet logic.
- **Safe Namespace Partitioning**: All database models use the `diw_` prefix (`diw_users`, `diw_wallets`, `diw_ledger_entries`, etc.) to safely coexist in shared database environments.
- **Financial Precision**: All monetary values are handled using `DECIMAL(20, 8)` in the database and arbitrary-precision math (`decimal.js`) in code to eliminate floating-point rounding errors.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: MariaDB / MySQL InnoDB (Foreign keys, transactional ACID guarantees)
- **Email & Alerts**: Nodemailer (SMTP)
- **Math Precision**: Decimal.js (28-digit precision)
- **Task Scheduling**: Node-cron

---

## 📁 Project Structure

```text
Digital-Investment-Wallet-Platform/
├── apps/
│   ├── server/                         # Backend Express API & Engine
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Prisma schema (diw_* models)
│   │   │   └── seed.ts                 # Idempotent seed script
│   │   ├── src/
│   │   │   ├── adapters/               # Provider-agnostic adapters
│   │   │   │   ├── blockchain/
│   │   │   │   ├── kyc/
│   │   │   │   ├── notification/
│   │   │   │   ├── payment/
│   │   │   │   ├── rate-feed/
│   │   │   │   └── settlement/
│   │   │   ├── config/                 # Environment & app configuration
│   │   │   ├── controllers/            # Request handlers (auth, wallet, pkg, admin, cms)
│   │   │   ├── middleware/             # JWT auth, role guards, error handling
│   │   │   ├── routes/                 # Express routers
│   │   │   └── services/               # Core domain logic
│   │   │       ├── auth.service.ts
│   │   │       ├── deposit.service.ts
│   │   │       ├── ledger.service.ts   # Double-entry ledger & row locks
│   │   │       ├── package.service.ts  # Investment package logic
│   │   │       └── returns.job.ts      # Monthly returns background engine
│   │   └── tests/
│   │       └── ledger.test.ts          # Ledger integrity & concurrency test suite
│   │
│   └── web/                            # Frontend Next.js 15 Application
│       ├── public/                     # Static assets
│       └── src/
│           ├── app/                    # Next.js App Router pages
│           │   ├── (auth)/             # Login, register, forgot/change password
│           │   ├── about/              # Leadership & company profile
│           │   ├── contact/            # Inquiry forms & direct SMTP routing
│           │   ├── exchange/           # USDT/Fiat exchange desk
│           │   ├── how-it-works/       # 4-step investor walkthrough
│           │   ├── legal/              # Terms, privacy, AML, risk disclosure
│           │   ├── p2p/                # Peer-to-peer transfer portal
│           │   ├── packages/           # Investment packages allocator
│           │   └── security/           # Architecture & custody overview
│           ├── components/             # Reusable UI (Header, Footer, modals)
│           ├── context/                # Auth, Theme, and Language Contexts
│           └── locales/                # Dictionaries (en.json, ka.json, hi.json)
│
├── .env.example                        # Template environment variables
├── .gitignore                          # Root ignore rules
└── package.json                        # Root workspace configuration
```

---

## ⚡ Getting Started

### Prerequisites
- **Node.js**: v18.18+ or v20+
- **npm** or **pnpm**
- **MariaDB / MySQL**: Running with InnoDB engine

### Environment Variables
Copy `.env.example` into `apps/server/.env`:

```bash
cp .env.example apps/server/.env
```

Configure the following variables in `apps/server/.env`:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-secure-jwt-secret-min-32-chars
DATABASE_URL="mysql://user:password@localhost:3306/your_database"

# Email Notifications (SMTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
EMAIL_FROM="Nexis Platform <no-reply@nexisplatform.com>"
```

### Installation & Setup

1. **Install dependencies**:
   ```bash
   # In apps/server
   cd apps/server
   npm install

   # In apps/web
   cd ../web
   npm install
   ```

2. **Generate Prisma Client & Seed Database**:
   ```bash
   cd apps/server
   npx prisma generate
   npm run db:seed
   ```

### Running the Services

- **Start Backend API** (Port 5000):
  ```bash
  cd apps/server
  npm run dev
  ```
  API endpoint: `http://localhost:5000/api/v1`  
  Health check: `http://localhost:5000/api/v1/health`

- **Start Frontend Web App** (Port 3000):
  ```bash
  cd apps/web
  npm run dev
  ```
  Web Portal: `http://localhost:3000`

---

## 🧪 Testing the Ledger

To run the automated test suite verifying double-entry equations, row-level locking, idempotency, and concurrency:

```bash
cd apps/server
npx tsx tests/ledger.test.ts
```

The test suite validates:
1. Double-entry equation ($\sum \text{Debits} == \sum \text{Credits}$).
2. Immediate rejection of unbalanced entries.
3. Deposit verification and wallet crediting.
4. Prevention of duplicate credits via idempotency keys.
5. Investment package purchase and locked principal liability.
6. Monthly return calculation and ledger distribution.
7. Return idempotency for the same cycle.
8. Concurrent debit protection (prevents negative balances under race conditions).
9. System-wide ledger reconciliation check.

---

## 📡 API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/v1/health` | Service health status | No |
| `POST` | `/api/v1/auth/register` | Register new investor account | No |
| `POST` | `/api/v1/auth/login` | Authenticate investor / admin | No |
| `GET` | `/api/v1/wallet` | Fetch user wallet balances | Yes (Bearer JWT) |
| `GET` | `/api/v1/wallet/transactions`| Filterable transaction history (CSV export) | Yes (Bearer JWT) |
| `POST` | `/api/v1/wallet/deposit` | Submit deposit with proof receipt | Yes (Bearer JWT) |
| `GET` | `/api/v1/packages/tiers` | Get package configuration & rules | No |
| `GET` | `/api/v1/packages` | List authenticated user packages | Yes (Bearer JWT) |
| `POST` | `/api/v1/packages/purchase`| Purchase package (wallet or proof) | Yes (Bearer JWT) |
| `GET` | `/api/v1/admin/packages` | Admin review list of all packages | Yes (Admin/Staff) |
| `POST` | `/api/v1/admin/packages/:id/approve` | Approve and activate package | Yes (Admin/Staff) |
| `POST` | `/api/v1/admin/deposits/:id/approve` | Approve deposit & credit ledger | Yes (Admin/Staff) |
| `POST` | `/api/v1/admin/returns/run` | Trigger monthly returns distribution | Yes (Admin) |
| `GET` | `/api/v1/admin/ledger/reconcile` | Verify ledger balance integrity | Yes (Admin) |

---

## ⚖️ Compliance & Risk Guidelines

- **Compliant Terminology**: All investor-facing copy uses "proposed / target return, subject to terms and market risk". Terms like "guaranteed returns", "risk-free", or "principal protected" are strictly restricted unless explicitly authorized by platform legal counsel.
- **Risk Acknowledgement**: All package purchases require explicit user confirmation acknowledging market and operational risk disclosures.
- **Audit Trails**: Every administrative action, package approval, and manual payout is recorded in `diw_admin_audit_logs`.

---

## 📄 License
Private and Proprietary. All rights reserved.