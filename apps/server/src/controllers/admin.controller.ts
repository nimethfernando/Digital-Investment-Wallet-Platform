import { Request, Response, NextFunction } from 'express';
import { PrismaClient, PackageStatus, DepositStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { packageService } from '../services/package.service';
import { depositService } from '../services/deposit.service';
import { returnsJobService } from '../services/returns.job';
import { ledgerService } from '../services/ledger.service';

const prisma = new PrismaClient();
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
      const packageId = req.params.id;
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
      const depositId = req.params.id;
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
      const depositId = req.params.id;
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
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, message: 'Audit reason is required for manual returns payout' });
      }

      const summary = await returnsJobService.executeMonthlyReturns({
        manualRun: true,
        adminUserId,
        adminReason: reason,
      });

      // Audit Log
      await prisma.adminAuditLog.create({
        data: {
          userId: adminUserId,
          action: 'MANUAL_RETURNS_PAYOUT',
          entity: 'ReturnsEngine',
          entityId: summary.executionId,
          details: `Manual payout executed. Credited: ${summary.creditedCount}, Total: $${summary.totalDistributedUsd}. Reason: ${reason}`,
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
}

export const adminController = new AdminController();
