"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const package_controller_1 = require("../controllers/package.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public endpoint to view package rules/tiers
router.get('/tiers', (req, res, next) => package_controller_1.packageController.getTiers(req, res, next));
// Authenticated investor endpoints
router.get('/', auth_1.authenticateToken, (req, res, next) => package_controller_1.packageController.getUserPackages(req, res, next));
router.post('/purchase', auth_1.authenticateToken, (req, res, next) => package_controller_1.packageController.purchase(req, res, next));
exports.default = router;
