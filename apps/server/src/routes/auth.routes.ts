import { Router } from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  setup2fa,
  verify2fa,
  disable2fa,
  getMe,
  submitKyc,
  getKycStatus,
  getSumsubToken,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rate-limiter';

const router = Router();

// Public auth routes with strict anti-brute force rate limiting (10 attempts / 15 min)
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.post('/change-password', authenticateToken, authRateLimiter, changePassword);

// Identity Verification (KYC / AML & Sumsub/Onfido SDK integration)
router.post('/kyc/submit', authenticateToken, submitKyc);
router.get('/kyc/status', authenticateToken, getKycStatus);
router.post('/kyc/sumsub-token', authenticateToken, getSumsubToken);

// Two-Factor Authentication routes
router.post('/2fa/setup', authenticateToken, authRateLimiter, setup2fa);
router.post('/2fa/generate', authenticateToken, authRateLimiter, setup2fa);
router.post('/2fa/verify', authenticateToken, authRateLimiter, verify2fa);
router.post('/2fa/enable', authenticateToken, authRateLimiter, verify2fa);
router.post('/2fa/disable', authenticateToken, authRateLimiter, disable2fa);

export default router;
