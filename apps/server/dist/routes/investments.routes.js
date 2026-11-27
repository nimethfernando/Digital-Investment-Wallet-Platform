"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const investments_controller_1 = require("../controllers/investments.controller");
const ventureMatchmaking_controller_1 = require("../controllers/ventureMatchmaking.controller");
const auth_1 = require("../middleware/auth");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Protected: All marketplace campaigns, dealflow opportunities, fee calculation, investor & founder routes require authentication
router.use(auth_1.authenticateToken);
router.get('/campaigns', (req, res, next) => investments_controller_1.investmentsController.listCampaigns(req, res, next));
router.get('/campaigns/:slug', (req, res, next) => investments_controller_1.investmentsController.getCampaign(req, res, next));
router.post('/fee-quote', (req, res, next) => investments_controller_1.investmentsController.calculateFee(req, res, next));
// Browse Capital & Dealflow Matchmaking Opportunities
router.get('/dealflow/opportunities', (req, res, next) => ventureMatchmaking_controller_1.ventureMatchmakingController.listOpportunities(req, res, next));
router.get('/dealflow/opportunities/:id', (req, res, next) => ventureMatchmaking_controller_1.ventureMatchmakingController.getOpportunity(req, res, next));
router.post('/invest', featureControl_service_1.featureControlService.requireFeature('VENTURE_INVESTMENTS'), (req, res, next) => investments_controller_1.investmentsController.invest(req, res, next));
router.post('/apply', featureControl_service_1.featureControlService.requireFeature('VENTURE_INVESTMENTS'), (req, res, next) => investments_controller_1.investmentsController.applyForFunding(req, res, next));
router.post('/watchlist/toggle', (req, res, next) => investments_controller_1.investmentsController.toggleWatchlist(req, res, next));
router.post('/inquiries', (req, res, next) => investments_controller_1.investmentsController.submitInquiry(req, res, next));
router.get('/dashboard', (req, res, next) => investments_controller_1.investmentsController.getDashboard(req, res, next));
// Protected: Dealflow Opportunity Post & Application Lifecycle
router.post('/dealflow/opportunities', (req, res, next) => ventureMatchmaking_controller_1.ventureMatchmakingController.createOpportunity(req, res, next));
router.post('/dealflow/opportunities/:id/apply', (req, res, next) => ventureMatchmaking_controller_1.ventureMatchmakingController.applyToOpportunity(req, res, next));
router.get('/dealflow/my-posts', (req, res, next) => ventureMatchmaking_controller_1.ventureMatchmakingController.getMyOpportunities(req, res, next));
router.get('/dealflow/my-applications', (req, res, next) => ventureMatchmaking_controller_1.ventureMatchmakingController.getMyApplications(req, res, next));
exports.default = router;
