import { PrismaClient, WithdrawalType, PayoutMethod, WithdrawalStatus, TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from './ledger.service';
import { authService } from './auth.service';
import { notificationService } from '../adapters/notification/notification.provider';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class WithdrawalService {
  /**
   * Submit a new withdrawal request
   * Enforces:
   * 1. 24h Security Cooldown after password reset/change
   * 2. 2FA verification if enabled
   * 3. 1st-of-the-month submission window rule (configurable via CMS settings)
   * 4. Double-entry allocation (availableBalance -> pendingSettlement)
   */
  async requestWithdrawal(
    userId: string,
    params: {
      withdrawalType: 'MONTHLY_RETURNS' | 'PRINCIPAL_RELEASE';
      packageId?: string;
      amount: number | string;
      currency?: string;
      payoutMethod: 'BANK_TRANSFER' | 'USDT_WALLET' | 'CASH_PICKUP_TBILISI';
      payoutDetails: Record<string, any>;
      twoFactorCode?: string;
    }
  ) {
    const amountDec = new Decimal(params.amount.toString());
    const currency = params.currency || 'USD';

    if (amountDec.lessThanOrEqualTo(0)) {
      throw new Error('Withdrawal amount must be strictly greater than 0');
    }

    // 1. Enforce 24-48h Security Cooldown
    await authService.checkWithdrawalLock(userId);

    // 2. Enforce 2FA verification if user has 2FA enabled
    await authService.verify2faForUser(userId, params.twoFactorCode);

    // 3. Enforce 1st-of-month window check
    const windowDaySetting = await prisma.cmsSetting.findUnique({
      where: { key: 'withdrawal_window_day' },
    });
    const strictWindowSetting = await prisma.cmsSetting.findUnique({
      where: { key: 'withdrawal_window_strict' },
    });

    const isStrict = strictWindowSetting?.value === 'true'; // default false in dev/testing unless set
    const allowedDay = parseInt(windowDaySetting?.value || '1', 10);
    const today = new Date();

    if (isStrict && today.getUTCDate() !== allowedDay) {
      throw new Error(
        `Withdrawals may only be submitted on the ${allowedDay}st of each month. Current date: ${today.toISOString().split('T')[0]}`
      );
    }

    // 4. Validate Principal Release Lock-in
    if (params.withdrawalType === 'PRINCIPAL_RELEASE') {
      if (!params.packageId) {
        throw new Error('Package ID is required for principal release withdrawals');
      }
      const pkg = await prisma.investmentPackage.findUnique({
        where: { id: params.packageId },
      });
      if (!pkg || pkg.userId !== userId) {
        throw new Error('Specified package does not exist or belong to your account');
      }
      if (pkg.lockInEnd && today < pkg.lockInEnd) {
        throw new Error(
          `Package ${pkg.packageCode} is still in its 6-month lock-in period. Matures on ${pkg.lockInEnd.toISOString().split('T')[0]}.`
        );
      }
    }

    const requestCode = `WTH-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const idempotencyKey = `WTH-REQ-${userId}-${requestCode}`;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const result = await prisma.$transaction(
      async (tx) => {
        // Lock user wallet
        const wallet = await ledgerService.ensureWallet(userId);
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, currency);

        const availBal = new Decimal(lockedBal.availableBalance.toString());
        const pendingSettlement = new Decimal(lockedBal.pendingSettlement.toString());

        if (availBal.lessThan(amountDec)) {
          throw new Error(
            `Insufficient available balance ($${availBal.toFixed(2)} ${currency}). Requested: $${amountDec.toFixed(2)} ${currency}`
          );
        }

        const newAvail = availBal.minus(amountDec);
        const newPending = pendingSettlement.plus(amountDec);

        // Update balances
        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            pendingSettlement: newPending.toFixed(8),
          },
        });

        // Double-entry: Debit User Available Liability, Credit Pending Settlement Transit Liability
        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.WITHDRAWAL_REQUEST,
          referenceId: requestCode,
          notes: `Withdrawal request ${requestCode} via ${params.payoutMethod}`,
          createdBy: userId,
          entries: [
            {
              accountId: 'USER_AVAILABLE_USD',
              userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency,
            },
            {
              accountId: 'PENDING_SETTLEMENT_TRANSIT_USD',
              userId,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency,
            },
          ],
        });

        // Record User-facing Transaction
        await tx.transaction.create({
          data: {
            transactionCode: `TX-WTH-${requestCode}`,
            userId,
            packageId: params.packageId || null,
            type: TransactionType.WITHDRAWAL_REQUEST,
            amount: amountDec.toFixed(8),
            currency,
            status: TransactionStatus.PENDING,
            balanceBefore: availBal.toFixed(8),
            balanceAfter: newAvail.toFixed(8),
            settlementReference: requestCode,
            createdBy: userId,
            idempotencyKey,
            notes: `Withdrawal requested via ${params.payoutMethod}`,
          },
        });

        // Create WithdrawalRequest Record
        const withdrawal = await tx.withdrawalRequest.create({
          data: {
            requestCode,
            userId,
            packageId: params.packageId || null,
            withdrawalType: params.withdrawalType as WithdrawalType,
            amount: amountDec.toFixed(8),
            currency,
            payoutMethod: params.payoutMethod as PayoutMethod,
            payoutDetails: JSON.stringify(params.payoutDetails),
            status: WithdrawalStatus.REQUESTED,
            requestWindowDate: today,
          },
        });

        return { withdrawal, balanceAfter: newAvail.toFixed(2) };
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Email notification
    await notificationService.sendEmail({
      to: user.email,
      subject: `Withdrawal Request Received - ${requestCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Request Submitted</h3>
          <p>We received your withdrawal request of <strong>$${amountDec.toFixed(2)} ${currency}</strong> via <strong>${params.payoutMethod}</strong>.</p>
          <p>Reference: <strong>${requestCode}</strong></p>
          <p>Target processing window is ~15 business days. You can track status on your investor dashboard.</p>
        </div>
      `,
    }).catch(() => {});

    return result;
  }

  /**
   * Admin: Approve and settle withdrawal
   */
  async adminSettleWithdrawal(
    withdrawalId: string,
    adminUserId: string,
    settlementReference: string,
    adminNotes?: string
  ) {
    const wth = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!wth) throw new Error('Withdrawal request not found');
    if (wth.status !== 'REQUESTED' && wth.status !== 'UNDER_REVIEW' && wth.status !== 'APPROVED') {
      throw new Error(`Withdrawal is already in status: ${wth.status}`);
    }

    const amountDec = new Decimal(wth.amount.toString());
    const idempotencyKey = `WTH-SETTLE-${wth.requestCode}`;

    const settled = await prisma.$transaction(
      async (tx) => {
        // Lock user wallet
        const wallet = await ledgerService.ensureWallet(wth.userId);
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, wth.currency);

        const pendingSettlement = new Decimal(lockedBal.pendingSettlement.toString());
        const newPending = Decimal.max(0, pendingSettlement.minus(amountDec));

        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: { pendingSettlement: newPending.toFixed(8) },
        });

        // Double-entry: Debit Pending Settlement Transit, Credit Platform Bank/Hot Wallet Treasury
        const treasuryAccount = wth.payoutMethod === 'USDT_WALLET' ? 'PLATFORM_TREASURY_USDT' : 'PLATFORM_TREASURY_USD';
        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.WITHDRAWAL_SETTLEMENT,
          referenceId: wth.requestCode,
          notes: `Settled withdrawal ${wth.requestCode} (Ref: ${settlementReference})`,
          createdBy: adminUserId,
          entries: [
            {
              accountId: 'PENDING_SETTLEMENT_TRANSIT_USD',
              userId: wth.userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency: wth.currency,
            },
            {
              accountId: treasuryAccount,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency: wth.currency,
            },
          ],
        });

        // Transaction Record
        await tx.transaction.create({
          data: {
            transactionCode: `TX-SETTLE-${wth.requestCode}`,
            userId: wth.userId,
            packageId: wth.packageId,
            type: TransactionType.WITHDRAWAL_SETTLEMENT,
            amount: amountDec.toFixed(8),
            currency: wth.currency,
            status: TransactionStatus.COMPLETED,
            balanceBefore: lockedBal.availableBalance,
            balanceAfter: lockedBal.availableBalance,
            settlementReference,
            createdBy: adminUserId,
            idempotencyKey,
            notes: `Withdrawal settled. Payout ref: ${settlementReference}`,
          },
        });

        // Update WithdrawalRequest
        const updatedWth = await tx.withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            status: WithdrawalStatus.SETTLED,
            settlementReference,
            adminNotes: adminNotes || null,
            reviewedBy: adminUserId,
            settledAt: new Date(),
          },
        });

        return updatedWth;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Email alert
    await notificationService.sendEmail({
      to: wth.user.email,
      subject: `Withdrawal Settled - ${wth.requestCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Dispatched</h3>
          <p>Your withdrawal of <strong>$${amountDec.toFixed(2)} ${wth.currency}</strong> has been completed.</p>
          <p>Payout Reference / UTR / TX Hash: <strong>${settlementReference}</strong></p>
        </div>
      `,
    }).catch(() => {});

    return settled;
  }

  /**
   * Admin: Reject withdrawal and refund funds to available balance
   */
  async adminRejectWithdrawal(withdrawalId: string, adminUserId: string, reason: string) {
    const wth = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!wth) throw new Error('Withdrawal request not found');
    if (wth.status !== 'REQUESTED' && wth.status !== 'UNDER_REVIEW') {
      throw new Error(`Cannot reject withdrawal in status: ${wth.status}`);
    }

    const amountDec = new Decimal(wth.amount.toString());
    const idempotencyKey = `WTH-REJECT-${wth.requestCode}`;

    const rejected = await prisma.$transaction(
      async (tx) => {
        // Lock user wallet
        const wallet = await ledgerService.ensureWallet(wth.userId);
        const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, wth.currency);

        const availBal = new Decimal(lockedBal.availableBalance.toString());
        const pendingBal = new Decimal(lockedBal.pendingSettlement.toString());

        const newAvail = availBal.plus(amountDec);
        const newPending = Decimal.max(0, pendingBal.minus(amountDec));

        await tx.walletBalance.update({
          where: { id: lockedBal.id },
          data: {
            availableBalance: newAvail.toFixed(8),
            pendingSettlement: newPending.toFixed(8),
          },
        });

        // Double-entry reversing journal: Debit Pending Settlement, Credit Available Liability
        await ledgerService.recordJournal(tx, {
          idempotencyKey,
          referenceType: JournalReferenceType.WITHDRAWAL_REJECTED,
          referenceId: wth.requestCode,
          notes: `Rejected withdrawal ${wth.requestCode}. Reason: ${reason}`,
          createdBy: adminUserId,
          entries: [
            {
              accountId: 'PENDING_SETTLEMENT_TRANSIT_USD',
              userId: wth.userId,
              direction: 'DEBIT',
              amount: amountDec.toFixed(8),
              currency: wth.currency,
            },
            {
              accountId: 'USER_AVAILABLE_USD',
              userId: wth.userId,
              direction: 'CREDIT',
              amount: amountDec.toFixed(8),
              currency: wth.currency,
            },
          ],
        });

        // Transaction Record
        await tx.transaction.create({
          data: {
            transactionCode: `TX-REJ-${wth.requestCode}`,
            userId: wth.userId,
            packageId: wth.packageId,
            type: TransactionType.REVERSAL,
            amount: amountDec.toFixed(8),
            currency: wth.currency,
            status: TransactionStatus.REVERSED,
            balanceBefore: availBal.toFixed(8),
            balanceAfter: newAvail.toFixed(8),
            settlementReference: wth.requestCode,
            createdBy: adminUserId,
            idempotencyKey,
            notes: `Withdrawal rejected & refunded: ${reason}`,
          },
        });

        // Update WithdrawalRequest
        const updatedWth = await tx.withdrawalRequest.update({
          where: { id: withdrawalId },
          data: {
            status: WithdrawalStatus.REJECTED,
            adminNotes: reason,
            reviewedBy: adminUserId,
          },
        });

        return updatedWth;
      },
      { timeout: 30000, maxWait: 10000 }
    );

    // Email alert
    await notificationService.sendEmail({
      to: wth.user.email,
      subject: `Withdrawal Request Update - ${wth.requestCode}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Rejected</h3>
          <p>Your withdrawal request of <strong>$${amountDec.toFixed(2)} ${wth.currency}</strong> could not be processed.</p>
          <p>Reason: <em>${reason}</em></p>
          <p>The funds have been returned to your available platform wallet balance.</p>
        </div>
      `,
    }).catch(() => {});

    return rejected;
  }

  /**
   * Get user's withdrawal requests
   */
  async getUserWithdrawals(userId: string) {
    const list = await prisma.withdrawalRequest.findMany({
      where: { userId },
      include: { package: { select: { packageCode: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((w) => ({
      id: w.id,
      requestCode: w.requestCode,
      withdrawalType: w.withdrawalType,
      packageCode: w.package?.packageCode || null,
      amount: new Decimal(w.amount.toString()).toFixed(2),
      currency: w.currency,
      payoutMethod: w.payoutMethod,
      payoutDetails: JSON.parse(w.payoutDetails || '{}'),
      status: w.status,
      settlementReference: w.settlementReference,
      createdAt: w.createdAt,
      settledAt: w.settledAt,
    }));
  }

  /**
   * Admin: List all withdrawal requests
   */
  async getAllWithdrawals(filters: {
    status?: WithdrawalStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { requestCode: { contains: filters.search } },
        { user: { email: { contains: filters.search } } },
      ];
    }

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          package: { select: { packageCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        requestCode: w.requestCode,
        user: w.user,
        withdrawalType: w.withdrawalType,
        packageCode: w.package?.packageCode || null,
        amount: new Decimal(w.amount.toString()).toFixed(2),
        currency: w.currency,
        payoutMethod: w.payoutMethod,
        payoutDetails: JSON.parse(w.payoutDetails || '{}'),
        status: w.status,
        settlementReference: w.settlementReference,
        adminNotes: w.adminNotes,
        createdAt: w.createdAt,
        settledAt: w.settledAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const withdrawalService = new WithdrawalService();
