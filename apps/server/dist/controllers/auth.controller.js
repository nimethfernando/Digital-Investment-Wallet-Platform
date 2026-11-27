"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instantVerifyKyc = exports.resetKyc = exports.getSumsubToken = exports.getKycStatus = exports.getMyKycDocumentFile = exports.submitKyc = exports.updateAvailability = exports.updateDisplayName = exports.checkDisplayName = exports.refreshSession = exports.getMe = exports.disable2fa = exports.verify2fa = exports.setup2fa = exports.changePassword = exports.resetPassword = exports.forgotPassword = exports.login = exports.resendVerification = exports.verifyEmail = exports.getCaptcha = exports.detectLocation = exports.register = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const auth_service_1 = require("../services/auth.service");
const kyc_service_1 = require("../services/kyc.service");
const compliancePolicy_service_1 = require("../services/compliancePolicy.service");
const registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    firstName: zod_1.z.string().trim().min(2, 'First name must be at least 2 characters'),
    lastName: zod_1.z.string().trim().min(2, 'Last name must be at least 2 characters'),
    displayName: zod_1.z.string().trim().min(4, 'Unique Display Name / Trader Handle must be at least 4 characters').max(30),
    phone: zod_1.z.string().max(25, 'Phone number must not exceed 25 characters').optional(),
    country: zod_1.z.string().max(100).optional(),
    countryCode: zod_1.z.string().max(10).optional(),
    signupLocation: zod_1.z.string().max(191).optional(),
    deviceFingerprint: zod_1.z.string().max(128).optional(),
    captchaToken: zod_1.z.string().optional(),
    captchaAnswer: zod_1.z.string().optional(),
    honeypot: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1, 'Password is required'),
    twoFactorCode: zod_1.z.string().optional(),
    captchaToken: zod_1.z.string().optional(),
    captchaAnswer: zod_1.z.string().optional(),
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
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || null;
        const result = await auth_service_1.authService.register({
            ...data,
            signupIp: clientIp || undefined,
        });
        res.status(201).json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.register = register;
const detectLocation = async (req, res) => {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
    const cfCountry = req.headers['cf-ipcountry'] || null;
    res.json({
        success: true,
        data: {
            ip: clientIp,
            countryCode: cfCountry,
        },
    });
};
exports.detectLocation = detectLocation;
const getCaptcha = async (_req, res, next) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const [policy, challenge] = await Promise.all([
            compliancePolicy_service_1.compliancePolicyService.getPolicy(),
            Promise.resolve(compliancePolicy_service_1.compliancePolicyService.generateCaptchaChallenge()),
        ]);
        res.json({
            success: true,
            captchaToken: challenge.captchaToken,
            svgDataUrl: challenge.svgDataUrl,
            requireOnRegister: policy.captcha.requireOnRegister,
            requireOnForgotPassword: policy.captcha.requireOnForgotPassword,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getCaptcha = getCaptcha;
const verifyEmail = async (req, res, next) => {
    try {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || undefined;
        const { email, code, token } = req.body || {};
        const result = await auth_service_1.authService.verifyEmail({ email, code, token, ipAddress: clientIp });
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.verifyEmail = verifyEmail;
const resendVerification = async (req, res, next) => {
    try {
        const email = String(req.body?.email || req.user?.email || '').trim();
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email address is required.' });
        }
        const result = await auth_service_1.authService.resendVerificationEmail(email);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.resendVerification = resendVerification;
const login = async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || undefined;
        const result = await auth_service_1.authService.login({ ...data, ipAddress: clientIp });
        if (result.requiresCaptcha) {
            return res.status(428).json({ success: false, ...result });
        }
        if (result.requiresEmailVerification) {
            return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', ...result });
        }
        res.json({ success: true, ...result });
    }
    catch (err) {
        if (err?.requiresCaptcha) {
            return res.status(401).json({ success: false, requiresCaptcha: true, message: err.message });
        }
        if (err?.statusCode) {
            return res.status(err.statusCode).json({ success: false, message: err.message });
        }
        next(err);
    }
};
exports.login = login;
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);
        const result = await auth_service_1.authService.forgotPassword(email, req.body?.captchaToken, req.body?.captchaAnswer);
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
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const [user, policy] = await Promise.all([
            prisma_1.prisma.user.findUnique({
                where: { id: req.user.userId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    phone: true,
                    country: true,
                    signupLocation: true,
                    role: true,
                    kycStatus: true,
                    kycSubmittedAt: true,
                    kycReviewedAt: true,
                    kycExpiresAt: true,
                    kycNotes: true,
                    emailVerified: true,
                    twoFactorEnabled: true,
                    withdrawalLockedUntil: true,
                    passwordChangedAt: true,
                    isAvailable: true,
                    availabilityUpdatedAt: true,
                    status: true,
                    bypassNewUserLimits: true,
                    createdAt: true,
                },
            }),
            compliancePolicy_service_1.compliancePolicyService.getPolicy(),
        ]);
        const isWithdrawalLocked = !!(user?.withdrawalLockedUntil && new Date() < user.withdrawalLockedUntil);
        const { generateAvoraAccountNumber } = require('../services/p2p.service');
        const accountNumber = user ? generateAvoraAccountNumber(user.id) : null;
        res.json({
            success: true,
            user: {
                ...user,
                kycStatusLabel: user?.kycStatus ? compliancePolicy_service_1.KYC_STATUS_LABELS[user.kycStatus] || user.kycStatus : 'KYC Not Submitted',
                accountNumber,
                isWithdrawalLocked,
                complianceRequirements: {
                    kycRequiredFeatures: policy.kycRequiredFeatures,
                    requireEmailVerificationForSensitiveActions: policy.emailVerification.requireEmailVerificationForSensitiveActions,
                    newUserLimits: policy.newUserLimits,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getMe = getMe;
const refreshSession = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await auth_service_1.authService.refreshSession(req.user.userId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.refreshSession = refreshSession;
const checkDisplayName = async (req, res, next) => {
    try {
        const raw = String(req.query.displayName || '');
        const result = await auth_service_1.authService.checkDisplayNameAvailability(raw);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.checkDisplayName = checkDisplayName;
const updateDisplayName = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const raw = String(req.body?.displayName || '');
        const user = await auth_service_1.authService.updateDisplayName(req.user.userId, raw);
        res.json({ success: true, user, message: `Unique trader handle set to @${user.displayName}` });
    }
    catch (err) {
        next(err);
    }
};
exports.updateDisplayName = updateDisplayName;
const updateAvailability = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (typeof req.body?.isAvailable !== 'boolean') {
            return res.status(400).json({ success: false, message: 'isAvailable (boolean) is required' });
        }
        const result = await auth_service_1.authService.updateAvailability(req.user.userId, req.body.isAvailable);
        res.json({
            success: true,
            ...result,
            message: result.isAvailable
                ? 'Your status is now Online across P2P, OTC, and all services.'
                : 'Your status is now Offline across P2P, OTC, and all services. You will still receive transactions and messages.',
        });
    }
    catch (err) {
        next(err);
    }
};
exports.updateAvailability = updateAvailability;
const submitKyc = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const { documentType, documentUrl, idNumber, country, provider, originalFilename } = req.body;
        if (!documentType || !documentUrl) {
            return res.status(400).json({ success: false, message: 'Document type and file/URL are required' });
        }
        const result = await kyc_service_1.kycService.submitKyc(req.user.userId, {
            documentType,
            documentUrl,
            idNumber,
            country,
            provider,
            originalFilename,
        });
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.submitKyc = submitKyc;
const getMyKycDocumentFile = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const documentId = String(req.params.id || '');
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || undefined;
        const file = await kyc_service_1.kycService.getSecureDocumentFile({
            documentId,
            requesterId: req.user.userId,
            requesterRole: req.user.role,
            requesterIp: clientIp,
        });
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
        res.send(file.buffer);
    }
    catch (err) {
        if (err?.status)
            return res.status(err.status).json({ success: false, message: err.message });
        next(err);
    }
};
exports.getMyKycDocumentFile = getMyKycDocumentFile;
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
const resetKyc = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await kyc_service_1.kycService.resetKyc(req.user.userId);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.resetKyc = resetKyc;
const instantVerifyKyc = async (req, res, next) => {
    try {
        if (!req.user)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const result = await kyc_service_1.kycService.instantVerifyKyc(req.user.userId, req.body);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.instantVerifyKyc = instantVerifyKyc;
