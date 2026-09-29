import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
  twoFactorCode: z.string().optional(),
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
    const result = await authService.register(data);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(email);
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

export const getMe = async (req: Request, res: Response) => {
  res.json({ success: true, user: req.user });
};
