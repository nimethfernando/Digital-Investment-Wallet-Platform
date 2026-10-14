"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.use((0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]));
// Package operations
router.get('/packages', (req, res, next) => admin_controller_1.adminController.getPackages(req, res, next));
router.post('/packages/:id/approve', (req, res, next) => admin_controller_1.adminController.approvePackage(req, res, next));
// Deposit operations
router.get('/deposits', (req, res, next) => admin_controller_1.adminController.getDeposits(req, res, next));
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
// Strict Admin-only endpoints
router.post('/returns/run', (0, auth_1.requireRole)([client_1.Role.ADMIN]), auth_1.requireAdmin2FA, (req, res, next) => admin_controller_1.adminController.triggerMonthlyReturns(req, res, next));
router.get('/ledger/reconcile', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.getLedgerReconciliation(req, res, next));
router.get('/ledger/journals', (0, auth_1.requireRole)([client_1.Role.ADMIN]), (req, res, next) => admin_controller_1.adminController.getLedgerJournals(req, res, next));
exports.default = router;
