import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authService } from '../services/auth.service';
import { kycService } from '../services/kyc.service';
import { compliancePolicyService, KYC_STATUS_LABELS } from '../services/compliancePolicy.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
  displayName: z.string().trim().min(4, 'Unique Display Name / Trader Handle must be at least 4 characters').max(30),
  phone: z.string().max(25, 'Phone number must not exceed 25 characters').optional(),
  country: z.string().max(100).optional(),
  countryCode: z.string().max(10).optional(),
  signupLocation: z.string().max(191).optional(),
  deviceFingerprint: z.string().max(128).optional(),
  captchaToken: z.string().optional(),
  captchaAnswer: z.string().optional(),
  honeypot: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().optional(),
  captchaToken: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || null;
    const result = await authService.register({
      ...data,
      signupIp: clientIp || undefined,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const detectLocation = async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || '';
  const cfCountry = (req.headers['cf-ipcountry'] as string) || null;
  res.json({
    success: true,
    data: {
      ip: clientIp,
      countryCode: cfCountry,
    },
  });
};

export const getCaptcha = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const [policy, challenge] = await Promise.all([
      compliancePolicyService.getPolicy(),
      Promise.resolve(compliancePolicyService.generateCaptchaChallenge()),
    ]);
    res.json({
      success: true,
      captchaToken: challenge.captchaToken,
      svgDataUrl: challenge.svgDataUrl,
      requireOnRegister: policy.captcha.requireOnRegister,
      requireOnForgotPassword: policy.captcha.requireOnForgotPassword,
    });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || undefined;
    const { email, code, token } = req.body || {};
    const result = await authService.verifyEmail({ email, code, token, ipAddress: clientIp });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resendVerification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body?.email || req.user?.email || '').trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    const result = await authService.resendVerificationEmail(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || undefined;
    const result: any = await authService.login({ ...data, ipAddress: clientIp });
    if (result.requiresCaptcha) {
      return res.status(428).json({ success: false, ...result });
    }
    if (result.requiresEmailVerification) {
      return res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', ...result });
    }
    res.json({ success: true, ...result });
  } catch (err: any) {
    if (err?.requiresCaptcha) {
      return res.status(401).json({ success: false, requiresCaptcha: true, message: err.message });
    }
    if (err?.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(email, req.body?.captchaToken, req.body?.captchaAnswer);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.user.userId, oldPassword, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const setup2fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await authService.generate2faSecret(req.user.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const verify2fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Code required' });
    const result = await authService.verifyAndEnable2fa(req.user.userId, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const disable2fa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { password, code } = req.body;
    if (!password || !code) {
      return res.status(400).json({ success: false, message: 'Password and 2FA code are required' });
    }
    const result = await authService.disable2fa(req.user.userId, password, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    await compliancePolicyService.ensureComplianceSchema();
    const [user, policy] = await Promise.all([
      prisma.user.findUnique({
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
      compliancePolicyService.getPolicy(),
    ]);

    const isWithdrawalLocked = !!(user?.withdrawalLockedUntil && new Date() < user.withdrawalLockedUntil);
    const { generateAvoraAccountNumber } = require('../services/p2p.service');
    const accountNumber = user ? generateAvoraAccountNumber(user.id) : null;

    res.json({
      success: true,
      user: {
        ...user,
        kycStatusLabel: user?.kycStatus ? KYC_STATUS_LABELS[user.kycStatus] || user.kycStatus : 'KYC Not Submitted',
        accountNumber,
        isWithdrawalLocked,
        complianceRequirements: {
          kycRequiredFeatures: policy.kycRequiredFeatures,
          requireEmailVerificationForSensitiveActions: policy.emailVerification.requireEmailVerificationForSensitiveActions,
          newUserLimits: policy.newUserLimits,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refreshSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await authService.refreshSession(req.user.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const checkDisplayName = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const raw = String(req.query.displayName || '');
    const result = await authService.checkDisplayNameAvailability(raw);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const updateDisplayName = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const raw = String(req.body?.displayName || '');
    const user = await authService.updateDisplayName(req.user.userId, raw);
    res.json({ success: true, user, message: `Unique trader handle set to @${user.displayName}` });
  } catch (err) {
    next(err);
  }
};

export const updateAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (typeof req.body?.isAvailable !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isAvailable (boolean) is required' });
    }
    const result = await authService.updateAvailability(req.user.userId, req.body.isAvailable);
    res.json({
      success: true,
      ...result,
      message: result.isAvailable
        ? 'Your status is now Online across P2P, OTC, and all services.'
        : 'Your status is now Offline across P2P, OTC, and all services. You will still receive transactions and messages.',
    });
  } catch (err) {
    next(err);
  }
};

export const submitKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const { documentType, documentUrl, idNumber, country, provider, originalFilename } = req.body;
    if (!documentType || !documentUrl) {
      return res.status(400).json({ success: false, message: 'Document type and file/URL are required' });
    }
    const result = await kycService.submitKyc(req.user.userId, {
      documentType,
      documentUrl,
      idNumber,
      country,
      provider,
      originalFilename,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getMyKycDocumentFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const documentId = String(req.params.id || '');
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || undefined;
    const file = await kycService.getSecureDocumentFile({
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
  } catch (err: any) {
    if (err?.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

export const getKycStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await kycService.getKycStatus(req.user.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getSumsubToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const provider = req.body.provider || 'SUMSUB';
    const result = await kycService.generateProviderToken(req.user.userId, provider);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const resetKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await kycService.resetKyc(req.user.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const instantVerifyKyc = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await kycService.instantVerifyKyc(req.user.userId, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};


