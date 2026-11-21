import { Router } from 'express';
import { investmentsController } from '../controllers/investments.controller';
import { ventureMatchmakingController } from '../controllers/ventureMatchmaking.controller';
import { authenticateToken } from '../middleware/auth';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Public: Marketplace directory, campaign details, fee calculation
router.get('/campaigns', (req, res, next) => investmentsController.listCampaigns(req, res, next));
router.get('/campaigns/:slug', (req, res, next) => investmentsController.getCampaign(req, res, next));
router.post('/fee-quote', (req, res, next) => investmentsController.calculateFee(req, res, next));

// Public / Directory: Browse Capital & Dealflow Matchmaking Opportunities
router.get('/dealflow/opportunities', (req, res, next) =>
  ventureMatchmakingController.listOpportunities(req, res, next)
);
router.get('/dealflow/opportunities/:id', (req, res, next) =>
  ventureMatchmakingController.getOpportunity(req, res, next)
);

// Protected: Investor & Founder routes
router.use(authenticateToken);
router.post(
  '/invest',
  featureControlService.requireFeature('VENTURE_INVESTMENTS'),
  (req, res, next) => investmentsController.invest(req, res, next)
);
router.post(
  '/apply',
  featureControlService.requireFeature('VENTURE_INVESTMENTS'),
  (req, res, next) => investmentsController.applyForFunding(req, res, next)
);
router.post('/watchlist/toggle', (req, res, next) => investmentsController.toggleWatchlist(req, res, next));
router.post('/inquiries', (req, res, next) => investmentsController.submitInquiry(req, res, next));
router.get('/dashboard', (req, res, next) => investmentsController.getDashboard(req, res, next));

// Protected: Dealflow Opportunity Post & Application Lifecycle
router.post('/dealflow/opportunities', (req, res, next) =>
  ventureMatchmakingController.createOpportunity(req, res, next)
);
router.post('/dealflow/opportunities/:id/apply', (req, res, next) =>
  ventureMatchmakingController.applyToOpportunity(req, res, next)
);
router.get('/dealflow/my-posts', (req, res, next) =>
  ventureMatchmakingController.getMyOpportunities(req, res, next)
);
router.get('/dealflow/my-applications', (req, res, next) =>
  ventureMatchmakingController.getMyApplications(req, res, next)
);

export default router;

