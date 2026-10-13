import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { authenticateToken } from '../middleware/auth';
import { withdrawalRateLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res, next) => walletController.getWalletOverview(req, res, next));
router.get('/transactions', (req, res, next) => walletController.getTransactions(req, res, next));
router.post('/deposit', (req, res, next) => walletController.submitDeposit(req, res, next));
router.get('/deposits', (req, res, next) => walletController.getDeposits(req, res, next));

router.post('/swap', (req, res, next) => walletController.executeSwap(req, res, next));

// Virtual Card Endpoints
router.get('/card', (req, res, next) => walletController.getCard(req, res, next));
router.post('/card/freeze', (req, res, next) => walletController.toggleCardFreeze(req, res, next));
router.post('/card/limits', (req, res, next) => walletController.updateCardLimits(req, res, next));
router.post('/card/settings', (req, res, next) => walletController.updateCardSettings(req, res, next));
router.get('/card/transactions', (req, res, next) => walletController.getCardTransactions(req, res, next));

// Withdrawal shortcuts under /wallet
router.post('/withdraw', withdrawalRateLimiter, (req, res, next) => withdrawalController.requestWithdrawal(req, res, next));
router.get('/withdrawals', (req, res, next) => withdrawalController.getWithdrawals(req, res, next));

export default router;
