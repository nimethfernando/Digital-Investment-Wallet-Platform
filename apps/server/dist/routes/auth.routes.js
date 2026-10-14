"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const router = (0, express_1.Router)();
// Public auth routes with strict anti-brute force rate limiting (10 attempts / 15 min)
router.post('/register', rate_limiter_1.authRateLimiter, auth_controller_1.register);
router.post('/login', rate_limiter_1.authRateLimiter, auth_controller_1.login);
router.post('/forgot-password', rate_limiter_1.authRateLimiter, auth_controller_1.forgotPassword);
router.post('/reset-password', rate_limiter_1.authRateLimiter, auth_controller_1.resetPassword);
// Protected routes
router.get('/me', auth_1.authenticateToken, auth_controller_1.getMe);
router.post('/change-password', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.changePassword);
// Identity Verification (KYC / AML & Sumsub/Onfido SDK integration)
router.post('/kyc/submit', auth_1.authenticateToken, auth_controller_1.submitKyc);
router.get('/kyc/status', auth_1.authenticateToken, auth_controller_1.getKycStatus);
router.post('/kyc/sumsub-token', auth_1.authenticateToken, auth_controller_1.getSumsubToken);
// Two-Factor Authentication routes
router.post('/2fa/setup', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.setup2fa);
router.post('/2fa/generate', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.setup2fa);
router.post('/2fa/verify', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.verify2fa);
router.post('/2fa/enable', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.verify2fa);
router.post('/2fa/disable', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.disable2fa);
exports.default = router;
