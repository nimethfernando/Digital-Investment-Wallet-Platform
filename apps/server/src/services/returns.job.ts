import Decimal from 'decimal.js';
import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface ReturnsRunResult {
  executionId: string;
  totalActivePackages: number;
  creditedCount: number;
  skippedCount: number;
  errorCount: number;
  totalDistributedUsd: string;
  errors: { packageCode: string; error: string }[];
  executedAt: string;
  manualRun: boolean;
  adminReason?: string;
  cycleMonth?: string;
}

export class ReturnsJobService {
  /**
   * Main returns distribution execution across all active packages
   */
  async executeMonthlyReturns(options?: {
    manualRun?: boolean;
    adminUserId?: string;
    adminReason?: string;
    cycleMonth?: string;
    forceNextPeriod?: boolean;
  }): Promise<ReturnsRunResult> {
    const now = new Date();
    const currentYearMonth =
      options?.cycleMonth ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const executionId = `RET-RUN-${currentYearMonth}-${Date.now()}`;

    console.log(`[ReturnsJob] Starting returns distribution cycle for ${currentYearMonth} (Exec ID: ${executionId})...`);

    // 1. Fetch all ACTIVE investment packages
    const activePackages = await prisma.investmentPackage.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        returns: true,
      },
    });

    let creditedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalDistributed = new Decimal(0);
    const errors: { packageCode: string; error: string }[] = [];

    for (const pkg of activePackages) {
      try {
        // Calculate next period index: number of existing credited returns + 1
        const periodIndex = pkg.returns.length + 1;

        // Construct unique idempotency key
        const idempotencyKey = options?.forceNextPeriod
          ? `RETURN-${pkg.packageCode}-PERIOD-${periodIndex}-${Date.now()}`
          : `RETURN-${pkg.packageCode}-${currentYearMonth}`;

        // Return amount: package.amount * returnRateSnapshot (e.g. $10,000 * 0.01 = $100.00)
        const amountDec = new Decimal(pkg.amount.toString());
        const rateDec = new Decimal(pkg.returnRateSnapshot.toString());
        const returnAmount = amountDec.times(rateDec);

        const result = await ledgerService.creditMonthlyReturn({
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
        } else {
          creditedCount++;
          totalDistributed = totalDistributed.plus(returnAmount);
          console.log(
            `[ReturnsJob] Credited $${returnAmount.toFixed(2)} to ${pkg.user.email} for package ${pkg.packageCode} (Period ${periodIndex})`
          );

          // Asynchronous email notification to investor (non-blocking)
          void notificationService.sendEmail({
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
      } catch (err: any) {
        console.error(`[ReturnsJob] Error processing package ${pkg.packageCode}:`, err);
        errorCount++;
        errors.push({ packageCode: pkg.packageCode, error: err.message });
      }
    }

    const summary: ReturnsRunResult = {
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

    console.log(
      `[ReturnsJob] Completed cycle: ${creditedCount} credited, ${skippedCount} skipped, ${errorCount} errors. Total: $${totalDistributed.toFixed(2)} USD.`
    );

    return summary;
  }

  /**
   * Settle entire package returns and release principal together (Full Lump-Sum / Maturity Settlement)
   */
  async processFullPackageSettlement(packageId: string, adminUserId: string = 'ADMIN_SETTLEMENT') {
    const pkg = await prisma.investmentPackage.findUnique({
      where: { id: packageId },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        returns: true,
      },
    });

    if (!pkg) throw new Error('Investment package not found');
    if (pkg.status !== 'ACTIVE' && pkg.status !== 'MATURED') {
      throw new Error(`Package status is ${pkg.status}, cannot process full settlement.`);
    }

    const amountDec = new Decimal(pkg.amount.toString());
    const rateDec = new Decimal(pkg.returnRateSnapshot.toString());
    const singleMonthlyReturn = amountDec.times(rateDec);

    // Total periods expected = lockInMonths (e.g. 6)
    const totalPeriodsExpected = pkg.lockInMonths || 6;
    const periodsAlreadyCredited = pkg.returns.length;
    const remainingPeriods = Math.max(0, totalPeriodsExpected - periodsAlreadyCredited);

    let totalReturnsCreditedInBatch = new Decimal(0);
    const creditedReturns: any[] = [];

    // Credit all remaining periods together
    for (let i = 1; i <= remainingPeriods; i++) {
      const periodIndex = periodsAlreadyCredited + i;
      const idempotencyKey = `RETURN-FULL-BATCH-${pkg.packageCode}-P${periodIndex}`;

      const res = await ledgerService.creditMonthlyReturn({
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
      await ledgerService.releaseMaturedPrincipal(pkg.id, adminUserId, true);
      principalReleased = true;
    }

    const totalPayoutProcessed = totalReturnsCreditedInBatch.plus(principalReleased ? amountDec : 0);

    // Asynchronous settlement notification to investor (non-blocking)
    void notificationService.sendEmail({
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
    cron.schedule('5 0 1 * *', async () => {
      console.log('[ReturnsJob Cron] Scheduled trigger initiated for 1st of month returns...');
      try {
        await this.executeMonthlyReturns({ manualRun: false });
      } catch (err) {
        console.error('[ReturnsJob Cron] Scheduled run encountered an error:', err);
      }
    });

    console.log('✅ Monthly Returns Cron Scheduler registered (00:05 on 1st of every month)');
  }
}

export const returnsJobService = new ReturnsJobService();
