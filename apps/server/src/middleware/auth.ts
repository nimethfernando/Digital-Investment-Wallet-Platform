import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface AuthenticatedUser {
  id?: string;
  userId: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
  twoFactorEnabled?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. Please sign in to access this resource.' });
    return;
  }

  let payload: AuthenticatedUser;
  try {
    try {
      payload = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    } catch {
      payload = jwt.verify(token, config.adminJwtSecret) as AuthenticatedUser;
    }
  } catch {
    res.status(403).json({ success: false, message: 'Invalid or expired access token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
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
  } catch (err) {
    console.error('[AuthMiddleware] Transient database error during user lookup:', err);
    res.status(503).json({ success: false, message: 'Service temporarily unavailable. Please retry.' });
    return;
  }
};

export const optionalAuthenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) {
    next();
    return;
  }

  try {
    let payload: AuthenticatedUser;
    try {
      payload = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    } catch {
      payload = jwt.verify(token, config.adminJwtSecret) as AuthenticatedUser;
    }

    const user = await prisma.user.findUnique({
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
  } catch {
    // Proceed as unauthenticated guest
  }
  next();
};

export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

export const requireAdmin = requireRole([Role.ADMIN]);
export const requireStaffOrAdmin = requireRole([Role.STAFF, Role.ADMIN]);

export const requireAdmin2FA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  // If 2FA is enabled on this admin/staff account, verify TOTP code cryptographically
  if (req.user.twoFactorEnabled) {
    const providedCode =
      (req.headers['x-admin-2fa'] as string) ||
      (req.headers['x-2fa-code'] as string) ||
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
      const { authService } = await import('../services/auth.service');
      await authService.verify2faForUser(req.user.id || req.user.userId, String(providedCode).trim());
    } catch (err: any) {
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
