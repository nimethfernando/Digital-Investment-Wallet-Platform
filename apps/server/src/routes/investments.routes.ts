import { Router } from 'express';
import { investmentsController } from '../controllers/investments.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public: Marketplace directory, campaign details, fee calculation
router.get('/campaigns', (req, res, next) => investmentsController.listCampaigns(req, res, next));
router.get('/campaigns/:slug', (req, res, next) => investmentsController.getCampaign(req, res, next));
router.post('/fee-quote', (req, res, next) => investmentsController.calculateFee(req, res, next));

// Protected: Investor & Founder routes
router.use(authenticateToken);
router.post('/invest', (req, res, next) => investmentsController.invest(req, res, next));
router.post('/apply', (req, res, next) => investmentsController.applyForFunding(req, res, next));
router.post('/watchlist/toggle', (req, res, next) => investmentsController.toggleWatchlist(req, res, next));
router.post('/inquiries', (req, res, next) => investmentsController.submitInquiry(req, res, next));
router.get('/dashboard', (req, res, next) => investmentsController.getDashboard(req, res, next));

export default router;
