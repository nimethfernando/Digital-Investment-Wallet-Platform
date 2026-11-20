import { Router } from 'express';
import { Role } from '@prisma/client';
import { gmtController } from '../controllers/gmt.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Public: Countries, Quote Calculation & Live Transfer Tracking (For recipients & senders with tracking code)
router.get('/countries', (req, res) => gmtController.getCountries(req, res));
router.post('/quote', (req, res, next) => gmtController.calculateQuote(req, res, next));
router.get('/track/:code', (req, res, next) => gmtController.trackTransferPublic(req, res, next));

// Protected: Authenticated Customer Routes
router.use(authenticateToken);

router.post(
  '/transfers',
  featureControlService.requireFeature('REMITTANCE', async (req) => {
    await featureControlService.assertCurrencyEnabled(req.body?.sourceCurrency || req.body?.sendCurrency);
    await featureControlService.assertCurrencyEnabled(req.body?.targetCurrency || req.body?.receiveCurrency);
    await featureControlService.assertGatewayEnabled(req.body?.payoutMethod);
  }),
  (req, res, next) => gmtController.createTransfer(req, res, next)
);
router.get('/transfers', (req, res, next) => gmtController.listUserTransfers(req, res, next));
router.get('/transfers/:code', (req, res, next) => gmtController.getTransfer(req, res, next));

// Admin routes
router.get('/admin/transfers', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) => gmtController.listAllTransfersAdmin(req, res, next));
router.patch('/admin/transfers/:id', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) => gmtController.updateTransferStatusAdmin(req, res, next));

export default router;

