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
    if ((req.user.role === client_1.Role.ADMIN || req.user.role === client_1.Role.STAFF) && !req.user.twoFactorEnabled) {
        res.status(403).json({
            success: false,
            code: '2FA_MANDATORY_FOR_ADMIN',
            message: 'Mandatory Two-Factor Authentication (2FA) is required for Admin and Staff accounts. Please enable 2FA on your account.',
        });
        return;
    }
    next();
};
exports.requireAdmin2FA = requireAdmin2FA;
