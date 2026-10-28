import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../services/token.service';

export class TokenController {
  /**
   * GET /api/v1/token/info
   */
  getInfo(req: Request, res: Response) {
    res.json({ success: true, data: tokenService.getTokenInfo() });
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
