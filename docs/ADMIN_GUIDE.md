# Avora Bank: Administrator Operations Runbook

## 1. Administrative Overview & Access
The Avora Bank management desk allows staff and global administrators to manage investment packages, double-entry ledger audits, OTC currency quotes, and customer inquiries.

- **Admin Portal URL**: `https://<domain>/admin`
- **Default Master Admin**: `admin@avorabank.com`
- **Security Requirement**: Master Admins must configure 2FA TOTP immediately upon first login.

---

## 2. Investment Package Operations
1. **New Package Purchase Review**:
   - Navigate to **Admin Panel > Packages**.
   - Filter by `PENDING_PAYMENT`.
   - Verify client's wire transfer or crypto deposit hash against the Treasury wallet.
   - Click **Approve**. The double-entry ledger instantly debits `PLATFORM_TREASURY_USD` and credits `USER_LOCKED_PRINCIPAL_USD`.
2. **Monthly Yield Credits**:
   - Packages generate 1.00% monthly yield.
   - On the 1st of each calendar month at 00:00 UTC, the automated cron executes `creditMonthlyReturn`.
   - To manually run or re-sync yields, use the **Run Monthly Returns Job** button in the admin desk. Each payout is guarded by an idempotency key (`RETURN-<pkgCode>-M<idx>`) preventing duplicate credits.

---

## 3. Two-Stage Withdrawal Settlement Desk
Withdrawal requests are accepted exclusively on the 1st of each month for accumulated returns or matured principal.

### Settlement Workflow
1. Navigate to **Admin Panel > Withdrawals**.
2. Requests appear under `REQUESTED` status, and funds are automatically held in `PENDING_SETTLEMENT_TRANSIT_USD`.
3. The settlement team has an operational window of **15 days** to disburse funds.
4. **Execution by Payout Method**:
   - **Bank Transfer (SWIFT/SEPA)**: Transmit wire from platform bank. Record bank UTR / Reference number into the **Settlement Reference** field and click **Settle**.
   - **USDT Wallet (TRC-20 / ERC-20 / BEP-20)**: Transmit USDT from Platform Cold/Warm Treasury. Paste transaction hash (`0x...`) into Settlement Reference and click **Settle**.
   - **Cash Pickup (Tbilisi)**: Issue a verified cash pickup voucher code. The client presents identification at the physical counter on Chavchavadze Ave 37M, Tbilisi. Upon physical payout, record voucher code and mark **Settled**.
5. **Rejections / Reversals**:
   - If a request cannot be fulfilled (e.g. invalid bank coordinates), click **Reject** with a mandatory reason.
   - Funds in `PENDING_SETTLEMENT_TRANSIT_USD` are immediately credited back to the investor's `USER_AVAILABLE_USD`.

---

## 4. GeCrypto-Style OTC Desk & Exchange Margins
Avora Bank allows direct conversions between USDT and fiat currencies (USD, EUR, INR, GEL).

1. Navigate to **Admin Panel > Exchange Pairs**.
2. **Adjust Spreads & Margins**:
   - Base rates represent spot market price.
   - `buyMarginPct` (e.g. 1.00%): Spread applied when clients purchase USDT.
   - `sellMarginPct` (e.g. 1.30%): Commission retained when clients sell USDT for fiat.
   - Set Minimum ($100) and Maximum ($50,000–$100,000) transaction limits.
3. **Physical Tbilisi Desk**:
   - Counter operating hours: Monday–Friday 10:00 to 18:00 (GET / UTC+4).
   - OTC Desk operates until 21:00 GCC time to accommodate Middle Eastern clients.

---

## 5. P2P Marketplace Escrow & Dispute Arbitration
When two retail users execute a P2P trade, crypto is locked in `P2P_ESCROW_USDT`.
- **Dispute Escalation**: If a buyer marks payment sent but the seller claims non-receipt, either party can raise a dispute after 15 minutes.
- **Admin Arbitration**:
  1. Review chat transcript and uploaded proof of payment (bank receipt or UPI/IMPS UTR).
  2. If valid payment is verified, click **Force Release Escrow** to release USDT to the buyer.
  3. If payment was fraudulent or cancelled, click **Cancel & Refund Seller** to return USDT to the seller.

---

## 6. Audit Trail & Compliance
Every administrative action (approvals, rate edits, settlement payouts, user status updates) is recorded immutably in `AdminAuditLog` with IP address, timestamp, admin user ID, and before/after details.

