import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([Role.ADMIN, Role.STAFF]));

// Package operations
router.get('/packages', (req, res, next) => adminController.getPackages(req, res, next));
router.post('/packages/:id/approve', (req, res, next) => adminController.approvePackage(req, res, next));

// Deposit operations
router.get('/deposits', (req, res, next) => adminController.getDeposits(req, res, next));
router.post('/deposits/:id/approve', (req, res, next) => adminController.approveDeposit(req, res, next));
router.post('/deposits/:id/reject', (req, res, next) => adminController.rejectDeposit(req, res, next));

// Strict Admin-only endpoints
router.post(
  '/returns/run',
  requireRole([Role.ADMIN]),
  (req, res, next) => adminController.triggerMonthlyReturns(req, res, next)
);

router.get(
  '/ledger/reconcile',
  requireRole([Role.ADMIN]),
  (req, res, next) => adminController.getLedgerReconciliation(req, res, next)
);

router.get(
  '/ledger/journals',
  requireRole([Role.ADMIN]),
  (req, res, next) => adminController.getLedgerJournals(req, res, next)
);

export default router;
