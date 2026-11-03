import { Request, Response, NextFunction } from 'express';
import { PackageStatus, DepositStatus, WithdrawalStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { packageService } from '../services/package.service';
import { depositService } from '../services/deposit.service';
import { returnsJobService } from '../services/returns.job';
import { ledgerService } from '../services/ledger.service';
import { withdrawalService } from '../services/withdrawal.service';
import { kycService } from '../services/kyc.service';

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
      res.json({ success: true, data: result });
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
      res.json({ success: true, data: result });
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
      const { notes } = req.body;

      const result = await depositService.adminApproveDeposit(depositId, adminUserId, notes);

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
   * Manually trigger monthly returns job
   */
  async triggerMonthlyReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const { reason, cycleMonth, forceNextPeriod } = req.body || {};
      const auditReason = reason || 'Admin batch monthly yield distribution (1% standard return)';

      const summary = await returnsJobService.executeMonthlyReturns({
        manualRun: true,
        adminUserId,
        adminReason: auditReason,
        cycleMonth,
        forceNextPeriod: Boolean(forceNextPeriod),
      });

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'MANUAL_RETURNS_PAYOUT',
          entity: 'ReturnsEngine',
          entityId: summary.executionId,
          details: `Manual payout executed. Credited: ${summary.creditedCount}, Total: $${summary.totalDistributedUsd}. Reason: ${auditReason}`,
        },
      });

      res.json({
        success: true,
        message: `Monthly returns job completed. ${summary.creditedCount} packages credited, $${summary.totalDistributedUsd} distributed.`,
        data: summary,
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
      res.json({ success: true, data: result });
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
      const { reason } = req.body;

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
   * List all startup crowdfunding investments across all investors
   */
  async getInvestments(req: Request, res: Response, next: NextFunction) {
    try {
      const commitments = await prisma.investmentCommitment.findMany({
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
      });
      res.json({ success: true, data: { commitments } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all token early access and whitelist registrations
   */
  async getTokenAllocations(req: Request, res: Response, next: NextFunction) {
    try {
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
}

export const adminController = new AdminController();
