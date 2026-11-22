"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const p2p_controller_1 = require("../controllers/p2p.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
const requireP2PTrading = featureControl_service_1.featureControlService.requireFeature('P2P_TRADING', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.cryptoCurrency);
    const fiat = req.body?.fiatCurrency || req.body?.currency;
    if (fiat) {
        await featureControl_service_1.featureControlService.assertP2pCurrencyEnabled(fiat);
    }
});
/**
 * Public P2P Offers / Market Ads & Trader Profiles (viewable before or after login)
 */
router.get('/offers', (req, res, next) => p2p_controller_1.p2pController.getOffers(req, res, next));
router.get('/promotion-tiers', (req, res, next) => p2p_controller_1.p2pController.getPromotionTiers(req, res, next));
router.get('/users/:userId/profile', (req, res, next) => p2p_controller_1.p2pController.getTraderProfile(req, res, next));
router.use(auth_1.authenticateToken);
/**
 * P2P Onboarding & Compliance Verification Application
 */
router.post('/onboarding/apply', rate_limiter_1.p2pActionLimiter, requireP2PTrading, (req, res, next) => p2p_controller_1.p2pController.submitOnboardingApplication(req, res, next));
router.get('/onboarding/applications', (req, res, next) => p2p_controller_1.p2pController.getMyOnboardingApplications(req, res, next));
/**
 * P2P Offers / Market Ads Management (Authenticated merchants only)
 */
router.get('/my-offers', (req, res, next) => p2p_controller_1.p2pController.getMyOffers(req, res, next));
router.post('/offers', rate_limiter_1.p2pActionLimiter, requireP2PTrading, (req, res, next) => p2p_controller_1.p2pController.createOffer(req, res, next));
router.post('/offers/:offerId/promote', rate_limiter_1.p2pActionLimiter, requireP2PTrading, (req, res, next) => p2p_controller_1.p2pController.promoteOffer(req, res, next));
router.patch('/offers/:offerId', rate_limiter_1.p2pActionLimiter, requireP2PTrading, (req, res, next) => p2p_controller_1.p2pController.updateOffer(req, res, next));
router.delete('/offers/:offerId', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.cancelOffer(req, res, next));
/**
 * Preview recipient details with email masking & self-transfer block
 */
router.post(['/lookup-recipient', '/lookup'], rate_limiter_1.p2pRateLimiter, (req, res, next) => p2p_controller_1.p2pController.lookupRecipient(req, res, next));
/**
 * Execute P2P transfer with daily velocity limit ($5,000/24h) and 2FA
 */
router.post('/transfer', rate_limiter_1.p2pRateLimiter, featureControl_service_1.featureControlService.requireFeature('INTERNAL_P2P_TRANSFER', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.currency);
}), (req, res, next) => p2p_controller_1.p2pController.transferFunds(req, res, next));
/**
 * P2P Orders & Escrow
 */
router.post('/orders', rate_limiter_1.p2pActionLimiter, requireP2PTrading, (req, res, next) => p2p_controller_1.p2pController.createOrder(req, res, next));
router.get('/orders', (req, res, next) => p2p_controller_1.p2pController.getUserOrders(req, res, next));
router.get('/orders/:orderId', (req, res, next) => p2p_controller_1.p2pController.getOrderById(req, res, next));
router.post('/orders/:orderId/accept', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.acceptOrder(req, res, next));
router.post('/orders/:orderId/decline', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.declineOrder(req, res, next));
router.post('/orders/:orderId/paid', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.markPaymentSent(req, res, next));
router.post('/orders/:orderId/release', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.releaseEscrow(req, res, next));
router.post('/orders/:orderId/priority-fulfill', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.fulfillPriorityOrder(req, res, next));
router.post('/orders/:orderId/cancel', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.cancelOrder(req, res, next));
router.post('/orders/:orderId/dispute', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.disputeOrder(req, res, next));
router.post('/orders/:orderId/review', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.submitOrderReview(req, res, next));
/**
 * In-Order Live Chat
 */
router.get('/orders/:orderId/messages', (req, res, next) => p2p_controller_1.p2pController.getOrderMessages(req, res, next));
router.post('/orders/:orderId/messages', rate_limiter_1.p2pActionLimiter, (req, res, next) => p2p_controller_1.p2pController.sendOrderMessage(req, res, next));
/**
 * User P2P Conversations Hub
 */
router.get('/chats', (req, res, next) => p2p_controller_1.p2pController.getUserChats(req, res, next));
/**
 * P2P $50 Merchant Security Deposit Lifecycle
 */
router.get('/merchant/status', (req, res, next) => p2p_controller_1.p2pController.getMerchantStatus(req, res, next));
router.post('/merchant/deposit', (req, res, next) => p2p_controller_1.p2pController.applyMerchant(req, res, next));
router.post('/merchant/refund', (req, res, next) => p2p_controller_1.p2pController.refundMerchant(req, res, next));
exports.default = router;
