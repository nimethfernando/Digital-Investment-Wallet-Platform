"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const config_1 = require("../config");
const notification_provider_1 = require("../adapters/notification/notification.provider");
const crypto_2 = require("../utils/crypto");
class AuthService {
    async register(data) {
        const existing = await prisma_1.prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
        if (existing) {
            throw new Error('An account with this email address already exists');
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const emailVerificationToken = crypto_1.default.randomBytes(32).toString('hex');
        const user = await prisma_1.prisma.user.create({
            data: {
                email: data.email.toLowerCase().trim(),
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                country: data.country,
                signupLocation: data.signupLocation,
                signupIp: data.signupIp,
                emailVerificationToken,
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
        // Send welcome email (non-blocking)
        notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: 'Welcome to Avora Bank - Verify Your Account',
            html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Welcome to Avora Bank, ${user.firstName || 'Investor'}!</h2>
          <p>Your digital investment wallet has been successfully created.</p>
          <p>You can now explore our curated investment packages, check live USDT exchange rates, or fund your wallet.</p>
        </div>
      `,
        }).catch(() => { });
        const token = this.generateToken(user.id, user.email, user.role);
        return {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                country: user.country,
                signupLocation: user.signupLocation,
                role: user.role,
                kycStatus: user.kycStatus,
                twoFactorEnabled: user.twoFactorEnabled,
            },
            token,
        };
    }
    async login(data) {
        const cleanEmail = data.email.toLowerCase().trim();
        // Auto-ensure Master Admin account if credentials match
        if (cleanEmail === 'admin@avorabank.com') {
            const existingAdmin = await prisma_1.prisma.user.findUnique({ where: { email: cleanEmail } });
            if (!existingAdmin) {
                const salt = await bcryptjs_1.default.genSalt(12);
                const hash = await bcryptjs_1.default.hash('AvoraAdmin2026!Secure', salt);
                await prisma_1.prisma.user.create({
                    data: {
                        email: cleanEmail,
                        passwordHash: hash,
                        firstName: 'Chief',
                        lastName: 'Administrator',
                        role: client_1.Role.ADMIN,
                        status: client_1.UserStatus.ACTIVE,
                        emailVerified: true,
                        twoFactorEnabled: false,
                    },
                });
            }
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { email: cleanEmail },
            include: { wallet: { include: { balances: true } } },
        });
        if (!user) {
            throw new Error('Invalid email or password');
        }
        if (user.status !== client_1.UserStatus.ACTIVE) {
            throw new Error('Your account has been suspended or locked. Contact compliance.');
        }
        const isValid = await bcryptjs_1.default.compare(data.password, user.passwordHash);
        if (!isValid) {
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
            const plainSecret = (0, crypto_2.decryptAtRest)(user.twoFactorSecret);
            const verified = otplib_1.authenticator.check(data.twoFactorCode, plainSecret);
            if (!verified) {
                throw new Error('Invalid 2FA authentication code');
            }
        }
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const token = this.generateToken(user.id, user.email, user.role, user.mustChangePassword);
        return {
            requires2FA: false,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                country: user.country,
                signupLocation: user.signupLocation,
                role: user.role,
                kycStatus: user.kycStatus,
                twoFactorEnabled: user.twoFactorEnabled,
                mustChangePassword: user.mustChangePassword,
                wallet: user.wallet,
            },
            token,
        };
    }
    async forgotPassword(email) {
        const user = await prisma_1.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
        if (!user) {
            return { success: true, message: 'If an account exists, a reset link has been dispatched.' };
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires,
            },
        });
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
        const resetUrl = `${clientUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
        // Dispatch branded reset email
        notification_provider_1.notificationService.sendEmail({
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
    async resetPassword(token, newPassword) {
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: { gt: new Date() },
            },
        });
        if (!user) {
            throw new Error('Invalid or expired reset token');
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma_1.prisma.user.update({
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
        notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: 'Security Alert: Password Reset - 24-Hour Withdrawal Lock Engaged',
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Security Alert: Password Reset</h3>
          <p>Your account password was recently reset.</p>
          <p><strong>Security Protection Activated:</strong> To protect your funds against unauthorized account takeover, withdrawals and outbound transfers are temporarily locked for 24 hours until <strong>${lockUntil.toUTCString()}</strong>.</p>
        </div>
      `,
        }).catch(() => { });
        return { success: true, message: 'Password has been successfully updated. For your security, withdrawals are locked for 24 hours.' };
    }
    async changePassword(userId, oldPassword, newPassword) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const isValid = await bcryptjs_1.default.compare(oldPassword, user.passwordHash);
        if (!isValid)
            throw new Error('Incorrect current password');
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                mustChangePassword: false,
                passwordChangedAt: new Date(),
                withdrawalLockedUntil: lockUntil,
            },
        });
        // Email alert (non-blocking)
        notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: 'Security Alert: Password Changed - 24-Hour Withdrawal Lock Engaged',
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Security Alert: Password Changed</h3>
          <p>Your password was changed successfully.</p>
          <p><strong>Security Protection Activated:</strong> Withdrawals and outbound transfers are locked for 24 hours until <strong>${lockUntil.toUTCString()}</strong>.</p>
        </div>
      `,
        }).catch(() => { });
        return { success: true, message: 'Password updated successfully. For your security, withdrawals are locked for 24 hours.' };
    }
    async generate2faSecret(userId) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const secret = otplib_1.authenticator.generateSecret();
        const otpauth = otplib_1.authenticator.keyuri(user.email, 'Avora Bank', secret);
        const qrCodeUrl = await qrcode_1.default.toDataURL(otpauth);
        // Encrypt 2FA secret at rest using AES-256-GCM
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: (0, crypto_2.encryptAtRest)(secret) },
        });
        return { secret, qrCodeUrl };
    }
    async verifyAndEnable2fa(userId, code) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.twoFactorSecret)
            throw new Error('2FA setup not initiated. Please generate a 2FA secret first.');
        const plainSecret = (0, crypto_2.decryptAtRest)(user.twoFactorSecret);
        const isValid = otplib_1.authenticator.check(code, plainSecret);
        if (!isValid)
            throw new Error('Invalid Two-Factor Authentication (2FA) code');
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { twoFactorEnabled: true },
        });
        return { success: true, twoFactorEnabled: true, message: 'Two-factor authentication enabled successfully' };
    }
    async enable2fa(userId, code) {
        return this.verifyAndEnable2fa(userId, code);
    }
    async disable2fa(userId, password, code) {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        if (!user.twoFactorEnabled)
            throw new Error('2FA is not enabled on this account');
        const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValidPassword)
            throw new Error('Invalid password');
        if (!user.twoFactorSecret)
            throw new Error('2FA secret corrupted');
        const plainSecret = (0, crypto_2.decryptAtRest)(user.twoFactorSecret);
        const isValidCode = otplib_1.authenticator.check(code, plainSecret);
        if (!isValidCode)
            throw new Error('Invalid Two-Factor Authentication (2FA) code');
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
            },
        });
        return { success: true, twoFactorEnabled: false, message: 'Two-factor authentication disabled' };
    }
    async verify2faForUser(userId, code) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { twoFactorEnabled: true, twoFactorSecret: true },
        });
        if (!user)
            throw new Error('User not found');
        if (!user.twoFactorEnabled) {
            return true;
        }
        if (!code) {
            throw new Error('Two-Factor Authentication (2FA) code is required for this transaction');
        }
        if (!user.twoFactorSecret) {
            throw new Error('2FA configuration error. Please contact support.');
        }
        const plainSecret = (0, crypto_2.decryptAtRest)(user.twoFactorSecret);
        const isValid = otplib_1.authenticator.check(code, plainSecret);
        if (!isValid) {
            throw new Error('Invalid Two-Factor Authentication (2FA) code');
        }
        return true;
    }
    async checkWithdrawalLock(userId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { withdrawalLockedUntil: true },
        });
        if (user?.withdrawalLockedUntil && new Date() < user.withdrawalLockedUntil) {
            const remainingMs = user.withdrawalLockedUntil.getTime() - Date.now();
            const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
            throw new Error(`Withdrawals and outbound transfers are temporarily locked for security following a recent credential update. Lock expires in ${remainingHours} hour(s) at ${user.withdrawalLockedUntil.toUTCString()}.`);
        }
    }
    generateToken(userId, email, role, mustChangePassword = false) {
        const secret = role === client_1.Role.ADMIN ? config_1.config.adminJwtSecret : config_1.config.jwtSecret;
        return jsonwebtoken_1.default.sign({ userId, email, role, mustChangePassword }, secret, { expiresIn: '7d' });
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
