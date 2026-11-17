import { Router } from 'express';
import { tokenController } from '../controllers/token.controller';
import { authenticateToken } from '../middleware/auth';
import { p2pActionLimiter } from '../middleware/rate-limiter';

const router = Router();

// Public: Token specifications & roadmap
router.get('/info', (req, res) => tokenController.getInfo(req, res));

// Protected: Testnet wallet & Early-access / Funded Allocation Purchase
router.use(authenticateToken);
router.get('/my-status', (req, res, next) => tokenController.getMyStatus(req, res, next));
router.post('/faucet/claim', (req, res, next) => tokenController.claimFaucet(req, res, next));
router.post('/purchase', p2pActionLimiter, (req, res, next) => tokenController.purchaseTokens(req, res, next));
router.post('/early-access/register', (req, res, next) => tokenController.registerEarlyAccess(req, res, next));

export default router;

