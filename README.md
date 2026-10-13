# Avora Bank - Institutional Digital Wealth & Liquidity Platform

Avora Bank is an enterprise-grade digital wealth management and liquidity platform built with Next.js 15 Standalone, Node.js, Express, Prisma ORM, and MariaDB. The platform features an immutable double-entry ledger, fixed-term digital investment packages with automated return distributions, an internal multi-currency wallet with saved payees and unique account numbers, a multi-rail P2P crypto exchange, a GeCrypto-style OTC desk with physical counter pickup in Tbilisi, Georgia, and an integrated support ticketing desk.

---

## 📑 Table of Contents
1. [Platform Highlights & Core Pillars](#-platform-highlights--core-pillars)
2. [Production Architecture](#-production-architecture)
3. [Enterprise Security & Financial Risk Controls](#-enterprise-security--financial-risk-controls)
4. [Tech Stack](#-tech-stack)
5. [Project Structure](#-project-structure)
6. [Getting Started (Local Development)](#-getting-started-local-development)
7. [Production Deployment (Docker & PM2)](#-production-deployment-docker--pm2)
8. [Automated Testing & Auditing](#-automated-testing--auditing)
9. [Operations & Administration Runbooks](#-operations--administration-runbooks)
10. [Documentation Index](#-documentation-index)
11. [License](#-license)

---

## 🚀 Platform Highlights & Core Pillars

### 1. Digital Investment Package Engine
- **Principal Tiers**: USD $1,000 to USD $10,000 per package with independent tracking via unique Package IDs (`PKG-XXXXXX`).
- **Target Yield**: Automatic 1.00% monthly yield calculation credited directly to client liquid wallet balances.
- **6-Month Lock-in Period**: Automatic tracking from purchase date to maturity with operational rationale disclosures.
- **Two-Stage Settlement**: Withdrawal requests open on the 1st of each calendar month, entering a 15-day administrative review queue.

### 2. Internal Wallet & Double-Entry Ledger
- **Mathematical Invariant**: Fully self-hosted double-entry ledger where $\sum \text{Debits} \equiv \sum \text{Credits}$ at all times.
- **Unique Account Numbers**: Every investor is assigned a formatted account number (`AVR-XXXX-XXXX`) for internal P2P transfers.
- **Saved Payees Directory**: Instant transfers to frequent contacts with recipient preview modal and email masking (`a***n@domain`).
- **Multi-Currency Balances**: Real-time tracking of USD, USDT, EUR, INR, and GEL balances.

### 3. P2P Crypto Exchange & Marketplace
- **Order Board**: Binance/RedotPay-style peer-to-peer trading board for USDT buy/sell offers.
- **Country-Specific Rails**: 10 pre-configured country rails (India: UPI/IMPS; UAE: AED Bank Transfer; Bahrain: BenefitPay; Georgia: Bank of Georgia/TBC; UK: Faster Payments; EU: SEPA; USA: Wire/ACH; Turkey: Papara; Nigeria: Bank Transfer; Philippines: GCash) with a "Request Your Country" intake form.
- **Automated Escrow**: Crypto locked in `P2P_ESCROW_USDT` until fiat receipt is confirmed.
- **Sponsored Ads**: VIP placement highlighting ads at the top of the trading board.

### 4. GeCrypto-Style OTC Desk & Physical Tbilisi Counter
- **Direct Conversions**: Instant quotes between USDT and USD, EUR, INR, GEL with configurable admin spreads (e.g. 1.0%–1.5%).
- **Physical Cash Counter**: Chavchavadze Ave 37M, Tbilisi 0162, Georgia. Counter open 10:00–18:00 GET, desk open until 21:00 GCC time for Middle Eastern clientele.

### 5. Virtual Card Module (Placeholder UI)
- **Luxury Obsidian/Gold Card**: Masked PAN, CVV flip, freeze toggle, and limit slider ($1k–$25k), ready for BaaS integration (Wallester / Marqeta).

### 6. Support Ticketing Helpdesk
- **Integrated Helpdesk**: Users can submit and track support tickets directly in their dashboard with sub-admin responses.

---

## 🏛 Production Architecture

```mermaid
flowchart TD
    Client["Clients / Mobile Web / Admin"]
    Proxy["Nginx Reverse Proxy (Port 80/443)"]
    Web["Next.js 15 Standalone Portal (Port 3000)"]
    API["Express API Cluster (Port 5000)"]
    DB[(MariaDB / MySQL InnoDB)]
    Cron["Yields Cron Job"]
    Volume[("Uploads Volume (KYC & Proofs)")]

    Client -->|HTTPS| Proxy
    Proxy -->|/_next, /| Web
    Proxy -->|/api/v1/| API
    Proxy -->|/uploads/| Volume
    API -->|Prisma ACID| DB
    Cron -->|1st of Month| API
```

---

## 🔒 Enterprise Security & Financial Risk Controls

| Control | Implementation | Purpose |
| :--- | :--- | :--- |
| **Server-Side Credentials** | Deep `.env` isolation | Zero client-side API keys or secrets exposure |
| **Two-Factor Authentication** | RFC 6238 TOTP with QR code | Mandatory for Admins; protects withdrawals & transfers |
| **Withdrawal Cooldown** | 24–48h lock on password change | Prevents wallet drain upon account takeover |
| **P2P Safeguards** | Velocity limit ($5,000/day) & preview | Blocks self-transfers and typo errors |
| **DDoS Rate Limiting** | Nginx zones + Express rate-limiter | Anti-brute-force on authentication and sensitive routes |

---

## 🛠 Tech Stack

- **Frontend**: Next.js 15 Standalone (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons
- **Backend**: Node.js 20, Express, TypeScript, Prisma ORM 6
- **Database**: MariaDB / MySQL InnoDB with row-level locking (`SELECT ... FOR UPDATE`)
- **Containerization**: Multi-stage Docker, Alpine Linux, dumb-init
- **Reverse Proxy**: Nginx 1.27 with Gzip, rate-limiting, and security headers
- **Process Manager**: PM2 Cluster Mode

---

## 📁 Project Structure

```text
Digital-Investment-Wallet-Platform/
├── apps/
│   ├── server/                         # Backend Express API & Accounting Engine
│   │   ├── prisma/
│   │   │   ├── schema.prisma           # Complete database schema (diw_* tables)
│   │   │   └── seed.ts                 # Idempotent database seeder
│   │   ├── src/
│   │   │   ├── adapters/               # Pluggable service providers
│   │   │   ├── controllers/            # API request handlers
│   │   │   ├── middleware/             # Auth, role guards, rate limiters
│   │   │   ├── routes/                 # Express routing
│   │   │   └── services/               # Ledger, packages, p2p, withdrawals
│   │   ├── tests/                      # Automated test suites
│   │   └── Dockerfile                  # Multi-stage production container
│   │
│   └── web/                            # Next.js 15 Standalone Web Portal
│       ├── public/                     # Brand logos, icons, brochures
│       ├── src/
│       │   ├── app/                    # 22 prerendered static & dynamic routes
│       │   ├── components/             # Virtual Card, Modals, Navigation
│       │   ├── context/                # Auth, Theme, Language
│       │   └── locales/                # Multi-language dictionaries (en, ka, hi)
│       └── Dockerfile                  # Standalone Next.js container (~150MB)
│
├── docs/                               # Institutional Documentation
│   ├── ARCHITECTURE.md                 # System architecture & ledger invariant
│   ├── DEPLOYMENT_GUIDE.md             # Production VPS / Docker deployment
│   ├── ADMIN_GUIDE.md                  # Administrator operations runbook
│   └── COMPLIANCE_AND_SECURITY.md      # Regulatory compliance (FATF, NBG)
│
├── nginx/
│   └── nginx.conf                      # Production reverse proxy config
├── scripts/
│   ├── deploy.sh                       # Zero-downtime deployment script
│   ├── backup-db.sh                    # Hot transactional database backup
│   └── health-check.sh                 # Liveness & ledger balance verifier
├── docker-compose.yml                  # Production multi-container orchestration
├── docker-compose.dev.yml              # Local containerized development
├── ecosystem.config.js                 # PM2 cluster mode configuration
└── package.json                        # Root orchestration scripts
```

---

## ⚡ Getting Started (Local Development)

### 1. Prerequisites
- Node.js >= 20.x
- MariaDB / MySQL with InnoDB

### 2. Configure Environment
Ensure `.env` in the root workspace has:
```env
DATABASE_URL="mysql://root:password@localhost:3306/avorabank"
JWT_SECRET="your_cryptographic_jwt_secret"
JWT_REFRESH_SECRET="your_cryptographic_refresh_secret"
PORT=5000
```

### 3. Initialize Database & Seed
```bash
npm run db:push
npm run db:seed
```

### 4. Run Development Servers
```bash
# In Terminal 1 (API Server):
npm run dev:server

# In Terminal 2 (Next.js Frontend):
npm run dev:web
```

---

## 🐳 Production Deployment (Docker & PM2)

### Option A: Docker Compose (One-Command Deployment)
```bash
docker compose up -d --build
```
This builds and launches the Nginx reverse proxy on port 80/443, the Express API on port 5000, and the standalone Next.js frontend on port 3000.

### Option B: Native PM2 Cluster on Linux VPS
```bash
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

### Option C: Automated Zero-Downtime Deployment
```bash
./scripts/deploy.sh
```

---

## 🧪 Automated Testing & Auditing

Run all test suites with a single command:
```bash
npm run test:all
```

Or individually:
```bash
# 1. Double-Entry Ledger Invariant Suite (9/9 passing, Delta = $0.00):
npm run test:ledger

# 2. Security Controls Suite (14/14 passing: 2FA, 24h Cooldown, P2P Limits, Rate Limiters):
npm run test:security
```

---

## 📚 Documentation Index

- [System Architecture](docs/ARCHITECTURE.md)
- [Production Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Administrator Operations Runbook](docs/ADMIN_GUIDE.md)
- [Compliance & Security Policy](docs/COMPLIANCE_AND_SECURITY.md)

---

## 📄 License
Private and Proprietary. All rights reserved.