import { Router } from 'express';
import { packageController } from '../controllers/package.controller';
import { authenticateToken } from '../middleware/auth';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Public endpoint to view package rules/tiers
router.get('/tiers', (req, res, next) => packageController.getTiers(req, res, next));

// Authenticated investor endpoints
router.get('/', authenticateToken, (req, res, next) => packageController.getUserPackages(req, res, next));
router.post(
  '/purchase',
  authenticateToken,
  featureControlService.requireFeature('FD_PACKAGES', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControlService.assertGatewayEnabled(req.body?.depositMethod);
  }),
  (req, res, next) => packageController.purchase(req, res, next)
);

export default router;
