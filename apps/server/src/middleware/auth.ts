import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

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
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({ success: false, message: 'Access token required' });
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
    res.status(403).json({ success: false, message: 'Invalid or expired access token' });
    return;
  }
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

export const requireAdmin2FA = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  if ((req.user.role === Role.ADMIN || req.user.role === Role.STAFF) && !req.user.twoFactorEnabled) {
    res.status(403).json({
      success: false,
      code: '2FA_MANDATORY_FOR_ADMIN',
      message: 'Mandatory Two-Factor Authentication (2FA) is required for Admin and Staff accounts. Please enable 2FA on your account.',
    });
    return;
  }

  next();
};
