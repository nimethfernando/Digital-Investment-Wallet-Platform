import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../services/token.service';

export class TokenController {
  /**
   * GET /api/v1/token/info
   */
  async getInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await tokenService.getTokenInfo();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/token/my-status
   */
  async getMyStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const data = await tokenService.getUserTokenStatus(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/token/faucet/claim
   */
  async claimFaucet(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const result = await tokenService.claimFaucet(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/token/purchase
   * Buy & fund Avora Token ($AVR) allocation directly from user's USD/USDT/USDC wallet balance
   */
  async purchaseTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { amountUsd, currency, notes } = req.body || {};
      const result = await tokenService.purchaseTokens(userId, {
        amountUsd,
        currency,
        notes,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/token/redeem
   * Redeem unlocked Avora Token ($AVR) back to USD/USDT/USDC spendable wallet balance
   */
  async redeemTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { tokensToRedeem, payoutCurrency, notes } = req.body || {};
      const result = await tokenService.redeemTokens(userId, {
        tokensToRedeem,
        payoutCurrency,
        notes,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/token/early-access/register
   */
  async registerEarlyAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { requestedAllocationUsd, notes } = req.body;
      const result = await tokenService.registerEarlyAccess(userId, parseFloat(requestedAllocationUsd), notes);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const tokenController = new TokenController();

