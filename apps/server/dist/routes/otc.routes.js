"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const otc_controller_1 = require("../controllers/otc.controller");
const auth_1 = require("../middleware/auth");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
const requireOtcDesk = featureControl_service_1.featureControlService.requireFeature('OTC_DESK', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.cryptoCurrency);
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.fiatCurrency);
});
// Public: Location-based OTC desk discovery, Corridors, and Live Benchmark Rates
router.get('/corridors', (req, res, next) => otc_controller_1.otcController.getCorridors(req, res, next));
router.get('/desks', (req, res, next) => otc_controller_1.otcController.listDesks(req, res, next));
router.get('/rates', (req, res, next) => otc_controller_1.otcController.getRates(req, res, next));
// Protected: Authenticated operator and customer routes
router.use(auth_1.authenticateToken);
// Desk Operator Management
router.post('/apply', requireOtcDesk, (req, res, next) => otc_controller_1.otcController.applyOtcDesk(req, res, next));
router.post('/deposit/refund', (req, res, next) => otc_controller_1.otcController.refundOtcDeposit(req, res, next));
router.get('/my-desk', (req, res, next) => otc_controller_1.otcController.getMyDesk(req, res, next));
router.patch('/my-desk', requireOtcDesk, (req, res, next) => otc_controller_1.otcController.updateMyDesk(req, res, next));
// Quote & Trade Lifecycle
router.get('/my-trades', (req, res, next) => otc_controller_1.otcController.getMyTrades(req, res, next));
router.post('/quote', requireOtcDesk, (req, res, next) => otc_controller_1.otcController.requestQuote(req, res, next));
router.post('/trades/accept-quote', requireOtcDesk, (req, res, next) => otc_controller_1.otcController.acceptQuote(req, res, next));
router.get('/trades/:id', (req, res, next) => otc_controller_1.otcController.getTrade(req, res, next));
router.post('/trades/:id/messages', (req, res, next) => otc_controller_1.otcController.sendMessage(req, res, next));
router.post('/trades/:id/mark-paid', (req, res, next) => otc_controller_1.otcController.markPaid(req, res, next));
router.post('/trades/:id/release', (req, res, next) => otc_controller_1.otcController.releaseEscrow(req, res, next));
router.post('/trades/:id/complete', (req, res, next) => otc_controller_1.otcController.releaseEscrow(req, res, next));
router.post('/trades/:id/dispute', (req, res, next) => otc_controller_1.otcController.disputeTrade(req, res, next));
router.post('/trades/:id/cancel', (req, res, next) => otc_controller_1.otcController.cancelTrade(req, res, next));
// Pre-Trade OTC Desk Inquiries (Ask availability / currency before escrow)
router.post('/desks/:deskId/inquire', requireOtcDesk, (req, res, next) => otc_controller_1.otcController.createInquiry(req, res, next));
router.get('/inquiries', (req, res, next) => otc_controller_1.otcController.getMyInquiries(req, res, next));
router.get('/inquiries/:id', (req, res, next) => otc_controller_1.otcController.getInquiry(req, res, next));
router.post('/inquiries/:id/messages', (req, res, next) => otc_controller_1.otcController.sendInquiryMessage(req, res, next));
exports.default = router;
