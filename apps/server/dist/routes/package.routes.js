"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const package_controller_1 = require("../controllers/package.controller");
const auth_1 = require("../middleware/auth");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// All package rules, tiers, and investor endpoints require authentication
router.use(auth_1.authenticateToken);
router.get('/tiers', (req, res, next) => package_controller_1.packageController.getTiers(req, res, next));
router.get('/', (req, res, next) => package_controller_1.packageController.getUserPackages(req, res, next));
router.post('/purchase', featureControl_service_1.featureControlService.requireFeature('FD_PACKAGES', async (req) => {
    await featureControl_service_1.featureControlService.assertCurrencyEnabled(req.body?.currency);
    await featureControl_service_1.featureControlService.assertGatewayEnabled(req.body?.depositMethod);
}), (req, res, next) => package_controller_1.packageController.purchase(req, res, next));
exports.default = router;
