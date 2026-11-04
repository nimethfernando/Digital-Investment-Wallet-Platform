import { Request, Response, NextFunction } from 'express';
import { PackageStatus, DepositStatus, WithdrawalStatus, Role, KycStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { packageService } from '../services/package.service';
import { depositService } from '../services/deposit.service';
import { returnsJobService } from '../services/returns.job';
import { ledgerService } from '../services/ledger.service';
import { withdrawalService } from '../services/withdrawal.service';
import { kycService } from '../services/kyc.service';
import { generateAvoraAccountNumber } from '../services/p2p.service';

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

  /**
   * Update investment package FD lock-in tenure & maturity date
   */
  async updatePackageTenure(req: Request, res: Response, next: NextFunction) {
    try {
      const adminUserId = (req as any).user.id;
      const packageId = req.params.id as string;
      const { lockInMonths, newEndDate, returnRateSnapshot, adminNotes } = req.body;

      const pkg = await prisma.investmentPackage.findUnique({
        where: { id: packageId },
        include: { user: true },
      });

      if (!pkg) {
        return res.status(404).json({ success: false, message: 'Investment package not found' });
      }

      const updateData: any = {};
      let calculatedEndDate: Date | null = null;

      if (lockInMonths !== undefined && lockInMonths !== null && lockInMonths !== '') {
        const months = parseInt(lockInMonths, 10);
        if (isNaN(months) || months < 1 || months > 60) {
          return res.status(400).json({ success: false, message: 'lockInMonths must be an integer between 1 and 60' });
        }
        updateData.lockInMonths = months;

        const startDate = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || new Date();
        calculatedEndDate = new Date(startDate);
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
          details: `Updated package ${pkg.packageCode} tenure to ${updateData.lockInMonths || pkg.lockInMonths} months. Lock end: ${updated.lockInEnd?.toISOString()}. Notes: ${adminNotes || 'None'}`,
        },
      });

      res.json({
        success: true,
        message: `Package ${pkg.packageCode} FD lock tenure updated to ${updated.lockInMonths} months (Maturity: ${updated.lockInEnd ? new Date(updated.lockInEnd).toLocaleDateString() : 'Active'}).`,
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
      const { distributionType, totalProceeds, exitMultiplier, notes } = req.body;

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

      const distributedRecords = [];
      let totalDistributedGross = new Decimal(0);
      let totalPlatformFees = new Decimal(0);
      let totalNetCredited = new Decimal(0);

      // Distribute pro-rata to each investor
      for (const inv of listing.investments) {
        const netInvested = new Decimal(inv.netInvestedAmount.toString());
        const investorShareFraction = netInvested.dividedBy(totalRaised);
        const grossInvestorProceeds = totalPool.times(investorShareFraction);

        // Principal returned 100% fee-free
        const capitalReturn = Decimal.min(grossInvestorProceeds, netInvested);
        const eligibleProfit = Decimal.max(grossInvestorProceeds.minus(netInvested), new Decimal(0));

        // 5% profit-share fee strictly on net profit
        const profitFeePct = new Decimal(5.00);
        const platformFeeAmount = eligibleProfit.times(profitFeePct.dividedBy(100));
        const netCashPayout = capitalReturn.plus(eligibleProfit.minus(platformFeeAmount));

        // 1. Ensure user has a wallet
        await ledgerService.ensureWallet(inv.investorUserId);

        const currentUsdBal = await prisma.walletBalance.findFirst({
          where: { wallet: { userId: inv.investorUserId }, currency: 'USD' },
        });
        const balBefore = currentUsdBal ? new Decimal(currentUsdBal.availableBalance.toString()) : new Decimal(0);
        const balAfter = balBefore.plus(netCashPayout);

        // 2. Credit investor available balance in USD
        await prisma.walletBalance.updateMany({
          where: {
            wallet: { userId: inv.investorUserId },
            currency: 'USD',
          },
          data: {
            availableBalance: { increment: netCashPayout.toNumber() },
          },
        });

        // 3. Create Transaction Ledger entry for user
        const txCode = `DIST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
        await prisma.transaction.create({
          data: {
            userId: inv.investorUserId,
            transactionCode: txCode,
            type: 'PRINCIPAL_RELEASE',
            amount: netCashPayout,
            currency: 'USD',
            status: 'COMPLETED',
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            settlementReference: txCode,
            notes: `${distributionType === 'DIVIDEND' ? 'Startup Dividend Distribution' : 'Startup Exit Payout'}: ${listing.companyName} (Principal: $${capitalReturn.toFixed(2)}, Net Gain: $${eligibleProfit.minus(platformFeeAmount).toFixed(2)})`,
          },
        });

        // 4. Update InvestmentCommitment status and financials
        await prisma.investmentCommitment.update({
          where: { id: inv.id },
          data: {
            realizedProceeds: { increment: grossInvestorProceeds },
            returnOfCapital: { increment: capitalReturn },
            eligibleNetProfit: { increment: eligibleProfit },
            profitShareFeeAmount: { increment: platformFeeAmount },
            netDistributedProfit: { increment: eligibleProfit.minus(platformFeeAmount) },
            status: distributionType === 'DIVIDEND' ? 'ACTIVE' : 'EXITED',
            settlementReference: txCode,
            notes: notes ? `${inv.notes || ''}\n[${new Date().toISOString()}] ${notes}` : inv.notes,
          },
        });

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
          details: `Distributed ${distributionType} for ${listing.companyName}. Gross Pool: $${totalPool.toFixed(2)}, Net Credited: $${totalNetCredited.toFixed(2)}, 5% Profit Share Fee: $${totalPlatformFees.toFixed(2)} across ${distributedRecords.length} investors.`,
        },
      });

      res.json({
        success: true,
        message: `Successfully distributed $${totalNetCredited.toFixed(2)} USD to ${distributedRecords.length} investors for ${listing.companyName}. 5% platform fee: $${totalPlatformFees.toFixed(2)} USD.`,
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
      const { search, role, kycStatus, page, limit } = req.query;
      const pageNum = page ? parseInt(page as string, 10) : 1;
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (role && Object.values(Role).includes(role as any)) {
        where.role = role as Role;
      }
      if (kycStatus && Object.values(KycStatus).includes(kycStatus as any)) {
        where.kycStatus = kycStatus as KycStatus;
      }
      if (search && typeof search === 'string' && search.trim()) {
        const query = search.trim();
        where.OR = [
          { email: { contains: query } },
          { firstName: { contains: query } },
          { lastName: { contains: query } },
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
          phone: u.phone,
          country: u.country,
          role: u.role,
          kycStatus: u.kycStatus,
          twoFactorEnabled: u.twoFactorEnabled,
          accountNumber: generateAvoraAccountNumber(u.id),
          isWithdrawalLocked: isLocked,
          withdrawalLockedUntil: u.withdrawalLockedUntil,
          status: u.status,
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
      if (kycStatus && Object.values(KycStatus).includes(kycStatus)) {
        dataToUpdate.kycStatus = kycStatus;
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
          group: { in: ['INVESTMENT', 'COMMISSION', 'WITHDRAWAL'] },
        },
      });

      const configMap: Record<string, string> = {};
      settings.forEach((s) => {
        configMap[s.key] = s.value;
      });

      const defaults = {
        // Fixed Deposit (FD) Engine Defaults
        package_monthly_return_rate: configMap['package_monthly_return_rate'] || '0.0100', // 1.00%
        package_lock_in_months: configMap['package_lock_in_months'] || '6',
        package_min_amount: configMap['package_min_amount'] || '1000',
        package_max_amount: configMap['package_max_amount'] || '10000',
        payout_day_of_month: configMap['payout_day_of_month'] || '1',
        withdrawal_processing_days: configMap['withdrawal_processing_days'] || '15',
        withdrawal_window_day: configMap['withdrawal_window_day'] || '1',

        // Platform Commissions & Fees Defaults
        remittance_fee_percent: configMap['remittance_fee_percent'] || '3.0',
        remittance_margin_percent: configMap['remittance_margin_percent'] || '2.0',
        startup_allocation_fee_percent: configMap['startup_allocation_fee_percent'] || '5.0',
        startup_profit_share_percent: configMap['startup_profit_share_percent'] || '5.0',
        otc_spread_percent: configMap['otc_spread_percent'] || '1.0',
        p2p_fee_percent: configMap['p2p_fee_percent'] || '0.0',
        virtual_card_issuance_fee: configMap['virtual_card_issuance_fee'] || '10.00',
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

      const updatedKeys: string[] = [];

      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined && value !== null) {
          let group = 'COMMISSION';
          if (key.startsWith('package_') || key === 'payout_day_of_month') group = 'INVESTMENT';
          if (key.startsWith('withdrawal_')) group = 'WITHDRAWAL';

          await prisma.cmsSetting.upsert({
            where: { key },
            update: { value: String(value) },
            create: {
              group,
              key,
              value: String(value),
              description: `Configured via Admin Portal for ${key}`,
            },
          });
          updatedKeys.push(key);
        }
      }

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
}

export const adminController = new AdminController();
