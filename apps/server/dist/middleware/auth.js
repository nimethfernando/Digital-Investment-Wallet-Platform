"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin2FA = exports.requireStaffOrAdmin = exports.requireAdmin = exports.requireRole = exports.optionalAuthenticateToken = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const authenticateToken = async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        res.status(401).json({ success: false, message: 'Authentication required. Please sign in to access this resource.' });
        return;
    }
    let payload;
    try {
        try {
            payload = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        }
        catch {
            payload = jsonwebtoken_1.default.verify(token, config_1.config.adminJwtSecret);
        }
    }
    catch {
        res.status(403).json({ success: false, message: 'Invalid or expired access token' });
        return;
    }
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, role: true, status: true, mustChangePassword: true, twoFactorEnabled: true }
        });
        if (!user || user.status !== 'ACTIVE') {
            res.status(403).json({ success: false, message: 'User account is inactive or not found' });
            return;
        }
        req.user = {
            id: user.id,
            userId: user.id,
            email: user.email,
            role: user.role,
            mustChangePassword: user.mustChangePassword,
            twoFactorEnabled: user.twoFactorEnabled,
        };
        next();
    }
    catch (err) {
        console.error('[AuthMiddleware] Transient database error during user lookup:', err);
        res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please retry.' });
        return;
    }
};
exports.authenticateToken = authenticateToken;
const optionalAuthenticateToken = async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        next();
        return;
    }
    try {
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, config_1.config.jwtSecret);
        }
        catch {
            payload = jsonwebtoken_1.default.verify(token, config_1.config.adminJwtSecret);
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, role: true, status: true, mustChangePassword: true, twoFactorEnabled: true },
        });
        if (user && user.status === 'ACTIVE') {
            req.user = {
                id: user.id,
                userId: user.id,
                email: user.email,
                role: user.role,
                mustChangePassword: user.mustChangePassword,
                twoFactorEnabled: user.twoFactorEnabled,
            };
        }
    }
    catch {
        // Proceed as unauthenticated guest
    }
    next();
};
exports.optionalAuthenticateToken = optionalAuthenticateToken;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
exports.requireAdmin = (0, exports.requireRole)([client_1.Role.ADMIN]);
exports.requireStaffOrAdmin = (0, exports.requireRole)([client_1.Role.STAFF, client_1.Role.ADMIN]);
const requireAdmin2FA = async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    // If 2FA is enabled on this admin/staff account, verify TOTP code cryptographically
    if (req.user.twoFactorEnabled) {
        const providedCode = req.headers['x-admin-2fa'] ||
            req.headers['x-2fa-code'] ||
            req.body?.admin2FaCode ||
            req.body?.twoFactorCode;
        if (!providedCode || !String(providedCode).trim()) {
            res.status(403).json({
                success: false,
                code: '2FA_CODE_REQUIRED',
                message: 'Admin Two-Factor Authentication (2FA) code is required for this privileged operation.',
            });
            return;
        }
        try {
            const { authService } = await Promise.resolve().then(() => __importStar(require('../services/auth.service')));
            await authService.verify2faForUser(req.user.id || req.user.userId, String(providedCode).trim());
        }
        catch (err) {
            res.status(403).json({
                success: false,
                code: 'INVALID_2FA_CODE',
                message: err?.message || 'Invalid Two-Factor Authentication (2FA) code.',
            });
            return;
        }
    }
    next();
};
exports.requireAdmin2FA = requireAdmin2FA;
