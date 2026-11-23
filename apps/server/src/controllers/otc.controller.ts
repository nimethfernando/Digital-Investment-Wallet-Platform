import { Request, Response, NextFunction } from 'express';
import { otcService } from '../services/otc.service';
import { rateService } from '../services/rate.service';
import { liquidityRiskService } from '../services/liquidityRisk.service';
import { prisma } from '../lib/prisma';

export class OtcController {
  /**
   * GET /api/v1/otc/rates
   * Real-time benchmark exchange rates from original live market source with admin margin
   */
  async getRates(req: Request, res: Response, next: NextFunction) {
    try {
      const [
        data,
        marginSetting,
        feeSetting,
        showSpreadSetting,
        otcCommission,
        wdFeeSetting,
        wdBankWireSetting,
        wdIntlFeeSetting,
        wdDomFeeSetting,
        wdCryptoFeeSetting,
        wdSpreadSetting,
        wdMinAmtSetting,
        wdTrc20Setting,
        exchangeSpreadSetting,
        activePairs,
        swapRiskCfg,
      ] = await Promise.all([
        rateService.getLiveRates(),
        prisma.cmsSetting.findUnique({ where: { key: 'remittance_margin_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'remittance_fee_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'show_remittance_spread_controls' } }).catch(() => null),
        otcService.getOtcCommissionConfig(),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_fee_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_bank_wire_fee_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_international_fee_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_domestic_fee_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_crypto_fee_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_fx_spread_percent' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_min_amount_usd' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_trc20_enabled' } }).catch(() => null),
        prisma.cmsSetting.findUnique({ where: { key: 'exchange_spread_percent' } }).catch(() => null),
        prisma.exchangePair.findMany({
          where: { isActive: true },
          select: { baseCurrency: true, quoteCurrency: true, buyMarginPct: true, sellMarginPct: true },
        }).catch(() => []),
        liquidityRiskService.getConfig().catch(() => null),
      ]);
      const marginPercent = parseFloat(marginSetting?.value || '2.0');
      const feePercent = parseFloat(feeSetting?.value || '3.0');
      const showRemittanceSpreadControls = String(showSpreadSetting?.value || 'false').toLowerCase() === 'true';
      const withdrawalFeePct = parseFloat(wdFeeSetting?.value || '0.0');
      const rawBankWire = wdBankWireSetting?.value || wdIntlFeeSetting?.value;
      const withdrawalBankWireFeePct = rawBankWire ? parseFloat(rawBankWire) : 5.0;
      const withdrawalIntlFeePct = withdrawalBankWireFeePct;
      const withdrawalDomFeePct = parseFloat(wdDomFeeSetting?.value || '5.0');
      const withdrawalCryptoFeePct = parseFloat(wdCryptoFeeSetting?.value || '1.0');
      const withdrawalMinAmt = parseFloat(wdMinAmtSetting?.value || '10.0');
      const withdrawalFxSpreadPct = parseFloat(wdSpreadSetting?.value || '0.0');
      const withdrawalTrc20Enabled = String(wdTrc20Setting?.value || 'false').toLowerCase() === 'true';
      const rawExchangeSpread = parseFloat(exchangeSpreadSetting?.value || '1.0');
      const exchangeSpreadPercent = Number.isFinite(rawExchangeSpread) && rawExchangeSpread >= 0 ? rawExchangeSpread : 1.0;

      res.json({
        success: true,
        base: data.base,
        timestamp: data.timestamp,
        source: data.source,
        lastUpdated: data.lastUpdated,
        marginPercent,
        feePercent,
        showRemittanceSpreadControls,
        exchangeSpreadPercent,
        swapGovernance: swapRiskCfg
          ? {
              swapsEnabled: swapRiskCfg.swapsEnabled,
              disabledPairs: swapRiskCfg.disabledPairs,
              maxPerTxUsd: swapRiskCfg.maxPerTxUsd,
              approvalThresholdUsd: swapRiskCfg.approvalThresholdUsd,
              requireApprovalForCryptoSells: swapRiskCfg.requireApprovalForCryptoSells,
              disabledAssets: Object.entries(swapRiskCfg.perAssetConfig || {})
                .filter(([, v]) => !v.enabled)
                .map(([k]) => k),
            }
          : null,
        exchangePairs: activePairs.map((p) => ({
          baseCurrency: p.baseCurrency,
          quoteCurrency: p.quoteCurrency,
          buyMarginPct: Number(p.buyMarginPct),
          sellMarginPct: Number(p.sellMarginPct),
        })),
        rates: data.rates,
        marketRates: data.marketRates,
        overrides: data.overrides,
        otcCommission,
        withdrawalConfig: {
          feePct: Number.isFinite(withdrawalFeePct) && withdrawalFeePct >= 0 ? withdrawalFeePct : 0,
          bankWireFeePct: Number.isFinite(withdrawalBankWireFeePct) && withdrawalBankWireFeePct >= 0 ? withdrawalBankWireFeePct : 5.0,
          internationalFeePct: Number.isFinite(withdrawalIntlFeePct) && withdrawalIntlFeePct >= 0 ? withdrawalIntlFeePct : 5.0,
          domesticFeePct: Number.isFinite(withdrawalDomFeePct) && withdrawalDomFeePct >= 0 ? withdrawalDomFeePct : 5.0,
          cryptoFeePct: Number.isFinite(withdrawalCryptoFeePct) && withdrawalCryptoFeePct >= 0 ? withdrawalCryptoFeePct : 1.0,
          fxSpreadPct: Number.isFinite(withdrawalFxSpreadPct) && withdrawalFxSpreadPct >= 0 ? withdrawalFxSpreadPct : 0,
          minAmountUsd: Number.isFinite(withdrawalMinAmt) && withdrawalMinAmt >= 0 ? withdrawalMinAmt : 10.0,
          trc20Enabled: withdrawalTrc20Enabled,
        },
      });
    } catch (err) {
      next(err);
    }
  }

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
        operatorDisplayName,
        country,
        countryCode,
        city,
        locationAddress,
        landmark,
        googleMapsUrl,
        latitude,
        longitude,
        supportedCurrencies,
        settlementMethods,
        buyRateMarginPct,
        sellRateMarginPct,
        customRates,
      } = req.body;

      if (
        !deskName ||
        !country ||
        !countryCode ||
        !city ||
        !locationAddress ||
        !String(locationAddress).trim() ||
        !supportedCurrencies ||
        !settlementMethods
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Desk name, country, country code, city, physical location address, supported currencies, and settlement methods are required.',
        });
      }

      const desk = await otcService.applyOtcDesk(userId, {
        deskName,
        operatorDisplayName,
        country,
        countryCode,
        city,
        locationAddress,
        landmark,
        googleMapsUrl,
        latitude,
        longitude,
        supportedCurrencies,
        settlementMethods,
        buyRateMarginPct,
        sellRateMarginPct,
        customRates,
      });

      res.status(201).json({
        success: true,
        message:
          'OTC Desk application submitted for Admin review! Your $1,000 security deposit is held safely in escrow and your desk will go live once approved by Admin.',
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
   * POST /api/v1/otc/trades/:id/mark-paid
   * Mark fiat payment completed by buyer or operator
   */
  async markPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const { note } = req.body || {};
      const trade = await otcService.markPaid(tradeId, userId, note);
      res.json({
        success: true,
        message: 'Payment marked as completed! Operator notified to verify and release escrow.',
        data: trade,
      });
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

  /**
   * GET /api/v1/otc/my-trades
   * List authenticated user's OTC trades
   */
  async getMyTrades(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const trades = await otcService.getMyTrades(userId);
      res.json({ success: true, data: trades });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/trades/:id/dispute
   * Raise a dispute on an active OTC trade
   */
  async disputeTrade(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const { reason } = req.body || {};
      const trade = await otcService.disputeTrade(tradeId, userId, reason);
      res.json({
        success: true,
        message: 'Trade escalated to Avora Compliance dispute resolution.',
        data: trade,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/trades/:id/cancel
   * Cancel an IN_PROGRESS OTC trade and return escrow to seller
   */
  async cancelTrade(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const { reason } = req.body || {};
      const trade = await otcService.cancelTrade(tradeId, userId, reason);
      res.json({
        success: true,
        message: 'Trade cancelled and escrowed USDT unlocked back to seller.',
        data: trade,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/desks/:deskId/inquire
   */
  async createInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).user?.id || (req as any).user?.userId;
      const deskId = Array.isArray(req.params.deskId) ? req.params.deskId[0] : String(req.params.deskId);
      const { subject, message } = req.body || {};
      const data = await otcService.createOrMessageDeskInquiry(customerId, deskId, { subject, message });
      res.status(201).json({
        success: true,
        message: 'Your inquiry has been delivered to the OTC desk operator and notification queue.',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/otc/inquiries
   */
  async getMyInquiries(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const data = await otcService.getMyInquiries(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/otc/inquiries/:id
   */
  async getInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const inquiryId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const data = await otcService.getInquiry(inquiryId, userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/otc/inquiries/:id/messages
   */
  async sendInquiryMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const inquiryId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const { message } = req.body || {};
      const data = await otcService.postInquiryMessage(inquiryId, userId, message);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const otcController = new OtcController();
