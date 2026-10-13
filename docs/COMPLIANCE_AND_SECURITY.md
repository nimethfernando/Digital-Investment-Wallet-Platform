# Avora Bank: Regulatory Compliance & Security Policy

## 1. Regulatory Framework & Jurisdictional Alignment
Avora Bank is structured in alignment with international Virtual Asset Service Provider (VASP) standards and local fintech regulations in Georgia under the National Bank of Georgia (NBG).

### Key Compliance Standards
1. **FATF Recommendation 16 (Travel Rule)**:
   - All internal P2P transfers above threshold limits record originator and beneficiary details (`accountNumber`, masked identifier, and timestamp).
   - Direct OTC cash collections require physical identity verification against national ID or international passport.
2. **KYC / AML Tiered Verification**:
   - **Tier 1 (Unverified)**: Read-only access to market rates, packages, and strategy documentation.
   - **Tier 2 (Verified)**: Full investment package participation ($1,000–$10,000), internal P2P transfers within velocity limits ($5,000/day).
   - **Tier 3 (Institutional / Enhanced Due Diligence)**: Large-scale OTC settlements (up to $100,000) and dedicated Tbilisi counter collections.

---

## 2. Technical Security Controls

### Two-Factor Authentication (TOTP)
- Implemented using RFC 6238 Time-based One-Time Password algorithm.
- Mandatory for Admin and Sub-Admin accounts.
- Enforced on investor withdrawal submissions and critical account modifications.

### Withdrawal Security Cooldown
- **Policy**: Any change to a client's password, email, or 2FA settings triggers an immediate **24 to 48-hour security lock** on all outward withdrawals (`withdrawalLockedUntil`).
- **Rationale**: Prevents account drain attacks in the event of compromised credentials or social engineering.

### Double-Entry Invariant Auditing
- System balance equation:
  $$\Delta = \sum \text{Debits} - \sum \text{Credits} \equiv \$0.00$$
- Automated background verification ensures platform treasury assets match client liability obligations without discrepancy.

### Immutable Audit Logging
- Every administrative event (approval, settlement, user status change, spread edit) generates an immutable entry in `AdminAuditLog` with client IP, timestamp, user ID, and diff data.
- Records cannot be updated or deleted via application APIs.

