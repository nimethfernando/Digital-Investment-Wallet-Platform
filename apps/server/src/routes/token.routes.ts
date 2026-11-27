import { Router } from 'express';
import { tokenController } from '../controllers/token.controller';
import { authenticateToken } from '../middleware/auth';
import { p2pActionLimiter } from '../middleware/rate-limiter';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Protected: All token specifications, roadmap, testnet wallet & allocation endpoints require authentication
router.use(authenticateToken);

router.get('/info', (req, res, next) => tokenController.getInfo(req, res, next));
router.get('/my-status', (req, res, next) => tokenController.getMyStatus(req, res, next));
router.post('/faucet/claim', featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => tokenController.claimFaucet(req, res, next));
router.post('/purchase', p2pActionLimiter, featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => tokenController.purchaseTokens(req, res, next));
router.post('/redeem', p2pActionLimiter, featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => tokenController.redeemTokens(req, res, next));
router.post('/early-access/register', featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => tokenController.registerEarlyAccess(req, res, next));

export default router;

