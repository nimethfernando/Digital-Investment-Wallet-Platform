"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const otc_controller_1 = require("../controllers/otc.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public: Location-based OTC desk discovery and Live Benchmark Rates
router.get('/desks', (req, res, next) => otc_controller_1.otcController.listDesks(req, res, next));
router.get('/rates', (req, res, next) => otc_controller_1.otcController.getRates(req, res, next));
// Protected: Authenticated operator and customer routes
router.use(auth_1.authenticateToken);
// Desk Operator Management
router.post('/apply', (req, res, next) => otc_controller_1.otcController.applyOtcDesk(req, res, next));
router.post('/deposit/refund', (req, res, next) => otc_controller_1.otcController.refundOtcDeposit(req, res, next));
router.get('/my-desk', (req, res, next) => otc_controller_1.otcController.getMyDesk(req, res, next));
router.patch('/my-desk', (req, res, next) => otc_controller_1.otcController.updateMyDesk(req, res, next));
// Quote & Trade Lifecycle
router.get('/my-trades', (req, res, next) => otc_controller_1.otcController.getMyTrades(req, res, next));
router.post('/quote', (req, res, next) => otc_controller_1.otcController.requestQuote(req, res, next));
router.post('/trades/accept-quote', (req, res, next) => otc_controller_1.otcController.acceptQuote(req, res, next));
router.get('/trades/:id', (req, res, next) => otc_controller_1.otcController.getTrade(req, res, next));
router.post('/trades/:id/messages', (req, res, next) => otc_controller_1.otcController.sendMessage(req, res, next));
router.post('/trades/:id/release', (req, res, next) => otc_controller_1.otcController.releaseEscrow(req, res, next));
router.post('/trades/:id/dispute', (req, res, next) => otc_controller_1.otcController.disputeTrade(req, res, next));
router.post('/trades/:id/cancel', (req, res, next) => otc_controller_1.otcController.cancelTrade(req, res, next));
exports.default = router;
