import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  register,
  login,
  getCaptcha,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  setup2fa,
  verify2fa,
  disable2fa,
  getMe,
  refreshSession,
  checkDisplayName,
  updateDisplayName,
  updateAvailability,
  submitKyc,
  getKycStatus,
  getMyKycDocumentFile,
  getSumsubToken,
  resetKyc,
  instantVerifyKyc,
  detectLocation,
} from '../controllers/auth.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import {
  authRateLimiter,
  registerRateLimiter,
  verificationRateLimiter,
  publicLookupRateLimiter,
} from '../middleware/rate-limiter';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Public auth routes with strict anti-spam & anti-brute force rate limiting
router.get('/captcha', publicLookupRateLimiter, getCaptcha);
router.get('/detect-location', publicLookupRateLimiter, detectLocation);
router.get('/check-display-name', publicLookupRateLimiter, checkDisplayName);
router.post('/register', registerRateLimiter, featureControlService.requireFeature('USER_REGISTRATION'), register);
router.post('/verify-email', verificationRateLimiter, verifyEmail);
router.post('/resend-verification', verificationRateLimiter, resendVerification);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.post('/refresh', authenticateToken, refreshSession);
router.patch('/display-name', authenticateToken, updateDisplayName);
router.patch('/availability', authenticateToken, updateAvailability);
router.post('/change-password', authenticateToken, authRateLimiter, changePassword);

// Identity Verification (KYC / AML & Private Document Access)
router.post('/kyc/submit', authenticateToken, submitKyc);
router.get('/kyc/status', authenticateToken, getKycStatus);
router.get('/kyc/:id/document', authenticateToken, getMyKycDocumentFile);
router.post('/kyc/sumsub-token', authenticateToken, getSumsubToken);
router.post('/kyc/reset', authenticateToken, resetKyc);
// Admin-only emergency/test override — non-admin users cannot bypass Admin KYC review
router.post('/kyc/instant-verify', authenticateToken, requireRole([Role.ADMIN]), instantVerifyKyc);

// Two-Factor Authentication routes
router.post('/2fa/setup', authenticateToken, authRateLimiter, setup2fa);
router.post('/2fa/generate', authenticateToken, authRateLimiter, setup2fa);
router.post('/2fa/verify', authenticateToken, authRateLimiter, verify2fa);
router.post('/2fa/enable', authenticateToken, authRateLimiter, verify2fa);
router.post('/2fa/disable', authenticateToken, authRateLimiter, disable2fa);

export default router;
