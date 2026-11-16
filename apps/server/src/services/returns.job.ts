import Decimal from 'decimal.js';
import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { ledgerService } from './ledger.service';
import { notificationService } from '../adapters/notification/notification.provider';
import { computePackageYieldSchedule } from './package.service';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface ReturnsPackageDetail {
  packageCode: string;
  userEmail: string;
  status: 'CREDITED' | 'SKIPPED_NOT_DUE' | 'SKIPPED_ALREADY_CREDITED' | 'ERROR';
  periodsCredited: number;
  amountCredited: string;
  nextPeriodIndex: number | null;
  nextYieldDueDate: string | null;
  daysUntilNextYield: number | null;
  reason: string;
}

export interface ReturnsRunResult {
  executionId: string;
  totalActivePackages: number;
  duePackagesCount: number;
  creditedCount: number;
  periodsCreditedCount: number;
  skippedCount: number;
  notYetDueCount: number;
  alreadyCreditedCount: number;
  errorCount: number;
  totalDistributedUsd: string;
  errors: { packageCode: string; error: string }[];
  packageDetails: ReturnsPackageDetail[];
  executedAt: string;
  manualRun: boolean;
  adminReason?: string;
  cycleMonth?: string;
}

export class ReturnsJobService {
  /**
   * Main returns distribution execution across all active packages.
   * Date-based: evaluates each package's actual start/deployment date (`lockInStart || purchaseDate || createdAt`)
   * and credits ONLY monthly periods that have actually completed.
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

    console.log(`[ReturnsJob] Starting date-based returns evaluation for ${currentYearMonth} (Exec ID: ${executionId})...`);

    // 1. Fetch all ACTIVE investment packages
    const activePackages = await prisma.investmentPackage.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        returns: true,
      },
    });

    let duePackagesCount = 0;
    let creditedCount = 0;
    let periodsCreditedCount = 0;
    let skippedCount = 0;
    let notYetDueCount = 0;
    let alreadyCreditedCount = 0;
    let errorCount = 0;
    let totalDistributed = new Decimal(0);
    const errors: { packageCode: string; error: string }[] = [];
    const packageDetails: ReturnsPackageDetail[] = [];

    for (const pkg of activePackages) {
      try {
        const schedule = computePackageYieldSchedule(pkg, now);

        // Enforce strict date-based cycle completion: skip packages whose monthly cycle is not yet due
        if (!schedule.isYieldDue || schedule.duePeriodsCount <= 0) {
          skippedCount++;
          const dueDateStr = schedule.nextYieldDueDate
            ? schedule.nextYieldDueDate.toISOString().split('T')[0]
            : null;
          const remainingDays = Math.max(1, schedule.daysUntilNextYield || 1);

          if (
            schedule.returnsCount >= schedule.lockMonths ||
            (schedule.completedCycles > 0 && schedule.returnsCount >= schedule.completedCycles)
          ) {
            alreadyCreditedCount++;
            const reason = dueDateStr
              ? `Cycle ${schedule.returnsCount}/${schedule.lockMonths} already credited; Month ${schedule.nextPeriodIndex} due on ${dueDateStr} (${remainingDays}d remaining)`
              : 'All monthly cycles for this FD tenure have already been credited';
            console.log(`[ReturnsJob] Skipping ${pkg.packageCode}: ${reason}`);
            packageDetails.push({
              packageCode: pkg.packageCode,
              userEmail: pkg.user.email,
              status: 'SKIPPED_ALREADY_CREDITED',
              periodsCredited: 0,
              amountCredited: '0.00',
              nextPeriodIndex: schedule.nextPeriodIndex,
              nextYieldDueDate: schedule.nextYieldDueDate ? schedule.nextYieldDueDate.toISOString() : null,
              daysUntilNextYield: schedule.daysUntilNextYield,
              reason,
            });
          } else {
            notYetDueCount++;
            const reason = `Not yet due — Month ${schedule.nextPeriodIndex || 1}/${schedule.lockMonths} cycle completes on ${dueDateStr || 'N/A'} (${remainingDays}d remaining)`;
            console.log(`[ReturnsJob] Skipping ${pkg.packageCode}: ${reason}`);
            packageDetails.push({
              packageCode: pkg.packageCode,
              userEmail: pkg.user.email,
              status: 'SKIPPED_NOT_DUE',
              periodsCredited: 0,
              amountCredited: '0.00',
              nextPeriodIndex: schedule.nextPeriodIndex,
              nextYieldDueDate: schedule.nextYieldDueDate ? schedule.nextYieldDueDate.toISOString() : null,
              daysUntilNextYield: schedule.daysUntilNextYield,
              reason,
            });
          }
          continue;
        }

        // Package has one or more completed monthly cycles awaiting credit
        duePackagesCount++;
        const amountDec = new Decimal(pkg.amount.toString());
        const rateDec = new Decimal(pkg.returnRateSnapshot.toString());
        const singleMonthlyReturn = amountDec.times(rateDec);

        let pkgCreditedPeriods = 0;
        let pkgCreditedAmount = new Decimal(0);

        for (const periodIndex of schedule.duePeriodIndices) {
          const idempotencyKey = `RETURN-${pkg.packageCode}-PERIOD-${periodIndex}`;
          const result = await ledgerService.creditMonthlyReturn({
            packageId: pkg.id,
            userId: pkg.userId,
            returnAmount: singleMonthlyReturn.toFixed(8),
            currency: pkg.currency,
            periodIndex,
            idempotencyKey,
          });

          if (!result.alreadyCredited) {
            pkgCreditedPeriods++;
            periodsCreditedCount++;
            pkgCreditedAmount = pkgCreditedAmount.plus(singleMonthlyReturn);
            totalDistributed = totalDistributed.plus(singleMonthlyReturn);
            console.log(
              `[ReturnsJob] Credited $${singleMonthlyReturn.toFixed(2)} to ${pkg.user.email} for package ${pkg.packageCode} (Period ${periodIndex})`
            );
          }
        }

        if (pkgCreditedPeriods > 0) {
          creditedCount++;
          const postCreditReturnsCount = schedule.returnsCount + pkgCreditedPeriods;
          const postNextPeriod =
            postCreditReturnsCount < schedule.lockMonths ? postCreditReturnsCount + 1 : null;

          packageDetails.push({
            packageCode: pkg.packageCode,
            userEmail: pkg.user.email,
            status: 'CREDITED',
            periodsCredited: pkgCreditedPeriods,
            amountCredited: pkgCreditedAmount.toFixed(2),
            nextPeriodIndex: postNextPeriod,
            nextYieldDueDate: schedule.nextYieldDueDate ? schedule.nextYieldDueDate.toISOString() : null,
            daysUntilNextYield: schedule.daysUntilNextYield,
            reason: `Credited ${pkgCreditedPeriods} completed monthly cycle(s): ${schedule.duePeriodIndices.map((p) => `Month ${p}`).join(', ')}`,
          });

          // Asynchronous email notification to investor (non-blocking)
          void notificationService.sendEmail({
            to: pkg.user.email,
            subject: `Monthly Return Credited - $${pkgCreditedAmount.toFixed(2)} ${pkg.currency}`,
            html: `
              <h3>Monthly Investment Return Credited</h3>
              <p>Hello ${pkg.user.firstName || 'Investor'},</p>
              <p>Your monthly return of <strong>$${pkgCreditedAmount.toFixed(2)} ${pkg.currency}</strong> for package <strong>${pkg.packageCode}</strong> (${schedule.duePeriodIndices.map((p) => `Month ${p}`).join(', ')}) has been credited to your available platform wallet.</p>
              <p>You may hold, re-invest into an additional package, or request a withdrawal on the 1st of the month.</p>
            `,
          }).catch((err) => {
            console.error(`[ReturnsJob] Email dispatch error for ${pkg.user.email}:`, err.message);
          });
        } else {
          skippedCount++;
          alreadyCreditedCount++;
          packageDetails.push({
            packageCode: pkg.packageCode,
            userEmail: pkg.user.email,
            status: 'SKIPPED_ALREADY_CREDITED',
            periodsCredited: 0,
            amountCredited: '0.00',
            nextPeriodIndex: schedule.nextPeriodIndex,
            nextYieldDueDate: schedule.nextYieldDueDate ? schedule.nextYieldDueDate.toISOString() : null,
            daysUntilNextYield: schedule.daysUntilNextYield,
            reason: 'Completed cycle already recorded in ledger (idempotency protection)',
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
        packageDetails.push({
          packageCode: pkg.packageCode,
          userEmail: pkg.user?.email || 'unknown',
          status: 'ERROR',
          periodsCredited: 0,
          amountCredited: '0.00',
          nextPeriodIndex: null,
          nextYieldDueDate: null,
          daysUntilNextYield: null,
          reason: err.message || 'Processing error',
        });
      }
    }

    const summary: ReturnsRunResult = {
      executionId,
      totalActivePackages: activePackages.length,
      duePackagesCount,
      creditedCount,
      periodsCreditedCount,
      skippedCount,
      notYetDueCount,
      alreadyCreditedCount,
      errorCount,
      totalDistributedUsd: totalDistributed.toFixed(2),
      errors,
      packageDetails,
      executedAt: now.toISOString(),
      manualRun: !!options?.manualRun,
      adminReason: options?.adminReason || 'Admin date-based monthly yield distribution',
      cycleMonth: currentYearMonth,
    };

    console.log(
      `[ReturnsJob] Completed cycle: ${creditedCount} credited (${periodsCreditedCount} periods), ${skippedCount} skipped (${notYetDueCount} not yet due, ${alreadyCreditedCount} already credited), ${errorCount} errors. Total: $${totalDistributed.toFixed(2)} USD.`
    );

    return summary;
  }

  /**
   * Credits only due completed monthly yield period(s) for a single ACTIVE package.
   * Rejects cleanly with HTTP 400 if the current monthly cycle is not yet complete.
   */
  async creditSinglePackageDueYield(packageId: string, adminUserId: string = 'ADMIN_YIELD') {
    const now = new Date();
    const pkg = await prisma.investmentPackage.findUnique({
      where: { id: packageId },
      include: {
        user: { select: { id: true, email: true, firstName: true } },
        returns: true,
      },
    });

    if (!pkg) {
      const err: any = new Error('Investment package not found');
      err.status = 404;
      throw err;
    }

    if (pkg.status !== 'ACTIVE') {
      const err: any = new Error(`Package ${pkg.packageCode} is ${pkg.status}; only ACTIVE packages can receive monthly yield credits.`);
      err.status = 400;
      throw err;
    }

    const schedule = computePackageYieldSchedule(pkg, now);
    if (!schedule.isYieldDue || schedule.duePeriodsCount <= 0) {
      const dueDateStr = schedule.nextYieldDueDate
        ? schedule.nextYieldDueDate.toISOString().split('T')[0]
        : 'maturity';
      const remaining = Math.max(1, schedule.daysUntilNextYield || 0);
      const err: any = new Error(
        `Monthly yield is not yet due for ${pkg.packageCode}. Month ${schedule.nextPeriodIndex || 1}/${schedule.lockMonths} completes on ${dueDateStr} (${remaining} days remaining).`
      );
      err.status = 400;
      throw err;
    }

    const amountDec = new Decimal(pkg.amount.toString());
    const rateDec = new Decimal(pkg.returnRateSnapshot.toString());
    const singleMonthlyReturn = amountDec.times(rateDec);

    let periodsCreditedCount = 0;
    let totalCreditedDec = new Decimal(0);

    for (const periodIndex of schedule.duePeriodIndices) {
      const idempotencyKey = `RETURN-${pkg.packageCode}-PERIOD-${periodIndex}`;
      const res = await ledgerService.creditMonthlyReturn({
        packageId: pkg.id,
        userId: pkg.userId,
        returnAmount: singleMonthlyReturn.toFixed(8),
        currency: pkg.currency,
        periodIndex,
        idempotencyKey,
      });

      if (!res.alreadyCredited) {
        periodsCreditedCount++;
        totalCreditedDec = totalCreditedDec.plus(singleMonthlyReturn);
      }
    }

    if (periodsCreditedCount > 0) {
      void notificationService.sendEmail({
        to: pkg.user.email,
        subject: `Monthly Return Credited - $${totalCreditedDec.toFixed(2)} ${pkg.currency}`,
        html: `
          <h3>Monthly Investment Return Credited</h3>
          <p>Hello ${pkg.user.firstName || 'Investor'},</p>
          <p>Your monthly return of <strong>$${totalCreditedDec.toFixed(2)} ${pkg.currency}</strong> for package <strong>${pkg.packageCode}</strong> (${schedule.duePeriodIndices.map((p) => `Month ${p}`).join(', ')}) has been credited to your available wallet balance.</p>
          <p>Processed by Desk Operator (${adminUserId}).</p>
        `,
      }).catch((err) => {
        console.error(`[ReturnsJob] Single-yield email error for ${pkg.user.email}:`, err.message);
      });
    }

    const updatedPkg = await prisma.investmentPackage.findUnique({
      where: { id: pkg.id },
      include: { returns: true },
    });
    const postSchedule = updatedPkg ? computePackageYieldSchedule(updatedPkg, now) : schedule;

    return {
      packageCode: pkg.packageCode,
      periodsCreditedCount,
      totalCreditedUsd: totalCreditedDec.toFixed(2),
      nextPeriodIndex: postSchedule.nextPeriodIndex,
      nextYieldDueDate: postSchedule.nextYieldDueDate ? postSchedule.nextYieldDueDate.toISOString() : null,
      userEmail: pkg.user.email,
    };
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

    // Automated Content & News Tracker Cron (every 2 hours)
    cron.schedule('0 */2 * * *', async () => {
      try {
        const { autoContentService } = await import('./autoContent.service');
        await autoContentService.syncAllTrackedPosts();
      } catch (err) {
        console.error('[AutoContent Cron] News sync error:', err);
      }
    });
    console.log('✅ Automated Market News Sync Cron registered (every 2 hours)');

    // Non-destructive P2P schema & tables warm-up + automated timeout cron (every minute)
    import('./p2p.service').then(({ p2pService }) => p2pService.ensureP2PReady()).catch(() => {});
    cron.schedule('* * * * *', async () => {
      try {
        const { p2pService } = await import('./p2p.service');
        await p2pService.processOrderTimeouts();
      } catch (err) {
        console.error('[P2P Cron] Timeout check error:', err);
      }
    });
    console.log('✅ Automated P2P Timeout & Dispute Escalation Cron registered (every 1 minute)');
  }
}

export const returnsJobService = new ReturnsJobService();
