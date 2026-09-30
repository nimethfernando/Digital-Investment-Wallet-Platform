import { Request, Response, NextFunction } from 'express';
import { withdrawalService } from '../services/withdrawal.service';

export class WithdrawalController {
  /**
   * Submit a new withdrawal request
   * Enforces 24h credential cooldown, optional/mandatory 2FA, 1st-of-month window, and ledger debit
   */
  async requestWithdrawal(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const {
        withdrawalType,
        packageId,
        amount,
        currency,
        payoutMethod,
        payoutDetails,
        twoFactorCode,
      } = req.body;

      if (!withdrawalType || !amount || !payoutMethod) {
        return res.status(400).json({
          success: false,
          message: 'withdrawalType, amount, and payoutMethod are required fields',
        });
      }

      if (!['MONTHLY_RETURNS', 'PRINCIPAL_RELEASE'].includes(withdrawalType)) {
        return res.status(400).json({
          success: false,
          message: 'withdrawalType must be either MONTHLY_RETURNS or PRINCIPAL_RELEASE',
        });
      }

      if (!['BANK_TRANSFER', 'USDT_WALLET', 'CASH_PICKUP_TBILISI'].includes(payoutMethod)) {
        return res.status(400).json({
          success: false,
          message: 'payoutMethod must be BANK_TRANSFER, USDT_WALLET, or CASH_PICKUP_TBILISI',
        });
      }

      const result = await withdrawalService.requestWithdrawal(userId, {
        withdrawalType,
        packageId,
        amount,
        currency: currency || 'USD',
        payoutMethod,
        payoutDetails: payoutDetails || {},
        twoFactorCode,
      });

      res.status(201).json({
        success: true,
        message: 'Withdrawal request submitted successfully. Processing window is ~15 business days.',
        data: result,
      });
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Get user's withdrawal request history
   */
  async getWithdrawals(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const list = await withdrawalService.getUserWithdrawals(userId);
      res.json({
        success: true,
        data: list,
      });
    } catch (err: any) {
      next(err);
    }
  }
}

export const withdrawalController = new WithdrawalController();
