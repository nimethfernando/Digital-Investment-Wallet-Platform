"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalApiLimiter = exports.p2pRateLimiter = exports.withdrawalRateLimiter = exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * Strict Rate Limiter for Authentication endpoints
 * Protects login, registration, password resets, and 2FA verification from brute force attacks.
 */
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
    },
});
/**
 * Rate Limiter for Withdrawal & Sensitive Financial Submissions
 * Prevents rapid-fire automated withdrawal submissions.
 */
exports.withdrawalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 withdrawal submissions per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Withdrawal request frequency limit reached. Please wait before submitting another request.',
    },
});
/**
 * Rate Limiter for P2P Transfers & Recipient Lookups
 * Protects against automated recipient probing / email enumeration and rapid fund draining.
 */
exports.p2pRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'P2P transfer rate limit reached. Please slow down and try again in a few minutes.',
    },
});
/**
 * General Public API Rate Limiter
 */
exports.generalApiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests. Please try again shortly.',
    },
});
