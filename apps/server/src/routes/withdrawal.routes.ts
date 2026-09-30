import { Router } from 'express';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { authenticateToken } from '../middleware/auth';
import { withdrawalRateLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(authenticateToken);

/**
 * Submit withdrawal request
 * Protected by withdrawalRateLimiter (10 per hour per IP)
 */
router.post('/', withdrawalRateLimiter, (req, res, next) =>
  withdrawalController.requestWithdrawal(req, res, next)
);

/**
 * View user's withdrawal requests
 */
router.get('/', (req, res, next) =>
  withdrawalController.getWithdrawals(req, res, next)
);

export default router;
