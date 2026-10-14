"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSumsubToken = exports.getKycStatus = exports.submitKyc = exports.getMe = exports.disable2fa = exports.verify2fa = exports.setup2fa = exports.changePassword = exports.resetPassword = exports.forgotPassword = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_service_1 = require("../services/auth.service");
const kyc_service_1 = require("../services/kyc.service");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1, 'Password is required'),
    twoFactorCode: zod_1.z.string().optional(),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
const changePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(8, 'New password must be at least 8 characters'),
});
const register = async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);
        const result = await auth_service_1.authService.register(data);
        res.status(201).json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await auth_service_1.authService.login(data);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.login = login;
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);
        const result = await auth_service_1.authService.forgotPassword(email);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = resetPasswordSchema.parse(req.body);
        const result = await auth_service_1.authService.resetPassword(token, newPassword);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.resetPassword = resetPassword;
const changePassword = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
        const result = await auth_service_1.authService.changePassword(req.user.userId, oldPassword, newPassword);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.changePassword = changePassword;
const setup2fa = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await auth_service_1.authService.generate2faSecret(req.user.userId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.setup2fa = setup2fa;
const verify2fa = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { code } = req.body;
        if (!code)
            return res.status(400).json({ success: false, message: 'Code required' });
        const result = await auth_service_1.authService.verifyAndEnable2fa(req.user.userId, code);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.verify2fa = verify2fa;
const disable2fa = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { password, code } = req.body;
        if (!password || !code) {
            return res.status(400).json({ success: false, message: 'Password and 2FA code are required' });
        }
        const result = await auth_service_1.authService.disable2fa(req.user.userId, password, code);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.disable2fa = disable2fa;
const getMe = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                kycStatus: true,
                twoFactorEnabled: true,
                withdrawalLockedUntil: true,
                passwordChangedAt: true,
                status: true,
            },
        });
        const isWithdrawalLocked = !!(user?.withdrawalLockedUntil && new Date() < user.withdrawalLockedUntil);
        const { generateAvoraAccountNumber } = require('../services/p2p.service');
        const accountNumber = user ? generateAvoraAccountNumber(user.id) : null;
        res.json({
            success: true,
            user: {
                ...user,
                accountNumber,
                isWithdrawalLocked,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMe = getMe;
const submitKyc = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { documentType, documentUrl, idNumber, country, provider } = req.body;
        if (!documentType || !documentUrl) {
            return res.status(400).json({ success: false, message: 'Document type and URL are required' });
        }
        const result = await kyc_service_1.kycService.submitKyc(req.user.userId, {
            documentType,
            documentUrl,
            idNumber,
            country,
            provider,
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.submitKyc = submitKyc;
const getKycStatus = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await kyc_service_1.kycService.getKycStatus(req.user.userId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.getKycStatus = getKycStatus;
const getSumsubToken = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const provider = req.body.provider || 'SUMSUB';
        const result = await kyc_service_1.kycService.generateProviderToken(req.user.userId, provider);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
};
exports.getSumsubToken = getSumsubToken;
