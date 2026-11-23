import { EntryDirection, JournalReferenceType, TransactionType, TransactionStatus, DepositStatus, PackageStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { rateService } from './rate.service';
import { notificationService } from '../adapters/notification/notification.provider';

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
   * Ensure a user-supplied transaction hash / bank reference is valid and not replayed
   * across another active/approved deposit or credited deposit transaction.
   */
  async assertUniqueTxReference(txHashOrRef?: string | null, excludeDepositId?: string) {
    if (!txHashOrRef) return;
    const cleanRef = txHashOrRef.trim();
    if (!cleanRef) return;

    const systemPrefixes = ['REF-', 'DEP-', 'MAN-', 'PKG-', 'order_'];
    if (systemPrefixes.some((prefix) => cleanRef.startsWith(prefix))) {
      return;
    }

    if (
      cleanRef.length < 6 ||
      cleanRef.toLowerCase() === 'none' ||
      cleanRef.toLowerCase() === 'test'
    ) {
      throw new Error(
        'Please provide a valid transaction reference or blockchain TX hash (minimum 6 characters).'
      );
    }

    const existingDeposit = await prisma.depositRequest.findFirst({
      where: {
        txHashOrRef: cleanRef,
        status: { in: [DepositStatus.PENDING, DepositStatus.APPROVED] },
        ...(excludeDepositId ? { id: { not: excludeDepositId } } : {}),
      },
    });
    if (existingDeposit) {
      throw new Error(
        `Duplicate transaction reference/hash detected (${cleanRef}). This reference has already been submitted or credited on deposit ${existingDeposit.depositCode}.`
      );
    }

    const existingTx = await prisma.transaction.findFirst({
      where: {
        type: TransactionType.DEPOSIT,
        settlementReference: cleanRef,
      },
    });
    if (existingTx) {
      throw new Error(
        `Duplicate transaction reference/hash detected (${cleanRef}). This reference was already credited in transaction ${existingTx.transactionCode}.`
      );
    }
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

    // 2b. Ensure all referenced Chart of Accounts rows exist before inserting entries (1 batched lookup)
    const uniqueAccounts = new Map<string, string>();
    for (const entry of params.entries) {
      if (!uniqueAccounts.has(entry.accountId)) {
        uniqueAccounts.set(entry.accountId, entry.currency || 'USD');
      }
    }

    const accountIds = Array.from(uniqueAccounts.keys());
    const existingAccounts = await tx.ledgerAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true },
    });
    const existingSet = new Set(existingAccounts.map((a: any) => a.id));

    for (const [accId, accCurrency] of uniqueAccounts.entries()) {
      if (existingSet.has(accId)) continue;
      const accountType = accId.startsWith('PLATFORM_TREASURY')
        ? 'ASSET'
        : accId.includes('EXPENSE')
        ? 'EXPENSE'
        : accId.includes('INCOME') || accId.includes('REVENUE')
        ? 'REVENUE'
        : 'LIABILITY';

      await tx.ledgerAccount.upsert({
        where: { id: accId },
        update: {},
        create: {
          id: accId,
          accountName: accId.replace(/_/g, ' '),
          accountType: accountType as any,
          currency: accCurrency,
          description: `Automated Double-Entry Ledger Account (${accId})`,
        },
      });
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
    txHash?: string;
  }) {
    const amountDec = new Decimal(params.amount.toString());
    const idempotencyKey = `DEP-APPROVAL-${params.depositCode}`;
    const wallet = await this.ensureWallet(params.userId);

    return await prisma.$transaction(async (tx) => {
      // Lock user's wallet first to serialize concurrent approvals
      const lockedBalance = await this.lockWalletBalance(tx, wallet.id, params.currency);

      // Re-fetch deposit inside locked transaction and verify status
      const freshDeposit = await tx.depositRequest.findUnique({
        where: { id: params.depositId },
      });
      if (!freshDeposit || freshDeposit.status !== DepositStatus.PENDING) {
        throw new Error('Deposit is either not found or already processed');
      }

      // Guard against double-crediting an FD package whose deposit was already activated directly
      const pkgCodeMatch = freshDeposit.adminNotes?.match(/PKG-[A-Z0-9-]+/);
      if (pkgCodeMatch) {
        const linkedPkg = await tx.investmentPackage.findUnique({
          where: { packageCode: pkgCodeMatch[0] },
        });
        if (linkedPkg && linkedPkg.status !== PackageStatus.PENDING_PAYMENT) {
          throw new Error(
            `This deposit is linked to FD package ${linkedPkg.packageCode} which is already ${linkedPkg.status}. Approving this deposit separately would double-credit the customer.`
          );
        }
      }

      // Determine actual transaction hash or reference without fabricating random hashes
      let settlementReference = (params.txHash || freshDeposit.txHashOrRef || params.depositCode).trim();
      if (
        settlementReference &&
        /^[0-9a-fA-F]{64}$/.test(settlementReference) &&
        params.currency === 'USDT' &&
        (freshDeposit.depositMethod?.includes('BEP20') || freshDeposit.depositMethod?.includes('ERC20'))
      ) {
        settlementReference = `0x${settlementReference}`;
      }

      const systemPrefixes = ['REF-', 'DEP-', 'MAN-', 'PKG-', 'order_'];
      const isExternalRef = settlementReference && !systemPrefixes.some((p) => settlementReference.startsWith(p));
      if (isExternalRef) {
        const dupApprovedDeposit = await tx.depositRequest.findFirst({
          where: {
            txHashOrRef: settlementReference,
            status: DepositStatus.APPROVED,
            id: { not: params.depositId },
          },
        });
        if (dupApprovedDeposit) {
          throw new Error(
            `Duplicate settlement reference (${settlementReference}) already approved on deposit ${dupApprovedDeposit.depositCode}.`
          );
        }

        const dupTx = await tx.transaction.findFirst({
          where: {
            type: TransactionType.DEPOSIT,
            settlementReference,
            idempotencyKey: { not: idempotencyKey },
          },
        });
        if (dupTx) {
          throw new Error(
            `Duplicate settlement reference (${settlementReference}) already credited on transaction ${dupTx.transactionCode}.`
          );
        }
      }

      const balBefore = new Decimal(lockedBalance.availableBalance.toString());
      const balAfter = balBefore.plus(amountDec);

      // Update wallet balance
      await tx.walletBalance.update({
        where: { id: lockedBalance.id },
        data: { availableBalance: balAfter.toFixed(8) },
      });

      // Double-entry ledger: Debit Asset account, Credit User Available Liability (+ Platform Revenue Margin for Razorpay)
      const upperCur = (params.currency || 'USD').toUpperCase();
      const liveRates = await rateService.getLiveRates().catch(() => ({ rates: { USD: 1, USDT: 1 } as Record<string, number> }));
      const rawPerUsd = liveRates.rates[upperCur] || 1.0;
      let unitBuyPriceUsd =
        upperCur === 'USD' || upperCur === 'USDT' || upperCur === 'USDC'
          ? new Decimal(1)
          : rawPerUsd > 0
          ? new Decimal(1).dividedBy(new Decimal(rawPerUsd))
          : new Decimal(1);

      const combinedNotes = `${params.notes || ''} ${freshDeposit.adminNotes || ''}`;
      const recordedPriceMatch = combinedNotes.match(/Buy Price:\s*1\s+[A-Z0-9]+\s*=\s*\$?([\d,]+(?:\.\d+)?)/i);
      if (recordedPriceMatch) {
        const parsedUnit = new Decimal(recordedPriceMatch[1].replace(/,/g, ''));
        if (parsedUnit.isFinite() && parsedUnit.greaterThan(0)) {
          unitBuyPriceUsd = parsedUnit;
        }
      }
      const totalCostBasisUsd = amountDec.times(unitBuyPriceUsd);
      const priceAuditSuffix = `(Buy Price: 1 ${upperCur} = $${unitBuyPriceUsd.toFixed(2)} USD | Cost Basis: $${totalCostBasisUsd.toFixed(2)} USD)`;

      const assetAccount =
        upperCur === 'USDT' ? 'PLATFORM_TREASURY_USDT' : upperCur === 'USD' ? 'PLATFORM_TREASURY_USD' : `PLATFORM_TREASURY_${upperCur}`;
      const liabilityAccount = upperCur === 'USD' ? 'USER_AVAILABLE_USD' : `USER_AVAILABLE_${upperCur}`;
      const revenueAccount = `PLATFORM_FEE_REVENUE_${upperCur}`;

      let avoraMarginDec = new Decimal(0);
      if (freshDeposit.depositMethod === 'RAZORPAY' || /Avora Margin:/i.test(combinedNotes)) {
        const match = combinedNotes.match(/Avora Margin:\s*\$?([\d,]+(?:\.\d+)?)/i);
        if (match) {
          const parsedMargin = new Decimal(match[1].replace(/,/g, ''));
          if (parsedMargin.isFinite() && parsedMargin.greaterThan(0)) {
            avoraMarginDec = new Decimal(parsedMargin.toFixed(8));
          }
        }
      }

      const journalEntries: any[] = [
        {
          accountId: assetAccount,
          direction: 'DEBIT',
          amount:
            avoraMarginDec.greaterThan(0) && ['USD', 'USDT', 'USDC'].includes(upperCur)
              ? amountDec.plus(avoraMarginDec).toFixed(8)
              : amountDec.toFixed(8),
          currency: upperCur,
        },
        {
          accountId: liabilityAccount,
          userId: params.userId,
          direction: 'CREDIT',
          amount: amountDec.toFixed(8),
          currency: upperCur,
        },
      ];

      if (avoraMarginDec.greaterThan(0)) {
        if (['USD', 'USDT', 'USDC'].includes(upperCur)) {
          journalEntries.push({
            accountId: revenueAccount,
            direction: 'CREDIT',
            amount: avoraMarginDec.toFixed(8),
            currency: upperCur,
          });
        } else {
          // For BTC/ETH purchases paid via USD card/gateway, keep fee revenue balanced in USD
          journalEntries.push(
            {
              accountId: 'PLATFORM_TREASURY_USD',
              direction: 'DEBIT',
              amount: avoraMarginDec.toFixed(8),
              currency: 'USD',
            },
            {
              accountId: 'PLATFORM_FEE_REVENUE_USD',
              direction: 'CREDIT',
              amount: avoraMarginDec.toFixed(8),
              currency: 'USD',
            }
          );
        }
      }

      await this.recordJournal(tx, {
        idempotencyKey,
        referenceType: JournalReferenceType.DEPOSIT,
        referenceId: params.depositCode,
        notes: params.notes || `Deposit approved: ${params.depositCode}`,
        createdBy: params.reviewedBy,
        entries: journalEntries,
      });

      // Record User-facing Transaction
      const dpCur = ['BTC', 'ETH'].includes(upperCur) ? 8 : 2;
      const baseTxNote = params.notes || `Deposit of ${amountDec.toFixed(dpCur)} ${upperCur} approved`;
      const enrichedTxNote = baseTxNote.includes('Buy Price:') ? baseTxNote : `${baseTxNote} ${priceAuditSuffix}`;
      const transactionCode = `TX-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          transactionCode,
          userId: params.userId,
          type: TransactionType.DEPOSIT,
          amount: amountDec.toFixed(8),
          currency: upperCur,
          status: TransactionStatus.COMPLETED,
          balanceBefore: balBefore.toFixed(8),
          balanceAfter: balAfter.toFixed(8),
          settlementReference,
          createdBy: params.reviewedBy,
          idempotencyKey,
          notes: enrichedTxNote,
        },
      });

      if (avoraMarginDec.greaterThan(0)) {
        await tx.transaction.create({
          data: {
            transactionCode: `TX-RZPF-${params.depositCode.slice(-12)}`,
            userId: params.userId,
            type: TransactionType.FEE,
            amount: avoraMarginDec.toFixed(8),
            currency: upperCur,
            status: TransactionStatus.COMPLETED,
            balanceBefore: balAfter.toFixed(8),
            balanceAfter: balAfter.toFixed(8),
            settlementReference: params.depositCode,
            createdBy: params.reviewedBy,
            idempotencyKey: `${idempotencyKey}-FEE`,
            notes: `Avora Bank Razorpay platform margin collected on deposit ${params.depositCode}`,
          },
        });
      }

      // Update deposit request
      const updatedDeposit = await tx.depositRequest.update({
        where: { id: params.depositId },
        data: {
          status: DepositStatus.APPROVED,
          reviewedBy: params.reviewedBy,
          reviewedAt: new Date(),
          adminNotes: params.notes || freshDeposit.adminNotes,
          txHashOrRef: settlementReference,
        },
      });

      return {
        deposit: updatedDeposit,
        balanceAfter: balAfter.toFixed(dpCur),
        unitBuyPriceUsd: unitBuyPriceUsd.toFixed(2),
        costBasisUsd: totalCostBasisUsd.toFixed(2),
      };
    }, { timeout: 45000, maxWait: 15000 });
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
      const upperPkgCur = (params.currency || 'USD').toUpperCase();
      await this.recordJournal(tx, {
        idempotencyKey: params.idempotencyKey,
        referenceType: JournalReferenceType.PACKAGE_PURCHASE,
        referenceId: packageCode,
        notes: `Investment package purchase ${packageCode} for ${amountDec.toFixed(2)} ${upperPkgCur}`,
        createdBy: params.userId,
        entries: [
          {
            accountId: `USER_AVAILABLE_${upperPkgCur}`,
            userId: params.userId,
            direction: 'DEBIT',
            amount: amountDec.toFixed(8),
            currency: upperPkgCur,
          },
          {
            accountId: `USER_LOCKED_PRINCIPAL_${upperPkgCur}`,
            userId: params.userId,
            direction: 'CREDIT',
            amount: amountDec.toFixed(8),
            currency: upperPkgCur,
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
      const upperRetCur = (params.currency || 'USD').toUpperCase();
      const journal = await this.recordJournal(tx, {
        idempotencyKey: params.idempotencyKey,
        referenceType: JournalReferenceType.MONTHLY_RETURN,
        referenceId: pkg.packageCode,
        notes: `Monthly return cycle ${params.periodIndex} for package ${pkg.packageCode}`,
        createdBy: 'CRON_RETURNS_ENGINE',
        entries: [
          {
            accountId: `PLATFORM_RETURNS_EXPENSE_${upperRetCur}`,
            direction: 'DEBIT',
            amount: returnAmountDec.toFixed(8),
            currency: upperRetCur,
          },
          {
            accountId: `USER_AVAILABLE_${upperRetCur}`,
            userId: params.userId,
            direction: 'CREDIT',
            amount: returnAmountDec.toFixed(8),
            currency: upperRetCur,
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
  async releaseMaturedPrincipal(packageId: string, adminUserId: string = 'SYSTEM', force: boolean = false) {
    const pkgMeta = await prisma.investmentPackage.findUnique({
      where: { id: packageId },
      select: { userId: true, currency: true },
    });
    if (!pkgMeta) throw new Error('Package not found');
    const wallet = await this.ensureWallet(pkgMeta.userId);

    return await prisma.$transaction(async (tx) => {
      // Lock user wallet balance first to serialize concurrent releases
      const lockedBal = await this.lockWalletBalance(tx, wallet.id, pkgMeta.currency);

      // Re-fetch package inside locked transaction
      const pkg = await tx.investmentPackage.findUnique({
        where: { id: packageId },
      });
      if (!pkg) throw new Error('Package not found');
      if (pkg.status !== PackageStatus.ACTIVE) {
        throw new Error(`Package status is ${pkg.status}, cannot release principal`);
      }

      const now = new Date();
      if (!force && pkg.lockInEnd && now < pkg.lockInEnd) {
        throw new Error(`Package lock-in period has not ended yet. Ends at: ${pkg.lockInEnd.toISOString()}`);
      }

      const amountDec = new Decimal(pkg.amount.toString());
      const idempotencyKey = `PRINCIPAL-RELEASE-${pkg.packageCode}`;

      const availBal = new Decimal(lockedBal.availableBalance.toString());
      const lockedPrinc = new Decimal(lockedBal.lockedPrincipal.toString());

      if (lockedPrinc.lessThan(amountDec)) {
        throw new Error(
          `Insufficient locked principal (${lockedPrinc.toFixed(2)} ${pkg.currency}) to release ${amountDec.toFixed(2)} ${pkg.currency} for package ${pkg.packageCode}`
        );
      }

      const newAvailBal = availBal.plus(amountDec);
      const newLockedPrinc = lockedPrinc.minus(amountDec);

      await tx.walletBalance.update({
        where: { id: lockedBal.id },
        data: {
          availableBalance: newAvailBal.toFixed(8),
          lockedPrincipal: newLockedPrinc.toFixed(8),
        },
      });

      // Update package status to MATURED
      await tx.investmentPackage.update({
        where: { id: packageId },
        data: { status: 'MATURED' },
      });

      // Double-entry: Debit Locked Principal Liability, Credit Available Liability
      const upperRelCur = (pkg.currency || 'USD').toUpperCase();
      await this.recordJournal(tx, {
        idempotencyKey,
        referenceType: JournalReferenceType.PRINCIPAL_RELEASE,
        referenceId: pkg.packageCode,
        notes: `Principal released for matured package ${pkg.packageCode}`,
        createdBy: adminUserId,
        entries: [
          {
            accountId: `USER_LOCKED_PRINCIPAL_${upperRelCur}`,
            userId: pkg.userId,
            direction: 'DEBIT',
            amount: amountDec.toFixed(8),
            currency: upperRelCur,
          },
          {
            accountId: `USER_AVAILABLE_${upperRelCur}`,
            userId: pkg.userId,
            direction: 'CREDIT',
            amount: amountDec.toFixed(8),
            currency: upperRelCur,
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
   * Get user wallet balances with summary and full portfolio valuation breakdown
   */
  async getUserWalletSummary(userId: string) {
    const wallet = await this.ensureWallet(userId);
    const [
      balances,
      liveRates,
      returnsAgg,
      activePackages,
      activeCommitments,
      tokenAccess,
      creditedReturnsList,
      p2pOrders,
      otcTradesAgg,
      ventureDistAgg,
    ] = await Promise.all([
      prisma.walletBalance.findMany({
        where: { walletId: wallet.id },
      }),
      rateService.getLiveRates(),
      prisma.packageReturn.aggregate({
        where: { userId, status: 'CREDITED' },
        _sum: { returnAmount: true },
        _count: { id: true },
      }),
      prisma.investmentPackage.findMany({
        where: { userId, status: 'ACTIVE' },
        select: {
          id: true,
          packageCode: true,
          amount: true,
          currency: true,
          returnRateSnapshot: true,
          lockInMonths: true,
          purchaseDate: true,
          lockInStart: true,
          status: true,
        },
      }),
      prisma.investmentCommitment.findMany({
        where: { investorUserId: userId, status: { in: ['ACTIVE', 'CLEARED_FUNDS'] } },
        include: { listing: { select: { companyName: true, industry: true, stage: true, instrument: true } } },
      }),
      prisma.tokenEarlyAccess.findUnique({
        where: { userId },
      }).catch(() => null),
      prisma.packageReturn.findMany({
        where: { userId, status: 'CREDITED' },
        include: { package: { select: { packageCode: true } } },
        orderBy: { payoutDate: 'desc' },
        take: 30,
      }).catch(() => []),
      prisma.p2POrder.findMany({
        where: {
          OR: [{ buyerId: userId }, { sellerId: userId }],
          status: 'COMPLETED',
        },
        select: {
          id: true,
          orderCode: true,
          buyerId: true,
          sellerId: true,
          cryptoAmount: true,
          cryptoCurrency: true,
          fiatAmount: true,
          fiatCurrency: true,
          price: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { completedAt: 'desc' },
        take: 30,
      }).catch(() => []),
      prisma.otcTrade.aggregate({
        where: { operatorId: userId, status: 'COMPLETED' },
        _sum: { operatorFee: true },
        _count: { id: true },
      }).catch(() => ({ _sum: { operatorFee: null }, _count: { id: 0 } })),
      prisma.investmentCommitment.aggregate({
        where: { investorUserId: userId },
        _sum: { netDistributedProfit: true, realizedProceeds: true },
      }).catch(() => ({ _sum: { netDistributedProfit: null, realizedProceeds: null } })),
    ]);

    const toUsd = (amt: Decimal, currency: string): Decimal => {
      const upper = (currency || 'USD').toUpperCase();
      if (upper === 'USD' || upper === 'USDT' || upper === 'USDC') return amt;
      const rate = liveRates.rates[upper];
      if (!rate || rate <= 0) return amt;
      return amt.dividedBy(new Decimal(rate));
    };

    let available = new Decimal(0);
    let locked = new Decimal(0);
    let pending = new Decimal(0);
    let cryptoTotalUsd = new Decimal(0);
    let fiatTotalUsd = new Decimal(0);
    let stablecoinTotalUsd = new Decimal(0);

    const assetItems: any[] = [];

    for (const b of balances) {
      const upper = (b.currency || 'USD').toUpperCase();
      const isVolatileCrypto = ['BTC', 'ETH'].includes(upper);
      const isStablecoin = ['USDT', 'USDC'].includes(upper);
      const isCrypto = isVolatileCrypto || isStablecoin;
      const dp = isVolatileCrypto ? 8 : 2;

      const availDec = new Decimal(b.availableBalance.toString());
      const lockedDec = new Decimal(b.lockedPrincipal.toString());
      const pendingDec = new Decimal(b.pendingSettlement.toString());
      const totalDec = availDec.plus(lockedDec).plus(pendingDec);

      const availUsd = toUsd(availDec, upper);
      const lockedUsd = toUsd(lockedDec, upper);
      const pendingUsd = toUsd(pendingDec, upper);
      const totalUsd = availUsd.plus(lockedUsd).plus(pendingUsd);

      available = available.plus(availUsd);
      locked = locked.plus(lockedUsd);
      pending = pending.plus(pendingUsd);

      if (isVolatileCrypto) {
        cryptoTotalUsd = cryptoTotalUsd.plus(totalUsd);
      } else if (isStablecoin) {
        stablecoinTotalUsd = stablecoinTotalUsd.plus(totalUsd);
      } else {
        fiatTotalUsd = fiatTotalUsd.plus(totalUsd);
      }

      const rawRate = liveRates.rates[upper] || 1;
      const unitPriceUsd = upper === 'USD' || upper === 'USDT' || upper === 'USDC'
        ? 1.0
        : rawRate > 0
        ? Number((1 / rawRate).toFixed(isVolatileCrypto ? 2 : 4))
        : 1.0;

      assetItems.push({
        currency: upper,
        category: isVolatileCrypto ? 'CRYPTO' : isStablecoin ? 'STABLECOIN' : 'FIAT',
        available: availDec.toFixed(dp),
        availableUsd: availUsd.toFixed(2),
        locked: lockedDec.toFixed(dp),
        lockedUsd: lockedUsd.toFixed(2),
        pending: pendingDec.toFixed(dp),
        pendingUsd: pendingUsd.toFixed(2),
        total: totalDec.toFixed(dp),
        totalUsd: totalUsd.toFixed(2),
        ratePerUsd: rawRate.toString(),
        unitPriceUsd: unitPriceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: isVolatileCrypto ? 2 : 4 }),
        hasBalance: totalDec.greaterThan(0),
      });
    }

    let ventureTotalUsd = new Decimal(0);
    const ventureDeals = activeCommitments.map((c) => {
      const val = new Decimal(c.currentValuation?.toString() || c.netInvestedAmount.toString());
      ventureTotalUsd = ventureTotalUsd.plus(val);
      return {
        id: c.id,
        code: c.investmentCode,
        companyName: (c as any).listing?.companyName || 'Startup Venture',
        symbol: (c as any).listing?.industry || (c as any).instrument || 'EQUITY',
        netInvestedUsd: Number(c.netInvestedAmount).toFixed(2),
        currentValuationUsd: val.toFixed(2),
        ownershipPct: c.ownershipPct ? `${c.ownershipPct.toString()}%` : 'SAFE Agreement',
        status: c.status,
      };
    });

    const fdPackagesList = activePackages.map((p) => {
      const pAmtDec = new Decimal(p.amount.toString());
      const pUsd = toUsd(pAmtDec, p.currency);
      return {
        id: p.id,
        code: p.packageCode,
        amount: pAmtDec.toFixed(2),
        currency: p.currency,
        amountUsd: pUsd.toFixed(2),
        returnRatePct: (Number(p.returnRateSnapshot) * 100).toFixed(2),
        lockInMonths: p.lockInMonths,
        status: p.status,
      };
    });

    const totalWallet = available.plus(locked).plus(pending);
    const grandTotal = totalWallet.plus(ventureTotalUsd);
    const accumulatedReturns = new Decimal(returnsAgg._sum.returnAmount?.toString() || '0');

    // Consolidated user earnings calculation across all platform channels
    const fdYieldsPaidUsd = accumulatedReturns;
    let totalMonthlyYieldObligation = new Decimal(0);
    let earliestNextYieldDate: Date | null = null;
    const now = new Date();

    for (const p of activePackages) {
      const pAmt = new Decimal(p.amount.toString());
      const rawRateStr = p.returnRateSnapshot ? String(p.returnRateSnapshot).replace('%', '') : '1.0';
      const parsedRate = parseFloat(rawRateStr);
      const rateDec = new Decimal(Number.isFinite(parsedRate) && parsedRate > 1 ? parsedRate / 100 : (parsedRate || 0.01));
      const mYield = pAmt.times(rateDec);
      totalMonthlyYieldObligation = totalMonthlyYieldObligation.plus(mYield);

      const startRaw = (p as any).lockInStart || p.purchaseDate || now;
      const startDate = new Date(startRaw);
      const lockMonths = p.lockInMonths || 6;
      for (let m = 1; m <= lockMonths; m++) {
        const cycleDue = new Date(startDate);
        cycleDue.setMonth(cycleDue.getMonth() + m);
        if (cycleDue.getTime() > now.getTime()) {
          if (!earliestNextYieldDate || cycleDue.getTime() < earliestNextYieldDate.getTime()) {
            earliestNextYieldDate = cycleDue;
          }
          break;
        }
      }
    }
    const daysUntilNextYield = earliestNextYieldDate
      ? Math.max(0, Math.ceil((earliestNextYieldDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    let p2pTradingProfitUsd = new Decimal(0);
    let p2pFeeSavingsUsd = new Decimal(0);
    for (const o of p2pOrders) {
      const isSeller = o.sellerId === userId;
      const cryptoAmt = new Decimal(o.cryptoAmount.toString());
      const rate = new Decimal(o.price.toString());
      const cur = (o.fiatCurrency || 'USD').toUpperCase();
      const benchmarkRate = liveRates.rates[cur] ? new Decimal(liveRates.rates[cur]) : rate;
      if (isSeller && benchmarkRate.greaterThan(0)) {
        const diff = rate.minus(benchmarkRate);
        if (diff.greaterThan(0)) {
          p2pTradingProfitUsd = p2pTradingProfitUsd.plus(diff.times(cryptoAmt).div(benchmarkRate));
        }
      }
      p2pFeeSavingsUsd = p2pFeeSavingsUsd.plus(cryptoAmt.times(0.005));
    }

    const otcCommissionsUsd = new Decimal(otcTradesAgg._sum?.operatorFee?.toString() || '0');
    const ventureRealizedProfitsUsd = new Decimal(ventureDistAgg._sum?.netDistributedProfit?.toString() || '0');
    let ventureUnrealizedGainsUsd = new Decimal(0);
    for (const c of activeCommitments) {
      const netInvested = new Decimal(c.netInvestedAmount.toString());
      const val = new Decimal(c.currentValuation?.toString() || c.netInvestedAmount.toString());
      if (val.greaterThan(netInvested)) {
        ventureUnrealizedGainsUsd = ventureUnrealizedGainsUsd.plus(val.minus(netInvested));
      }
    }

    const totalCumulativeEarningsUsd = fdYieldsPaidUsd
      .plus(p2pTradingProfitUsd)
      .plus(otcCommissionsUsd)
      .plus(ventureRealizedProfitsUsd);

    // Add portfolio percentage to each item
    const formattedItems = assetItems.map((item) => {
      const itemUsd = new Decimal(item.totalUsd);
      const pct = grandTotal.greaterThan(0)
        ? Number((itemUsd.dividedBy(grandTotal).times(100)).toFixed(2))
        : 0;
      return {
        ...item,
        portfolioSharePct: pct,
      };
    });

    return {
      walletId: wallet.id,
      baseCurrency: 'USD',
      totalPortfolioValueUsd: grandTotal.toFixed(2),
      totalActiveInvestmentsUsd: locked.plus(ventureTotalUsd).toFixed(2),
      totalReturnsPaidUsd: accumulatedReturns.toFixed(2),
      totalPendingWithdrawalsUsd: pending.toFixed(2),
      summary: {
        available: available.toFixed(2),
        lockedPrincipal: locked.toFixed(2),
        pendingSettlement: pending.toFixed(2),
        total: grandTotal.toFixed(2),
        accumulatedReturns: accumulatedReturns.toFixed(2),
      },
      portfolioBreakdown: {
        grandTotalUsd: grandTotal.toFixed(2),
        liquidAvailableUsd: available.toFixed(2),
        lockedPrincipalUsd: locked.toFixed(2),
        pendingSettlementUsd: pending.toFixed(2),
        cryptoTotalUsd: cryptoTotalUsd.toFixed(2),
        stablecoinTotalUsd: stablecoinTotalUsd.toFixed(2),
        fiatTotalUsd: fiatTotalUsd.toFixed(2),
        activeVentureUsd: ventureTotalUsd.toFixed(2),
        activeInvestmentsUsd: locked.plus(ventureTotalUsd).toFixed(2),
        items: formattedItems,
        activeBalances: formattedItems.filter((i) => i.hasBalance),
        fixedDeposits: {
          count: activePackages.length,
          packages: fdPackagesList,
        },
        ventureInvestments: {
          count: activeCommitments.length,
          totalValuationUsd: ventureTotalUsd.toFixed(2),
          deals: ventureDeals,
        },
        ratesSnapshot: {
          lastUpdated: liveRates.lastUpdated,
          source: liveRates.source,
        },
        formula: 'Total Portfolio Value = Liquid Available Balances ($) + Locked Escrow/Reserves ($) + Pending Settlements ($) + Venture Equity Holdings ($)',
      },
      balances: balances.map((b) => {
        const dp = ['BTC', 'ETH'].includes((b.currency || '').toUpperCase()) ? 8 : 2;
        const availStr = new Decimal(b.availableBalance.toString()).toFixed(dp);
        const lockedStr = new Decimal(b.lockedPrincipal.toString()).toFixed(dp);
        const pendingStr = new Decimal(b.pendingSettlement.toString()).toFixed(dp);
        return {
          currency: b.currency,
          available: availStr,
          availableBalance: availStr,
          locked: lockedStr,
          lockedPrincipal: lockedStr,
          pending: pendingStr,
          pendingSettlement: pendingStr,
        };
      }),
      earningsSummary: {
        totalCumulativeEarningsUsd: totalCumulativeEarningsUsd.toFixed(2),
        fdYieldsPaidUsd: fdYieldsPaidUsd.toFixed(2),
        fdYieldsCount: returnsAgg._count?.id || creditedReturnsList.length,
        monthlyYieldObligationUsd: totalMonthlyYieldObligation.toFixed(2),
        nextScheduledYieldDate: earliestNextYieldDate ? earliestNextYieldDate.toISOString() : null,
        daysUntilNextYield,
        p2pTradingProfitUsd: p2pTradingProfitUsd.toFixed(2),
        p2pCompletedTradesCount: p2pOrders.length,
        p2pFeeSavingsUsd: p2pFeeSavingsUsd.toFixed(2),
        otcCommissionsUsd: otcCommissionsUsd.toFixed(2),
        otcCompletedTradesCount: otcTradesAgg._count?.id || 0,
        ventureRealizedProfitsUsd: ventureRealizedProfitsUsd.toFixed(2),
        ventureUnrealizedGainsUsd: ventureUnrealizedGainsUsd.toFixed(2),
        creditedReturnsList: creditedReturnsList.map((r: any) => ({
          id: r.id,
          packageCode: r.package?.packageCode || 'FD-PACKAGE',
          periodIndex: r.periodIndex,
          amount: new Decimal(r.returnAmount.toString()).toFixed(2),
          currency: r.currency || 'USD',
          payoutDate: r.payoutDate,
          status: r.status,
        })),
        p2pTradeProfitsList: p2pOrders.slice(0, 15).map((o: any) => ({
          id: o.id,
          orderCode: o.orderCode,
          role: o.sellerId === userId ? 'Seller (Maker)' : 'Buyer',
          cryptoAmount: new Decimal(o.cryptoAmount.toString()).toFixed(2),
          cryptoCurrency: o.cryptoCurrency,
          fiatAmount: new Decimal(o.fiatAmount.toString()).toFixed(2),
          fiatCurrency: o.fiatCurrency,
          price: new Decimal(o.price.toString()).toFixed(2),
          completedAt: o.completedAt || o.createdAt,
        })),
      },
    };
  }

  /**
   * Execute an instant real multi-currency swap between a user's wallet balances.
   * Debits fromCurrency, credits toCurrency using real exchange rates.
   * Records balanced double-entry ledger entries and transaction record.
   */
  async executeCurrencySwap(params: {
    userId: string;
    fromCurrency: string;
    toCurrency: string;
    fromAmount: string | number;
    notes?: string;
    consumeFromPending?: boolean;
    customEffectiveRate?: string | number;
  }) {
    const fromAmountDec = new Decimal(params.fromAmount.toString());
    if (fromAmountDec.lessThanOrEqualTo(0)) {
      throw new Error('Swap amount must be greater than zero');
    }

    if (params.fromCurrency === params.toCurrency) {
      throw new Error('From and To currencies must be different');
    }

    // Determine exchange rate from live RateService (respecting Admin rate overrides)
    // and apply pair-specific or global spread percentage.
    const [pair, live, spreadSetting] = await Promise.all([
      prisma.exchangePair.findFirst({
        where: {
          OR: [
            { baseCurrency: params.fromCurrency, quoteCurrency: params.toCurrency },
            { baseCurrency: params.toCurrency, quoteCurrency: params.fromCurrency },
          ],
          isActive: true,
        },
      }),
      rateService.getLiveRates(),
      prisma.cmsSetting.findUnique({ where: { key: 'exchange_spread_percent' } }).catch(() => null),
    ]);

    const fromCurUpper = params.fromCurrency.toUpperCase();
    const toCurUpper = params.toCurrency.toUpperCase();
    const rawGlobalSpread = parseFloat(spreadSetting?.value || '1.0');
    let spreadPctDec = new Decimal(Number.isFinite(rawGlobalSpread) && rawGlobalSpread >= 0 ? rawGlobalSpread : 1.0);
    if (pair) {
      spreadPctDec =
        pair.baseCurrency.toUpperCase() === fromCurUpper
          ? Decimal.max(0, new Decimal(pair.sellMarginPct.toString()))
          : Decimal.max(0, new Decimal(pair.buyMarginPct.toString()));
    }

    const fromPerUsd = live.rates[fromCurUpper] || 1.0;
    const toPerUsd = live.rates[toCurUpper] || 1.0;
    const spotRate = new Decimal(toPerUsd).dividedBy(new Decimal(fromPerUsd));
    const multiplier = Decimal.max(new Decimal(0.01), new Decimal(1).minus(spreadPctDec.dividedBy(100)));
    let effectiveRate = new Decimal(spotRate.times(multiplier).toFixed(12));
    if (params.customEffectiveRate !== undefined && params.customEffectiveRate !== null && String(params.customEffectiveRate).trim() !== '') {
      const parsedCustomRate = new Decimal(String(params.customEffectiveRate));
      if (parsedCustomRate.isFinite() && parsedCustomRate.greaterThan(0)) {
        effectiveRate = new Decimal(parsedCustomRate.toFixed(12));
      }
    }

    const fromCur = params.fromCurrency.toUpperCase();
    const toCur = params.toCurrency.toUpperCase();
    const fromDecimals = ['BTC', 'ETH'].includes(fromCur) ? 8 : 2;
    const toDecimals = ['BTC', 'ETH'].includes(toCur) ? 8 : 2;
    const fromAmtFixed = new Decimal(fromAmountDec.toFixed(8));
    const toAmountDec = new Decimal(fromAmtFixed.times(effectiveRate).toFixed(8));
    const fromUsdValueDec =
      fromCur === 'USD' || fromCur === 'USDT' || fromCur === 'USDC'
        ? fromAmtFixed
        : fromPerUsd > 0
        ? fromAmtFixed.dividedBy(new Decimal(fromPerUsd))
        : fromAmtFixed;
    const toUnitBuyPriceUsdDec = toAmountDec.greaterThan(0)
      ? fromUsdValueDec.dividedBy(toAmountDec)
      : toPerUsd > 0
      ? new Decimal(1).dividedBy(new Decimal(toPerUsd))
      : new Decimal(1);
    const fromUnitSellPriceUsdDec =
      fromCur === 'USD' || fromCur === 'USDT' || fromCur === 'USDC'
        ? new Decimal(1)
        : fromPerUsd > 0
        ? new Decimal(1).dividedBy(new Decimal(fromPerUsd))
        : new Decimal(1);
    const spreadFeeFromDec =
      spreadPctDec.greaterThan(0)
        ? Decimal.min(
            fromAmtFixed,
            new Decimal(fromAmtFixed.times(spreadPctDec).dividedBy(100).toFixed(8))
          )
        : new Decimal(0);
    const netTreasuryFromDec = fromAmtFixed.minus(spreadFeeFromDec);
    const idempotencyKey = `SWAP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const wallet = await this.ensureWallet(params.userId);

    const swapResult = await prisma.$transaction(
      async (tx) => {
        // Lock both balance rows to prevent race conditions
        const fromLocked = await this.lockWalletBalance(tx, wallet.id, fromCur);
        const toLocked = await this.lockWalletBalance(tx, wallet.id, toCur);

        const fromSourceField = params.consumeFromPending ? 'pendingSettlement' : 'availableBalance';
        const fromAvail = new Decimal(fromLocked[fromSourceField].toString());
        if (fromAvail.lessThan(fromAmtFixed)) {
          throw new Error(
            `Insufficient ${fromCur} ${params.consumeFromPending ? 'pending swap hold' : 'balance'}. Available: ${fromAvail.toFixed(fromDecimals)} ${fromCur}, Required: ${fromAmtFixed.toFixed(fromDecimals)}`
          );
        }

        const fromBalAfter = fromAvail.minus(fromAmtFixed);
        const toAvail = new Decimal(toLocked.availableBalance.toString());
        const toBalAfter = toAvail.plus(toAmountDec);

        // Update wallet balances
        await tx.walletBalance.update({
          where: { id: fromLocked.id },
          data: { [fromSourceField]: fromBalAfter.toFixed(8) },
        });

        await tx.walletBalance.update({
          where: { id: toLocked.id },
          data: { availableBalance: toBalAfter.toFixed(8) },
        });

        // Record balanced multi-leg double-entry ledger entries (including Platform Spread Revenue)
        const swapJournalEntries: JournalEntryInput[] = [
          {
            accountId: `USER_AVAILABLE_${fromCur}`,
            userId: params.userId,
            direction: 'DEBIT',
            amount: fromAmtFixed.toFixed(8),
            currency: fromCur,
          },
        ];
        if (netTreasuryFromDec.greaterThan(0)) {
          swapJournalEntries.push({
            accountId: `PLATFORM_TREASURY_${fromCur}`,
            direction: 'CREDIT',
            amount: netTreasuryFromDec.toFixed(8),
            currency: fromCur,
          });
        }
        if (spreadFeeFromDec.greaterThan(0)) {
          swapJournalEntries.push({
            accountId: `PLATFORM_FEE_REVENUE_${fromCur}`,
            direction: 'CREDIT',
            amount: spreadFeeFromDec.toFixed(8),
            currency: fromCur,
          });
        }
        swapJournalEntries.push(
          {
            accountId: `PLATFORM_TREASURY_${toCur}`,
            direction: 'DEBIT',
            amount: toAmountDec.toFixed(8),
            currency: toCur,
          },
          {
            accountId: `USER_AVAILABLE_${toCur}`,
            userId: params.userId,
            direction: 'CREDIT',
            amount: toAmountDec.toFixed(8),
            currency: toCur,
          }
        );

        await this.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.EXCHANGE_BUY,
          referenceId: idempotencyKey,
          notes: `Instant swap: ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} -> ${toAmountDec.toFixed(toDecimals)} ${toCur} (Rate: ${effectiveRate.toFixed(8)}, Platform spread ${spreadPctDec.toFixed(2)}%: ${spreadFeeFromDec.toFixed(4)} ${fromCur})`,
          createdBy: params.userId,
          entries: swapJournalEntries,
        });

        // Create user transaction record with exact purchase price & cost basis for Admin liquidity/exposure tracking
        const transactionCode = `TX-SWAP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        const swapAuditNotes = `Swapped ${fromAmtFixed.toFixed(fromDecimals)} ${fromCur} for ${toAmountDec.toFixed(toDecimals)} ${toCur} at rate ${effectiveRate.toFixed(8)} (Buy Price: 1 ${toCur} = $${toUnitBuyPriceUsdDec.toFixed(2)} USD | Sell Price: 1 ${fromCur} = $${fromUnitSellPriceUsdDec.toFixed(2)} USD | Cost Basis: $${fromUsdValueDec.toFixed(2)} USD)`;
        await tx.transaction.create({
          data: {
            transactionCode,
            userId: params.userId,
            type: TransactionType.EXCHANGE_BUY,
            amount: toAmountDec.toFixed(8),
            currency: toCur,
            status: 'COMPLETED',
            balanceBefore: toAvail.toFixed(8),
            balanceAfter: toBalAfter.toFixed(8),
            settlementReference: idempotencyKey,
            notes: swapAuditNotes,
          },
        });

        if (spreadFeeFromDec.greaterThan(0)) {
          await tx.transaction.create({
            data: {
              transactionCode: `TX-SWAPF-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
              userId: params.userId,
              type: TransactionType.FEE,
              amount: spreadFeeFromDec.toFixed(8),
              currency: fromCur,
              status: TransactionStatus.COMPLETED,
              balanceBefore: fromBalAfter.toFixed(8),
              balanceAfter: fromBalAfter.toFixed(8),
              settlementReference: transactionCode,
              idempotencyKey: `${idempotencyKey}-FEE`,
              notes: `${spreadPctDec.toFixed(2)}% Instant Currency Swap spread collected on ${transactionCode}`,
            },
          });
        }

        return {
          success: true,
          transactionCode,
          fromCurrency: fromCur,
          toCurrency: toCur,
          fromAmount: fromAmtFixed.toFixed(fromDecimals),
          toAmount: toAmountDec.toFixed(toDecimals),
          feeAmount: spreadFeeFromDec.toFixed(4),
          feeCurrency: fromCur,
          spreadPct: spreadPctDec.toFixed(2),
          rate: effectiveRate.toFixed(8),
          unitBuyPriceUsd: toUnitBuyPriceUsdDec.toFixed(2),
          unitSellPriceUsd: fromUnitSellPriceUsdDec.toFixed(2),
          costBasisUsd: fromUsdValueDec.toFixed(2),
          priceDisclosureNote:
            'Displayed cryptocurrency and foreign exchange prices may vary due to market fluctuations. Because there can be a time difference between submitting a request and actual execution, transactions are executed based on the applicable market price at the time of processing.',
          balanceAfter: {
            [fromCur]: fromBalAfter.toFixed(fromDecimals),
            [toCur]: toBalAfter.toFixed(toDecimals),
          },
        };
      },
      {
        maxWait: 20000,
        timeout: 60000,
      }
    );

    prisma.user
      .findUnique({ where: { id: params.userId }, select: { email: true, firstName: true, lastName: true } })
      .then((u) => {
        const actor = u ? `${`${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Client'} (${u.email})` : params.userId;
        return notificationService.sendAdminAlert(
          `Crypto/Currency Purchase Alert: ${swapResult.toAmount} ${swapResult.toCurrency} @ $${swapResult.unitBuyPriceUsd}/${swapResult.toCurrency} [${swapResult.transactionCode}]`,
          `${actor} purchased ${swapResult.toAmount} ${swapResult.toCurrency} at Purchase Price: 1 ${swapResult.toCurrency} = $${swapResult.unitBuyPriceUsd} USD (Paid: ${swapResult.fromAmount} ${swapResult.fromCurrency} / Cost Basis: $${swapResult.costBasisUsd} USD).\n` +
            `Execution Rate: 1 ${swapResult.fromCurrency} = ${swapResult.rate} ${swapResult.toCurrency} (1 ${swapResult.fromCurrency} = $${swapResult.unitSellPriceUsd} USD) | Desk Spread (${swapResult.spreadPct}%): ${swapResult.feeAmount} ${swapResult.feeCurrency}.\n` +
            `Liquidity Action Required: Ensure at least ${swapResult.toAmount} ${swapResult.toCurrency} is maintained in platform reserve to cover future sell requests against this $${swapResult.unitBuyPriceUsd}/${swapResult.toCurrency} entry price.`,
          { userId: params.userId, ...swapResult }
        );
      })
      .catch(() => {});

    return swapResult;
  }

  /**
   * Admin manual balance adjustment (CREDIT or DEBIT)
   * With atomic double-entry ledger entries, user transaction record, and full audit trail
   */
  async processAdminBalanceAdjustment(params: {
    userId: string;
    adminUserId: string;
    currency: string;
    amount: string | number;
    type: 'CREDIT' | 'DEBIT';
    reason: string;
  }) {
    const amountDec = new Decimal(params.amount.toString());
    if (amountDec.isNegative() || amountDec.isZero()) {
      throw new Error('Adjustment amount must be strictly positive');
    }

    const idempotencyKey = `ADJ-${params.userId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const wallet = await this.ensureWallet(params.userId);

    return await prisma.$transaction(
      async (tx) => {
        const lockedBalance = await this.lockWalletBalance(tx, wallet.id, params.currency);
      const balBefore = new Decimal(lockedBalance.availableBalance.toString());

      const upperAdjCur = (params.currency || 'USD').toUpperCase();
      const adjDecimals = ['BTC', 'ETH'].includes(upperAdjCur) ? 8 : 2;
      let balAfter: Decimal;
      if (params.type === 'CREDIT') {
        balAfter = balBefore.plus(amountDec);
      } else {
        if (balBefore.lessThan(amountDec)) {
          throw new Error(`Insufficient funds: user has ${balBefore.toFixed(adjDecimals)} ${upperAdjCur}, cannot debit ${amountDec.toFixed(adjDecimals)}`);
        }
        balAfter = balBefore.minus(amountDec);
      }

      await tx.walletBalance.update({
        where: { id: lockedBalance.id },
        data: { availableBalance: balAfter.toFixed(8) },
      });

      const assetAccount = `PLATFORM_TREASURY_${upperAdjCur}`;
      const liabilityAccount = `USER_AVAILABLE_${upperAdjCur}`;

      await this.recordJournal(tx, {
        idempotencyKey,
        referenceType: params.type === 'CREDIT' ? JournalReferenceType.DEPOSIT : JournalReferenceType.WITHDRAWAL_SETTLEMENT,
        referenceId: idempotencyKey,
        notes: `Admin manual ${params.type}: ${params.reason}`,
        createdBy: params.adminUserId,
        entries: params.type === 'CREDIT' ? [
          { accountId: assetAccount, direction: 'DEBIT', amount: amountDec.toFixed(8), currency: upperAdjCur },
          { accountId: liabilityAccount, userId: params.userId, direction: 'CREDIT', amount: amountDec.toFixed(8), currency: upperAdjCur },
        ] : [
          { accountId: liabilityAccount, userId: params.userId, direction: 'DEBIT', amount: amountDec.toFixed(8), currency: upperAdjCur },
          { accountId: assetAccount, direction: 'CREDIT', amount: amountDec.toFixed(8), currency: upperAdjCur },
        ],
      });

      const transactionCode = `TX-ADJ-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await tx.transaction.create({
        data: {
          transactionCode,
          userId: params.userId,
          type: params.type === 'CREDIT' ? TransactionType.DEPOSIT : TransactionType.WITHDRAWAL_SETTLEMENT,
          amount: amountDec.toFixed(8),
          currency: upperAdjCur,
          balanceBefore: balBefore.toFixed(8),
          balanceAfter: balAfter.toFixed(8),
          status: TransactionStatus.COMPLETED,
          settlementReference: idempotencyKey,
          createdBy: params.adminUserId,
          idempotencyKey,
          notes: `Admin balance adjustment (${params.type}): ${params.reason}`,
        },
      });

      return {
        walletId: wallet.id,
        currency: upperAdjCur,
        balanceBefore: balBefore.toFixed(adjDecimals),
        balanceAfter: balAfter.toFixed(adjDecimals),
        amount: amountDec.toFixed(adjDecimals),
        type: params.type,
      };
    },
    { maxWait: 15000, timeout: 30000 }
  );
  }

  /**
   * Pure helper: derive unclaimed & claimed revenue vault summary directly from ledger account rows.
   */
  computeVaultSummaryFromAccounts(
    accounts: Array<{ accountId: string; currency: string; totalDebit: string | number; totalCredit: string | number; netBalance?: string | number }>,
    liveRates: { rates?: Record<string, number> }
  ) {
    const revRows = (accounts || []).filter((a) => String(a.accountId || '').startsWith('PLATFORM_FEE_REVENUE'));
    const unclaimedByCurrency: Record<string, string> = {};
    const claimedByCurrency: Record<string, string> = {};
    const totalCreditedByCurrency: Record<string, string> = {};
    let unclaimedVaultTotalUsd = new Decimal(0);
    let claimedTotalUsd = new Decimal(0);
    let totalCreditedUsd = new Decimal(0);

    const toUsdDec = (amt: Decimal, currency: string) => {
      const cur = (currency || 'USD').toUpperCase();
      if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return amt;
      const unitsPerUsd = Number(liveRates?.rates?.[cur] || 0);
      if (unitsPerUsd > 0) return amt.div(new Decimal(unitsPerUsd));
      return amt;
    };

    for (const row of revRows) {
      const cur = String(row.currency || String(row.accountId || '').replace('PLATFORM_FEE_REVENUE_', '') || 'USD').toUpperCase();
      const credit = new Decimal(row.totalCredit?.toString() || '0');
      const debit = new Decimal(row.totalDebit?.toString() || '0');
      const net = Decimal.max(new Decimal(0), credit.minus(debit));
      unclaimedByCurrency[cur] = net.toFixed(4);
      claimedByCurrency[cur] = debit.toFixed(4);
      totalCreditedByCurrency[cur] = credit.toFixed(4);
      unclaimedVaultTotalUsd = unclaimedVaultTotalUsd.plus(toUsdDec(net, cur));
      claimedTotalUsd = claimedTotalUsd.plus(toUsdDec(debit, cur));
      totalCreditedUsd = totalCreditedUsd.plus(toUsdDec(credit, cur));
    }

    return {
      unclaimedVaultTotalUsd: unclaimedVaultTotalUsd.toFixed(2),
      claimedToAdminWalletTotalUsd: claimedTotalUsd.toFixed(2),
      totalCreditedToLedgerUsd: totalCreditedUsd.toFixed(2),
      unclaimedByCurrency,
      claimedByCurrency,
      totalCreditedByCurrency,
    };
  }

  /**
   * Summarize live unclaimed & claimed platform commission balances from PLATFORM_FEE_REVENUE_* ledger accounts.
   */
  async getPlatformRevenueVaultSummary() {
    const [rawAccs, liveRates] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
        SELECT
          a.\`id\` as accountId,
          a.\`currency\`,
          COALESCE(SUM(CASE WHEN e.\`direction\` = 'CREDIT' THEN e.\`amount\` ELSE 0 END), 0) as totalCredit,
          COALESCE(SUM(CASE WHEN e.\`direction\` = 'DEBIT' THEN e.\`amount\` ELSE 0 END), 0) as totalDebit
        FROM \`diw_ledger_accounts\` a
        LEFT JOIN \`diw_ledger_entries\` e ON a.\`id\` = e.\`accountId\`
        WHERE a.\`id\` LIKE 'PLATFORM_FEE_REVENUE%'
        GROUP BY a.\`id\`, a.\`currency\`
        ORDER BY a.\`id\` ASC
      `),
      rateService.getLiveRates().catch(() => ({ rates: { USD: 1, USDT: 1 } as Record<string, number> })),
    ]);

    return this.computeVaultSummaryFromAccounts(rawAccs, liveRates);
  }

  /**
   * Sweep / claim unclaimed commission earnings from PLATFORM_FEE_REVENUE_<CURRENCY>
   * directly into an Admin user's spendable WalletBalance via balanced double-entry ledger.
   */
  async claimPlatformRevenueToAdminWallet(
    adminUserId: string,
    params: { currency?: string; amount?: string | number; targetUserId?: string; reason?: string }
  ) {
    const recipientId = String(params.targetUserId || adminUserId);
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!recipient || recipient.role !== 'ADMIN' || recipient.status !== 'ACTIVE') {
      throw new Error('Commission earnings can only be transferred into an ACTIVE ADMIN user wallet.');
    }

    const reqCur = String(params.currency || 'ALL').trim().toUpperCase();
    const parsedPartial =
      params.amount !== undefined && params.amount !== null && String(params.amount).trim() !== ''
        ? new Decimal(String(params.amount))
        : null;

    if (parsedPartial && parsedPartial.lessThanOrEqualTo(0)) {
      throw new Error('Claim amount must be greater than zero.');
    }
    if (parsedPartial && reqCur === 'ALL') {
      throw new Error('Specify a single currency when claiming a partial amount, or leave amount blank to sweep all currencies.');
    }

    const revAccounts = await prisma.ledgerAccount.findMany({
      where:
        reqCur === 'ALL'
          ? { id: { startsWith: 'PLATFORM_FEE_REVENUE_' } }
          : { id: `PLATFORM_FEE_REVENUE_${reqCur}` },
      select: { id: true, currency: true },
    });

    if (revAccounts.length === 0) {
      throw new Error(
        reqCur === 'ALL'
          ? 'No commission revenue accounts found to claim.'
          : `No unclaimed revenue ledger account found for ${reqCur}.`
      );
    }

    const recipientWallet = await this.ensureWallet(recipientId);
    const claimCode = `ADMREV-${Date.now().toString().slice(-6)}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;

    const claims: Array<{
      currency: string;
      claimedAmount: string;
      balanceBefore: string;
      balanceAfter: string;
      transactionCode: string;
    }> = [];

    await prisma.$transaction(
      async (tx) => {
        for (const acc of revAccounts) {
          const cur = (acc.currency || acc.id.replace('PLATFORM_FEE_REVENUE_', '') || 'USD').toUpperCase();

          // Lock revenue account row and admin wallet row to prevent concurrent over-claim
          await tx.$queryRawUnsafe(`SELECT id FROM \`diw_ledger_accounts\` WHERE id = ? FOR UPDATE`, acc.id);
          const lockedBal = await this.lockWalletBalance(tx, recipientWallet.id, cur);

          const sums: any[] = await tx.$queryRawUnsafe(
            `SELECT
              COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END), 0) AS totalCredit,
              COALESCE(SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END), 0) AS totalDebit
            FROM \`diw_ledger_entries\`
            WHERE accountId = ?`,
            acc.id
          );
          const totalCredit = new Decimal(sums?.[0]?.totalCredit?.toString() || '0');
          const totalDebit = new Decimal(sums?.[0]?.totalDebit?.toString() || '0');
          const availableRev = Decimal.max(new Decimal(0), totalCredit.minus(totalDebit));

          if (availableRev.lessThanOrEqualTo(0)) {
            if (reqCur !== 'ALL') {
              throw new Error(`No unclaimed ${cur} commission balance remaining in ${acc.id}.`);
            }
            continue;
          }

          let claimAmt = availableRev;
          if (parsedPartial) {
            if (parsedPartial.greaterThan(availableRev)) {
              throw new Error(
                `Requested ${parsedPartial.toFixed(4)} ${cur} exceeds unclaimed vault balance of ${availableRev.toFixed(4)} ${cur}.`
              );
            }
            claimAmt = new Decimal(parsedPartial.toFixed(8));
          } else {
            claimAmt = new Decimal(availableRev.toFixed(8));
          }

          const balBefore = new Decimal(lockedBal.availableBalance.toString());
          const balAfter = balBefore.plus(claimAmt);

          await tx.walletBalance.update({
            where: { id: lockedBal.id },
            data: { availableBalance: balAfter.toFixed(8) },
          });

          const idempotencyKey = `CLAIM-${claimCode}-${cur}`;
          await this.recordJournal(tx, {
            idempotencyKey,
            referenceType: JournalReferenceType.ADJUSTMENT,
            referenceId: claimCode,
            notes: `Admin claimed ${claimAmt.toFixed(4)} ${cur} platform commission earnings to ${recipient.email}`,
            createdBy: adminUserId,
            entries: [
              {
                accountId: acc.id,
                direction: 'DEBIT',
                amount: claimAmt.toFixed(8),
                currency: cur,
              },
              {
                accountId: `USER_AVAILABLE_${cur}`,
                userId: recipientId,
                direction: 'CREDIT',
                amount: claimAmt.toFixed(8),
                currency: cur,
              },
            ],
          });

          const transactionCode = `TX-ADMREV-${Date.now().toString().slice(-6)}-${cur}-${Math.random()
            .toString(36)
            .slice(2, 5)
            .toUpperCase()}`;

          await tx.transaction.create({
            data: {
              transactionCode,
              userId: recipientId,
              type: TransactionType.ADJUSTMENT,
              amount: claimAmt.toFixed(8),
              currency: cur,
              status: TransactionStatus.COMPLETED,
              balanceBefore: balBefore.toFixed(8),
              balanceAfter: balAfter.toFixed(8),
              settlementReference: claimCode,
              createdBy: adminUserId,
              idempotencyKey,
              notes:
                params.reason?.trim() ||
                `Admin Commission Earnings Claimed (${claimAmt.toFixed(4)} ${cur} swept from Platform Revenue Vault ${claimCode})`,
            },
          });

          claims.push({
            currency: cur,
            claimedAmount: claimAmt.toFixed(4),
            balanceBefore: balBefore.toFixed(4),
            balanceAfter: balAfter.toFixed(4),
            transactionCode,
          });
        }

        if (claims.length === 0) {
          throw new Error('There are currently no unclaimed commission earnings available in the Revenue Vault.');
        }

        await tx.adminAuditLog.create({
          data: {
            userId: adminUserId,
            action: 'CLAIM_PLATFORM_REVENUE',
            entity: 'LedgerAccount',
            entityId: claimCode,
            details: `Admin swept commission earnings to ${recipient.email}: ${claims.map((c) => `${c.claimedAmount} ${c.currency}`).join(', ')}`,
          },
        });
      },
      { maxWait: 15000, timeout: 30000 }
    );

    return {
      success: true,
      claimCode,
      recipientEmail: recipient.email,
      claims,
      message: `Successfully transferred ${claims.map((c) => `${c.claimedAmount} ${c.currency}`).join(' + ')} in platform commission earnings to ${recipient.email}'s wallet.`,
    };
  }
}

export const ledgerService = new LedgerService();
