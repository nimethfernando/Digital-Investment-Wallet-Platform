"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageService = exports.PackageService = void 0;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class PackageService {
    /**
     * Helper to retrieve package rules from CMS settings
     */
    async getPackageSettings() {
        const settings = await prisma_1.prisma.cmsSetting.findMany({
            where: {
                key: {
                    in: [
                        'package_min_amount',
                        'package_max_amount',
                        'package_monthly_return_rate',
                        'package_min_lockin_months',
                        'package_early_exit_penalty_pct',
                    ],
                },
            },
        });
        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});
        return {
            minAmount: parseFloat(settingsMap['package_min_amount'] || '1000'),
            maxAmount: parseFloat(settingsMap['package_max_amount'] || '10000'),
            monthlyReturnRate: parseFloat(settingsMap['package_monthly_return_rate'] || '0.0100'), // 1%
            lockInMonths: parseInt(settingsMap['package_min_lockin_months'] || '6', 10),
            earlyExitPenaltyPct: parseFloat(settingsMap['package_early_exit_penalty_pct'] || '5.00'),
        };
    }
    /**
     * Get all packages belonging to a user with detailed analytics
     */
    async getUserPackages(userId) {
        const packages = await prisma_1.prisma.investmentPackage.findMany({
            where: { userId },
            include: {
                returns: {
                    orderBy: { periodIndex: 'desc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const now = new Date();
        return packages.map((pkg) => {
            const amountDec = new decimal_js_1.default(pkg.amount.toString());
            const rateDec = new decimal_js_1.default(pkg.returnRateSnapshot.toString());
            const projectedMonthly = amountDec.times(rateDec);
            const totalEarned = pkg.returns.reduce((sum, r) => sum.plus(new decimal_js_1.default(r.returnAmount.toString())), new decimal_js_1.default(0));
            let daysRemaining = 0;
            let progressPercent = 0;
            if (pkg.lockInStart && pkg.lockInEnd) {
                const start = pkg.lockInStart.getTime();
                const end = pkg.lockInEnd.getTime();
                const current = Math.min(Math.max(now.getTime(), start), end);
                const totalDuration = end - start;
                const elapsed = current - start;
                progressPercent = totalDuration > 0 ? Math.min(100, Math.round((elapsed / totalDuration) * 100)) : 0;
                const msRemaining = Math.max(0, end - now.getTime());
                daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
            }
            return {
                id: pkg.id,
                packageCode: pkg.packageCode,
                amount: amountDec.toFixed(2),
                currency: pkg.currency,
                returnRateSnapshot: rateDec.toFixed(4),
                returnRatePercent: rateDec.times(100).toFixed(1) + '%',
                projectedMonthly: projectedMonthly.toFixed(2),
                totalEarned: totalEarned.toFixed(2),
                lockInMonths: pkg.lockInMonths,
                status: pkg.status,
                purchaseDate: pkg.purchaseDate,
                lockInStart: pkg.lockInStart,
                lockInEnd: pkg.lockInEnd,
                withdrawalEligibilityDate: pkg.withdrawalEligibilityDate,
                daysRemaining,
                progressPercent,
                depositMethod: pkg.depositMethod,
                depositProofUrl: pkg.depositProofUrl,
                returns: pkg.returns.map((r) => ({
                    periodIndex: r.periodIndex,
                    amount: new decimal_js_1.default(r.returnAmount.toString()).toFixed(2),
                    currency: r.currency,
                    payoutDate: r.payoutDate,
                    status: r.status,
                })),
            };
        });
    }
    /**
     * Purchase an investment package
     */
    async purchasePackage(userId, params) {
        const rules = await this.getPackageSettings();
        const amountNum = parseFloat(params.amount.toString());
        if (isNaN(amountNum) || amountNum < rules.minAmount || amountNum > rules.maxAmount) {
            throw new Error(`Package amount must be between $${rules.minAmount.toLocaleString()} and $${rules.maxAmount.toLocaleString()}`);
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const idempotencyKey = `PKG-BUY-${userId}-${Date.now()}`;
        // Case 1: Instant purchase from Wallet Available Balance
        if (params.depositMethod === 'WALLET_BALANCE') {
            const pkg = await ledger_service_1.ledgerService.purchasePackageFromWallet({
                userId,
                amount: amountNum,
                currency: 'USD',
                returnRateSnapshot: rules.monthlyReturnRate,
                lockInMonths: rules.lockInMonths,
                idempotencyKey,
            });
            // Send confirmation notification
            await notification_provider_1.notificationService.sendEmail({
                to: user.email,
                subject: `Investment Package Activated - ${pkg.packageCode}`,
                html: `
          <h3>Investment Package Activated</h3>
          <p>Your package <strong>${pkg.packageCode}</strong> for <strong>$${amountNum.toLocaleString()} USD</strong> is now active!</p>
          <p>Proposed monthly return: <strong>${(rules.monthlyReturnRate * 100).toFixed(1)}% ($${(amountNum * rules.monthlyReturnRate).toFixed(2)}/mo)</strong></p>
          <p>Lock-in period: <strong>${rules.lockInMonths} months</strong></p>
        `,
            });
            return {
                success: true,
                package: pkg,
                message: `Package ${pkg.packageCode} successfully funded from wallet balance and is now active.`,
            };
        }
        // Case 2: Manual deposit with proof upload (Bank Wire, USDT TRC-20, Tbilisi Counter)
        const packageCode = `PKG-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const depositCode = `DEP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const [pkg, deposit] = await prisma_1.prisma.$transaction(async (tx) => {
            const newPkg = await tx.investmentPackage.create({
                data: {
                    packageCode,
                    userId,
                    amount: new decimal_js_1.default(amountNum).toFixed(8),
                    currency: 'USD',
                    returnRateSnapshot: new decimal_js_1.default(rules.monthlyReturnRate).toFixed(4),
                    lockInMonths: rules.lockInMonths,
                    status: 'PENDING_PAYMENT',
                    depositMethod: params.depositMethod,
                    depositProofUrl: params.proofUrl || null,
                },
            });
            const newDeposit = await tx.depositRequest.create({
                data: {
                    depositCode,
                    userId,
                    amount: new decimal_js_1.default(amountNum).toFixed(8),
                    currency: 'USD',
                    depositMethod: params.depositMethod,
                    proofUrl: params.proofUrl || null,
                    txHashOrRef: params.txHashOrRef || null,
                    status: 'PENDING',
                    adminNotes: `Deposit intended for package ${packageCode}`,
                },
            });
            return [newPkg, newDeposit];
        }, { timeout: 30000, maxWait: 10000 });
        // Notify user & platform admin
        await notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: `Investment Package Submitted - ${packageCode}`,
            html: `
        <h3>Package Deposit Under Review</h3>
        <p>Your investment package order <strong>${packageCode}</strong> for <strong>$${amountNum.toLocaleString()} USD</strong> has been received.</p>
        <p>Deposit Reference: <strong>${depositCode}</strong></p>
        <p>Our settlement desk will verify your payment and activate your package shortly.</p>
      `,
        });
        return {
            success: true,
            package: pkg,
            deposit,
            message: `Package ${packageCode} created. Awaiting admin payment verification.`,
        };
    }
    /**
     * Admin: Approve a pending package
     */
    async adminApprovePackage(packageId, adminUserId, adminNotes) {
        const pkg = await prisma_1.prisma.investmentPackage.findUnique({
            where: { id: packageId },
            include: { user: true },
        });
        if (!pkg)
            throw new Error('Package not found');
        if (pkg.status !== 'PENDING_PAYMENT') {
            throw new Error(`Package is already in status: ${pkg.status}`);
        }
        const now = new Date();
        const lockInEnd = new Date(now);
        lockInEnd.setMonth(lockInEnd.getMonth() + pkg.lockInMonths);
        const amountDec = new decimal_js_1.default(pkg.amount.toString());
        const idempotencyKey = `PKG-APPROVE-${pkg.packageCode}`;
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Lock user's wallet
            const wallet = await ledger_service_1.ledgerService.ensureWallet(pkg.userId);
            const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, pkg.currency);
            const availBal = new decimal_js_1.default(lockedBal.availableBalance.toString());
            const lockedPrinc = new decimal_js_1.default(lockedBal.lockedPrincipal.toString());
            const newLockedPrinc = lockedPrinc.plus(amountDec);
            await tx.walletBalance.update({
                where: { id: lockedBal.id },
                data: { lockedPrincipal: newLockedPrinc.toFixed(8) },
            });
            // 2. Activate Package
            const updatedPkg = await tx.investmentPackage.update({
                where: { id: packageId },
                data: {
                    status: 'ACTIVE',
                    purchaseDate: now,
                    lockInStart: now,
                    lockInEnd,
                    withdrawalEligibilityDate: lockInEnd,
                    adminNotes: adminNotes || 'Approved by admin',
                },
            });
            // 3. Double-entry Ledger: Debit Bank/Hot Wallet, Credit User Locked Principal
            const assetAccount = pkg.currency === 'USDT' ? 'PLATFORM_TREASURY_USDT' : 'PLATFORM_TREASURY_USD';
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.PACKAGE_PURCHASE,
                referenceId: pkg.packageCode,
                notes: `Admin approved package ${pkg.packageCode}`,
                createdBy: adminUserId,
                entries: [
                    {
                        accountId: assetAccount,
                        direction: 'DEBIT',
                        amount: amountDec.toFixed(8),
                        currency: pkg.currency,
                    },
                    {
                        accountId: 'USER_LOCKED_PRINCIPAL_USD',
                        userId: pkg.userId,
                        direction: 'CREDIT',
                        amount: amountDec.toFixed(8),
                        currency: pkg.currency,
                    },
                ],
            });
            // 4. Record Transaction
            const transactionCode = `TX-PKG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
            await tx.transaction.create({
                data: {
                    transactionCode,
                    userId: pkg.userId,
                    packageId: pkg.id,
                    type: client_1.TransactionType.PACKAGE_PURCHASE,
                    amount: amountDec.toFixed(8),
                    currency: pkg.currency,
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: availBal.toFixed(8),
                    balanceAfter: availBal.toFixed(8),
                    settlementReference: pkg.packageCode,
                    createdBy: adminUserId,
                    idempotencyKey,
                    notes: `Admin approved & activated Package ${pkg.packageCode} ($${amountDec.toFixed(2)})`,
                },
            });
            return updatedPkg;
        }, { timeout: 30000, maxWait: 10000 });
        // Send confirmation email
        await notification_provider_1.notificationService.sendEmail({
            to: pkg.user.email,
            subject: `Investment Package Approved & Active - ${pkg.packageCode}`,
            html: `
        <h3>Your Investment Package is Active!</h3>
        <p>We have verified your deposit. Package <strong>${pkg.packageCode}</strong> for <strong>$${amountDec.toFixed(2)} USD</strong> is now active.</p>
        <p>Lock-in period begins today and will mature on <strong>${lockInEnd.toLocaleDateString()}</strong>.</p>
      `,
        });
        return updated;
    }
    /**
     * Admin: List all investment packages with filters
     */
    async getAllPackages(filters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.search) {
            where.OR = [
                { packageCode: { contains: filters.search } },
                { user: { email: { contains: filters.search } } },
                { user: { firstName: { contains: filters.search } } },
                { user: { lastName: { contains: filters.search } } },
            ];
        }
        const [packages, total] = await Promise.all([
            prisma_1.prisma.investmentPackage.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    returns: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.investmentPackage.count({ where }),
        ]);
        return {
            packages: packages.map((pkg) => ({
                id: pkg.id,
                packageCode: pkg.packageCode,
                user: pkg.user,
                amount: new decimal_js_1.default(pkg.amount.toString()).toFixed(2),
                currency: pkg.currency,
                returnRateSnapshot: new decimal_js_1.default(pkg.returnRateSnapshot.toString()).times(100).toFixed(1) + '%',
                lockInMonths: pkg.lockInMonths,
                status: pkg.status,
                purchaseDate: pkg.purchaseDate,
                lockInEnd: pkg.lockInEnd,
                depositMethod: pkg.depositMethod,
                depositProofUrl: pkg.depositProofUrl,
                adminNotes: pkg.adminNotes,
                returnsCount: pkg.returns.length,
                createdAt: pkg.createdAt,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
}
exports.PackageService = PackageService;
exports.packageService = new PackageService();
