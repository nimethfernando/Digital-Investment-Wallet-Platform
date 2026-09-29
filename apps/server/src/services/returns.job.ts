import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import cron from 'node-cron';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';

const prisma = new PrismaClient();
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
}

export class ReturnsJobService {
  /**
   * Main returns distribution execution
   */
  async executeMonthlyReturns(options?: {
    manualRun?: boolean;
    adminUserId?: string;
    adminReason?: string;
  }): Promise<ReturnsRunResult> {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
        const idempotencyKey = `RETURN-${pkg.packageCode}-${currentYearMonth}`;

        // Return amount: package.amount * returnRateSnapshot
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
            `[ReturnsJob] Credited $${returnAmount.toFixed(2)} to ${pkg.user.email} for package ${pkg.packageCode}`
          );

          // Email notification to investor
          await notificationService.sendEmail({
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
          console.log(`[ReturnsJob] Package ${pkg.packageCode} has completed its 6-month lock-in period!`);
          // Note: principal withdrawal or release is handled when requested or matured
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
      adminReason: options?.adminReason,
    };

    console.log(
      `[ReturnsJob] Completed cycle: ${creditedCount} credited, ${skippedCount} skipped, ${errorCount} errors. Total: $${totalDistributed.toFixed(2)} USD.`
    );

    return summary;
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
