"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const gmt_controller_1 = require("../controllers/gmt.controller");
const auth_1 = require("../middleware/auth");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Public: Countries, Quote Calculation & Live Transfer Tracking (For recipients & senders with tracking code)
router.get('/countries', (req, res) => gmt_controller_1.gmtController.getCountries(req, res));
router.post('/quote', (req, res, next) => gmt_controller_1.gmtController.calculateQuote(req, res, next));
router.get('/track/:code', (req, res, next) => gmt_controller_1.gmtController.trackTransferPublic(req, res, next));
// Protected: Authenticated Customer Routes
router.use(auth_1.authenticateToken);
router.post('/transfers', featureControl_service_1.featureControlService.requireFeature('REMITTANCE', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.sourceCurrency || req.body?.sendCurrency);
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.targetCurrency || req.body?.receiveCurrency);
    await featureControl_service_1.featureControlService.assertGatewayEnabled(req.body?.payoutMethod);
}), (req, res, next) => gmt_controller_1.gmtController.createTransfer(req, res, next));
router.get('/transfers', (req, res, next) => gmt_controller_1.gmtController.listUserTransfers(req, res, next));
router.get('/transfers/:code', (req, res, next) => gmt_controller_1.gmtController.getTransfer(req, res, next));
// Admin routes
router.get('/admin/transfers', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => gmt_controller_1.gmtController.listAllTransfersAdmin(req, res, next));
router.patch('/admin/transfers/:id', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => gmt_controller_1.gmtController.updateTransferStatusAdmin(req, res, next));
exports.default = router;
