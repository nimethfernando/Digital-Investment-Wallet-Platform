"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const p2p_controller_1 = require("../controllers/p2p.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
/**
 * Preview recipient details with email masking & self-transfer block
 */
router.post('/lookup-recipient', rate_limiter_1.p2pRateLimiter, (req, res, next) => p2p_controller_1.p2pController.lookupRecipient(req, res, next));
/**
 * Execute P2P transfer with daily velocity limit ($5,000/24h) and 2FA
 */
router.post('/transfer', rate_limiter_1.p2pRateLimiter, (req, res, next) => p2p_controller_1.p2pController.transferFunds(req, res, next));
exports.default = router;
