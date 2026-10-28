import { Router } from 'express';
import { tokenController } from '../controllers/token.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public: Token specifications & roadmap
router.get('/info', (req, res) => tokenController.getInfo(req, res));

// Protected: Testnet wallet & Early-access
router.use(authenticateToken);
router.get('/my-status', (req, res, next) => tokenController.getMyStatus(req, res, next));
router.post('/faucet/claim', (req, res, next) => tokenController.claimFaucet(req, res, next));
router.post('/early-access/register', (req, res, next) => tokenController.registerEarlyAccess(req, res, next));

export default router;
