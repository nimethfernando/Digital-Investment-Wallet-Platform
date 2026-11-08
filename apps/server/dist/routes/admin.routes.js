"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]));
// User Management operations
router.get('/users', (req, res, next) => admin_controller_1.adminController.getUsers(req, res, next));
router.post('/users/create', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.createUser(req, res, next));
router.get('/users/:id', (req, res, next) => admin_controller_1.adminController.getUserDetails(req, res, next));
router.patch('/users/:id', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.updateUser(req, res, next));
router.post('/users/:id/adjust-balance', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.adjustUserBalance(req, res, next));
// Platform Configuration & Commissions
router.get('/settings/config', (req, res, next) => admin_controller_1.adminController.getPlatformConfig(req, res, next));
router.post('/settings/config', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.updatePlatformConfig(req, res, next));
// Package operations
router.get('/packages', (req, res, next) => admin_controller_1.adminController.getPackages(req, res, next));
router.post('/packages/create', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.createPackage(req, res, next));
router.post('/packages/:id/approve', (req, res, next) => admin_controller_1.adminController.approvePackage(req, res, next));
router.post('/packages/:id/settle-full', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.settleFullPackage(req, res, next));
router.patch('/packages/:id/tenure', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.updatePackageTenure(req, res, next));
// Startup Equity & Token Allocation operations
router.get('/investments', (req, res, next) => admin_controller_1.adminController.getInvestments(req, res, next));
router.patch('/investments/listings/:id/valuation', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.updateStartupValuation(req, res, next));
router.post('/investments/listings/:id/distribute-exit', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.distributeStartupExit(req, res, next));
router.get('/token-allocations', (req, res, next) => admin_controller_1.adminController.getTokenAllocations(req, res, next));
// Deposit operations
router.get('/deposits', (req, res, next) => admin_controller_1.adminController.getDeposits(req, res, next));
router.post('/deposits/manual', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.createManualDeposit(req, res, next));
router.post('/deposits/:id/approve', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.approveDeposit(req, res, next));
router.post('/deposits/:id/reject', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.rejectDeposit(req, res, next));
// Withdrawal settlement desk operations
router.get('/withdrawals', (req, res, next) => admin_controller_1.adminController.getWithdrawals(req, res, next));
router.post('/withdrawals/:id/settle', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.settleWithdrawal(req, res, next));
router.post('/withdrawals/:id/reject', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.rejectWithdrawal(req, res, next));
// KYC Compliance review operations
router.get('/kyc', (req, res, next) => admin_controller_1.adminController.getPendingKyc(req, res, next));
router.post('/kyc/:id/approve', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.approveKyc(req, res, next));
router.post('/kyc/:id/reject', auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.rejectKyc(req, res, next));
// Receiver Address Settings operations
router.get('/settings/addresses', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => admin_controller_1.adminController.getReceiverAddresses(req, res, next));
router.post('/settings/addresses', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.updateReceiverAddresses(req, res, next));
// Strict Admin-only endpoints
router.post('/returns/run', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.triggerMonthlyReturns(req, res, next));
router.get('/ledger/reconcile', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.getLedgerReconciliation(req, res, next));
router.get('/ledger/journals', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.getLedgerJournals(req, res, next));
router.post('/system/purge-demo', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.purgeDemoData(req, res, next));
// User Security & Account Controls
router.post('/users/:id/reset-password', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.resetUserPassword(req, res, next));
router.post('/users/:id/disable-2fa', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.disableUser2FA(req, res, next));
router.post('/users/:id/status', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.updateUserStatus(req, res, next));
// Global Money Transfer / Remittance Corridors
router.get('/remittance/transfers', (req, res, next) => admin_controller_1.adminController.getRemittanceTransfers(req, res, next));
router.patch('/remittance/transfers/:id', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => admin_controller_1.adminController.updateRemittanceTransfer(req, res, next));
// Startups & Venture Equity Management
router.post('/investments/listings', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.createStartupListing(req, res, next));
router.put('/investments/listings/:id', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.updateStartupListing(req, res, next));
router.delete('/investments/listings/:id', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.deleteStartupListing(req, res, next));
// P2P Escrow & Dispute Resolution
router.get('/p2p/orders', (req, res, next) => admin_controller_1.adminController.getP2POrders(req, res, next));
router.post('/p2p/orders/:id/resolve', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.resolveP2PDispute(req, res, next));
// Institutional Audit Logs
router.get('/audit-logs', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.getAdminAuditLogs(req, res, next));
// System Controls & Announcement Broadcast
router.get('/system/status', (req, res, next) => admin_controller_1.adminController.getSystemStatus(req, res, next));
router.post('/system/settings', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.updateSystemStatus(req, res, next));
// Platform Analytics Overview
router.get('/analytics/overview', (req, res, next) => admin_controller_1.adminController.getPlatformOverviewAnalytics(req, res, next));
exports.default = router;
