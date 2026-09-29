import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
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
    const payload = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true, mustChangePassword: true }
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
    } as any;

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
