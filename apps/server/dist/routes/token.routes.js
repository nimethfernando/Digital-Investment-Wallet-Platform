"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const token_controller_1 = require("../controllers/token.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Public: Token specifications & roadmap
router.get('/info', (req, res, next) => token_controller_1.tokenController.getInfo(req, res, next));
// Protected: Testnet wallet & Early-access / Funded Allocation Purchase & Redemption
router.use(auth_1.authenticateToken);
router.get('/my-status', (req, res, next) => token_controller_1.tokenController.getMyStatus(req, res, next));
router.post('/faucet/claim', featureControl_service_1.featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => token_controller_1.tokenController.claimFaucet(req, res, next));
router.post('/purchase', rate_limiter_1.p2pActionLimiter, featureControl_service_1.featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => token_controller_1.tokenController.purchaseTokens(req, res, next));
router.post('/redeem', rate_limiter_1.p2pActionLimiter, featureControl_service_1.featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => token_controller_1.tokenController.redeemTokens(req, res, next));
router.post('/early-access/register', featureControl_service_1.featureControlService.requireFeature('AVR_TOKEN_SALE'), (req, res, next) => token_controller_1.tokenController.registerEarlyAccess(req, res, next));
exports.default = router;
