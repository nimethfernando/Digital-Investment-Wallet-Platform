"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const package_service_1 = require("../services/package.service");
const deposit_service_1 = require("../services/deposit.service");
const returns_job_1 = require("../services/returns.job");
const ledger_service_1 = require("../services/ledger.service");
const withdrawal_service_1 = require("../services/withdrawal.service");
const kyc_service_1 = require("../services/kyc.service");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class AdminController {
    /**
     * List all packages
     */
    async getPackages(req, res, next) {
        try {
            const { status, search, page, limit } = req.query;
            const result = await package_service_1.packageService.getAllPackages({
                status: status,
                search: search,
                page: page ? parseInt(page, 10) : undefined,
                limit: limit ? parseInt(limit, 10) : undefined,
            });
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Approve a pending package
     */
    async approvePackage(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const packageId = req.params.id;
            const { notes } = req.body;
            const updated = await package_service_1.packageService.adminApprovePackage(packageId, adminUserId, notes);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'APPROVE_PACKAGE',
                    entity: 'InvestmentPackage',
                    entityId: packageId,
                    details: `Approved package ${updated.packageCode} for $${new decimal_js_1.default(updated.amount.toString()).toFixed(2)} USD`,
                },
            });
            res.json({
                success: true,
                message: `Package ${updated.packageCode} has been approved and activated.`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List all deposit requests
     */
    async getDeposits(req, res, next) {
        try {
            const { status, search, page, limit } = req.query;
            const result = await deposit_service_1.depositService.getAllDeposits({
                status: status,
                search: search,
                page: page ? parseInt(page, 10) : undefined,
                limit: limit ? parseInt(limit, 10) : undefined,
            });
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Approve a deposit request
     */
    async approveDeposit(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const depositId = req.params.id;
            const { notes } = req.body;
            const result = await deposit_service_1.depositService.adminApproveDeposit(depositId, adminUserId, notes);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'APPROVE_DEPOSIT',
                    entity: 'DepositRequest',
                    entityId: depositId,
                    details: `Approved deposit ${result.deposit.depositCode} for $${new decimal_js_1.default(result.deposit.amount.toString()).toFixed(2)}`,
                },
            });
            res.json({
                success: true,
                message: `Deposit ${result.deposit.depositCode} successfully approved and credited.`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Reject a deposit request
     */
    async rejectDeposit(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const depositId = req.params.id;
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ success: false, message: 'Rejection reason is required' });
            }
            const rejected = await deposit_service_1.depositService.adminRejectDeposit(depositId, adminUserId, reason);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'REJECT_DEPOSIT',
                    entity: 'DepositRequest',
                    entityId: depositId,
                    details: `Rejected deposit ${rejected.depositCode}. Reason: ${reason}`,
                },
            });
            res.json({
                success: true,
                message: `Deposit ${rejected.depositCode} has been rejected.`,
                data: rejected,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Manually trigger monthly returns job
     */
    async triggerMonthlyReturns(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ success: false, message: 'Audit reason is required for manual returns payout' });
            }
            const summary = await returns_job_1.returnsJobService.executeMonthlyReturns({
                manualRun: true,
                adminUserId,
                adminReason: reason,
            });
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'MANUAL_RETURNS_PAYOUT',
                    entity: 'ReturnsEngine',
                    entityId: summary.executionId,
                    details: `Manual payout executed. Credited: ${summary.creditedCount}, Total: $${summary.totalDistributedUsd}. Reason: ${reason}`,
                },
            });
            res.json({
                success: true,
                message: `Monthly returns job completed. ${summary.creditedCount} packages credited, $${summary.totalDistributedUsd} distributed.`,
                data: summary,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Run ledger reconciliation and health verification
     */
    async getLedgerReconciliation(req, res, next) {
        try {
            const report = await ledger_service_1.ledgerService.reconcileLedger();
            res.json({ success: true, data: report });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * View immutable ledger journals
     */
    async getLedgerJournals(req, res, next) {
        try {
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const skip = (page - 1) * limit;
            const [journals, total] = await Promise.all([
                prisma_1.prisma.ledgerJournal.findMany({
                    include: {
                        entries: {
                            include: { account: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma_1.prisma.ledgerJournal.count(),
            ]);
            res.json({
                success: true,
                data: {
                    journals: journals.map((j) => ({
                        id: j.id,
                        idempotencyKey: j.idempotencyKey,
                        referenceType: j.referenceType,
                        referenceId: j.referenceId,
                        notes: j.notes,
                        createdBy: j.createdBy,
                        createdAt: j.createdAt,
                        entries: j.entries.map((e) => ({
                            id: e.id,
                            accountId: e.accountId,
                            accountName: e.account.accountName,
                            direction: e.direction,
                            amount: new decimal_js_1.default(e.amount.toString()).toFixed(2),
                            currency: e.currency,
                            userId: e.userId,
                        })),
                    })),
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List all withdrawal requests
     */
    async getWithdrawals(req, res, next) {
        try {
            const { status, search, page, limit } = req.query;
            const result = await withdrawal_service_1.withdrawalService.getAllWithdrawals({
                status: status,
                search: search,
                page: page ? parseInt(page, 10) : undefined,
                limit: limit ? parseInt(limit, 10) : undefined,
            });
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Settle a withdrawal request
     */
    async settleWithdrawal(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const withdrawalId = req.params.id;
            const { settlementReference, adminNotes } = req.body;
            if (!settlementReference) {
                return res.status(400).json({
                    success: false,
                    message: 'Settlement payout reference (e.g. TX hash, wire ref, or receipt code) is required',
                });
            }
            const settled = await withdrawal_service_1.withdrawalService.adminSettleWithdrawal(withdrawalId, adminUserId, settlementReference, adminNotes);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'SETTLE_WITHDRAWAL',
                    entity: 'WithdrawalRequest',
                    entityId: withdrawalId,
                    details: `Settled withdrawal ${settled.requestCode} ($${new decimal_js_1.default(settled.amount.toString()).toFixed(2)}). Ref: ${settlementReference}`,
                },
            });
            res.json({
                success: true,
                message: `Withdrawal ${settled.requestCode} has been successfully settled and recorded in the double-entry ledger.`,
                data: settled,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Reject a withdrawal request and refund to available balance
     */
    async rejectWithdrawal(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const withdrawalId = req.params.id;
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ success: false, message: 'Rejection reason is required' });
            }
            const rejected = await withdrawal_service_1.withdrawalService.adminRejectWithdrawal(withdrawalId, adminUserId, reason);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'REJECT_WITHDRAWAL',
                    entity: 'WithdrawalRequest',
                    entityId: withdrawalId,
                    details: `Rejected withdrawal ${rejected.requestCode}. Reason: ${reason}`,
                },
            });
            res.json({
                success: true,
                message: `Withdrawal ${rejected.requestCode} has been rejected and funds refunded to user available balance.`,
                data: rejected,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List pending KYC submissions
     */
    async getPendingKyc(req, res, next) {
        try {
            const documents = await kyc_service_1.kycService.getPendingKyc();
            res.json({ success: true, data: documents });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Approve KYC submission
     */
    async approveKyc(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const documentId = req.params.id;
            const result = await kyc_service_1.kycService.approveKyc(documentId, adminUserId);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'APPROVE_KYC',
                    entity: 'KycDocument',
                    entityId: documentId,
                    details: 'Approved investor identity verification document.',
                },
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Reject KYC submission
     */
    async rejectKyc(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const documentId = req.params.id;
            const { reason } = req.body;
            const result = await kyc_service_1.kycService.rejectKyc(documentId, adminUserId, reason);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'REJECT_KYC',
                    entity: 'KycDocument',
                    entityId: documentId,
                    details: `Rejected KYC document. Reason: ${reason || 'Unspecified'}`,
                },
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
