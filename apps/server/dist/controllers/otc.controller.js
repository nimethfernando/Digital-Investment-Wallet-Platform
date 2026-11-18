"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.otcController = exports.OtcController = void 0;
const otc_service_1 = require("../services/otc.service");
const rate_service_1 = require("../services/rate.service");
const prisma_1 = require("../lib/prisma");
class OtcController {
    /**
     * GET /api/v1/otc/rates
     * Real-time benchmark exchange rates from original live market source with admin margin
     */
    async getRates(req, res, next) {
        try {
            const [data, marginSetting, feeSetting, otcCommission, wdFeeSetting, wdSpreadSetting] = await Promise.all([
                rate_service_1.rateService.getLiveRates(),
                prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'remittance_margin_percent' } }).catch(() => null),
                prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'remittance_fee_percent' } }).catch(() => null),
                otc_service_1.otcService.getOtcCommissionConfig(),
                prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_fee_percent' } }).catch(() => null),
                prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'withdrawal_fx_spread_percent' } }).catch(() => null),
            ]);
            const marginPercent = parseFloat(marginSetting?.value || '2.0');
            const feePercent = parseFloat(feeSetting?.value || '3.0');
            const withdrawalFeePct = parseFloat(wdFeeSetting?.value || '0.0');
            const withdrawalFxSpreadPct = parseFloat(wdSpreadSetting?.value || '0.0');
            res.json({
                success: true,
                base: data.base,
                timestamp: data.timestamp,
                source: data.source,
                lastUpdated: data.lastUpdated,
                marginPercent,
                feePercent,
                rates: data.rates,
                marketRates: data.marketRates,
                overrides: data.overrides,
                otcCommission,
                withdrawalConfig: {
                    feePct: Number.isFinite(withdrawalFeePct) && withdrawalFeePct >= 0 ? withdrawalFeePct : 0,
                    fxSpreadPct: Number.isFinite(withdrawalFxSpreadPct) && withdrawalFxSpreadPct >= 0 ? withdrawalFxSpreadPct : 0,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/otc/desks
     * Location-based OTC desk discovery
     */
    async listDesks(req, res, next) {
        try {
            const countryCode = req.query.countryCode;
            const city = req.query.city;
            const currency = req.query.currency;
            const isOnline = req.query.isOnline === 'true' ? true : req.query.isOnline === 'false' ? false : undefined;
            const desks = await otc_service_1.otcService.listDesks({ countryCode, city, currency, isOnline });
            res.json({ success: true, data: desks });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/apply
     * Apply to operate an OTC Desk ($1,000 security deposit)
     */
    async applyOtcDesk(req, res, next) {
        try {
            const userId = req.user.id;
            const { deskName, operatorDisplayName, country, countryCode, city, locationAddress, landmark, googleMapsUrl, latitude, longitude, supportedCurrencies, settlementMethods, buyRateMarginPct, sellRateMarginPct, customRates, } = req.body;
            if (!deskName ||
                !country ||
                !countryCode ||
                !city ||
                !locationAddress ||
                !String(locationAddress).trim() ||
                !supportedCurrencies ||
                !settlementMethods) {
                return res.status(400).json({
                    success: false,
                    message: 'Desk name, country, country code, city, physical location address, supported currencies, and settlement methods are required.',
                });
            }
            const desk = await otc_service_1.otcService.applyOtcDesk(userId, {
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
                message: 'OTC Desk application submitted for Admin review! Your $1,000 security deposit is held safely in escrow and your desk will go live once approved by Admin.',
                data: desk,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/deposit/refund
     * Request refund of $1,000 security deposit and close desk
     */
    async refundOtcDeposit(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await otc_service_1.otcService.refundOtcDeposit(userId);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/otc/my-desk
     * View authenticated operator's desk
     */
    async getMyDesk(req, res, next) {
        try {
            const userId = req.user.id;
            const desk = await otc_service_1.otcService.getMyDesk(userId);
            res.json({ success: true, data: desk });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PATCH /api/v1/otc/my-desk
     * Update operator desk status and rate margins
     */
    async updateMyDesk(req, res, next) {
        try {
            const userId = req.user.id;
            const updated = await otc_service_1.otcService.updateMyDesk(userId, req.body);
            res.json({ success: true, message: 'OTC Desk settings updated successfully', data: updated });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/quote
     * Request an exchange quote (1.0% operator fee, 0.5% platform fee)
     */
    async requestQuote(req, res, next) {
        try {
            const customerId = req.user.id;
            const { deskId, tradeType, cryptoAmount, fiatCurrency } = req.body;
            if (!deskId || !tradeType || !cryptoAmount || !fiatCurrency) {
                return res.status(400).json({
                    success: false,
                    message: 'deskId, tradeType (BUY_USDT/SELL_USDT), cryptoAmount, and fiatCurrency are required.',
                });
            }
            const quote = await otc_service_1.otcService.requestQuote(customerId, {
                deskId,
                tradeType,
                cryptoAmount,
                fiatCurrency,
            });
            res.json({ success: true, data: quote });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/trades/accept-quote
     * Accept quote and lock crypto escrow
     */
    async acceptQuote(req, res, next) {
        try {
            const customerId = req.user.id;
            const { quoteId } = req.body;
            if (!quoteId) {
                return res.status(400).json({ success: false, message: 'quoteId is required.' });
            }
            const trade = await otc_service_1.otcService.acceptQuoteAndStartTrade(customerId, quoteId);
            res.status(201).json({
                success: true,
                message: 'Quote accepted! Escrow has been secured by Avora Bank.',
                data: trade,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/otc/trades/:id
     * Get trade details with chat history
     */
    async getTrade(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const trade = await otc_service_1.otcService.getTrade(tradeId, userId);
            res.json({ success: true, data: trade });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/trades/:id/messages
     * Send live message in trade chat
     */
    async sendMessage(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { message } = req.body;
            if (!message || !message.trim()) {
                return res.status(400).json({ success: false, message: 'Message text is required.' });
            }
            const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const chatMsg = await otc_service_1.otcService.postMessage(tradeId, userId, message);
            res.status(201).json({ success: true, data: chatMsg });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/trades/:id/release
     * Release escrow and disburse commissions (1.0% operator, 0.5% platform)
     */
    async releaseEscrow(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const trade = await otc_service_1.otcService.releaseEscrow(tradeId, userId);
            res.json({
                success: true,
                message: 'Escrow released successfully! Funds and operator commission distributed.',
                data: trade,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/otc/my-trades
     * List authenticated user's OTC trades
     */
    async getMyTrades(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const trades = await otc_service_1.otcService.getMyTrades(userId);
            res.json({ success: true, data: trades });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/trades/:id/dispute
     * Raise a dispute on an active OTC trade
     */
    async disputeTrade(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const { reason } = req.body || {};
            const trade = await otc_service_1.otcService.disputeTrade(tradeId, userId, reason);
            res.json({
                success: true,
                message: 'Trade escalated to Avora Compliance dispute resolution.',
                data: trade,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/trades/:id/cancel
     * Cancel an IN_PROGRESS OTC trade and return escrow to seller
     */
    async cancelTrade(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const tradeId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const { reason } = req.body || {};
            const trade = await otc_service_1.otcService.cancelTrade(tradeId, userId, reason);
            res.json({
                success: true,
                message: 'Trade cancelled and escrowed USDT unlocked back to seller.',
                data: trade,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/desks/:deskId/inquire
     */
    async createInquiry(req, res, next) {
        try {
            const customerId = req.user?.id || req.user?.userId;
            const deskId = Array.isArray(req.params.deskId) ? req.params.deskId[0] : String(req.params.deskId);
            const { subject, message } = req.body || {};
            const data = await otc_service_1.otcService.createOrMessageDeskInquiry(customerId, deskId, { subject, message });
            res.status(201).json({
                success: true,
                message: 'Your inquiry has been delivered to the OTC desk operator and notification queue.',
                data,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/otc/inquiries
     */
    async getMyInquiries(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const data = await otc_service_1.otcService.getMyInquiries(userId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/otc/inquiries/:id
     */
    async getInquiry(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const inquiryId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const data = await otc_service_1.otcService.getInquiry(inquiryId, userId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/otc/inquiries/:id/messages
     */
    async sendInquiryMessage(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const inquiryId = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const { message } = req.body || {};
            const data = await otc_service_1.otcService.postInquiryMessage(inquiryId, userId, message);
            res.status(201).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.OtcController = OtcController;
exports.otcController = new OtcController();
