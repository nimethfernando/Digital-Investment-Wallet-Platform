"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const withdrawal_controller_1 = require("../controllers/withdrawal.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
/**
 * Submit withdrawal request
 * Protected by withdrawalRateLimiter (10 per hour per IP)
 */
router.post('/', rate_limiter_1.withdrawalRateLimiter, (req, res, next) => withdrawal_controller_1.withdrawalController.requestWithdrawal(req, res, next));
/**
 * View user's withdrawal requests
 */
router.get('/', (req, res, next) => withdrawal_controller_1.withdrawalController.getWithdrawals(req, res, next));
exports.default = router;
