"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Public auth routes with strict anti-spam & anti-brute force rate limiting
router.get('/captcha', rate_limiter_1.publicLookupRateLimiter, auth_controller_1.getCaptcha);
router.get('/detect-location', rate_limiter_1.publicLookupRateLimiter, auth_controller_1.detectLocation);
router.get('/check-display-name', rate_limiter_1.publicLookupRateLimiter, auth_controller_1.checkDisplayName);
router.post('/register', rate_limiter_1.registerRateLimiter, featureControl_service_1.featureControlService.requireFeature('USER_REGISTRATION'), auth_controller_1.register);
router.post('/verify-email', rate_limiter_1.verificationRateLimiter, auth_controller_1.verifyEmail);
router.post('/resend-verification', rate_limiter_1.verificationRateLimiter, auth_controller_1.resendVerification);
router.post('/login', rate_limiter_1.authRateLimiter, auth_controller_1.login);
router.post('/forgot-password', rate_limiter_1.authRateLimiter, auth_controller_1.forgotPassword);
router.post('/reset-password', rate_limiter_1.authRateLimiter, auth_controller_1.resetPassword);
// Protected routes
router.get('/me', auth_1.authenticateToken, auth_controller_1.getMe);
router.post('/refresh', auth_1.authenticateToken, auth_controller_1.refreshSession);
router.patch('/display-name', auth_1.authenticateToken, auth_controller_1.updateDisplayName);
router.patch('/availability', auth_1.authenticateToken, auth_controller_1.updateAvailability);
router.post('/change-password', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.changePassword);
// Identity Verification (KYC / AML & Private Document Access)
router.post('/kyc/submit', auth_1.authenticateToken, auth_controller_1.submitKyc);
router.get('/kyc/status', auth_1.authenticateToken, auth_controller_1.getKycStatus);
router.get('/kyc/:id/document', auth_1.authenticateToken, auth_controller_1.getMyKycDocumentFile);
router.post('/kyc/sumsub-token', auth_1.authenticateToken, auth_controller_1.getSumsubToken);
router.post('/kyc/reset', auth_1.authenticateToken, auth_controller_1.resetKyc);
// Admin-only emergency/test override — non-admin users cannot bypass Admin KYC review
router.post('/kyc/instant-verify', auth_1.authenticateToken, (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_controller_1.instantVerifyKyc);
// Two-Factor Authentication routes
router.post('/2fa/setup', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.setup2fa);
router.post('/2fa/generate', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.setup2fa);
router.post('/2fa/verify', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.verify2fa);
router.post('/2fa/enable', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.verify2fa);
router.post('/2fa/disable', auth_1.authenticateToken, rate_limiter_1.authRateLimiter, auth_controller_1.disable2fa);
exports.default = router;
