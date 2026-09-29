import { Router } from 'express';
import authRoutes from './auth.routes';
import cmsRoutes from './cms.routes';
import uploadRoutes from './upload.routes';
import walletRoutes from './wallet.routes';
import packageRoutes from './package.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cms', cmsRoutes);
router.use('/upload', uploadRoutes);
router.use('/wallet', walletRoutes);
router.use('/packages', packageRoutes);
router.use('/admin', adminRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Nexis Core API Engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
