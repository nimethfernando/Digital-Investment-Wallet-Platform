"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin2FA = exports.requireStaffOrAdmin = exports.requireAdmin = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
        res.status(401).json({ success: false, message: 'Access token required' });
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
        res.status(403).json({ success: false, message: 'Invalid or expired access token' });
        return;
    }
};
exports.authenticateToken = authenticateToken;
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
const requireAdmin2FA = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    // If 2FA is enabled on this admin/staff account, verify 2FA code is provided
    if (req.user.twoFactorEnabled) {
        const providedCode = req.headers['x-admin-2fa'] ||
            req.headers['x-2fa-code'] ||
            req.body?.admin2FaCode ||
            req.body?.twoFactorCode;
        if (!providedCode) {
            res.status(403).json({
                success: false,
                code: '2FA_CODE_REQUIRED',
                message: 'Admin Two-Factor Authentication (2FA) code is required for this privileged operation.',
            });
            return;
        }
    }
    next();
};
exports.requireAdmin2FA = requireAdmin2FA;
