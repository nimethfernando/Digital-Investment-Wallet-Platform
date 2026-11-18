import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { PackageStatus, DepositStatus, WithdrawalStatus, Role, KycStatus, UserStatus, P2POrderStatus, P2POfferStatus, TransactionType, TransactionStatus, JournalReferenceType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { packageService, computePackageYieldSchedule } from '../services/package.service';
import { depositService } from '../services/deposit.service';
import { returnsJobService } from '../services/returns.job';
import { ledgerService } from '../services/ledger.service';
import { withdrawalService } from '../services/withdrawal.service';
import { kycService } from '../services/kyc.service';
import { generateAvoraAccountNumber, p2pService } from '../services/p2p.service';
import {
  releaseEscrowToBuyerTx,
  unlockEscrowToSellerTx,
  createP2PNotification,
  formatFiatWithCurrency,
} from '../services/p2p.helpers';
import { globalMoneyTransferService } from '../services/gmt.service';
import { otcService } from '../services/otc.service';
import { rateService } from '../services/rate.service';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class AdminController {
  /**
   * List all packages
   */
  async getPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await packageService.getAllPackages({
        status: status as PackageStatus | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({
        success: true,
        data: result.packages,
        packages: result.packages,
        meta: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve a pending package
   */
  async approvePackage(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const packageId = req.params.id as string;
      const { notes } = req.body;

      const updated = await packageService.adminApprovePackage(packageId, adminUserId, notes);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'APPROVE_PACKAGE',
          entity: 'InvestmentPackage',
          entityId: packageId,
          details: `Approved package ${updated.packageCode} for $${new Decimal(updated.amount.toString()).toFixed(2)} USD`,
        },
      });

      res.json({
        success: true,
        message: `Package ${updated.packageCode} has been approved and activated.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all deposit requests
   */
  async getDeposits(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await depositService.getAllDeposits({
        status: status as DepositStatus | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({
        success: true,
        data: result.deposits,
        deposits: result.deposits,
        meta: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve a deposit request
   */
  async approveDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const depositId = req.params.id as string;
      const { notes, txHash } = req.body;

      const result = await depositService.adminApproveDeposit(depositId, adminUserId, notes, txHash);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'APPROVE_DEPOSIT',
          entity: 'DepositRequest',
          entityId: depositId,
          details: `Approved deposit ${result.deposit.depositCode} for $${new Decimal(result.deposit.amount.toString()).toFixed(2)}`,
        },
      });

      res.json({
        success: true,
        message: `Deposit ${result.deposit.depositCode} successfully approved and credited.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reject a deposit request
   */
  async rejectDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const depositId = req.params.id as string;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      const rejected = await depositService.adminRejectDeposit(depositId, adminUserId, reason);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'REJECT_DEPOSIT',
          entity: 'DepositRequest',
          entityId: depositId,
          details: `Rejected deposit ${rejected.depositCode}. Reason: ${reason}`,
        },
      });

      res.json({
        success: true,
        message: `Deposit ${rejected.depositCode} has been rejected.`,
        data: rejected,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Manually trigger date-based monthly returns job (only processes packages whose monthly cycle is actually due)
   */
  async triggerMonthlyReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const { reason, cycleMonth } = req.body || {};
      const auditReason = reason || 'Admin date-based monthly yield batch evaluation (1% standard return)';

      const summary = await returnsJobService.executeMonthlyReturns({
        manualRun: true,
        adminUserId,
        adminReason: auditReason,
        cycleMonth,
      });

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'MANUAL_RETURNS_PAYOUT',
          entity: 'ReturnsEngine',
          entityId: summary.executionId,
          details: `Date-based yield run executed. Due Credited: ${summary.creditedCount} ($${summary.totalDistributedUsd}), Skipped Not Due: ${summary.notYetDueCount}, Already Credited: ${summary.alreadyCreditedCount}. Reason: ${auditReason}`,
        },
      });

      const message =
        summary.creditedCount > 0
          ? `Monthly yield run completed: ${summary.creditedCount} due package(s) credited ($${summary.totalDistributedUsd} USD). ${summary.notYetDueCount} package(s) skipped (current monthly cycle not yet completed).`
          : `No packages have monthly yield due today. ${summary.notYetDueCount} active package(s) are still within their current monthly cycle and ${summary.alreadyCreditedCount} completed cycle(s) were already credited.`;

      res.json({
        success: true,
        message,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Credit monthly yield for a single active package (only if due based on start/deployment date)
   */
  async creditSinglePackageYield(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const packageId = req.params.id as string;

      const result = await returnsJobService.creditSinglePackageDueYield(packageId, adminUserId);

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'SINGLE_PACKAGE_YIELD_CREDIT',
          entity: 'InvestmentPackage',
          entityId: packageId,
          details: `Credited ${result.periodsCreditedCount} due monthly yield period(s) for ${result.packageCode} ($${result.totalCreditedUsd} USD).`,
        },
      });

      res.json({
        success: true,
        message: `Credited $${result.totalCreditedUsd} USD (${result.periodsCreditedCount} due monthly period(s)) for ${result.packageCode}.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Settle entire package returns and release principal together (Full Lump-Sum / Maturity Settlement)
   */
  async settleFullPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const packageId = req.params.id as string;

      const result = await returnsJobService.processFullPackageSettlement(packageId, adminUserId);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'FULL_PACKAGE_SETTLEMENT',
          entity: 'InvestmentPackage',
          entityId: packageId,
          details: `Full package settlement processed for ${result.packageCode}. Remaining returns ($${result.totalReturnsCreditedInBatch}) + Principal ($${result.principalAmount}) released. Total: $${result.totalPayoutProcessed}.`,
        },
      });

      res.json({
        success: true,
        message: `Full settlement processed for ${result.packageCode}. Principal and all remaining returns credited ($${result.totalPayoutProcessed} USD total).`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Run ledger reconciliation and health verification
   */
  async getLedgerReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ledgerService.reconcileLedger();
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Build unified Platform Commission & Fee Revenue data across all modules + Vault claimable status
   */
  private async buildPlatformRevenueData(adminUserId?: string) {
    // Execute in compact bounded batches (<= 4 queries at once) to respect shared MySQL connection_limit=5
    const [reconcile, liveRates, otcAllTrades, p2pCompleted] = await Promise.all([
      ledgerService.reconcileLedger(),
      rateService.getLiveRates().catch(() => ({ rates: { USD: 1, USDT: 1 } as Record<string, number> })),
      prisma.otcTrade.findMany({
        where: { status: { in: ['COMPLETED', 'IN_PROGRESS', 'DISPUTED'] } },
        select: { status: true, platformFee: true, operatorFee: true },
      }),
      prisma.p2POrder.findMany({
        where: { status: P2POrderStatus.COMPLETED },
        select: { platformFeeAmount: true, cryptoCurrency: true },
      }),
    ]);

    const [invAgg, gmtTransfers, settledWithdrawals, approvedRazorpay] = await Promise.all([
      prisma.investmentCommitment.aggregate({
        _sum: { allocationFeeAmount: true, profitShareFeeAmount: true },
      }),
      prisma.globalTransfer.findMany({
        where: { status: { notIn: ['REJECTED', 'REFUNDED', 'CANCELLED'] } },
        select: { sendingAmount: true, transferFeeAmount: true, rateAdjustmentPct: true, sendingCurrency: true },
      }),
      prisma.withdrawalRequest.findMany({
        where: { status: WithdrawalStatus.SETTLED },
        select: { currency: true, payoutDetails: true },
      }),
      prisma.depositRequest.findMany({
        where: { status: DepositStatus.APPROVED, depositMethod: 'RAZORPAY' },
        select: { currency: true, adminNotes: true },
      }),
    ]);

    const [allCommissionTxs, exchangeOrdersCompleted, adminWallet] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          status: TransactionStatus.COMPLETED,
          OR: [
            {
              type: {
                in: [
                  TransactionType.FEE,
                  TransactionType.GLOBAL_TRANSFER_FEE,
                  TransactionType.INVESTMENT_FEE,
                  TransactionType.INVESTMENT_PROFIT_SHARE,
                ],
              },
            },
            { transactionCode: { startsWith: 'OTCF-' } },
            { transactionCode: { startsWith: 'OTCAF-' } },
            { transactionCode: { startsWith: 'TX-ADMREV-' } },
          ],
        },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.exchangeOrder.findMany({
        where: { status: 'COMPLETED' },
        select: { feeAmount: true, fromCurrency: true },
      }),
      adminUserId
        ? prisma.wallet
            .findUnique({
              where: { userId: adminUserId },
              include: { balances: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const vaultSummary = ledgerService.computeVaultSummaryFromAccounts(reconcile.accounts || [], liveRates);
    const feeTransactions = allCommissionTxs
      .filter((t) => !String(t.transactionCode || '').startsWith('TX-ADMREV-'))
      .slice(0, 40);
    const p2pPromoTransactions = allCommissionTxs.filter((t) =>
      String(t.transactionCode || '').startsWith('TX-P2PPROMO-')
    );
    const cardFeeTransactions = allCommissionTxs.filter((t) =>
      String(t.transactionCode || '').startsWith('TX-CARDF-')
    );
    const swapFeeTransactions = allCommissionTxs.filter((t) =>
      String(t.transactionCode || '').startsWith('TX-SWAPF-')
    );
    const claimTransactions = allCommissionTxs
      .filter((t) => String(t.transactionCode || '').startsWith('TX-ADMREV-'))
      .slice(0, 25);

    const toUsdDec = (amt: Decimal, currency: string) => {
      const cur = (currency || 'USD').toUpperCase();
      if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return amt;
      const unitsPerUsd = Number(liveRates.rates?.[cur] || 0);
      if (unitsPerUsd > 0) return amt.div(new Decimal(unitsPerUsd));
      return amt;
    };

    const otcCompleted = otcAllTrades.filter((t) => t.status === 'COMPLETED');
    const otcActive = otcAllTrades.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'DISPUTED');
    const otcPlatformUsdt = otcCompleted.reduce(
      (s, t) => s.plus(new Decimal(t.platformFee?.toString() || '0')),
      new Decimal(0)
    );
    const otcBrokerUsdt = otcCompleted.reduce(
      (s, t) => s.plus(new Decimal(t.operatorFee?.toString() || '0')),
      new Decimal(0)
    );
    const otcPendingPlatformUsdt = otcActive.reduce(
      (s, t) => s.plus(new Decimal(t.platformFee?.toString() || '0')),
      new Decimal(0)
    );
    const otcPendingBrokerUsdt = otcActive.reduce(
      (s, t) => s.plus(new Decimal(t.operatorFee?.toString() || '0')),
      new Decimal(0)
    );

    const p2pFeesByCurrency: Record<string, Decimal> = {};
    let p2pTotalCrypto = new Decimal(0);
    let p2pFeeUsdEq = new Decimal(0);
    for (const o of p2pCompleted) {
      const fee = new Decimal(o.platformFeeAmount?.toString() || '0');
      const cur = (o.cryptoCurrency || 'USDT').toUpperCase();
      if (fee.greaterThan(0)) {
        p2pFeesByCurrency[cur] = (p2pFeesByCurrency[cur] || new Decimal(0)).plus(fee);
        p2pTotalCrypto = p2pTotalCrypto.plus(fee);
        p2pFeeUsdEq = p2pFeeUsdEq.plus(toUsdDec(fee, cur));
      }
    }

    const ventureAllocationUsd = new Decimal(invAgg._sum.allocationFeeAmount?.toString() || '0');
    const ventureProfitShareUsd = new Decimal(invAgg._sum.profitShareFeeAmount?.toString() || '0');

    let gmtFeeTotal = new Decimal(0);
    let gmtFxMarginEst = new Decimal(0);
    for (const g of gmtTransfers) {
      const sendAmt = new Decimal(g.sendingAmount?.toString() || '0');
      const feeAmt = new Decimal(g.transferFeeAmount?.toString() || '0');
      const marginPct = new Decimal(g.rateAdjustmentPct?.toString() || '0');
      gmtFeeTotal = gmtFeeTotal.plus(feeAmt);
      gmtFxMarginEst = gmtFxMarginEst.plus(sendAmt.times(marginPct.div(100)));
    }

    let withdrawalFeeTotal = new Decimal(0);
    let withdrawalFeeUsdEq = new Decimal(0);
    for (const w of settledWithdrawals) {
      try {
        const parsed = w.payoutDetails ? JSON.parse(w.payoutDetails) : {};
        const wf = new Decimal(String(parsed?.withdrawalFeeAmount || '0'));
        if (wf.isFinite() && wf.greaterThan(0)) {
          withdrawalFeeTotal = withdrawalFeeTotal.plus(wf);
          withdrawalFeeUsdEq = withdrawalFeeUsdEq.plus(toUsdDec(wf, w.currency || 'USD'));
        }
      } catch {
        // ignore malformed legacy json
      }
    }

    let razorpayMarginTotal = new Decimal(0);
    for (const d of approvedRazorpay) {
      const match = (d.adminNotes || '').match(/Avora Margin:\s*\$?([\d,]+(?:\.\d+)?)/i);
      if (match) {
        const m = new Decimal(match[1].replace(/,/g, ''));
        if (m.isFinite() && m.greaterThan(0)) razorpayMarginTotal = razorpayMarginTotal.plus(m);
      }
    }

    let cardIssuanceFeeTotal = new Decimal(0);
    for (const tx of cardFeeTransactions) {
      cardIssuanceFeeTotal = cardIssuanceFeeTotal.plus(toUsdDec(new Decimal(tx.amount.toString()), tx.currency));
    }

    let p2pPromotionFeeTotal = new Decimal(0);
    const p2pPromotionFeesByCurrency: Record<string, Decimal> = {};
    for (const tx of p2pPromoTransactions) {
      const amt = new Decimal(tx.amount?.toString() || '0');
      const cur = (tx.currency || 'USD').toUpperCase();
      if (amt.greaterThan(0)) {
        p2pPromotionFeeTotal = p2pPromotionFeeTotal.plus(toUsdDec(amt, cur));
        p2pPromotionFeesByCurrency[cur] = (p2pPromotionFeesByCurrency[cur] || new Decimal(0)).plus(amt);
      }
    }

    let swapSpreadFeeTotalUsd = new Decimal(0);
    const swapSpreadByCurrency: Record<string, Decimal> = {};
    for (const tx of swapFeeTransactions) {
      const amt = new Decimal(tx.amount?.toString() || '0');
      const cur = (tx.currency || 'USD').toUpperCase();
      if (amt.greaterThan(0)) {
        swapSpreadFeeTotalUsd = swapSpreadFeeTotalUsd.plus(toUsdDec(amt, cur));
        swapSpreadByCurrency[cur] = (swapSpreadByCurrency[cur] || new Decimal(0)).plus(amt);
      }
    }
    for (const ex of exchangeOrdersCompleted) {
      const amt = new Decimal(ex.feeAmount?.toString() || '0');
      const cur = (ex.fromCurrency || 'USD').toUpperCase();
      if (amt.greaterThan(0)) {
        swapSpreadFeeTotalUsd = swapSpreadFeeTotalUsd.plus(toUsdDec(amt, cur));
        swapSpreadByCurrency[cur] = (swapSpreadByCurrency[cur] || new Decimal(0)).plus(amt);
      }
    }

    const grandTotalModuleEarningsUsd = otcPlatformUsdt
      .plus(p2pFeeUsdEq)
      .plus(p2pPromotionFeeTotal)
      .plus(ventureAllocationUsd)
      .plus(ventureProfitShareUsd)
      .plus(gmtFeeTotal)
      .plus(withdrawalFeeUsdEq)
      .plus(razorpayMarginTotal)
      .plus(cardIssuanceFeeTotal)
      .plus(swapSpreadFeeTotalUsd);

    const ledgerRevenueAccounts = (reconcile.accounts || []).filter((a: any) =>
      String(a.accountId || '').startsWith('PLATFORM_FEE_REVENUE')
    );

    const adminWalletBalances = (adminWallet?.balances || []).map((b: any) => ({
      currency: b.currency,
      availableBalance: new Decimal(b.availableBalance?.toString() || '0').toFixed(4),
    }));

    return {
      ledgerStatus: reconcile.status,
      ledgerIsBalanced: reconcile.isBalanced,
      ledgerRevenueAccounts,
      vaultSummary: {
        ...vaultSummary,
        grandTotalModuleEarningsUsd: grandTotalModuleEarningsUsd.toFixed(2),
      },
      adminWalletBalances,
      moduleBreakdown: {
        grandTotalEarningsUsd: grandTotalModuleEarningsUsd.toFixed(2),
        otcPlatformFeeUsdt: otcPlatformUsdt.toFixed(2),
        otcBrokerCommissionUsdt: otcBrokerUsdt.toFixed(2),
        otcPendingPlatformFeeUsdt: otcPendingPlatformUsdt.toFixed(2),
        otcPendingBrokerCommissionUsdt: otcPendingBrokerUsdt.toFixed(2),
        p2pFeeTotal: p2pTotalCrypto.toFixed(4),
        p2pFeeUsdEq: p2pFeeUsdEq.toFixed(2),
        p2pFeesByCurrency: Object.fromEntries(
          Object.entries(p2pFeesByCurrency).map(([k, v]) => [k, v.toFixed(4)])
        ),
        p2pPromotionFeeTotal: p2pPromotionFeeTotal.toFixed(2),
        p2pPromotionFeesByCurrency: Object.fromEntries(
          Object.entries(p2pPromotionFeesByCurrency).map(([k, v]) => [k, v.toFixed(2)])
        ),
        p2pPromotionCount: p2pPromoTransactions.length,
        swapSpreadFeeTotalUsd: swapSpreadFeeTotalUsd.toFixed(2),
        swapSpreadByCurrency: Object.fromEntries(
          Object.entries(swapSpreadByCurrency).map(([k, v]) => [k, v.toFixed(4)])
        ),
        swapFeeCount: swapFeeTransactions.length + exchangeOrdersCompleted.length,
        ventureAllocationFeeUsd: ventureAllocationUsd.toFixed(2),
        ventureProfitShareFeeUsd: ventureProfitShareUsd.toFixed(2),
        gmtTransferFeeUsd: gmtFeeTotal.toFixed(2),
        gmtFxMarginEstUsd: gmtFxMarginEst.toFixed(2),
        withdrawalFeeTotal: withdrawalFeeTotal.toFixed(2),
        razorpayMarginTotal: razorpayMarginTotal.toFixed(2),
        cardIssuanceFeeTotal: cardIssuanceFeeTotal.toFixed(2),
      },
      recentFeeTransactions: feeTransactions.map((t) => ({
        id: t.id,
        transactionCode: t.transactionCode,
        type: t.type,
        amount: new Decimal(t.amount.toString()).toFixed(4),
        currency: t.currency,
        settlementReference: t.settlementReference,
        notes: t.notes,
        userEmail: t.user?.email || 'N/A',
        createdAt: t.createdAt,
      })),
      recentClaimTransactions: claimTransactions.map((t) => ({
        id: t.id,
        transactionCode: t.transactionCode,
        amount: new Decimal(t.amount.toString()).toFixed(4),
        currency: t.currency,
        settlementReference: t.settlementReference,
        notes: t.notes,
        recipientEmail: t.user?.email || 'N/A',
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Real-time Platform Commission & Fee Revenue Analytics across all modules
   */
  async getPlatformRevenueAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : undefined;
      const data = await this.buildPlatformRevenueData(adminUserId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Claim / sweep commission earnings from PLATFORM_FEE_REVENUE_* to Admin spendable Wallet
   */
  async claimPlatformRevenue(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : '';
      if (!adminUserId) {
        return res.status(401).json({ success: false, message: 'Admin authentication required.' });
      }
      const { currency, amount, targetUserId, reason } = req.body || {};
      const result = await ledgerService.claimPlatformRevenueToAdminWallet(adminUserId, {
        currency,
        amount,
        targetUserId,
        reason,
      });

      await createP2PNotification({
        userId: String(targetUserId || adminUserId),
        category: 'ACCOUNT',
        type: 'ADMIN_REVENUE_CLAIMED',
        severity: 'SUCCESS',
        title: `Platform Commission Earnings Credited (${result.claimCode})`,
        message: result.message,
        referenceCode: result.claimCode,
        actionUrl: '/dashboard',
        actionLabel: 'View Admin Wallet',
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * View immutable ledger journals
   */
  async getLedgerJournals(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const skip = (page - 1) * limit;

      const [journals, total] = await Promise.all([
        prisma.ledgerJournal.findMany({
          include: {
            entries: {
              include: { account: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.ledgerJournal.count(),
      ]);

      res.json({
        success: true,
        data: {
          journals: journals.map((j) => ({
            id: j.id,
            idempotencyKey: j.idempotencyKey,
            referenceType: j.referenceType,
            referenceId: j.referenceId,
            notes: j.notes,
            createdBy: j.createdBy,
            createdAt: j.createdAt,
            entries: j.entries.map((e) => ({
              id: e.id,
              accountId: e.accountId,
              accountName: e.account.accountName,
              direction: e.direction,
              amount: new Decimal(e.amount.toString()).toFixed(2),
              currency: e.currency,
              userId: e.userId,
            })),
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all withdrawal requests
   */
  async getWithdrawals(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search, page, limit } = req.query;
      const result = await withdrawalService.getAllWithdrawals({
        status: status as WithdrawalStatus | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      res.json({
        success: true,
        data: result.withdrawals,
        withdrawals: result.withdrawals,
        meta: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Settle a withdrawal request
   */
  async settleWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const withdrawalId = req.params.id as string;
      const { settlementReference, adminNotes } = req.body;

      if (!settlementReference) {
        return res.status(400).json({
          success: false,
          message: 'Settlement payout reference (e.g. TX hash, wire ref, or receipt code) is required',
        });
      }

      const settled = await withdrawalService.adminSettleWithdrawal(
        withdrawalId,
        adminUserId,
        settlementReference,
        adminNotes
      );

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'SETTLE_WITHDRAWAL',
          entity: 'WithdrawalRequest',
          entityId: withdrawalId,
          details: `Settled withdrawal ${settled.requestCode} ($${new Decimal(settled.amount.toString()).toFixed(2)}). Ref: ${settlementReference}`,
        },
      });

      res.json({
        success: true,
        message: `Withdrawal ${settled.requestCode} has been successfully settled and recorded in the double-entry ledger.`,
        data: settled,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reject a withdrawal request and refund to available balance
   */
  async rejectWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const withdrawalId = req.params.id as string;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Rejection reason is required' });
      }

      const rejected = await withdrawalService.adminRejectWithdrawal(withdrawalId, adminUserId, reason);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'REJECT_WITHDRAWAL',
          entity: 'WithdrawalRequest',
          entityId: withdrawalId,
          details: `Rejected withdrawal ${rejected.requestCode}. Reason: ${reason}`,
        },
      });

      res.json({
        success: true,
        message: `Withdrawal ${rejected.requestCode} has been rejected and funds refunded to user available balance.`,
        data: rejected,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List pending KYC submissions
   */
  async getPendingKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const documents = await kycService.getPendingKyc();
      res.json({ success: true, data: documents });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Approve KYC submission
   */
  async approveKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const documentId = req.params.id as string;

      const result = await kycService.approveKyc(documentId, adminUserId);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'APPROVE_KYC',
          entity: 'KycDocument',
          entityId: documentId,
          details: 'Approved investor identity verification document.',
        },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reject KYC submission
   */
  async rejectKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const documentId = req.params.id as string;
      const reason = req.body?.reason || req.body?.rejectionReason;

      const result = await kycService.rejectKyc(documentId, adminUserId, reason);

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'REJECT_KYC',
          entity: 'KycDocument',
          entityId: documentId,
          details: `Rejected KYC document. Reason: ${reason || 'Unspecified'}`,
        },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Purge demo/test data for pristine production launch
   */
  async purgeDemoData(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;

      // 1. Purge double-entry ledger entries, journals & user transactions so Total Journal Postings = $0.00
      await prisma.ledgerEntry.deleteMany({});
      await prisma.ledgerJournal.deleteMany({});
      await prisma.transaction.deleteMany({});

      // 2. Purge packages, returns, deposits, withdrawals, cards & KYC test submissions
      await prisma.packageReturn.deleteMany({});
      await prisma.investmentPackage.deleteMany({});
      await prisma.withdrawalRequest.deleteMany({});
      await prisma.depositRequest.deleteMany({});
      await prisma.exchangeOrder.deleteMany({});
      await prisma.virtualCard.deleteMany({});
      await prisma.kycDocument.deleteMany({});

      // 3. Purge P2P, OTC, Global Transfers, Startup Commitments, Token Early Access & Tickets
      await prisma.p2PMessage.deleteMany({});
      await prisma.p2POrder.deleteMany({});
      await prisma.otcMessage.deleteMany({});
      await prisma.otcTrade.deleteMany({});
      await prisma.otcQuote.deleteMany({});
      await prisma.globalTransfer.deleteMany({});
      await prisma.tokenEarlyAccess.deleteMany({});
      await prisma.investmentCommitment.deleteMany({});
      await prisma.investmentWatchlist.deleteMany({});
      await prisma.investmentInquiry.deleteMany({});
      await prisma.ticketReply.deleteMany({});
      await prisma.supportTicket.deleteMany({});
      await prisma.inquiry.deleteMany({});

      // 4. Reset all wallet balances to 0.00
      await prisma.walletBalance.updateMany({
        data: {
          availableBalance: '0.00000000',
          lockedPrincipal: '0.00000000',
          pendingSettlement: '0.00000000',
        },
      });

      // 5. Remove synthetic test/demo user accounts while preserving Admin & Corporate OTC desks
      await prisma.user.deleteMany({
        where: {
          id: { not: adminUserId },
          OR: [
            { email: 'investor@avorabank.com' },
            { email: { startsWith: 'e2e_' } },
            { email: { startsWith: 'fintech_tester_' } },
            { email: { startsWith: 'test_' } },
          ],
        },
      });

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'PURGE_DEMO_DATA',
          entity: 'SystemDatabase',
          entityId: 'ALL',
          details: 'Purged all ledger journals, demo packages, test returns, transactions, and test trades for clean $0.00 production state.',
        },
      });

      res.json({
        success: true,
        message: 'All demo data and ledger journal postings have been reset to $0.00. Platform is now in a clean production state.',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get current receiver deposit addresses and bank settings
   */
  async getReceiverAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await depositService.getReceiverSettings();
      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update receiver deposit addresses and bank settings
   */
  async updateReceiverAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const updated = await depositService.updateReceiverSettings(adminUserId, req.body);
      res.json({
        success: true,
        message: 'Receiver addresses and bank wire instructions successfully updated.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all startup crowdfunding investments and all startup listings across the platform
   */
  async getInvestments(req: Request, res: Response, next: NextFunction) {
    try {
      const [commitments, listings] = await Promise.all([
        prisma.investmentCommitment.findMany({
          include: {
            investor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            listing: {
              select: {
                id: true,
                slug: true,
                companyName: true,
                industry: true,
                stage: true,
                country: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.startupListing.findMany({
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      res.json({ success: true, data: { commitments, listings } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all token early access and whitelist registrations
   */
  async getTokenAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const { tokenService } = await import('../services/token.service');
      await tokenService.ensureTokenReady();
      const allocations = await prisma.tokenEarlyAccess.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: { allocations } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update investment package FD lock-in tenure, start date & maturity date
   */
  async updatePackageTenure(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const packageId = req.params.id as string;
      const { lockInMonths, newStartDate, newEndDate, returnRateSnapshot, adminNotes } = req.body;

      const pkg = await prisma.investmentPackage.findUnique({
        where: { id: packageId },
        include: { user: true },
      });

      if (!pkg) {
        return res.status(404).json({ success: false, message: 'Investment package not found' });
      }

      const updateData: any = {};
      let calculatedEndDate: Date | null = null;
      let effectiveStartDate = new Date(pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || new Date());

      if (newStartDate) {
        const parsedStart = new Date(newStartDate);
        if (isNaN(parsedStart.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid custom start date' });
        }
        effectiveStartDate = parsedStart;
        updateData.lockInStart = parsedStart;
        updateData.purchaseDate = parsedStart;

        const targetMonths =
          lockInMonths !== undefined && lockInMonths !== null && lockInMonths !== ''
            ? parseInt(lockInMonths, 10)
            : pkg.lockInMonths;
        if (!isNaN(targetMonths) && targetMonths >= 1 && targetMonths <= 60) {
          calculatedEndDate = new Date(effectiveStartDate);
          calculatedEndDate.setMonth(calculatedEndDate.getMonth() + targetMonths);
          updateData.lockInEnd = calculatedEndDate;
          updateData.withdrawalEligibilityDate = calculatedEndDate;
        }
      }

      if (lockInMonths !== undefined && lockInMonths !== null && lockInMonths !== '') {
        const months = parseInt(lockInMonths, 10);
        if (isNaN(months) || months < 1 || months > 60) {
          return res.status(400).json({ success: false, message: 'lockInMonths must be an integer between 1 and 60' });
        }
        updateData.lockInMonths = months;

        calculatedEndDate = new Date(effectiveStartDate);
        calculatedEndDate.setMonth(calculatedEndDate.getMonth() + months);
        updateData.lockInEnd = calculatedEndDate;
        updateData.withdrawalEligibilityDate = calculatedEndDate;
      }

      if (newEndDate) {
        const customDate = new Date(newEndDate);
        if (isNaN(customDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid custom end date' });
        }
        updateData.lockInEnd = customDate;
        updateData.withdrawalEligibilityDate = customDate;
      }

      if (returnRateSnapshot !== undefined && returnRateSnapshot !== null && returnRateSnapshot !== '') {
        updateData.returnRateSnapshot = new Decimal(returnRateSnapshot);
      }

      if (adminNotes) {
        updateData.adminNotes = pkg.adminNotes
          ? `${pkg.adminNotes}\n[${new Date().toISOString()}] ${adminNotes}`
          : adminNotes;
      }

      const updated = await prisma.investmentPackage.update({
        where: { id: packageId },
        data: updateData,
        include: { user: true, returns: true },
      });

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'UPDATE_PACKAGE_TENURE',
          entity: 'InvestmentPackage',
          entityId: packageId,
          details: `Updated package ${pkg.packageCode} tenure to ${updateData.lockInMonths || pkg.lockInMonths} months. Start: ${updated.lockInStart?.toISOString()}, Lock end: ${updated.lockInEnd?.toISOString()}. Notes: ${adminNotes || 'None'}`,
        },
      });

      res.json({
        success: true,
        message: `Package ${pkg.packageCode} FD dates/tenure updated (${updated.lockInMonths} months, Maturity: ${updated.lockInEnd ? new Date(updated.lockInEnd).toLocaleDateString() : 'Active'}).`,
        data: {
          ...updated,
          amount: new Decimal(updated.amount.toString()).toFixed(2),
          returnRateSnapshot: new Decimal(updated.returnRateSnapshot.toString()).toFixed(4),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update startup campaign valuation and mark-to-market performance
   */
  async updateStartupValuation(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const listingId = req.params.id as string;
      const { valuation, stage, growthNotes } = req.body;

      if (!valuation || isNaN(parseFloat(valuation))) {
        return res.status(400).json({ success: false, message: 'Valid valuation number is required' });
      }

      const listing = await prisma.startupListing.findUnique({
        where: { id: listingId },
        include: { investments: true },
      });

      if (!listing) {
        return res.status(404).json({ success: false, message: 'Startup listing not found' });
      }

      const oldValuation = new Decimal(listing.valuation.toString());
      const newValuation = new Decimal(valuation);
      const valuationMultiplier = newValuation.dividedBy(oldValuation);
      const gainPct = valuationMultiplier.minus(1).times(100);

      // Update Listing
      const updatedListing = await prisma.startupListing.update({
        where: { id: listingId },
        data: {
          valuation: newValuation,
          stage: stage || listing.stage,
          financialHighlights: growthNotes 
            ? `${listing.financialHighlights || ''}\n[${new Date().toISOString()}] ${growthNotes}`
            : listing.financialHighlights,
        },
      });

      // Update all investor commitments for this startup
      for (const commitment of listing.investments) {
        const netInvested = new Decimal(commitment.netInvestedAmount.toString());
        const updatedHoldingValue = netInvested.times(valuationMultiplier);
        const commitmentGainPct = updatedHoldingValue.minus(netInvested).dividedBy(netInvested).times(100);

        await prisma.investmentCommitment.update({
          where: { id: commitment.id },
          data: {
            currentValuation: updatedHoldingValue,
            unrealizedReturnPct: commitmentGainPct,
            notes: growthNotes 
              ? `${commitment.notes || ''}\n[${new Date().toISOString()}] Valuation updated to $${newValuation.toLocaleString()} (+${gainPct.toFixed(1)}%)`
              : commitment.notes,
          },
        });
      }

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'UPDATE_STARTUP_VALUATION',
          entity: 'StartupListing',
          entityId: listingId,
          details: `Updated ${listing.companyName} valuation from $${oldValuation.toLocaleString()} to $${newValuation.toLocaleString()} (${gainPct.greaterThanOrEqualTo(0) ? '+' : ''}${gainPct.toFixed(2)}%). Updated ${listing.investments.length} investor positions.`,
        },
      });

      res.json({
        success: true,
        message: `Successfully updated ${listing.companyName} valuation to $${newValuation.toLocaleString()} (${gainPct.greaterThanOrEqualTo(0) ? '+' : ''}${gainPct.toFixed(1)}%). Recalculated ${listing.investments.length} investor holdings.`,
        data: {
          listing: updatedListing,
          gainPct: gainPct.toFixed(2),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Distribute cash dividends or exit proceeds to startup investors
   */
  async distributeStartupExit(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const listingId = req.params.id as string;
      const { distributionType, exitMultiplier, notes } = req.body;
      const totalProceeds = req.body.totalProceeds ?? req.body.totalGrossProceeds;

      const listing = await prisma.startupListing.findUnique({
        where: { id: listingId },
        include: {
          investments: {
            where: { status: { in: ['CLEARED_FUNDS', 'ACTIVE', 'DOCUMENT_SIGNED'] } },
            include: { investor: true },
          },
        },
      });

      if (!listing) {
        return res.status(404).json({ success: false, message: 'Startup listing not found' });
      }

      if (listing.investments.length === 0) {
        return res.status(400).json({ success: false, message: 'No active investor commitments found for this listing' });
      }

      const totalRaised = listing.investments.reduce(
        (sum, inv) => sum.plus(new Decimal(inv.netInvestedAmount.toString())),
        new Decimal(0)
      );

      if (totalRaised.isZero()) {
        return res.status(400).json({ success: false, message: 'Total net invested capital is zero' });
      }

      // Calculate total payout pool
      let totalPool = new Decimal(0);
      if (totalProceeds && !isNaN(parseFloat(totalProceeds))) {
        totalPool = new Decimal(totalProceeds);
      } else if (exitMultiplier && !isNaN(parseFloat(exitMultiplier))) {
        totalPool = totalRaised.times(new Decimal(exitMultiplier));
      } else {
        return res.status(400).json({ success: false, message: 'Please provide either totalProceeds or exitMultiplier' });
      }

      const profitShareSetting = await prisma.cmsSetting.findUnique({
        where: { key: 'startup_profit_share_percent' },
      });
      const configuredProfitFeePct = new Decimal(profitShareSetting?.value || '5.00');

      const distributedRecords = [];
      let totalDistributedGross = new Decimal(0);
      let totalPlatformFees = new Decimal(0);
      let totalNetCredited = new Decimal(0);

      // Distribute pro-rata to each investor inside an atomic ledger transaction
      for (const inv of listing.investments) {
        const netInvested = new Decimal(inv.netInvestedAmount.toString());
        const investorShareFraction = netInvested.dividedBy(totalRaised);
        const grossInvestorProceeds = new Decimal(totalPool.times(investorShareFraction).toFixed(8));

        // Principal returned 100% fee-free
        const capitalReturn = Decimal.min(grossInvestorProceeds, netInvested);
        const eligibleProfit = Decimal.max(grossInvestorProceeds.minus(netInvested), new Decimal(0));

        // Admin-configurable profit-share fee strictly on net profit
        const profitFeePct = configuredProfitFeePct;
        const platformFeeAmount = new Decimal(eligibleProfit.times(profitFeePct.dividedBy(100)).toFixed(8));
        const netProfitGain = eligibleProfit.minus(platformFeeAmount);
        const netCashPayout = grossInvestorProceeds.minus(platformFeeAmount);

        const invWallet = await ledgerService.ensureWallet(inv.investorUserId);
        const txCode = `DIST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

        await prisma.$transaction(
          async (tx) => {
            const lockedUsd = await ledgerService.lockWalletBalance(tx, invWallet.id, 'USD');
            const balBefore = new Decimal(lockedUsd.availableBalance.toString());
            const balAfter = balBefore.plus(netCashPayout);

            // 1. Credit investor available balance in USD
            await tx.walletBalance.update({
              where: { id: lockedUsd.id },
              data: { availableBalance: balAfter.toFixed(8) },
            });

            // 2. Balanced double-entry ledger journal: Debit Treasury Proceeds -> Credit Investor + Platform Profit-Share Revenue
            const distEntries: any[] = [
              {
                accountId: 'PLATFORM_TREASURY_USD',
                direction: 'DEBIT',
                amount: grossInvestorProceeds.toFixed(8),
                currency: 'USD',
              },
              {
                accountId: 'USER_AVAILABLE_USD',
                userId: inv.investorUserId,
                direction: 'CREDIT',
                amount: netCashPayout.toFixed(8),
                currency: 'USD',
              },
            ];
            if (platformFeeAmount.greaterThan(0)) {
              distEntries.push({
                accountId: 'PLATFORM_FEE_REVENUE_USD',
                direction: 'CREDIT',
                amount: platformFeeAmount.toFixed(8),
                currency: 'USD',
              });
            }

            await ledgerService.recordJournal(tx, {
              idempotencyKey: txCode,
              referenceType: JournalReferenceType.INVESTMENT_DISTRIBUTION,
              referenceId: txCode,
              notes: `${listing.companyName} ${distributionType} distribution (Investor Net: $${netCashPayout.toFixed(2)}, ${profitFeePct.toFixed(1)}% Profit Share Fee: $${platformFeeAmount.toFixed(2)})`,
              createdBy: adminUserId,
              entries: distEntries,
            });

            // 3. Create Transaction Ledger entries for user (Payout + Profit-Share Fee)
            await tx.transaction.create({
              data: {
                userId: inv.investorUserId,
                transactionCode: txCode,
                type: TransactionType.INVESTMENT_DISTRIBUTION,
                amount: netCashPayout.toFixed(8),
                currency: 'USD',
                status: TransactionStatus.COMPLETED,
                balanceBefore: balBefore.toFixed(8),
                balanceAfter: balAfter.toFixed(8),
                settlementReference: txCode,
                createdBy: adminUserId,
                idempotencyKey: txCode,
                notes: `${distributionType === 'DIVIDEND' ? 'Startup Dividend Distribution' : 'Startup Exit Payout'}: ${listing.companyName} (Principal: $${capitalReturn.toFixed(2)}, Net Gain: $${netProfitGain.toFixed(2)})`,
              },
            });

            if (platformFeeAmount.greaterThan(0)) {
              await tx.transaction.create({
                data: {
                  userId: inv.investorUserId,
                  transactionCode: `TX-INVPS-${txCode.replace('DIST-', '')}`,
                  type: TransactionType.INVESTMENT_PROFIT_SHARE,
                  amount: platformFeeAmount.toFixed(8),
                  currency: 'USD',
                  status: TransactionStatus.COMPLETED,
                  balanceBefore: balAfter.toFixed(8),
                  balanceAfter: balAfter.toFixed(8),
                  settlementReference: txCode,
                  createdBy: adminUserId,
                  idempotencyKey: `${txCode}-PSFEE`,
                  notes: `${profitFeePct.toFixed(1)}% Profit-Share Fee on ${listing.companyName} realized profit ($${eligibleProfit.toFixed(2)})`,
                },
              });
            }

            // 4. Update InvestmentCommitment status and financials
            await tx.investmentCommitment.update({
              where: { id: inv.id },
              data: {
                realizedProceeds: { increment: grossInvestorProceeds.toFixed(8) },
                returnOfCapital: { increment: capitalReturn.toFixed(8) },
                eligibleNetProfit: { increment: eligibleProfit.toFixed(8) },
                profitShareFeeAmount: { increment: platformFeeAmount.toFixed(8) },
                netDistributedProfit: { increment: netProfitGain.toFixed(8) },
                status: distributionType === 'DIVIDEND' ? 'ACTIVE' : 'EXITED',
                settlementReference: txCode,
                notes: notes ? `${inv.notes || ''}\n[${new Date().toISOString()}] ${notes}` : inv.notes,
              },
            });
          },
          { timeout: 45000, maxWait: 15000 }
        );

        totalDistributedGross = totalDistributedGross.plus(grossInvestorProceeds);
        totalPlatformFees = totalPlatformFees.plus(platformFeeAmount);
        totalNetCredited = totalNetCredited.plus(netCashPayout);

        distributedRecords.push({
          investorEmail: inv.investor?.email,
          netInvested: netInvested.toFixed(2),
          grossPayout: grossInvestorProceeds.toFixed(2),
          platformFee: platformFeeAmount.toFixed(2),
          netCredited: netCashPayout.toFixed(2),
        });
      }

      // If full exit, mark listing as CLOSED
      if (distributionType !== 'DIVIDEND') {
        await prisma.startupListing.update({
          where: { id: listingId },
          data: { status: 'CLOSED' },
        });
      }

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'STARTUP_EXIT_DISTRIBUTION',
          entity: 'StartupListing',
          entityId: listingId,
          details: `Distributed ${distributionType} for ${listing.companyName}. Gross Pool: $${totalPool.toFixed(2)}, Net Credited: $${totalNetCredited.toFixed(2)}, ${configuredProfitFeePct.toFixed(1)}% Profit Share Fee: $${totalPlatformFees.toFixed(2)} across ${distributedRecords.length} investors.`,
        },
      });

      res.json({
        success: true,
        message: `Successfully distributed $${totalNetCredited.toFixed(2)} USD to ${distributedRecords.length} investors for ${listing.companyName}. ${configuredProfitFeePct.toFixed(1)}% platform fee: $${totalPlatformFees.toFixed(2)} USD.`,
        data: {
          listingName: listing.companyName,
          totalGrossDistributed: totalDistributedGross.toFixed(2),
          totalPlatformFees: totalPlatformFees.toFixed(2),
          totalNetCredited: totalNetCredited.toFixed(2),
          investorCount: distributedRecords.length,
          distributions: distributedRecords,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List registered users with search, role, and KYC filters
   */
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      await p2pService.ensureP2PReady();
      const { search, role, kycStatus, page, limit } = req.query;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (role && Object.values(Role).includes(role as any)) {
        where.role = role as Role;
      }
      const normalizedFilterKyc =
        kycStatus === 'VERIFIED'
          ? KycStatus.APPROVED
          : kycStatus === 'NOT_SUBMITTED'
          ? KycStatus.NOT_STARTED
          : kycStatus;
      if (normalizedFilterKyc && Object.values(KycStatus).includes(normalizedFilterKyc as any)) {
        where.kycStatus = normalizedFilterKyc as KycStatus;
      }
      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        where.OR = [
          { email: { contains: query } },
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { displayName: { contains: query } },
          { phone: { contains: query } },
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            wallet: {
              include: { balances: true },
            },
            _count: {
              select: {
                packages: true,
                investorCommitments: true,
                deposits: true,
                withdrawals: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.user.count({ where }),
      ]);

      const formatted = users.map((u) => {
        const usdBal = u.wallet?.balances.find((b) => b.currency === 'USD')?.availableBalance?.toString() || '0.00';
        const usdtBal = u.wallet?.balances.find((b) => b.currency === 'USDT')?.availableBalance?.toString() || '0.00';
        const isLocked = !!(u.withdrawalLockedUntil && new Date() < u.withdrawalLockedUntil);

        return {
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          displayName: u.displayName || null,
          phone: u.phone,
          country: u.country,
          role: u.role,
          kycStatus: u.kycStatus,
          twoFactorEnabled: u.twoFactorEnabled,
          accountNumber: generateAvoraAccountNumber(u.id),
          isWithdrawalLocked: isLocked,
          withdrawalLockedUntil: u.withdrawalLockedUntil,
          status: u.status,
          isP2pMerchant: Boolean(u.isP2pMerchant),
          p2pBlocked: Boolean(u.p2pBlocked),
          p2pBlockedReason: u.p2pBlockedReason || null,
          p2pBlockedAt: u.p2pBlockedAt || null,
          balances: {
            USD: parseFloat(usdBal).toFixed(2),
            USDT: parseFloat(usdtBal).toFixed(2),
          },
          walletBalances: u.wallet?.balances.map((b) => ({
            currency: b.currency,
            available: b.availableBalance.toString(),
            locked: b.lockedPrincipal.toString(),
          })) || [],
          counts: u._count,
          createdAt: u.createdAt,
        };
      });

      res.json({
        success: true,
        data: formatted,
        users: formatted,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single user detailed profile
   */
  async getUserDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          wallet: {
            include: { balances: true },
          },
          packages: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          kycDocuments: true,
          _count: {
            select: {
              packages: true,
              investorCommitments: true,
              deposits: true,
              withdrawals: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        data: {
          ...user,
          accountNumber: generateAvoraAccountNumber(user.id),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update user role, KYC status, or freeze withdrawals
   */
  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : undefined;
      const id = String(req.params.id);
      const { role, kycStatus, isWithdrawalLocked, notes } = req.body;

      const dataToUpdate: any = {};
      if (role && Object.values(Role).includes(role)) {
        dataToUpdate.role = role;
      }
      const normalizedUpdateKyc =
        kycStatus === 'VERIFIED'
          ? KycStatus.APPROVED
          : kycStatus === 'NOT_SUBMITTED'
          ? KycStatus.NOT_STARTED
          : kycStatus;
      if (normalizedUpdateKyc && Object.values(KycStatus).includes(normalizedUpdateKyc)) {
        dataToUpdate.kycStatus = normalizedUpdateKyc;
      }
      if (typeof isWithdrawalLocked === 'boolean') {
        dataToUpdate.withdrawalLockedUntil = isWithdrawalLocked ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: dataToUpdate,
      });

      if (adminUserId) {
        await prisma.adminAuditLog.create({
          data: {
            userId: adminUserId,
            action: 'ADMIN_USER_UPDATE',
            entity: 'User',
            entityId: id,
            details: `Updated user ${updated.email}: ${JSON.stringify(dataToUpdate)}. Notes: ${notes || 'None'}`,
          },
        });
      }

      res.json({
        success: true,
        message: `User ${updated.email} updated successfully`,
        data: {
          id: updated.id,
          role: updated.role,
          kycStatus: updated.kycStatus,
          isWithdrawalLocked: !!(updated.withdrawalLockedUntil && new Date() < updated.withdrawalLockedUntil),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Adjust user balance directly via double-entry ledger with full audit trail
   */
  async adjustUserBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { currency = 'USD', amount, type, reason } = req.body;

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid positive amount required' });
      }
      if (type !== 'CREDIT' && type !== 'DEBIT') {
        return res.status(400).json({ success: false, message: 'Adjustment type must be CREDIT or DEBIT' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Adjustment reason is required for institutional audit' });
      }

      const result = await ledgerService.processAdminBalanceAdjustment({
        userId: id,
        adminUserId,
        currency,
        amount: parseFloat(amount),
        type,
        reason: reason.trim(),
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_BALANCE_ADJUSTMENT',
          entity: 'Wallet',
          entityId: result.walletId,
          details: `Admin ${type} of ${amount} ${currency} to user ${id}. Reason: ${reason}`,
        },
      });

      res.json({
        success: true,
        message: `Successfully executed ${type} of ${amount} ${currency}. New balance: ${result.balanceAfter} ${currency}`,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Balance adjustment failed' });
    }
  }

  /**
   * Get platform fee & FD configuration settings
   */
  async getPlatformConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.cmsSetting.findMany({
        where: {
          group: { in: ['INVESTMENT', 'COMMISSION', 'WITHDRAWAL', 'REMITTANCE', 'OTC', 'P2P', 'CARDS'] },
        },
      });

      const configMap: Record<string, string> = {};
      settings.forEach((s) => {
        configMap[s.key] = s.value;
      });

      const defaults = {
        // Fixed Deposit (FD) Engine Defaults
        package_monthly_return_rate: configMap['package_monthly_return_rate'] || '0.0100', // 1.00%
        package_lock_in_months: configMap['package_lock_in_months'] || configMap['package_min_lockin_months'] || '6',
        package_min_amount: configMap['package_min_amount'] || '1000',
        package_max_amount: configMap['package_max_amount'] || '10000',
        package_early_exit_penalty_pct: configMap['package_early_exit_penalty_pct'] || '5.00',
        payout_day_of_month: configMap['payout_day_of_month'] || '1',
        withdrawal_processing_days: configMap['withdrawal_processing_days'] || '15',
        withdrawal_window_day: configMap['withdrawal_window_day'] || '1',

        // Platform Commissions, Fees & Bond Defaults
        razorpay_commission_percent: configMap['razorpay_commission_percent'] || '5.0',
        razorpay_gateway_fee_percent: configMap['razorpay_gateway_fee_percent'] || '3.0',
        razorpay_key_id: configMap['razorpay_key_id'] || process.env.RAZORPAY_KEY_ID || '',
        razorpay_webhook_secret: configMap['razorpay_webhook_secret'] || process.env.RAZORPAY_WEBHOOK_SECRET || '',
        remittance_fee_percent: configMap['remittance_fee_percent'] || '3.0',
        remittance_margin_percent: configMap['remittance_margin_percent'] || '2.0',
        show_remittance_spread_controls: configMap['show_remittance_spread_controls'] || 'false',
        remittance_corridors_count: configMap['remittance_corridors_count'] || '7',
        remittance_countries_count: configMap['remittance_countries_count'] || '110+',
        remittance_delivery_days: configMap['remittance_delivery_days'] || '2',
        startup_allocation_fee_percent: configMap['startup_allocation_fee_percent'] || '5.0',
        startup_profit_share_percent: configMap['startup_profit_share_percent'] || '5.0',
        startup_min_investment_usd: configMap['startup_min_investment_usd'] || '250',
        otc_spread_percent: configMap['otc_spread_percent'] || '1.0',
        otc_operator_fee_percent: configMap['otc_operator_fee_percent'] || '1.5',
        otc_platform_fee_percent: configMap['otc_platform_fee_percent'] || '0.5',
        otc_security_deposit_usd: configMap['otc_security_deposit_usd'] || '1000',
        withdrawal_fee_percent: configMap['withdrawal_fee_percent'] || '0.0',
        withdrawal_fx_spread_percent: configMap['withdrawal_fx_spread_percent'] || '0.0',
        p2p_fee_percent: configMap['p2p_fee_percent'] || '0.0',
        p2p_security_deposit_usd: configMap['p2p_security_deposit_usd'] || '50',
        p2p_daily_limit_usd: configMap['p2p_daily_limit_usd'] || '5000',
        virtual_card_issuance_fee: configMap['virtual_card_issuance_fee'] || '10.00',
        admin_exchange_rate_overrides: configMap['admin_exchange_rate_overrides'] || '{}',
      };

      res.json({
        success: true,
        data: defaults,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update platform fee & FD configuration settings
   */
  async updatePlatformConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : undefined;
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ success: false, message: 'Settings payload object required' });
      }

      const allowedKeys = new Set([
        'package_monthly_return_rate',
        'package_lock_in_months',
        'package_min_lockin_months',
        'package_min_amount',
        'package_max_amount',
        'package_early_exit_penalty_pct',
        'payout_day_of_month',
        'withdrawal_processing_days',
        'withdrawal_window_day',
        'withdrawal_fee_percent',
        'withdrawal_fx_spread_percent',
        'razorpay_commission_percent',
        'razorpay_gateway_fee_percent',
        'razorpay_key_id',
        'razorpay_webhook_secret',
        'remittance_fee_percent',
        'remittance_margin_percent',
        'show_remittance_spread_controls',
        'remittance_corridors_count',
        'remittance_countries_count',
        'remittance_delivery_days',
        'startup_allocation_fee_percent',
        'startup_profit_share_percent',
        'startup_min_investment_usd',
        'otc_spread_percent',
        'otc_operator_fee_percent',
        'otc_platform_fee_percent',
        'otc_security_deposit_usd',
        'p2p_fee_percent',
        'p2p_security_deposit_usd',
        'p2p_daily_limit_usd',
        'virtual_card_issuance_fee',
        'admin_exchange_rate_overrides',
      ]);

      const updatedKeys: string[] = [];

      for (const [key, value] of Object.entries(settings)) {
        if (!allowedKeys.has(key)) continue;
        if (value !== undefined && value !== null) {
          let group = 'COMMISSION';
          if (key.startsWith('package_') || key === 'payout_day_of_month') group = 'INVESTMENT';
          if (key.startsWith('withdrawal_')) group = 'WITHDRAWAL';
          if (key.startsWith('remittance_') || key === 'show_remittance_spread_controls') group = 'REMITTANCE';
          if (key.startsWith('otc_')) group = 'OTC';
          if (key.startsWith('p2p_')) group = 'P2P';

          await prisma.cmsSetting.upsert({
            where: { key },
            update: { value: String(value), group },
            create: {
              group,
              key,
              value: String(value),
              description: `Configured via Admin Portal for ${key}`,
            },
          });
          updatedKeys.push(key);

          if (key === 'package_lock_in_months') {
            await prisma.cmsSetting.upsert({
              where: { key: 'package_min_lockin_months' },
              update: { value: String(value), group: 'INVESTMENT' },
              create: {
                group: 'INVESTMENT',
                key: 'package_min_lockin_months',
                value: String(value),
                description: 'Synced FD lock-in duration in months',
              },
            });
          }
        }
      }

      rateService.invalidateOverridesCache();

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'PLATFORM_CONFIG_UPDATE',
          entity: 'CmsSetting',
          details: `Updated ${updatedKeys.length} settings: ${JSON.stringify(settings)}`,
        },
      });

      res.json({
        success: true,
        message: `Successfully updated ${updatedKeys.length} platform parameters`,
        updatedKeys,
      });
    } catch (err) {
      next(err);
    }
  }
  /**
   * Reset user password (admin bypass)
   */
  async resetUserPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { newPassword } = req.body;

      const passwordToSet = newPassword && newPassword.trim().length >= 6
        ? newPassword.trim()
        : 'AvoraPass_' + Math.random().toString(36).substring(2, 8) + '!';

      const passwordHash = await bcrypt.hash(passwordToSet, 12);
      const user = await prisma.user.update({
        where: { id },
        data: { passwordHash },
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_RESET_PASSWORD',
          entity: 'User',
          entityId: id,
          details: `Admin reset password for user ${user.email}`,
        },
      });

      res.json({
        success: true,
        message: `Password updated successfully for ${user.email}`,
        temporaryPassword: passwordToSet,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Disable user 2FA (admin lockout relief)
   */
  async disableUser2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);

      const user = await prisma.user.update({
        where: { id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_DISABLE_2FA',
          entity: 'User',
          entityId: id,
          details: `Admin cleared 2FA security for user ${user.email}`,
        },
      });

      res.json({
        success: true,
        message: `Two-factor authentication disabled for ${user.email}`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update user status (ACTIVE, SUSPENDED, LOCKED)
   */
  async updateUserStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { status } = req.body;

      if (!['ACTIVE', 'SUSPENDED', 'LOCKED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Must be ACTIVE, SUSPENDED, or LOCKED' });
      }

      const user = await prisma.user.update({
        where: { id },
        data: { status: status as UserStatus },
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_UPDATE_USER_STATUS',
          entity: 'User',
          entityId: id,
          details: `Admin set status of user ${user.email} to ${status}`,
        },
      });

      res.json({
        success: true,
        message: `Account status updated to ${status} for ${user.email}`,
        status: user.status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Block, suspend, or reinstate a user specifically for P2P trading without freezing whole account
   */
  async updateUserP2PStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { p2pBlocked, reason } = req.body || {};
      const blocked = Boolean(p2pBlocked);
      const cleanReason = reason ? String(reason).trim() : null;

      const user = await prisma.user.update({
        where: { id },
        data: {
          p2pBlocked: blocked,
          p2pBlockedReason: blocked ? cleanReason || 'Restricted by Compliance' : null,
          p2pBlockedAt: blocked ? new Date() : null,
        },
      });

      if (blocked) {
        await prisma.p2POffer.updateMany({
          where: { userId: id, status: P2POfferStatus.OPEN },
          data: { status: P2POfferStatus.PAUSED },
        });
      }

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: blocked ? 'ADMIN_P2P_USER_BLOCKED' : 'ADMIN_P2P_USER_UNBLOCKED',
          entity: 'User',
          entityId: id,
          details: `Admin ${blocked ? 'blocked' : 'unblocked'} P2P trading access for ${user.email}. Reason: ${cleanReason || 'N/A'}`,
        },
      });

      await createP2PNotification({
        userId: id,
        category: 'ACCOUNT',
        type: blocked ? 'P2P_ADMIN_BLOCKED' : 'P2P_ADMIN_UNBLOCKED',
        severity: blocked ? 'CRITICAL' : 'SUCCESS',
        title: blocked ? 'P2P Trading Access Restricted' : 'P2P Trading Access Restored',
        message: blocked
          ? `Your P2P trading access was restricted by Compliance${cleanReason ? `: ${cleanReason}` : '.'}`
          : 'Your P2P marketplace trading access has been restored by Compliance.',
      });

      res.json({
        success: true,
        message: `P2P trading ${blocked ? 'restricted' : 'restored'} for ${user.email}`,
        p2pBlocked: user.p2pBlocked,
        p2pBlockedReason: user.p2pBlockedReason,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List global remittance transfers
   */
  async getRemittanceTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, page, limit } = req.query;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 30;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status && typeof status === 'string' && status !== 'ALL') {
        where.status = status;
      }
      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        where.OR = [
          { transferCode: { contains: query } },
          { senderEmail: { contains: query } },
          { senderName: { contains: query } },
          { recipientName: { contains: query } },
          { recipientAccount: { contains: query } },
          { destinationCountry: { contains: query } },
        ];
      }

      const [transfers, total] = await Promise.all([
        prisma.globalTransfer.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.globalTransfer.count({ where }),
      ]);

      res.json({
        success: true,
        data: transfers,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update remittance transfer status & compliance notes
   */
  async updateRemittanceTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { status, complianceNotes, rejectionReason } = req.body;

      const existing = await prisma.globalTransfer.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Transfer not found' });
      }

      const updated = await globalMoneyTransferService.updateTransferStatusAdmin(
        id,
        status || existing.status,
        complianceNotes,
        { rejectionReason, adminUserId }
      );

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'REMITTANCE_TRANSFER_UPDATE',
          entity: 'GlobalTransfer',
          entityId: id,
          details: `Updated transfer ${updated.transferCode} status to ${updated.status}. Compliance: ${complianceNotes || 'N/A'}`,
        },
      });

      res.json({
        success: true,
        message: `Transfer ${updated.transferCode} status updated to ${updated.status}`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new startup crowdfunding campaign
   */
  async createStartupListing(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const {
        companyName,
        tagline,
        country = 'United States',
        countryCode = 'US',
        city = 'San Francisco',
        industry = 'Fintech',
        stage = 'SEED',
        instrument = 'SAFE',
        valuation,
        fundingTarget,
        minInvestment = 250,
        pitchOverview,
        deadline,
        logoUrl,
        coverImageUrl,
        pitchDeckUrl,
      } = req.body;

      if (!companyName || !tagline || !valuation || !fundingTarget || !pitchOverview) {
        return res.status(400).json({ success: false, message: 'Required fields: companyName, tagline, valuation, fundingTarget, pitchOverview' });
      }

      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
      const listing = await prisma.startupListing.create({
        data: {
          slug,
          companyName,
          tagline,
          country,
          countryCode,
          city,
          industry,
          stage,
          instrument,
          valuation: new Decimal(valuation.toString()),
          fundingTarget: new Decimal(fundingTarget.toString()),
          minInvestment: new Decimal(minInvestment.toString()),
          pitchOverview,
          deadline: deadline ? new Date(deadline) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          logoUrl: logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
          coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&auto=format&fit=crop&q=80',
          pitchDeckUrl,
          status: 'PUBLISHED',
          dueDiligenceStatus: 'VERIFIED',
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'CREATE_STARTUP_LISTING',
          entity: 'StartupListing',
          entityId: listing.id,
          details: `Created new startup listing: ${listing.companyName} (${valuation} valuation)`,
        },
      });

      res.json({
        success: true,
        message: `Startup listing ${listing.companyName} created successfully!`,
        data: listing,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing startup campaign
   */
  async updateStartupListing(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { status, valuation, dueDiligenceStatus, dueDiligenceSummary, pitchOverview, tagline } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (valuation) updateData.valuation = new Decimal(valuation.toString());
      if (dueDiligenceStatus) updateData.dueDiligenceStatus = dueDiligenceStatus;
      if (dueDiligenceSummary !== undefined) updateData.dueDiligenceSummary = dueDiligenceSummary;
      if (pitchOverview) updateData.pitchOverview = pitchOverview;
      if (tagline) updateData.tagline = tagline;

      const updated = await prisma.startupListing.update({
        where: { id },
        data: updateData,
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'UPDATE_STARTUP_LISTING',
          entity: 'StartupListing',
          entityId: id,
          details: `Updated startup listing ${updated.companyName}: ${JSON.stringify(updateData)}`,
        },
      });

      res.json({
        success: true,
        message: `Startup listing ${updated.companyName} updated successfully`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Suspend / delete startup campaign
   */
  async deleteStartupListing(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);

      const listing = await prisma.startupListing.update({
        where: { id },
        data: { status: 'SUSPENDED' },
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'SUSPEND_STARTUP_LISTING',
          entity: 'StartupListing',
          entityId: id,
          details: `Suspended startup listing ${listing.companyName}`,
        },
      });

      res.json({
        success: true,
        message: `Startup listing ${listing.companyName} suspended successfully`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List P2P orders with full chat transcripts, timestamps, payment proof, and currency context
   */
  async getP2PApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'ALL';
      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const apps = await p2pService.listOnboardingApplicationsForAdmin(status, search);
      res.json({ success: true, data: apps });
    } catch (err) {
      next(err);
    }
  }

  async reviewP2PApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const adminEmail = (req as any).user?.email ? String((req as any).user.email) : 'admin@avorabank.com';
      const id = String(req.params.id);
      const { decision, reviewNotes, approveKyc } = req.body || {};
      const result = await p2pService.reviewOnboardingApplication(id, adminUserId, adminEmail, {
        decision,
        reviewNotes,
        approveKyc,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getP2POrders(req: Request, res: Response, next: NextFunction) {
    try {
      await p2pService.ensureP2PReady();
      const { status, page, limit } = req.query;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (status && status !== 'ALL' && Object.values(P2POrderStatus).includes(status as any)) {
        where.status = status as P2POrderStatus;
      }

      const [orders, total] = await Promise.all([
        prisma.p2POrder.findMany({
          where,
          include: {
            buyer: { select: { id: true, email: true, firstName: true, lastName: true, p2pBlocked: true } },
            seller: { select: { id: true, email: true, firstName: true, lastName: true, p2pBlocked: true } },
            offer: true,
            messages: { orderBy: { createdAt: 'asc' } },
            reviews: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.p2POrder.count({ where }),
      ]);

      const enriched = orders.map((o) => ({
        ...o,
        cryptoCurrency: (o.cryptoCurrency || o.offer?.cryptoCurrency || 'USDT').toUpperCase(),
        fiatCurrency: (o.fiatCurrency || o.offer?.fiatCurrency || 'USD').toUpperCase(),
      }));

      res.json({
        success: true,
        data: enriched,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Freeze or Unfreeze a suspicious P2P Escrow Order
   */
  async freezeP2POrder(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { freeze, reason } = req.body || {};
      const shouldFreeze = Boolean(freeze);
      const cleanReason = reason ? String(reason).trim() : null;

      const order = await prisma.p2POrder.findUnique({ where: { id } });
      if (!order) {
        return res.status(404).json({ success: false, message: 'P2P Order not found' });
      }
      if ([P2POrderStatus.COMPLETED, P2POrderStatus.CANCELLED, P2POrderStatus.DECLINED, P2POrderStatus.EXPIRED].includes(order.status as any)) {
        return res.status(400).json({ success: false, message: `Cannot freeze a finalized order (${order.status})` });
      }

      const nextStatus = shouldFreeze
        ? P2POrderStatus.FROZEN
        : order.disputedAt
        ? P2POrderStatus.DISPUTED
        : order.paidAt
        ? P2POrderStatus.PAYMENT_SENT
        : P2POrderStatus.PENDING_PAYMENT;

      await prisma.$transaction(async (tx) => {
        await tx.p2POrder.update({
          where: { id },
          data: {
            isFrozen: shouldFreeze,
            frozenReason: shouldFreeze ? cleanReason || 'Frozen by Compliance review' : null,
            status: nextStatus,
          },
        });
        await tx.p2PMessage.create({
          data: {
            orderId: id,
            senderId: 'SYSTEM',
            message: shouldFreeze
              ? `[System] Order #${order.orderCode} FROZEN by Compliance (${cleanReason || 'Security inspection'}). Funds remain locked until admin releases or refunds.`
              : `[System] Compliance freeze lifted on Order #${order.orderCode}. Status resumed to ${nextStatus}.`,
          },
        });
      });

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: shouldFreeze ? 'ADMIN_FREEZE_P2P_ORDER' : 'ADMIN_UNFREEZE_P2P_ORDER',
          entity: 'P2POrder',
          entityId: id,
          details: `Admin ${shouldFreeze ? 'froze' : 'unfroze'} P2P order ${order.orderCode}. Reason: ${cleanReason || 'N/A'}`,
        },
      });

      await Promise.all([
        createP2PNotification({
          userId: order.buyerId,
          type: shouldFreeze ? 'P2P_ADMIN_FROZEN' : 'P2P_ADMIN_UNFROZEN',
          severity: shouldFreeze ? 'CRITICAL' : 'INFO',
          title: `Order #${order.orderCode} ${shouldFreeze ? 'Frozen by Admin' : 'Unfrozen'}`,
          message: shouldFreeze
            ? `Trade held for compliance review: ${cleanReason || 'Security verification required.'}`
            : 'Compliance hold lifted. Trade resumed.',
          referenceCode: order.orderCode,
          status: nextStatus,
        }),
        createP2PNotification({
          userId: order.sellerId,
          type: shouldFreeze ? 'P2P_ADMIN_FROZEN' : 'P2P_ADMIN_UNFROZEN',
          severity: shouldFreeze ? 'CRITICAL' : 'INFO',
          title: `Order #${order.orderCode} ${shouldFreeze ? 'Frozen by Admin' : 'Unfrozen'}`,
          message: shouldFreeze
            ? `Escrow held for compliance review: ${cleanReason || 'Security verification required.'}`
            : 'Compliance hold lifted. Trade resumed.',
          referenceCode: order.orderCode,
          status: nextStatus,
        }),
      ]);

      res.json({
        success: true,
        message: `Order ${order.orderCode} ${shouldFreeze ? 'frozen' : 'unfrozen'} successfully.`,
        isFrozen: shouldFreeze,
        status: nextStatus,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Resolve P2P Escrow Dispute (or manually cancel/settle active/frozen trade)
   */
  async resolveP2PDispute(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const id = String(req.params.id);
      const { resolution, reason } = req.body;

      if (!['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'].includes(resolution)) {
        return res.status(400).json({ success: false, message: 'Resolution must be RELEASE_TO_BUYER or REFUND_TO_SELLER' });
      }

      const order = await prisma.p2POrder.findUnique({
        where: { id },
        include: { buyer: true, seller: true, offer: true },
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'P2P Order not found' });
      }

      const finalizedStatuses: P2POrderStatus[] = [
        P2POrderStatus.COMPLETED,
        P2POrderStatus.CANCELLED,
        P2POrderStatus.DECLINED,
        P2POrderStatus.EXPIRED,
      ];
      if (finalizedStatuses.includes(order.status as P2POrderStatus)) {
        throw new Error(`Order ${order.orderCode} is already ${order.status} and cannot be resolved again.`);
      }

      const nextStatus = resolution === 'RELEASE_TO_BUYER' ? P2POrderStatus.COMPLETED : P2POrderStatus.CANCELLED;
      const cryptoAmountDec = new Decimal(order.cryptoAmount.toString());
      const cryptoCur = (order.cryptoCurrency || order.offer?.cryptoCurrency || 'USDT').toUpperCase();
      const sellerWallet = await ledgerService.ensureWallet(order.sellerId);
      const buyerWallet = await ledgerService.ensureWallet(order.buyerId);
      const now = new Date();

      let releasedSummary: { buyerNetCrypto: Decimal; platformFee: Decimal; feePctStr: string } | null = null;
      await prisma.$transaction(
        async (tx) => {
          const freshOrder = await tx.p2POrder.findUnique({ where: { id } });
          if (!freshOrder || finalizedStatuses.includes(freshOrder.status as P2POrderStatus)) {
            throw new Error(`Order ${order.orderCode} has already been finalized (${freshOrder?.status || 'NOT_FOUND'}).`);
          }

          if (resolution === 'RELEASE_TO_BUYER') {
            releasedSummary = await releaseEscrowToBuyerTx(tx, {
              order: { ...freshOrder, cryptoCurrency: cryptoCur },
              sellerWalletId: sellerWallet.id,
              buyerWalletId: buyerWallet.id,
              actorUserId: adminUserId,
              txCodePrefix: 'D',
              idempotencyPrefix: 'P2P-DISP-REL',
              notesPrefix: `P2P dispute resolved (${resolution})`,
            });
          } else {
            await unlockEscrowToSellerTx(tx, {
              sellerWalletId: sellerWallet.id,
              sellerId: order.sellerId,
              cryptoCurrency: cryptoCur,
              cryptoAmountDec,
              offerId: order.offerId,
              orderCode: order.orderCode,
              journalIdempotencyKey: `P2P-DISP-UNLOCK-${order.orderCode}`,
              actorUserId: adminUserId,
            });
          }

          await tx.p2POrder.update({
            where: { id },
            data: {
              status: nextStatus,
              isFrozen: false,
              frozenReason: null,
              disputeResolvedBy: adminUserId,
              cancelledBy: resolution === 'REFUND_TO_SELLER' ? adminUserId : undefined,
              cancelReason: resolution === 'REFUND_TO_SELLER' ? reason || 'Admin dispute refund' : undefined,
              completedAt: resolution === 'RELEASE_TO_BUYER' ? now : undefined,
              disputeReason: `[Admin ${resolution}]: ${reason ? String(reason).trim() : 'Manual compliance adjudication'}`,
            },
          });

          const feeSuffix =
            releasedSummary && releasedSummary.platformFee.greaterThan(0)
              ? ` (${releasedSummary.feePctStr}% platform fee: ${releasedSummary.platformFee.toFixed(4)} ${cryptoCur})`
              : '';
          const netReleasedStr = releasedSummary
            ? releasedSummary.buyerNetCrypto.toFixed(2)
            : cryptoAmountDec.toFixed(2);

          await tx.p2PMessage.create({
            data: {
              orderId: id,
              senderId: 'SYSTEM',
              message:
                resolution === 'RELEASE_TO_BUYER'
                  ? `[System] Dispute resolved by Avora Compliance (${resolution}). ${netReleasedStr} ${cryptoCur} released from escrow to the buyer's wallet${feeSuffix}. Note: ${reason || 'N/A'}`
                  : `[System] Dispute resolved by Avora Compliance (${resolution}). ${cryptoAmountDec.toFixed(2)} ${cryptoCur} unlocked back to the seller's available balance. Note: ${reason || 'N/A'}`,
            },
          });
        },
        { timeout: 45000, maxWait: 15000 }
      );

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'RESOLVE_P2P_DISPUTE',
          entity: 'P2POrder',
          entityId: id,
          details: `Admin resolved P2P dispute on order ${order.orderCode} via ${resolution}. Reason: ${reason || 'N/A'}`,
        },
      });

      await Promise.all([
        createP2PNotification({
          userId: order.buyerId,
          type: 'P2P_DISPUTE_RESOLVED',
          severity: resolution === 'RELEASE_TO_BUYER' ? 'SUCCESS' : 'CRITICAL',
          title: `Dispute Ruling on #${order.orderCode}: ${resolution === 'RELEASE_TO_BUYER' ? 'Released to Buyer' : 'Refunded to Seller'}`,
          message: reason || `Admin finalized order ${order.orderCode} via ${resolution}.`,
          referenceCode: order.orderCode,
          amount: cryptoAmountDec.toFixed(2),
          currency: cryptoCur,
          status: nextStatus,
        }),
        createP2PNotification({
          userId: order.sellerId,
          type: 'P2P_DISPUTE_RESOLVED',
          severity: resolution === 'REFUND_TO_SELLER' ? 'SUCCESS' : 'WARNING',
          title: `Dispute Ruling on #${order.orderCode}: ${resolution === 'RELEASE_TO_BUYER' ? 'Released to Buyer' : 'Refunded to Seller'}`,
          message: reason || `Admin finalized order ${order.orderCode} via ${resolution}.`,
          referenceCode: order.orderCode,
          amount: cryptoAmountDec.toFixed(2),
          currency: cryptoCur,
          status: nextStatus,
        }),
      ]);

      res.json({
        success: true,
        message: `Order ${order.orderCode} resolved with status ${nextStatus}`,
        resolution,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get immutable admin audit logs
   */
  async getAdminAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { action, entity, page, limit } = req.query;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (action && typeof action === 'string' && action !== 'ALL') where.action = action;
      if (entity && typeof entity === 'string' && entity !== 'ALL') where.entity = entity;

      const [logs, total] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where,
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.adminAuditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: logs,
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get platform system status, enabled languages & broadcast announcement
   */
  async getSystemStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.cmsSetting.findMany({
        where: { group: 'SYSTEM' },
      });
      const map: Record<string, string> = {};
      settings.forEach((s) => (map[s.key] = s.value));

      const rawLangs = map['system_enabled_languages'] || 'en,ka';
      const parsedLangs = rawLangs
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => ['en', 'ka', 'hi'].includes(s));
      if (!parsedLangs.includes('en')) parsedLangs.unshift('en');

      res.json({
        success: true,
        data: {
          maintenanceMode: map['system_maintenance_mode'] === 'true',
          maintenanceMessage: map['system_maintenance_message'] || 'Avora Bank systems are undergoing scheduled maintenance. Services will resume shortly.',
          announcementEnabled: map['system_announcement_enabled'] === 'true',
          announcementTitle: map['system_announcement_title'] || 'System Notice',
          announcementMessage: map['system_announcement_message'] || '',
          announcementType: map['system_announcement_type'] || 'info',
          registrationsEnabled: map['system_registrations_enabled'] !== 'false',
          enabledLanguages: Array.from(new Set(parsedLangs)),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update platform system status, enabled languages & broadcast announcement
   */
  async updateSystemStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const {
        maintenanceMode,
        maintenanceMessage,
        announcementEnabled,
        announcementTitle,
        announcementMessage,
        announcementType,
        registrationsEnabled,
        enabledLanguages,
      } = req.body;

      const pairs: Record<string, string> = {};
      if (maintenanceMode !== undefined) pairs['system_maintenance_mode'] = String(maintenanceMode);
      if (maintenanceMessage !== undefined) pairs['system_maintenance_message'] = String(maintenanceMessage);
      if (announcementEnabled !== undefined) pairs['system_announcement_enabled'] = String(announcementEnabled);
      if (announcementTitle !== undefined) pairs['system_announcement_title'] = String(announcementTitle);
      if (announcementMessage !== undefined) pairs['system_announcement_message'] = String(announcementMessage);
      if (announcementType !== undefined) pairs['system_announcement_type'] = String(announcementType);
      if (registrationsEnabled !== undefined) pairs['system_registrations_enabled'] = String(registrationsEnabled);
      if (enabledLanguages !== undefined) {
        const list = (Array.isArray(enabledLanguages)
          ? enabledLanguages
          : String(enabledLanguages).split(',')
        )
          .map((s) => String(s).trim().toLowerCase())
          .filter((s) => ['en', 'ka', 'hi'].includes(s));
        if (!list.includes('en')) list.unshift('en');
        pairs['system_enabled_languages'] = Array.from(new Set(list)).join(',');
      }

      for (const [key, value] of Object.entries(pairs)) {
        await prisma.cmsSetting.upsert({
          where: { key },
          update: { value },
          create: { group: 'SYSTEM', key, value, description: 'System control parameter' },
        });
      }

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'UPDATE_SYSTEM_STATUS',
          entity: 'CmsSetting',
          details: `Updated platform system parameters: ${JSON.stringify(pairs)}`,
        },
      });

      res.json({
        success: true,
        message: 'Platform system controls updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Formats elapsed age & SLA breach status relative to `now`.
   */
  private computeAgeInfo(dateInput: Date | string, now: Date, overdueThresholdHours: number) {
    const dt = new Date(dateInput);
    const ageMs = isNaN(dt.getTime()) ? 0 : Math.max(0, now.getTime() - dt.getTime());
    const ageMins = Math.floor(ageMs / (1000 * 60));
    const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

    let ageLabel = `${ageMins}m`;
    if (ageHours >= 24) {
      ageLabel = `${ageDays}d ${ageHours % 24}h`;
    } else if (ageMins >= 60) {
      ageLabel = `${ageHours}h ${ageMins % 60}m`;
    }

    return {
      ageMs,
      ageHours,
      ageDays,
      ageLabel,
      isOverdue: ageHours >= overdueThresholdHours,
    };
  }

  /**
   * Builds unified date-based alerts & actionable pending requests across all operational queues.
   */
  private async buildAdminCommandCenterData() {
    const now = new Date();
    await p2pService.ensureP2PReady().catch(() => {});
    const [activeAndPendingPackages, pendingDepositsList, pendingWithdrawalsList, pendingKycList] = await Promise.all([
      prisma.investmentPackage.findMany({
        where: { status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'WITHDRAWAL_REQUESTED'] } },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          returns: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.depositRequest.findMany({
        where: { status: DepositStatus.PENDING },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.withdrawalRequest.findMany({
        where: {
          status: {
            in: [WithdrawalStatus.REQUESTED, WithdrawalStatus.UNDER_REVIEW, WithdrawalStatus.APPROVED],
          },
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          package: { select: { packageCode: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.kycDocument.findMany({
        where: { status: KycStatus.PENDING },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const [pendingTransfersList, openTicketsList, disputedP2PList, pendingInquiriesList] = await Promise.all([
      prisma.globalTransfer.findMany({
        where: { status: { in: ['SUBMITTED', 'COMPLIANCE_SCREENED', 'PROCESSING'] } },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.supportTicket.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.p2POrder.findMany({
        where: { status: { in: [P2POrderStatus.DISPUTED, P2POrderStatus.FROZEN] } },
        include: {
          buyer: { select: { id: true, email: true, firstName: true, lastName: true } },
          seller: { select: { id: true, email: true, firstName: true, lastName: true } },
          offer: { select: { fiatCurrency: true, cryptoCurrency: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.inquiry.findMany({
        where: { status: 'NEW' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    await otcService.ensureOtcSchema();
    const [activeAndDisputedOtcTradesList, underReviewOtcDesksList, pendingP2PAppsList, openOtcInquiriesList] = await Promise.all([
      prisma.otcTrade.findMany({
        where: { status: { in: ['DISPUTED', 'IN_PROGRESS'] } },
        include: {
          desk: { select: { deskName: true, city: true, country: true } },
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          operator: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.otcDesk.findMany({
        where: { status: 'UNDER_REVIEW' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.p2POnboardingApplication.findMany({
        where: { status: 'PENDING' },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.otcInquiry
        .findMany({
          where: { status: 'OPEN' },
          include: {
            desk: { select: { deskName: true, city: true, country: true } },
            customer: { select: { id: true, email: true, firstName: true, lastName: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { updatedAt: 'desc' },
        })
        .catch(() => []),
    ]);

    const pendingRequests: any[] = [];
    const alerts: any[] = [];

    let yieldDueCount = 0;
    let yieldDueTotalDec = new Decimal(0);
    let yieldDueSoonCount = 0;
    let yieldDueSoonTotalDec = new Decimal(0);
    let maturedUnsettledCount = 0;
    let approachingMaturityCount = 0;
    let pendingPackagesCount = 0;
    let nextUpcomingYieldDate: Date | null = null;

    for (const pkg of activeAndPendingPackages) {
      const fullName =
        `${pkg.user?.firstName || ''} ${pkg.user?.lastName || ''}`.trim() ||
        pkg.user?.email ||
        'Investor';
      const amountFixed = new Decimal(pkg.amount.toString()).toFixed(2);

      if (pkg.status === 'PENDING_PAYMENT') {
        pendingPackagesCount++;
        const age = this.computeAgeInfo(pkg.createdAt, now, 48);
        const item = {
          id: `PKG_ACT-${pkg.id}`,
          entityId: pkg.id,
          code: pkg.packageCode,
          category: 'FD_ACTIVATION',
          typeLabel: 'FD Package Activation',
          title: `Pending FD Activation: ${pkg.packageCode}`,
          description: `$${amountFixed} ${pkg.currency} (${pkg.lockInMonths}m FD via ${pkg.depositMethod || 'BANK_WIRE'}) awaiting payment verification`,
          customerId: pkg.userId,
          customerName: fullName,
          customerEmail: pkg.user?.email || '',
          amount: amountFixed,
          currency: pkg.currency,
          status: pkg.status,
          targetTab: 'packages',
          requestDate: pkg.createdAt.toISOString(),
          createdDate: pkg.createdAt.toISOString(),
          ageMs: age.ageMs,
          ageHours: age.ageHours,
          ageDays: age.ageDays,
          ageLabel: age.ageLabel,
          isOverdue: age.isOverdue,
          urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
          priorityRank: age.isOverdue ? 1 : 3,
          meta: {
            lockInMonths: pkg.lockInMonths,
            depositMethod: pkg.depositMethod,
          },
        };
        pendingRequests.push(item);
        alerts.push(item);
        continue;
      }

      // Active FD Yield Schedule evaluation
      const schedule = computePackageYieldSchedule(pkg, now);
      if (schedule.isYieldDue && schedule.duePeriodsCount > 0) {
        yieldDueCount++;
        const dueAmtDec = new Decimal(schedule.dueYieldAmount);
        yieldDueTotalDec = yieldDueTotalDec.plus(dueAmtDec);
        const dueDate = schedule.nextYieldDueDate || now;
        const age = this.computeAgeInfo(dueDate, now, 24);
        const overdueFlag = age.isOverdue || (schedule.daysUntilNextYield ?? 0) < 0;
        const periodSummary = schedule.duePeriodIndices.map((p) => `Month ${p}`).join(', ');

        const yieldItem = {
          id: `YIELD_DUE-${pkg.id}`,
          entityId: pkg.id,
          code: pkg.packageCode,
          category: 'FD_YIELD_DUE',
          typeLabel: 'FD Monthly Yield Due',
          title: `Yield Due: ${pkg.packageCode} (${periodSummary})`,
          description: `+$${schedule.dueYieldAmount} ${pkg.currency} ready to credit (${schedule.duePeriodsCount} completed monthly cycle${schedule.duePeriodsCount > 1 ? 's' : ''} out of ${schedule.lockMonths}m)`,
          customerId: pkg.userId,
          customerName: fullName,
          customerEmail: pkg.user?.email || '',
          amount: schedule.dueYieldAmount,
          currency: pkg.currency,
          status: 'YIELD_DUE',
          targetTab: 'packages',
          requestDate: dueDate.toISOString(),
          createdDate: dueDate.toISOString(),
          ageMs: age.ageMs,
          ageHours: age.ageHours,
          ageDays: age.ageDays,
          ageLabel: age.ageHours < 1 ? 'Due today' : `${age.ageLabel} past cycle`,
          isOverdue: overdueFlag,
          urgency: overdueFlag ? 'OVERDUE' : 'DUE_TODAY',
          priorityRank: overdueFlag ? 0 : 1,
          meta: {
            packageCode: pkg.packageCode,
            principalAmount: amountFixed,
            duePeriodsCount: schedule.duePeriodsCount,
            duePeriodIndices: schedule.duePeriodIndices,
            nextPeriodIndex: schedule.nextPeriodIndex,
            lockInMonths: schedule.lockMonths,
          },
        };
        pendingRequests.push(yieldItem);
        alerts.push(yieldItem);
      } else if (pkg.status === 'ACTIVE' && schedule.nextYieldDueDate) {
        if (!nextUpcomingYieldDate || schedule.nextYieldDueDate < nextUpcomingYieldDate) {
          nextUpcomingYieldDate = schedule.nextYieldDueDate;
        }
        if (schedule.isYieldDueSoon) {
          yieldDueSoonCount++;
          yieldDueSoonTotalDec = yieldDueSoonTotalDec.plus(new Decimal(schedule.monthlyYield));
          alerts.push({
            id: `YIELD_SOON-${pkg.id}`,
            entityId: pkg.id,
            code: pkg.packageCode,
            category: 'FD_YIELD_SOON',
            typeLabel: 'Upcoming FD Yield Cycle',
            title: `Yield Due in ${schedule.daysUntilNextYield}d: ${pkg.packageCode}`,
            description: `Month ${schedule.nextPeriodIndex}/${schedule.lockMonths} (+$${schedule.monthlyYield} ${pkg.currency}) completes on ${schedule.nextYieldDueDate.toISOString().split('T')[0]}`,
            customerId: pkg.userId,
            customerName: fullName,
            customerEmail: pkg.user?.email || '',
            amount: schedule.monthlyYield,
            currency: pkg.currency,
            status: 'UPCOMING_CYCLE',
            targetTab: 'packages',
            requestDate: schedule.nextYieldDueDate.toISOString(),
            createdDate: schedule.nextYieldDueDate.toISOString(),
            ageMs: 0,
            ageHours: 0,
            ageDays: 0,
            ageLabel: `In ${schedule.daysUntilNextYield}d`,
            isOverdue: false,
            urgency: 'UPCOMING',
            priorityRank: 4,
            meta: {
              packageCode: pkg.packageCode,
              nextPeriodIndex: schedule.nextPeriodIndex,
              daysUntilNextYield: schedule.daysUntilNextYield,
            },
          });
        }
      }

      // Check FD Maturity / Approaching Maturity
      if (pkg.lockInEnd) {
        const endDt = new Date(pkg.lockInEnd);
        const msRemaining = endDt.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 0) {
          maturedUnsettledCount++;
          const age = this.computeAgeInfo(endDt, now, 24);
          const maturedItem = {
            id: `FD_MATURED-${pkg.id}`,
            entityId: pkg.id,
            code: pkg.packageCode,
            category: 'FD_MATURED',
            typeLabel: 'FD Maturity Settlement',
            title: `FD Matured: ${pkg.packageCode} Ready for Settlement`,
            description: `$${amountFixed} ${pkg.currency} principal lock ended ${endDt.toISOString().split('T')[0]}. Process full settlement (returns + principal).`,
            customerId: pkg.userId,
            customerName: fullName,
            customerEmail: pkg.user?.email || '',
            amount: amountFixed,
            currency: pkg.currency,
            status: 'MATURED_DUE',
            targetTab: 'packages',
            requestDate: endDt.toISOString(),
            createdDate: endDt.toISOString(),
            ageMs: age.ageMs,
            ageHours: age.ageHours,
            ageDays: age.ageDays,
            ageLabel: age.ageHours < 1 ? 'Matured today' : `${age.ageLabel} past end`,
            isOverdue: age.isOverdue,
            urgency: age.isOverdue ? 'OVERDUE' : 'DUE_TODAY',
            priorityRank: age.isOverdue ? 0 : 1,
            meta: {
              packageCode: pkg.packageCode,
              lockInMonths: pkg.lockInMonths,
            },
          };
          pendingRequests.push(maturedItem);
          alerts.push(maturedItem);
        } else if (daysRemaining <= 15) {
          approachingMaturityCount++;
          alerts.push({
            id: `FD_SOON-${pkg.id}`,
            entityId: pkg.id,
            code: pkg.packageCode,
            category: 'FD_APPROACHING_MATURITY',
            typeLabel: 'FD Approaching Maturity',
            title: `FD Maturing in ${daysRemaining}d: ${pkg.packageCode}`,
            description: `$${amountFixed} ${pkg.currency} principal matures on ${endDt.toISOString().split('T')[0]}`,
            customerId: pkg.userId,
            customerName: fullName,
            customerEmail: pkg.user?.email || '',
            amount: amountFixed,
            currency: pkg.currency,
            status: 'APPROACHING_MATURITY',
            targetTab: 'packages',
            requestDate: endDt.toISOString(),
            createdDate: endDt.toISOString(),
            ageMs: 0,
            ageHours: 0,
            ageDays: 0,
            ageLabel: `${daysRemaining}d left`,
            isOverdue: false,
            urgency: 'UPCOMING',
            priorityRank: 4,
            meta: {
              packageCode: pkg.packageCode,
              daysRemaining,
            },
          });
        }
      }
    }

    // Pending Deposit Requests
    for (const dep of pendingDepositsList) {
      const fullName =
        `${dep.user?.firstName || ''} ${dep.user?.lastName || ''}`.trim() ||
        dep.user?.email ||
        'Investor';
      const amountFixed = new Decimal(dep.amount.toString()).toFixed(2);
      const age = this.computeAgeInfo(dep.createdAt, now, 48);
      const item = {
        id: `DEP-${dep.id}`,
        entityId: dep.id,
        code: dep.depositCode,
        category: 'DEPOSIT',
        typeLabel: 'Deposit / Balance Request',
        title: `Deposit Request: ${dep.depositCode} ($${amountFixed} ${dep.currency})`,
        description: `${dep.depositMethod} deposit awaiting verification${dep.txHashOrRef ? ` • Ref: ${dep.txHashOrRef}` : ' • No gateway ref'}`,
        customerId: dep.userId,
        customerName: fullName,
        customerEmail: dep.user?.email || '',
        amount: amountFixed,
        currency: dep.currency,
        status: dep.status,
        targetTab: 'deposits',
        requestDate: dep.createdAt.toISOString(),
        createdDate: dep.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
        priorityRank: age.isOverdue ? 0 : 2,
        meta: {
          depositMethod: dep.depositMethod,
          txHashOrRef: dep.txHashOrRef,
        },
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Pending Withdrawal Requests
    for (const wth of pendingWithdrawalsList) {
      const fullName =
        `${wth.user?.firstName || ''} ${wth.user?.lastName || ''}`.trim() ||
        wth.user?.email ||
        'Investor';
      const amountFixed = new Decimal(wth.amount.toString()).toFixed(2);
      const age = this.computeAgeInfo(wth.createdAt, now, 48);
      let parsedDetails: any = null;
      try {
        parsedDetails = wth.payoutDetails ? JSON.parse(wth.payoutDetails) : null;
      } catch {
        parsedDetails = null;
      }
      const item = {
        id: `WTH-${wth.id}`,
        entityId: wth.id,
        code: wth.requestCode,
        category: 'WITHDRAWAL',
        typeLabel: 'Withdrawal Settlement',
        title: `Withdrawal Request: ${wth.requestCode} (${amountFixed} ${wth.currency})`,
        description: `${wth.payoutMethod}${parsedDetails?.network ? ` • ${parsedDetails.network}` : ''} • ${parsedDetails?.sourceBalanceLabel || wth.withdrawalType}${wth.package?.packageCode ? ` (${wth.package.packageCode})` : ''}`,
        customerId: wth.userId,
        customerName: fullName,
        customerEmail: wth.user?.email || '',
        amount: amountFixed,
        currency: wth.currency,
        status: wth.status,
        targetTab: 'withdrawals',
        requestDate: wth.createdAt.toISOString(),
        createdDate: wth.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
        priorityRank: age.isOverdue ? 0 : 2,
        meta: {
          payoutMethod: wth.payoutMethod,
          network: parsedDetails?.network || null,
          sourceBalanceLabel: parsedDetails?.sourceBalanceLabel || null,
          withdrawalType: wth.withdrawalType,
        },
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Pending KYC Verifications
    for (const kyc of pendingKycList) {
      const fullName =
        `${kyc.user?.firstName || ''} ${kyc.user?.lastName || ''}`.trim() ||
        kyc.user?.email ||
        'Investor';
      const age = this.computeAgeInfo(kyc.createdAt, now, 48);
      const item = {
        id: `KYC-${kyc.id}`,
        entityId: kyc.id,
        code: `KYC-${kyc.id.slice(0, 8).toUpperCase()}`,
        category: 'KYC_VERIFICATION',
        typeLabel: 'KYC Verification',
        title: `KYC Review: ${kyc.documentType}`,
        description: `${kyc.documentType} submission awaiting compliance verification`,
        customerId: kyc.userId,
        customerName: fullName,
        customerEmail: kyc.user?.email || '',
        amount: null,
        currency: null,
        status: kyc.status,
        targetTab: 'kyc',
        requestDate: kyc.createdAt.toISOString(),
        createdDate: kyc.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
        priorityRank: age.isOverdue ? 1 : 3,
        meta: { documentType: kyc.documentType },
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Pending Global Remittance Orders
    for (const tr of pendingTransfersList) {
      const fullName =
        `${tr.user?.firstName || ''} ${tr.user?.lastName || ''}`.trim() ||
        tr.senderName ||
        tr.senderEmail;
      const amountFixed = new Decimal(tr.sendingAmount.toString()).toFixed(2);
      const age = this.computeAgeInfo(tr.createdAt, now, 48);
      const item = {
        id: `GMT-${tr.id}`,
        entityId: tr.id,
        code: tr.transferCode,
        category: 'REMITTANCE',
        typeLabel: 'Global Remittance',
        title: `Remittance Order: ${tr.transferCode} (${amountFixed} ${tr.sendingCurrency} → ${tr.recipientCurrency})`,
        description: `To ${tr.recipientName} (${tr.destinationCountry}) • Status: ${tr.status}`,
        customerId: tr.userId,
        customerName: fullName,
        customerEmail: tr.user?.email || tr.senderEmail || '',
        amount: amountFixed,
        currency: tr.sendingCurrency,
        status: tr.status,
        targetTab: 'remittance',
        requestDate: tr.createdAt.toISOString(),
        createdDate: tr.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
        priorityRank: age.isOverdue ? 1 : 3,
        meta: {
          recipientCurrency: tr.recipientCurrency,
          destinationCountry: tr.destinationCountry,
        },
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Open Support Tickets
    for (const tkt of openTicketsList) {
      const fullName =
        `${tkt.user?.firstName || ''} ${tkt.user?.lastName || ''}`.trim() ||
        tkt.user?.email ||
        'Client';
      const age = this.computeAgeInfo(tkt.createdAt, now, 48);
      const item = {
        id: `TKT-${tkt.id}`,
        entityId: tkt.id,
        code: tkt.ticketNumber,
        category: 'SUPPORT_TICKET',
        typeLabel: 'Support Ticket',
        title: `Support Ticket: ${tkt.subject}`,
        description: `Priority: ${tkt.priority} • Category: ${tkt.category}`,
        customerId: tkt.userId,
        customerName: fullName,
        customerEmail: tkt.user?.email || '',
        amount: null,
        currency: null,
        status: tkt.status,
        targetTab: 'disputes',
        requestDate: tkt.createdAt.toISOString(),
        createdDate: tkt.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : tkt.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
        priorityRank: age.isOverdue ? 1 : 3,
        meta: { priority: tkt.priority, ticketCategory: tkt.category },
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Disputed / Frozen P2P Orders
    for (const p2p of disputedP2PList) {
      const buyerName = `${p2p.buyer?.firstName || ''} ${p2p.buyer?.lastName || ''}`.trim() || p2p.buyer?.email || 'Buyer';
      const amountFixed = new Decimal(p2p.cryptoAmount.toString()).toFixed(2);
      const cryptoCur = (p2p.cryptoCurrency || p2p.offer?.cryptoCurrency || 'USDT').toUpperCase();
      const fiatCur = (p2p.fiatCurrency || p2p.offer?.fiatCurrency || 'USD').toUpperCase();
      const age = this.computeAgeInfo(p2p.disputedAt || p2p.createdAt, now, 3);
      const item = {
        id: `P2P-${p2p.id}`,
        entityId: p2p.id,
        code: p2p.orderCode,
        category: 'P2P_DISPUTE',
        typeLabel: p2p.status === 'FROZEN' ? 'P2P Order Frozen' : 'P2P Escrow Dispute',
        title: `P2P ${p2p.status === 'FROZEN' ? 'Frozen' : 'Dispute'}: ${p2p.orderCode} (${amountFixed} ${cryptoCur})`,
        description: `${buyerName} vs ${p2p.seller?.email || 'Seller'} (${formatFiatWithCurrency(p2p.fiatAmount.toString(), fiatCur)}) • 180m SLA compliance review`,
        customerId: p2p.buyerId,
        customerName: buyerName,
        customerEmail: p2p.buyer?.email || '',
        amount: amountFixed,
        currency: cryptoCur,
        status: p2p.status,
        targetTab: 'p2p',
        requestDate: (p2p.disputedAt || p2p.createdAt).toISOString(),
        createdDate: p2p.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
        priorityRank: 0,
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Pending P2P Onboarding Applications
    for (const papp of pendingP2PAppsList) {
      const applicantName =
        `${papp.user?.firstName || ''} ${papp.user?.lastName || ''}`.trim() ||
        papp.user?.email ||
        'Applicant';
      const age = this.computeAgeInfo(papp.createdAt, now, 24);
      const item = {
        id: `P2PAPP-${papp.id}`,
        entityId: papp.id,
        code: papp.applicationCode,
        category: 'P2P_APPLICATION',
        typeLabel: 'P2P Onboarding Review',
        title: `P2P Trader Verification: ${papp.applicationCode} (${applicantName})`,
        description: `SOF: ${papp.sourceOfFunds} • Volume: ${papp.expectedMonthlyVolume} • Experience: ${papp.tradingExperience}`,
        customerId: papp.userId,
        customerName: applicantName,
        customerEmail: papp.user?.email || '',
        amount: null,
        currency: null,
        status: papp.status,
        targetTab: 'p2p',
        requestDate: papp.createdAt.toISOString(),
        createdDate: papp.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
        priorityRank: 1,
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // New Client Inquiries
    for (const inq of pendingInquiriesList) {
      const age = this.computeAgeInfo(inq.createdAt, now, 48);
      const item = {
        id: `INQ-${inq.id}`,
        entityId: inq.id,
        code: `INQ-${inq.id.slice(0, 8).toUpperCase()}`,
        category: 'INQUIRY',
        typeLabel: 'Client Inquiry',
        title: `Client Inquiry: ${inq.subject}`,
        description: `${inq.type} inquiry from ${inq.name}`,
        customerId: inq.userId || null,
        customerName: inq.name,
        customerEmail: inq.email,
        amount: null,
        currency: null,
        status: inq.status,
        targetTab: 'disputes',
        requestDate: inq.createdAt.toISOString(),
        createdDate: inq.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : 'NORMAL',
        priorityRank: age.isOverdue ? 1 : 3,
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Active & Disputed OTC Escrow Trades
    for (const otc of activeAndDisputedOtcTradesList) {
      const custName =
        `${otc.customer?.firstName || ''} ${otc.customer?.lastName || ''}`.trim() ||
        otc.customer?.email ||
        'Customer';
      const amountFixed = new Decimal(otc.cryptoAmount.toString()).toFixed(2);
      const isDisputed = otc.status === 'DISPUTED';
      const age = this.computeAgeInfo(otc.createdAt, now, isDisputed ? 12 : 24);
      const item = {
        id: `OTC_TRD-${otc.id}`,
        entityId: otc.id,
        code: otc.tradeCode,
        category: isDisputed ? 'OTC_DISPUTE' : 'OTC_TRADE',
        typeLabel: isDisputed ? 'OTC Escrow Dispute' : 'Active OTC Escrow',
        title: `${isDisputed ? 'OTC Dispute' : 'OTC Escrow'}: ${otc.tradeCode} (${amountFixed} USDT)`,
        description: `${otc.desk?.deskName || 'OTC Desk'} • ${custName} vs ${otc.operator?.email || 'Operator'} (${otc.fiatAmount ? `${new Decimal(otc.fiatAmount.toString()).toFixed(2)} ${otc.fiatCurrency}` : otc.tradeType})`,
        customerId: otc.customerId,
        customerName: custName,
        customerEmail: otc.customer?.email || '',
        amount: amountFixed,
        currency: 'USDT',
        status: otc.status,
        targetTab: 'otc',
        requestDate: otc.createdAt.toISOString(),
        createdDate: otc.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: isDisputed || age.isOverdue ? (isDisputed ? 'OVERDUE' : 'OVERDUE') : 'HIGH',
        priorityRank: isDisputed ? 0 : 2,
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // OTC Desks Awaiting Review
    for (const desk of underReviewOtcDesksList) {
      const opName =
        `${desk.user?.firstName || ''} ${desk.user?.lastName || ''}`.trim() ||
        desk.user?.email ||
        'Operator';
      const age = this.computeAgeInfo(desk.createdAt, now, 24);
      const item = {
        id: `OTC_DSK-${desk.id}`,
        entityId: desk.id,
        code: desk.deskCode,
        category: 'OTC_DESK_REVIEW',
        typeLabel: 'OTC Desk Review',
        title: `OTC Desk Review: ${desk.deskName}`,
        description: `${desk.city}, ${desk.country} • ${desk.locationAddress || 'Verify location & deposit'}`,
        customerId: desk.userId,
        customerName: opName,
        customerEmail: desk.user?.email || '',
        amount: new Decimal(desk.securityDeposit.toString()).toFixed(2),
        currency: 'USD',
        status: desk.status,
        targetTab: 'otc',
        requestDate: desk.createdAt.toISOString(),
        createdDate: desk.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
        priorityRank: age.isOverdue ? 0 : 2,
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    // Open Pre-Trade OTC Desk Inquiries (customer asking availability / currency)
    for (const inq of openOtcInquiriesList as any[]) {
      const custName =
        `${inq.customer?.firstName || ''} ${inq.customer?.lastName || ''}`.trim() ||
        inq.customer?.email ||
        'Client';
      const lastMsgText = inq.messages?.[0]?.message || inq.subject;
      const age = this.computeAgeInfo(inq.updatedAt || inq.createdAt, now, 12);
      const item = {
        id: `OTC_INQ-${inq.id}`,
        entityId: inq.id,
        code: inq.inquiryCode,
        category: 'OTC_TRADE',
        typeLabel: 'OTC Desk Inquiry',
        title: `OTC Inquiry: ${inq.desk?.deskName || 'OTC Desk'} (${inq.inquiryCode})`,
        description: `${custName}: "${String(lastMsgText).slice(0, 120)}"`,
        customerId: inq.customerId,
        customerName: custName,
        customerEmail: inq.customer?.email || '',
        status: inq.status,
        targetTab: 'otc',
        requestDate: (inq.updatedAt || inq.createdAt).toISOString(),
        createdDate: inq.createdAt.toISOString(),
        ageMs: age.ageMs,
        ageHours: age.ageHours,
        ageDays: age.ageDays,
        ageLabel: age.ageLabel,
        isOverdue: age.isOverdue,
        urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
        priorityRank: 1,
      };
      pendingRequests.push(item);
      alerts.push(item);
    }

    const sortByUrgencyThenAge = (a: any, b: any) => {
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
      return b.ageMs - a.ageMs;
    };

    pendingRequests.sort(sortByUrgencyThenAge);
    alerts.sort(sortByUrgencyThenAge);

    const overdueCount = pendingRequests.filter((r) => r.isOverdue).length;
    const dueTodayCount = pendingRequests.filter((r) => r.urgency === 'DUE_TODAY').length;
    const totalPendingCount = pendingRequests.filter(
      (r) => !['FD_YIELD_DUE', 'FD_MATURED'].includes(r.category)
    ).length;
    const oldestItem = [...pendingRequests].sort((a, b) => b.ageMs - a.ageMs)[0] || null;

    const summary = {
      yieldDueCount,
      yieldDueTotalUsd: yieldDueTotalDec.toFixed(2),
      yieldDueSoonCount,
      yieldDueSoonTotalUsd: yieldDueSoonTotalDec.toFixed(2),
      maturedUnsettledCount,
      approachingMaturityCount,
      pendingDepositsCount: pendingDepositsList.length,
      pendingWithdrawalsCount: pendingWithdrawalsList.length,
      pendingPackagesCount,
      pendingKycCount: pendingKycList.length,
      pendingRemittancesCount: pendingTransfersList.length,
      openTicketsCount: openTicketsList.length,
      disputedP2PCount: disputedP2PList.length,
      pendingP2PApplicationsCount: pendingP2PAppsList.length,
      disputedOtcCount: activeAndDisputedOtcTradesList.filter((t) => t.status === 'DISPUTED').length,
      activeOtcTradesCount: activeAndDisputedOtcTradesList.length,
      newInquiriesCount: pendingInquiriesList.length,
      totalPendingCount,
      totalActionItems: pendingRequests.length,
      overdueCount,
      dueTodayCount,
      upcomingAlertsCount: alerts.filter((a) => a.urgency === 'UPCOMING').length,
      totalAlertsCount: alerts.length,
      oldestPendingDays: oldestItem ? oldestItem.ageDays : 0,
      oldestPendingLabel: oldestItem ? oldestItem.ageLabel : '0m',
      nextUpcomingYieldDate: nextUpcomingYieldDate ? nextUpcomingYieldDate.toISOString() : null,
    };

    return {
      ...summary,
      summary,
      alerts,
      pendingRequests,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Dedicated endpoint returning real-time date-based notifications, yield alerts & pending/overdue requests
   */
  async getAdminNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const commandCenter = await this.buildAdminCommandCenterData();
      res.json({
        success: true,
        data: commandCenter,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Institutional Analytics & KPI Overview
   */
  async getPlatformOverviewAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const [totalUsers, totalPackages, activePackages, pendingDeposits] = await Promise.all([
        prisma.user.count(),
        prisma.investmentPackage.count(),
        prisma.investmentPackage.findMany({
          where: { status: PackageStatus.ACTIVE },
          select: { amount: true },
        }),
        prisma.depositRequest.count({ where: { status: DepositStatus.PENDING } }),
      ]);

      const [pendingWithdrawals, pendingKyc, totalStartups, totalTransfers] = await Promise.all([
        prisma.withdrawalRequest.count({
          where: {
            status: {
              in: [WithdrawalStatus.REQUESTED, WithdrawalStatus.UNDER_REVIEW, WithdrawalStatus.APPROVED],
            },
          },
        }),
        prisma.kycDocument.count({ where: { status: KycStatus.PENDING } }),
        prisma.startupListing.count({ where: { status: 'PUBLISHED' } }),
        prisma.globalTransfer.count(),
      ]);

      const [totalTickets, totalOtcDesks, totalOtcTrades] = await Promise.all([
        prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.otcDesk.count(),
        prisma.otcTrade.count(),
      ]);

      const commandCenter = await this.buildAdminCommandCenterData();
      const platformRevenueSummary = await this.buildPlatformRevenueData(
        (req as any).user?.id ? String((req as any).user.id) : undefined
      ).catch(() => null);

      const activeCapital = activePackages.reduce((acc, p) => acc + parseFloat(p.amount.toString()), 0);

      res.json({
        success: true,
        data: {
          totalUsers,
          totalPackages,
          activeCapital: activeCapital.toFixed(2),
          activePackagesCount: activePackages.length,
          pendingDeposits,
          pendingWithdrawals,
          pendingKyc,
          totalStartups,
          totalTransfers,
          totalTickets,
          totalOtcDesks,
          totalOtcTrades,
          commandCenter,
          platformRevenueSummary,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Onboard/Create a new user directly
   */
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const {
        firstName,
        lastName,
        email,
        password,
        role = Role.USER,
        country = 'GE',
        phone,
        initialBalance,
        initialCurrency = 'USD',
        autoVerifyKyc = true,
      } = req.body;

      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, message: 'A valid email address is required' });
      }

      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (existing) {
        return res.status(400).json({ success: false, message: `A user with email ${email} already exists.` });
      }

      const tempPassword = password && password.trim().length >= 6
        ? password.trim()
        : `Avora@${Math.floor(100000 + Math.random() * 900000)}`;

      const passwordHash = await bcrypt.hash(tempPassword, 10);

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash,
          firstName: firstName?.trim() || 'Client',
          lastName: lastName?.trim() || 'Investor',
          role: role === Role.ADMIN ? Role.ADMIN : role === Role.STAFF ? Role.STAFF : Role.USER,
          phone: phone?.trim() || null,
          signupLocation: country || 'GE',
          country: country || 'GE',
          kycStatus: autoVerifyKyc ? KycStatus.APPROVED : KycStatus.NOT_STARTED,
          status: UserStatus.ACTIVE,
          twoFactorEnabled: false,
        },
      });

      const accountNumber = generateAvoraAccountNumber(user.id);

      // Ensure default wallet balances exist (USD, USDT, EUR, GEL, INR)
      await ledgerService.ensureWallet(user.id);

      // If initial balance was requested, credit it
      let creditedBalance = null;
      if (initialBalance && parseFloat(initialBalance) > 0) {
        const creditAmt = parseFloat(initialBalance);
        creditedBalance = await ledgerService.processAdminBalanceAdjustment({
          userId: user.id,
          adminUserId,
          currency: initialCurrency || 'USD',
          amount: creditAmt,
          type: 'CREDIT',
          reason: 'Initial institutional account funding upon onboarding',
        });
      }

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_CREATE_USER',
          entity: 'User',
          entityId: user.id,
          details: `Admin created user ${user.email} (${accountNumber}) with role ${user.role} and initial balance ${initialBalance || 0} ${initialCurrency}`,
        },
      });

      res.status(201).json({
        success: true,
        message: `Account for ${user.email} successfully created.`,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            accountNumber,
            role: user.role,
            kycStatus: user.kycStatus,
            temporaryPassword: tempPassword,
          },
          temporaryPassword: tempPassword,
          creditedBalance,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Deploy/Issue an active Fixed Deposit investment package for any user
   */
  async createPackage(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const {
        userId,
        userEmail,
        amount,
        currency = 'USD',
        lockInMonths = 6,
        returnRateSnapshot = '0.0100',
        fundingSource = 'DIRECT_CREDIT',
      } = req.body;

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid positive package amount required' });
      }

      let targetUser = null;
      if (userId) {
        targetUser = await prisma.user.findUnique({ where: { id: String(userId) } });
      } else if (userEmail) {
        targetUser = await prisma.user.findUnique({ where: { email: String(userEmail).toLowerCase().trim() } });
      }

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Target client user not found' });
      }

      const amountDec = new Decimal(amount.toString());
      const months = parseInt(lockInMonths?.toString() || '6', 10);
      const rate = new Decimal(returnRateSnapshot?.toString() || '0.0100');

      let investmentPackage;

      if (fundingSource === 'WALLET') {
        investmentPackage = await ledgerService.purchasePackageFromWallet({
          userId: targetUser.id,
          amount: amountDec.toFixed(8),
          currency,
          returnRateSnapshot: rate.toFixed(4),
          lockInMonths: months,
          idempotencyKey: `ADMIN-PKG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        });
      } else {
        const now = new Date();
        const lockInEnd = new Date(now);
        lockInEnd.setMonth(lockInEnd.getMonth() + months);

        const packageCode = `PKG-INST-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        investmentPackage = await prisma.$transaction(async (tx) => {
          const wallet = await ledgerService.ensureWallet(targetUser.id);
          const lockedBal = await ledgerService.lockWalletBalance(tx, wallet.id, currency);

          const newLocked = new Decimal(lockedBal.lockedPrincipal.toString()).plus(amountDec);
          await tx.walletBalance.update({
            where: { id: lockedBal.id },
            data: { lockedPrincipal: newLocked.toFixed(8) },
          });

          return await tx.investmentPackage.create({
            data: {
              packageCode,
              userId: targetUser.id,
              amount: amountDec.toFixed(8),
              currency,
              returnRateSnapshot: rate.toFixed(4),
              lockInMonths: months,
              status: PackageStatus.ACTIVE,
              lockInStart: now,
              lockInEnd,
              purchaseDate: now,
              depositMethod: 'ADMIN_DIRECT_CREDIT',
              adminNotes: `Deployed by admin ${adminUserId}`,
            },
          });
        });
      }

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_CREATE_PACKAGE',
          entity: 'InvestmentPackage',
          entityId: investmentPackage.id,
          details: `Admin deployed ${months}-mo FD package ${investmentPackage.packageCode} for $${amountDec.toFixed(2)} ${currency} to ${targetUser.email} (Source: ${fundingSource})`,
        },
      });

      res.status(201).json({
        success: true,
        message: `Fixed Deposit package ${investmentPackage.packageCode} successfully deployed for ${targetUser.email}.`,
        data: { package: investmentPackage },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to create investment package' });
    }
  }

  /**
   * Admin: Create and instantly credit a manual deposit for any user
   */
  async createManualDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const {
        userId,
        userEmail,
        amount,
        currency = 'USDT',
        depositMethod = 'MANUAL_CREDIT',
        txHashOrRef,
        notes = 'Institutional balance deposit credited via admin desk',
      } = req.body;

      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid positive deposit amount required' });
      }

      let targetUser = null;
      if (userId) {
        targetUser = await prisma.user.findUnique({ where: { id: String(userId) } });
      } else if (userEmail) {
        targetUser = await prisma.user.findUnique({ where: { email: String(userEmail).toLowerCase().trim() } });
      }

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Target client user not found' });
      }

      const depositCode = `DEP-MAN-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const amountDec = new Decimal(amount.toString());

      const customRef = txHashOrRef?.trim();
      if (customRef) {
        await ledgerService.assertUniqueTxReference(customRef);
      }
      const finalHash = customRef || `MAN-${depositCode}`;

      // Create Deposit Request in PENDING state
      const deposit = await prisma.depositRequest.create({
        data: {
          depositCode,
          userId: targetUser.id,
          amount: amountDec.toFixed(8),
          currency,
          depositMethod,
          txHashOrRef: finalHash,
          status: DepositStatus.PENDING,
          adminNotes: notes,
        },
      });

      // Approve immediately via depositService (atomic double-entry ledger credit)
      const approvedResult = await depositService.adminApproveDeposit(
        deposit.id,
        adminUserId,
        notes,
        finalHash
      );

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'ADMIN_MANUAL_DEPOSIT',
          entity: 'DepositRequest',
          entityId: deposit.id,
          details: `Admin credited ${amountDec.toFixed(2)} ${currency} (${depositMethod}) to ${targetUser.email}. Ref: ${finalHash}`,
        },
      });

      res.status(201).json({
        success: true,
        message: `Successfully credited ${amountDec.toFixed(2)} ${currency} to ${targetUser.email}.`,
        data: {
          deposit: approvedResult.deposit,
          balanceAfter: approvedResult.balanceAfter,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Manual deposit creation failed' });
    }
  }

  /**
   * Admin: List all OTC Desks with location metadata, security deposits, and summary KPIs
   */
  async getOtcDesks(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search } = req.query;
      const result = await otcService.getAllDesksAdmin({
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json({
        success: true,
        data: result,
        desks: result.desks,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update OTC Desk status, location/landmark, margins, or refund/forfeit $1,000 security deposit
   */
  async updateOtcDesk(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const deskId = String(req.params.id);
      const updated = await otcService.updateDeskAdmin(adminUserId, deskId, req.body || {});
      res.json({
        success: true,
        message: `OTC Desk ${updated.deskCode} updated (${updated.status}).`,
        data: updated,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to update OTC desk' });
    }
  }

  /**
   * Admin: List all OTC Escrow Trades across all desks with chat history
   */
  async getOtcTrades(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, search } = req.query;
      const trades = await otcService.getAllTradesAdmin({
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json({
        success: true,
        data: trades,
        trades,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Resolve or Force-Settle an IN_PROGRESS or DISPUTED OTC Trade
   */
  async resolveOtcTrade(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : 'SYSTEM_ADMIN';
      const tradeId = String(req.params.id);
      const { resolution, reason } = req.body || {};
      const trade = await otcService.resolveTradeAdmin(adminUserId, tradeId, resolution, reason);
      res.json({
        success: true,
        message: `OTC Trade ${trade.tradeCode} resolved (${resolution} -> ${trade.status}).`,
        data: trade,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Failed to resolve OTC trade' });
    }
  }

  /**
   * Admin: List all pre-trade OTC Desk inquiries across all desks
   */
  async getOtcInquiries(req: Request, res: Response, next: NextFunction) {
    try {
      const inquiries = await otcService.getAllInquiriesAdmin();
      res.json({ success: true, data: inquiries, inquiries });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get live exchange rates, market benchmark rates, active admin overrides & commission config
   */
  async getExchangeRates(req: Request, res: Response, next: NextFunction) {
    try {
      const [overview, feeSettings] = await Promise.all([
        rateService.getAdminRatesOverview(),
        prisma.cmsSetting.findMany({
          where: {
            key: {
              in: [
                'otc_operator_fee_percent',
                'otc_platform_fee_percent',
                'withdrawal_fee_percent',
                'withdrawal_fx_spread_percent',
                'remittance_fee_percent',
                'remittance_margin_percent',
              ],
            },
          },
        }),
      ]);

      const settingsMap: Record<string, string> = {};
      feeSettings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });

      const operatorFeePct = parseFloat(settingsMap['otc_operator_fee_percent'] || '1.5');
      const platformFeePct = parseFloat(settingsMap['otc_platform_fee_percent'] || '0.5');

      res.json({
        success: true,
        data: {
          ...overview,
          pricing: {
            otcOperatorFeePct: operatorFeePct,
            otcPlatformFeePct: platformFeePct,
            otcTotalFeePct: Number((operatorFeePct + platformFeePct).toFixed(4)),
            withdrawalFeePct: parseFloat(settingsMap['withdrawal_fee_percent'] || '0.0'),
            withdrawalFxSpreadPct: parseFloat(settingsMap['withdrawal_fx_spread_percent'] || '0.0'),
            remittanceFeePct: parseFloat(settingsMap['remittance_fee_percent'] || '3.0'),
            remittanceMarginPct: parseFloat(settingsMap['remittance_margin_percent'] || '2.0'),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update real-time currency exchange rate overrides (for Remittance, OTC, P2P & Withdrawals)
   */
  async updateExchangeRates(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user?.id ? String((req as any).user.id) : undefined;
      const { overrides, replaceAll, syncHouseP2pOffers } = req.body || {};

      if (!overrides || typeof overrides !== 'object') {
        return res.status(400).json({ success: false, message: 'Exchange rate overrides map is required' });
      }

      const updated = await rateService.updateAdminRateOverrides(overrides, Boolean(replaceAll));

      // Optionally sync default Avora house P2P offers when admin sets a new reference rate
      let syncedOffersCount = 0;
      if (syncHouseP2pOffers !== false) {
        const touchedCurrencies = Object.keys(overrides).map((c) => c.trim().toUpperCase()).filter(Boolean);
        if (touchedCurrencies.length > 0) {
          const houseOffers = await prisma.p2POffer.findMany({
            where: {
              offerCode: { startsWith: 'OFF-' },
              fiatCurrency: { in: touchedCurrencies },
              user: { email: { endsWith: '@avorabank.com' } },
              status: 'OPEN',
            },
          });

          for (const offer of houseOffers) {
            const effectiveRate = updated.rates[offer.fiatCurrency];
            if (!effectiveRate || effectiveRate <= 0) continue;
            // Maintain small market-making spread around Admin rate (BUY ads +0.5%, SELL ads -0.5%)
            const nextPrice =
              offer.side === 'BUY'
                ? new Decimal(effectiveRate).times('1.005')
                : new Decimal(effectiveRate).times('0.995');

            await prisma.p2POffer.update({
              where: { id: offer.id },
              data: { price: nextPrice.toFixed(4) },
            });
            syncedOffersCount += 1;
          }
        }
      }

      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'UPDATE_EXCHANGE_RATES',
          entity: 'CmsSetting',
          details: JSON.stringify({
            updatedOverrides: overrides,
            replaceAll: Boolean(replaceAll),
            syncedOffersCount,
          }),
        },
      });

      res.json({
        success: true,
        message: `Live platform exchange rates updated (${Object.keys(updated.overrides).length} active overrides${syncedOffersCount ? `, synced ${syncedOffersCount} house P2P ads` : ''}).`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Force refresh upstream market exchange rate feed while preserving admin overrides
   */
  async refreshExchangeRates(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await rateService.forceRefreshMarketRates();
      res.json({
        success: true,
        message: 'Live upstream market exchange rates refreshed.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
