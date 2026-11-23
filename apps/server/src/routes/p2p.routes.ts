import { Router } from 'express';
import { p2pController } from '../controllers/p2p.controller';
import { authenticateToken } from '../middleware/auth';
import { p2pRateLimiter, p2pActionLimiter } from '../middleware/rate-limiter';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

const requireP2PTrading = featureControlService.requireFeature('P2P_TRADING', async (req) => {
  await featureControlService.assertCurrencyEnabled(req.body?.cryptoCurrency);
  const fiat = req.body?.fiatCurrency || req.body?.currency;
  if (fiat) {
    await featureControlService.assertP2pCurrencyEnabled(fiat);
  }
});

/**
 * Public P2P Offers / Market Ads & Trader Profiles (viewable before or after login)
 */
router.get('/corridors', (req, res, next) => p2pController.getCorridors(req, res, next));
router.get('/offers', (req, res, next) => p2pController.getOffers(req, res, next));
router.get('/promotion-tiers', (req, res, next) => p2pController.getPromotionTiers(req, res, next));
router.get('/users/:userId/profile', (req, res, next) => p2pController.getTraderProfile(req, res, next));

router.use(authenticateToken);

/**
 * P2P Onboarding & Compliance Verification Application
 */
router.post('/onboarding/apply', p2pActionLimiter, requireP2PTrading, (req, res, next) => p2pController.submitOnboardingApplication(req, res, next));
router.get('/onboarding/applications', (req, res, next) => p2pController.getMyOnboardingApplications(req, res, next));

/**
 * P2P Offers / Market Ads Management (Authenticated merchants only)
 */
router.get('/my-offers', (req, res, next) => p2pController.getMyOffers(req, res, next));
router.post('/offers', p2pActionLimiter, requireP2PTrading, (req, res, next) => p2pController.createOffer(req, res, next));
router.post('/offers/:offerId/promote', p2pActionLimiter, requireP2PTrading, (req, res, next) => p2pController.promoteOffer(req, res, next));
router.patch('/offers/:offerId', p2pActionLimiter, requireP2PTrading, (req, res, next) => p2pController.updateOffer(req, res, next));
router.delete('/offers/:offerId', p2pActionLimiter, (req, res, next) => p2pController.cancelOffer(req, res, next));

/**
 * Preview recipient details with email masking & self-transfer block
 */
router.post(['/lookup-recipient', '/lookup'], p2pRateLimiter, (req, res, next) =>
  p2pController.lookupRecipient(req, res, next)
);

/**
 * Execute P2P transfer with daily velocity limit ($5,000/24h) and 2FA
 */
router.post(
  '/transfer',
  p2pRateLimiter,
  featureControlService.requireFeature('INTERNAL_P2P_TRANSFER', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.currency);
  }),
  (req, res, next) => p2pController.transferFunds(req, res, next)
);

/**
 * P2P Orders & Escrow
 */
router.post('/orders', p2pActionLimiter, requireP2PTrading, (req, res, next) => p2pController.createOrder(req, res, next));
router.get('/orders', (req, res, next) => p2pController.getUserOrders(req, res, next));
router.get('/earnings', (req, res, next) => p2pController.getUserEarnings(req, res, next));
router.get('/orders/:orderId', (req, res, next) => p2pController.getOrderById(req, res, next));
router.post('/orders/:orderId/accept', p2pActionLimiter, (req, res, next) => p2pController.acceptOrder(req, res, next));
router.post('/orders/:orderId/decline', p2pActionLimiter, (req, res, next) => p2pController.declineOrder(req, res, next));
router.post('/orders/:orderId/paid', p2pActionLimiter, (req, res, next) => p2pController.markPaymentSent(req, res, next));
router.post('/orders/:orderId/release', p2pActionLimiter, (req, res, next) => p2pController.releaseEscrow(req, res, next));
router.post('/orders/:orderId/priority-fulfill', p2pActionLimiter, (req, res, next) => p2pController.fulfillPriorityOrder(req, res, next));
router.post('/orders/:orderId/cancel', p2pActionLimiter, (req, res, next) => p2pController.cancelOrder(req, res, next));
router.post('/orders/:orderId/dispute', p2pActionLimiter, (req, res, next) => p2pController.disputeOrder(req, res, next));
router.post('/orders/:orderId/review', p2pActionLimiter, (req, res, next) => p2pController.submitOrderReview(req, res, next));

/**
 * In-Order Live Chat
 */
router.get('/orders/:orderId/messages', (req, res, next) => p2pController.getOrderMessages(req, res, next));
router.post('/orders/:orderId/messages', p2pActionLimiter, (req, res, next) => p2pController.sendOrderMessage(req, res, next));

/**
 * User P2P Conversations Hub
 */
router.get('/chats', (req, res, next) => p2pController.getUserChats(req, res, next));

/**
 * P2P $50 Merchant Security Deposit Lifecycle
 */
router.get('/merchant/status', (req, res, next) => p2pController.getMerchantStatus(req, res, next));
router.post('/merchant/deposit', (req, res, next) => p2pController.applyMerchant(req, res, next));
router.post('/merchant/refund', (req, res, next) => p2pController.refundMerchant(req, res, next));

export default router;
