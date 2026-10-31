import { Router } from 'express';
import { p2pController } from '../controllers/p2p.controller';
import { authenticateToken } from '../middleware/auth';
import { p2pRateLimiter } from '../middleware/rate-limiter';

const router = Router();

/**
 * Public P2P Offers / Market Ads (viewable before or after login)
 */
router.get('/offers', (req, res, next) => p2pController.getOffers(req, res, next));

router.use(authenticateToken);

/**
 * Preview recipient details with email masking & self-transfer block
 */
router.post(['/lookup-recipient', '/lookup'], p2pRateLimiter, (req, res, next) =>
  p2pController.lookupRecipient(req, res, next)
);

/**
 * Execute P2P transfer with daily velocity limit ($5,000/24h) and 2FA
 */
router.post('/transfer', p2pRateLimiter, (req, res, next) =>
  p2pController.transferFunds(req, res, next)
);

/**
 * P2P Orders & Escrow
 */
router.post('/orders', (req, res, next) => p2pController.createOrder(req, res, next));
router.get('/orders', (req, res, next) => p2pController.getUserOrders(req, res, next));
router.get('/orders/:orderId', (req, res, next) => p2pController.getOrderById(req, res, next));
router.post('/orders/:orderId/paid', (req, res, next) => p2pController.markPaymentSent(req, res, next));
router.post('/orders/:orderId/release', (req, res, next) => p2pController.releaseEscrow(req, res, next));
router.post('/orders/:orderId/dispute', (req, res, next) => p2pController.disputeOrder(req, res, next));

/**
 * In-Order Live Chat
 */
router.get('/orders/:orderId/messages', (req, res, next) => p2pController.getOrderMessages(req, res, next));
router.post('/orders/:orderId/messages', (req, res, next) => p2pController.sendOrderMessage(req, res, next));

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
