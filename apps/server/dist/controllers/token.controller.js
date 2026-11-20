"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenController = exports.TokenController = void 0;
const token_service_1 = require("../services/token.service");
class TokenController {
    /**
     * GET /api/v1/token/info
     */
    async getInfo(req, res, next) {
        try {
            const data = await token_service_1.tokenService.getTokenInfo();
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/token/my-status
     */
    async getMyStatus(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const data = await token_service_1.tokenService.getUserTokenStatus(userId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/token/faucet/claim
     */
    async claimFaucet(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const result = await token_service_1.tokenService.claimFaucet(userId);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/token/purchase
     * Buy & fund Avora Token ($AVR) allocation directly from user's USD/USDT/USDC wallet balance
     */
    async purchaseTokens(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { amountUsd, currency, notes } = req.body || {};
            const result = await token_service_1.tokenService.purchaseTokens(userId, {
                amountUsd,
                currency,
                notes,
            });
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/token/redeem
     * Redeem unlocked Avora Token ($AVR) back to USD/USDT/USDC spendable wallet balance
     */
    async redeemTokens(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { tokensToRedeem, payoutCurrency, notes } = req.body || {};
            const result = await token_service_1.tokenService.redeemTokens(userId, {
                tokensToRedeem,
                payoutCurrency,
                notes,
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/token/early-access/register
     */
    async registerEarlyAccess(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { requestedAllocationUsd, notes } = req.body;
            const result = await token_service_1.tokenService.registerEarlyAccess(userId, parseFloat(requestedAllocationUsd), notes);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.TokenController = TokenController;
exports.tokenController = new TokenController();
