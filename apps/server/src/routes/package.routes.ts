import { Router } from 'express';
import { packageController } from '../controllers/package.controller';
import { authenticateToken } from '../middleware/auth';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// All package rules, tiers, and investor endpoints require authentication
router.use(authenticateToken);

router.get('/tiers', (req, res, next) => packageController.getTiers(req, res, next));
router.get('/', (req, res, next) => packageController.getUserPackages(req, res, next));
router.post(
  '/purchase',
  featureControlService.requireFeature('FD_PACKAGES', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControlService.assertGatewayEnabled(req.body?.depositMethod);
  }),
  (req, res, next) => packageController.purchase(req, res, next)
);

export default router;
