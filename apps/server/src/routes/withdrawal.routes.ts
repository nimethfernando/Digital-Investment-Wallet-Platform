import { Router } from 'express';
import { withdrawalController } from '../controllers/withdrawal.controller';
import { authenticateToken } from '../middleware/auth';
import { withdrawalRateLimiter } from '../middleware/rate-limiter';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

router.use(authenticateToken);

/**
 * Submit withdrawal request
 * Protected by withdrawalRateLimiter (10 per hour per IP) & Feature Control Gate
 */
router.post(
  '/',
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

/**
 * View user's withdrawal requests
 */
router.get('/', (req, res, next) =>
  withdrawalController.getWithdrawals(req, res, next)
);

export default router;
