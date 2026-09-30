import { Router } from 'express';
import authRoutes from './auth.routes';
import cmsRoutes from './cms.routes';
import uploadRoutes from './upload.routes';
import walletRoutes from './wallet.routes';
import packageRoutes from './package.routes';
import adminRoutes from './admin.routes';
import p2pRoutes from './p2p.routes';
import withdrawalRoutes from './withdrawal.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cms', cmsRoutes);
router.use('/upload', uploadRoutes);
router.use('/wallet', walletRoutes);
router.use('/packages', packageRoutes);
router.use('/admin', adminRoutes);
router.use('/p2p', p2pRoutes);
router.use('/withdrawals', withdrawalRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Nexis Core API Engine',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
