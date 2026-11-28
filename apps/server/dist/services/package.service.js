"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageService = exports.PackageService = void 0;
exports.getCycleDueDate = getCycleDueDate;
exports.evaluatePackageRedemptionEligibility = evaluatePackageRedemptionEligibility;
exports.assertPackageRedemptionEligible = assertPackageRedemptionEligible;
exports.buildCompletePackagePayoutSchedule = buildCompletePackagePayoutSchedule;
exports.computePackageYieldSchedule = computePackageYieldSchedule;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
/**
 * Computes the calendar anniversary due date for a monthly FD cycle (1-indexed),
 * clamping end-of-month dates cleanly (e.g., Jan 31 + 1 mo -> Feb 28/29).
 */
function getCycleDueDate(startDateInput, periodIndex) {
    const start = new Date(startDateInput);
    const firstOfTargetMonth = new Date(start.getFullYear(), start.getMonth() + periodIndex, 1);
    const lastDayOfTargetMonth = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
    const clampedDay = Math.min(start.getDate(), lastDayOfTargetMonth);
    return new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), clampedDay, start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
}
/**
 * Computes and validates FD redemption / principal release eligibility.
 * Enforces that no FD can be redeemed before its eligible maturity/redemption date.
 */
function evaluatePackageRedemptionEligibility(pkg, now = new Date()) {
    const lockMonths = Math.max(1, Number(pkg.lockInMonths || 6));
    const startRaw = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || now;
    const startDate = new Date(startRaw);
    const computedMaturity = getCycleDueDate(startDate, lockMonths);
    const maturityDate = pkg.lockInEnd ? new Date(pkg.lockInEnd) : computedMaturity;
    const rawEligible = pkg.withdrawalEligibilityDate
        ? new Date(pkg.withdrawalEligibilityDate)
        : maturityDate;
    // The effective eligible redemption date is never earlier than the lock-in maturity date
    const eligibleRedemptionDate = rawEligible.getTime() >= maturityDate.getTime() ? rawEligible : maturityDate;
    const msRemaining = eligibleRedemptionDate.getTime() - now.getTime();
    const daysRemaining = msRemaining > 0 ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;
    const hasReachedMaturityDate = now.getTime() >= eligibleRedemptionDate.getTime();
    const isStatusEligible = pkg.status === 'ACTIVE' || pkg.status === 'MATURED';
    const isLocked = pkg.status === 'ACTIVE' && !hasReachedMaturityDate;
    const isRedeemable = isStatusEligible && hasReachedMaturityDate;
    const eligibleDateStr = eligibleRedemptionDate.toISOString().split('T')[0];
    let lockStatusLabel = 'ELIGIBLE FOR REDEMPTION';
    let blockReason = null;
    if (pkg.status === 'PENDING_PAYMENT') {
        lockStatusLabel = 'PENDING ACTIVATION — Not yet active';
        blockReason = `Redemption Not Available: Package ${pkg.packageCode} is still pending payment activation.`;
    }
    else if (pkg.status === 'SETTLED' || pkg.status === 'MATURED') {
        lockStatusLabel = 'MATURED & PRINCIPAL RELEASED';
        blockReason = `Package ${pkg.packageCode} has already been redeemed/settled.`;
    }
    else if (pkg.status === 'CANCELLED') {
        lockStatusLabel = 'CANCELLED';
        blockReason = `Package ${pkg.packageCode} was cancelled.`;
    }
    else if (isLocked) {
        lockStatusLabel = `LOCKED — Redemption unavailable until ${eligibleDateStr}`;
        blockReason = `Redemption Not Available: This FD (${pkg.packageCode}) has not reached its eligible redemption date yet. Locked until ${eligibleDateStr} (${daysRemaining} day(s) remaining).`;
    }
    return {
        isRedeemable,
        isLocked,
        startDate,
        maturityDate,
        eligibleRedemptionDate,
        daysRemaining,
        lockStatusLabel,
        blockReason,
    };
}
/**
 * Strict backend assertion that throws HTTP 400 if an FD is not eligible for principal redemption.
 * Impossible to bypass via UI or direct API requests.
 */
function assertPackageRedemptionEligible(pkg, now = new Date()) {
    if (!pkg) {
        const err = new Error('Fixed Deposit package not found.');
        err.status = 404;
        throw err;
    }
    const evalResult = evaluatePackageRedemptionEligibility(pkg, now);
    if (pkg.status !== 'ACTIVE') {
        const err = new Error(evalResult.blockReason ||
            `Redemption Not Available: Package ${pkg.packageCode} is in status ${pkg.status} and cannot be redeemed.`);
        err.status = 400;
        err.code = 'FD_INVALID_STATUS_FOR_REDEMPTION';
        throw err;
    }
    if (!evalResult.isRedeemable || evalResult.isLocked) {
        const err = new Error(evalResult.blockReason ||
            `Redemption Not Available: This FD (${pkg.packageCode}) has not reached its eligible redemption date yet.`);
        err.status = 400;
        err.code = 'FD_REDEMPTION_LOCKED';
        throw err;
    }
    return evalResult;
}
/**
 * Generates the complete month-by-month payout schedule for an FD package.
 * Every period 1..N has its own distinct scheduled monthly date derived from the FD start date.
 */
function buildCompletePackagePayoutSchedule(pkg, now = new Date()) {
    const lockMonths = Math.max(1, Number(pkg.lockInMonths || 6));
    const startRaw = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || now;
    const startDate = new Date(startRaw);
    const amountDec = new decimal_js_1.default(pkg.amount?.toString() || '0');
    const rateDec = new decimal_js_1.default(pkg.returnRateSnapshot?.toString() || '0.01');
    const expectedMonthlyStr = amountDec.times(rateDec).toFixed(2);
    const returnsList = Array.isArray(pkg.returns) ? pkg.returns : [];
    const returnByPeriod = new Map();
    for (const r of returnsList) {
        if (typeof r.periodIndex === 'number') {
            returnByPeriod.set(r.periodIndex, r);
        }
    }
    // Detect if multiple existing returns were erroneously stamped with the same calendar date
    const dateCounts = new Map();
    for (const r of returnsList) {
        if (r.payoutDate) {
            const dayKey = new Date(r.payoutDate).toISOString().split('T')[0];
            dateCounts.set(dayKey, (dateCounts.get(dayKey) || 0) + 1);
        }
    }
    const scheduleItems = [];
    // If Period 1 was already paid on or near the start date (e.g. 14 Nov 2026 before Month 1 cycle end),
    // anchor Period 1..N monthly dates from Period 1's date (Period 1 = 14 Nov 2026, Period 2 = 14 Dec 2026, ..., Period 6 = 14 Apr 2027).
    const firstMonthEnd = getCycleDueDate(startDate, 1);
    const p1Return = returnByPeriod.get(1);
    const p1PaidEarlyAnchor = p1Return &&
        p1Return.payoutDate &&
        new Date(p1Return.payoutDate).getTime() < firstMonthEnd.getTime() - 24 * 60 * 60 * 1000
        ? new Date(p1Return.payoutDate)
        : null;
    for (let period = 1; period <= lockMonths; period++) {
        const scheduledDate = p1PaidEarlyAnchor
            ? getCycleDueDate(p1PaidEarlyAnchor, period - 1)
            : getCycleDueDate(startDate, period);
        const matchedReturn = returnByPeriod.get(period);
        const isDueByDate = now.getTime() >= scheduledDate.getTime();
        if (matchedReturn) {
            const rawPayoutDate = matchedReturn.payoutDate ? new Date(matchedReturn.payoutDate) : scheduledDate;
            const dayKey = rawPayoutDate.toISOString().split('T')[0];
            const hasDuplicateBatchDate = (dateCounts.get(dayKey) || 0) > 1;
            // If batch-created on the same date, use the period's individual scheduled monthly date
            const effectiveActualDate = hasDuplicateBatchDate ? scheduledDate : rawPayoutDate;
            const actualAmt = new decimal_js_1.default(matchedReturn.returnAmount?.toString() || expectedMonthlyStr).toFixed(2);
            const txRef = matchedReturn.transactionCode ||
                matchedReturn.ledgerJournalId ||
                `RETURN-${pkg.packageCode}-PERIOD-${period}`;
            scheduleItems.push({
                periodNumber: period,
                periodIndex: period,
                scheduledPayoutDate: scheduledDate.toISOString(),
                expectedPayoutAmount: expectedMonthlyStr,
                actualPayoutDate: effectiveActualDate.toISOString(),
                actualPayoutAmount: actualAmt,
                payoutStatus: 'PAID',
                transactionReference: txRef,
                ledgerJournalId: matchedReturn.ledgerJournalId || null,
                processingStatus: 'COMPLETED',
                isEligibleToProcess: false,
            });
        }
        else if (pkg.status === 'PENDING_PAYMENT') {
            scheduleItems.push({
                periodNumber: period,
                periodIndex: period,
                scheduledPayoutDate: scheduledDate.toISOString(),
                expectedPayoutAmount: expectedMonthlyStr,
                actualPayoutDate: null,
                actualPayoutAmount: null,
                payoutStatus: 'AWAITING_ACTIVATION',
                transactionReference: null,
                ledgerJournalId: null,
                processingStatus: 'AWAITING_ACTIVATION',
                isEligibleToProcess: false,
            });
        }
        else if (pkg.status === 'CANCELLED') {
            scheduleItems.push({
                periodNumber: period,
                periodIndex: period,
                scheduledPayoutDate: scheduledDate.toISOString(),
                expectedPayoutAmount: expectedMonthlyStr,
                actualPayoutDate: null,
                actualPayoutAmount: null,
                payoutStatus: 'CANCELLED',
                transactionReference: null,
                ledgerJournalId: null,
                processingStatus: 'CANCELLED',
                isEligibleToProcess: false,
            });
        }
        else if (pkg.status === 'ACTIVE' && isDueByDate) {
            scheduleItems.push({
                periodNumber: period,
                periodIndex: period,
                scheduledPayoutDate: scheduledDate.toISOString(),
                expectedPayoutAmount: expectedMonthlyStr,
                actualPayoutDate: null,
                actualPayoutAmount: null,
                payoutStatus: 'DUE',
                transactionReference: null,
                ledgerJournalId: null,
                processingStatus: 'ELIGIBLE_NOW',
                isEligibleToProcess: true,
            });
        }
        else {
            scheduleItems.push({
                periodNumber: period,
                periodIndex: period,
                scheduledPayoutDate: scheduledDate.toISOString(),
                expectedPayoutAmount: expectedMonthlyStr,
                actualPayoutDate: null,
                actualPayoutAmount: null,
                payoutStatus: 'PENDING',
                transactionReference: null,
                ledgerJournalId: null,
                processingStatus: 'FUTURE_LOCKED',
                isEligibleToProcess: false,
            });
        }
    }
    return scheduleItems;
}
/**
 * Computes date-based monthly yield completion cycles for an investment package.
 */
function computePackageYieldSchedule(pkg, now = new Date()) {
    const startRaw = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || now;
    const startDate = new Date(startRaw);
    const lockMonths = pkg.lockInMonths || 6;
    const returnsCount = Array.isArray(pkg.returns)
        ? pkg.returns.length
        : typeof pkg.returnsCount === 'number'
            ? pkg.returnsCount
            : 0;
    let completedCycles = 0;
    for (let k = 1; k <= lockMonths; k++) {
        if (now.getTime() >= getCycleDueDate(startDate, k).getTime()) {
            completedCycles = k;
        }
        else {
            break;
        }
    }
    const isActive = pkg.status === 'ACTIVE';
    const duePeriodsCount = isActive ? Math.max(0, completedCycles - returnsCount) : 0;
    const duePeriodIndices = [];
    if (isActive && duePeriodsCount > 0) {
        for (let p = returnsCount + 1; p <= completedCycles; p++) {
            duePeriodIndices.push(p);
        }
    }
    const amountDec = new decimal_js_1.default(pkg.amount?.toString() || '0');
    const rateDec = new decimal_js_1.default(pkg.returnRateSnapshot?.toString() || '0.01');
    const monthlyYieldDec = amountDec.times(rateDec);
    const dueYieldAmount = monthlyYieldDec.times(duePeriodsCount).toFixed(2);
    const nextPeriodIndex = returnsCount < lockMonths ? returnsCount + 1 : null;
    const nextYieldDueDate = isActive && nextPeriodIndex !== null
        ? getCycleDueDate(startDate, nextPeriodIndex)
        : null;
    const daysUntilNextYield = nextYieldDueDate
        ? Math.ceil((nextYieldDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const isYieldDue = isActive && duePeriodsCount > 0;
    const isYieldDueSoon = isActive &&
        !isYieldDue &&
        daysUntilNextYield !== null &&
        daysUntilNextYield > 0 &&
        daysUntilNextYield <= 5;
    return {
        startDate,
        lockMonths,
        returnsCount,
        completedCycles,
        duePeriodsCount,
        duePeriodIndices,
        monthlyYield: monthlyYieldDec.toFixed(2),
        dueYieldAmount,
        nextPeriodIndex,
        nextYieldDueDate,
        daysUntilNextYield,
        isYieldDue,
        isYieldDueSoon,
    };
}
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
                        'package_lock_in_months',
                        'package_min_lockin_months',
                        'package_early_exit_penalty_pct',
                        'payout_day_of_month',
                        'withdrawal_processing_days',
                    ],
                },
            },
        });
        const settingsMap = settings.reduce((acc, s) => {
            acc[s.key] = s.value;
            return acc;
        }, {});
        const baseRate = parseFloat(settingsMap['package_monthly_return_rate'] || '0.0100');
        const lockInMonths = parseInt(settingsMap['package_lock_in_months'] || settingsMap['package_min_lockin_months'] || '6', 10);
        const shortRate = Number((baseRate * 0.8).toFixed(4));
        const longRate = Number((baseRate * 1.25).toFixed(4));
        const baseApr = (baseRate * 12 * 100).toFixed(1);
        const shortApr = (shortRate * 12 * 100).toFixed(1);
        const longApr = (longRate * 12 * 100).toFixed(1);
        return {
            minAmount: parseFloat(settingsMap['package_min_amount'] || '1000'),
            maxAmount: parseFloat(settingsMap['package_max_amount'] || '10000'),
            monthlyReturnRate: baseRate,
            lockInMonths,
            earlyExitPenaltyPct: parseFloat(settingsMap['package_early_exit_penalty_pct'] || '5.00'),
            payoutDayOfMonth: parseInt(settingsMap['payout_day_of_month'] || '1', 10),
            withdrawalProcessingDays: parseInt(settingsMap['withdrawal_processing_days'] || '15', 10),
            availableTerms: [
                { months: 3, monthlyRate: shortRate, aprLabel: `${shortApr}% APR`, name: '3 Months (Quarterly)' },
                { months: lockInMonths, monthlyRate: baseRate, aprLabel: `${baseApr}% APR`, name: `${lockInMonths} Months (Classic)` },
                { months: 12, monthlyRate: longRate, aprLabel: `${longApr}% APR`, name: '12 Months (Annual Maximizer)' },
            ].filter((term, idx, arr) => arr.findIndex((t) => t.months === term.months) === idx),
        };
    }
    /**
     * Get all packages belonging to a user with detailed analytics
     */
    async getUserPackages(userId) {
        await this.repairDuplicateReturnDates().catch(() => { });
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
            const yieldSchedule = computePackageYieldSchedule(pkg, now);
            const payoutSchedule = buildCompletePackagePayoutSchedule(pkg, now);
            const redemptionCheck = evaluatePackageRedemptionEligibility(pkg, now);
            // Detect if multiple returns share the same date so each return uses its scheduled monthly date
            const returnDateCounts = new Map();
            for (const r of pkg.returns) {
                if (r.payoutDate) {
                    const dayKey = new Date(r.payoutDate).toISOString().split('T')[0];
                    returnDateCounts.set(dayKey, (returnDateCounts.get(dayKey) || 0) + 1);
                }
            }
            const startBase = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || now;
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
                lockInEnd: pkg.lockInEnd || redemptionCheck.maturityDate,
                withdrawalEligibilityDate: pkg.withdrawalEligibilityDate || redemptionCheck.eligibleRedemptionDate,
                eligibleRedemptionDate: redemptionCheck.eligibleRedemptionDate,
                isRedeemable: redemptionCheck.isRedeemable,
                isLocked: redemptionCheck.isLocked,
                redemptionLockStatusLabel: redemptionCheck.lockStatusLabel,
                redemptionBlockReason: redemptionCheck.blockReason,
                daysRemaining: redemptionCheck.daysRemaining,
                progressPercent,
                completedCycles: yieldSchedule.completedCycles,
                duePeriodsCount: yieldSchedule.duePeriodsCount,
                dueYieldAmount: yieldSchedule.dueYieldAmount,
                isYieldDue: yieldSchedule.isYieldDue,
                isYieldDueSoon: yieldSchedule.isYieldDueSoon,
                nextPeriodIndex: yieldSchedule.nextPeriodIndex,
                nextYieldDueDate: yieldSchedule.nextYieldDueDate,
                daysUntilNextYield: yieldSchedule.daysUntilNextYield,
                depositMethod: pkg.depositMethod,
                depositProofUrl: pkg.depositProofUrl,
                payoutSchedule,
                returns: [...pkg.returns]
                    .sort((a, b) => a.periodIndex - b.periodIndex)
                    .map((r) => {
                    const amtStr = new decimal_js_1.default(r.returnAmount.toString()).toFixed(2);
                    const scheduledDate = getCycleDueDate(startBase, r.periodIndex);
                    const rawDate = r.payoutDate ? new Date(r.payoutDate) : scheduledDate;
                    const dayKey = rawDate.toISOString().split('T')[0];
                    const effectivePayoutDate = (returnDateCounts.get(dayKey) || 0) > 1 ? scheduledDate : rawDate;
                    return {
                        id: r.id,
                        periodIndex: r.periodIndex,
                        periodNumber: r.periodIndex,
                        amount: amtStr,
                        returnAmount: amtStr,
                        expectedAmount: projectedMonthly.toFixed(2),
                        currency: r.currency,
                        scheduledPayoutDate: scheduledDate,
                        payoutDate: effectivePayoutDate,
                        paidAt: effectivePayoutDate,
                        ledgerJournalId: r.ledgerJournalId || null,
                        transactionReference: r.ledgerJournalId || `RETURN-${pkg.packageCode}-PERIOD-${r.periodIndex}`,
                        status: r.status,
                    };
                }),
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
        // Calculate term duration and yield rate based on Admin FD configuration & selection
        const validTerms = new Set([3, 6, 12, rules.lockInMonths]);
        const termMonths = params.lockInMonths && validTerms.has(params.lockInMonths)
            ? params.lockInMonths
            : rules.lockInMonths;
        const matchedTerm = rules.availableTerms.find((t) => t.months === termMonths);
        const termRate = matchedTerm ? matchedTerm.monthlyRate : rules.monthlyReturnRate;
        // Case 1: Instant purchase from Wallet Available Balance
        if (params.depositMethod === 'WALLET_BALANCE') {
            const pkg = await ledger_service_1.ledgerService.purchasePackageFromWallet({
                userId,
                amount: amountNum,
                currency: 'USD',
                returnRateSnapshot: termRate,
                lockInMonths: termMonths,
                idempotencyKey,
            });
            // Send confirmation notification (non-blocking)
            notification_provider_1.notificationService.sendEmail({
                to: user.email,
                subject: `Investment Package Activated - ${pkg.packageCode}`,
                html: `
          <h3>Investment Package Activated</h3>
          <p>Your package <strong>${pkg.packageCode}</strong> for <strong>$${amountNum.toLocaleString()} USD</strong> is now active!</p>
          <p>Proposed monthly return: <strong>${(termRate * 100).toFixed(2)}% ($${(amountNum * termRate).toFixed(2)}/mo)</strong></p>
          <p>Lock-in period: <strong>${termMonths} months</strong></p>
        `,
            }).catch((e) => console.warn('[PackageService] Email dispatch notice:', e));
            notification_provider_1.notificationService.sendAdminAlert(`FD Investment Activated [${pkg.packageCode}]`, `${user.firstName || 'Investor'} (${user.email}) activated a ${termMonths}-month FD package (${pkg.packageCode}) for $${amountNum.toLocaleString()} USD via Wallet Balance.`, { packageCode: pkg.packageCode, userId, email: user.email, amount: amountNum, termMonths, method: 'WALLET_BALANCE' }).catch(() => { });
            return {
                success: true,
                package: pkg,
                message: `Package ${pkg.packageCode} successfully funded from wallet balance and is now active for ${termMonths} months at ${(termRate * 100).toFixed(2)}%/mo.`,
            };
        }
        // Case 2: Manual deposit with proof upload (Bank Wire, USDT TRC-20, Tbilisi Counter)
        if (params.txHashOrRef?.trim()) {
            await ledger_service_1.ledgerService.assertUniqueTxReference(params.txHashOrRef.trim());
        }
        const packageCode = `PKG-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const depositCode = `DEP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const [pkg, deposit] = await prisma_1.prisma.$transaction(async (tx) => {
            const newPkg = await tx.investmentPackage.create({
                data: {
                    packageCode,
                    userId,
                    amount: new decimal_js_1.default(amountNum).toFixed(8),
                    currency: 'USD',
                    returnRateSnapshot: new decimal_js_1.default(termRate).toFixed(4),
                    lockInMonths: termMonths,
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
                    adminNotes: `Deposit intended for package ${packageCode} (${termMonths}-Month FD @ ${(termRate * 100).toFixed(2)}%/mo)`,
                },
            });
            return [newPkg, newDeposit];
        }, { timeout: 30000, maxWait: 10000 });
        // Notify user & platform admin (non-blocking)
        notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: `Investment Package Submitted - ${packageCode}`,
            html: `
        <h3>Package Deposit Under Review</h3>
        <p>Your investment package order <strong>${packageCode}</strong> for <strong>$${amountNum.toLocaleString()} USD</strong> has been received.</p>
        <p>Deposit Reference: <strong>${depositCode}</strong></p>
        <p>Our settlement desk will verify your payment and activate your package shortly.</p>
      `,
        }).catch((e) => console.warn('[PackageService] Email dispatch notice:', e));
        notification_provider_1.notificationService.sendAdminAlert(`New FD Package Pending Verification [${packageCode}]`, `${user.firstName || 'Investor'} (${user.email}) submitted FD package ${packageCode} ($${amountNum.toLocaleString()} USD, ${termMonths}m) via ${params.depositMethod}.\nDeposit Ref: ${depositCode}\nReview in Admin → FD Packages.`, { packageCode, depositCode, userId, email: user.email, amount: amountNum, termMonths, depositMethod: params.depositMethod }).catch(() => { });
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
        const wallet = await ledger_service_1.ledgerService.ensureWallet(pkg.userId);
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Lock user's wallet first to serialize concurrent package/deposit approvals
            const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, pkg.currency);
            // Re-verify package status inside the locked transaction
            const freshPkg = await tx.investmentPackage.findUnique({
                where: { id: packageId },
            });
            if (!freshPkg || freshPkg.status !== client_1.PackageStatus.PENDING_PAYMENT) {
                throw new Error(`Package is already in status: ${freshPkg?.status || 'NOT_FOUND'}`);
            }
            // Check for a paired DepositRequest created during package checkout
            const pairedDeposit = await tx.depositRequest.findFirst({
                where: {
                    userId: pkg.userId,
                    adminNotes: { contains: pkg.packageCode },
                },
                orderBy: { createdAt: 'desc' },
            });
            if (pairedDeposit && pairedDeposit.status === client_1.DepositStatus.REJECTED) {
                throw new Error(`Paired deposit ${pairedDeposit.depositCode} was rejected and cannot be used to activate ${pkg.packageCode}.`);
            }
            const availBal = new decimal_js_1.default(lockedBal.availableBalance.toString());
            const lockedPrinc = new decimal_js_1.default(lockedBal.lockedPrincipal.toString());
            const newLockedPrinc = lockedPrinc.plus(amountDec);
            let newAvailBal = availBal;
            let journalDebitAccount = pkg.currency === 'USDT' ? 'PLATFORM_TREASURY_USDT' : 'PLATFORM_TREASURY_USD';
            let debitUserId = null;
            if (pairedDeposit && pairedDeposit.status === client_1.DepositStatus.APPROVED) {
                // Admin already credited the paired deposit to availableBalance — move funds from availableBalance -> lockedPrincipal
                if (availBal.lessThan(amountDec)) {
                    throw new Error(`Paired deposit ${pairedDeposit.depositCode} was already credited to available balance, but user now has insufficient available balance ($${availBal.toFixed(2)}) to lock $${amountDec.toFixed(2)} into ${pkg.packageCode}.`);
                }
                newAvailBal = availBal.minus(amountDec);
                journalDebitAccount = 'USER_AVAILABLE_USD';
                debitUserId = pkg.userId;
                await tx.walletBalance.update({
                    where: { id: lockedBal.id },
                    data: {
                        availableBalance: newAvailBal.toFixed(8),
                        lockedPrincipal: newLockedPrinc.toFixed(8),
                    },
                });
            }
            else {
                await tx.walletBalance.update({
                    where: { id: lockedBal.id },
                    data: { lockedPrincipal: newLockedPrinc.toFixed(8) },
                });
                if (pairedDeposit && pairedDeposit.status === client_1.DepositStatus.PENDING) {
                    await tx.depositRequest.update({
                        where: { id: pairedDeposit.id },
                        data: {
                            status: client_1.DepositStatus.APPROVED,
                            reviewedBy: adminUserId,
                            reviewedAt: now,
                            adminNotes: `${pairedDeposit.adminNotes || ''} | Auto-approved & locked via FD activation (${pkg.packageCode})`.trim(),
                        },
                    });
                }
            }
            // 2. Activate Package
            const updatedPkg = await tx.investmentPackage.update({
                where: { id: packageId },
                data: {
                    status: client_1.PackageStatus.ACTIVE,
                    purchaseDate: now,
                    lockInStart: now,
                    lockInEnd,
                    withdrawalEligibilityDate: lockInEnd,
                    adminNotes: adminNotes || 'Approved by admin',
                },
            });
            // 3. Double-entry Ledger: Debit paired source (Treasury or User Available), Credit User Locked Principal
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.PACKAGE_PURCHASE,
                referenceId: pkg.packageCode,
                notes: `Admin approved package ${pkg.packageCode}`,
                createdBy: adminUserId,
                entries: [
                    {
                        accountId: journalDebitAccount,
                        ...(debitUserId ? { userId: debitUserId } : {}),
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
                    balanceAfter: newAvailBal.toFixed(8),
                    settlementReference: pkg.packageCode,
                    createdBy: adminUserId,
                    idempotencyKey,
                    notes: `Admin approved & activated Package ${pkg.packageCode} ($${amountDec.toFixed(2)})`,
                },
            });
            return updatedPkg;
        }, { timeout: 30000, maxWait: 10000 });
        // Send confirmation email (non-blocking)
        notification_provider_1.notificationService.sendEmail({
            to: pkg.user.email,
            subject: `Investment Package Approved & Active - ${pkg.packageCode}`,
            html: `
        <h3>Your Investment Package is Active!</h3>
        <p>We have verified your deposit. Package <strong>${pkg.packageCode}</strong> for <strong>$${amountDec.toFixed(2)} USD</strong> is now active.</p>
        <p>Lock-in period begins today and will mature on <strong>${lockInEnd.toLocaleDateString()}</strong>.</p>
      `,
        }).catch((e) => console.warn('[PackageService] Email dispatch notice:', e));
        return updated;
    }
    /**
     * Seed default packages for investor@avorabank.com if database has none
     */
    async ensureDefaultPackages() {
        const count = await prisma_1.prisma.investmentPackage.count();
        if (count > 0)
            return;
        let investor = await prisma_1.prisma.user.findUnique({ where: { email: 'investor@avorabank.com' } });
        if (!investor) {
            const salt = await bcryptjs_1.default.genSalt(12);
            const hash = await bcryptjs_1.default.hash('Investor2026!Yield', salt);
            investor = await prisma_1.prisma.user.create({
                data: {
                    email: 'investor@avorabank.com',
                    passwordHash: hash,
                    firstName: 'Alex',
                    lastName: 'Morgan',
                    role: 'USER',
                    status: 'ACTIVE',
                    emailVerified: true,
                },
            });
        }
        const wallet = await ledger_service_1.ledgerService.ensureWallet(investor.id);
        const now = new Date();
        const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const fourMonthsAhead = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
        // Update wallet locked balance
        await prisma_1.prisma.walletBalance.updateMany({
            where: { walletId: wallet.id, currency: 'USD' },
            data: { lockedPrincipal: '15000.00000000', availableBalance: '25000.00000000' },
        });
        // Package 1: $5,000 Active Package with 2 months credited
        const pkg1 = await prisma_1.prisma.investmentPackage.create({
            data: {
                packageCode: 'PKG-1001-ALPHA',
                userId: investor.id,
                amount: new decimal_js_1.default('5000.00000000'),
                currency: 'USD',
                returnRateSnapshot: new decimal_js_1.default('0.0100'),
                lockInMonths: 6,
                status: 'ACTIVE',
                purchaseDate: twoMonthsAgo,
                lockInStart: twoMonthsAgo,
                lockInEnd: fourMonthsAhead,
                withdrawalEligibilityDate: fourMonthsAhead,
                depositMethod: 'WALLET_BALANCE',
            },
        });
        await prisma_1.prisma.packageReturn.createMany({
            data: [
                {
                    packageId: pkg1.id,
                    userId: investor.id,
                    periodIndex: 1,
                    returnAmount: new decimal_js_1.default('50.00000000'),
                    currency: 'USD',
                    status: 'CREDITED',
                    payoutDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                },
                {
                    packageId: pkg1.id,
                    userId: investor.id,
                    periodIndex: 2,
                    returnAmount: new decimal_js_1.default('50.00000000'),
                    currency: 'USD',
                    status: 'CREDITED',
                    payoutDate: now,
                },
            ],
        });
        // Package 2: $10,000 Active Package with 1 month credited
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const fiveMonthsAhead = new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000);
        const pkg2 = await prisma_1.prisma.investmentPackage.create({
            data: {
                packageCode: 'PKG-1002-BETA',
                userId: investor.id,
                amount: new decimal_js_1.default('10000.00000000'),
                currency: 'USD',
                returnRateSnapshot: new decimal_js_1.default('0.0100'),
                lockInMonths: 6,
                status: 'ACTIVE',
                purchaseDate: oneMonthAgo,
                lockInStart: oneMonthAgo,
                lockInEnd: fiveMonthsAhead,
                withdrawalEligibilityDate: fiveMonthsAhead,
                depositMethod: 'WALLET_BALANCE',
            },
        });
        await prisma_1.prisma.packageReturn.create({
            data: {
                packageId: pkg2.id,
                userId: investor.id,
                periodIndex: 1,
                returnAmount: new decimal_js_1.default('100.00000000'),
                currency: 'USD',
                status: 'CREDITED',
                payoutDate: now,
            },
        });
        // Package 3: $2,500 Pending Approval
        await prisma_1.prisma.investmentPackage.create({
            data: {
                packageCode: 'PKG-1003-PRIME',
                userId: investor.id,
                amount: new decimal_js_1.default('2500.00000000'),
                currency: 'USD',
                returnRateSnapshot: new decimal_js_1.default('0.0080'),
                lockInMonths: 3,
                status: 'PENDING_PAYMENT',
                depositMethod: 'BANK_WIRE',
                adminNotes: 'Awaiting SWIFT wire confirmation from investor',
            },
        });
    }
    /**
     * Admin: List all investment packages with filters, dates & liability metrics
     */
    async getAllPackages(filters) {
        await this.repairDuplicateReturnDates().catch(() => { });
        const page = filters.page || 1;
        const limit = filters.limit || 500;
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
                    returns: {
                        orderBy: { payoutDate: 'desc' },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.investmentPackage.count({ where }),
        ]);
        const nowMs = Date.now();
        return {
            packages: packages.map((pkg) => {
                const amountDec = new decimal_js_1.default(pkg.amount.toString());
                const monthlyRateDecimal = new decimal_js_1.default(pkg.returnRateSnapshot.toString());
                const lockMonths = pkg.lockInMonths || 6;
                const returnsCount = pkg.returns.length;
                const isSettled = pkg.status === 'MATURED' ||
                    pkg.status === 'SETTLED' ||
                    pkg.status === 'CANCELLED';
                const totalYieldPaidDec = pkg.returns.reduce((sum, r) => sum.plus(new decimal_js_1.default(r.returnAmount.toString())), new decimal_js_1.default(0));
                const monthlyYieldDec = amountDec.times(monthlyRateDecimal);
                const remainingMonths = isSettled ? 0 : Math.max(0, lockMonths - returnsCount);
                const remainingYieldLiabilityDec = monthlyYieldDec.times(remainingMonths);
                const totalExpectedYieldDec = monthlyYieldDec.times(lockMonths);
                const outstandingLiabilityDec = pkg.status === 'ACTIVE' || pkg.status === 'WITHDRAWAL_REQUESTED'
                    ? amountDec.plus(remainingYieldLiabilityDec)
                    : pkg.status === 'PENDING_PAYMENT'
                        ? amountDec
                        : new decimal_js_1.default(0);
                let daysRemaining = 0;
                let progressPercent = 0;
                if (pkg.status === 'PENDING_PAYMENT') {
                    daysRemaining = null;
                    progressPercent = 0;
                }
                else if (isSettled) {
                    daysRemaining = 0;
                    progressPercent = 100;
                }
                else if (pkg.lockInStart && pkg.lockInEnd) {
                    const start = pkg.lockInStart.getTime();
                    const end = pkg.lockInEnd.getTime();
                    const totalDuration = end - start;
                    const elapsed = nowMs - start;
                    progressPercent =
                        totalDuration > 0
                            ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
                            : 0;
                    daysRemaining = Math.ceil((end - nowMs) / (1000 * 60 * 60 * 24));
                }
                const lastPayoutDate = pkg.returns.length > 0 ? pkg.returns[0].payoutDate : null;
                const nowObj = new Date(nowMs);
                const yieldSchedule = computePackageYieldSchedule(pkg, nowObj);
                const payoutSchedule = buildCompletePackagePayoutSchedule(pkg, nowObj);
                const redemptionCheck = evaluatePackageRedemptionEligibility(pkg, nowObj);
                const returnDateCounts = new Map();
                for (const r of pkg.returns) {
                    if (r.payoutDate) {
                        const dayKey = new Date(r.payoutDate).toISOString().split('T')[0];
                        returnDateCounts.set(dayKey, (returnDateCounts.get(dayKey) || 0) + 1);
                    }
                }
                const startBase = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || nowObj;
                return {
                    id: pkg.id,
                    packageCode: pkg.packageCode,
                    user: pkg.user,
                    amount: amountDec.toFixed(2),
                    amountNum: parseFloat(amountDec.toFixed(2)),
                    currency: pkg.currency,
                    monthlyRateDecimal: monthlyRateDecimal.toNumber(),
                    returnRateSnapshot: monthlyRateDecimal.times(100).toFixed(2).replace(/\.00$/, '.0') + '%',
                    monthlyYield: monthlyYieldDec.toFixed(2),
                    totalYieldPaid: totalYieldPaidDec.toFixed(2),
                    remainingMonths,
                    remainingYieldLiability: remainingYieldLiabilityDec.toFixed(2),
                    totalExpectedYield: totalExpectedYieldDec.toFixed(2),
                    outstandingLiability: outstandingLiabilityDec.toFixed(2),
                    lastPayoutDate,
                    lockInMonths: lockMonths,
                    status: pkg.status,
                    purchaseDate: pkg.purchaseDate,
                    lockInStart: pkg.lockInStart,
                    lockInEnd: pkg.lockInEnd || redemptionCheck.maturityDate,
                    withdrawalEligibilityDate: pkg.withdrawalEligibilityDate || redemptionCheck.eligibleRedemptionDate,
                    eligibleRedemptionDate: redemptionCheck.eligibleRedemptionDate,
                    isRedeemable: redemptionCheck.isRedeemable,
                    isLocked: redemptionCheck.isLocked,
                    redemptionLockStatusLabel: redemptionCheck.lockStatusLabel,
                    redemptionBlockReason: redemptionCheck.blockReason,
                    daysRemaining: pkg.status === 'PENDING_PAYMENT' ? null : redemptionCheck.daysRemaining,
                    progressPercent,
                    completedCycles: yieldSchedule.completedCycles,
                    duePeriodsCount: yieldSchedule.duePeriodsCount,
                    dueYieldAmount: yieldSchedule.dueYieldAmount,
                    isYieldDue: yieldSchedule.isYieldDue,
                    isYieldDueSoon: yieldSchedule.isYieldDueSoon,
                    nextPeriodIndex: yieldSchedule.nextPeriodIndex,
                    nextYieldDueDate: yieldSchedule.nextYieldDueDate,
                    daysUntilNextYield: yieldSchedule.daysUntilNextYield,
                    depositMethod: pkg.depositMethod,
                    depositProofUrl: pkg.depositProofUrl,
                    adminNotes: pkg.adminNotes,
                    returnsCount,
                    payoutSchedule,
                    returns: [...pkg.returns]
                        .sort((a, b) => a.periodIndex - b.periodIndex)
                        .map((r) => {
                        const amtStr = new decimal_js_1.default(r.returnAmount.toString()).toFixed(2);
                        const scheduledDate = getCycleDueDate(startBase, r.periodIndex);
                        const rawDate = r.payoutDate ? new Date(r.payoutDate) : scheduledDate;
                        const dayKey = rawDate.toISOString().split('T')[0];
                        const effectivePayoutDate = (returnDateCounts.get(dayKey) || 0) > 1 ? scheduledDate : rawDate;
                        return {
                            id: r.id,
                            periodIndex: r.periodIndex,
                            periodNumber: r.periodIndex,
                            amount: amtStr,
                            returnAmount: amtStr,
                            expectedAmount: monthlyYieldDec.toFixed(2),
                            currency: r.currency,
                            scheduledPayoutDate: scheduledDate,
                            payoutDate: effectivePayoutDate,
                            paidAt: effectivePayoutDate,
                            ledgerJournalId: r.ledgerJournalId || null,
                            transactionReference: r.ledgerJournalId || `RETURN-${pkg.packageCode}-PERIOD-${r.periodIndex}`,
                            status: r.status,
                        };
                    }),
                    createdAt: pkg.createdAt,
                };
            }),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
    /**
     * Repairs any existing PackageReturn records in the database that were batch-created
     * with identical payoutDate values or prematurely marked MATURED before their lockInEnd date.
     */
    async repairDuplicateReturnDates() {
        const now = new Date();
        const allPackages = await prisma_1.prisma.investmentPackage.findMany({
            include: { returns: { orderBy: { periodIndex: 'asc' } } },
        });
        let repairedCount = 0;
        for (const pkg of allPackages) {
            const startBase = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt;
            const computedEnd = getCycleDueDate(startBase, pkg.lockInMonths || 6);
            const effectiveEnd = pkg.lockInEnd ? new Date(pkg.lockInEnd) : computedEnd;
            const isStillLockedByDate = effectiveEnd.getTime() > now.getTime();
            // 1. If an FD is still within its lock-in period (lockInEnd > now) but was prematurely marked MATURED, restore to ACTIVE
            if (isStillLockedByDate && pkg.status === 'MATURED') {
                await prisma_1.prisma.investmentPackage
                    .update({
                    where: { id: pkg.id },
                    data: { status: 'ACTIVE' },
                })
                    .catch(() => { });
                repairedCount++;
            }
            if (!pkg.returns || pkg.returns.length <= 1)
                continue;
            const dateCounts = new Map();
            for (const r of pkg.returns) {
                const dayKey = new Date(r.payoutDate).toISOString().split('T')[0];
                dateCounts.set(dayKey, (dateCounts.get(dayKey) || 0) + 1);
            }
            const hasDuplicateDates = Array.from(dateCounts.values()).some((cnt) => cnt > 1);
            if (!hasDuplicateDates)
                continue;
            if (isStillLockedByDate) {
                // 2. For an active/unmatured FD whose future periods were batch-created on the same day (e.g. 11/14/2026),
                // remove the unearned future periods (periodIndex >= 2 whose scheduled cycle date > now)
                const p1 = pkg.returns.find((r) => r.periodIndex === 1);
                const anchor = p1?.payoutDate ? new Date(p1.payoutDate) : new Date(startBase);
                for (const r of pkg.returns) {
                    if (r.periodIndex === 1)
                        continue;
                    const periodDueDate = getCycleDueDate(anchor, r.periodIndex - 1);
                    if (periodDueDate.getTime() > now.getTime()) {
                        await prisma_1.prisma.packageReturn
                            .delete({ where: { id: r.id } })
                            .catch(() => { });
                        repairedCount++;
                    }
                    else {
                        await prisma_1.prisma.packageReturn
                            .update({
                            where: { id: r.id },
                            data: { payoutDate: periodDueDate },
                        })
                            .catch(() => { });
                        repairedCount++;
                    }
                }
            }
            else {
                // 3. For a genuinely matured FD (lockInEnd <= now) with duplicate batch dates, assign each period's distinct monthly date
                for (const r of pkg.returns) {
                    const scheduledDate = getCycleDueDate(startBase, r.periodIndex);
                    await prisma_1.prisma.packageReturn
                        .update({
                        where: { id: r.id },
                        data: { payoutDate: scheduledDate },
                    })
                        .catch(() => { });
                    repairedCount++;
                }
            }
        }
        return repairedCount;
    }
}
exports.PackageService = PackageService;
exports.packageService = new PackageService();
