import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken, requireRole, requireAdmin2FA } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([Role.ADMIN, Role.STAFF]));

// User Management operations
router.get('/users', (req, res, next) => adminController.getUsers(req, res, next));
router.get('/users/:id', (req, res, next) => adminController.getUserDetails(req, res, next));
router.patch('/users/:id', requireRole([Role.ADMIN]), (req, res, next) => adminController.updateUser(req, res, next));
router.post('/users/:id/adjust-balance', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.adjustUserBalance(req, res, next));

// Platform Configuration & Commissions
router.get('/settings/config', (req, res, next) => adminController.getPlatformConfig(req, res, next));
router.post('/settings/config', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updatePlatformConfig(req, res, next));

// Package operations
router.get('/packages', (req, res, next) => adminController.getPackages(req, res, next));
router.post('/packages/:id/approve', (req, res, next) => adminController.approvePackage(req, res, next));
router.post('/packages/:id/settle-full', requireAdmin2FA, (req, res, next) => adminController.settleFullPackage(req, res, next));
router.patch('/packages/:id/tenure', requireAdmin2FA, (req, res, next) => adminController.updatePackageTenure(req, res, next));

// Startup Equity & Token Allocation operations
router.get('/investments', (req, res, next) => adminController.getInvestments(req, res, next));
router.patch('/investments/listings/:id/valuation', requireAdmin2FA, (req, res, next) => adminController.updateStartupValuation(req, res, next));
router.post('/investments/listings/:id/distribute-exit', requireAdmin2FA, (req, res, next) => adminController.distributeStartupExit(req, res, next));
router.get('/token-allocations', (req, res, next) => adminController.getTokenAllocations(req, res, next));

// Deposit operations
router.get('/deposits', (req, res, next) => adminController.getDeposits(req, res, next));
router.post('/deposits/:id/approve', requireAdmin2FA, (req, res, next) => adminController.approveDeposit(req, res, next));
router.post('/deposits/:id/reject', requireAdmin2FA, (req, res, next) => adminController.rejectDeposit(req, res, next));

// Withdrawal settlement desk operations
router.get('/withdrawals', (req, res, next) => adminController.getWithdrawals(req, res, next));
router.post('/withdrawals/:id/settle', requireAdmin2FA, (req, res, next) => adminController.settleWithdrawal(req, res, next));
router.post('/withdrawals/:id/reject', requireAdmin2FA, (req, res, next) => adminController.rejectWithdrawal(req, res, next));

// KYC Compliance review operations
router.get('/kyc', (req, res, next) => adminController.getPendingKyc(req, res, next));
router.post('/kyc/:id/approve', requireAdmin2FA, (req, res, next) => adminController.approveKyc(req, res, next));
router.post('/kyc/:id/reject', requireAdmin2FA, (req, res, next) => adminController.rejectKyc(req, res, next));

// Receiver Address Settings operations
router.get(
  '/settings/addresses',
  requireRole([Role.ADMIN, Role.STAFF]),
  (req, res, next) => adminController.getReceiverAddresses(req, res, next)
);

router.post(
  '/settings/addresses',
  requireRole([Role.ADMIN]),
  (req, res, next) => adminController.updateReceiverAddresses(req, res, next)
);

// Strict Admin-only endpoints
router.post(
  '/returns/run',
  requireRole([Role.ADMIN]),
  requireAdmin2FA,
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

router.post(
  '/system/purge-demo',
  requireRole([Role.ADMIN]),
  requireAdmin2FA,
  (req, res, next) => adminController.purgeDemoData(req, res, next)
);

export default router;
