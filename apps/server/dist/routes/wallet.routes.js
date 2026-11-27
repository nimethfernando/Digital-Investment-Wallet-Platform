"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const withdrawal_controller_1 = require("../controllers/withdrawal.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Public BaaS / Visa Issuer Real-Time Authorization Webhook (Stripe Issuing / Interlace)
router.post('/card/webhook/authorize', (req, res) => wallet_controller_1.walletController.authorizeCardWebhook(req, res));
// Public Razorpay Webhook (Isolated for AVORA_BANK; safely ignores Avora Library events on shared merchant account)
router.post('/razorpay/webhook', (req, res) => wallet_controller_1.walletController.handleRazorpayWebhook(req, res));
router.use(auth_1.authenticateToken);
router.get('/', (req, res, next) => wallet_controller_1.walletController.getWalletOverview(req, res, next));
router.get('/portfolio', (req, res, next) => wallet_controller_1.walletController.getWalletOverview(req, res, next));
router.get('/earnings', (req, res, next) => wallet_controller_1.walletController.getUserEarnings(req, res, next));
router.get('/notifications', (req, res, next) => wallet_controller_1.walletController.getNotifications(req, res, next));
router.post('/notifications/read', (req, res, next) => wallet_controller_1.walletController.markNotificationsRead(req, res, next));
router.get('/transactions', (req, res, next) => wallet_controller_1.walletController.getTransactions(req, res, next));
router.get('/deposit/instructions', (req, res, next) => wallet_controller_1.walletController.getDepositInstructions(req, res, next));
router.post('/deposit/crypto-session', featureControl_service_1.featureControlService.requireFeature('DEPOSITS', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.currency || 'USDT');
    await featureControl_service_1.featureControlService.assertNetworkEnabled('USDT_BEP20');
}), (req, res, next) => wallet_controller_1.walletController.createCryptoDepositSession(req, res, next));
router.get('/deposit/session/:id', (req, res, next) => wallet_controller_1.walletController.getCryptoDepositSessionStatus(req, res, next));
router.post('/deposit/session/:id/verify-tx', (req, res, next) => wallet_controller_1.walletController.verifyCryptoDepositTransaction(req, res, next));
router.post('/deposit', featureControl_service_1.featureControlService.requireFeature('DEPOSITS', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControl_service_1.featureControlService.assertGatewayEnabled(req.body?.depositMethod);
    await featureControl_service_1.featureControlService.assertNetworkEnabled(req.body?.depositMethod);
}), (req, res, next) => wallet_controller_1.walletController.submitDeposit(req, res, next));
router.get('/deposits', (req, res, next) => wallet_controller_1.walletController.getDeposits(req, res, next));
router.post('/razorpay/create-order', featureControl_service_1.featureControlService.requireFeature('GATEWAY_RAZORPAY', async (req) => {
    if (String(req.body?.purpose || '').toUpperCase().includes('CRYPTO')) {
        await featureControl_service_1.featureControlService.assertFeatureEnabled('BUY_CRYPTO_ONRAMP');
        const checkoutFiat = req.body?.checkoutCurrency || req.body?.currency;
        if (checkoutFiat) {
            await featureControl_service_1.featureControlService.assertBuyCryptoCurrencyEnabled(checkoutFiat);
        }
    }
    else {
        await featureControl_service_1.featureControlService.assertFeatureEnabled('DEPOSITS');
    }
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.checkoutCurrency);
}), (req, res, next) => wallet_controller_1.walletController.createRazorpayOrder(req, res, next));
router.post('/razorpay/verify', (req, res, next) => wallet_controller_1.walletController.verifyRazorpayPayment(req, res, next));
router.post('/swap', featureControl_service_1.featureControlService.requireFeature('INSTANT_SWAP', async (req) => {
    await featureControl_service_1.featureControlService.assertTradingPairEnabled(req.body?.fromCurrency, req.body?.toCurrency);
}), (req, res, next) => wallet_controller_1.walletController.executeSwap(req, res, next));
// Virtual Card Endpoints
router.get('/card', (req, res, next) => wallet_controller_1.walletController.getCard(req, res, next));
router.post('/card/reveal-session', featureControl_service_1.featureControlService.requireFeature('VIRTUAL_CARDS'), (req, res, next) => wallet_controller_1.walletController.createCardRevealSession(req, res, next));
router.post('/card/freeze', featureControl_service_1.featureControlService.requireFeature('VIRTUAL_CARDS'), (req, res, next) => wallet_controller_1.walletController.toggleCardFreeze(req, res, next));
router.post('/card/limits', featureControl_service_1.featureControlService.requireFeature('VIRTUAL_CARDS'), (req, res, next) => wallet_controller_1.walletController.updateCardLimits(req, res, next));
router.post('/card/settings', featureControl_service_1.featureControlService.requireFeature('VIRTUAL_CARDS'), (req, res, next) => wallet_controller_1.walletController.updateCardSettings(req, res, next));
router.get('/card/transactions', (req, res, next) => wallet_controller_1.walletController.getCardTransactions(req, res, next));
// Withdrawal shortcuts under /wallet
router.post('/withdraw', rate_limiter_1.withdrawalRateLimiter, featureControl_service_1.featureControlService.requireFeature('WITHDRAWALS', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControl_service_1.featureControlService.assertGatewayEnabled(req.body?.payoutMethod);
    await featureControl_service_1.featureControlService.assertNetworkEnabled(req.body?.payoutDetails?.network || req.body?.payoutMethod);
}), (req, res, next) => withdrawal_controller_1.withdrawalController.requestWithdrawal(req, res, next));
router.get('/withdrawals', (req, res, next) => withdrawal_controller_1.withdrawalController.getWithdrawals(req, res, next));
exports.default = router;
