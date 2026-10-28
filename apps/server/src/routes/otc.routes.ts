import { Router } from 'express';
import { otcController } from '../controllers/otc.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public: Location-based OTC desk discovery
router.get('/desks', (req, res, next) => otcController.listDesks(req, res, next));

// Protected: Authenticated operator and customer routes
router.use(authenticateToken);

// Desk Operator Management
router.post('/apply', (req, res, next) => otcController.applyOtcDesk(req, res, next));
router.post('/deposit/refund', (req, res, next) => otcController.refundOtcDeposit(req, res, next));
router.get('/my-desk', (req, res, next) => otcController.getMyDesk(req, res, next));
router.patch('/my-desk', (req, res, next) => otcController.updateMyDesk(req, res, next));

// Quote & Trade Lifecycle
router.post('/quote', (req, res, next) => otcController.requestQuote(req, res, next));
router.post('/trades/accept-quote', (req, res, next) => otcController.acceptQuote(req, res, next));
router.get('/trades/:id', (req, res, next) => otcController.getTrade(req, res, next));
router.post('/trades/:id/messages', (req, res, next) => otcController.sendMessage(req, res, next));
router.post('/trades/:id/release', (req, res, next) => otcController.releaseEscrow(req, res, next));

export default router;
