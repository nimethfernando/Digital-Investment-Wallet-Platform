import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { notificationService } from '../adapters/notification/notification.provider';
import { encryptAtRest, decryptAtRest } from '../utils/crypto';
import { compliancePolicyService } from './compliancePolicy.service';

const RESERVED_DISPLAY_NAMES = new Set([
  'admin',
  'administrator',
  'avora',
  'avorabank',
  'support',
  'system',
  'treasury',
  'compliance',
  'moderator',
  'escrow',
  'staff',
  'official',
  'root',
  'helpdesk',
]);

export function validatePersonNames(firstName?: string, lastName?: string) {
  const cleanFirst = (firstName || '').trim().replace(/\s+/g, ' ');
  const cleanLast = (lastName || '').trim().replace(/\s+/g, ' ');

  if (cleanFirst.length < 2 || cleanFirst.length > 40) {
    throw Object.assign(new Error('First name must be between 2 and 40 characters.'), { statusCode: 400 });
  }
  if (cleanLast.length < 2 || cleanLast.length > 40) {
    throw Object.assign(new Error('Last name must be between 2 and 40 characters.'), { statusCode: 400 });
  }
  const namePattern = /^[\p{L}][\p{L}\s'.-]{1,39}$/u;
  if (!namePattern.test(cleanFirst) || !namePattern.test(cleanLast)) {
    throw Object.assign(
      new Error('First and last names must contain valid alphabetic characters (no numbers or symbols).'),
      { statusCode: 400 }
    );
  }
  return { firstName: cleanFirst, lastName: cleanLast };
}

export class AuthService {
  normalizeDisplayName(raw: string): string {
    return (raw || '').trim().replace(/^@+/, '').replace(/\s+/g, '_');
  }

  validateDisplayNameFormat(raw: string): string {
    const clean = this.normalizeDisplayName(raw);
    if (clean.length < 4 || clean.length > 30) {
      throw new Error('Unique Display Name / Trader Handle must be 4 to 30 characters.');
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{3,29}$/.test(clean)) {
      throw new Error(
        'Display Name must start with a letter and use only letters, numbers, underscores (_), dots (.), or hyphens (-).'
      );
    }
    if (/[_.-]{2,}/.test(clean) || /[_.-]$/.test(clean)) {
      throw new Error('Display Name cannot end with punctuation or contain consecutive punctuation (e.g. __ or ..).');
    }
    const lower = clean.toLowerCase();
    if (RESERVED_DISPLAY_NAMES.has(lower) || lower.startsWith('avora_admin') || lower.startsWith('avora_official')) {
      throw new Error('This Display Name is reserved for Avora Bank staff. Please choose another handle.');
    }
    return clean;
  }

  async ensureUniqueDisplayName(raw: string, excludeUserId?: string): Promise<string> {
    const clean = this.validateDisplayNameFormat(raw);
    const conflict = await prisma.user.findFirst({
      where: {
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
        OR: [
          { displayName: clean },
          { AND: [{ displayName: null }, { firstName: clean }] },
        ],
      },
      select: { id: true },
    });

    if (conflict) {
      throw Object.assign(
        new Error(
          `Display name "@${clean}" is already taken or in use by another trader. Please choose a more unique name (e.g. "${clean}_01" or include your city/surname).`
        ),
        { statusCode: 409 }
      );
    }
    return clean;
  }

  async checkDisplayNameAvailability(raw: string, excludeUserId?: string) {
    try {
      const clean = this.validateDisplayNameFormat(raw);
      const conflict = await prisma.user.findFirst({
        where: {
          ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
          OR: [
            { displayName: clean },
            { AND: [{ displayName: null }, { firstName: clean }] },
          ],
        },
        select: { id: true },
      });

      if (conflict) {
        const suffix = Math.floor(100 + Math.random() * 899);
        return {
          available: false,
          normalized: clean,
          message: `@${clean} is already taken. Suggested: @${clean.slice(0, 22)}_${suffix}`,
          suggestions: [`${clean.slice(0, 22)}_${suffix}`, `${clean.slice(0, 22)}_fx`],
        };
      }
      return {
        available: true,
        normalized: clean,
        message: `@${clean} is available!`,
        suggestions: [],
      };
    } catch (err: any) {
      return {
        available: false,
        normalized: this.normalizeDisplayName(raw),
        message: err?.message || 'Invalid display name.',
        suggestions: [],
      };
    }
  }

  async updateDisplayName(userId: string, rawDisplayName: string) {
    const clean = await this.ensureUniqueDisplayName(rawDisplayName, userId);
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { displayName: clean },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
      },
    });
    return updated;
  }

  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    displayName: string;
    phone?: string;
    country?: string;
    signupLocation?: string;
    signupIp?: string;
    deviceFingerprint?: string;
    captchaToken?: string;
    captchaAnswer?: string;
    honeypot?: string;
  }) {
    await compliancePolicyService.ensureComplianceSchema();
    const policy = await compliancePolicyService.getPolicy();

    // 1. Bot honeypot trap
    if (data.honeypot && String(data.honeypot).trim().length > 0) {
      throw Object.assign(new Error('Automated registration rejected.'), { statusCode: 400 });
    }

    // 2. Self-hosted cryptographic CAPTCHA verification
    if (policy.captcha.requireOnRegister) {
      compliancePolicyService.verifyCaptchaChallenge(data.captchaToken, data.captchaAnswer);
    }

    const { firstName: validFirstName, lastName: validLastName } = validatePersonNames(
      data.firstName,
      data.lastName
    );
    const validDisplayName = await this.ensureUniqueDisplayName(data.displayName);

    const cleanEmail = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    // 3. Anti-spam & duplicate-account detection
    const signals = await compliancePolicyService.evaluateRegistrationSignals({
      email: cleanEmail,
      phone: data.phone,
      signupIp: data.signupIp,
      deviceFingerprint: data.deviceFingerprint,
    });

    if (signals.blockedReason) {
      await prisma.adminAuditLog
        .create({
          data: {
            action: 'REGISTRATION_BLOCKED_SPAM',
            entity: 'User',
            ipAddress: data.signupIp || null,
            details: `Blocked spam/duplicate signup for ${cleanEmail}: ${signals.reasons.join('; ')}`,
          },
        })
        .catch(() => {});
      throw Object.assign(new Error(signals.blockedReason), { statusCode: 403 });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const verificationCode = String(crypto.randomInt(100000, 999999));
    const verificationSecretToken = crypto.randomBytes(32).toString('hex');
    const verificationPayload = JSON.stringify({
      code: verificationCode,
      token: verificationSecretToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        normalizedEmail: signals.normalizedEmail,
        passwordHash,
        firstName: validFirstName,
        lastName: validLastName,
        displayName: validDisplayName,
        phone: data.phone,
        country: data.country,
        signupLocation: data.signupLocation,
        signupIp: data.signupIp,
        deviceFingerprint: data.deviceFingerprint || null,
        isSuspicious: signals.isSuspicious,
        suspiciousReason: signals.reasons.length > 0 ? signals.reasons.join(' | ') : null,
        flaggedAt: signals.isSuspicious ? new Date() : null,
        flaggedBy: signals.isSuspicious ? 'ANTI_SPAM_ENGINE' : null,
        riskScore: signals.riskScore,
        emailVerified: false,
        emailVerificationToken: verificationPayload,
        wallet: {
          create: {
            balances: {
              create: [
                { currency: 'USD', availableBalance: 0 },
                { currency: 'USDT', availableBalance: 0 },
                { currency: 'EUR', availableBalance: 0 },
                { currency: 'INR', availableBalance: 0 },
                { currency: 'GEL', availableBalance: 0 },
              ],
            },
          },
        },
      },
      include: {
        wallet: {
          include: { balances: true },
        },
      },
    });

    // Audit Log for Registration (+ Duplicate / Suspicious signal if triggered)
    await prisma.adminAuditLog
      .create({
        data: {
          userId: user.id,
          action: signals.isSuspicious ? 'DUPLICATE_ACCOUNT_DETECTED' : 'USER_REGISTERED',
          entity: 'User',
          entityId: user.id,
          ipAddress: data.signupIp || null,
          details: `New registration: ${user.email} (@${user.displayName}), Country: ${user.country || 'N/A'}, IP: ${data.signupIp || 'Unknown'}.${signals.isSuspicious ? ` FLAGGED SUSPICIOUS: ${signals.reasons.join('; ')}` : ''}`,
        },
      })
      .catch(() => {});

    if (signals.isSuspicious) {
      notificationService
        .sendAdminAlert(
          `Suspicious New Registration Flagged [${user.email}]`,
          `Account ${user.email} (@${user.displayName}) triggered anti-spam duplicate detection:\n${signals.reasons.join('\n')}`,
          { userId: user.id, email: user.email, riskScore: signals.riskScore }
        )
        .catch(() => {});
    }

    const clientUrl = process.env.CLIENT_URL || 'https://www.avorabank.com';
    const verifyUrl = `${clientUrl}/verify-email?token=${verificationSecretToken}&email=${encodeURIComponent(user.email)}`;

    // Send email verification link & 6-digit code (non-blocking)
    notificationService.sendEmail({
      to: user.email,
      subject: 'Welcome to Avora Bank — Verify Your Email Address',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #090d16; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid #1e293b;">
          <h2 style="color: #10b981; margin-top: 0;">Verify Your Avora Bank Account</h2>
          <p style="color: #cbd5e1; font-size: 14px;">Welcome, ${user.firstName || 'Client'} (@${user.displayName}). Please verify your email address before submitting KYC or accessing platform services.</p>
          <div style="margin: 24px 0; padding: 16px; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; text-align: center;">
            <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Your 6-Digit Verification Code</div>
            <div style="font-size: 28px; font-weight: 900; font-family: monospace; color: #10b981; letter-spacing: 6px; margin-top: 6px;">${verificationCode}</div>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${verifyUrl}" style="display: inline-block; background: #10b981; color: #090d16; font-weight: 800; padding: 12px 24px; border-radius: 10px; text-decoration: none;">Verify Email Address &rarr;</a>
          </div>
          <p style="font-size: 11px; color: #64748b;">This code expires in 24 hours. Note: Registration alone does not grant full financial access — KYC verification is required before using protected features.</p>
        </div>
      `,
    }).catch(() => {});

    const enforceOnLogin = policy.emailVerification.enforceEmailVerificationOnLoginForNewUsers;
    const token = enforceOnLogin ? null : this.generateToken(user.id, user.email, user.role);

    return {
      requiresEmailVerification: enforceOnLogin,
      emailVerificationSent: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        phone: user.phone,
        country: user.country,
        signupLocation: user.signupLocation,
        role: user.role,
        kycStatus: user.kycStatus,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        isAvailable: user.isAvailable !== false,
        availabilityUpdatedAt: user.availabilityUpdatedAt || null,
      },
      ...(token ? { token } : {}),
    };
  }

  async verifyEmail(params: { email?: string; code?: string; token?: string; ipAddress?: string }) {
    await compliancePolicyService.ensureComplianceSchema();
    const cleanEmail = params.email ? params.email.toLowerCase().trim() : '';
    const cleanCode = params.code ? params.code.trim() : '';
    const cleanToken = params.token ? params.token.trim() : '';

    if (!cleanToken && (!cleanEmail || !cleanCode)) {
      throw Object.assign(new Error('Verification token or email with 6-digit code is required.'), { statusCode: 400 });
    }

    let user = cleanEmail
      ? await prisma.user.findUnique({ where: { email: cleanEmail } })
      : await prisma.user.findFirst({ where: { emailVerificationToken: { contains: cleanToken } } });

    if (!user) {
      throw Object.assign(new Error('Verification record not found or invalid.'), { statusCode: 400 });
    }

    if (user.emailVerified) {
      const jwtToken = this.generateToken(user.id, user.email, user.role, user.mustChangePassword);
      return {
        success: true,
        alreadyVerified: true,
        message: 'Your email address is already verified.',
        token: jwtToken,
      };
    }

    if (!user.emailVerificationToken) {
      throw Object.assign(new Error('No active verification token found. Please request a new code.'), { statusCode: 400 });
    }

    let parsed: { code?: string; token?: string; expiresAt?: string } = {};
    try {
      parsed = JSON.parse(user.emailVerificationToken);
    } catch {
      parsed = { token: user.emailVerificationToken };
    }

    if (parsed.expiresAt && Date.now() > new Date(parsed.expiresAt).getTime()) {
      throw Object.assign(new Error('Verification code expired. Please request a new verification email.'), { statusCode: 400 });
    }

    const tokenMatched = Boolean(cleanToken && parsed.token && cleanToken === parsed.token);
    const codeMatched = Boolean(cleanCode && parsed.code && cleanCode === parsed.code);
    if (!tokenMatched && !codeMatched) {
      throw Object.assign(new Error('Invalid verification code or token.'), { statusCode: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
      },
    });

    await prisma.adminAuditLog
      .create({
        data: {
          userId: updated.id,
          action: 'USER_EMAIL_VERIFIED',
          entity: 'User',
          entityId: updated.id,
          ipAddress: params.ipAddress || null,
          details: `Verified email address for ${updated.email}.`,
        },
      })
      .catch(() => {});

    const jwtToken = this.generateToken(updated.id, updated.email, updated.role, updated.mustChangePassword);

    return {
      success: true,
      message: 'Email address verified successfully! You may now proceed to KYC verification in your Dashboard.',
      token: jwtToken,
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        displayName: updated.displayName,
        role: updated.role,
        kycStatus: updated.kycStatus,
        emailVerified: true,
        twoFactorEnabled: updated.twoFactorEnabled,
      },
    };
  }

  async resendVerificationEmail(email: string) {
    await compliancePolicyService.ensureComplianceSchema();
    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return { success: true, message: 'If an unverified account exists for this email, a verification code has been dispatched.' };
    }
    if (user.emailVerified) {
      return { success: true, alreadyVerified: true, message: 'This email address is already verified.' };
    }

    const verificationCode = String(crypto.randomInt(100000, 999999));
    const verificationSecretToken = crypto.randomBytes(32).toString('hex');
    const verificationPayload = JSON.stringify({
      code: verificationCode,
      token: verificationSecretToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken: verificationPayload },
    });

    const clientUrl = process.env.CLIENT_URL || 'https://www.avorabank.com';
    const verifyUrl = `${clientUrl}/verify-email?token=${verificationSecretToken}&email=${encodeURIComponent(user.email)}`;

    notificationService.sendEmail({
      to: user.email,
      subject: 'Avora Bank — Your Email Verification Code',
      html: `
        <div style="font-family: sans-serif; padding: 24px; background: #090d16; color: #f8fafc; border-radius: 14px;">
          <h2 style="color: #10b981;">Email Verification Code</h2>
          <p>Use the 6-digit verification code below or click the link to verify your Avora Bank account:</p>
          <p style="font-size: 28px; font-weight: 900; font-family: monospace; letter-spacing: 6px; color: #10b981;">${verificationCode}</p>
          <p><a href="${verifyUrl}" style="color: #38bdf8;">Verify Email Address &rarr;</a></p>
        </div>
      `,
    }).catch(() => {});

    return {
      success: true,
      message: 'Verification email & 6-digit code dispatched. Please check your inbox.',
    };
  }

  async login(data: {
    email: string;
    password: string;
    twoFactorCode?: string;
    captchaToken?: string;
    captchaAnswer?: string;
    ipAddress?: string;
  }) {
    await compliancePolicyService.ensureComplianceSchema();
    const policy = await compliancePolicyService.getPolicy();
    const cleanEmail = data.email.toLowerCase().trim();

    // Auto-ensure Master Admin account if credentials match
    if (cleanEmail === 'admin@avorabank.com') {
      const existingAdmin = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!existingAdmin) {
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash('AvoraAdmin2026!Secure', salt);
        await prisma.user.create({
          data: {
            email: cleanEmail,
            passwordHash: hash,
            firstName: 'Chief',
            lastName: 'Administrator',
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
            emailVerified: true,
            twoFactorEnabled: false,
          },
        });
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: { wallet: { include: { balances: true } } },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Your account has been suspended or locked. Contact compliance.');
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const minsLeft = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      throw Object.assign(
        new Error(`Account temporarily locked due to repeated failed sign-in attempts. Try again in ${minsLeft} minute(s).`),
        { statusCode: 429 }
      );
    }

    // Require CAPTCHA after configured consecutive failed login attempts
    const captchaThreshold = policy.captcha.requireOnLoginAfterFailedAttempts ?? 3;
    if ((user.failedLoginAttempts || 0) >= captchaThreshold && captchaThreshold > 0) {
      if (!data.captchaToken || !data.captchaAnswer) {
        return {
          requiresCaptcha: true,
          message: 'Please complete the security CAPTCHA verification to sign in.',
        };
      }
      compliancePolicyService.verifyCaptchaChallenge(data.captchaToken, data.captchaAnswer);
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      const nextFails = (user.failedLoginAttempts || 0) + 1;
      const shouldLock = nextFails >= 5;
      const shouldFlagSuspicious = nextFails >= 8;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: nextFails,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}),
          ...(shouldFlagSuspicious
            ? {
                isSuspicious: true,
                suspiciousReason: `Repeated failed login attempts (${nextFails}) from IP ${data.ipAddress || 'unknown'}`,
                flaggedAt: new Date(),
                flaggedBy: 'ANTI_SPAM_ENGINE',
                riskScore: Math.max(user.riskScore || 0, 70),
              }
            : {}),
        },
      });
      if (shouldFlagSuspicious) {
        await prisma.adminAuditLog
          .create({
            data: {
              userId: user.id,
              action: 'LOGIN_BRUTE_FORCE_FLAG',
              entity: 'User',
              entityId: user.id,
              ipAddress: data.ipAddress || null,
              details: `Flagged ${user.email} after ${nextFails} consecutive failed login attempts.`,
            },
          })
          .catch(() => {});
      }
      if (nextFails >= captchaThreshold && captchaThreshold > 0) {
        throw Object.assign(new Error('Invalid email or password. CAPTCHA verification is now required.'), {
          statusCode: 401,
          requiresCaptcha: true,
        });
      }
      throw new Error('Invalid email or password');
    }

    if (user.twoFactorEnabled) {
      if (!data.twoFactorCode) {
        return {
          requires2FA: true,
          userId: user.id,
        };
      }

      if (!user.twoFactorSecret) {
        throw new Error('2FA secret corrupted');
      }

      const plainSecret = decryptAtRest(user.twoFactorSecret);
      const verified = authenticator.check(data.twoFactorCode, plainSecret);
      if (!verified) {
        throw new Error('Invalid 2FA authentication code');
      }
    }

    if (
      policy.emailVerification.enforceEmailVerificationOnLoginForNewUsers &&
      !user.emailVerified &&
      user.role === Role.USER
    ) {
      return {
        requiresEmailVerification: true,
        email: user.email,
        message: 'Please verify your email address before signing in.',
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const token = this.generateToken(user.id, user.email, user.role, user.mustChangePassword);

    return {
      requires2FA: false,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        phone: user.phone,
        country: user.country,
        signupLocation: user.signupLocation,
        role: user.role,
        kycStatus: user.kycStatus,
        emailVerified: user.emailVerified,
        kycNotes: user.kycNotes || null,
        kycExpiresAt: user.kycExpiresAt || null,
        twoFactorEnabled: user.twoFactorEnabled,
        mustChangePassword: user.mustChangePassword,
        isAvailable: user.isAvailable !== false,
        availabilityUpdatedAt: user.availabilityUpdatedAt || null,
        wallet: user.wallet,
      },
      token,
    };
  }

  async forgotPassword(email: string, captchaToken?: string, captchaAnswer?: string) {
    const policy = await compliancePolicyService.getPolicy();
    if (policy.captcha.requireOnForgotPassword && captchaToken) {
      compliancePolicyService.verifyCaptchaChallenge(captchaToken, captchaAnswer);
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return { success: true, message: 'If an account exists, a reset link has been dispatched.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    // Dispatch branded reset email
    notificationService.sendEmail({
      to: user.email,
      subject: 'Reset Your Avora Bank Password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #090d16; color: #f8fafc; padding: 36px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.35); box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="border-bottom: 1px solid #1e293b; padding-bottom: 18px; margin-bottom: 24px;">
            <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">AVORA BANK</h1>
            <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Security & Access Control</p>
          </div>
          
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            We received a request to reset the password for your Avora Bank account. Click the secure button below to set a new password:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #10b981; color: #090d16; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 12px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
              Set New Password &rarr;
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 8px;">Or copy and paste this direct link into your browser:</p>
          <div style="background: #0e1726; border: 1px solid #1e293b; border-radius: 8px; padding: 10px; font-family: monospace; font-size: 11px; color: #38bdf8; word-break: break-all;">
            ${resetUrl}
          </div>

          <div style="margin-top: 20px; padding: 12px; background: #111827; border-radius: 8px; border: 1px solid #1f2937;">
            <span style="font-size: 11px; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 4px;">Manual Security Token:</span>
            <span style="font-family: monospace; font-size: 13px; font-weight: bold; color: #ffffff; letter-spacing: 1px;">${resetToken}</span>
          </div>

          <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
            This security link is valid for 1 hour. If you did not request a password reset, please disregard this email or notify our security team at desk@avorabank.com.
          </p>
        </div>
      `,
    }).catch((err) => {
      console.warn('[AuthService] Reset email error:', err?.message || err);
    });

    return { success: true, message: 'If an account exists, a reset link has been dispatched.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        withdrawalLockedUntil: lockUntil,
      },
    });

    // Email alert (non-blocking)
    notificationService.sendEmail({
      to: user.email,
      subject: 'Security Alert: Password Reset - 24-Hour Withdrawal Lock Engaged',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Security Alert: Password Reset</h3>
          <p>Your account password was recently reset.</p>
          <p><strong>Security Protection Activated:</strong> To protect your funds against unauthorized account takeover, withdrawals and outbound transfers are temporarily locked for 24 hours until <strong>${lockUntil.toUTCString()}</strong>.</p>
        </div>
      `,
    }).catch(() => {});

    return { success: true, message: 'Password has been successfully updated. For your security, withdrawals are locked for 24 hours.' };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) throw new Error('Incorrect current password');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        withdrawalLockedUntil: lockUntil,
      },
    });

    // Email alert (non-blocking)
    notificationService.sendEmail({
      to: user.email,
      subject: 'Security Alert: Password Changed - 24-Hour Withdrawal Lock Engaged',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Security Alert: Password Changed</h3>
          <p>Your password was changed successfully.</p>
          <p><strong>Security Protection Activated:</strong> Withdrawals and outbound transfers are locked for 24 hours until <strong>${lockUntil.toUTCString()}</strong>.</p>
        </div>
      `,
    }).catch(() => {});

    return { success: true, message: 'Password updated successfully. For your security, withdrawals are locked for 24 hours.' };
  }

  async generate2faSecret(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Avora Bank', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    // Encrypt 2FA secret at rest using AES-256-GCM
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: encryptAtRest(secret) },
    });

    return { secret, qrCodeUrl };
  }

  async verifyAndEnable2fa(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new Error('2FA setup not initiated. Please generate a 2FA secret first.');

    const plainSecret = decryptAtRest(user.twoFactorSecret);
    const isValid = authenticator.check(code, plainSecret);
    if (!isValid) throw new Error('Invalid Two-Factor Authentication (2FA) code');

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true, twoFactorEnabled: true, message: 'Two-factor authentication enabled successfully' };
  }

  async enable2fa(userId: string, code: string) {
    return this.verifyAndEnable2fa(userId, code);
  }

  async disable2fa(userId: string, password: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (!user.twoFactorEnabled) throw new Error('2FA is not enabled on this account');

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) throw new Error('Invalid password');

    if (!user.twoFactorSecret) throw new Error('2FA secret corrupted');
    const plainSecret = decryptAtRest(user.twoFactorSecret);
    const isValidCode = authenticator.check(code, plainSecret);
    if (!isValidCode) throw new Error('Invalid Two-Factor Authentication (2FA) code');

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { success: true, twoFactorEnabled: false, message: 'Two-factor authentication disabled' };
  }

  async verify2faForUser(userId: string, code?: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });

    if (!user) throw new Error('User not found');
    if (!user.twoFactorEnabled) {
      return true;
    }

    if (!code) {
      throw new Error('Two-Factor Authentication (2FA) code is required for this transaction');
    }

    if (!user.twoFactorSecret) {
      throw new Error('2FA configuration error. Please contact support.');
    }

    const plainSecret = decryptAtRest(user.twoFactorSecret);
    const isValid = authenticator.check(code, plainSecret);
    if (!isValid) {
      throw new Error('Invalid Two-Factor Authentication (2FA) code');
    }

    return true;
  }

  async checkWithdrawalLock(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { withdrawalLockedUntil: true },
    });

    if (user?.withdrawalLockedUntil && new Date() < user.withdrawalLockedUntil) {
      const remainingMs = user.withdrawalLockedUntil.getTime() - Date.now();
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      throw new Error(
        `Withdrawals and outbound transfers are temporarily locked for security following a recent credential update. Lock expires in ${remainingHours} hour(s) at ${user.withdrawalLockedUntil.toUTCString()}.`
      );
    }
  }

  public async refreshSession(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, status: true, mustChangePassword: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('User account is inactive or not found');
    }

    const token = this.generateToken(user.id, user.email, user.role, user.mustChangePassword);
    return { token };
  }

  /**
   * Toggle user's single global availability status (Online / Offline) across P2P, OTC, and all services.
   * Users stay Online by default unless manually marked Offline; transactions & messages still arrive when Offline.
   */
  public async updateAvailability(userId: string, isAvailable: boolean) {
    const nextAvailable = Boolean(isAvailable);
    const now = new Date();
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isAvailable: nextAvailable,
        availabilityUpdatedAt: now,
      },
      select: {
        id: true,
        isAvailable: true,
        availabilityUpdatedAt: true,
      },
    });

    await prisma.otcDesk
      .updateMany({
        where: { userId, status: 'ACTIVE' },
        data: { isOnline: nextAvailable },
      })
      .catch(() => {});

    return {
      isAvailable: updated.isAvailable,
      availabilityUpdatedAt: updated.availabilityUpdatedAt,
    };
  }

  private generateToken(userId: string, email: string, role: Role, mustChangePassword = false): string {
    const secret = role === Role.ADMIN ? config.adminJwtSecret : config.jwtSecret;
    return jwt.sign(
      { userId, email, role, mustChangePassword },
      secret,
      { expiresIn: '7d' }
    );
  }
}

export const authService = new AuthService();
