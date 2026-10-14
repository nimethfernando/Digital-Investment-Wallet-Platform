"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalService = exports.WithdrawalService = void 0;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const auth_service_1 = require("./auth.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class WithdrawalService {
    /**
     * Submit a new withdrawal request
     * Enforces:
     * 1. 24h Security Cooldown after password reset/change
     * 2. 2FA verification if enabled
     * 3. 1st-of-the-month submission window rule (configurable via CMS settings)
     * 4. Double-entry allocation (availableBalance -> pendingSettlement)
     */
    async requestWithdrawal(userId, params) {
        const amountDec = new decimal_js_1.default(params.amount.toString());
        const currency = params.currency || 'USD';
        if (amountDec.lessThanOrEqualTo(0)) {
            throw new Error('Withdrawal amount must be strictly greater than 0');
        }
        // 1. Enforce 24-48h Security Cooldown
        await auth_service_1.authService.checkWithdrawalLock(userId);
        // 2. Enforce 2FA verification if user has 2FA enabled
        await auth_service_1.authService.verify2faForUser(userId, params.twoFactorCode);
        // 3. Enforce 1st-of-month window check
        const windowDaySetting = await prisma_1.prisma.cmsSetting.findUnique({
            where: { key: 'withdrawal_window_day' },
        });
        const strictWindowSetting = await prisma_1.prisma.cmsSetting.findUnique({
            where: { key: 'withdrawal_window_strict' },
        });
        const isStrict = strictWindowSetting?.value === 'true'; // default false in dev/testing unless set
        const allowedDay = parseInt(windowDaySetting?.value || '1', 10);
        const today = new Date();
        if (isStrict && today.getUTCDate() !== allowedDay) {
            throw new Error(`Withdrawals may only be submitted on the ${allowedDay}st of each month. Current date: ${today.toISOString().split('T')[0]}`);
        }
        // 4. Validate Principal Release Lock-in
        if (params.withdrawalType === 'PRINCIPAL_RELEASE') {
            if (!params.packageId) {
                throw new Error('Package ID is required for principal release withdrawals');
            }
            const pkg = await prisma_1.prisma.investmentPackage.findUnique({
                where: { id: params.packageId },
            });
            if (!pkg || pkg.userId !== userId) {
                throw new Error('Specified package does not exist or belong to your account');
            }
            if (pkg.lockInEnd && today < pkg.lockInEnd) {
                throw new Error(`Package ${pkg.packageCode} is still in its 6-month lock-in period. Matures on ${pkg.lockInEnd.toISOString().split('T')[0]}.`);
            }
        }
        const requestCode = `WTH-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const idempotencyKey = `WTH-REQ-${userId}-${requestCode}`;
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock user wallet
            const wallet = await ledger_service_1.ledgerService.ensureWallet(userId);
            const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, currency);
            const availBal = new decimal_js_1.default(lockedBal.availableBalance.toString());
            const pendingSettlement = new decimal_js_1.default(lockedBal.pendingSettlement.toString());
            if (availBal.lessThan(amountDec)) {
                throw new Error(`Insufficient available balance ($${availBal.toFixed(2)} ${currency}). Requested: $${amountDec.toFixed(2)} ${currency}`);
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
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.WITHDRAWAL_REQUEST,
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
                    type: client_1.TransactionType.WITHDRAWAL_REQUEST,
                    amount: amountDec.toFixed(8),
                    currency,
                    status: client_1.TransactionStatus.PENDING,
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
                    withdrawalType: params.withdrawalType,
                    amount: amountDec.toFixed(8),
                    currency,
                    payoutMethod: params.payoutMethod,
                    payoutDetails: JSON.stringify(params.payoutDetails),
                    status: client_1.WithdrawalStatus.REQUESTED,
                    requestWindowDate: today,
                },
            });
            return { withdrawal, balanceAfter: newAvail.toFixed(2) };
        }, { timeout: 30000, maxWait: 10000 });
        // Email notification
        await notification_provider_1.notificationService.sendEmail({
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
        }).catch(() => { });
        return result;
    }
    /**
     * Admin: Approve and settle withdrawal
     */
    async adminSettleWithdrawal(withdrawalId, adminUserId, settlementReference, adminNotes) {
        const wth = await prisma_1.prisma.withdrawalRequest.findUnique({
            where: { id: withdrawalId },
            include: { user: true },
        });
        if (!wth)
            throw new Error('Withdrawal request not found');
        if (wth.status !== 'REQUESTED' && wth.status !== 'UNDER_REVIEW' && wth.status !== 'APPROVED') {
            throw new Error(`Withdrawal is already in status: ${wth.status}`);
        }
        const amountDec = new decimal_js_1.default(wth.amount.toString());
        const idempotencyKey = `WTH-SETTLE-${wth.requestCode}`;
        const settled = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock user wallet
            const wallet = await ledger_service_1.ledgerService.ensureWallet(wth.userId);
            const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, wth.currency);
            const pendingSettlement = new decimal_js_1.default(lockedBal.pendingSettlement.toString());
            const newPending = decimal_js_1.default.max(0, pendingSettlement.minus(amountDec));
            await tx.walletBalance.update({
                where: { id: lockedBal.id },
                data: { pendingSettlement: newPending.toFixed(8) },
            });
            // Double-entry: Debit Pending Settlement Transit, Credit Platform Bank/Hot Wallet Treasury
            const treasuryAccount = wth.payoutMethod === 'USDT_WALLET' ? 'PLATFORM_TREASURY_USDT' : 'PLATFORM_TREASURY_USD';
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.WITHDRAWAL_SETTLEMENT,
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
                    type: client_1.TransactionType.WITHDRAWAL_SETTLEMENT,
                    amount: amountDec.toFixed(8),
                    currency: wth.currency,
                    status: client_1.TransactionStatus.COMPLETED,
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
                    status: client_1.WithdrawalStatus.SETTLED,
                    settlementReference,
                    adminNotes: adminNotes || null,
                    reviewedBy: adminUserId,
                    settledAt: new Date(),
                },
            });
            return updatedWth;
        }, { timeout: 30000, maxWait: 10000 });
        // Email alert
        await notification_provider_1.notificationService.sendEmail({
            to: wth.user.email,
            subject: `Withdrawal Settled - ${wth.requestCode}`,
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Withdrawal Dispatched</h3>
          <p>Your withdrawal of <strong>$${amountDec.toFixed(2)} ${wth.currency}</strong> has been completed.</p>
          <p>Payout Reference / UTR / TX Hash: <strong>${settlementReference}</strong></p>
        </div>
      `,
        }).catch(() => { });
        return settled;
    }
    /**
     * Admin: Reject withdrawal and refund funds to available balance
     */
    async adminRejectWithdrawal(withdrawalId, adminUserId, reason) {
        const wth = await prisma_1.prisma.withdrawalRequest.findUnique({
            where: { id: withdrawalId },
            include: { user: true },
        });
        if (!wth)
            throw new Error('Withdrawal request not found');
        if (wth.status !== 'REQUESTED' && wth.status !== 'UNDER_REVIEW') {
            throw new Error(`Cannot reject withdrawal in status: ${wth.status}`);
        }
        const amountDec = new decimal_js_1.default(wth.amount.toString());
        const idempotencyKey = `WTH-REJECT-${wth.requestCode}`;
        const rejected = await prisma_1.prisma.$transaction(async (tx) => {
            // Lock user wallet
            const wallet = await ledger_service_1.ledgerService.ensureWallet(wth.userId);
            const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, wth.currency);
            const availBal = new decimal_js_1.default(lockedBal.availableBalance.toString());
            const pendingBal = new decimal_js_1.default(lockedBal.pendingSettlement.toString());
            const newAvail = availBal.plus(amountDec);
            const newPending = decimal_js_1.default.max(0, pendingBal.minus(amountDec));
            await tx.walletBalance.update({
                where: { id: lockedBal.id },
                data: {
                    availableBalance: newAvail.toFixed(8),
                    pendingSettlement: newPending.toFixed(8),
                },
            });
            // Double-entry reversing journal: Debit Pending Settlement, Credit Available Liability
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.WITHDRAWAL_REJECTED,
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
                    type: client_1.TransactionType.REVERSAL,
                    amount: amountDec.toFixed(8),
                    currency: wth.currency,
                    status: client_1.TransactionStatus.REVERSED,
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
                    status: client_1.WithdrawalStatus.REJECTED,
                    adminNotes: reason,
                    reviewedBy: adminUserId,
                },
            });
            return updatedWth;
        }, { timeout: 30000, maxWait: 10000 });
        // Email alert
        await notification_provider_1.notificationService.sendEmail({
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
        }).catch(() => { });
        return rejected;
    }
    /**
     * Get user's withdrawal requests
     */
    async getUserWithdrawals(userId) {
        const list = await prisma_1.prisma.withdrawalRequest.findMany({
            where: { userId },
            include: { package: { select: { packageCode: true } } },
            orderBy: { createdAt: 'desc' },
        });
        return list.map((w) => ({
            id: w.id,
            requestCode: w.requestCode,
            withdrawalType: w.withdrawalType,
            packageCode: w.package?.packageCode || null,
            amount: new decimal_js_1.default(w.amount.toString()).toFixed(2),
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
    async getAllWithdrawals(filters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.search) {
            where.OR = [
                { requestCode: { contains: filters.search } },
                { user: { email: { contains: filters.search } } },
            ];
        }
        const [withdrawals, total] = await Promise.all([
            prisma_1.prisma.withdrawalRequest.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    package: { select: { packageCode: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.withdrawalRequest.count({ where }),
        ]);
        return {
            withdrawals: withdrawals.map((w) => ({
                id: w.id,
                requestCode: w.requestCode,
                user: w.user,
                withdrawalType: w.withdrawalType,
                packageCode: w.package?.packageCode || null,
                amount: new decimal_js_1.default(w.amount.toString()).toFixed(2),
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
exports.WithdrawalService = WithdrawalService;
exports.withdrawalService = new WithdrawalService();
