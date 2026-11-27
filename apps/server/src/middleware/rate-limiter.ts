import rateLimit from 'express-rate-limit';

/**
 * Strict Rate Limiter for Login / Password Reset / 2FA endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 12, // 12 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
  },
});

/**
 * Dedicated Anti-Spam Rate Limiter for New Account Registration
 */
export const registerRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 6, // Max 6 registration attempts per IP per 30 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts from this IP address. Please wait 30 minutes before trying again.',
  },
});

/**
 * Rate Limiter for Email Verification & Resend requests
 */
export const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait before requesting another code.',
  },
});

/**
 * Anti-Enumeration Rate Limiter for Public Registration Helpers
 */
export const publicLookupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please slow down briefly.',
  },
});

/**
 * Rate Limiter for Withdrawal & Sensitive Financial Submissions
 */
export const withdrawalRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Withdrawal request frequency limit reached. Please wait before submitting another request.',
  },
});

/**
 * Rate Limiter for P2P Transfers & Recipient Lookups
 */
export const p2pRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'P2P transfer rate limit reached. Please slow down and try again in a few minutes.',
  },
});

/**
 * Anti-spam Rate Limiter for P2P Marketplace Orders, Ads & Chat Actions
 */
export const p2pActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many P2P marketplace actions. Please slow down briefly before retrying.',
  },
});

/**
 * General Public API Rate Limiter
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again shortly.',
  },
});
