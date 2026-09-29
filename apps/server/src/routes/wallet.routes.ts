import { Router } from 'express';
import { walletController } from '../controllers/wallet.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', (req, res, next) => walletController.getWalletOverview(req, res, next));
router.get('/transactions', (req, res, next) => walletController.getTransactions(req, res, next));
router.post('/deposit', (req, res, next) => walletController.submitDeposit(req, res, next));
router.get('/deposits', (req, res, next) => walletController.getDeposits(req, res, next));

export default router;
