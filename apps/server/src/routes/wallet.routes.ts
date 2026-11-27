import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { authenticateToken } from '../middleware/auth';
import { withdrawalRateLimiter } from '../middleware/rate-limiter';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Public BaaS / Visa Issuer Real-Time Authorization Webhook (Stripe Issuing / Interlace)
router.post('/card/webhook/authorize', (req, res) => walletController.authorizeCardWebhook(req, res));

// Public Razorpay Webhook (Isolated for AVORA_BANK; safely ignores Avora Library events on shared merchant account)
router.post('/razorpay/webhook', (req, res) => walletController.handleRazorpayWebhook(req, res));

router.use(authenticateToken);

router.get('/', (req, res, next) => walletController.getWalletOverview(req, res, next));
router.get('/portfolio', (req, res, next) => walletController.getWalletOverview(req, res, next));
router.get('/earnings', (req, res, next) => walletController.getUserEarnings(req, res, next));
router.get('/notifications', (req, res, next) => walletController.getNotifications(req, res, next));
router.post('/notifications/read', (req, res, next) => walletController.markNotificationsRead(req, res, next));
router.get('/transactions', (req, res, next) => walletController.getTransactions(req, res, next));
router.get('/deposit/instructions', (req, res, next) => walletController.getDepositInstructions(req, res, next));
router.post(
  '/deposit/crypto-session',
  featureControlService.requireFeature('DEPOSITS', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.currency || 'USDT');
    await featureControlService.assertNetworkEnabled('USDT_BEP20');
  }),
  (req, res, next) => walletController.createCryptoDepositSession(req, res, next)
);
router.get('/deposit/session/:id', (req, res, next) => walletController.getCryptoDepositSessionStatus(req, res, next));
router.post('/deposit/session/:id/verify-tx', (req, res, next) => walletController.verifyCryptoDepositTransaction(req, res, next));
router.post(
  '/deposit',
  featureControlService.requireFeature('DEPOSITS', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControlService.assertGatewayEnabled(req.body?.depositMethod);
    await featureControlService.assertNetworkEnabled(req.body?.depositMethod);
  }),
  (req, res, next) => walletController.submitDeposit(req, res, next)
);
router.get('/deposits', (req, res, next) => walletController.getDeposits(req, res, next));
router.post(
  '/razorpay/create-order',
  featureControlService.requireFeature('GATEWAY_RAZORPAY', async (req) => {
    if (String(req.body?.purpose || '').toUpperCase().includes('CRYPTO')) {
      await featureControlService.assertFeatureEnabled('BUY_CRYPTO_ONRAMP');
      const checkoutFiat = req.body?.checkoutCurrency || req.body?.currency;
      if (checkoutFiat) {
        await featureControlService.assertBuyCryptoCurrencyEnabled(checkoutFiat);
      }
    } else {
      await featureControlService.assertFeatureEnabled('DEPOSITS');
    }
    await featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControlService.assertCurrencyEnabled(req.body?.checkoutCurrency);
  }),
  (req, res, next) => walletController.createRazorpayOrder(req, res, next)
);
router.post('/razorpay/verify', (req, res, next) => walletController.verifyRazorpayPayment(req, res, next));

router.post(
  '/swap',
  featureControlService.requireFeature('INSTANT_SWAP', async (req) => {
    await featureControlService.assertTradingPairEnabled(req.body?.fromCurrency, req.body?.toCurrency);
  }),
  (req, res, next) => walletController.executeSwap(req, res, next)
);

// Virtual Card Endpoints
router.get('/card', (req, res, next) => walletController.getCard(req, res, next));
router.post(
  '/card/reveal-session',
  featureControlService.requireFeature('VIRTUAL_CARDS'),
  (req, res, next) => walletController.createCardRevealSession(req, res, next)
);
router.post(
  '/card/freeze',
  featureControlService.requireFeature('VIRTUAL_CARDS'),
  (req, res, next) => walletController.toggleCardFreeze(req, res, next)
);
router.post(
  '/card/limits',
  featureControlService.requireFeature('VIRTUAL_CARDS'),
  (req, res, next) => walletController.updateCardLimits(req, res, next)
);
router.post(
  '/card/settings',
  featureControlService.requireFeature('VIRTUAL_CARDS'),
  (req, res, next) => walletController.updateCardSettings(req, res, next)
);
router.get('/card/transactions', (req, res, next) => walletController.getCardTransactions(req, res, next));

// Withdrawal shortcuts under /wallet
router.post(
  '/withdraw',
  withdrawalRateLimiter,
  featureControlService.requireFeature('WITHDRAWALS', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControlService.assertGatewayEnabled(req.body?.payoutMethod);
    await featureControlService.assertNetworkEnabled(
      req.body?.payoutDetails?.network || req.body?.payoutMethod
    );
  }),
  (req, res, next) => withdrawalController.requestWithdrawal(req, res, next)
);
router.get('/withdrawals', (req, res, next) => withdrawalController.getWithdrawals(req, res, next));

export default router;
