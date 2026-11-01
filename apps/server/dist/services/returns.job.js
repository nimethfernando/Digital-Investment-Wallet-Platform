"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnsJobService = exports.ReturnsJobService = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class ReturnsJobService {
    /**
     * Main returns distribution execution across all active packages
     */
    async executeMonthlyReturns(options) {
        const now = new Date();
        const currentYearMonth = options?.cycleMonth ||
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const executionId = `RET-RUN-${currentYearMonth}-${Date.now()}`;
        console.log(`[ReturnsJob] Starting returns distribution cycle for ${currentYearMonth} (Exec ID: ${executionId})...`);
        // 1. Fetch all ACTIVE investment packages
        const activePackages = await prisma_1.prisma.investmentPackage.findMany({
            where: { status: 'ACTIVE' },
            include: {
                user: { select: { id: true, email: true, firstName: true } },
                returns: true,
            },
        });
        let creditedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let totalDistributed = new decimal_js_1.default(0);
        const errors = [];
        for (const pkg of activePackages) {
            try {
                // Calculate next period index: number of existing credited returns + 1
                const periodIndex = pkg.returns.length + 1;
                // Construct unique idempotency key
                const idempotencyKey = options?.forceNextPeriod
                    ? `RETURN-${pkg.packageCode}-PERIOD-${periodIndex}-${Date.now()}`
                    : `RETURN-${pkg.packageCode}-${currentYearMonth}`;
                // Return amount: package.amount * returnRateSnapshot (e.g. $10,000 * 0.01 = $100.00)
                const amountDec = new decimal_js_1.default(pkg.amount.toString());
                const rateDec = new decimal_js_1.default(pkg.returnRateSnapshot.toString());
                const returnAmount = amountDec.times(rateDec);
                const result = await ledger_service_1.ledgerService.creditMonthlyReturn({
                    packageId: pkg.id,
                    userId: pkg.userId,
                    returnAmount: returnAmount.toFixed(8),
                    currency: pkg.currency,
                    periodIndex,
                    idempotencyKey,
                });
                if (result.alreadyCredited) {
                    console.log(`[ReturnsJob] Package ${pkg.packageCode} already credited for ${currentYearMonth}, skipping.`);
                    skippedCount++;
                }
                else {
                    creditedCount++;
                    totalDistributed = totalDistributed.plus(returnAmount);
                    console.log(`[ReturnsJob] Credited $${returnAmount.toFixed(2)} to ${pkg.user.email} for package ${pkg.packageCode} (Period ${periodIndex})`);
                    // Asynchronous email notification to investor (non-blocking)
                    void notification_provider_1.notificationService.sendEmail({
                        to: pkg.user.email,
                        subject: `Monthly Return Credited - $${returnAmount.toFixed(2)} USD`,
                        html: `
              <h3>Monthly Investment Return Credited</h3>
              <p>Hello ${pkg.user.firstName || 'Investor'},</p>
              <p>Your monthly return of <strong>$${returnAmount.toFixed(2)} USD</strong> for package <strong>${pkg.packageCode}</strong> (Month ${periodIndex}) has been credited to your available platform wallet.</p>
              <p>You may hold, re-invest into an additional package, or request a withdrawal on the 1st of the month.</p>
            `,
                    }).catch((err) => {
                        console.error(`[ReturnsJob] Email dispatch error for ${pkg.user.email}:`, err.message);
                    });
                }
                // Check if package has reached maturity
                if (pkg.lockInEnd && now >= pkg.lockInEnd) {
                    console.log(`[ReturnsJob] Package ${pkg.packageCode} has completed its lock-in term!`);
                }
            }
            catch (err) {
                console.error(`[ReturnsJob] Error processing package ${pkg.packageCode}:`, err);
                errorCount++;
                errors.push({ packageCode: pkg.packageCode, error: err.message });
            }
        }
        const summary = {
            executionId,
            totalActivePackages: activePackages.length,
            creditedCount,
            skippedCount,
            errorCount,
            totalDistributedUsd: totalDistributed.toFixed(2),
            errors,
            executedAt: now.toISOString(),
            manualRun: !!options?.manualRun,
            adminReason: options?.adminReason || 'Admin monthly yield batch distribution',
            cycleMonth: currentYearMonth,
        };
        console.log(`[ReturnsJob] Completed cycle: ${creditedCount} credited, ${skippedCount} skipped, ${errorCount} errors. Total: $${totalDistributed.toFixed(2)} USD.`);
        return summary;
    }
    /**
     * Settle entire package returns and release principal together (Full Lump-Sum / Maturity Settlement)
     */
    async processFullPackageSettlement(packageId, adminUserId = 'ADMIN_SETTLEMENT') {
        const pkg = await prisma_1.prisma.investmentPackage.findUnique({
            where: { id: packageId },
            include: {
                user: { select: { id: true, email: true, firstName: true } },
                returns: true,
            },
        });
        if (!pkg)
            throw new Error('Investment package not found');
        if (pkg.status !== 'ACTIVE' && pkg.status !== 'MATURED') {
            throw new Error(`Package status is ${pkg.status}, cannot process full settlement.`);
        }
        const amountDec = new decimal_js_1.default(pkg.amount.toString());
        const rateDec = new decimal_js_1.default(pkg.returnRateSnapshot.toString());
        const singleMonthlyReturn = amountDec.times(rateDec);
        // Total periods expected = lockInMonths (e.g. 6)
        const totalPeriodsExpected = pkg.lockInMonths || 6;
        const periodsAlreadyCredited = pkg.returns.length;
        const remainingPeriods = Math.max(0, totalPeriodsExpected - periodsAlreadyCredited);
        let totalReturnsCreditedInBatch = new decimal_js_1.default(0);
        const creditedReturns = [];
        // Credit all remaining periods together
        for (let i = 1; i <= remainingPeriods; i++) {
            const periodIndex = periodsAlreadyCredited + i;
            const idempotencyKey = `RETURN-FULL-BATCH-${pkg.packageCode}-P${periodIndex}`;
            const res = await ledger_service_1.ledgerService.creditMonthlyReturn({
                packageId: pkg.id,
                userId: pkg.userId,
                returnAmount: singleMonthlyReturn.toFixed(8),
                currency: pkg.currency,
                periodIndex,
                idempotencyKey,
            });
            if (!res.alreadyCredited) {
                totalReturnsCreditedInBatch = totalReturnsCreditedInBatch.plus(singleMonthlyReturn);
                creditedReturns.push(res.pkgReturn);
            }
        }
        // Release the entire principal if still ACTIVE
        let principalReleased = false;
        if (pkg.status === 'ACTIVE') {
            await ledger_service_1.ledgerService.releaseMaturedPrincipal(pkg.id, adminUserId, true);
            principalReleased = true;
        }
        const totalPayoutProcessed = totalReturnsCreditedInBatch.plus(principalReleased ? amountDec : 0);
        // Asynchronous settlement notification to investor (non-blocking)
        void notification_provider_1.notificationService.sendEmail({
            to: pkg.user.email,
            subject: `Package ${pkg.packageCode} Full Settlement Complete - $${totalPayoutProcessed.toFixed(2)} USD`,
            html: `
        <h3>Full Package Settlement Executed</h3>
        <p>Hello ${pkg.user.firstName || 'Investor'},</p>
        <p>Your investment package <strong>${pkg.packageCode}</strong> has been fully settled and matured.</p>
        <ul>
          <li><strong>Principal Released:</strong> $${amountDec.toFixed(2)} USD</li>
          <li><strong>Batch Yield Periods Credited:</strong> ${remainingPeriods} periods ($${totalReturnsCreditedInBatch.toFixed(2)} USD)</li>
          <li><strong>Total Credited to Wallet:</strong> $${totalPayoutProcessed.toFixed(2)} USD</li>
        </ul>
        <p>All funds are now available in your platform wallet balance for withdrawal or re-allocation.</p>
      `,
        }).catch((err) => {
            console.error(`[ReturnsJob] Settlement email dispatch error for ${pkg.user.email}:`, err.message);
        });
        return {
            packageCode: pkg.packageCode,
            status: 'MATURED',
            principalAmount: amountDec.toFixed(2),
            principalReleased,
            periodsCreditedCount: remainingPeriods,
            totalReturnsCreditedInBatch: totalReturnsCreditedInBatch.toFixed(2),
            totalPayoutProcessed: totalPayoutProcessed.toFixed(2),
            investorEmail: pkg.user.email,
            settlementTime: new Date().toISOString(),
        };
    }
    /**
     * Initializes the scheduled cron runner
     * Runs at 00:05 UTC on the 1st of each month
     */
    startScheduler() {
        // Schedule: 5 minutes past midnight on the 1st day of every month
        // "5 0 1 * *"
        node_cron_1.default.schedule('5 0 1 * *', async () => {
            console.log('[ReturnsJob Cron] Scheduled trigger initiated for 1st of month returns...');
            try {
                await this.executeMonthlyReturns({ manualRun: false });
            }
            catch (err) {
                console.error('[ReturnsJob Cron] Scheduled run encountered an error:', err);
            }
        });
        console.log('✅ Monthly Returns Cron Scheduler registered (00:05 on 1st of every month)');
    }
}
exports.ReturnsJobService = ReturnsJobService;
exports.returnsJobService = new ReturnsJobService();
