import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { config } from '../config';
import { notificationService } from '../adapters/notification/notification.provider';

const prisma = new PrismaClient();

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase().trim() } });
    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
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

    await notificationService.sendEmail({
      to: user.email,
      subject: 'Welcome to Nexis Platform - Verify Your Account',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Welcome to Nexis, ${user.firstName || 'Investor'}!</h2>
          <p>Your digital investment wallet has been successfully created.</p>
          <p>You can now explore our curated investment packages, check live USDT exchange rates, or fund your wallet.</p>
        </div>
      `,
    });

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kycStatus: user.kycStatus,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      token,
    };
  }

  async login(data: { email: string; password: string; twoFactorCode?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
      include: { wallet: { include: { balances: true } } },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error('Your account has been suspended or locked. Contact compliance.');
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
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

      const verified = authenticator.check(data.twoFactorCode, user.twoFactorSecret);
      if (!verified) {
        throw new Error('Invalid 2FA authentication code');
      }
    }

    await prisma.user.update({
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
        role: user.role,
        kycStatus: user.kycStatus,
        twoFactorEnabled: user.twoFactorEnabled,
        mustChangePassword: user.mustChangePassword,
        wallet: user.wallet,
      },
      token,
    };
  }

  async forgotPassword(email: string) {
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

    await notificationService.sendEmail({
      to: user.email,
      subject: 'Password Reset Request - Nexis Platform',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Use the token below to set a new password:</p>
          <div style="background: #f1f5f9; padding: 12px; font-family: monospace; font-size: 16px; border-radius: 6px; margin: 16px 0;">
            ${resetToken}
          </div>
          <p>This token is valid for 1 hour.</p>
        </div>
      `,
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        mustChangePassword: false,
      },
    });

    return { success: true, message: 'Password has been successfully updated. You may now log in.' };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) throw new Error('Incorrect current password');

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async generate2faSecret(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Nexis Platform', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauth);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, qrCodeUrl };
  }

  async verifyAndEnable2fa(userId: string, code: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new Error('2FA setup not initiated');

    const isValid = authenticator.check(code, user.twoFactorSecret);
    if (!isValid) throw new Error('Invalid authentication code');

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { success: true, message: 'Two-factor authentication enabled successfully' };
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
