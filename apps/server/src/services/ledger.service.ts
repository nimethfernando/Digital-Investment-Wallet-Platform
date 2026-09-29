import { PrismaClient, EntryDirection, JournalReferenceType, TransactionType, TransactionStatus } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

// Configure Decimal.js precision for financial accuracy
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface JournalEntryInput {
  accountId: string;
  userId?: string | null;
  direction: 'DEBIT' | 'CREDIT';
  amount: string | number;
  currency: string;
}

export interface CreateJournalParams {
  idempotencyKey: string;
  referenceType: JournalReferenceType;
  referenceId?: string | null;
  notes?: string | null;
  createdBy?: string;
  entries: JournalEntryInput[];
}

export class LedgerService {
  /**
   * Helper to ensure user has a wallet and balances for USD, USDT, EUR, INR, GEL
   */
  async ensureWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: { balances: true },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balances: {
            create: [
              { currency: 'USD', availableBalance: 0, lockedPrincipal: 0, pendingSettlement: 0 },
              { currency: 'USDT', availableBalance: 0, lockedPrincipal: 0, pendingSettlement: 0 },
              { currency: 'EUR', availableBalance: 0, lockedPrincipal: 0, pendingSettlement: 0 },
              { currency: 'INR', availableBalance: 0, lockedPrincipal: 0, pendingSettlement: 0 },
              { currency: 'GEL', availableBalance: 0, lockedPrincipal: 0, pendingSettlement: 0 },
            ],
          },
        },
        include: { balances: true },
      });
    }

    return wallet;
  }

  /**
   * Lock a user's wallet balance row for update inside an active transaction.
   * Row-level locking prevents race conditions and balance discrepancies.
   */
  async lockWalletBalance(tx: any, walletId: string, currency: string) {
    const rawRows: any[] = await tx.$queryRawUnsafe(
      `SELECT * FROM \`diw_wallet_balances\` WHERE \`walletId\` = ? AND \`currency\` = ? FOR UPDATE`,
      walletId,
      currency
    );

    if (!rawRows || rawRows.length === 0) {
      // Create balance row if not exists
      const id = `wb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await tx.$executeRawUnsafe(
        `INSERT INTO \`diw_wallet_balances\` (\`id\`, \`walletId\`, \`currency\`, \`availableBalance\`, \`lockedPrincipal\`, \`pendingSettlement\`, \`updatedAt\`) VALUES (?, ?, ?, 0.00000000, 0.00000000, 0.00000000, NOW())`,
        id,
        walletId,
        currency
      );
      const createdRows: any[] = await tx.$queryRawUnsafe(
        `SELECT * FROM \`diw_wallet_balances\` WHERE \`walletId\` = ? AND \`currency\` = ? FOR UPDATE`,
        walletId,
        currency
      );
      return createdRows[0];
    }

    return rawRows[0];
  }

  /**
   * Records an immutable balanced journal entry.
   * Mathematical invariant: sum(DEBITS) === sum(CREDITS)
   */
  async recordJournal(tx: any, params: CreateJournalParams) {
    // 1. Check idempotency
    const existing = await tx.ledgerJournal.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: { entries: true },
    });
    if (existing) {
      return existing;
    }

    // 2. Validate double-entry balance: sum(Debits) === sum(Credits)
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const entry of params.entries) {
      const amt = new Decimal(entry.amount.toString());
      if (amt.isNegative() || amt.isZero()) {
        throw new Error(`Journal entry amount must be strictly positive: ${entry.amount}`);
      }
      if (entry.direction === 'DEBIT') {
        totalDebit = totalDebit.plus(amt);
      } else if (entry.direction === 'CREDIT') {
        totalCredit = totalCredit.plus(amt);
      } else {
        throw new Error(`Invalid entry direction: ${entry.direction}`);
      }
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(
        `Double-entry imbalance! Debits (${totalDebit.toString()}) != Credits (${totalCredit.toString()})`
      );
    }

    // 3. Create Journal and entries
    const journal = await tx.ledgerJournal.create({
      data: {
        idempotencyKey: params.idempotencyKey,
        referenceType: params.referenceType,
        referenceId: params.referenceId || null,
        notes: params.notes || null,
        createdBy: params.createdBy || 'SYSTEM',
        entries: {
          create: params.entries.map((e) => ({
            accountId: e.accountId,
            userId: e.userId || null,
            direction: e.direction as EntryDirection,
            amount: new Decimal(e.amount.toString()).toFixed(8),
            currency: e.currency,
          })),
        },
      },
      include: { entries: true },
    });

    return journal;
  }

  /**
   * Deposit Approved flow:
   * Increases user's available balance in wallet.
   * Debits Platform Bank/Hot Wallet Asset.
   * Credits User Available Liability.
   * Logs a user Transaction record.
   */
  async processDepositApproval(params: {
    depositId: string;
    depositCode: string;
    userId: string;
    amount: string | number;
    currency: string;
    reviewedBy: string;
    notes?: string;
  }) {
    const amountDec = new Decimal(params.amount.toString());
    const idempotencyKey = `DEP-APPROVAL-${params.depositCode}`;

    return await prisma.$transaction(async (tx) => {
      // Check if already approved
      const deposit = await tx.depositRequest.findUnique({
        where: { id: params.depositId },
      });
      if (!deposit || deposit.status !== 'PENDING') {
        throw new Error('Deposit is either not found or already processed');
      }

      // Lock user's wallet
      const wallet = await this.ensureWallet(params.userId);
      const lockedBalance = await this.lockWalletBalance(tx, wallet.id, params.currency);

      const balBefore = new Decimal(lockedBalance.availableBalance.toString());
      const balAfter = balBefore.plus(amountDec);

      // Update wallet balance
      await tx.walletBalance.update({
        where: { id: lockedBalance.id },
        data: { availableBalance: balAfter.toFixed(8) },
      });

      // Double-entry ledger: Debit Asset account, Credit User Available Liability
      const assetAccount = params.currency === 'USDT' ? 'PLATFORM_TREASURY_USDT' : 'PLATFORM_TREASURY_USD';
      const liabilityAccount = 'USER_AVAILABLE_USD';

      await this.recordJournal(tx, {
        idempotencyKey,
        referenceType: JournalReferenceType.DEPOSIT,
        referenceId: params.depositCode,
        notes: params.notes || `Deposit approved: ${params.depositCode}`,
        createdBy: params.reviewedBy,
        entries: [
          {
            accountId: assetAccount,
            direction: 'DEBIT',
            amount: amountDec.toFixed(8),
            currency: params.currency,
          },
          {
            accountId: liabilityAccount,
            userId: params.userId,
            direction: 'CREDIT',
            amount: amountDec.toFixed(8),
            currency: params.currency,
          },
        ],
      });

      // Record User-facing Transaction
      const transactionCode = `TX-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          transactionCode,
          userId: params.userId,
          type: TransactionType.DEPOSIT,
          amount: amountDec.toFixed(8),
          currency: params.currency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: balBefore.toFixed(8),
          balanceAfter: balAfter.toFixed(8),
          settlementReference: deposit.txHashOrRef || params.depositCode,
          createdBy: params.reviewedBy,
          idempotencyKey,
          notes: `Deposit of ${amountDec.toFixed(2)} ${params.currency} approved`,
        },
      });

      // Update deposit request
      const updatedDeposit = await tx.depositRequest.update({
        where: { id: params.depositId },
        data: {
          status: 'APPROVED',
          reviewedBy: params.reviewedBy,
          reviewedAt: new Date(),
          adminNotes: params.notes,
        },
      });

      return { deposit: updatedDeposit, balanceAfter: balAfter.toFixed(2) };
    }, { timeout: 30000, maxWait: 10000 });
  }

  /**
   * Purchase Investment Package from Wallet Balance:
   * Verifies available balance >= package amount with row-level lock.
   * Debits User Available Liability, Credits User Locked Principal Liability.
   * Creates InvestmentPackage with status ACTIVE.
   * Creates Transaction record.
   */
  async purchasePackageFromWallet(params: {
    userId: string;
    amount: string | number;
    currency: string;
    returnRateSnapshot: string | number; // e.g. 0.0100 for 1%
    lockInMonths: number;
    idempotencyKey: string;
  }) {
    const amountDec = new Decimal(params.amount.toString());

    return await prisma.$transaction(async (tx) => {
      const wallet = await this.ensureWallet(params.userId);
      const lockedBal = await this.lockWalletBalance(tx, wallet.id, params.currency);

      const availBal = new Decimal(lockedBal.availableBalance.toString());
      const lockedPrinc = new Decimal(lockedBal.lockedPrincipal.toString());

      if (availBal.lessThan(amountDec)) {
        throw new Error(
          `Insufficient available balance (${availBal.toFixed(2)} ${params.currency}). Required: ${amountDec.toFixed(2)} ${params.currency}`
        );
      }

      const balBefore = availBal;
      const balAfter = availBal.minus(amountDec);
      const newLockedPrinc = lockedPrinc.plus(amountDec);

      // Update wallet balance
      await tx.walletBalance.update({
        where: { id: lockedBal.id },
        data: {
          availableBalance: balAfter.toFixed(8),
          lockedPrincipal: newLockedPrinc.toFixed(8),
        },
      });

      // Dates calculation
      const now = new Date();
      const lockInEnd = new Date(now);
      lockInEnd.setMonth(lockInEnd.getMonth() + params.lockInMonths);

      const packageCode = `PKG-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      // Create Package
      const investmentPackage = await tx.investmentPackage.create({
        data: {
          packageCode,
          userId: params.userId,
          amount: amountDec.toFixed(8),
          currency: params.currency,
          returnRateSnapshot: new Decimal(params.returnRateSnapshot.toString()).toFixed(4),
          lockInMonths: params.lockInMonths,
          status: 'ACTIVE',
          purchaseDate: now,
          lockInStart: now,
          lockInEnd,
          withdrawalEligibilityDate: lockInEnd,
          depositMethod: 'WALLET_BALANCE',
        },
      });

      // Double-entry ledger: Debit User Available, Credit User Locked Principal
      await this.recordJournal(tx, {
        idempotencyKey: params.idempotencyKey,
        referenceType: JournalReferenceType.PACKAGE_PURCHASE,
        referenceId: packageCode,
        notes: `Investment package purchase ${packageCode} for ${amountDec.toFixed(2)} ${params.currency}`,
        createdBy: params.userId,
        entries: [
          {
            accountId: 'USER_AVAILABLE_USD',
            userId: params.userId,
            direction: 'DEBIT',
            amount: amountDec.toFixed(8),
            currency: params.currency,
          },
          {
            accountId: 'USER_LOCKED_PRINCIPAL_USD',
            userId: params.userId,
            direction: 'CREDIT',
            amount: amountDec.toFixed(8),
            currency: params.currency,
          },
        ],
      });

      // Create Transaction
      const transactionCode = `TX-PKG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          transactionCode,
          userId: params.userId,
          packageId: investmentPackage.id,
          type: TransactionType.PACKAGE_PURCHASE,
          amount: amountDec.toFixed(8),
          currency: params.currency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: balBefore.toFixed(8),
          balanceAfter: balAfter.toFixed(8),
          settlementReference: packageCode,
          createdBy: params.userId,
          idempotencyKey: params.idempotencyKey,
          notes: `Purchased Package ${packageCode} (${params.lockInMonths} mo. lock-in, ${new Decimal(params.returnRateSnapshot.toString()).times(100).toFixed(1)}% return)`,
        },
      });

      return investmentPackage;
    }, { timeout: 30000, maxWait: 10000 });
  }

  /**
   * Monthly Return distribution:
   * Credits investor's wallet available balance.
   * Debits Platform Returns Expense account.
   * Credits User Available Liability.
   * Records PackageReturn and Transaction.
   */
  async creditMonthlyReturn(params: {
    packageId: string;
    userId: string;
    returnAmount: string | number;
    currency: string;
    periodIndex: number;
    idempotencyKey: string;
  }) {
    const returnAmountDec = new Decimal(params.returnAmount.toString());

    return await prisma.$transaction(async (tx) => {
      // 1. Check idempotency: avoid double-crediting
      const existingJournal = await tx.ledgerJournal.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existingJournal) {
        return { alreadyCredited: true, journalId: existingJournal.id };
      }

      const pkg = await tx.investmentPackage.findUnique({
        where: { id: params.packageId },
      });
      if (!pkg) throw new Error('Package not found');

      // 2. Lock user wallet balance
      const wallet = await this.ensureWallet(params.userId);
      const lockedBal = await this.lockWalletBalance(tx, wallet.id, params.currency);

      const balBefore = new Decimal(lockedBal.availableBalance.toString());
      const balAfter = balBefore.plus(returnAmountDec);

      await tx.walletBalance.update({
        where: { id: lockedBal.id },
        data: { availableBalance: balAfter.toFixed(8) },
      });

      // 3. Double-entry ledger: Debit Monthly Returns Expense, Credit User Available Liability
      const journal = await this.recordJournal(tx, {
        idempotencyKey: params.idempotencyKey,
        referenceType: JournalReferenceType.MONTHLY_RETURN,
        referenceId: pkg.packageCode,
        notes: `Monthly return cycle ${params.periodIndex} for package ${pkg.packageCode}`,
        createdBy: 'CRON_RETURNS_ENGINE',
        entries: [
          {
            accountId: 'PLATFORM_RETURNS_EXPENSE_USD',
            direction: 'DEBIT',
            amount: returnAmountDec.toFixed(8),
            currency: params.currency,
          },
          {
            accountId: 'USER_AVAILABLE_USD',
            userId: params.userId,
            direction: 'CREDIT',
            amount: returnAmountDec.toFixed(8),
            currency: params.currency,
          },
        ],
      });

      // 4. Record PackageReturn
      const pkgReturn = await tx.packageReturn.create({
        data: {
          packageId: params.packageId,
          userId: params.userId,
          periodIndex: params.periodIndex,
          returnAmount: returnAmountDec.toFixed(8),
          currency: params.currency,
          ledgerJournalId: journal.id,
          status: 'CREDITED',
        },
      });

      // 5. Record Transaction
      const transactionCode = `TX-RET-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          transactionCode,
          userId: params.userId,
          packageId: params.packageId,
          type: TransactionType.MONTHLY_RETURN,
          amount: returnAmountDec.toFixed(8),
          currency: params.currency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: balBefore.toFixed(8),
          balanceAfter: balAfter.toFixed(8),
          settlementReference: pkg.packageCode,
          createdBy: 'CRON_RETURNS_ENGINE',
          idempotencyKey: params.idempotencyKey,
          notes: `Monthly return (Month ${params.periodIndex}) credited for package ${pkg.packageCode}`,
        },
      });

      return { alreadyCredited: false, pkgReturn, balanceAfter: balAfter.toFixed(2) };
    }, { timeout: 30000, maxWait: 10000 });
  }

  /**
   * Release principal when package has matured (past lock-in end date)
   */
  async releaseMaturedPrincipal(packageId: string, adminUserId: string = 'SYSTEM') {
    return await prisma.$transaction(async (tx) => {
      const pkg = await tx.investmentPackage.findUnique({
        where: { id: packageId },
      });
      if (!pkg) throw new Error('Package not found');
      if (pkg.status !== 'ACTIVE') {
        throw new Error(`Package status is ${pkg.status}, cannot release principal`);
      }

      const now = new Date();
      if (pkg.lockInEnd && now < pkg.lockInEnd) {
        throw new Error(`Package lock-in period has not ended yet. Ends at: ${pkg.lockInEnd.toISOString()}`);
      }

      const amountDec = new Decimal(pkg.amount.toString());
      const idempotencyKey = `PRINCIPAL-RELEASE-${pkg.packageCode}`;

      // Lock user wallet balance
      const wallet = await this.ensureWallet(pkg.userId);
      const lockedBal = await this.lockWalletBalance(tx, wallet.id, pkg.currency);

      const availBal = new Decimal(lockedBal.availableBalance.toString());
      const lockedPrinc = new Decimal(lockedBal.lockedPrincipal.toString());

      const newAvailBal = availBal.plus(amountDec);
      const newLockedPrinc = lockedPrinc.minus(amountDec);

      await tx.walletBalance.update({
        where: { id: lockedBal.id },
        data: {
          availableBalance: newAvailBal.toFixed(8),
          lockedPrincipal: newLockedPrinc.greaterThanOrEqualTo(0) ? newLockedPrinc.toFixed(8) : '0.00000000',
        },
      });

      // Update package status to MATURED
      await tx.investmentPackage.update({
        where: { id: packageId },
        data: { status: 'MATURED' },
      });

      // Double-entry: Debit Locked Principal Liability, Credit Available Liability
      await this.recordJournal(tx, {
        idempotencyKey,
        referenceType: JournalReferenceType.PRINCIPAL_RELEASE,
        referenceId: pkg.packageCode,
        notes: `Principal released for matured package ${pkg.packageCode}`,
        createdBy: adminUserId,
        entries: [
          {
            accountId: 'USER_LOCKED_PRINCIPAL_USD',
            userId: pkg.userId,
            direction: 'DEBIT',
            amount: amountDec.toFixed(8),
            currency: pkg.currency,
          },
          {
            accountId: 'USER_AVAILABLE_USD',
            userId: pkg.userId,
            direction: 'CREDIT',
            amount: amountDec.toFixed(8),
            currency: pkg.currency,
          },
        ],
      });

      // Transaction
      const transactionCode = `TX-REL-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          transactionCode,
          userId: pkg.userId,
          packageId: pkg.id,
          type: TransactionType.PRINCIPAL_RELEASE,
          amount: amountDec.toFixed(8),
          currency: pkg.currency,
          status: TransactionStatus.COMPLETED,
          balanceBefore: availBal.toFixed(8),
          balanceAfter: newAvailBal.toFixed(8),
          settlementReference: pkg.packageCode,
          createdBy: adminUserId,
          idempotencyKey,
          notes: `Principal released from matured package ${pkg.packageCode}`,
        },
      });

      return { packageCode: pkg.packageCode, releasedAmount: amountDec.toFixed(2) };
    }, { timeout: 30000, maxWait: 10000 });
  }

  /**
   * System-wide double-entry ledger reconciliation:
   * Verifies sum of debits === sum of credits across all entries.
   * Compares wallet balances against ledger entries for user liability account.
   */
  async reconcileLedger() {
    const rawSums: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        \`direction\`,
        SUM(\`amount\`) as total
      FROM \`diw_ledger_entries\`
      GROUP BY \`direction\`;
    `);

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const row of rawSums) {
      if (row.direction === 'DEBIT') {
        totalDebit = new Decimal(row.total || 0);
      } else if (row.direction === 'CREDIT') {
        totalCredit = new Decimal(row.total || 0);
      }
    }

    const difference = totalDebit.minus(totalCredit).abs();
    const isBalanced = difference.lessThan(new Decimal('0.00000001'));

    // Count entries and journals
    const [journalCount, entryCount, accountsCount] = await Promise.all([
      prisma.ledgerJournal.count(),
      prisma.ledgerEntry.count(),
      prisma.ledgerAccount.count(),
    ]);

    // Breakdown by account
    const accountTotals: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        a.\`id\` as accountId,
        a.\`accountName\`,
        a.\`accountType\`,
        a.\`currency\`,
        COALESCE(SUM(CASE WHEN e.\`direction\` = 'DEBIT' THEN e.\`amount\` ELSE 0 END), 0) as totalDebit,
        COALESCE(SUM(CASE WHEN e.\`direction\` = 'CREDIT' THEN e.\`amount\` ELSE 0 END), 0) as totalCredit
      FROM \`diw_ledger_accounts\` a
      LEFT JOIN \`diw_ledger_entries\` e ON a.\`id\` = e.\`accountId\`
      GROUP BY a.\`id\`, a.\`accountName\`, a.\`accountType\`, a.\`currency\`
      ORDER BY a.\`id\` ASC;
    `);

    return {
      status: isBalanced ? 'HEALTHY_BALANCED' : 'IMBALANCE_DETECTED',
      isBalanced,
      totalDebit: totalDebit.toFixed(8),
      totalCredit: totalCredit.toFixed(8),
      difference: difference.toFixed(8),
      journalCount,
      entryCount,
      accountsCount,
      accounts: accountTotals.map((acc) => {
        const d = new Decimal(acc.totalDebit || 0);
        const c = new Decimal(acc.totalCredit || 0);
        const net = acc.accountType === 'ASSET' || acc.accountType === 'EXPENSE' ? d.minus(c) : c.minus(d);
        return {
          accountId: acc.accountId,
          accountName: acc.accountName,
          accountType: acc.accountType,
          currency: acc.currency,
          totalDebit: d.toFixed(4),
          totalCredit: c.toFixed(4),
          netBalance: net.toFixed(4),
        };
      }),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get user wallet balances with summary
   */
  async getUserWalletSummary(userId: string) {
    const wallet = await this.ensureWallet(userId);
    const balances = await prisma.walletBalance.findMany({
      where: { walletId: wallet.id },
    });

    const usdBal = balances.find((b) => b.currency === 'USD') || {
      availableBalance: new Decimal(0),
      lockedPrincipal: new Decimal(0),
      pendingSettlement: new Decimal(0),
    };

    const available = new Decimal(usdBal.availableBalance.toString());
    const locked = new Decimal(usdBal.lockedPrincipal.toString());
    const pending = new Decimal(usdBal.pendingSettlement.toString());
    const total = available.plus(locked).plus(pending);

    // Accumulated returns count
    const returnsAgg = await prisma.packageReturn.aggregate({
      where: { userId, status: 'CREDITED' },
      _sum: { returnAmount: true },
    });
    const accumulatedReturns = new Decimal(returnsAgg._sum.returnAmount?.toString() || '0');

    return {
      walletId: wallet.id,
      baseCurrency: 'USD',
      summary: {
        available: available.toFixed(2),
        lockedPrincipal: locked.toFixed(2),
        pendingSettlement: pending.toFixed(2),
        total: total.toFixed(2),
        accumulatedReturns: accumulatedReturns.toFixed(2),
      },
      balances: balances.map((b) => ({
        currency: b.currency,
        available: new Decimal(b.availableBalance.toString()).toFixed(2),
        locked: new Decimal(b.lockedPrincipal.toString()).toFixed(2),
        pending: new Decimal(b.pendingSettlement.toString()).toFixed(2),
      })),
    };
  }
}

export const ledgerService = new LedgerService();
