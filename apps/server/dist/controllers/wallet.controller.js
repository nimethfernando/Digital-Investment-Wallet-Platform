"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletController = exports.WalletController = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("../services/ledger.service");
const deposit_service_1 = require("../services/deposit.service");
const card_service_1 = require("../services/card.service");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class WalletController {
    /**
     * Get authenticated user's wallet overview
     */
    async getWalletOverview(req, res, next) {
        try {
            const userId = req.user.id;
            const summary = await ledger_service_1.ledgerService.getUserWalletSummary(userId);
            res.json({ success: true, data: summary });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's transaction history with filtering and pagination
     */
    async getTransactions(req, res, next) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const skip = (page - 1) * limit;
            const type = req.query.type;
            const currency = req.query.currency;
            const format = req.query.format;
            const where = { userId };
            if (type)
                where.type = type;
            if (currency)
                where.currency = currency;
            if (req.query.startDate && req.query.endDate) {
                where.createdAt = {
                    gte: new Date(req.query.startDate),
                    lte: new Date(req.query.endDate),
                };
            }
            // If format is CSV, export all matching records
            if (format === 'csv') {
                const txs = await prisma_1.prisma.transaction.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: 5000,
                });
                let csv = 'Transaction Code,Date,Type,Amount,Currency,Status,Balance Before,Balance After,Reference,Notes\n';
                for (const t of txs) {
                    csv += `"${t.transactionCode}","${t.createdAt.toISOString()}","${t.type}","${new decimal_js_1.default(t.amount.toString()).toFixed(2)}","${t.currency}","${t.status}","${new decimal_js_1.default(t.balanceBefore.toString()).toFixed(2)}","${new decimal_js_1.default(t.balanceAfter.toString()).toFixed(2)}","${t.settlementReference || ''}","${(t.notes || '').replace(/"/g, '""')}"\n`;
                }
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
                return res.send(csv);
            }
            const [transactions, total] = await Promise.all([
                prisma_1.prisma.transaction.findMany({
                    where,
                    include: {
                        package: { select: { packageCode: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma_1.prisma.transaction.count({ where }),
            ]);
            res.json({
                success: true,
                data: {
                    transactions: transactions.map((t) => ({
                        id: t.id,
                        transactionCode: t.transactionCode,
                        type: t.type,
                        amount: new decimal_js_1.default(t.amount.toString()).toFixed(2),
                        currency: t.currency,
                        status: t.status,
                        balanceBefore: new decimal_js_1.default(t.balanceBefore.toString()).toFixed(2),
                        balanceAfter: new decimal_js_1.default(t.balanceAfter.toString()).toFixed(2),
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Submit a deposit request
     */
    async submitDeposit(req, res, next) {
        try {
            const userId = req.user.id;
            const { amount, currency, depositMethod, proofUrl, txHashOrRef } = req.body;
            if (!amount || !depositMethod) {
                return res.status(400).json({ success: false, message: 'Amount and deposit method are required' });
            }
            const deposit = await deposit_service_1.depositService.createDeposit(userId, {
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's deposit requests
     */
    async getDeposits(req, res, next) {
        try {
            const userId = req.user.id;
            const deposits = await deposit_service_1.depositService.getUserDeposits(userId);
            res.json({ success: true, data: deposits });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Execute an instant real multi-currency swap between wallet balances
     */
    async executeSwap(req, res, next) {
        try {
            const userId = req.user.id;
            const { fromCurrency, toCurrency, fromAmount } = req.body;
            if (!fromCurrency || !toCurrency || !fromAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'fromCurrency, toCurrency, and fromAmount are required',
                });
            }
            const result = await ledger_service_1.ledgerService.executeCurrencySwap({
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's VirtualCard
     */
    async getCard(req, res, next) {
        try {
            const userId = req.user.id;
            const card = await card_service_1.cardService.getOrCreateCard(userId);
            res.json({ success: true, data: card });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Freeze/Unfreeze card
     */
    async toggleCardFreeze(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await card_service_1.cardService.toggleFreeze(userId);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update card limits
     */
    async updateCardLimits(req, res, next) {
        try {
            const userId = req.user.id;
            const { dailyLimit, monthlyLimit } = req.body;
            const result = await card_service_1.cardService.updateLimits(userId, dailyLimit, monthlyLimit);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update card security settings
     */
    async updateCardSettings(req, res, next) {
        try {
            const userId = req.user.id;
            const result = await card_service_1.cardService.updateSettings(userId, req.body);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get card transaction feed
     */
    async getCardTransactions(req, res, next) {
        try {
            const userId = req.user.id;
            const transactions = await card_service_1.cardService.getCardTransactions(userId);
            res.json({ success: true, data: transactions });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Request a PCI-compliant ephemeral key / iframe reveal token from the Card Issuer
     */
    async createCardRevealSession(req, res, next) {
        try {
            const userId = req.user.id;
            const { nonce } = req.body || {};
            const session = await card_service_1.cardService.createRevealSession(userId, nonce);
            res.json({ success: true, data: session });
        }
        catch (err) {
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
    async authorizeCardWebhook(req, res) {
        try {
            const signatureHeader = req.headers['stripe-signature'] ||
                req.headers['x-webhook-signature'] ||
                req.headers['x-card-webhook-signature'] ||
                '';
            const rawPayload = typeof req.rawBody === 'string'
                ? req.rawBody
                : JSON.stringify(req.body || {});
            if (!card_service_1.cardService.verifyWebhookSignature(rawPayload, signatureHeader)) {
                return res.status(401).json({
                    approved: false,
                    error: 'INVALID_WEBHOOK_SIGNATURE',
                });
            }
            const body = req.body || {};
            const stripeAuth = body?.data?.object;
            const externalCardId = body.external_card_id ||
                body.card_id ||
                stripeAuth?.card?.id ||
                (typeof stripeAuth?.card === 'string' ? stripeAuth.card : '') ||
                '';
            const rawAmount = body.amount !== undefined
                ? body.amount
                : stripeAuth?.amount !== undefined
                    ? Number(stripeAuth.amount) / 100
                    : 0;
            const currency = body.currency ||
                stripeAuth?.currency ||
                'USD';
            const merchantDetails = body.merchant_details || {
                name: stripeAuth?.merchant_data?.name || body.merchant_name || 'Card Merchant',
                category: stripeAuth?.merchant_data?.category || body.merchant_category || 'ONLINE_POS',
                country: stripeAuth?.merchant_data?.country || body.merchant_country,
                mcc: stripeAuth?.merchant_data?.mcc || body.mcc,
            };
            const result = await card_service_1.cardService.handleRealtimeWebhookAuthorization({
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
        }
        catch (err) {
            return res.status(200).json({
                approved: false,
                reject_reason: 'CARD_FROZEN',
            });
        }
    }
}
exports.WalletController = WalletController;
exports.walletController = new WalletController();
