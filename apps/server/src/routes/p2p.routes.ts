import { Router } from 'express';
import { p2pController } from '../controllers/p2p.controller';
import { authenticateToken } from '../middleware/auth';
import { p2pRateLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(authenticateToken);

/**
 * Preview recipient details with email masking & self-transfer block
 */
router.post('/lookup-recipient', p2pRateLimiter, (req, res, next) =>
  p2pController.lookupRecipient(req, res, next)
);

/**
 * Execute P2P transfer with daily velocity limit ($5,000/24h) and 2FA
 */
router.post('/transfer', p2pRateLimiter, (req, res, next) =>
  p2pController.transferFunds(req, res, next)
);

export default router;
