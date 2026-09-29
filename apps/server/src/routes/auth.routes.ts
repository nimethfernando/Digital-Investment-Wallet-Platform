import { Router } from 'express';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  setup2fa,
  verify2fa,
  getMe,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', authenticateToken, getMe);
router.post('/change-password', authenticateToken, changePassword);
router.post('/2fa/setup', authenticateToken, setup2fa);
router.post('/2fa/verify', authenticateToken, verify2fa);

export default router;
