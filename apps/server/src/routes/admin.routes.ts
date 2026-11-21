import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticateToken, requireRole, requireAdmin2FA } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticateToken);
router.use(requireRole([Role.ADMIN, Role.STAFF]));

// User Management operations
router.get('/users', (req, res, next) => adminController.getUsers(req, res, next));
router.post('/users/create', requireRole([Role.ADMIN]), (req, res, next) => adminController.createUser(req, res, next));
router.get('/users/:id/client-view', (req, res, next) => adminController.getUserClientView(req, res, next));
router.get('/tokens', (req, res, next) => adminController.getTokenHolders(req, res, next));
router.get('/newsletter/subscribers', (req, res, next) => adminController.getNewsletterSubscribers(req, res, next));
router.delete('/newsletter/subscribers/:id', requireRole([Role.ADMIN]), (req, res, next) => adminController.deleteNewsletterSubscriber(req, res, next));
router.get('/users/:id', (req, res, next) => adminController.getUserDetails(req, res, next));
router.patch('/users/:id', requireRole([Role.ADMIN]), (req, res, next) => adminController.updateUser(req, res, next));
router.post('/users/:id/adjust-balance', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.adjustUserBalance(req, res, next));

// Platform Configuration & Commissions
router.get('/settings/config', (req, res, next) => adminController.getPlatformConfig(req, res, next));
router.post('/settings/config', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updatePlatformConfig(req, res, next));

// Real-Time Exchange Rate Controls
router.get('/rates', (req, res, next) => adminController.getExchangeRates(req, res, next));
router.put('/rates', requireRole([Role.ADMIN]), (req, res, next) => adminController.updateExchangeRates(req, res, next));
router.post('/rates/refresh', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) => adminController.refreshExchangeRates(req, res, next));

// Package operations
router.get('/packages', (req, res, next) => adminController.getPackages(req, res, next));
router.post('/packages/create', requireRole([Role.ADMIN]), (req, res, next) => adminController.createPackage(req, res, next));
router.post('/packages/:id/approve', (req, res, next) => adminController.approvePackage(req, res, next));
router.post('/packages/:id/credit-yield', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.creditSinglePackageYield(req, res, next));
router.post('/packages/:id/settle-full', requireAdmin2FA, (req, res, next) => adminController.settleFullPackage(req, res, next));
router.patch('/packages/:id/tenure', requireAdmin2FA, (req, res, next) => adminController.updatePackageTenure(req, res, next));

// Startup Equity & Token Allocation operations
router.get('/investments', (req, res, next) => adminController.getInvestments(req, res, next));
router.patch('/investments/listings/:id/valuation', requireAdmin2FA, (req, res, next) => adminController.updateStartupValuation(req, res, next));
router.post('/investments/listings/:id/distribute-exit', requireAdmin2FA, (req, res, next) => adminController.distributeStartupExit(req, res, next));
router.get('/token-allocations', (req, res, next) => adminController.getTokenAllocations(req, res, next));

// Deposit operations
router.get('/deposits', (req, res, next) => adminController.getDeposits(req, res, next));
router.post('/deposits/manual', requireRole([Role.ADMIN]), (req, res, next) => adminController.createManualDeposit(req, res, next));
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

router.get(
  '/ledger/revenue',
  requireRole([Role.ADMIN]),
  (req, res, next) => adminController.getPlatformRevenueAnalytics(req, res, next)
);

router.post(
  '/ledger/claim-revenue',
  requireRole([Role.ADMIN]),
  requireAdmin2FA,
  (req, res, next) => adminController.claimPlatformRevenue(req, res, next)
);

router.post(
  '/system/purge-demo',
  requireRole([Role.ADMIN]),
  requireAdmin2FA,
  (req, res, next) => adminController.purgeDemoData(req, res, next)
);


// User Security & Account Controls
router.post('/users/:id/reset-password', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.resetUserPassword(req, res, next));
router.post('/users/:id/disable-2fa', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.disableUser2FA(req, res, next));
router.post('/users/:id/status', requireRole([Role.ADMIN]), (req, res, next) => adminController.updateUserStatus(req, res, next));
router.post('/users/:id/p2p-status', requireRole([Role.ADMIN]), (req, res, next) => adminController.updateUserP2PStatus(req, res, next));

// Global Money Transfer / Remittance Corridors
router.get('/remittance/transfers', (req, res, next) => adminController.getRemittanceTransfers(req, res, next));
router.patch('/remittance/transfers/:id', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) => adminController.updateRemittanceTransfer(req, res, next));

// Startups & Venture Equity Management
router.post('/investments/listings', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.createStartupListing(req, res, next));
router.put('/investments/listings/:id', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updateStartupListing(req, res, next));
router.delete('/investments/listings/:id', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.deleteStartupListing(req, res, next));
router.post('/investments/listings/:id/sync-metrics', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.syncStartupListingMetrics(req, res, next));
router.post('/investments/commitments', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.createManualInvestmentCommitment(req, res, next));
router.delete('/investments/commitments/:id', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.deleteMockInvestmentCommitment(req, res, next));
router.post('/investments/inquiries/:id/reply', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) => adminController.replyStartupInquiry(req, res, next));

// P2P Escrow, Onboarding Applications & Dispute Resolution
router.get('/p2p/applications', (req, res, next) => adminController.getP2PApplications(req, res, next));
router.post('/p2p/applications/:id/review', requireRole([Role.ADMIN, Role.STAFF]), requireAdmin2FA, (req, res, next) =>
  adminController.reviewP2PApplication(req, res, next)
);
router.get('/p2p/orders', (req, res, next) => adminController.getP2POrders(req, res, next));
router.post('/p2p/orders/:id/freeze', requireRole([Role.ADMIN]), (req, res, next) => adminController.freezeP2POrder(req, res, next));
router.post('/p2p/orders/:id/resolve', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.resolveP2PDispute(req, res, next));

// OTC Desks & Escrow Trade Management
router.get('/otc/desks', (req, res, next) => adminController.getOtcDesks(req, res, next));
router.patch('/otc/desks/:id', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updateOtcDesk(req, res, next));
router.get('/otc/trades', (req, res, next) => adminController.getOtcTrades(req, res, next));
router.post('/otc/trades/:id/resolve', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.resolveOtcTrade(req, res, next));
router.get('/otc/inquiries', (req, res, next) => adminController.getOtcInquiries(req, res, next));

// Institutional Audit Logs & Unified Transaction Lookup
router.get('/transactions/lookup', (req, res, next) => adminController.lookupTransaction(req, res, next));
router.get('/audit-logs', requireRole([Role.ADMIN]), (req, res, next) => adminController.getAdminAuditLogs(req, res, next));

// System Controls & Announcement Broadcast
router.get('/system/status', (req, res, next) => adminController.getSystemStatus(req, res, next));
router.post('/system/settings', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updateSystemStatus(req, res, next));
router.post('/system/self-test', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) => adminController.runFinancialSelfTest(req, res, next));

// Platform Analytics Overview & Real-Time Admin Notifications
router.get('/analytics/overview', (req, res, next) => adminController.getPlatformOverviewAnalytics(req, res, next));
router.get('/notifications', (req, res, next) => adminController.getAdminNotifications(req, res, next));

// Real-Time Liquidity, Exposure & Swap Risk Governance
router.get('/liquidity-risk', (req, res, next) => adminController.getLiquidityRiskOverview(req, res, next));
router.post('/liquidity-risk/config', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updateLiquidityRiskConfig(req, res, next));
router.post('/liquidity-risk/swaps/:id/approve', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.approveSwapRequest(req, res, next));
router.post('/liquidity-risk/swaps/:id/reject', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.rejectSwapRequest(req, res, next));
router.post('/users/:id/swap-override', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.updateUserSwapOverride(req, res, next));

// Central Feature Control & Emergency Kill-Switches
router.get('/feature-controls', (req, res, next) => adminController.getFeatureControls(req, res, next));
router.post('/feature-controls/toggle', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.toggleFeatureControl(req, res, next));
router.post('/feature-controls/bulk-toggle', requireRole([Role.ADMIN]), requireAdmin2FA, (req, res, next) => adminController.bulkToggleFeatureControls(req, res, next));

export default router;
