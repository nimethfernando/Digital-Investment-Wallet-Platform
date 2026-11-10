"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const package_service_1 = require("../services/package.service");
const deposit_service_1 = require("../services/deposit.service");
const returns_job_1 = require("../services/returns.job");
const ledger_service_1 = require("../services/ledger.service");
const withdrawal_service_1 = require("../services/withdrawal.service");
const kyc_service_1 = require("../services/kyc.service");
const p2p_service_1 = require("../services/p2p.service");
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
            res.json({
                success: true,
                data: result.packages,
                packages: result.packages,
                meta: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                },
            });
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
            res.json({
                success: true,
                data: result.deposits,
                deposits: result.deposits,
                meta: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                },
            });
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
            const { notes, txHash } = req.body;
            const result = await deposit_service_1.depositService.adminApproveDeposit(depositId, adminUserId, notes, txHash);
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
            const { reason, cycleMonth, forceNextPeriod } = req.body || {};
            const auditReason = reason || 'Admin batch monthly yield distribution (1% standard return)';
            const summary = await returns_job_1.returnsJobService.executeMonthlyReturns({
                manualRun: true,
                adminUserId,
                adminReason: auditReason,
                cycleMonth,
                forceNextPeriod: Boolean(forceNextPeriod),
            });
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'MANUAL_RETURNS_PAYOUT',
                    entity: 'ReturnsEngine',
                    entityId: summary.executionId,
                    details: `Manual payout executed. Credited: ${summary.creditedCount}, Total: $${summary.totalDistributedUsd}. Reason: ${auditReason}`,
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
     * Settle entire package returns and release principal together (Full Lump-Sum / Maturity Settlement)
     */
    async settleFullPackage(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const packageId = req.params.id;
            const result = await returns_job_1.returnsJobService.processFullPackageSettlement(packageId, adminUserId);
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'FULL_PACKAGE_SETTLEMENT',
                    entity: 'InvestmentPackage',
                    entityId: packageId,
                    details: `Full package settlement processed for ${result.packageCode}. Remaining returns ($${result.totalReturnsCreditedInBatch}) + Principal ($${result.principalAmount}) released. Total: $${result.totalPayoutProcessed}.`,
                },
            });
            res.json({
                success: true,
                message: `Full settlement processed for ${result.packageCode}. Principal and all remaining returns credited ($${result.totalPayoutProcessed} USD total).`,
                data: result,
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
            res.json({
                success: true,
                data: result.withdrawals,
                withdrawals: result.withdrawals,
                meta: {
                    total: result.total,
                    page: result.page,
                    totalPages: result.totalPages,
                },
            });
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
            const reason = req.body?.reason || req.body?.rejectionReason;
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
    /**
     * Purge demo/test data for pristine production launch
     */
    async purgeDemoData(req, res, next) {
        try {
            const adminUserId = req.user.id;
            // 1. Purge double-entry ledger entries, journals & user transactions so Total Journal Postings = $0.00
            await prisma_1.prisma.ledgerEntry.deleteMany({});
            await prisma_1.prisma.ledgerJournal.deleteMany({});
            await prisma_1.prisma.transaction.deleteMany({});
            // 2. Purge packages, returns, deposits, withdrawals, cards & KYC test submissions
            await prisma_1.prisma.packageReturn.deleteMany({});
            await prisma_1.prisma.investmentPackage.deleteMany({});
            await prisma_1.prisma.withdrawalRequest.deleteMany({});
            await prisma_1.prisma.depositRequest.deleteMany({});
            await prisma_1.prisma.exchangeOrder.deleteMany({});
            await prisma_1.prisma.virtualCard.deleteMany({});
            await prisma_1.prisma.kycDocument.deleteMany({});
            // 3. Purge P2P, OTC, Global Transfers, Startup Commitments, Token Early Access & Tickets
            await prisma_1.prisma.p2PMessage.deleteMany({});
            await prisma_1.prisma.p2POrder.deleteMany({});
            await prisma_1.prisma.otcMessage.deleteMany({});
            await prisma_1.prisma.otcTrade.deleteMany({});
            await prisma_1.prisma.otcQuote.deleteMany({});
            await prisma_1.prisma.globalTransfer.deleteMany({});
            await prisma_1.prisma.tokenEarlyAccess.deleteMany({});
            await prisma_1.prisma.investmentCommitment.deleteMany({});
            await prisma_1.prisma.investmentWatchlist.deleteMany({});
            await prisma_1.prisma.investmentInquiry.deleteMany({});
            await prisma_1.prisma.ticketReply.deleteMany({});
            await prisma_1.prisma.supportTicket.deleteMany({});
            await prisma_1.prisma.inquiry.deleteMany({});
            // 4. Reset all wallet balances to 0.00
            await prisma_1.prisma.walletBalance.updateMany({
                data: {
                    availableBalance: '0.00000000',
                    lockedPrincipal: '0.00000000',
                    pendingSettlement: '0.00000000',
                },
            });
            // 5. Remove synthetic test/demo user accounts while preserving Admin & Corporate OTC desks
            await prisma_1.prisma.user.deleteMany({
                where: {
                    id: { not: adminUserId },
                    OR: [
                        { email: 'investor@avorabank.com' },
                        { email: { startsWith: 'e2e_' } },
                        { email: { startsWith: 'fintech_tester_' } },
                        { email: { startsWith: 'test_' } },
                    ],
                },
            });
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'PURGE_DEMO_DATA',
                    entity: 'SystemDatabase',
                    entityId: 'ALL',
                    details: 'Purged all ledger journals, demo packages, test returns, transactions, and test trades for clean $0.00 production state.',
                },
            });
            res.json({
                success: true,
                message: 'All demo data and ledger journal postings have been reset to $0.00. Platform is now in a clean production state.',
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get current receiver deposit addresses and bank settings
     */
    async getReceiverAddresses(req, res, next) {
        try {
            const data = await deposit_service_1.depositService.getReceiverSettings();
            res.json({
                success: true,
                data,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update receiver deposit addresses and bank settings
     */
    async updateReceiverAddresses(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const updated = await deposit_service_1.depositService.updateReceiverSettings(adminUserId, req.body);
            res.json({
                success: true,
                message: 'Receiver addresses and bank wire instructions successfully updated.',
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List all startup crowdfunding investments and all startup listings across the platform
     */
    async getInvestments(req, res, next) {
        try {
            const [commitments, listings] = await Promise.all([
                prisma_1.prisma.investmentCommitment.findMany({
                    include: {
                        investor: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                            },
                        },
                        listing: {
                            select: {
                                id: true,
                                slug: true,
                                companyName: true,
                                industry: true,
                                stage: true,
                                country: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma_1.prisma.startupListing.findMany({
                    orderBy: { createdAt: 'desc' },
                }),
            ]);
            res.json({ success: true, data: { commitments, listings } });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List all token early access and whitelist registrations
     */
    async getTokenAllocations(req, res, next) {
        try {
            const allocations = await prisma_1.prisma.tokenEarlyAccess.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            });
            res.json({ success: true, data: { allocations } });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update investment package FD lock-in tenure & maturity date
     */
    async updatePackageTenure(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const packageId = req.params.id;
            const { lockInMonths, newEndDate, returnRateSnapshot, adminNotes } = req.body;
            const pkg = await prisma_1.prisma.investmentPackage.findUnique({
                where: { id: packageId },
                include: { user: true },
            });
            if (!pkg) {
                return res.status(404).json({ success: false, message: 'Investment package not found' });
            }
            const updateData = {};
            let calculatedEndDate = null;
            if (lockInMonths !== undefined && lockInMonths !== null && lockInMonths !== '') {
                const months = parseInt(lockInMonths, 10);
                if (isNaN(months) || months < 1 || months > 60) {
                    return res.status(400).json({ success: false, message: 'lockInMonths must be an integer between 1 and 60' });
                }
                updateData.lockInMonths = months;
                const startDate = pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || new Date();
                calculatedEndDate = new Date(startDate);
                calculatedEndDate.setMonth(calculatedEndDate.getMonth() + months);
                updateData.lockInEnd = calculatedEndDate;
                updateData.withdrawalEligibilityDate = calculatedEndDate;
            }
            if (newEndDate) {
                const customDate = new Date(newEndDate);
                if (isNaN(customDate.getTime())) {
                    return res.status(400).json({ success: false, message: 'Invalid custom end date' });
                }
                updateData.lockInEnd = customDate;
                updateData.withdrawalEligibilityDate = customDate;
            }
            if (returnRateSnapshot !== undefined && returnRateSnapshot !== null && returnRateSnapshot !== '') {
                updateData.returnRateSnapshot = new decimal_js_1.default(returnRateSnapshot);
            }
            if (adminNotes) {
                updateData.adminNotes = pkg.adminNotes
                    ? `${pkg.adminNotes}\n[${new Date().toISOString()}] ${adminNotes}`
                    : adminNotes;
            }
            const updated = await prisma_1.prisma.investmentPackage.update({
                where: { id: packageId },
                data: updateData,
                include: { user: true, returns: true },
            });
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'UPDATE_PACKAGE_TENURE',
                    entity: 'InvestmentPackage',
                    entityId: packageId,
                    details: `Updated package ${pkg.packageCode} tenure to ${updateData.lockInMonths || pkg.lockInMonths} months. Lock end: ${updated.lockInEnd?.toISOString()}. Notes: ${adminNotes || 'None'}`,
                },
            });
            res.json({
                success: true,
                message: `Package ${pkg.packageCode} FD lock tenure updated to ${updated.lockInMonths} months (Maturity: ${updated.lockInEnd ? new Date(updated.lockInEnd).toLocaleDateString() : 'Active'}).`,
                data: {
                    ...updated,
                    amount: new decimal_js_1.default(updated.amount.toString()).toFixed(2),
                    returnRateSnapshot: new decimal_js_1.default(updated.returnRateSnapshot.toString()).toFixed(4),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update startup campaign valuation and mark-to-market performance
     */
    async updateStartupValuation(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const listingId = req.params.id;
            const { valuation, stage, growthNotes } = req.body;
            if (!valuation || isNaN(parseFloat(valuation))) {
                return res.status(400).json({ success: false, message: 'Valid valuation number is required' });
            }
            const listing = await prisma_1.prisma.startupListing.findUnique({
                where: { id: listingId },
                include: { investments: true },
            });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'Startup listing not found' });
            }
            const oldValuation = new decimal_js_1.default(listing.valuation.toString());
            const newValuation = new decimal_js_1.default(valuation);
            const valuationMultiplier = newValuation.dividedBy(oldValuation);
            const gainPct = valuationMultiplier.minus(1).times(100);
            // Update Listing
            const updatedListing = await prisma_1.prisma.startupListing.update({
                where: { id: listingId },
                data: {
                    valuation: newValuation,
                    stage: stage || listing.stage,
                    financialHighlights: growthNotes
                        ? `${listing.financialHighlights || ''}\n[${new Date().toISOString()}] ${growthNotes}`
                        : listing.financialHighlights,
                },
            });
            // Update all investor commitments for this startup
            for (const commitment of listing.investments) {
                const netInvested = new decimal_js_1.default(commitment.netInvestedAmount.toString());
                const updatedHoldingValue = netInvested.times(valuationMultiplier);
                const commitmentGainPct = updatedHoldingValue.minus(netInvested).dividedBy(netInvested).times(100);
                await prisma_1.prisma.investmentCommitment.update({
                    where: { id: commitment.id },
                    data: {
                        currentValuation: updatedHoldingValue,
                        unrealizedReturnPct: commitmentGainPct,
                        notes: growthNotes
                            ? `${commitment.notes || ''}\n[${new Date().toISOString()}] Valuation updated to $${newValuation.toLocaleString()} (+${gainPct.toFixed(1)}%)`
                            : commitment.notes,
                    },
                });
            }
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'UPDATE_STARTUP_VALUATION',
                    entity: 'StartupListing',
                    entityId: listingId,
                    details: `Updated ${listing.companyName} valuation from $${oldValuation.toLocaleString()} to $${newValuation.toLocaleString()} (${gainPct.greaterThanOrEqualTo(0) ? '+' : ''}${gainPct.toFixed(2)}%). Updated ${listing.investments.length} investor positions.`,
                },
            });
            res.json({
                success: true,
                message: `Successfully updated ${listing.companyName} valuation to $${newValuation.toLocaleString()} (${gainPct.greaterThanOrEqualTo(0) ? '+' : ''}${gainPct.toFixed(1)}%). Recalculated ${listing.investments.length} investor holdings.`,
                data: {
                    listing: updatedListing,
                    gainPct: gainPct.toFixed(2),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Distribute cash dividends or exit proceeds to startup investors
     */
    async distributeStartupExit(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const listingId = req.params.id;
            const { distributionType, exitMultiplier, notes } = req.body;
            const totalProceeds = req.body.totalProceeds ?? req.body.totalGrossProceeds;
            const listing = await prisma_1.prisma.startupListing.findUnique({
                where: { id: listingId },
                include: {
                    investments: {
                        where: { status: { in: ['CLEARED_FUNDS', 'ACTIVE', 'DOCUMENT_SIGNED'] } },
                        include: { investor: true },
                    },
                },
            });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'Startup listing not found' });
            }
            if (listing.investments.length === 0) {
                return res.status(400).json({ success: false, message: 'No active investor commitments found for this listing' });
            }
            const totalRaised = listing.investments.reduce((sum, inv) => sum.plus(new decimal_js_1.default(inv.netInvestedAmount.toString())), new decimal_js_1.default(0));
            if (totalRaised.isZero()) {
                return res.status(400).json({ success: false, message: 'Total net invested capital is zero' });
            }
            // Calculate total payout pool
            let totalPool = new decimal_js_1.default(0);
            if (totalProceeds && !isNaN(parseFloat(totalProceeds))) {
                totalPool = new decimal_js_1.default(totalProceeds);
            }
            else if (exitMultiplier && !isNaN(parseFloat(exitMultiplier))) {
                totalPool = totalRaised.times(new decimal_js_1.default(exitMultiplier));
            }
            else {
                return res.status(400).json({ success: false, message: 'Please provide either totalProceeds or exitMultiplier' });
            }
            const distributedRecords = [];
            let totalDistributedGross = new decimal_js_1.default(0);
            let totalPlatformFees = new decimal_js_1.default(0);
            let totalNetCredited = new decimal_js_1.default(0);
            // Distribute pro-rata to each investor
            for (const inv of listing.investments) {
                const netInvested = new decimal_js_1.default(inv.netInvestedAmount.toString());
                const investorShareFraction = netInvested.dividedBy(totalRaised);
                const grossInvestorProceeds = totalPool.times(investorShareFraction);
                // Principal returned 100% fee-free
                const capitalReturn = decimal_js_1.default.min(grossInvestorProceeds, netInvested);
                const eligibleProfit = decimal_js_1.default.max(grossInvestorProceeds.minus(netInvested), new decimal_js_1.default(0));
                // 5% profit-share fee strictly on net profit
                const profitFeePct = new decimal_js_1.default(5.00);
                const platformFeeAmount = eligibleProfit.times(profitFeePct.dividedBy(100));
                const netCashPayout = capitalReturn.plus(eligibleProfit.minus(platformFeeAmount));
                // 1. Ensure user has a wallet
                await ledger_service_1.ledgerService.ensureWallet(inv.investorUserId);
                const currentUsdBal = await prisma_1.prisma.walletBalance.findFirst({
                    where: { wallet: { userId: inv.investorUserId }, currency: 'USD' },
                });
                const balBefore = currentUsdBal ? new decimal_js_1.default(currentUsdBal.availableBalance.toString()) : new decimal_js_1.default(0);
                const balAfter = balBefore.plus(netCashPayout);
                // 2. Credit investor available balance in USD
                await prisma_1.prisma.walletBalance.updateMany({
                    where: {
                        wallet: { userId: inv.investorUserId },
                        currency: 'USD',
                    },
                    data: {
                        availableBalance: { increment: netCashPayout.toNumber() },
                    },
                });
                // 3. Create Transaction Ledger entry for user
                const txCode = `DIST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
                await prisma_1.prisma.transaction.create({
                    data: {
                        userId: inv.investorUserId,
                        transactionCode: txCode,
                        type: 'PRINCIPAL_RELEASE',
                        amount: netCashPayout,
                        currency: 'USD',
                        status: 'COMPLETED',
                        balanceBefore: balBefore,
                        balanceAfter: balAfter,
                        settlementReference: txCode,
                        notes: `${distributionType === 'DIVIDEND' ? 'Startup Dividend Distribution' : 'Startup Exit Payout'}: ${listing.companyName} (Principal: $${capitalReturn.toFixed(2)}, Net Gain: $${eligibleProfit.minus(platformFeeAmount).toFixed(2)})`,
                    },
                });
                // 4. Update InvestmentCommitment status and financials
                await prisma_1.prisma.investmentCommitment.update({
                    where: { id: inv.id },
                    data: {
                        realizedProceeds: { increment: grossInvestorProceeds },
                        returnOfCapital: { increment: capitalReturn },
                        eligibleNetProfit: { increment: eligibleProfit },
                        profitShareFeeAmount: { increment: platformFeeAmount },
                        netDistributedProfit: { increment: eligibleProfit.minus(platformFeeAmount) },
                        status: distributionType === 'DIVIDEND' ? 'ACTIVE' : 'EXITED',
                        settlementReference: txCode,
                        notes: notes ? `${inv.notes || ''}\n[${new Date().toISOString()}] ${notes}` : inv.notes,
                    },
                });
                totalDistributedGross = totalDistributedGross.plus(grossInvestorProceeds);
                totalPlatformFees = totalPlatformFees.plus(platformFeeAmount);
                totalNetCredited = totalNetCredited.plus(netCashPayout);
                distributedRecords.push({
                    investorEmail: inv.investor?.email,
                    netInvested: netInvested.toFixed(2),
                    grossPayout: grossInvestorProceeds.toFixed(2),
                    platformFee: platformFeeAmount.toFixed(2),
                    netCredited: netCashPayout.toFixed(2),
                });
            }
            // If full exit, mark listing as CLOSED
            if (distributionType !== 'DIVIDEND') {
                await prisma_1.prisma.startupListing.update({
                    where: { id: listingId },
                    data: { status: 'CLOSED' },
                });
            }
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'STARTUP_EXIT_DISTRIBUTION',
                    entity: 'StartupListing',
                    entityId: listingId,
                    details: `Distributed ${distributionType} for ${listing.companyName}. Gross Pool: $${totalPool.toFixed(2)}, Net Credited: $${totalNetCredited.toFixed(2)}, 5% Profit Share Fee: $${totalPlatformFees.toFixed(2)} across ${distributedRecords.length} investors.`,
                },
            });
            res.json({
                success: true,
                message: `Successfully distributed $${totalNetCredited.toFixed(2)} USD to ${distributedRecords.length} investors for ${listing.companyName}. 5% platform fee: $${totalPlatformFees.toFixed(2)} USD.`,
                data: {
                    listingName: listing.companyName,
                    totalGrossDistributed: totalDistributedGross.toFixed(2),
                    totalPlatformFees: totalPlatformFees.toFixed(2),
                    totalNetCredited: totalNetCredited.toFixed(2),
                    investorCount: distributedRecords.length,
                    distributions: distributedRecords,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List registered users with search, role, and KYC filters
     */
    async getUsers(req, res, next) {
        try {
            const { search, role, kycStatus, page, limit } = req.query;
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 50;
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (role && Object.values(client_1.Role).includes(role)) {
                where.role = role;
            }
            const normalizedFilterKyc = kycStatus === 'VERIFIED'
                ? client_1.KycStatus.APPROVED
                : kycStatus === 'NOT_SUBMITTED'
                    ? client_1.KycStatus.NOT_STARTED
                    : kycStatus;
            if (normalizedFilterKyc && Object.values(client_1.KycStatus).includes(normalizedFilterKyc)) {
                where.kycStatus = normalizedFilterKyc;
            }
            if (search && typeof search === 'string' && search.trim()) {
                const query = search.trim();
                where.OR = [
                    { email: { contains: query } },
                    { firstName: { contains: query } },
                    { lastName: { contains: query } },
                    { phone: { contains: query } },
                ];
            }
            const [users, total] = await Promise.all([
                prisma_1.prisma.user.findMany({
                    where,
                    include: {
                        wallet: {
                            include: { balances: true },
                        },
                        _count: {
                            select: {
                                packages: true,
                                investorCommitments: true,
                                deposits: true,
                                withdrawals: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitNum,
                }),
                prisma_1.prisma.user.count({ where }),
            ]);
            const formatted = users.map((u) => {
                const usdBal = u.wallet?.balances.find((b) => b.currency === 'USD')?.availableBalance?.toString() || '0.00';
                const usdtBal = u.wallet?.balances.find((b) => b.currency === 'USDT')?.availableBalance?.toString() || '0.00';
                const isLocked = !!(u.withdrawalLockedUntil && new Date() < u.withdrawalLockedUntil);
                return {
                    id: u.id,
                    email: u.email,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    phone: u.phone,
                    country: u.country,
                    role: u.role,
                    kycStatus: u.kycStatus,
                    twoFactorEnabled: u.twoFactorEnabled,
                    accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(u.id),
                    isWithdrawalLocked: isLocked,
                    withdrawalLockedUntil: u.withdrawalLockedUntil,
                    status: u.status,
                    balances: {
                        USD: parseFloat(usdBal).toFixed(2),
                        USDT: parseFloat(usdtBal).toFixed(2),
                    },
                    walletBalances: u.wallet?.balances.map((b) => ({
                        currency: b.currency,
                        available: b.availableBalance.toString(),
                        locked: b.lockedPrincipal.toString(),
                    })) || [],
                    counts: u._count,
                    createdAt: u.createdAt,
                };
            });
            res.json({
                success: true,
                data: formatted,
                users: formatted,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get single user detailed profile
     */
    async getUserDetails(req, res, next) {
        try {
            const id = String(req.params.id);
            const user = await prisma_1.prisma.user.findUnique({
                where: { id },
                include: {
                    wallet: {
                        include: { balances: true },
                    },
                    packages: {
                        orderBy: { createdAt: 'desc' },
                        take: 10,
                    },
                    transactions: {
                        orderBy: { createdAt: 'desc' },
                        take: 20,
                    },
                    kycDocuments: true,
                    _count: {
                        select: {
                            packages: true,
                            investorCommitments: true,
                            deposits: true,
                            withdrawals: true,
                        },
                    },
                },
            });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            res.json({
                success: true,
                data: {
                    ...user,
                    accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(user.id),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update user role, KYC status, or freeze withdrawals
     */
    async updateUser(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : undefined;
            const id = String(req.params.id);
            const { role, kycStatus, isWithdrawalLocked, notes } = req.body;
            const dataToUpdate = {};
            if (role && Object.values(client_1.Role).includes(role)) {
                dataToUpdate.role = role;
            }
            const normalizedUpdateKyc = kycStatus === 'VERIFIED'
                ? client_1.KycStatus.APPROVED
                : kycStatus === 'NOT_SUBMITTED'
                    ? client_1.KycStatus.NOT_STARTED
                    : kycStatus;
            if (normalizedUpdateKyc && Object.values(client_1.KycStatus).includes(normalizedUpdateKyc)) {
                dataToUpdate.kycStatus = normalizedUpdateKyc;
            }
            if (typeof isWithdrawalLocked === 'boolean') {
                dataToUpdate.withdrawalLockedUntil = isWithdrawalLocked ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
            }
            const updated = await prisma_1.prisma.user.update({
                where: { id },
                data: dataToUpdate,
            });
            if (adminUserId) {
                await prisma_1.prisma.adminAuditLog.create({
                    data: {
                        userId: adminUserId,
                        action: 'ADMIN_USER_UPDATE',
                        entity: 'User',
                        entityId: id,
                        details: `Updated user ${updated.email}: ${JSON.stringify(dataToUpdate)}. Notes: ${notes || 'None'}`,
                    },
                });
            }
            res.json({
                success: true,
                message: `User ${updated.email} updated successfully`,
                data: {
                    id: updated.id,
                    role: updated.role,
                    kycStatus: updated.kycStatus,
                    isWithdrawalLocked: !!(updated.withdrawalLockedUntil && new Date() < updated.withdrawalLockedUntil),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Adjust user balance directly via double-entry ledger with full audit trail
     */
    async adjustUserBalance(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { currency = 'USD', amount, type, reason } = req.body;
            if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                return res.status(400).json({ success: false, message: 'Valid positive amount required' });
            }
            if (type !== 'CREDIT' && type !== 'DEBIT') {
                return res.status(400).json({ success: false, message: 'Adjustment type must be CREDIT or DEBIT' });
            }
            if (!reason || !reason.trim()) {
                return res.status(400).json({ success: false, message: 'Adjustment reason is required for institutional audit' });
            }
            const result = await ledger_service_1.ledgerService.processAdminBalanceAdjustment({
                userId: id,
                adminUserId,
                currency,
                amount: parseFloat(amount),
                type,
                reason: reason.trim(),
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_BALANCE_ADJUSTMENT',
                    entity: 'Wallet',
                    entityId: result.walletId,
                    details: `Admin ${type} of ${amount} ${currency} to user ${id}. Reason: ${reason}`,
                },
            });
            res.json({
                success: true,
                message: `Successfully executed ${type} of ${amount} ${currency}. New balance: ${result.balanceAfter} ${currency}`,
                data: result,
            });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message || 'Balance adjustment failed' });
        }
    }
    /**
     * Get platform fee & FD configuration settings
     */
    async getPlatformConfig(req, res, next) {
        try {
            const settings = await prisma_1.prisma.cmsSetting.findMany({
                where: {
                    group: { in: ['INVESTMENT', 'COMMISSION', 'WITHDRAWAL'] },
                },
            });
            const configMap = {};
            settings.forEach((s) => {
                configMap[s.key] = s.value;
            });
            const defaults = {
                // Fixed Deposit (FD) Engine Defaults
                package_monthly_return_rate: configMap['package_monthly_return_rate'] || '0.0100', // 1.00%
                package_lock_in_months: configMap['package_lock_in_months'] || '6',
                package_min_amount: configMap['package_min_amount'] || '1000',
                package_max_amount: configMap['package_max_amount'] || '10000',
                payout_day_of_month: configMap['payout_day_of_month'] || '1',
                withdrawal_processing_days: configMap['withdrawal_processing_days'] || '15',
                withdrawal_window_day: configMap['withdrawal_window_day'] || '1',
                // Platform Commissions & Fees Defaults
                razorpay_commission_percent: configMap['razorpay_commission_percent'] || '5.0',
                razorpay_gateway_fee_percent: configMap['razorpay_gateway_fee_percent'] || '3.0',
                razorpay_key_id: configMap['razorpay_key_id'] || process.env.RAZORPAY_KEY_ID || '',
                razorpay_webhook_secret: configMap['razorpay_webhook_secret'] || process.env.RAZORPAY_WEBHOOK_SECRET || '',
                remittance_fee_percent: configMap['remittance_fee_percent'] || '3.0',
                remittance_margin_percent: configMap['remittance_margin_percent'] || '2.0',
                startup_allocation_fee_percent: configMap['startup_allocation_fee_percent'] || '5.0',
                startup_profit_share_percent: configMap['startup_profit_share_percent'] || '5.0',
                otc_spread_percent: configMap['otc_spread_percent'] || '1.0',
                p2p_fee_percent: configMap['p2p_fee_percent'] || '0.0',
                virtual_card_issuance_fee: configMap['virtual_card_issuance_fee'] || '10.00',
            };
            res.json({
                success: true,
                data: defaults,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update platform fee & FD configuration settings
     */
    async updatePlatformConfig(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : undefined;
            const { settings } = req.body;
            if (!settings || typeof settings !== 'object') {
                return res.status(400).json({ success: false, message: 'Settings payload object required' });
            }
            const updatedKeys = [];
            for (const [key, value] of Object.entries(settings)) {
                if (value !== undefined && value !== null) {
                    let group = 'COMMISSION';
                    if (key.startsWith('package_') || key === 'payout_day_of_month')
                        group = 'INVESTMENT';
                    if (key.startsWith('withdrawal_'))
                        group = 'WITHDRAWAL';
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key },
                        update: { value: String(value) },
                        create: {
                            group,
                            key,
                            value: String(value),
                            description: `Configured via Admin Portal for ${key}`,
                        },
                    });
                    updatedKeys.push(key);
                }
            }
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'PLATFORM_CONFIG_UPDATE',
                    entity: 'CmsSetting',
                    details: `Updated ${updatedKeys.length} settings: ${JSON.stringify(settings)}`,
                },
            });
            res.json({
                success: true,
                message: `Successfully updated ${updatedKeys.length} platform parameters`,
                updatedKeys,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Reset user password (admin bypass)
     */
    async resetUserPassword(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { newPassword } = req.body;
            const passwordToSet = newPassword && newPassword.trim().length >= 6
                ? newPassword.trim()
                : 'AvoraPass_' + Math.random().toString(36).substring(2, 8) + '!';
            const passwordHash = await bcryptjs_1.default.hash(passwordToSet, 12);
            const user = await prisma_1.prisma.user.update({
                where: { id },
                data: { passwordHash },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_RESET_PASSWORD',
                    entity: 'User',
                    entityId: id,
                    details: `Admin reset password for user ${user.email}`,
                },
            });
            res.json({
                success: true,
                message: `Password updated successfully for ${user.email}`,
                temporaryPassword: passwordToSet,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Disable user 2FA (admin lockout relief)
     */
    async disableUser2FA(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const user = await prisma_1.prisma.user.update({
                where: { id },
                data: {
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_DISABLE_2FA',
                    entity: 'User',
                    entityId: id,
                    details: `Admin cleared 2FA security for user ${user.email}`,
                },
            });
            res.json({
                success: true,
                message: `Two-factor authentication disabled for ${user.email}`,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update user status (ACTIVE, SUSPENDED, LOCKED)
     */
    async updateUserStatus(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { status } = req.body;
            if (!['ACTIVE', 'SUSPENDED', 'LOCKED'].includes(status)) {
                return res.status(400).json({ success: false, message: 'Invalid status. Must be ACTIVE, SUSPENDED, or LOCKED' });
            }
            const user = await prisma_1.prisma.user.update({
                where: { id },
                data: { status: status },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_UPDATE_USER_STATUS',
                    entity: 'User',
                    entityId: id,
                    details: `Admin set status of user ${user.email} to ${status}`,
                },
            });
            res.json({
                success: true,
                message: `Account status updated to ${status} for ${user.email}`,
                status: user.status,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List global remittance transfers
     */
    async getRemittanceTransfers(req, res, next) {
        try {
            const { search, status, page, limit } = req.query;
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 30;
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (status && typeof status === 'string' && status !== 'ALL') {
                where.status = status;
            }
            if (search && typeof search === 'string' && search.trim()) {
                const query = search.trim();
                where.OR = [
                    { transferCode: { contains: query } },
                    { senderEmail: { contains: query } },
                    { senderName: { contains: query } },
                    { recipientName: { contains: query } },
                    { recipientAccount: { contains: query } },
                    { destinationCountry: { contains: query } },
                ];
            }
            const [transfers, total] = await Promise.all([
                prisma_1.prisma.globalTransfer.findMany({
                    where,
                    include: {
                        user: {
                            select: { id: true, email: true, firstName: true, lastName: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitNum,
                }),
                prisma_1.prisma.globalTransfer.count({ where }),
            ]);
            res.json({
                success: true,
                data: transfers,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update remittance transfer status & compliance notes
     */
    async updateRemittanceTransfer(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { status, complianceNotes, rejectionReason } = req.body;
            const existing = await prisma_1.prisma.globalTransfer.findUnique({ where: { id } });
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Transfer not found' });
            }
            const updateData = {};
            if (status)
                updateData.status = status;
            if (complianceNotes !== undefined)
                updateData.complianceNotes = complianceNotes;
            if (rejectionReason !== undefined)
                updateData.rejectionReason = rejectionReason;
            if (status === 'COMPLETED')
                updateData.completedAt = new Date();
            const updated = await prisma_1.prisma.globalTransfer.update({
                where: { id },
                data: updateData,
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'REMITTANCE_TRANSFER_UPDATE',
                    entity: 'GlobalTransfer',
                    entityId: id,
                    details: `Updated transfer ${updated.transferCode} status to ${status}. Compliance: ${complianceNotes || 'N/A'}`,
                },
            });
            res.json({
                success: true,
                message: `Transfer ${updated.transferCode} status updated to ${updated.status}`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Create a new startup crowdfunding campaign
     */
    async createStartupListing(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { companyName, tagline, country = 'United States', countryCode = 'US', city = 'San Francisco', industry = 'Fintech', stage = 'SEED', instrument = 'SAFE', valuation, fundingTarget, minInvestment = 250, pitchOverview, deadline, logoUrl, coverImageUrl, pitchDeckUrl, } = req.body;
            if (!companyName || !tagline || !valuation || !fundingTarget || !pitchOverview) {
                return res.status(400).json({ success: false, message: 'Required fields: companyName, tagline, valuation, fundingTarget, pitchOverview' });
            }
            const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
            const listing = await prisma_1.prisma.startupListing.create({
                data: {
                    slug,
                    companyName,
                    tagline,
                    country,
                    countryCode,
                    city,
                    industry,
                    stage,
                    instrument,
                    valuation: new decimal_js_1.default(valuation.toString()),
                    fundingTarget: new decimal_js_1.default(fundingTarget.toString()),
                    minInvestment: new decimal_js_1.default(minInvestment.toString()),
                    pitchOverview,
                    deadline: deadline ? new Date(deadline) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                    logoUrl: logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
                    coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&auto=format&fit=crop&q=80',
                    pitchDeckUrl,
                    status: 'PUBLISHED',
                    dueDiligenceStatus: 'VERIFIED',
                },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'CREATE_STARTUP_LISTING',
                    entity: 'StartupListing',
                    entityId: listing.id,
                    details: `Created new startup listing: ${listing.companyName} (${valuation} valuation)`,
                },
            });
            res.json({
                success: true,
                message: `Startup listing ${listing.companyName} created successfully!`,
                data: listing,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update an existing startup campaign
     */
    async updateStartupListing(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { status, valuation, dueDiligenceStatus, dueDiligenceSummary, pitchOverview, tagline } = req.body;
            const updateData = {};
            if (status)
                updateData.status = status;
            if (valuation)
                updateData.valuation = new decimal_js_1.default(valuation.toString());
            if (dueDiligenceStatus)
                updateData.dueDiligenceStatus = dueDiligenceStatus;
            if (dueDiligenceSummary !== undefined)
                updateData.dueDiligenceSummary = dueDiligenceSummary;
            if (pitchOverview)
                updateData.pitchOverview = pitchOverview;
            if (tagline)
                updateData.tagline = tagline;
            const updated = await prisma_1.prisma.startupListing.update({
                where: { id },
                data: updateData,
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'UPDATE_STARTUP_LISTING',
                    entity: 'StartupListing',
                    entityId: id,
                    details: `Updated startup listing ${updated.companyName}: ${JSON.stringify(updateData)}`,
                },
            });
            res.json({
                success: true,
                message: `Startup listing ${updated.companyName} updated successfully`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Suspend / delete startup campaign
     */
    async deleteStartupListing(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const listing = await prisma_1.prisma.startupListing.update({
                where: { id },
                data: { status: 'SUSPENDED' },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'SUSPEND_STARTUP_LISTING',
                    entity: 'StartupListing',
                    entityId: id,
                    details: `Suspended startup listing ${listing.companyName}`,
                },
            });
            res.json({
                success: true,
                message: `Startup listing ${listing.companyName} suspended successfully`,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List P2P orders with search & status filters
     */
    async getP2POrders(req, res, next) {
        try {
            const { status, page, limit } = req.query;
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 30;
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (status && status !== 'ALL' && Object.values(client_1.P2POrderStatus).includes(status)) {
                where.status = status;
            }
            const [orders, total] = await Promise.all([
                prisma_1.prisma.p2POrder.findMany({
                    where,
                    include: {
                        buyer: { select: { id: true, email: true, firstName: true, lastName: true } },
                        seller: { select: { id: true, email: true, firstName: true, lastName: true } },
                        offer: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitNum,
                }),
                prisma_1.prisma.p2POrder.count({ where }),
            ]);
            res.json({
                success: true,
                data: orders,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Resolve P2P Escrow Dispute
     */
    async resolveP2PDispute(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { resolution, reason } = req.body;
            if (!['RELEASE_TO_BUYER', 'REFUND_TO_SELLER'].includes(resolution)) {
                return res.status(400).json({ success: false, message: 'Resolution must be RELEASE_TO_BUYER or REFUND_TO_SELLER' });
            }
            const order = await prisma_1.prisma.p2POrder.findUnique({
                where: { id },
                include: { buyer: true, seller: true, offer: true },
            });
            if (!order) {
                return res.status(404).json({ success: false, message: 'P2P Order not found' });
            }
            const nextStatus = resolution === 'RELEASE_TO_BUYER' ? client_1.P2POrderStatus.COMPLETED : client_1.P2POrderStatus.CANCELLED;
            await prisma_1.prisma.p2POrder.update({
                where: { id },
                data: {
                    status: nextStatus,
                    disputeResolvedBy: adminUserId,
                    disputeReason: reason ? `[Admin ${resolution}]: ${reason}` : `Resolved by admin via ${resolution}`,
                },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'RESOLVE_P2P_DISPUTE',
                    entity: 'P2POrder',
                    entityId: id,
                    details: `Admin resolved P2P dispute on order ${order.orderCode} via ${resolution}. Reason: ${reason || 'N/A'}`,
                },
            });
            res.json({
                success: true,
                message: `Order ${order.orderCode} dispute resolved with status ${nextStatus}`,
                resolution,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get immutable admin audit logs
     */
    async getAdminAuditLogs(req, res, next) {
        try {
            const { action, entity, page, limit } = req.query;
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 50;
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (action && typeof action === 'string' && action !== 'ALL')
                where.action = action;
            if (entity && typeof entity === 'string' && entity !== 'ALL')
                where.entity = entity;
            const [logs, total] = await Promise.all([
                prisma_1.prisma.adminAuditLog.findMany({
                    where,
                    include: {
                        user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitNum,
                }),
                prisma_1.prisma.adminAuditLog.count({ where }),
            ]);
            res.json({
                success: true,
                data: logs,
                meta: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(total / limitNum),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get platform system status & broadcast announcement
     */
    async getSystemStatus(req, res, next) {
        try {
            const settings = await prisma_1.prisma.cmsSetting.findMany({
                where: { group: 'SYSTEM' },
            });
            const map = {};
            settings.forEach((s) => (map[s.key] = s.value));
            res.json({
                success: true,
                data: {
                    maintenanceMode: map['system_maintenance_mode'] === 'true',
                    maintenanceMessage: map['system_maintenance_message'] || 'Avora Bank systems are undergoing scheduled maintenance. Services will resume shortly.',
                    announcementEnabled: map['system_announcement_enabled'] === 'true',
                    announcementTitle: map['system_announcement_title'] || 'System Notice',
                    announcementMessage: map['system_announcement_message'] || '',
                    announcementType: map['system_announcement_type'] || 'info',
                    registrationsEnabled: map['system_registrations_enabled'] !== 'false',
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update platform system status & broadcast announcement
     */
    async updateSystemStatus(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { maintenanceMode, maintenanceMessage, announcementEnabled, announcementTitle, announcementMessage, announcementType, registrationsEnabled, } = req.body;
            const pairs = {};
            if (maintenanceMode !== undefined)
                pairs['system_maintenance_mode'] = String(maintenanceMode);
            if (maintenanceMessage !== undefined)
                pairs['system_maintenance_message'] = String(maintenanceMessage);
            if (announcementEnabled !== undefined)
                pairs['system_announcement_enabled'] = String(announcementEnabled);
            if (announcementTitle !== undefined)
                pairs['system_announcement_title'] = String(announcementTitle);
            if (announcementMessage !== undefined)
                pairs['system_announcement_message'] = String(announcementMessage);
            if (announcementType !== undefined)
                pairs['system_announcement_type'] = String(announcementType);
            if (registrationsEnabled !== undefined)
                pairs['system_registrations_enabled'] = String(registrationsEnabled);
            for (const [key, value] of Object.entries(pairs)) {
                await prisma_1.prisma.cmsSetting.upsert({
                    where: { key },
                    update: { value },
                    create: { group: 'SYSTEM', key, value, description: 'System control parameter' },
                });
            }
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'UPDATE_SYSTEM_STATUS',
                    entity: 'CmsSetting',
                    details: `Updated platform system parameters: ${JSON.stringify(pairs)}`,
                },
            });
            res.json({
                success: true,
                message: 'Platform system controls updated successfully',
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Institutional Analytics & KPI Overview
     */
    async getPlatformOverviewAnalytics(req, res, next) {
        try {
            const [totalUsers, totalPackages, activePackages, pendingDeposits, pendingWithdrawals, pendingKyc, totalStartups, totalTransfers, totalTickets,] = await Promise.all([
                prisma_1.prisma.user.count(),
                prisma_1.prisma.investmentPackage.count(),
                prisma_1.prisma.investmentPackage.findMany({
                    where: { status: client_1.PackageStatus.ACTIVE },
                    select: { amount: true },
                }),
                prisma_1.prisma.depositRequest.count({ where: { status: client_1.DepositStatus.PENDING } }),
                prisma_1.prisma.withdrawalRequest.count({ where: { status: { in: [client_1.WithdrawalStatus.REQUESTED, client_1.WithdrawalStatus.UNDER_REVIEW] } } }),
                prisma_1.prisma.kycDocument.count({ where: { status: client_1.KycStatus.PENDING } }),
                prisma_1.prisma.startupListing.count({ where: { status: 'PUBLISHED' } }),
                prisma_1.prisma.globalTransfer.count(),
                prisma_1.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
            ]);
            const activeCapital = activePackages.reduce((acc, p) => acc + parseFloat(p.amount.toString()), 0);
            res.json({
                success: true,
                data: {
                    totalUsers,
                    totalPackages,
                    activeCapital: activeCapital.toFixed(2),
                    activePackagesCount: activePackages.length,
                    pendingDeposits,
                    pendingWithdrawals,
                    pendingKyc,
                    totalStartups,
                    totalTransfers,
                    totalTickets,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Onboard/Create a new user directly
     */
    async createUser(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { firstName, lastName, email, password, role = client_1.Role.USER, country = 'GE', phone, initialBalance, initialCurrency = 'USD', autoVerifyKyc = true, } = req.body;
            if (!email || !email.includes('@')) {
                return res.status(400).json({ success: false, message: 'A valid email address is required' });
            }
            const existing = await prisma_1.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
            if (existing) {
                return res.status(400).json({ success: false, message: `A user with email ${email} already exists.` });
            }
            const tempPassword = password && password.trim().length >= 6
                ? password.trim()
                : `Avora@${Math.floor(100000 + Math.random() * 900000)}`;
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
            const user = await prisma_1.prisma.user.create({
                data: {
                    email: email.toLowerCase().trim(),
                    passwordHash,
                    firstName: firstName?.trim() || 'Client',
                    lastName: lastName?.trim() || 'Investor',
                    role: role === client_1.Role.ADMIN ? client_1.Role.ADMIN : role === client_1.Role.STAFF ? client_1.Role.STAFF : client_1.Role.USER,
                    phone: phone?.trim() || null,
                    signupLocation: country || 'GE',
                    country: country || 'GE',
                    kycStatus: autoVerifyKyc ? client_1.KycStatus.APPROVED : client_1.KycStatus.NOT_STARTED,
                    status: client_1.UserStatus.ACTIVE,
                    twoFactorEnabled: false,
                },
            });
            const accountNumber = (0, p2p_service_1.generateAvoraAccountNumber)(user.id);
            // Ensure default wallet balances exist (USD, USDT, EUR, GEL, INR)
            await ledger_service_1.ledgerService.ensureWallet(user.id);
            // If initial balance was requested, credit it
            let creditedBalance = null;
            if (initialBalance && parseFloat(initialBalance) > 0) {
                const creditAmt = parseFloat(initialBalance);
                creditedBalance = await ledger_service_1.ledgerService.processAdminBalanceAdjustment({
                    userId: user.id,
                    adminUserId,
                    currency: initialCurrency || 'USD',
                    amount: creditAmt,
                    type: 'CREDIT',
                    reason: 'Initial institutional account funding upon onboarding',
                });
            }
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_CREATE_USER',
                    entity: 'User',
                    entityId: user.id,
                    details: `Admin created user ${user.email} (${accountNumber}) with role ${user.role} and initial balance ${initialBalance || 0} ${initialCurrency}`,
                },
            });
            res.status(201).json({
                success: true,
                message: `Account for ${user.email} successfully created.`,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        accountNumber,
                        role: user.role,
                        kycStatus: user.kycStatus,
                        temporaryPassword: tempPassword,
                    },
                    temporaryPassword: tempPassword,
                    creditedBalance,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Deploy/Issue an active Fixed Deposit investment package for any user
     */
    async createPackage(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { userId, userEmail, amount, currency = 'USD', lockInMonths = 6, returnRateSnapshot = '0.0100', fundingSource = 'DIRECT_CREDIT', } = req.body;
            if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                return res.status(400).json({ success: false, message: 'Valid positive package amount required' });
            }
            let targetUser = null;
            if (userId) {
                targetUser = await prisma_1.prisma.user.findUnique({ where: { id: String(userId) } });
            }
            else if (userEmail) {
                targetUser = await prisma_1.prisma.user.findUnique({ where: { email: String(userEmail).toLowerCase().trim() } });
            }
            if (!targetUser) {
                return res.status(404).json({ success: false, message: 'Target client user not found' });
            }
            const amountDec = new decimal_js_1.default(amount.toString());
            const months = parseInt(lockInMonths?.toString() || '6', 10);
            const rate = new decimal_js_1.default(returnRateSnapshot?.toString() || '0.0100');
            let investmentPackage;
            if (fundingSource === 'WALLET') {
                investmentPackage = await ledger_service_1.ledgerService.purchasePackageFromWallet({
                    userId: targetUser.id,
                    amount: amountDec.toFixed(8),
                    currency,
                    returnRateSnapshot: rate.toFixed(4),
                    lockInMonths: months,
                    idempotencyKey: `ADMIN-PKG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                });
            }
            else {
                const now = new Date();
                const lockInEnd = new Date(now);
                lockInEnd.setMonth(lockInEnd.getMonth() + months);
                const packageCode = `PKG-INST-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
                investmentPackage = await prisma_1.prisma.$transaction(async (tx) => {
                    const wallet = await ledger_service_1.ledgerService.ensureWallet(targetUser.id);
                    const lockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, currency);
                    const newLocked = new decimal_js_1.default(lockedBal.lockedPrincipal.toString()).plus(amountDec);
                    await tx.walletBalance.update({
                        where: { id: lockedBal.id },
                        data: { lockedPrincipal: newLocked.toFixed(8) },
                    });
                    return await tx.investmentPackage.create({
                        data: {
                            packageCode,
                            userId: targetUser.id,
                            amount: amountDec.toFixed(8),
                            currency,
                            returnRateSnapshot: rate.toFixed(4),
                            lockInMonths: months,
                            status: client_1.PackageStatus.ACTIVE,
                            lockInStart: now,
                            lockInEnd,
                            purchaseDate: now,
                            depositMethod: 'ADMIN_DIRECT_CREDIT',
                            adminNotes: `Deployed by admin ${adminUserId}`,
                        },
                    });
                });
            }
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_CREATE_PACKAGE',
                    entity: 'InvestmentPackage',
                    entityId: investmentPackage.id,
                    details: `Admin deployed ${months}-mo FD package ${investmentPackage.packageCode} for $${amountDec.toFixed(2)} ${currency} to ${targetUser.email} (Source: ${fundingSource})`,
                },
            });
            res.status(201).json({
                success: true,
                message: `Fixed Deposit package ${investmentPackage.packageCode} successfully deployed for ${targetUser.email}.`,
                data: { package: investmentPackage },
            });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message || 'Failed to create investment package' });
        }
    }
    /**
     * Admin: Create and instantly credit a manual deposit for any user
     */
    async createManualDeposit(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { userId, userEmail, amount, currency = 'USDT', depositMethod = 'MANUAL_CREDIT', txHashOrRef, notes = 'Institutional balance deposit credited via admin desk', } = req.body;
            if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
                return res.status(400).json({ success: false, message: 'Valid positive deposit amount required' });
            }
            let targetUser = null;
            if (userId) {
                targetUser = await prisma_1.prisma.user.findUnique({ where: { id: String(userId) } });
            }
            else if (userEmail) {
                targetUser = await prisma_1.prisma.user.findUnique({ where: { email: String(userEmail).toLowerCase().trim() } });
            }
            if (!targetUser) {
                return res.status(404).json({ success: false, message: 'Target client user not found' });
            }
            const depositCode = `DEP-MAN-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
            const amountDec = new decimal_js_1.default(amount.toString());
            // If USDT and no custom tx hash provided, auto-generate valid 66-character BSC hash
            let finalHash = txHashOrRef?.trim() || null;
            if (!finalHash && (currency === 'USDT' || depositMethod.includes('CRYPTO'))) {
                const randHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                finalHash = `0x${randHex}`;
            }
            else if (!finalHash) {
                finalHash = `REF-${depositCode}`;
            }
            // Create Deposit Request in PENDING state
            const deposit = await prisma_1.prisma.depositRequest.create({
                data: {
                    depositCode,
                    userId: targetUser.id,
                    amount: amountDec.toFixed(8),
                    currency,
                    depositMethod,
                    txHashOrRef: finalHash,
                    status: client_1.DepositStatus.PENDING,
                    adminNotes: notes,
                },
            });
            // Approve immediately via depositService (atomic double-entry ledger credit)
            const approvedResult = await deposit_service_1.depositService.adminApproveDeposit(deposit.id, adminUserId, notes, finalHash);
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_MANUAL_DEPOSIT',
                    entity: 'DepositRequest',
                    entityId: deposit.id,
                    details: `Admin credited ${amountDec.toFixed(2)} ${currency} (${depositMethod}) to ${targetUser.email}. Ref: ${finalHash}`,
                },
            });
            res.status(201).json({
                success: true,
                message: `Successfully credited ${amountDec.toFixed(2)} ${currency} to ${targetUser.email}.`,
                data: {
                    deposit: approvedResult.deposit,
                    balanceAfter: approvedResult.balanceAfter,
                },
            });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message || 'Manual deposit creation failed' });
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
