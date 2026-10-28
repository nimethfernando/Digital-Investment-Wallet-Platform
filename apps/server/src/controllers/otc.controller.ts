import { Request, Response, NextFunction } from 'express';
import { otcService } from '../services/otc.service';

export class OtcController {
  /**
   * GET /api/v1/otc/desks
   * Location-based OTC desk discovery
   */
  async listDesks(req: Request, res: Response, next: NextFunction) {
    try {
      const countryCode = req.query.countryCode as string | undefined;
      const city = req.query.city as string | undefined;
      const currency = req.query.currency as string | undefined;
      const isOnline = req.query.isOnline === 'true' ? true : req.query.isOnline === 'false' ? false : undefined;

      const desks = await otcService.listDesks({ countryCode, city, currency, isOnline });
      res.json({ success: true, data: desks });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/apply
   * Apply to operate an OTC Desk ($1,000 security deposit)
   */
  async applyOtcDesk(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const {
        deskName,
        country,
        countryCode,
        city,
        locationAddress,
        supportedCurrencies,
        settlementMethods,
        buyRateMarginPct,
        sellRateMarginPct,
      } = req.body;

      if (!deskName || !country || !countryCode || !city || !supportedCurrencies || !settlementMethods) {
        return res.status(400).json({
          success: false,
          message: 'Desk name, country, country code, city, supported currencies, and settlement methods are required.',
        });
      }

      const desk = await otcService.applyOtcDesk(userId, {
        deskName,
        country,
        countryCode,
        city,
        locationAddress,
        supportedCurrencies,
        settlementMethods,
        buyRateMarginPct,
        sellRateMarginPct,
      });

      res.status(201).json({
        success: true,
        message: 'OTC Desk created successfully with $1,000 security deposit locked.',
        data: desk,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/deposit/refund
   * Request refund of $1,000 security deposit and close desk
   */
  async refundOtcDeposit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const result = await otcService.refundOtcDeposit(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/otc/my-desk
   * View authenticated operator's desk
   */
  async getMyDesk(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const desk = await otcService.getMyDesk(userId);
      res.json({ success: true, data: desk });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/otc/my-desk
   * Update operator desk status and rate margins
   */
  async updateMyDesk(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const updated = await otcService.updateMyDesk(userId, req.body);
      res.json({ success: true, message: 'OTC Desk settings updated successfully', data: updated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/quote
   * Request an exchange quote (1.0% operator fee, 0.5% platform fee)
   */
  async requestQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).user.id;
      const { deskId, tradeType, cryptoAmount, fiatCurrency } = req.body;

      if (!deskId || !tradeType || !cryptoAmount || !fiatCurrency) {
        return res.status(400).json({
          success: false,
          message: 'deskId, tradeType (BUY_USDT/SELL_USDT), cryptoAmount, and fiatCurrency are required.',
        });
      }

      const quote = await otcService.requestQuote(customerId, {
        deskId,
        tradeType,
        cryptoAmount,
        fiatCurrency,
      });

      res.json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/trades/accept-quote
   * Accept quote and lock crypto escrow
   */
  async acceptQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).user.id;
      const { quoteId } = req.body;

      if (!quoteId) {
        return res.status(400).json({ success: false, message: 'quoteId is required.' });
      }

      const trade = await otcService.acceptQuoteAndStartTrade(customerId, quoteId);
      res.status(201).json({
        success: true,
        message: 'Quote accepted! Escrow has been secured by Avora Bank.',
        data: trade,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/otc/trades/:id
   * Get trade details with chat history
   */
  async getTrade(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const trade = await otcService.getTrade(tradeId, userId);
      res.json({ success: true, data: trade });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/trades/:id/messages
   * Send live message in trade chat
   */
  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required.' });
      }

      const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const chatMsg = await otcService.postMessage(tradeId, userId, message);
      res.status(201).json({ success: true, data: chatMsg });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/trades/:id/release
   * Release escrow and disburse commissions (1.0% operator, 0.5% platform)
   */
  async releaseEscrow(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const trade = await otcService.releaseEscrow(tradeId, userId);
      res.json({
        success: true,
        message: 'Escrow released successfully! Funds and operator commission distributed.',
        data: trade,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const otcController = new OtcController();
