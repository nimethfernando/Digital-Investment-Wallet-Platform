"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const investments_controller_1 = require("../controllers/investments.controller");
const auth_1 = require("../middleware/auth");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Public: Marketplace directory, campaign details, fee calculation
router.get('/campaigns', (req, res, next) => investments_controller_1.investmentsController.listCampaigns(req, res, next));
router.get('/campaigns/:slug', (req, res, next) => investments_controller_1.investmentsController.getCampaign(req, res, next));
router.post('/fee-quote', (req, res, next) => investments_controller_1.investmentsController.calculateFee(req, res, next));
// Protected: Investor & Founder routes
router.use(auth_1.authenticateToken);
router.post('/invest', featureControl_service_1.featureControlService.requireFeature('VENTURE_INVESTMENTS'), (req, res, next) => investments_controller_1.investmentsController.invest(req, res, next));
router.post('/apply', featureControl_service_1.featureControlService.requireFeature('VENTURE_INVESTMENTS'), (req, res, next) => investments_controller_1.investmentsController.applyForFunding(req, res, next));
router.post('/watchlist/toggle', (req, res, next) => investments_controller_1.investmentsController.toggleWatchlist(req, res, next));
router.post('/inquiries', (req, res, next) => investments_controller_1.investmentsController.submitInquiry(req, res, next));
router.get('/dashboard', (req, res, next) => investments_controller_1.investmentsController.getDashboard(req, res, next));
exports.default = router;
