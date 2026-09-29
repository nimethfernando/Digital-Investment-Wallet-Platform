import { Request, Response, NextFunction } from 'express';
import { PrismaClient, TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { ledgerService } from '../services/ledger.service';
import { depositService } from '../services/deposit.service';

const prisma = new PrismaClient();
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export class WalletController {
  /**
   * Get authenticated user's wallet overview
   */
  async getWalletOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const summary = await ledgerService.getUserWalletSummary(userId);
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get user's transaction history with filtering and pagination
   */
  async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const skip = (page - 1) * limit;

      const type = req.query.type as TransactionType | undefined;
      const currency = req.query.currency as string | undefined;
      const format = req.query.format as string | undefined;

      const where: any = { userId };
      if (type) where.type = type;
      if (currency) where.currency = currency;

      if (req.query.startDate && req.query.endDate) {
        where.createdAt = {
          gte: new Date(req.query.startDate as string),
          lte: new Date(req.query.endDate as string),
        };
      }

      // If format is CSV, export all matching records
      if (format === 'csv') {
        const txs = await prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 5000,
        });

        let csv = 'Transaction Code,Date,Type,Amount,Currency,Status,Balance Before,Balance After,Reference,Notes\n';
        for (const t of txs) {
          csv += `"${t.transactionCode}","${t.createdAt.toISOString()}","${t.type}","${new Decimal(t.amount.toString()).toFixed(2)}","${t.currency}","${t.status}","${new Decimal(t.balanceBefore.toString()).toFixed(2)}","${new Decimal(t.balanceAfter.toString()).toFixed(2)}","${t.settlementReference || ''}","${(t.notes || '').replace(/"/g, '""')}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
        return res.send(csv);
      }

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          include: {
            package: { select: { packageCode: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.transaction.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          transactions: transactions.map((t) => ({
            id: t.id,
            transactionCode: t.transactionCode,
            type: t.type,
            amount: new Decimal(t.amount.toString()).toFixed(2),
            currency: t.currency,
            status: t.status,
            balanceBefore: new Decimal(t.balanceBefore.toString()).toFixed(2),
            balanceAfter: new Decimal(t.balanceAfter.toString()).toFixed(2),
            settlementReference: t.settlementReference,
            packageCode: t.package?.packageCode || null,
            notes: t.notes,
            createdAt: t.createdAt,
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
   * Submit a deposit request
   */
  async submitDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { amount, currency, depositMethod, proofUrl, txHashOrRef } = req.body;

      if (!amount || !depositMethod) {
        return res.status(400).json({ success: false, message: 'Amount and deposit method are required' });
      }

      const deposit = await depositService.createDeposit(userId, {
        amount,
        currency,
        depositMethod,
        proofUrl,
        txHashOrRef,
      });

      res.status(201).json({
        success: true,
        message: 'Deposit request submitted successfully. Awaiting verification.',
        data: deposit,
      });
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get user's deposit requests
   */
  async getDeposits(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const deposits = await depositService.getUserDeposits(userId);
      res.json({ success: true, data: deposits });
    } catch (err) {
      next(err);
    }
  }
}

export const walletController = new WalletController();
