import { Router } from 'express';
import { gmtController } from '../controllers/gmt.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public: Countries & Quote Calculation
router.get('/countries', (req, res) => gmtController.getCountries(req, res));
router.post('/quote', (req, res, next) => gmtController.calculateQuote(req, res, next));

// Protected: Authenticated Customer Routes
router.use(authenticateToken);

router.post('/transfers', (req, res, next) => gmtController.createTransfer(req, res, next));
router.get('/transfers', (req, res, next) => gmtController.listUserTransfers(req, res, next));
router.get('/transfers/:code', (req, res, next) => gmtController.getTransfer(req, res, next));

// Admin routes
router.get('/admin/transfers', (req, res, next) => gmtController.listAllTransfersAdmin(req, res, next));
router.patch('/admin/transfers/:id', (req, res, next) => gmtController.updateTransferStatusAdmin(req, res, next));

export default router;
