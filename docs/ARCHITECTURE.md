# Avora Bank: Institutional Platform Architecture

## 1. Architectural Philosophy
Avora Bank is engineered as a secure, high-concurrency, self-hosted institutional digital wealth and liquidity platform. Its fundamental design criteria are:
1. **Server-Side Security Isolation**: No API keys, database credentials, or payment rails secrets are ever exposed to the client-side browser bundle.
2. **Double-Entry Immutable Accounting**: Every balance mutation across the platform executes through balanced journal entries where:
   $$\sum \text{Debits} \equiv \sum \text{Credits}$$
3. **Pluggable Modular Integrations**: External providers (BaaS cards, crypto chains, KYC verification, banking rails) operate behind abstract provider interfaces, preventing vendor lock-in.

---

## 2. System Topology

```
                      Internet Clients
                             │
                             ▼
              ┌─────────────────────────────┐
              │    Nginx Reverse Proxy      │
              │  (Rate Limiting, HSTS, SSL) │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌───────────────────┐         ┌───────────────────┐
    │  Next.js Frontend │         │ Express API Engine│
    │  (Standalone SSR) │         │  (Port 5000, PM2) │
    │   (Port 3000)     │         └─────────┬─────────┘
    └───────────────────┘                   │
                                  ┌─────────┴─────────┐
                                  │                   │
                                  ▼                   ▼
                          ┌──────────────┐    ┌──────────────┐
                          │MariaDB/MySQL │    │ Local / S3   │
                          │(ACID Engine) │    │ Upload Store │
                          └──────────────┘    └──────────────┘
```

---

## 3. Double-Entry General Ledger

Avora Bank maintains an internal financial ledger strictly independent of external third-party API dependencies. 

### Chart of Accounts
| Account ID | Category | Currency | Purpose |
| :--- | :--- | :--- | :--- |
| `PLATFORM_TREASURY_USD` | Asset | USD | Platform liquid cash reserve in USD |
| `PLATFORM_TREASURY_USDT` | Asset | USDT | Multi-chain reserve wallet holding USDT |
| `PLATFORM_TREASURY_EUR` | Asset | EUR | European clearing reserve |
| `PLATFORM_TREASURY_INR` | Asset | INR | Domestic clearing reserve |
| `PLATFORM_TREASURY_GEL` | Asset | GEL | Physical vault and local reserve |
| `USER_AVAILABLE_USD` | Liability | USD | Liquid investor balances available for payout |
| `USER_AVAILABLE_USDT` | Liability | USDT | Liquid investor USDT balances |
| `USER_LOCKED_PRINCIPAL_USD` | Liability | USD | Capital locked in 6-month investment packages |
| `PENDING_SETTLEMENT_TRANSIT_USD` | Liability | USD | Escrow holding for withdrawals in review |
| `P2P_ESCROW_USDT` | Liability | USDT | Automated escrow during P2P fiat verification |
| `PLATFORM_RETURNS_EXPENSE_USD` | Expense | USD | Cost of paying 1% monthly package yields |
| `PLATFORM_FEE_INCOME_USD` | Revenue | USD | OTC exchange spreads, sponsored ads, fees |

### Invariant & Idempotency
- **No Direct Update**: Balances cannot be updated arbitrarily. Wallet balances are maintained via database row locks (`SELECT ... FOR UPDATE`) inside transactions matching ledger entries.
- **Idempotency Keys**: Every deposit, return credit, and withdrawal uses a deterministic UUID or hashed key (e.g., `DEP-TX-<id>`, `RETURN-<pkg>-M<idx>`). Duplicate submissions are rejected at the database constraint layer.

---

## 4. Investment Package Engine
- **Principal Range**: USD $1,000 to USD $10,000 per package.
- **Unique Package ID**: Every purchase generates an isolated record (`PKG-XXXXXX`).
- **Yield Distribution**: Automated background cron calculates 1.00% monthly yield on active packages and credits `USER_AVAILABLE_USD` on the 1st of each month.
- **6-Month Lock-in**: Principal is locked in `USER_LOCKED_PRINCIPAL_USD` until the maturity date (`lockInEnd`), after which it can be claimed or rolled over.

---

## 5. Security & Risk Mitigations
1. **Two-Factor Authentication (2FA)**: RFC 6238 TOTP algorithm with SHA-1, 30-second steps, QR code provisioning, and encrypted secrets.
2. **Withdrawal Security Cooldown**: Mandatory 24–48 hour lock applied automatically whenever a password reset or security-critical change occurs.
3. **P2P Velocity Limits**: Daily transfer velocity throttles and recipient preview modals with email masking (`a***n@example.com`).
4. **Rate Limiting**: Tiered IP and account-level rate limiters on authentication, withdrawal, and sensitive ledger routes.

