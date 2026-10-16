import { Request, Response, NextFunction } from 'express';
import { TransactionType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { ledgerService } from '../services/ledger.service';
import { depositService } from '../services/deposit.service';
import { cardService } from '../services/card.service';

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

  /**
   * Execute an instant real multi-currency swap between wallet balances
   */
  async executeSwap(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { fromCurrency, toCurrency, fromAmount } = req.body;

      if (!fromCurrency || !toCurrency || !fromAmount) {
        return res.status(400).json({
          success: false,
          message: 'fromCurrency, toCurrency, and fromAmount are required',
        });
      }

      const result = await ledgerService.executeCurrencySwap({
        userId,
        fromCurrency,
        toCurrency,
        fromAmount,
      });

      res.json({
        success: true,
        message: `Successfully swapped ${result.fromAmount} ${result.fromCurrency} for ${result.toAmount} ${result.toCurrency}!`,
        data: result,
      });
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get user's VirtualCard
   */
  async getCard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const card = await cardService.getOrCreateCard(userId);
      res.json({ success: true, data: card });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Freeze/Unfreeze card
   */
  async toggleCardFreeze(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await cardService.toggleFreeze(userId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update card limits
   */
  async updateCardLimits(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { dailyLimit, monthlyLimit } = req.body;
      const result = await cardService.updateLimits(userId, dailyLimit, monthlyLimit);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update card security settings
   */
  async updateCardSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await cardService.updateSettings(userId, req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get card transaction feed
   */
  async getCardTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const transactions = await cardService.getCardTransactions(userId);
      res.json({ success: true, data: transactions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Request a PCI-compliant ephemeral key / iframe reveal token from the Card Issuer
   */
  async createCardRevealSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { nonce } = req.body || {};
      const session = await cardService.createRevealSession(userId, nonce);
      res.json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Real-Time Authorization Webhook (`/api/v1/wallet/card/webhook/authorize`)
   * Verifies `CARD_WEBHOOK_SECRET` signature, extracts `external_card_id`, `amount`,
   * `currency`, and `merchant_details`, executes atomic MariaDB checks, and responds
   * immediately with HTTP 200 `{ "approved": true }` or
   * `{ "approved": false, "reject_reason": "INSUFFICIENT_FUNDS" | "CARD_FROZEN" | "LIMIT_EXCEEDED" }`.
   */
  async authorizeCardWebhook(req: Request, res: Response) {
    try {
      const signatureHeader =
        (req.headers['stripe-signature'] as string) ||
        (req.headers['x-webhook-signature'] as string) ||
        (req.headers['x-card-webhook-signature'] as string) ||
        '';

      const rawPayload =
        typeof (req as any).rawBody === 'string'
          ? (req as any).rawBody
          : JSON.stringify(req.body || {});

      if (!cardService.verifyWebhookSignature(rawPayload, signatureHeader)) {
        return res.status(401).json({
          approved: false,
          error: 'INVALID_WEBHOOK_SIGNATURE',
        });
      }

      const body = req.body || {};
      const stripeAuth = body?.data?.object;

      const externalCardId: string =
        body.external_card_id ||
        body.card_id ||
        stripeAuth?.card?.id ||
        (typeof stripeAuth?.card === 'string' ? stripeAuth.card : '') ||
        '';

      const rawAmount =
        body.amount !== undefined
          ? body.amount
          : stripeAuth?.amount !== undefined
          ? Number(stripeAuth.amount) / 100
          : 0;

      const currency: string =
        body.currency ||
        stripeAuth?.currency ||
        'USD';

      const merchantDetails = body.merchant_details || {
        name: stripeAuth?.merchant_data?.name || body.merchant_name || 'Card Merchant',
        category: stripeAuth?.merchant_data?.category || body.merchant_category || 'ONLINE_POS',
        country: stripeAuth?.merchant_data?.country || body.merchant_country,
        mcc: stripeAuth?.merchant_data?.mcc || body.mcc,
      };

      const result = await cardService.handleRealtimeWebhookAuthorization({
        external_card_id: externalCardId,
        amount: rawAmount,
        currency,
        authorization_id: body.authorization_id || stripeAuth?.id || body.id,
        is_online: body.is_online !== undefined ? Boolean(body.is_online) : true,
        is_international: Boolean(body.is_international),
        merchant_details: merchantDetails,
      });

      if (result.approved) {
        return res.status(200).json({ approved: true });
      }

      return res.status(200).json({
        approved: false,
        reject_reason: result.reject_reason || 'CARD_FROZEN',
      });
    } catch (err: any) {
      return res.status(200).json({
        approved: false,
        reject_reason: 'CARD_FROZEN',
      });
    }
  }
}

export const walletController = new WalletController();


