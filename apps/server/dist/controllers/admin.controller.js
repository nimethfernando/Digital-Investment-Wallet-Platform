"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const p2p_helpers_1 = require("../services/p2p.helpers");
const gmt_service_1 = require("../services/gmt.service");
const otc_service_1 = require("../services/otc.service");
const rate_service_1 = require("../services/rate.service");
const investments_service_1 = require("../services/investments.service");
const token_service_1 = require("../services/token.service");
const liquidityRisk_service_1 = require("../services/liquidityRisk.service");
const featureControl_service_1 = require("../services/featureControl.service");
const financialSelfTest_service_1 = require("../services/financialSelfTest.service");
const wallet_controller_1 = require("./wallet.controller");
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
     * Manually trigger date-based monthly returns job (only processes packages whose monthly cycle is actually due)
     */
    async triggerMonthlyReturns(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const { reason, cycleMonth } = req.body || {};
            const auditReason = reason || 'Admin date-based monthly yield batch evaluation (1% standard return)';
            const summary = await returns_job_1.returnsJobService.executeMonthlyReturns({
                manualRun: true,
                adminUserId,
                adminReason: auditReason,
                cycleMonth,
            });
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'MANUAL_RETURNS_PAYOUT',
                    entity: 'ReturnsEngine',
                    entityId: summary.executionId,
                    details: `Date-based yield run executed. Due Credited: ${summary.creditedCount} ($${summary.totalDistributedUsd}), Skipped Not Due: ${summary.notYetDueCount}, Already Credited: ${summary.alreadyCreditedCount}. Reason: ${auditReason}`,
                },
            });
            const message = summary.creditedCount > 0
                ? `Monthly yield run completed: ${summary.creditedCount} due package(s) credited ($${summary.totalDistributedUsd} USD). ${summary.notYetDueCount} package(s) skipped (current monthly cycle not yet completed).`
                : `No packages have monthly yield due today. ${summary.notYetDueCount} active package(s) are still within their current monthly cycle and ${summary.alreadyCreditedCount} completed cycle(s) were already credited.`;
            res.json({
                success: true,
                message,
                data: summary,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Credit monthly yield for a single active package (only if due based on start/deployment date)
     */
    async creditSinglePackageYield(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const packageId = req.params.id;
            const result = await returns_job_1.returnsJobService.creditSinglePackageDueYield(packageId, adminUserId);
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'SINGLE_PACKAGE_YIELD_CREDIT',
                    entity: 'InvestmentPackage',
                    entityId: packageId,
                    details: `Credited ${result.periodsCreditedCount} due monthly yield period(s) for ${result.packageCode} ($${result.totalCreditedUsd} USD).`,
                },
            });
            res.json({
                success: true,
                message: `Credited $${result.totalCreditedUsd} USD (${result.periodsCreditedCount} due monthly period(s)) for ${result.packageCode}.`,
                data: result,
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
     * Build unified Platform Commission & Fee Revenue data across all modules + Vault claimable status
     */
    async buildPlatformRevenueData(adminUserId) {
        // Execute in compact bounded batches (<= 4 queries at once) to respect shared MySQL connection_limit=5
        const [reconcile, liveRates, otcAllTrades, p2pCompleted] = await Promise.all([
            ledger_service_1.ledgerService.reconcileLedger(),
            rate_service_1.rateService.getLiveRates().catch(() => ({ rates: { USD: 1, USDT: 1 } })),
            prisma_1.prisma.otcTrade.findMany({
                where: { status: { in: ['COMPLETED', 'IN_PROGRESS', 'DISPUTED'] } },
                select: { status: true, platformFee: true, operatorFee: true },
            }),
            prisma_1.prisma.p2POrder.findMany({
                where: { status: client_1.P2POrderStatus.COMPLETED },
                select: { platformFeeAmount: true, cryptoCurrency: true },
            }),
        ]);
        const [invAgg, gmtTransfers, settledWithdrawals, approvedRazorpay] = await Promise.all([
            prisma_1.prisma.investmentCommitment.aggregate({
                where: { sourceType: { not: 'ADMIN_DISPLAY_MOCK' } },
                _sum: { allocationFeeAmount: true, profitShareFeeAmount: true },
            }),
            prisma_1.prisma.globalTransfer.findMany({
                where: { status: { notIn: ['REJECTED', 'REFUNDED', 'CANCELLED'] } },
                select: { sendingAmount: true, transferFeeAmount: true, rateAdjustmentPct: true, sendingCurrency: true },
            }),
            prisma_1.prisma.withdrawalRequest.findMany({
                where: { status: client_1.WithdrawalStatus.SETTLED },
                select: { currency: true, payoutDetails: true },
            }),
            prisma_1.prisma.depositRequest.findMany({
                where: { status: client_1.DepositStatus.APPROVED, depositMethod: 'RAZORPAY' },
                select: { currency: true, adminNotes: true },
            }),
        ]);
        const [allCommissionTxs, exchangeOrdersCompleted, adminWallet] = await Promise.all([
            prisma_1.prisma.transaction.findMany({
                where: {
                    status: client_1.TransactionStatus.COMPLETED,
                    OR: [
                        {
                            type: {
                                in: [
                                    client_1.TransactionType.FEE,
                                    client_1.TransactionType.GLOBAL_TRANSFER_FEE,
                                    client_1.TransactionType.INVESTMENT_FEE,
                                    client_1.TransactionType.INVESTMENT_PROFIT_SHARE,
                                ],
                            },
                        },
                        { transactionCode: { startsWith: 'OTCF-' } },
                        { transactionCode: { startsWith: 'OTCAF-' } },
                        { transactionCode: { startsWith: 'TX-ADMREV-' } },
                    ],
                },
                include: {
                    user: { select: { email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 1000,
            }),
            prisma_1.prisma.exchangeOrder.findMany({
                where: { status: 'COMPLETED' },
                select: { feeAmount: true, fromCurrency: true },
            }),
            adminUserId
                ? prisma_1.prisma.wallet
                    .findUnique({
                    where: { userId: adminUserId },
                    include: { balances: true },
                })
                    .catch(() => null)
                : Promise.resolve(null),
        ]);
        const vaultSummary = ledger_service_1.ledgerService.computeVaultSummaryFromAccounts(reconcile.accounts || [], liveRates);
        const feeTransactions = allCommissionTxs
            .filter((t) => !String(t.transactionCode || '').startsWith('TX-ADMREV-'))
            .slice(0, 40);
        const p2pPromoTransactions = allCommissionTxs.filter((t) => String(t.transactionCode || '').startsWith('TX-P2PPROMO-'));
        const cardFeeTransactions = allCommissionTxs.filter((t) => String(t.transactionCode || '').startsWith('TX-CARDF-'));
        const swapFeeTransactions = allCommissionTxs.filter((t) => String(t.transactionCode || '').startsWith('TX-SWAPF-'));
        const claimTransactions = allCommissionTxs
            .filter((t) => String(t.transactionCode || '').startsWith('TX-ADMREV-'))
            .slice(0, 25);
        const toUsdDec = (amt, currency) => {
            const cur = (currency || 'USD').toUpperCase();
            if (cur === 'USD' || cur === 'USDT' || cur === 'USDC')
                return amt;
            const unitsPerUsd = Number(liveRates.rates?.[cur] || 0);
            if (unitsPerUsd > 0)
                return amt.div(new decimal_js_1.default(unitsPerUsd));
            return amt;
        };
        const otcCompleted = otcAllTrades.filter((t) => t.status === 'COMPLETED');
        const otcActive = otcAllTrades.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'DISPUTED');
        const otcPlatformUsdt = otcCompleted.reduce((s, t) => s.plus(new decimal_js_1.default(t.platformFee?.toString() || '0')), new decimal_js_1.default(0));
        const otcBrokerUsdt = otcCompleted.reduce((s, t) => s.plus(new decimal_js_1.default(t.operatorFee?.toString() || '0')), new decimal_js_1.default(0));
        const otcPendingPlatformUsdt = otcActive.reduce((s, t) => s.plus(new decimal_js_1.default(t.platformFee?.toString() || '0')), new decimal_js_1.default(0));
        const otcPendingBrokerUsdt = otcActive.reduce((s, t) => s.plus(new decimal_js_1.default(t.operatorFee?.toString() || '0')), new decimal_js_1.default(0));
        const p2pFeesByCurrency = {};
        let p2pTotalCrypto = new decimal_js_1.default(0);
        let p2pFeeUsdEq = new decimal_js_1.default(0);
        for (const o of p2pCompleted) {
            const fee = new decimal_js_1.default(o.platformFeeAmount?.toString() || '0');
            const cur = (o.cryptoCurrency || 'USDT').toUpperCase();
            if (fee.greaterThan(0)) {
                p2pFeesByCurrency[cur] = (p2pFeesByCurrency[cur] || new decimal_js_1.default(0)).plus(fee);
                p2pTotalCrypto = p2pTotalCrypto.plus(fee);
                p2pFeeUsdEq = p2pFeeUsdEq.plus(toUsdDec(fee, cur));
            }
        }
        const ventureAllocationUsd = new decimal_js_1.default(invAgg._sum.allocationFeeAmount?.toString() || '0');
        const ventureProfitShareUsd = new decimal_js_1.default(invAgg._sum.profitShareFeeAmount?.toString() || '0');
        let gmtFeeTotal = new decimal_js_1.default(0);
        let gmtFxMarginEst = new decimal_js_1.default(0);
        for (const g of gmtTransfers) {
            const sendAmt = new decimal_js_1.default(g.sendingAmount?.toString() || '0');
            const feeAmt = new decimal_js_1.default(g.transferFeeAmount?.toString() || '0');
            const marginPct = new decimal_js_1.default(g.rateAdjustmentPct?.toString() || '0');
            gmtFeeTotal = gmtFeeTotal.plus(feeAmt);
            gmtFxMarginEst = gmtFxMarginEst.plus(sendAmt.times(marginPct.div(100)));
        }
        let withdrawalFeeTotal = new decimal_js_1.default(0);
        let withdrawalFeeUsdEq = new decimal_js_1.default(0);
        for (const w of settledWithdrawals) {
            try {
                const parsed = w.payoutDetails ? JSON.parse(w.payoutDetails) : {};
                const wf = new decimal_js_1.default(String(parsed?.withdrawalFeeAmount || '0'));
                if (wf.isFinite() && wf.greaterThan(0)) {
                    withdrawalFeeTotal = withdrawalFeeTotal.plus(wf);
                    withdrawalFeeUsdEq = withdrawalFeeUsdEq.plus(toUsdDec(wf, w.currency || 'USD'));
                }
            }
            catch {
                // ignore malformed legacy json
            }
        }
        let razorpayMarginTotal = new decimal_js_1.default(0);
        for (const d of approvedRazorpay) {
            const match = (d.adminNotes || '').match(/Avora Margin:\s*\$?([\d,]+(?:\.\d+)?)/i);
            if (match) {
                const m = new decimal_js_1.default(match[1].replace(/,/g, ''));
                if (m.isFinite() && m.greaterThan(0))
                    razorpayMarginTotal = razorpayMarginTotal.plus(m);
            }
        }
        let cardIssuanceFeeTotal = new decimal_js_1.default(0);
        for (const tx of cardFeeTransactions) {
            cardIssuanceFeeTotal = cardIssuanceFeeTotal.plus(toUsdDec(new decimal_js_1.default(tx.amount.toString()), tx.currency));
        }
        let p2pPromotionFeeTotal = new decimal_js_1.default(0);
        const p2pPromotionFeesByCurrency = {};
        for (const tx of p2pPromoTransactions) {
            const amt = new decimal_js_1.default(tx.amount?.toString() || '0');
            const cur = (tx.currency || 'USD').toUpperCase();
            if (amt.greaterThan(0)) {
                p2pPromotionFeeTotal = p2pPromotionFeeTotal.plus(toUsdDec(amt, cur));
                p2pPromotionFeesByCurrency[cur] = (p2pPromotionFeesByCurrency[cur] || new decimal_js_1.default(0)).plus(amt);
            }
        }
        let swapSpreadFeeTotalUsd = new decimal_js_1.default(0);
        const swapSpreadByCurrency = {};
        for (const tx of swapFeeTransactions) {
            const amt = new decimal_js_1.default(tx.amount?.toString() || '0');
            const cur = (tx.currency || 'USD').toUpperCase();
            if (amt.greaterThan(0)) {
                swapSpreadFeeTotalUsd = swapSpreadFeeTotalUsd.plus(toUsdDec(amt, cur));
                swapSpreadByCurrency[cur] = (swapSpreadByCurrency[cur] || new decimal_js_1.default(0)).plus(amt);
            }
        }
        for (const ex of exchangeOrdersCompleted) {
            const amt = new decimal_js_1.default(ex.feeAmount?.toString() || '0');
            const cur = (ex.fromCurrency || 'USD').toUpperCase();
            if (amt.greaterThan(0)) {
                swapSpreadFeeTotalUsd = swapSpreadFeeTotalUsd.plus(toUsdDec(amt, cur));
                swapSpreadByCurrency[cur] = (swapSpreadByCurrency[cur] || new decimal_js_1.default(0)).plus(amt);
            }
        }
        const grandTotalModuleEarningsUsd = otcPlatformUsdt
            .plus(p2pFeeUsdEq)
            .plus(p2pPromotionFeeTotal)
            .plus(ventureAllocationUsd)
            .plus(ventureProfitShareUsd)
            .plus(gmtFeeTotal)
            .plus(withdrawalFeeUsdEq)
            .plus(razorpayMarginTotal)
            .plus(cardIssuanceFeeTotal)
            .plus(swapSpreadFeeTotalUsd);
        const ledgerRevenueAccounts = (reconcile.accounts || []).filter((a) => String(a.accountId || '').startsWith('PLATFORM_FEE_REVENUE'));
        const adminWalletBalances = (adminWallet?.balances || []).map((b) => ({
            currency: b.currency,
            availableBalance: new decimal_js_1.default(b.availableBalance?.toString() || '0').toFixed(4),
        }));
        return {
            ledgerStatus: reconcile.status,
            ledgerIsBalanced: reconcile.isBalanced,
            ledgerRevenueAccounts,
            vaultSummary: {
                ...vaultSummary,
                grandTotalModuleEarningsUsd: grandTotalModuleEarningsUsd.toFixed(2),
            },
            adminWalletBalances,
            moduleBreakdown: {
                grandTotalEarningsUsd: grandTotalModuleEarningsUsd.toFixed(2),
                otcPlatformFeeUsdt: otcPlatformUsdt.toFixed(2),
                otcBrokerCommissionUsdt: otcBrokerUsdt.toFixed(2),
                otcPendingPlatformFeeUsdt: otcPendingPlatformUsdt.toFixed(2),
                otcPendingBrokerCommissionUsdt: otcPendingBrokerUsdt.toFixed(2),
                p2pFeeTotal: p2pTotalCrypto.toFixed(4),
                p2pFeeUsdEq: p2pFeeUsdEq.toFixed(2),
                p2pFeesByCurrency: Object.fromEntries(Object.entries(p2pFeesByCurrency).map(([k, v]) => [k, v.toFixed(4)])),
                p2pPromotionFeeTotal: p2pPromotionFeeTotal.toFixed(2),
                p2pPromotionFeesByCurrency: Object.fromEntries(Object.entries(p2pPromotionFeesByCurrency).map(([k, v]) => [k, v.toFixed(2)])),
                p2pPromotionCount: p2pPromoTransactions.length,
                swapSpreadFeeTotalUsd: swapSpreadFeeTotalUsd.toFixed(2),
                swapSpreadByCurrency: Object.fromEntries(Object.entries(swapSpreadByCurrency).map(([k, v]) => [k, v.toFixed(4)])),
                swapFeeCount: swapFeeTransactions.length + exchangeOrdersCompleted.length,
                ventureAllocationFeeUsd: ventureAllocationUsd.toFixed(2),
                ventureProfitShareFeeUsd: ventureProfitShareUsd.toFixed(2),
                gmtTransferFeeUsd: gmtFeeTotal.toFixed(2),
                gmtFxMarginEstUsd: gmtFxMarginEst.toFixed(2),
                withdrawalFeeTotal: withdrawalFeeTotal.toFixed(2),
                razorpayMarginTotal: razorpayMarginTotal.toFixed(2),
                cardIssuanceFeeTotal: cardIssuanceFeeTotal.toFixed(2),
            },
            recentFeeTransactions: feeTransactions.map((t) => ({
                id: t.id,
                transactionCode: t.transactionCode,
                type: t.type,
                amount: new decimal_js_1.default(t.amount.toString()).toFixed(4),
                currency: t.currency,
                sourceClient: t.user?.email || 'Platform Client',
                clientName: t.user?.firstName ? `${t.user.firstName} ${t.user.lastName || ''}`.trim() : 'Platform Client',
                feeAccount: `PLATFORM_FEE_REVENUE_${t.currency}`,
                destinationVault: `Platform Revenue Vault (${t.currency})`,
                settlementReference: t.settlementReference,
                status: t.status || 'COMPLETED',
                notes: t.notes,
                userEmail: t.user?.email || 'N/A',
                createdAt: t.createdAt,
            })),
            recentClaimTransactions: claimTransactions.map((t) => {
                const isE2E = String(t.notes || '').toLowerCase().includes('e2e test') ||
                    String(t.user?.email || '').startsWith('http_admin_');
                return {
                    id: t.id,
                    transactionCode: t.transactionCode,
                    type: 'ADMIN_REVENUE_SWEEP',
                    amount: new decimal_js_1.default(t.amount.toString()).toFixed(4),
                    currency: t.currency,
                    sourceVault: `PLATFORM_FEE_REVENUE_${t.currency}`,
                    destinationWallet: `Admin Spendable ${t.currency} Wallet`,
                    settlementReference: t.settlementReference,
                    status: t.status || 'COMPLETED',
                    notes: t.notes,
                    recipientEmail: t.user?.email || 'N/A',
                    recipientName: t.user?.firstName
                        ? `${t.user.firstName} ${t.user.lastName || ''}`.trim()
                        : 'Admin Treasury',
                    balanceBefore: new decimal_js_1.default(t.balanceBefore?.toString() || '0').toFixed(4),
                    balanceAfter: new decimal_js_1.default(t.balanceAfter?.toString() || '0').toFixed(4),
                    isE2ETest: isE2E,
                    sweepCategory: isE2E ? 'AUTOMATED_E2E_TEST' : 'MANUAL_ADMIN_SWEEP',
                    createdAt: t.createdAt,
                };
            }),
        };
    }
    /**
     * Purge automated E2E test sweep transactions and journals from Commission Wallet history
     */
    async purgeE2ETestSweeps(req, res, next) {
        try {
            const adminUserId = req.user?.id;
            const testTxs = await prisma_1.prisma.transaction.findMany({
                where: {
                    OR: [
                        { notes: { contains: 'E2E test sweep' } },
                        { user: { email: { startsWith: 'http_admin_' } } },
                    ],
                },
                select: { id: true, transactionCode: true, settlementReference: true },
            });
            const txCodes = testTxs.map((t) => t.transactionCode);
            const refIds = testTxs.map((t) => t.settlementReference).filter(Boolean);
            if (txCodes.length > 0) {
                await prisma_1.prisma.ledgerEntry.deleteMany({
                    where: {
                        journal: {
                            OR: [
                                { referenceId: { in: refIds } },
                                { notes: { contains: 'E2E test sweep' } },
                            ],
                        },
                    },
                });
                await prisma_1.prisma.ledgerJournal.deleteMany({
                    where: {
                        OR: [
                            { referenceId: { in: refIds } },
                            { notes: { contains: 'E2E test sweep' } },
                        ],
                    },
                });
                await prisma_1.prisma.transaction.deleteMany({
                    where: { id: { in: testTxs.map((t) => t.id) } },
                });
            }
            await prisma_1.prisma.adminAuditLog
                .create({
                data: {
                    userId: adminUserId,
                    action: 'PURGE_E2E_TEST_SWEEPS',
                    entity: 'Transaction',
                    details: `Admin purged ${testTxs.length} automated E2E test sweep transactions from commission history.`,
                },
            })
                .catch(() => { });
            res.json({
                success: true,
                message: `Successfully purged ${testTxs.length} automated E2E test records from Commission Wallet history.`,
                purgedCount: testTxs.length,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Real-time Platform Commission & Fee Revenue Analytics across all modules
     */
    async getPlatformRevenueAnalytics(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : undefined;
            const data = await this.buildPlatformRevenueData(adminUserId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Claim / sweep commission earnings from PLATFORM_FEE_REVENUE_* to Admin spendable Wallet
     */
    async claimPlatformRevenue(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : '';
            if (!adminUserId) {
                return res.status(401).json({ success: false, message: 'Admin authentication required.' });
            }
            const { currency, amount, targetUserId, reason } = req.body || {};
            const result = await ledger_service_1.ledgerService.claimPlatformRevenueToAdminWallet(adminUserId, {
                currency,
                amount,
                targetUserId,
                reason,
            });
            await (0, p2p_helpers_1.createP2PNotification)({
                userId: String(targetUserId || adminUserId),
                category: 'ACCOUNT',
                type: 'ADMIN_REVENUE_CLAIMED',
                severity: 'SUCCESS',
                title: `Platform Commission Earnings Credited (${result.claimCode})`,
                message: result.message,
                referenceCode: result.claimCode,
                actionUrl: '/dashboard',
                actionLabel: 'View Admin Wallet',
            });
            res.json(result);
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
            await investments_service_1.investmentsService.ensureVentureSchema();
            // Fetch raw commitments & inquiries without non-nullable Prisma relation includes so an orphaned
            // foreign key (e.g. a removed StartupListing or User) never triggers Prisma P2025/inconsistent-null errors.
            const [rawCommitments, listings, rawInquiries] = await Promise.all([
                prisma_1.prisma.investmentCommitment.findMany({
                    orderBy: { createdAt: 'desc' },
                }),
                prisma_1.prisma.startupListing.findMany({
                    orderBy: { createdAt: 'desc' },
                }),
                prisma_1.prisma.investmentInquiry
                    .findMany({
                    orderBy: { createdAt: 'desc' },
                })
                    .catch(() => []),
            ]);
            const investorIds = Array.from(new Set([
                ...rawCommitments.map((c) => c.investorUserId),
                ...rawInquiries.map((inq) => inq.investorUserId),
            ].filter(Boolean)));
            const investors = investorIds.length > 0
                ? await prisma_1.prisma.user
                    .findMany({
                    where: { id: { in: investorIds } },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        country: true,
                    },
                })
                    .catch(() => [])
                : [];
            const investorById = new Map(investors.map((u) => [u.id, u]));
            const listingById = new Map(listings.map((l) => [l.id, l]));
            const pickListingSummary = (l) => l
                ? {
                    id: l.id,
                    slug: l.slug,
                    companyName: l.companyName,
                    logoUrl: l.logoUrl,
                    industry: l.industry,
                    stage: l.stage,
                    country: l.country,
                    valuation: l.valuation,
                    fundingTarget: l.fundingTarget,
                    expectedReturnPct: l.expectedReturnPct,
                    lockInMonths: l.lockInMonths,
                    startDate: l.startDate,
                    deadline: l.deadline,
                    maturityDate: l.maturityDate,
                    performancePct: l.performancePct,
                    providerName: l.providerName,
                    termsAndNotes: l.termsAndNotes,
                    supportingDocuments: l.supportingDocuments,
                }
                : null;
            const commitments = rawCommitments.map((c) => ({
                ...c,
                investor: investorById.get(c.investorUserId) || null,
                listing: pickListingSummary(listingById.get(c.listingId)),
            }));
            const inquiries = rawInquiries.map((inq) => {
                const l = listingById.get(inq.listingId);
                return {
                    ...inq,
                    investor: investorById.get(inq.investorUserId) || null,
                    listing: l ? { id: l.id, companyName: l.companyName, slug: l.slug } : null,
                };
            });
            const invCodes = commitments.map((c) => c.investmentCode).filter(Boolean);
            const matchingLedgerTxs = invCodes.length > 0
                ? await prisma_1.prisma.transaction
                    .findMany({
                    where: {
                        settlementReference: { in: invCodes },
                        type: client_1.TransactionType.INVESTMENT_ALLOCATION,
                        status: client_1.TransactionStatus.COMPLETED,
                    },
                    select: {
                        transactionCode: true,
                        settlementReference: true,
                        amount: true,
                        currency: true,
                        createdAt: true,
                    },
                })
                    .catch(() => [])
                : [];
            const txByInvCode = new Map(matchingLedgerTxs.map((t) => [String(t.settlementReference), t]));
            const resolveSourceType = (c) => {
                if (c.sourceType === 'ADMIN_DISPLAY_MOCK')
                    return 'ADMIN_DISPLAY_MOCK';
                const matchedTx = txByInvCode.get(String(c.investmentCode));
                if (matchedTx)
                    return 'REAL_WALLET';
                if (c.sourceType === 'ADMIN_EXTERNAL_VERIFIED')
                    return 'ADMIN_EXTERNAL_VERIFIED';
                if (String(c.notes || '').includes('External/Nominee Settled'))
                    return 'ADMIN_EXTERNAL_VERIFIED';
                return c.sourceType === 'REAL_WALLET' ? 'REAL_WALLET' : 'ADMIN_EXTERNAL_VERIFIED';
            };
            const now = new Date();
            const formattedListings = listings.map((l) => {
                const listingCommitments = commitments.filter((c) => c.listingId === l.id);
                const realWalletRows = listingCommitments.filter((c) => resolveSourceType(c) === 'REAL_WALLET');
                const externalRows = listingCommitments.filter((c) => resolveSourceType(c) === 'ADMIN_EXTERNAL_VERIFIED');
                const mockRows = listingCommitments.filter((c) => resolveSourceType(c) === 'ADMIN_DISPLAY_MOCK');
                const realAndExternalRows = [...realWalletRows, ...externalRows];
                const realWalletCollectedUsd = realWalletRows.reduce((s, c) => s + Number(c.netInvestedAmount || 0), 0);
                const realWalletInvestorsCount = new Set(realWalletRows.map((c) => c.investorUserId)).size;
                const externalVerifiedCollectedUsd = externalRows.reduce((s, c) => s + Number(c.netInvestedAmount || 0), 0);
                const displayMockCollectedUsd = mockRows.reduce((s, c) => s + Number(c.netInvestedAmount || 0), 0);
                const actualCollectedFromUsersUsd = realAndExternalRows.reduce((s, c) => s + Number(c.netInvestedAmount || 0), 0);
                const actualGrossCollectedUsd = realAndExternalRows.reduce((s, c) => s + Number(c.grossAmount || 0), 0);
                const actualAllocationFeesUsd = realAndExternalRows.reduce((s, c) => s + Number(c.allocationFeeAmount || 0), 0);
                const actualDistributedToUsersUsd = realAndExternalRows.reduce((s, c) => s + Number(c.realizedProceeds || 0), 0);
                const actualDistinctInvestorsCount = new Set(realAndExternalRows.map((c) => c.investorUserId)).size;
                const actualCurrentPortfolioValueUsd = realAndExternalRows.reduce((s, c) => {
                    const netNum = Number(c.netInvestedAmount || 0);
                    const rawCurVal = c.currentValuation ? Number(c.currentValuation) : netNum;
                    const rawRetPct = c.unrealizedReturnPct ? Number(c.unrealizedReturnPct) : 0;
                    const listingVal = l.valuation ? Number(l.valuation) : 0;
                    const normVal = rawRetPct === 0 && listingVal > 0 && rawCurVal === listingVal && netNum < listingVal
                        ? netNum
                        : rawCurVal;
                    return s + normVal;
                }, 0);
                const headlineRaisedUsd = Number(l.verifiedFundsRaised || 0);
                const headlineInvestorsCount = Number(l.investorCount || 0);
                const fundingDiscrepancyUsd = Number((headlineRaisedUsd - actualCollectedFromUsersUsd).toFixed(2));
                const investorCountDiscrepancy = headlineInvestorsCount - actualDistinctInvestorsCount;
                const provInvested = Number(l.providerInvestedAmount || 0);
                const provReceived = Number(l.providerActualReceivedAmount || 0);
                const providerProfitLossUsd = provReceived - provInvested;
                let parsedDocs = [];
                try {
                    parsedDocs = l.supportingDocuments ? JSON.parse(l.supportingDocuments) : [];
                }
                catch {
                    parsedDocs = [];
                }
                let parsedLinks = {};
                try {
                    parsedLinks = l.officialLinks ? JSON.parse(l.officialLinks) : {};
                }
                catch {
                    parsedLinks = {};
                }
                let parsedContact = {};
                try {
                    parsedContact = l.contactInfo ? JSON.parse(l.contactInfo) : {};
                }
                catch {
                    parsedContact = {};
                }
                return {
                    ...l,
                    supportingDocuments: Array.isArray(parsedDocs) ? parsedDocs : [],
                    officialLinks: parsedLinks && typeof parsedLinks === 'object' ? parsedLinks : {},
                    contactInfo: parsedContact && typeof parsedContact === 'object' ? parsedContact : {},
                    realWalletCollectedUsd: Number(realWalletCollectedUsd.toFixed(2)),
                    realWalletCommitmentsCount: realWalletRows.length,
                    realWalletInvestorsCount,
                    externalVerifiedCollectedUsd: Number(externalVerifiedCollectedUsd.toFixed(2)),
                    externalVerifiedCount: externalRows.length,
                    displayMockCollectedUsd: Number(displayMockCollectedUsd.toFixed(2)),
                    displayMockCount: mockRows.length,
                    actualCollectedFromUsersUsd: Number(actualCollectedFromUsersUsd.toFixed(2)),
                    actualGrossCollectedUsd: Number(actualGrossCollectedUsd.toFixed(2)),
                    actualAllocationFeesUsd: Number(actualAllocationFeesUsd.toFixed(2)),
                    actualDistributedToUsersUsd: Number(actualDistributedToUsersUsd.toFixed(2)),
                    actualCurrentPortfolioValueUsd: Number(actualCurrentPortfolioValueUsd.toFixed(2)),
                    actualCommitmentsCount: realAndExternalRows.length,
                    actualDistinctInvestorsCount,
                    fundingDiscrepancyUsd,
                    investorCountDiscrepancy,
                    providerProfitLossUsd: Number(providerProfitLossUsd.toFixed(2)),
                };
            });
            const formattedCommitments = commitments.map((c) => {
                const effectiveSourceType = resolveSourceType(c);
                const matchedTx = txByInvCode.get(String(c.investmentCode)) || null;
                const isRealLedgerVerified = Boolean(matchedTx) && effectiveSourceType === 'REAL_WALLET';
                const netNum = Number(c.netInvestedAmount || 0);
                const rawCurVal = c.currentValuation ? Number(c.currentValuation) : netNum;
                const rawRetPct = c.unrealizedReturnPct ? Number(c.unrealizedReturnPct) : 0;
                const listingVal = c.listing?.valuation ? Number(c.listing.valuation) : 0;
                const normalizedHoldingVal = rawRetPct === 0 && listingVal > 0 && rawCurVal === listingVal && netNum < listingVal
                    ? netNum
                    : rawCurVal;
                const lockMonths = Number(c.listing?.lockInMonths ?? 12);
                const lockEnd = c.lockInEnd ||
                    c.listing?.maturityDate ||
                    (lockMonths > 0
                        ? new Date(new Date(c.createdAt).setMonth(new Date(c.createdAt).getMonth() + lockMonths))
                        : null);
                const isLockInEnded = c.status === 'EXITED' ? true : lockEnd ? now >= new Date(lockEnd) : true;
                const daysRemaining = c.status !== 'EXITED' && lockEnd && !isLockInEnded
                    ? Math.max(0, Math.ceil((new Date(lockEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;
                const profitLossUsd = Number((normalizedHoldingVal - netNum).toFixed(2));
                const returnPctNormalized = netNum > 0 ? Number((((normalizedHoldingVal - netNum) / netNum) * 100).toFixed(2)) : rawRetPct;
                let docs = [];
                try {
                    docs = c.listing?.supportingDocuments ? JSON.parse(c.listing.supportingDocuments) : [];
                }
                catch {
                    docs = [];
                }
                return {
                    ...c,
                    sourceType: effectiveSourceType,
                    isRealLedgerVerified,
                    ledgerTxCode: matchedTx?.transactionCode || null,
                    currentValuation: normalizedHoldingVal,
                    unrealizedReturnPct: returnPctNormalized,
                    profitLossUsd,
                    lockInMonths: lockMonths,
                    lockInEnd: lockEnd,
                    expectedMaturityDate: c.listing?.maturityDate || lockEnd,
                    isLockInEnded,
                    daysRemaining,
                    listing: c.listing
                        ? {
                            ...c.listing,
                            supportingDocuments: Array.isArray(docs) ? docs : [],
                        }
                        : null,
                };
            });
            res.json({
                success: true,
                data: {
                    commitments: formattedCommitments,
                    listings: formattedListings,
                    inquiries,
                },
            });
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
            const { tokenService } = await Promise.resolve().then(() => __importStar(require('../services/token.service')));
            await tokenService.ensureTokenReady();
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
     * Update investment package FD lock-in tenure, start date & maturity date
     */
    async updatePackageTenure(req, res, next) {
        try {
            const adminUserId = req.user.id;
            const packageId = req.params.id;
            const { lockInMonths, newStartDate, newEndDate, returnRateSnapshot, adminNotes } = req.body;
            const pkg = await prisma_1.prisma.investmentPackage.findUnique({
                where: { id: packageId },
                include: { user: true },
            });
            if (!pkg) {
                return res.status(404).json({ success: false, message: 'Investment package not found' });
            }
            const updateData = {};
            let calculatedEndDate = null;
            let effectiveStartDate = new Date(pkg.lockInStart || pkg.purchaseDate || pkg.createdAt || new Date());
            if (newStartDate) {
                const parsedStart = new Date(newStartDate);
                if (isNaN(parsedStart.getTime())) {
                    return res.status(400).json({ success: false, message: 'Invalid custom start date' });
                }
                effectiveStartDate = parsedStart;
                updateData.lockInStart = parsedStart;
                updateData.purchaseDate = parsedStart;
                const targetMonths = lockInMonths !== undefined && lockInMonths !== null && lockInMonths !== ''
                    ? parseInt(lockInMonths, 10)
                    : pkg.lockInMonths;
                if (!isNaN(targetMonths) && targetMonths >= 1 && targetMonths <= 60) {
                    calculatedEndDate = new Date(effectiveStartDate);
                    calculatedEndDate.setMonth(calculatedEndDate.getMonth() + targetMonths);
                    updateData.lockInEnd = calculatedEndDate;
                    updateData.withdrawalEligibilityDate = calculatedEndDate;
                }
            }
            if (lockInMonths !== undefined && lockInMonths !== null && lockInMonths !== '') {
                const months = parseInt(lockInMonths, 10);
                if (isNaN(months) || months < 1 || months > 60) {
                    return res.status(400).json({ success: false, message: 'lockInMonths must be an integer between 1 and 60' });
                }
                updateData.lockInMonths = months;
                calculatedEndDate = new Date(effectiveStartDate);
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
                    details: `Updated package ${pkg.packageCode} tenure to ${updateData.lockInMonths || pkg.lockInMonths} months. Start: ${updated.lockInStart?.toISOString()}, Lock end: ${updated.lockInEnd?.toISOString()}. Notes: ${adminNotes || 'None'}`,
                },
            });
            res.json({
                success: true,
                message: `Package ${pkg.packageCode} FD dates/tenure updated (${updated.lockInMonths} months, Maturity: ${updated.lockInEnd ? new Date(updated.lockInEnd).toLocaleDateString() : 'Active'}).`,
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
            await investments_service_1.investmentsService.ensureVentureSchema();
            const adminUserId = req.user.id;
            const listingId = req.params.id;
            const { companyName, tagline, country, countryCode, city, industry, dueDiligenceStatus, pitchOverview, logoUrl, valuation, stage, instrument, growthNotes, verifiedFundsRaised, fundingTarget, minInvestment, investorCount, status, startDate, deadline, lockInMonths, maturityDate, expectedReturnPct, performancePct, termsAndNotes, dueDiligenceSummary, supportingDocuments, registrationDetails, officialLinks, contactInfo, riskFactors, problemSolution, businessModel, marketOpportunity, financialHighlights, pitchDeckUrl, providerName, providerInvestedAmount, providerTransferredAt, providerExpectedReturnAmount, providerExpectedReturnDate, providerActualReceivedAmount, providerReceivedAt, providerNotes, } = req.body;
            const listing = await prisma_1.prisma.startupListing.findUnique({
                where: { id: listingId },
                include: { investments: true },
            });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'Startup listing not found' });
            }
            const oldValuation = new decimal_js_1.default(listing.valuation.toString());
            const parsedVal = valuation !== undefined && valuation !== '' ? parseFloat(String(valuation)) : parseFloat(oldValuation.toString());
            if (!Number.isFinite(parsedVal) || parsedVal <= 0) {
                return res.status(400).json({ success: false, message: 'Valid post-money valuation (> 0) is required' });
            }
            const newValuation = new decimal_js_1.default(parsedVal);
            const valuationChanged = !newValuation.equals(oldValuation);
            const valuationMultiplier = newValuation.dividedBy(oldValuation);
            const gainPct = valuationMultiplier.minus(1).times(100);
            const hasPerfOverride = performancePct !== undefined && performancePct !== '' && Number.isFinite(Number(performancePct));
            const parsedPerfPct = hasPerfOverride ? new decimal_js_1.default(Number(performancePct).toFixed(2)) : null;
            const prevPerfPct = new decimal_js_1.default(listing.performancePct?.toString() || '0');
            const perfChanged = parsedPerfPct !== null && !parsedPerfPct.equals(prevPerfPct);
            const updateData = {
                valuation: newValuation,
                stage: stage || listing.stage,
                financialHighlights: growthNotes
                    ? `${listing.financialHighlights || ''}\n[${new Date().toISOString()}] ${growthNotes}`
                    : listing.financialHighlights,
            };
            if (companyName !== undefined && String(companyName).trim())
                updateData.companyName = String(companyName).trim();
            if (tagline !== undefined)
                updateData.tagline = String(tagline).trim();
            if (country !== undefined && String(country).trim())
                updateData.country = String(country).trim();
            if (countryCode !== undefined && String(countryCode).trim())
                updateData.countryCode = String(countryCode).trim().toUpperCase();
            if (city !== undefined && String(city).trim())
                updateData.city = String(city).trim();
            if (industry !== undefined && String(industry).trim())
                updateData.industry = String(industry).trim();
            if (dueDiligenceStatus !== undefined && String(dueDiligenceStatus).trim())
                updateData.dueDiligenceStatus = String(dueDiligenceStatus).trim().toUpperCase();
            if (pitchOverview !== undefined)
                updateData.pitchOverview = String(pitchOverview).trim();
            if (logoUrl !== undefined)
                updateData.logoUrl = logoUrl || listing.logoUrl;
            if (instrument)
                updateData.instrument = String(instrument).toUpperCase();
            if (dueDiligenceSummary !== undefined)
                updateData.dueDiligenceSummary = dueDiligenceSummary || null;
            if (termsAndNotes !== undefined)
                updateData.termsAndNotes = termsAndNotes || null;
            if (registrationDetails !== undefined)
                updateData.registrationDetails = registrationDetails || null;
            if (riskFactors !== undefined)
                updateData.riskFactors = riskFactors || null;
            if (problemSolution !== undefined)
                updateData.problemSolution = problemSolution || null;
            if (businessModel !== undefined)
                updateData.businessModel = businessModel || null;
            if (marketOpportunity !== undefined)
                updateData.marketOpportunity = marketOpportunity || null;
            if (financialHighlights !== undefined && !growthNotes) {
                updateData.financialHighlights =
                    typeof financialHighlights === 'string'
                        ? financialHighlights || null
                        : financialHighlights
                            ? JSON.stringify(financialHighlights)
                            : null;
            }
            if (pitchDeckUrl !== undefined)
                updateData.pitchDeckUrl = pitchDeckUrl || null;
            if (officialLinks !== undefined) {
                updateData.officialLinks =
                    typeof officialLinks === 'string'
                        ? officialLinks
                        : JSON.stringify(officialLinks && typeof officialLinks === 'object' ? officialLinks : {});
            }
            if (contactInfo !== undefined) {
                updateData.contactInfo =
                    typeof contactInfo === 'string'
                        ? contactInfo
                        : JSON.stringify(contactInfo && typeof contactInfo === 'object' ? contactInfo : {});
            }
            if (supportingDocuments !== undefined) {
                updateData.supportingDocuments =
                    typeof supportingDocuments === 'string'
                        ? supportingDocuments
                        : JSON.stringify(Array.isArray(supportingDocuments) ? supportingDocuments : []);
            }
            if (startDate !== undefined)
                updateData.startDate = startDate ? new Date(startDate) : null;
            if (deadline !== undefined && deadline !== '')
                updateData.deadline = new Date(deadline);
            if (maturityDate !== undefined)
                updateData.maturityDate = maturityDate ? new Date(maturityDate) : null;
            if (lockInMonths !== undefined && lockInMonths !== '') {
                const lockM = Math.max(0, Math.floor(Number(lockInMonths)));
                if (Number.isFinite(lockM))
                    updateData.lockInMonths = lockM;
            }
            if (expectedReturnPct !== undefined && expectedReturnPct !== '') {
                const expRet = Number(expectedReturnPct);
                if (Number.isFinite(expRet))
                    updateData.expectedReturnPct = new decimal_js_1.default(expRet.toFixed(2));
            }
            if (parsedPerfPct !== null) {
                updateData.performancePct = parsedPerfPct;
            }
            else if (valuationChanged) {
                const compoundedPerf = new decimal_js_1.default(1)
                    .plus(prevPerfPct.div(100))
                    .times(valuationMultiplier)
                    .minus(1)
                    .times(100);
                updateData.performancePct = new decimal_js_1.default(compoundedPerf.toFixed(2));
            }
            if (providerName !== undefined)
                updateData.providerName = providerName || null;
            if (providerInvestedAmount !== undefined && providerInvestedAmount !== '') {
                const v = Number(providerInvestedAmount);
                if (Number.isFinite(v) && v >= 0)
                    updateData.providerInvestedAmount = new decimal_js_1.default(v.toFixed(2));
            }
            if (providerTransferredAt !== undefined) {
                updateData.providerTransferredAt = providerTransferredAt ? new Date(providerTransferredAt) : null;
            }
            if (providerExpectedReturnAmount !== undefined && providerExpectedReturnAmount !== '') {
                const v = Number(providerExpectedReturnAmount);
                if (Number.isFinite(v) && v >= 0)
                    updateData.providerExpectedReturnAmount = new decimal_js_1.default(v.toFixed(2));
            }
            if (providerExpectedReturnDate !== undefined) {
                updateData.providerExpectedReturnDate = providerExpectedReturnDate ? new Date(providerExpectedReturnDate) : null;
            }
            if (providerActualReceivedAmount !== undefined && providerActualReceivedAmount !== '') {
                const v = Number(providerActualReceivedAmount);
                if (Number.isFinite(v) && v >= 0)
                    updateData.providerActualReceivedAmount = new decimal_js_1.default(v.toFixed(2));
            }
            if (providerReceivedAt !== undefined) {
                updateData.providerReceivedAt = providerReceivedAt ? new Date(providerReceivedAt) : null;
            }
            if (providerNotes !== undefined)
                updateData.providerNotes = providerNotes || null;
            if (verifiedFundsRaised !== undefined && verifiedFundsRaised !== '') {
                const raisedNum = parseFloat(String(verifiedFundsRaised));
                if (!Number.isFinite(raisedNum) || raisedNum < 0) {
                    return res.status(400).json({ success: false, message: 'Invested / raised funds cannot be negative' });
                }
                updateData.verifiedFundsRaised = new decimal_js_1.default(raisedNum);
            }
            if (fundingTarget !== undefined && fundingTarget !== '') {
                const targetNum = parseFloat(String(fundingTarget));
                if (!Number.isFinite(targetNum) || targetNum <= 0) {
                    return res.status(400).json({ success: false, message: 'Funding target must be greater than zero' });
                }
                updateData.fundingTarget = new decimal_js_1.default(targetNum);
            }
            if (minInvestment !== undefined && minInvestment !== '') {
                const minNum = parseFloat(String(minInvestment));
                if (!Number.isFinite(minNum) || minNum <= 0) {
                    return res.status(400).json({ success: false, message: 'Minimum investment check must be greater than zero' });
                }
                updateData.minInvestment = new decimal_js_1.default(minNum);
            }
            if (investorCount !== undefined && investorCount !== '') {
                const invNum = Math.floor(Number(investorCount));
                if (!Number.isFinite(invNum) || invNum < 0) {
                    return res.status(400).json({ success: false, message: 'Investor count cannot be negative' });
                }
                updateData.investorCount = invNum;
            }
            if (status && ['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'CLOSED', 'SUSPENDED'].includes(String(status).toUpperCase())) {
                updateData.status = String(status).toUpperCase();
            }
            // Update Listing
            const updatedListing = await prisma_1.prisma.startupListing.update({
                where: { id: listingId },
                data: updateData,
            });
            const lockChanged = (maturityDate !== undefined && String(maturityDate) !== String(listing.maturityDate || '')) ||
                (lockInMonths !== undefined && lockInMonths !== '' && Number(lockInMonths) !== Number(listing.lockInMonths));
            // Recalculate active/open investor commitment values automatically when performancePct, valuation, or lock-in changes
            if (perfChanged || valuationChanged || lockChanged) {
                for (const commitment of listing.investments) {
                    if (commitment.status === 'EXITED')
                        continue;
                    const netInvested = new decimal_js_1.default(commitment.netInvestedAmount.toString());
                    const prevHold = commitment.currentValuation ? new decimal_js_1.default(commitment.currentValuation.toString()) : netInvested;
                    let updatedHoldingValue = prevHold;
                    let commitmentGainPct = new decimal_js_1.default(commitment.unrealizedReturnPct?.toString() || '0');
                    if (perfChanged && parsedPerfPct !== null) {
                        updatedHoldingValue = new decimal_js_1.default(netInvested.times(new decimal_js_1.default(1).plus(parsedPerfPct.div(100))).toFixed(2));
                        commitmentGainPct = parsedPerfPct;
                    }
                    else if (valuationChanged) {
                        const safeBaseHold = Number(commitment.unrealizedReturnPct || 0) === 0 &&
                            prevHold.equals(oldValuation) &&
                            netInvested.lessThan(oldValuation)
                            ? netInvested
                            : prevHold;
                        updatedHoldingValue = new decimal_js_1.default(safeBaseHold.times(valuationMultiplier).toFixed(2));
                        commitmentGainPct = netInvested.greaterThan(0)
                            ? new decimal_js_1.default(updatedHoldingValue.minus(netInvested).dividedBy(netInvested).times(100).toFixed(2))
                            : new decimal_js_1.default(0);
                    }
                    let updatedLockInEnd = commitment.lockInEnd;
                    if (lockChanged) {
                        if (updatedListing.maturityDate) {
                            updatedLockInEnd = updatedListing.maturityDate;
                        }
                        else {
                            const lm = Math.max(0, Number(updatedListing.lockInMonths ?? 12));
                            const d = new Date(commitment.createdAt);
                            d.setMonth(d.getMonth() + lm);
                            updatedLockInEnd = d;
                        }
                    }
                    await prisma_1.prisma.investmentCommitment.update({
                        where: { id: commitment.id },
                        data: {
                            currentValuation: updatedHoldingValue,
                            unrealizedReturnPct: commitmentGainPct,
                            lockInEnd: updatedLockInEnd,
                            notes: growthNotes
                                ? `${commitment.notes || ''}\n[${new Date().toISOString()}] Performance updated (${commitmentGainPct.greaterThanOrEqualTo(0) ? '+' : ''}${commitmentGainPct.toFixed(2)}%, Holding: $${updatedHoldingValue.toFixed(2)}): ${growthNotes}`
                                : commitment.notes,
                        },
                    });
                }
            }
            // Audit Log
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'UPDATE_STARTUP_VALUATION',
                    entity: 'StartupListing',
                    entityId: listingId,
                    details: `Updated ${listing.companyName}: Valuation $${newValuation.toLocaleString()}, Performance ${Number(updatedListing.performancePct).toFixed(2)}%, Lock-In ${updatedListing.lockInMonths}mo, Raised $${Number(updatedListing.verifiedFundsRaised).toLocaleString()}, Provider Invested $${Number(updatedListing.providerInvestedAmount).toLocaleString()}, Provider Received $${Number(updatedListing.providerActualReceivedAmount).toLocaleString()}.`,
                },
            });
            res.json({
                success: true,
                message: `Updated ${updatedListing.companyName} (${Number(updatedListing.performancePct) >= 0 ? '+' : ''}${Number(updatedListing.performancePct).toFixed(2)}% performance, Valuation $${newValuation.toLocaleString()}).`,
                data: {
                    listing: updatedListing,
                    gainPct: Number(updatedListing.performancePct).toFixed(2),
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
                        where: {
                            status: { in: ['CLEARED_FUNDS', 'ACTIVE', 'DOCUMENT_SIGNED'] },
                            sourceType: { not: 'ADMIN_DISPLAY_MOCK' },
                        },
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
            const profitShareSetting = await prisma_1.prisma.cmsSetting.findUnique({
                where: { key: 'startup_profit_share_percent' },
            });
            const configuredProfitFeePct = new decimal_js_1.default(profitShareSetting?.value || '5.00');
            const distributedRecords = [];
            let totalDistributedGross = new decimal_js_1.default(0);
            let totalPlatformFees = new decimal_js_1.default(0);
            let totalNetCredited = new decimal_js_1.default(0);
            // Distribute pro-rata to each investor inside an atomic ledger transaction
            for (const inv of listing.investments) {
                const netInvested = new decimal_js_1.default(inv.netInvestedAmount.toString());
                const investorShareFraction = netInvested.dividedBy(totalRaised);
                const grossInvestorProceeds = new decimal_js_1.default(totalPool.times(investorShareFraction).toFixed(8));
                // Principal returned 100% fee-free (accounts for any earlier partial dividend returns of capital)
                const priorReturnedCapital = new decimal_js_1.default(inv.returnOfCapital?.toString() || '0');
                const remainingPrincipal = decimal_js_1.default.max(netInvested.minus(priorReturnedCapital), new decimal_js_1.default(0));
                const capitalReturn = decimal_js_1.default.min(grossInvestorProceeds, remainingPrincipal);
                const eligibleProfit = decimal_js_1.default.max(grossInvestorProceeds.minus(remainingPrincipal), new decimal_js_1.default(0));
                // Admin-configurable profit-share fee strictly on net profit
                const profitFeePct = configuredProfitFeePct;
                const platformFeeAmount = new decimal_js_1.default(eligibleProfit.times(profitFeePct.dividedBy(100)).toFixed(8));
                const netProfitGain = eligibleProfit.minus(platformFeeAmount);
                const netCashPayout = grossInvestorProceeds.minus(platformFeeAmount);
                const invWallet = await ledger_service_1.ledgerService.ensureWallet(inv.investorUserId);
                const txCode = `DIST-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
                await prisma_1.prisma.$transaction(async (tx) => {
                    const lockedUsd = await ledger_service_1.ledgerService.lockWalletBalance(tx, invWallet.id, 'USD');
                    const balBefore = new decimal_js_1.default(lockedUsd.availableBalance.toString());
                    const balAfter = balBefore.plus(netCashPayout);
                    // 1. Credit investor available balance in USD
                    await tx.walletBalance.update({
                        where: { id: lockedUsd.id },
                        data: { availableBalance: balAfter.toFixed(8) },
                    });
                    // 2. Balanced double-entry ledger journal: Debit Treasury Proceeds -> Credit Investor + Platform Profit-Share Revenue
                    const distEntries = [
                        {
                            accountId: 'PLATFORM_TREASURY_USD',
                            direction: 'DEBIT',
                            amount: grossInvestorProceeds.toFixed(8),
                            currency: 'USD',
                        },
                        {
                            accountId: 'USER_AVAILABLE_USD',
                            userId: inv.investorUserId,
                            direction: 'CREDIT',
                            amount: netCashPayout.toFixed(8),
                            currency: 'USD',
                        },
                    ];
                    if (platformFeeAmount.greaterThan(0)) {
                        distEntries.push({
                            accountId: 'PLATFORM_FEE_REVENUE_USD',
                            direction: 'CREDIT',
                            amount: platformFeeAmount.toFixed(8),
                            currency: 'USD',
                        });
                    }
                    await ledger_service_1.ledgerService.recordJournal(tx, {
                        idempotencyKey: txCode,
                        referenceType: client_1.JournalReferenceType.INVESTMENT_DISTRIBUTION,
                        referenceId: txCode,
                        notes: `${listing.companyName} ${distributionType} distribution (Investor Net: $${netCashPayout.toFixed(2)}, ${profitFeePct.toFixed(1)}% Profit Share Fee: $${platformFeeAmount.toFixed(2)})`,
                        createdBy: adminUserId,
                        entries: distEntries,
                    });
                    // 3. Create Transaction Ledger entries for user (Payout + Profit-Share Fee)
                    await tx.transaction.create({
                        data: {
                            userId: inv.investorUserId,
                            transactionCode: txCode,
                            type: client_1.TransactionType.INVESTMENT_DISTRIBUTION,
                            amount: netCashPayout.toFixed(8),
                            currency: 'USD',
                            status: client_1.TransactionStatus.COMPLETED,
                            balanceBefore: balBefore.toFixed(8),
                            balanceAfter: balAfter.toFixed(8),
                            settlementReference: txCode,
                            createdBy: adminUserId,
                            idempotencyKey: txCode,
                            notes: `${distributionType === 'DIVIDEND' ? 'Startup Dividend Distribution' : 'Startup Exit Payout'}: ${listing.companyName} (Principal: $${capitalReturn.toFixed(2)}, Net Gain: $${netProfitGain.toFixed(2)})`,
                        },
                    });
                    if (platformFeeAmount.greaterThan(0)) {
                        await tx.transaction.create({
                            data: {
                                userId: inv.investorUserId,
                                transactionCode: `TX-INVPS-${txCode.replace('DIST-', '')}`,
                                type: client_1.TransactionType.INVESTMENT_PROFIT_SHARE,
                                amount: platformFeeAmount.toFixed(8),
                                currency: 'USD',
                                status: client_1.TransactionStatus.COMPLETED,
                                balanceBefore: balAfter.toFixed(8),
                                balanceAfter: balAfter.toFixed(8),
                                settlementReference: txCode,
                                createdBy: adminUserId,
                                idempotencyKey: `${txCode}-PSFEE`,
                                notes: `${profitFeePct.toFixed(1)}% Profit-Share Fee on ${listing.companyName} realized profit ($${eligibleProfit.toFixed(2)})`,
                            },
                        });
                    }
                    // 4. Update InvestmentCommitment status and financials
                    await tx.investmentCommitment.update({
                        where: { id: inv.id },
                        data: {
                            realizedProceeds: { increment: grossInvestorProceeds.toFixed(8) },
                            returnOfCapital: { increment: capitalReturn.toFixed(8) },
                            eligibleNetProfit: { increment: eligibleProfit.toFixed(8) },
                            profitShareFeeAmount: { increment: platformFeeAmount.toFixed(8) },
                            netDistributedProfit: { increment: netProfitGain.toFixed(8) },
                            status: distributionType === 'DIVIDEND' ? 'ACTIVE' : 'EXITED',
                            ...(distributionType !== 'DIVIDEND' ? { maturedAt: new Date() } : {}),
                            settlementReference: txCode,
                            notes: notes ? `${inv.notes || ''}\n[${new Date().toISOString()}] ${notes}` : inv.notes,
                        },
                    });
                }, { timeout: 45000, maxWait: 15000 });
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
                    details: `Distributed ${distributionType} for ${listing.companyName}. Gross Pool: $${totalPool.toFixed(2)}, Net Credited: $${totalNetCredited.toFixed(2)}, ${configuredProfitFeePct.toFixed(1)}% Profit Share Fee: $${totalPlatformFees.toFixed(2)} across ${distributedRecords.length} investors.`,
                },
            });
            res.json({
                success: true,
                message: `Successfully distributed $${totalNetCredited.toFixed(2)} USD to ${distributedRecords.length} investors for ${listing.companyName}. ${configuredProfitFeePct.toFixed(1)}% platform fee: $${totalPlatformFees.toFixed(2)} USD.`,
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
            await p2p_service_1.p2pService.ensureP2PReady();
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
                    { displayName: { contains: query } },
                    { phone: { contains: query } },
                ];
            }
            const [users, total, riskMetricsMap] = await Promise.all([
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
                liquidityRisk_service_1.liquidityRiskService.getUserRiskMetricsBatch().catch(() => new Map()),
            ]);
            const formatted = users.map((u) => {
                const usdBal = u.wallet?.balances.find((b) => b.currency === 'USD')?.availableBalance?.toString() || '0.00';
                const usdtBal = u.wallet?.balances.find((b) => b.currency === 'USDT')?.availableBalance?.toString() || '0.00';
                const isLocked = !!(u.withdrawalLockedUntil && new Date() < u.withdrawalLockedUntil);
                const rm = riskMetricsMap.get(u.id) || null;
                return {
                    id: u.id,
                    email: u.email,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    displayName: u.displayName || null,
                    phone: u.phone,
                    country: u.country,
                    role: u.role,
                    kycStatus: u.kycStatus,
                    twoFactorEnabled: u.twoFactorEnabled,
                    accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(u.id),
                    isWithdrawalLocked: isLocked,
                    withdrawalLockedUntil: u.withdrawalLockedUntil,
                    status: u.status,
                    isP2pMerchant: Boolean(u.isP2pMerchant),
                    p2pBlocked: Boolean(u.p2pBlocked),
                    p2pBlockedReason: u.p2pBlockedReason || null,
                    p2pBlockedAt: u.p2pBlockedAt || null,
                    credibilityLevel: u.credibilityLevel || 'BRONZE',
                    customCompletedOrders: u.customCompletedOrders ?? null,
                    customRating: u.customRating ? u.customRating.toString() : null,
                    customMemberSince: u.customMemberSince || null,
                    credibilityNote: u.credibilityNote || null,
                    credibilityUpdatedAt: u.credibilityUpdatedAt || null,
                    credibilityUpdatedBy: u.credibilityUpdatedBy || null,
                    balances: {
                        USD: parseFloat(usdBal).toFixed(2),
                        USDT: parseFloat(usdtBal).toFixed(2),
                    },
                    walletBalances: u.wallet?.balances.map((b) => ({
                        currency: b.currency,
                        available: b.availableBalance.toString(),
                        locked: b.lockedPrincipal.toString(),
                        pending: b.pendingSettlement.toString(),
                    })) || [],
                    riskMetrics: rm,
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
            const riskMetricsMap = await liquidityRisk_service_1.liquidityRiskService.getUserRiskMetricsBatch().catch(() => new Map());
            const pendingSwaps = await prisma_1.prisma.swapRequest
                .findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 })
                .catch(() => []);
            res.json({
                success: true,
                data: {
                    ...user,
                    accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(user.id),
                    riskMetrics: riskMetricsMap.get(id) || null,
                    swapRequests: pendingSwaps,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Read-only Client Portal preview payload for Admin/Staff support inspection
     */
    async getUserClientView(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : undefined;
            const id = String(req.params.id);
            const user = await prisma_1.prisma.user.findUnique({
                where: { id },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    phone: true,
                    country: true,
                    role: true,
                    status: true,
                    kycStatus: true,
                    twoFactorEnabled: true,
                    emailVerified: true,
                    isP2pMerchant: true,
                    p2pBlocked: true,
                    withdrawalLockedUntil: true,
                    isAvailable: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
            });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            const [wallet, packages, transactions, withdrawals, tickets, deposits, investments, tokenStatus, notifications,] = await Promise.all([
                ledger_service_1.ledgerService.getUserWalletSummary(id).catch(() => null),
                package_service_1.packageService.getUserPackages(id).catch(() => []),
                prisma_1.prisma.transaction
                    .findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 100 })
                    .catch(() => []),
                withdrawal_service_1.withdrawalService.getUserWithdrawals(id).catch(() => []),
                prisma_1.prisma.supportTicket
                    .findMany({
                    where: { userId: id },
                    include: { replies: { orderBy: { createdAt: 'asc' } } },
                    orderBy: { createdAt: 'desc' },
                })
                    .catch(() => []),
                deposit_service_1.depositService.getUserDeposits(id).catch(() => []),
                investments_service_1.investmentsService.getInvestorDashboard(id).catch(() => ({ commitments: [], summary: null })),
                token_service_1.tokenService.getUserTokenStatus(id).catch(() => null),
                wallet_controller_1.walletController.buildCustomerNotifications(id).catch(() => ({ notifications: [], summary: null })),
            ]);
            if (adminUserId) {
                await prisma_1.prisma.adminAuditLog
                    .create({
                    data: {
                        userId: adminUserId,
                        action: 'ADMIN_CLIENT_VIEW_INSPECT',
                        entity: 'User',
                        entityId: id,
                        details: `Admin opened read-only Client Portal View for ${user.firstName || ''} ${user.lastName || ''} (${user.email}).`,
                    },
                })
                    .catch(() => { });
            }
            res.json({
                success: true,
                data: {
                    user: {
                        ...user,
                        accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(user.id),
                    },
                    wallet,
                    packages,
                    transactions,
                    withdrawals,
                    tickets,
                    deposits,
                    investments,
                    tokenStatus,
                    notifications,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get audited portfolio valuation & asset allocation breakdown for a user
     */
    async getUserPortfolioBreakdown(req, res, next) {
        try {
            const id = String(req.params.id);
            const user = await prisma_1.prisma.user.findUnique({
                where: { id },
                select: { id: true, email: true, firstName: true, lastName: true },
            });
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            const summary = await ledger_service_1.ledgerService.getUserWalletSummary(id);
            res.json({
                success: true,
                data: {
                    user: {
                        ...user,
                        accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(user.id),
                    },
                    ...summary,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List all Avora Token ($AVR) buyers, whitelist registrants, and live holding/unlock metrics
     */
    async getTokenHolders(req, res, next) {
        try {
            const policy = await token_service_1.tokenService.getTokenPolicyConfig();
            const livePriceUsd = Number(policy.currentPriceUsd.toString());
            const now = new Date();
            const records = await prisma_1.prisma.tokenEarlyAccess.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            displayName: true,
                            country: true,
                            status: true,
                            kycStatus: true,
                        },
                    },
                },
                orderBy: [{ paidAllocationUsd: 'desc' }, { createdAt: 'desc' }],
            });
            let paidHoldersCount = 0;
            let whitelistOnlyCount = 0;
            let unlockedHoldersCount = 0;
            let totalTokensAllocated = 0;
            let totalPaidUsd = 0;
            let currentLiabilityUsd = 0;
            const holders = records.map((r) => {
                const tokensAllocated = Number(r.tokensAllocated || 0);
                const paidAllocationUsd = Number(r.paidAllocationUsd || 0);
                const requestedAllocationUsd = Number(r.requestedAllocationUsd || 0);
                const avgEntryPriceUsd = tokensAllocated > 0 && paidAllocationUsd > 0 ? paidAllocationUsd / tokensAllocated : livePriceUsd;
                const currentValueUsd = tokensAllocated * livePriceUsd;
                const unrealizedProfitUsd = currentValueUsd - paidAllocationUsd;
                const unrealizedRoiPct = paidAllocationUsd > 0 ? (unrealizedProfitUsd / paidAllocationUsd) * 100 : 0;
                const basisDate = r.lastPurchaseAt || r.createdAt;
                const unlockAt = tokensAllocated > 0
                    ? policy.unlockAllNow || policy.lockinDays <= 0
                        ? now
                        : new Date(new Date(basisDate).getTime() + policy.lockinDays * 24 * 60 * 60 * 1000)
                    : null;
                const isUnlocked = tokensAllocated > 0 &&
                    (policy.unlockAllNow || policy.lockinDays <= 0 || (unlockAt ? now >= unlockAt : false));
                const daysRemaining = tokensAllocated > 0 && unlockAt && !isUnlocked
                    ? Math.max(0, Math.ceil((unlockAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                    : 0;
                if (tokensAllocated > 0 || paidAllocationUsd > 0) {
                    paidHoldersCount += 1;
                    if (isUnlocked)
                        unlockedHoldersCount += 1;
                }
                else {
                    whitelistOnlyCount += 1;
                }
                totalTokensAllocated += tokensAllocated;
                totalPaidUsd += paidAllocationUsd;
                currentLiabilityUsd += currentValueUsd;
                return {
                    id: r.id,
                    userId: r.userId,
                    accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(r.userId),
                    user: r.user,
                    tokensAllocated,
                    paidAllocationUsd,
                    requestedAllocationUsd,
                    paidCurrency: r.paidCurrency || 'USD',
                    lastPurchaseAt: r.lastPurchaseAt,
                    status: r.status,
                    walletAddress: r.walletAddress,
                    avgEntryPriceUsd,
                    currentValueUsd,
                    unrealizedProfitUsd,
                    unrealizedRoiPct,
                    lockinDays: policy.lockinDays,
                    unlockAt,
                    isUnlocked,
                    daysRemaining,
                    createdAt: r.createdAt,
                };
            });
            res.json({
                success: true,
                data: {
                    policy: {
                        priceUsd: livePriceUsd,
                        lockinDays: policy.lockinDays,
                        redemptionEnabled: policy.redemptionEnabled,
                        unlockAllNow: policy.unlockAllNow,
                        displayChangePct: policy.displayChangePct,
                        scheduledPriceUsd: policy.scheduledPriceUsd ? Number(policy.scheduledPriceUsd) : null,
                        scheduledEffectiveAt: policy.scheduledEffectiveAt ? policy.scheduledEffectiveAt.toISOString() : null,
                        isScheduledPending: policy.isScheduledPending,
                        feePercent: policy.feePercent,
                        stageName: policy.stageName,
                        stageTargetPriceUsd: policy.stageTargetPriceUsd,
                        stageProgressPct: policy.stageProgressPct,
                    },
                    summary: {
                        totalRecords: holders.length,
                        paidHoldersCount,
                        whitelistOnlyCount,
                        unlockedHoldersCount,
                        lockedHoldersCount: Math.max(0, paidHoldersCount - unlockedHoldersCount),
                        totalTokensAllocated,
                        totalPaidUsd,
                        currentLiabilityUsd,
                        totalUnrealizedProfitUsd: currentLiabilityUsd - totalPaidUsd,
                    },
                    holders,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update Avora Token ($AVR) valuation pricing, effective timing, display percentage, and policy
     */
    async updateTokenPolicy(req, res, next) {
        try {
            const adminUserId = req.user?.id || 'ADMIN';
            const { priceUsd, effectiveTiming, scheduledPriceUsd, scheduledEffectiveAt, displayChangePct, lockinDays, redemptionEnabled, unlockAllNow, feePercent, stageName, stageTargetPriceUsd, stageProgressPct, } = req.body || {};
            const changes = [];
            // 1. Price & Timing
            if (effectiveTiming === 'SCHEDULED' && scheduledPriceUsd && scheduledEffectiveAt) {
                const numSched = parseFloat(scheduledPriceUsd);
                const effDate = new Date(scheduledEffectiveAt);
                if (!isNaN(numSched) && numSched > 0 && !isNaN(effDate.getTime())) {
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key: 'avr_token_scheduled_price_usd' },
                        update: { value: numSched.toFixed(4), group: 'TOKEN' },
                        create: { key: 'avr_token_scheduled_price_usd', value: numSched.toFixed(4), group: 'TOKEN' },
                    });
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key: 'avr_token_scheduled_effective_at' },
                        update: { value: effDate.toISOString(), group: 'TOKEN' },
                        create: { key: 'avr_token_scheduled_effective_at', value: effDate.toISOString(), group: 'TOKEN' },
                    });
                    changes.push(`Scheduled price $${numSched.toFixed(4)} USD effective at ${effDate.toISOString()}`);
                }
            }
            else {
                // Immediate price update or cancel schedule
                if (priceUsd !== undefined && priceUsd !== null && priceUsd !== '') {
                    const numPrice = parseFloat(priceUsd);
                    if (!isNaN(numPrice) && numPrice > 0) {
                        await prisma_1.prisma.cmsSetting.upsert({
                            where: { key: 'avr_token_price_usd' },
                            update: { value: numPrice.toFixed(4), group: 'TOKEN' },
                            create: { key: 'avr_token_price_usd', value: numPrice.toFixed(4), group: 'TOKEN' },
                        });
                        changes.push(`Active price set to $${numPrice.toFixed(4)} USD`);
                    }
                }
                // If immediate, clear any pending future schedule
                await prisma_1.prisma.cmsSetting
                    .deleteMany({
                    where: { key: { in: ['avr_token_scheduled_price_usd', 'avr_token_scheduled_effective_at'] } },
                })
                    .catch(() => { });
            }
            // 2. Display Percentage Metric
            if (displayChangePct !== undefined && displayChangePct !== null) {
                const strVal = String(displayChangePct).trim();
                await prisma_1.prisma.cmsSetting.upsert({
                    where: { key: 'avr_token_display_change_pct' },
                    update: { value: strVal, group: 'TOKEN' },
                    create: { key: 'avr_token_display_change_pct', value: strVal, group: 'TOKEN' },
                });
                changes.push(`Display % metric set to '${strVal}'`);
            }
            // 3. Lock-in Days
            if (lockinDays !== undefined && lockinDays !== null && lockinDays !== '') {
                const numLock = parseInt(lockinDays, 10);
                if (!isNaN(numLock) && numLock >= 0) {
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key: 'avr_lockin_days' },
                        update: { value: String(numLock), group: 'TOKEN' },
                        create: { key: 'avr_lockin_days', value: String(numLock), group: 'TOKEN' },
                    });
                    changes.push(`Lock-in set to ${numLock} days`);
                }
            }
            // 4. Redemption Enabled
            if (redemptionEnabled !== undefined && redemptionEnabled !== null) {
                const boolVal = String(redemptionEnabled).toLowerCase() !== 'false';
                await prisma_1.prisma.cmsSetting.upsert({
                    where: { key: 'avr_redemption_enabled' },
                    update: { value: String(boolVal), group: 'TOKEN' },
                    create: { key: 'avr_redemption_enabled', value: String(boolVal), group: 'TOKEN' },
                });
                changes.push(`Redemption enabled: ${boolVal}`);
            }
            // 5. Unlock All Now
            if (unlockAllNow !== undefined && unlockAllNow !== null) {
                const boolVal = String(unlockAllNow).toLowerCase() === 'true';
                await prisma_1.prisma.cmsSetting.upsert({
                    where: { key: 'avr_unlock_all_now' },
                    update: { value: String(boolVal), group: 'TOKEN' },
                    create: { key: 'avr_unlock_all_now', value: String(boolVal), group: 'TOKEN' },
                });
                changes.push(`Immediate unlock override: ${boolVal}`);
            }
            // 6. Token Commission / Fee %
            if (feePercent !== undefined && feePercent !== null && feePercent !== '') {
                const numFee = parseFloat(feePercent);
                if (!isNaN(numFee) && numFee >= 0) {
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key: 'avr_token_fee_percent' },
                        update: { value: numFee.toFixed(2), group: 'TOKEN' },
                        create: { key: 'avr_token_fee_percent', value: numFee.toFixed(2), group: 'TOKEN' },
                    });
                    changes.push(`Token transaction fee set to ${numFee.toFixed(2)}%`);
                }
            }
            // 7. Token Growth Stage & Target Price
            if (stageName !== undefined && stageName !== null && String(stageName).trim() !== '') {
                const strStage = String(stageName).trim();
                await prisma_1.prisma.cmsSetting.upsert({
                    where: { key: 'avr_token_stage_name' },
                    update: { value: strStage, group: 'TOKEN' },
                    create: { key: 'avr_token_stage_name', value: strStage, group: 'TOKEN' },
                });
                changes.push(`Stage name set to '${strStage}'`);
            }
            if (stageTargetPriceUsd !== undefined && stageTargetPriceUsd !== null && stageTargetPriceUsd !== '') {
                const numTarget = parseFloat(stageTargetPriceUsd);
                if (!isNaN(numTarget) && numTarget > 0) {
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key: 'avr_token_stage_target_price_usd' },
                        update: { value: numTarget.toFixed(4), group: 'TOKEN' },
                        create: { key: 'avr_token_stage_target_price_usd', value: numTarget.toFixed(4), group: 'TOKEN' },
                    });
                    changes.push(`Stage target price set to $${numTarget.toFixed(4)} USD`);
                }
            }
            // 8. Progress % Override
            if (stageProgressPct !== undefined && stageProgressPct !== null && stageProgressPct !== '') {
                const numProg = parseFloat(stageProgressPct);
                if (!isNaN(numProg) && numProg >= 0 && numProg <= 100) {
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key: 'avr_token_stage_progress_pct' },
                        update: { value: numProg.toFixed(1), group: 'TOKEN' },
                        create: { key: 'avr_token_stage_progress_pct', value: numProg.toFixed(1), group: 'TOKEN' },
                    });
                    changes.push(`Stage progress set to ${numProg.toFixed(1)}%`);
                }
            }
            // Audit Log
            await prisma_1.prisma.adminAuditLog
                .create({
                data: {
                    userId: adminUserId,
                    action: 'AVR_TOKEN_POLICY_UPDATE',
                    entity: 'TokenPolicy',
                    entityId: 'AVR',
                    details: changes.join('; ') || 'Updated token policy',
                },
            })
                .catch(() => { });
            const updatedPolicy = await token_service_1.tokenService.getTokenPolicyConfig();
            res.json({
                success: true,
                message: 'Avora Token ($AVR) policy, valuation, commission, and stage metrics updated successfully!',
                data: {
                    priceUsd: Number(updatedPolicy.currentPriceUsd),
                    displayChangePct: updatedPolicy.displayChangePct,
                    scheduledPriceUsd: updatedPolicy.scheduledPriceUsd ? Number(updatedPolicy.scheduledPriceUsd) : null,
                    scheduledEffectiveAt: updatedPolicy.scheduledEffectiveAt
                        ? updatedPolicy.scheduledEffectiveAt.toISOString()
                        : null,
                    isScheduledPending: updatedPolicy.isScheduledPending,
                    lockinDays: updatedPolicy.lockinDays,
                    redemptionEnabled: updatedPolicy.redemptionEnabled,
                    unlockAllNow: updatedPolicy.unlockAllNow,
                    feePercent: updatedPolicy.feePercent,
                    stageName: updatedPolicy.stageName,
                    stageTargetPriceUsd: updatedPolicy.stageTargetPriceUsd,
                    stageProgressPct: updatedPolicy.stageProgressPct,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List all Newsletter Subscribers (cross-referenced with registered client accounts)
     */
    async getNewsletterSubscribers(req, res, next) {
        try {
            const rows = await prisma_1.prisma.inquiry.findMany({
                where: {
                    subject: { startsWith: 'NEWSLETTER:' },
                },
                orderBy: { createdAt: 'desc' },
            });
            const emails = Array.from(new Set(rows.map((r) => r.email.toLowerCase().trim()).filter(Boolean)));
            const matchedUsers = emails.length > 0
                ? await prisma_1.prisma.user.findMany({
                    where: { email: { in: emails } },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        kycStatus: true,
                        status: true,
                    },
                })
                : [];
            const userByEmail = new Map(matchedUsers.map((u) => [u.email.toLowerCase().trim(), u]));
            let registeredCount = 0;
            const subscribers = rows.map((r) => {
                const cleanEmail = r.email.toLowerCase().trim();
                const u = userByEmail.get(cleanEmail) || null;
                if (u)
                    registeredCount += 1;
                return {
                    id: r.id,
                    email: cleanEmail,
                    name: r.name,
                    subject: r.subject,
                    status: r.status,
                    subscribedAt: r.createdAt,
                    registeredUser: u
                        ? {
                            ...u,
                            accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(u.id),
                        }
                        : null,
                };
            });
            res.json({
                success: true,
                data: {
                    total: subscribers.length,
                    registeredUsersCount: registeredCount,
                    guestCount: subscribers.length - registeredCount,
                    subscribers,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Remove a Newsletter Subscriber record
     */
    async deleteNewsletterSubscriber(req, res, next) {
        try {
            const id = String(req.params.id);
            const existing = await prisma_1.prisma.inquiry.findUnique({ where: { id } });
            if (!existing || !String(existing.subject || '').startsWith('NEWSLETTER:')) {
                return res.status(404).json({ success: false, message: 'Newsletter subscriber not found' });
            }
            await prisma_1.prisma.inquiry.delete({ where: { id } });
            res.json({ success: true, message: `Removed ${existing.email} from newsletter subscribers.` });
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
                    group: { in: ['INVESTMENT', 'COMMISSION', 'WITHDRAWAL', 'REMITTANCE', 'OTC', 'P2P', 'CARDS', 'TOKEN'] },
                },
            });
            const configMap = {};
            settings.forEach((s) => {
                configMap[s.key] = s.value;
            });
            const defaults = {
                // Fixed Deposit (FD) Engine Defaults
                package_monthly_return_rate: configMap['package_monthly_return_rate'] || '0.0100', // 1.00%
                package_lock_in_months: configMap['package_lock_in_months'] || configMap['package_min_lockin_months'] || '6',
                package_min_amount: configMap['package_min_amount'] || '1000',
                package_max_amount: configMap['package_max_amount'] || '10000',
                package_early_exit_penalty_pct: configMap['package_early_exit_penalty_pct'] || '5.00',
                payout_day_of_month: configMap['payout_day_of_month'] || '1',
                withdrawal_processing_days: configMap['withdrawal_processing_days'] || '15',
                withdrawal_window_day: configMap['withdrawal_window_day'] || '1',
                // Platform Commissions, Fees & Bond Defaults
                razorpay_commission_percent: configMap['razorpay_commission_percent'] || '5.0',
                razorpay_gateway_fee_percent: configMap['razorpay_gateway_fee_percent'] || '3.0',
                razorpay_key_id: configMap['razorpay_key_id'] || process.env.RAZORPAY_KEY_ID || '',
                razorpay_webhook_secret: configMap['razorpay_webhook_secret'] || process.env.RAZORPAY_WEBHOOK_SECRET || '',
                remittance_fee_percent: configMap['remittance_fee_percent'] || '3.0',
                remittance_margin_percent: configMap['remittance_margin_percent'] || '2.0',
                show_remittance_spread_controls: configMap['show_remittance_spread_controls'] || 'false',
                show_about_leadership_section: configMap['show_about_leadership_section'] || 'false',
                remittance_corridors_count: configMap['remittance_corridors_count'] || '7',
                remittance_countries_count: configMap['remittance_countries_count'] || '110+',
                remittance_delivery_days: configMap['remittance_delivery_days'] || '2',
                startup_allocation_fee_percent: configMap['startup_allocation_fee_percent'] || '5.0',
                startup_profit_share_percent: configMap['startup_profit_share_percent'] || '5.0',
                startup_min_investment_usd: configMap['startup_min_investment_usd'] || '250',
                otc_spread_percent: configMap['otc_spread_percent'] || '1.0',
                otc_operator_fee_percent: configMap['otc_operator_fee_percent'] || '1.5',
                otc_platform_fee_percent: configMap['otc_platform_fee_percent'] || '0.5',
                otc_security_deposit_usd: configMap['otc_security_deposit_usd'] || '1000',
                withdrawal_fee_percent: configMap['withdrawal_fee_percent'] || '0.0',
                withdrawal_bank_wire_fee_percent: configMap['withdrawal_bank_wire_fee_percent'] || configMap['withdrawal_international_fee_percent'] || '5.0',
                withdrawal_international_fee_percent: configMap['withdrawal_international_fee_percent'] || configMap['withdrawal_bank_wire_fee_percent'] || '5.0',
                withdrawal_domestic_fee_percent: configMap['withdrawal_domestic_fee_percent'] || '5.0',
                withdrawal_crypto_fee_percent: configMap['withdrawal_crypto_fee_percent'] || '1.0',
                withdrawal_fx_spread_percent: configMap['withdrawal_fx_spread_percent'] || '0.0',
                withdrawal_min_amount_usd: configMap['withdrawal_min_amount_usd'] || '10.0',
                withdrawal_trc20_enabled: configMap['withdrawal_trc20_enabled'] || 'false',
                p2p_fee_percent: configMap['p2p_fee_percent'] || '0.0',
                p2p_security_deposit_usd: configMap['p2p_security_deposit_usd'] || '50',
                p2p_daily_limit_usd: configMap['p2p_daily_limit_usd'] || '5000',
                enable_virtual_cards: configMap['enable_virtual_cards'] || 'false',
                virtual_card_issuance_fee: configMap['virtual_card_issuance_fee'] || '10.00',
                avr_token_price_usd: configMap['avr_token_price_usd'] || '0.10',
                avr_lockin_days: configMap['avr_lockin_days'] || '180',
                avr_redemption_enabled: configMap['avr_redemption_enabled'] || 'true',
                avr_unlock_all_now: configMap['avr_unlock_all_now'] || 'false',
                admin_exchange_rate_overrides: configMap['admin_exchange_rate_overrides'] || '{}',
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
            const allowedKeys = new Set([
                'package_monthly_return_rate',
                'package_lock_in_months',
                'package_min_lockin_months',
                'package_min_amount',
                'package_max_amount',
                'package_early_exit_penalty_pct',
                'payout_day_of_month',
                'withdrawal_processing_days',
                'withdrawal_window_day',
                'withdrawal_fee_percent',
                'withdrawal_bank_wire_fee_percent',
                'withdrawal_international_fee_percent',
                'withdrawal_domestic_fee_percent',
                'withdrawal_crypto_fee_percent',
                'withdrawal_fx_spread_percent',
                'withdrawal_min_amount_usd',
                'withdrawal_trc20_enabled',
                'razorpay_commission_percent',
                'razorpay_gateway_fee_percent',
                'razorpay_key_id',
                'razorpay_webhook_secret',
                'remittance_fee_percent',
                'remittance_margin_percent',
                'show_remittance_spread_controls',
                'show_about_leadership_section',
                'remittance_corridors_count',
                'remittance_countries_count',
                'remittance_delivery_days',
                'startup_allocation_fee_percent',
                'startup_profit_share_percent',
                'startup_min_investment_usd',
                'otc_spread_percent',
                'otc_operator_fee_percent',
                'otc_platform_fee_percent',
                'otc_security_deposit_usd',
                'p2p_fee_percent',
                'p2p_security_deposit_usd',
                'p2p_daily_limit_usd',
                'enable_virtual_cards',
                'virtual_card_issuance_fee',
                'avr_token_price_usd',
                'avr_token_display_change_pct',
                'avr_token_scheduled_price_usd',
                'avr_token_scheduled_effective_at',
                'avr_lockin_days',
                'avr_redemption_enabled',
                'avr_unlock_all_now',
                'admin_exchange_rate_overrides',
            ]);
            const updatedKeys = [];
            for (const [key, value] of Object.entries(settings)) {
                if (!allowedKeys.has(key))
                    continue;
                if (value !== undefined && value !== null) {
                    let group = 'COMMISSION';
                    if (key.startsWith('package_') || key === 'payout_day_of_month')
                        group = 'INVESTMENT';
                    if (key.startsWith('withdrawal_'))
                        group = 'WITHDRAWAL';
                    if (key.startsWith('remittance_') || key === 'show_remittance_spread_controls')
                        group = 'REMITTANCE';
                    if (key.startsWith('otc_'))
                        group = 'OTC';
                    if (key.startsWith('p2p_'))
                        group = 'P2P';
                    if (key === 'enable_virtual_cards' || key.startsWith('virtual_card_'))
                        group = 'CARDS';
                    if (key.startsWith('avr_'))
                        group = 'TOKEN';
                    await prisma_1.prisma.cmsSetting.upsert({
                        where: { key },
                        update: { value: String(value), group },
                        create: {
                            group,
                            key,
                            value: String(value),
                            description: `Configured via Admin Portal for ${key}`,
                        },
                    });
                    updatedKeys.push(key);
                    if (key === 'package_lock_in_months') {
                        await prisma_1.prisma.cmsSetting.upsert({
                            where: { key: 'package_min_lockin_months' },
                            update: { value: String(value), group: 'INVESTMENT' },
                            create: {
                                group: 'INVESTMENT',
                                key: 'package_min_lockin_months',
                                value: String(value),
                                description: 'Synced FD lock-in duration in months',
                            },
                        });
                    }
                    if (key === 'withdrawal_bank_wire_fee_percent') {
                        await prisma_1.prisma.cmsSetting.upsert({
                            where: { key: 'withdrawal_international_fee_percent' },
                            update: { value: String(value), group: 'WITHDRAWAL' },
                            create: {
                                group: 'WITHDRAWAL',
                                key: 'withdrawal_international_fee_percent',
                                value: String(value),
                                description: 'Synced international SWIFT wire fee',
                            },
                        });
                    }
                    else if (key === 'withdrawal_international_fee_percent') {
                        await prisma_1.prisma.cmsSetting.upsert({
                            where: { key: 'withdrawal_bank_wire_fee_percent' },
                            update: { value: String(value), group: 'WITHDRAWAL' },
                            create: {
                                group: 'WITHDRAWAL',
                                key: 'withdrawal_bank_wire_fee_percent',
                                value: String(value),
                                description: 'Synced bank wire fee',
                            },
                        });
                    }
                }
            }
            rate_service_1.rateService.invalidateOverridesCache();
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
     * Admin: Block, suspend, or reinstate a user specifically for P2P trading without freezing whole account
     */
    async updateUserP2PStatus(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { p2pBlocked, reason } = req.body || {};
            const blocked = Boolean(p2pBlocked);
            const cleanReason = reason ? String(reason).trim() : null;
            const user = await prisma_1.prisma.user.update({
                where: { id },
                data: {
                    p2pBlocked: blocked,
                    p2pBlockedReason: blocked ? cleanReason || 'Restricted by Compliance' : null,
                    p2pBlockedAt: blocked ? new Date() : null,
                },
            });
            if (blocked) {
                await prisma_1.prisma.p2POffer.updateMany({
                    where: { userId: id, status: client_1.P2POfferStatus.OPEN },
                    data: { status: client_1.P2POfferStatus.PAUSED },
                });
            }
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: blocked ? 'ADMIN_P2P_USER_BLOCKED' : 'ADMIN_P2P_USER_UNBLOCKED',
                    entity: 'User',
                    entityId: id,
                    details: `Admin ${blocked ? 'blocked' : 'unblocked'} P2P trading access for ${user.email}. Reason: ${cleanReason || 'N/A'}`,
                },
            });
            await (0, p2p_helpers_1.createP2PNotification)({
                userId: id,
                category: 'ACCOUNT',
                type: blocked ? 'P2P_ADMIN_BLOCKED' : 'P2P_ADMIN_UNBLOCKED',
                severity: blocked ? 'CRITICAL' : 'SUCCESS',
                title: blocked ? 'P2P Trading Access Restricted' : 'P2P Trading Access Restored',
                message: blocked
                    ? `Your P2P trading access was restricted by Compliance${cleanReason ? `: ${cleanReason}` : '.'}`
                    : 'Your P2P marketplace trading access has been restored by Compliance.',
            });
            res.json({
                success: true,
                message: `P2P trading ${blocked ? 'restricted' : 'restored'} for ${user.email}`,
                p2pBlocked: user.p2pBlocked,
                p2pBlockedReason: user.p2pBlockedReason,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Maintain & update a user's P2P/OTC Credibility Profile
     * (Credibility Level: Bronze/Silver/Gold/Titanium, custom completed orders, rating, tenure/member since, admin note)
     * All changes are audited in AdminAuditLog for transparency.
     */
    async updateUserCredibility(req, res, next) {
        try {
            await p2p_service_1.p2pService.ensureP2PReady();
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const adminEmail = req.user?.email ? String(req.user.email) : 'admin@avorabank.com';
            const id = String(req.params.id);
            const { credibilityLevel, customCompletedOrders, customRating, customMemberSince, credibilityNote, reason, } = req.body || {};
            const existingUser = await prisma_1.prisma.user.findUnique({
                where: { id },
            });
            if (!existingUser) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'TITANIUM'];
            let tierToSet = existingUser.credibilityLevel || 'BRONZE';
            if (credibilityLevel && typeof credibilityLevel === 'string') {
                const cleanTier = credibilityLevel.toUpperCase().trim();
                if (!validTiers.includes(cleanTier)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid credibility level. Must be one of: ${validTiers.join(', ')}`,
                    });
                }
                tierToSet = cleanTier;
            }
            let parsedRating = existingUser.customRating;
            if (customRating !== undefined) {
                if (customRating === null || customRating === '' || customRating === 'null') {
                    parsedRating = null;
                }
                else {
                    const rNum = parseFloat(String(customRating));
                    if (isNaN(rNum) || rNum < 1 || rNum > 5) {
                        return res.status(400).json({
                            success: false,
                            message: 'Rating must be between 1.00 and 5.00',
                        });
                    }
                    parsedRating = new decimal_js_1.default(rNum.toFixed(2));
                }
            }
            let parsedOrders = existingUser.customCompletedOrders;
            if (customCompletedOrders !== undefined) {
                if (customCompletedOrders === null || customCompletedOrders === '' || customCompletedOrders === 'null') {
                    parsedOrders = null;
                }
                else {
                    const oNum = parseInt(String(customCompletedOrders), 10);
                    if (isNaN(oNum) || oNum < 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'Completed orders must be a non-negative integer',
                        });
                    }
                    parsedOrders = oNum;
                }
            }
            let memberSinceStr = existingUser.customMemberSince;
            if (customMemberSince !== undefined) {
                memberSinceStr = customMemberSince && String(customMemberSince).trim()
                    ? String(customMemberSince).trim()
                    : null;
            }
            let noteStr = existingUser.credibilityNote;
            if (credibilityNote !== undefined) {
                noteStr = credibilityNote && String(credibilityNote).trim()
                    ? String(credibilityNote).trim()
                    : null;
            }
            const updatedUser = await prisma_1.prisma.user.update({
                where: { id },
                data: {
                    credibilityLevel: tierToSet,
                    customCompletedOrders: parsedOrders,
                    customRating: parsedRating,
                    customMemberSince: memberSinceStr,
                    credibilityNote: noteStr,
                    credibilityUpdatedAt: new Date(),
                    credibilityUpdatedBy: adminEmail,
                },
            });
            // If user operates an OTC desk, also sync desk rating and completed trades
            try {
                const desk = await prisma_1.prisma.otcDesk.findUnique({ where: { userId: id } });
                if (desk) {
                    await prisma_1.prisma.otcDesk.update({
                        where: { id: desk.id },
                        data: {
                            ...(parsedRating ? { rating: parsedRating } : {}),
                            ...(parsedOrders !== null ? { completedTrades: parsedOrders } : {}),
                        },
                    });
                }
            }
            catch { }
            // Mandatory Audit Log for Credibility Changes
            const auditDetails = {
                action: 'UPDATE_CREDIBILITY_PROFILE',
                targetUser: {
                    id: existingUser.id,
                    email: existingUser.email,
                    name: `${existingUser.firstName || ''} ${existingUser.lastName || ''}`.trim(),
                },
                previous: {
                    credibilityLevel: existingUser.credibilityLevel || 'BRONZE',
                    customCompletedOrders: existingUser.customCompletedOrders,
                    customRating: existingUser.customRating ? existingUser.customRating.toString() : null,
                    customMemberSince: existingUser.customMemberSince,
                    credibilityNote: existingUser.credibilityNote,
                },
                updated: {
                    credibilityLevel: tierToSet,
                    customCompletedOrders: parsedOrders,
                    customRating: parsedRating ? parsedRating.toString() : null,
                    customMemberSince: memberSinceStr,
                    credibilityNote: noteStr,
                },
                adminEmail,
                reason: reason ? String(reason).trim() : 'Compliance & Credibility Assessment Update',
                timestamp: new Date().toISOString(),
            };
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'ADMIN_CREDIBILITY_UPDATED',
                    entity: 'UserCredibility',
                    entityId: id,
                    details: JSON.stringify(auditDetails),
                    ipAddress: req.ip || null,
                },
            });
            // Notification to user
            await (0, p2p_helpers_1.createP2PNotification)({
                userId: id,
                category: 'ACCOUNT',
                type: 'P2P_CREDIBILITY_UPDATED',
                severity: 'SUCCESS',
                title: `Credibility Profile Updated: ${tierToSet} Tier`,
                message: `Your P2P & OTC Trust Profile has been upgraded/updated by Compliance to ${tierToSet} Level with verified marketplace reputation.`,
            });
            res.json({
                success: true,
                message: `Credibility profile updated for ${existingUser.email} (${tierToSet} tier).`,
                data: {
                    user: {
                        id: updatedUser.id,
                        email: updatedUser.email,
                        credibilityLevel: updatedUser.credibilityLevel,
                        customCompletedOrders: updatedUser.customCompletedOrders,
                        customRating: updatedUser.customRating ? updatedUser.customRating.toString() : null,
                        customMemberSince: updatedUser.customMemberSince,
                        credibilityNote: updatedUser.credibilityNote,
                        credibilityUpdatedAt: updatedUser.credibilityUpdatedAt,
                        credibilityUpdatedBy: updatedUser.credibilityUpdatedBy,
                    },
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Directly Assign or Activate P2P Merchant Desk by User Email
     */
    async assignP2PMerchant(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const result = await p2p_service_1.p2pService.adminAssignMerchant(adminUserId, req.body || {});
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Directly Assign or Activate OTC Desk by User Email
     */
    async assignOtcDesk(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const result = await otc_service_1.otcService.adminAssignDesk(adminUserId, req.body || {});
            res.json(result);
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
                    { recipientBankName: { contains: query } },
                    { recipientBicSwift: { contains: query } },
                    { transferReason: { contains: query } },
                    { destinationCountry: { contains: query } },
                ];
            }
            const [transfers, total] = await Promise.all([
                prisma_1.prisma.globalTransfer.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                kycStatus: true,
                                phone: true,
                                country: true,
                            },
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
            const updated = await gmt_service_1.globalMoneyTransferService.updateTransferStatusAdmin(id, status || existing.status, complianceNotes, { rejectionReason, adminUserId });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'REMITTANCE_TRANSFER_UPDATE',
                    entity: 'GlobalTransfer',
                    entityId: id,
                    details: `Updated transfer ${updated.transferCode} status to ${updated.status}. Compliance: ${complianceNotes || 'N/A'}`,
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
            await investments_service_1.investmentsService.ensureVentureSchema();
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { companyName, tagline, country = 'United States', countryCode = 'US', city = 'San Francisco', industry = 'Fintech', stage = 'SEED', instrument = 'SAFE', valuation, fundingTarget, verifiedFundsRaised = 0, investorCount = 0, minInvestment = 250, pitchOverview, startDate, deadline, lockInMonths = 12, maturityDate, expectedReturnPct = 0, performancePct = 0, termsAndNotes, dueDiligenceSummary, supportingDocuments, registrationDetails, officialLinks, contactInfo, riskFactors, problemSolution, businessModel, marketOpportunity, financialHighlights, logoUrl, coverImageUrl, pitchDeckUrl, providerName, providerInvestedAmount = 0, providerTransferredAt, providerExpectedReturnAmount = 0, providerExpectedReturnDate, providerNotes, } = req.body;
            if (!companyName || !tagline || !valuation || !fundingTarget || !pitchOverview) {
                return res.status(400).json({ success: false, message: 'Required fields: companyName, tagline, valuation, fundingTarget, pitchOverview' });
            }
            const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 6);
            const lockM = Math.max(0, Math.floor(Number(lockInMonths) || 12));
            const startDt = startDate ? new Date(startDate) : new Date();
            const matDt = maturityDate
                ? new Date(maturityDate)
                : lockM > 0
                    ? new Date(new Date(startDt).setMonth(startDt.getMonth() + lockM))
                    : null;
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
                    verifiedFundsRaised: new decimal_js_1.default((verifiedFundsRaised || 0).toString()),
                    investorCount: Math.max(0, Math.floor(Number(investorCount) || 0)),
                    minInvestment: new decimal_js_1.default(minInvestment.toString()),
                    pitchOverview,
                    startDate: startDt,
                    deadline: deadline ? new Date(deadline) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                    lockInMonths: lockM,
                    maturityDate: matDt,
                    expectedReturnPct: new decimal_js_1.default((expectedReturnPct || 0).toString()),
                    performancePct: new decimal_js_1.default((performancePct || 0).toString()),
                    termsAndNotes: termsAndNotes || null,
                    dueDiligenceSummary: dueDiligenceSummary || null,
                    registrationDetails: registrationDetails || null,
                    officialLinks: officialLinks
                        ? typeof officialLinks === 'string'
                            ? officialLinks
                            : JSON.stringify(officialLinks)
                        : null,
                    contactInfo: contactInfo
                        ? typeof contactInfo === 'string'
                            ? contactInfo
                            : JSON.stringify(contactInfo)
                        : null,
                    riskFactors: riskFactors || null,
                    problemSolution: problemSolution || null,
                    businessModel: businessModel || null,
                    marketOpportunity: marketOpportunity || null,
                    financialHighlights: financialHighlights
                        ? typeof financialHighlights === 'string'
                            ? financialHighlights
                            : JSON.stringify(financialHighlights)
                        : null,
                    supportingDocuments: supportingDocuments
                        ? typeof supportingDocuments === 'string'
                            ? supportingDocuments
                            : JSON.stringify(supportingDocuments)
                        : null,
                    logoUrl: logoUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
                    coverImageUrl: coverImageUrl || 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&auto=format&fit=crop&q=80',
                    pitchDeckUrl,
                    providerName: providerName || null,
                    providerInvestedAmount: new decimal_js_1.default((providerInvestedAmount || 0).toString()),
                    providerTransferredAt: providerTransferredAt ? new Date(providerTransferredAt) : null,
                    providerExpectedReturnAmount: new decimal_js_1.default((providerExpectedReturnAmount || 0).toString()),
                    providerExpectedReturnDate: providerExpectedReturnDate ? new Date(providerExpectedReturnDate) : null,
                    providerNotes: providerNotes || null,
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
            await investments_service_1.investmentsService.ensureVentureSchema();
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { companyName, status, valuation, fundingTarget, verifiedFundsRaised, minInvestment, investorCount, stage, instrument, country, countryCode, city, industry, dueDiligenceStatus, dueDiligenceSummary, pitchOverview, tagline, logoUrl, lockInMonths, maturityDate, startDate, deadline, expectedReturnPct, performancePct, termsAndNotes, supportingDocuments, registrationDetails, officialLinks, contactInfo, financialHighlights, riskFactors, problemSolution, businessModel, marketOpportunity, pitchDeckUrl, } = req.body;
            const updateData = {};
            if (companyName !== undefined && companyName !== '')
                updateData.companyName = String(companyName).trim();
            if (status)
                updateData.status = status;
            if (stage)
                updateData.stage = stage;
            if (instrument)
                updateData.instrument = instrument;
            if (country !== undefined)
                updateData.country = country;
            if (countryCode !== undefined)
                updateData.countryCode = countryCode;
            if (city !== undefined)
                updateData.city = city;
            if (industry !== undefined)
                updateData.industry = industry;
            if (valuation !== undefined && valuation !== '')
                updateData.valuation = new decimal_js_1.default(valuation.toString());
            if (fundingTarget !== undefined && fundingTarget !== '')
                updateData.fundingTarget = new decimal_js_1.default(fundingTarget.toString());
            if (verifiedFundsRaised !== undefined && verifiedFundsRaised !== '')
                updateData.verifiedFundsRaised = new decimal_js_1.default(verifiedFundsRaised.toString());
            if (minInvestment !== undefined && minInvestment !== '')
                updateData.minInvestment = new decimal_js_1.default(minInvestment.toString());
            if (investorCount !== undefined && investorCount !== '')
                updateData.investorCount = Math.max(0, Math.floor(Number(investorCount)));
            if (dueDiligenceStatus)
                updateData.dueDiligenceStatus = dueDiligenceStatus;
            if (dueDiligenceSummary !== undefined)
                updateData.dueDiligenceSummary = dueDiligenceSummary;
            if (pitchOverview !== undefined)
                updateData.pitchOverview = pitchOverview;
            if (tagline !== undefined)
                updateData.tagline = tagline;
            if (logoUrl !== undefined)
                updateData.logoUrl = logoUrl;
            if (lockInMonths !== undefined && lockInMonths !== '')
                updateData.lockInMonths = Math.max(0, Math.floor(Number(lockInMonths)));
            if (maturityDate !== undefined)
                updateData.maturityDate = maturityDate ? new Date(maturityDate) : null;
            if (startDate !== undefined)
                updateData.startDate = startDate ? new Date(startDate) : null;
            if (deadline !== undefined && deadline !== '')
                updateData.deadline = new Date(deadline);
            if (expectedReturnPct !== undefined && expectedReturnPct !== '')
                updateData.expectedReturnPct = new decimal_js_1.default(expectedReturnPct.toString());
            if (performancePct !== undefined && performancePct !== '')
                updateData.performancePct = new decimal_js_1.default(performancePct.toString());
            if (termsAndNotes !== undefined)
                updateData.termsAndNotes = termsAndNotes;
            if (registrationDetails !== undefined)
                updateData.registrationDetails = registrationDetails;
            if (riskFactors !== undefined)
                updateData.riskFactors = riskFactors;
            if (problemSolution !== undefined)
                updateData.problemSolution = problemSolution;
            if (businessModel !== undefined)
                updateData.businessModel = businessModel;
            if (marketOpportunity !== undefined)
                updateData.marketOpportunity = marketOpportunity;
            if (pitchDeckUrl !== undefined)
                updateData.pitchDeckUrl = pitchDeckUrl;
            if (officialLinks !== undefined) {
                updateData.officialLinks =
                    typeof officialLinks === 'string' ? officialLinks : JSON.stringify(officialLinks);
            }
            if (contactInfo !== undefined) {
                updateData.contactInfo =
                    typeof contactInfo === 'string' ? contactInfo : JSON.stringify(contactInfo);
            }
            if (financialHighlights !== undefined) {
                updateData.financialHighlights =
                    typeof financialHighlights === 'string' ? financialHighlights : JSON.stringify(financialHighlights);
            }
            if (supportingDocuments !== undefined) {
                updateData.supportingDocuments =
                    typeof supportingDocuments === 'string' ? supportingDocuments : JSON.stringify(supportingDocuments);
            }
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
     * Move startup campaign to Deleted List (soft-delete) or permanently delete if already in Deleted List / permanent=true
     */
    async deleteStartupListing(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const permanent = req.query.permanent === 'true';
            const existing = await prisma_1.prisma.startupListing.findUnique({
                where: { id },
                include: { investments: true },
            });
            if (!existing) {
                return res.status(404).json({ success: false, message: 'Startup listing not found' });
            }
            if (permanent) {
                const realCommitments = existing.investments.filter((c) => c.sourceType !== 'ADMIN_DISPLAY_MOCK');
                if (realCommitments.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Cannot permanently delete "${existing.companyName}" because it has ${realCommitments.length} real investor commitment(s) on the ledger. It remains safely archived in the Deleted List.`,
                    });
                }
                await prisma_1.prisma.$transaction([
                    prisma_1.prisma.investmentCommitment.deleteMany({ where: { listingId: id } }),
                    prisma_1.prisma.investmentWatchlist.deleteMany({ where: { listingId: id } }),
                    prisma_1.prisma.investmentInquiry.deleteMany({ where: { listingId: id } }),
                    prisma_1.prisma.startupListing.delete({ where: { id } }),
                ]);
                await prisma_1.prisma.adminAuditLog.create({
                    data: {
                        userId: adminUserId,
                        action: 'PERMANENT_DELETE_STARTUP_LISTING',
                        entity: 'StartupListing',
                        entityId: id,
                        details: `Permanently deleted startup portfolio ${existing.companyName} from Deleted List`,
                    },
                });
                return res.json({
                    success: true,
                    message: `Startup portfolio "${existing.companyName}" permanently deleted`,
                });
            }
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
                    details: `Moved startup portfolio ${listing.companyName} to Deleted List`,
                },
            });
            res.json({
                success: true,
                message: `Startup portfolio "${listing.companyName}" moved to the Deleted List`,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Restore a deleted / suspended startup campaign back to Active Portfolios (PUBLISHED)
     */
    async restoreStartupListing(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const listing = await prisma_1.prisma.startupListing.update({
                where: { id },
                data: { status: 'PUBLISHED' },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'RESTORE_STARTUP_LISTING',
                    entity: 'StartupListing',
                    entityId: id,
                    details: `Restored startup portfolio ${listing.companyName} from Deleted List to Active Portfolios`,
                },
            });
            res.json({
                success: true,
                message: `Startup portfolio "${listing.companyName}" restored to Active Portfolios`,
                data: listing,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Synchronize a startup listing's headline verifiedFundsRaised & investorCount from actual InvestmentCommitment rows
     */
    async syncStartupListingMetrics(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const listing = await prisma_1.prisma.startupListing.findUnique({
                where: { id },
                include: { investments: true },
            });
            if (!listing) {
                return res.status(404).json({ success: false, message: 'Startup listing not found' });
            }
            const realEligible = listing.investments.filter((c) => c.sourceType !== 'ADMIN_DISPLAY_MOCK');
            const totalNet = realEligible.reduce((sum, c) => sum.plus(new decimal_js_1.default(c.netInvestedAmount.toString())), new decimal_js_1.default(0));
            const distinctInvestors = new Set(realEligible.map((c) => c.investorUserId)).size;
            const updated = await prisma_1.prisma.startupListing.update({
                where: { id },
                data: {
                    verifiedFundsRaised: new decimal_js_1.default(totalNet.toFixed(2)),
                    investorCount: distinctInvestors,
                },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'SYNC_STARTUP_METRICS',
                    entity: 'StartupListing',
                    entityId: id,
                    details: `Synchronized ${listing.companyName} metrics to match real/verified commitments only (display/mock entries stripped): $${totalNet.toFixed(2)} USD across ${distinctInvestors} distinct investors (${realEligible.length} real commitments).`,
                },
            });
            res.json({
                success: true,
                message: `Synced ${listing.companyName} to verified ledger only: $${totalNet.toFixed(2)} USD raised from ${distinctInvestors} distinct investors (${realEligible.length} commitments).`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Record a verified investor commitment manually (with optional wallet debit or external/nominee settlement)
     */
    async createManualInvestmentCommitment(req, res, next) {
        try {
            await investments_service_1.investmentsService.ensureVentureSchema();
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { listingId, investorUserId, netAmount, sourceType: requestedSourceType, debitWallet = false, applyAllocationFee = true, addToCardDisplay = true, investmentDate, status = 'CLEARED_FUNDS', notes, } = req.body || {};
            const resolvedSourceType = requestedSourceType === 'ADMIN_DISPLAY_MOCK'
                ? 'ADMIN_DISPLAY_MOCK'
                : requestedSourceType === 'REAL_WALLET' || debitWallet === true
                    ? 'REAL_WALLET'
                    : 'ADMIN_EXTERNAL_VERIFIED';
            const effectiveDebitWallet = resolvedSourceType === 'REAL_WALLET';
            const effectiveApplyFee = resolvedSourceType === 'ADMIN_DISPLAY_MOCK' ? false : Boolean(applyAllocationFee);
            if (!listingId || !investorUserId) {
                return res.status(400).json({ success: false, message: 'Startup listing and investor user are required' });
            }
            const amtNum = parseFloat(String(netAmount || '0'));
            if (!Number.isFinite(amtNum) || amtNum <= 0) {
                return res.status(400).json({ success: false, message: 'Valid net invested amount (> 0) is required' });
            }
            const [investor, listing, feeCfg] = await Promise.all([
                prisma_1.prisma.user.findUnique({ where: { id: String(investorUserId) } }),
                prisma_1.prisma.startupListing.findUnique({ where: { id: String(listingId) } }),
                investments_service_1.investmentsService.getStartupFeeConfig(),
            ]);
            if (!investor) {
                return res.status(404).json({ success: false, message: 'Investor user not found' });
            }
            if (!listing) {
                return res.status(404).json({ success: false, message: 'Startup listing not found' });
            }
            const netDec = new decimal_js_1.default(amtNum.toFixed(2));
            const feePct = effectiveApplyFee ? new decimal_js_1.default(feeCfg.allocationFeePct) : new decimal_js_1.default(0);
            const feeDec = new decimal_js_1.default(netDec.times(feePct.div(100)).toFixed(2));
            const grossDec = netDec.plus(feeDec);
            const createdAtDate = investmentDate ? new Date(investmentDate) : new Date();
            if (isNaN(createdAtDate.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid investment date' });
            }
            const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
            const prefix = resolvedSourceType === 'ADMIN_DISPLAY_MOCK' ? 'MOCK' : 'INV';
            const investmentCode = `${prefix}-${Date.now().toString().slice(-6)}-${rand}`;
            const wallet = await ledger_service_1.ledgerService.ensureWallet(investor.id);
            const commitment = await prisma_1.prisma.$transaction(async (tx) => {
                if (effectiveDebitWallet) {
                    const usdRow = await ledger_service_1.ledgerService.lockWalletBalance(tx, wallet.id, 'USD');
                    const avail = new decimal_js_1.default(usdRow.availableBalance.toString());
                    if (avail.lessThan(grossDec)) {
                        throw new Error(`Investor ${investor.email} has insufficient USD available balance ($${avail.toFixed(2)}) for $${grossDec.toFixed(2)} gross commitment.`);
                    }
                    const balAfterNet = avail.minus(netDec);
                    const balAfterTotal = avail.minus(grossDec);
                    await tx.walletBalance.update({
                        where: { id: usdRow.id },
                        data: { availableBalance: balAfterTotal.toFixed(8) },
                    });
                    const entries = [
                        {
                            accountId: 'USER_AVAILABLE_USD',
                            userId: investor.id,
                            direction: 'DEBIT',
                            amount: grossDec.toFixed(8),
                            currency: 'USD',
                        },
                        {
                            accountId: 'USER_VENTURE_ESCROW_USD',
                            userId: investor.id,
                            direction: 'CREDIT',
                            amount: netDec.toFixed(8),
                            currency: 'USD',
                        },
                    ];
                    if (feeDec.greaterThan(0)) {
                        entries.push({
                            accountId: 'PLATFORM_FEE_REVENUE_USD',
                            direction: 'CREDIT',
                            amount: feeDec.toFixed(8),
                            currency: 'USD',
                        });
                    }
                    await ledger_service_1.ledgerService.recordJournal(tx, {
                        idempotencyKey: `INV-JRN-${investmentCode}`,
                        referenceType: client_1.JournalReferenceType.INVESTMENT_ALLOCATION,
                        referenceId: investmentCode,
                        notes: `Admin-recorded wallet venture allocation in ${listing.companyName}`,
                        createdBy: adminUserId,
                        entries,
                    });
                    await tx.transaction.create({
                        data: {
                            transactionCode: `TX-${investmentCode}`,
                            userId: investor.id,
                            type: client_1.TransactionType.INVESTMENT_ALLOCATION,
                            amount: netDec.toFixed(8),
                            currency: 'USD',
                            status: client_1.TransactionStatus.COMPLETED,
                            balanceBefore: avail.toFixed(8),
                            balanceAfter: balAfterNet.toFixed(8),
                            idempotencyKey: `INV-ALLOC-${investmentCode}`,
                            notes: notes || `Admin-recorded investment in ${listing.companyName} ($${netDec.toFixed(2)} net)`,
                            settlementReference: investmentCode,
                            createdBy: adminUserId,
                        },
                    });
                    if (feeDec.greaterThan(0)) {
                        await tx.transaction.create({
                            data: {
                                transactionCode: `TX-INVF-${investmentCode.replace(`${prefix}-`, '')}`,
                                userId: investor.id,
                                type: client_1.TransactionType.INVESTMENT_FEE,
                                amount: feeDec.toFixed(8),
                                currency: 'USD',
                                status: client_1.TransactionStatus.COMPLETED,
                                balanceBefore: balAfterNet.toFixed(8),
                                balanceAfter: balAfterTotal.toFixed(8),
                                idempotencyKey: `INV-FEE-${investmentCode}`,
                                notes: `${feePct.toFixed(1)}% Allocation Fee for ${listing.companyName} (${investmentCode})`,
                                settlementReference: investmentCode,
                                createdBy: adminUserId,
                            },
                        });
                    }
                }
                const shouldUpdateCard = resolvedSourceType !== 'ADMIN_DISPLAY_MOCK' || Boolean(addToCardDisplay);
                if (shouldUpdateCard) {
                    const priorCount = await tx.investmentCommitment.count({
                        where: { listingId: listing.id, investorUserId: investor.id },
                    });
                    await tx.startupListing.update({
                        where: { id: listing.id },
                        data: {
                            verifiedFundsRaised: { increment: Number(netDec.toFixed(2)) },
                            ...(priorCount === 0 ? { investorCount: { increment: 1 } } : {}),
                        },
                    });
                }
                const lockMonths = Math.max(0, Number(listing.lockInMonths ?? 12));
                const lockEnd = listing.maturityDate && new Date(listing.maturityDate) > createdAtDate
                    ? new Date(listing.maturityDate)
                    : lockMonths > 0
                        ? new Date(new Date(createdAtDate).setMonth(createdAtDate.getMonth() + lockMonths))
                        : null;
                const perfPct = Number(listing.performancePct || 0);
                const curVal = perfPct !== 0
                    ? new decimal_js_1.default(netDec.times(new decimal_js_1.default(1).plus(new decimal_js_1.default(perfPct).div(100))).toFixed(2))
                    : netDec;
                return tx.investmentCommitment.create({
                    data: {
                        investmentCode,
                        listingId: listing.id,
                        investorUserId: investor.id,
                        grossAmount: grossDec,
                        allocationFeePct: feePct,
                        allocationFeeAmount: feeDec,
                        netInvestedAmount: netDec,
                        instrument: listing.instrument,
                        sourceType: resolvedSourceType,
                        status: ['CLEARED_FUNDS', 'ACTIVE', 'DOCUMENT_SIGNED'].includes(String(status)) ? String(status) : 'CLEARED_FUNDS',
                        currentValuation: curVal,
                        unrealizedReturnPct: new decimal_js_1.default(perfPct.toFixed(2)),
                        lockInEnd: lockEnd,
                        realizedProceeds: new decimal_js_1.default('0.00'),
                        returnOfCapital: new decimal_js_1.default('0.00'),
                        eligibleNetProfit: new decimal_js_1.default('0.00'),
                        profitShareFeePct: resolvedSourceType === 'ADMIN_DISPLAY_MOCK' ? new decimal_js_1.default('0.00') : new decimal_js_1.default(feeCfg.profitSharePct),
                        profitShareFeeAmount: new decimal_js_1.default('0.00'),
                        netDistributedProfit: new decimal_js_1.default('0.00'),
                        settlementReference: investmentCode,
                        createdAt: createdAtDate,
                        notes: notes ||
                            (resolvedSourceType === 'REAL_WALLET'
                                ? `Recorded by Admin (Real Wallet Debited) for ${listing.companyName}`
                                : resolvedSourceType === 'ADMIN_DISPLAY_MOCK'
                                    ? `Admin Showcase / Demo Display Entry (Unbacked — Excluded from Real Ledger & Exits)`
                                    : `Recorded by Admin (External Wire / SPV Settled — No Platform Wallet Debit) for ${listing.companyName}`),
                    },
                });
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'CREATE_MANUAL_INVESTMENT_COMMITMENT',
                    entity: 'InvestmentCommitment',
                    entityId: commitment.id,
                    details: `Recorded commitment ${investmentCode} [${resolvedSourceType}] for ${investor.email} in ${listing.companyName}: $${netDec.toFixed(2)} net.`,
                },
            });
            res.status(201).json({
                success: true,
                message: `Recorded [${resolvedSourceType.replace(/_/g, ' ')}] ${investmentCode} for ${investor.email} ($${netDec.toFixed(2)} USD).`,
                data: commitment,
            });
        }
        catch (err) {
            if (err?.message?.includes('insufficient USD')) {
                return res.status(400).json({ success: false, message: err.message });
            }
            next(err);
        }
    }
    /**
     * Admin: Remove a Display/Mock commitment safely (strictly blocks deleting real ledger-verified commitments)
     */
    async deleteMockInvestmentCommitment(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const inv = await prisma_1.prisma.investmentCommitment.findUnique({
                where: { id },
            });
            if (!inv) {
                return res.status(404).json({ success: false, message: 'Commitment not found' });
            }
            const invListing = await prisma_1.prisma.startupListing
                .findUnique({
                where: { id: inv.listingId },
                select: { id: true, companyName: true },
            })
                .catch(() => null);
            const linkedTx = await prisma_1.prisma.transaction.findFirst({
                where: {
                    settlementReference: inv.investmentCode,
                    type: client_1.TransactionType.INVESTMENT_ALLOCATION,
                    status: client_1.TransactionStatus.COMPLETED,
                },
            });
            if (linkedTx || inv.sourceType === 'REAL_WALLET') {
                return res.status(400).json({
                    success: false,
                    message: 'Real wallet-debited commitments backed by immutable ledger transactions cannot be deleted. Only ADMIN_DISPLAY_MOCK entries can be removed.',
                });
            }
            if (inv.sourceType !== 'ADMIN_DISPLAY_MOCK') {
                return res.status(400).json({
                    success: false,
                    message: 'Only Display/Mock entries can be deleted via this action.',
                });
            }
            await prisma_1.prisma.investmentCommitment.delete({ where: { id } });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'DELETE_MOCK_INVESTMENT_COMMITMENT',
                    entity: 'InvestmentCommitment',
                    entityId: id,
                    details: `Removed display/mock commitment ${inv.investmentCode} ($${Number(inv.netInvestedAmount).toFixed(2)}) from ${invListing?.companyName || inv.listingId}.`,
                },
            });
            res.json({
                success: true,
                message: `Removed display/mock commitment ${inv.investmentCode}. Click Sync Card to Real Ledger if card headline totals still reflect display offsets.`,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Respond to a Startup Investor Inquiry
     */
    async replyStartupInquiry(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { response, status = 'ANSWERED' } = req.body || {};
            if (!response || !String(response).trim()) {
                return res.status(400).json({ success: false, message: 'Reply message is required' });
            }
            const updated = await prisma_1.prisma.investmentInquiry.update({
                where: { id },
                data: {
                    response: String(response).trim(),
                    status: status === 'CLOSED' ? 'CLOSED' : 'ANSWERED',
                },
                include: {
                    listing: { select: { companyName: true } },
                    investor: { select: { email: true } },
                },
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'REPLY_STARTUP_INQUIRY',
                    entity: 'InvestmentInquiry',
                    entityId: id,
                    details: `Replied to inquiry from ${updated.investor?.email || 'investor'} regarding ${updated.listing?.companyName || 'startup'}.`,
                },
            });
            res.json({
                success: true,
                message: 'Inquiry reply saved and delivered to investor account.',
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List P2P orders with full chat transcripts, timestamps, payment proof, and currency context
     */
    async getP2PApplications(req, res, next) {
        try {
            const status = typeof req.query.status === 'string' ? req.query.status : 'ALL';
            const search = typeof req.query.search === 'string' ? req.query.search : '';
            const apps = await p2p_service_1.p2pService.listOnboardingApplicationsForAdmin(status, search);
            res.json({ success: true, data: apps });
        }
        catch (err) {
            next(err);
        }
    }
    async reviewP2PApplication(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const adminEmail = req.user?.email ? String(req.user.email) : 'admin@avorabank.com';
            const id = String(req.params.id);
            const { decision, reviewNotes, approveKyc } = req.body || {};
            const result = await p2p_service_1.p2pService.reviewOnboardingApplication(id, adminUserId, adminEmail, {
                decision,
                reviewNotes,
                approveKyc,
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    async updateP2PApplicationDocuments(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { documentUrls, addUrl, removeUrl } = req.body || {};
            const result = await p2p_service_1.p2pService.updateApplicationDocuments(id, adminUserId, {
                documentUrls,
                addUrl,
                removeUrl,
            });
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    async requestP2PApplicationReupload(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const adminEmail = req.user?.email ? String(req.user.email) : 'admin@avorabank.com';
            const id = String(req.params.id);
            const { reason } = req.body || {};
            const result = await p2p_service_1.p2pService.requestApplicationReupload(id, adminUserId, adminEmail, reason);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    async getP2POrders(req, res, next) {
        try {
            await p2p_service_1.p2pService.ensureP2PReady();
            const { status, page, limit } = req.query;
            const pageNum = page ? parseInt(page, 10) : 1;
            const limitNum = limit ? parseInt(limit, 10) : 50;
            const skip = (pageNum - 1) * limitNum;
            const where = {};
            if (status && status !== 'ALL' && Object.values(client_1.P2POrderStatus).includes(status)) {
                where.status = status;
            }
            const [orders, total] = await Promise.all([
                prisma_1.prisma.p2POrder.findMany({
                    where,
                    include: {
                        buyer: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                displayName: true,
                                p2pBlocked: true,
                                credibilityLevel: true,
                                customCompletedOrders: true,
                                customRating: true,
                                customMemberSince: true,
                                credibilityNote: true,
                                createdAt: true,
                            },
                        },
                        seller: {
                            select: {
                                id: true,
                                email: true,
                                firstName: true,
                                lastName: true,
                                displayName: true,
                                p2pBlocked: true,
                                credibilityLevel: true,
                                customCompletedOrders: true,
                                customRating: true,
                                customMemberSince: true,
                                credibilityNote: true,
                                createdAt: true,
                            },
                        },
                        offer: true,
                        messages: { orderBy: { createdAt: 'asc' } },
                        reviews: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limitNum,
                }),
                prisma_1.prisma.p2POrder.count({ where }),
            ]);
            const enriched = orders.map((o) => ({
                ...o,
                cryptoCurrency: (o.cryptoCurrency || o.offer?.cryptoCurrency || 'USDT').toUpperCase(),
                fiatCurrency: (o.fiatCurrency || o.offer?.fiatCurrency || 'USD').toUpperCase(),
            }));
            res.json({
                success: true,
                data: enriched,
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
     * Admin: Freeze or Unfreeze a suspicious P2P Escrow Order
     */
    async freezeP2POrder(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { freeze, reason } = req.body || {};
            const shouldFreeze = Boolean(freeze);
            const cleanReason = reason ? String(reason).trim() : null;
            const order = await prisma_1.prisma.p2POrder.findUnique({ where: { id } });
            if (!order) {
                return res.status(404).json({ success: false, message: 'P2P Order not found' });
            }
            if ([client_1.P2POrderStatus.COMPLETED, client_1.P2POrderStatus.CANCELLED, client_1.P2POrderStatus.DECLINED, client_1.P2POrderStatus.EXPIRED].includes(order.status)) {
                return res.status(400).json({ success: false, message: `Cannot freeze a finalized order (${order.status})` });
            }
            const nextStatus = shouldFreeze
                ? client_1.P2POrderStatus.FROZEN
                : order.disputedAt
                    ? client_1.P2POrderStatus.DISPUTED
                    : order.paidAt
                        ? client_1.P2POrderStatus.PAYMENT_SENT
                        : client_1.P2POrderStatus.PENDING_PAYMENT;
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.p2POrder.update({
                    where: { id },
                    data: {
                        isFrozen: shouldFreeze,
                        frozenReason: shouldFreeze ? cleanReason || 'Frozen by Compliance review' : null,
                        status: nextStatus,
                    },
                });
                await tx.p2PMessage.create({
                    data: {
                        orderId: id,
                        senderId: 'SYSTEM',
                        message: shouldFreeze
                            ? `[System] Order #${order.orderCode} FROZEN by Compliance (${cleanReason || 'Security inspection'}). Funds remain locked until admin releases or refunds.`
                            : `[System] Compliance freeze lifted on Order #${order.orderCode}. Status resumed to ${nextStatus}.`,
                    },
                });
            });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: shouldFreeze ? 'ADMIN_FREEZE_P2P_ORDER' : 'ADMIN_UNFREEZE_P2P_ORDER',
                    entity: 'P2POrder',
                    entityId: id,
                    details: `Admin ${shouldFreeze ? 'froze' : 'unfroze'} P2P order ${order.orderCode}. Reason: ${cleanReason || 'N/A'}`,
                },
            });
            await Promise.all([
                (0, p2p_helpers_1.createP2PNotification)({
                    userId: order.buyerId,
                    type: shouldFreeze ? 'P2P_ADMIN_FROZEN' : 'P2P_ADMIN_UNFROZEN',
                    severity: shouldFreeze ? 'CRITICAL' : 'INFO',
                    title: `Order #${order.orderCode} ${shouldFreeze ? 'Frozen by Admin' : 'Unfrozen'}`,
                    message: shouldFreeze
                        ? `Trade held for compliance review: ${cleanReason || 'Security verification required.'}`
                        : 'Compliance hold lifted. Trade resumed.',
                    referenceCode: order.orderCode,
                    status: nextStatus,
                }),
                (0, p2p_helpers_1.createP2PNotification)({
                    userId: order.sellerId,
                    type: shouldFreeze ? 'P2P_ADMIN_FROZEN' : 'P2P_ADMIN_UNFROZEN',
                    severity: shouldFreeze ? 'CRITICAL' : 'INFO',
                    title: `Order #${order.orderCode} ${shouldFreeze ? 'Frozen by Admin' : 'Unfrozen'}`,
                    message: shouldFreeze
                        ? `Escrow held for compliance review: ${cleanReason || 'Security verification required.'}`
                        : 'Compliance hold lifted. Trade resumed.',
                    referenceCode: order.orderCode,
                    status: nextStatus,
                }),
            ]);
            res.json({
                success: true,
                message: `Order ${order.orderCode} ${shouldFreeze ? 'frozen' : 'unfrozen'} successfully.`,
                isFrozen: shouldFreeze,
                status: nextStatus,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Resolve P2P Escrow Dispute (or manually cancel/settle active/frozen trade)
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
            const finalizedStatuses = [
                client_1.P2POrderStatus.COMPLETED,
                client_1.P2POrderStatus.CANCELLED,
                client_1.P2POrderStatus.DECLINED,
                client_1.P2POrderStatus.EXPIRED,
            ];
            if (finalizedStatuses.includes(order.status)) {
                throw new Error(`Order ${order.orderCode} is already ${order.status} and cannot be resolved again.`);
            }
            const nextStatus = resolution === 'RELEASE_TO_BUYER' ? client_1.P2POrderStatus.COMPLETED : client_1.P2POrderStatus.CANCELLED;
            const cryptoAmountDec = new decimal_js_1.default(order.cryptoAmount.toString());
            const cryptoCur = (order.cryptoCurrency || order.offer?.cryptoCurrency || 'USDT').toUpperCase();
            const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(order.sellerId);
            const buyerWallet = await ledger_service_1.ledgerService.ensureWallet(order.buyerId);
            const now = new Date();
            let releasedSummary = null;
            await prisma_1.prisma.$transaction(async (tx) => {
                const freshOrder = await tx.p2POrder.findUnique({ where: { id } });
                if (!freshOrder || finalizedStatuses.includes(freshOrder.status)) {
                    throw new Error(`Order ${order.orderCode} has already been finalized (${freshOrder?.status || 'NOT_FOUND'}).`);
                }
                if (resolution === 'RELEASE_TO_BUYER') {
                    releasedSummary = await (0, p2p_helpers_1.releaseEscrowToBuyerTx)(tx, {
                        order: { ...freshOrder, cryptoCurrency: cryptoCur },
                        sellerWalletId: sellerWallet.id,
                        buyerWalletId: buyerWallet.id,
                        actorUserId: adminUserId,
                        txCodePrefix: 'D',
                        idempotencyPrefix: 'P2P-DISP-REL',
                        notesPrefix: `P2P dispute resolved (${resolution})`,
                    });
                }
                else {
                    await (0, p2p_helpers_1.unlockEscrowToSellerTx)(tx, {
                        sellerWalletId: sellerWallet.id,
                        sellerId: order.sellerId,
                        cryptoCurrency: cryptoCur,
                        cryptoAmountDec,
                        offerId: order.offerId,
                        orderCode: order.orderCode,
                        journalIdempotencyKey: `P2P-DISP-UNLOCK-${order.orderCode}`,
                        actorUserId: adminUserId,
                    });
                }
                await tx.p2POrder.update({
                    where: { id },
                    data: {
                        status: nextStatus,
                        isFrozen: false,
                        frozenReason: null,
                        disputeResolvedBy: adminUserId,
                        cancelledBy: resolution === 'REFUND_TO_SELLER' ? adminUserId : undefined,
                        cancelReason: resolution === 'REFUND_TO_SELLER' ? reason || 'Admin dispute refund' : undefined,
                        completedAt: resolution === 'RELEASE_TO_BUYER' ? now : undefined,
                        disputeReason: `[Admin ${resolution}]: ${reason ? String(reason).trim() : 'Manual compliance adjudication'}`,
                    },
                });
                const feeSuffix = releasedSummary && releasedSummary.platformFee.greaterThan(0)
                    ? ` (${releasedSummary.feePctStr}% platform fee: ${releasedSummary.platformFee.toFixed(4)} ${cryptoCur})`
                    : '';
                const netReleasedStr = releasedSummary
                    ? releasedSummary.buyerNetCrypto.toFixed(2)
                    : cryptoAmountDec.toFixed(2);
                await tx.p2PMessage.create({
                    data: {
                        orderId: id,
                        senderId: 'SYSTEM',
                        message: resolution === 'RELEASE_TO_BUYER'
                            ? `[System] Dispute resolved by Avora Compliance (${resolution}). ${netReleasedStr} ${cryptoCur} released from escrow to the buyer's wallet${feeSuffix}. Note: ${reason || 'N/A'}`
                            : `[System] Dispute resolved by Avora Compliance (${resolution}). ${cryptoAmountDec.toFixed(2)} ${cryptoCur} unlocked back to the seller's available balance. Note: ${reason || 'N/A'}`,
                    },
                });
            }, { timeout: 45000, maxWait: 15000 });
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'RESOLVE_P2P_DISPUTE',
                    entity: 'P2POrder',
                    entityId: id,
                    details: `Admin resolved P2P dispute on order ${order.orderCode} via ${resolution}. Reason: ${reason || 'N/A'}`,
                },
            });
            const netReleasedStr = releasedSummary
                ? releasedSummary.buyerNetCrypto.toFixed(2)
                : cryptoAmountDec.toFixed(2);
            await Promise.all([
                (0, p2p_helpers_1.createP2PNotification)({
                    userId: order.buyerId,
                    type: 'P2P_DISPUTE_RESOLVED',
                    severity: resolution === 'RELEASE_TO_BUYER' ? 'SUCCESS' : 'CRITICAL',
                    title: `Dispute Ruling on #${order.orderCode}: ${resolution === 'RELEASE_TO_BUYER' ? 'Released to Your Wallet' : 'Refunded to Seller'}`,
                    message: resolution === 'RELEASE_TO_BUYER'
                        ? `Dispute ruled in your favor (${resolution}). ${netReleasedStr} ${cryptoCur} has been released from escrow and credited to your available wallet balance.${reason ? ` Note: ${reason}` : ''}`
                        : `Dispute ruled in favor of the seller (${resolution}). Escrow was unlocked back to the seller's balance.${reason ? ` Note: ${reason}` : ''}`,
                    referenceCode: order.orderCode,
                    amount: cryptoAmountDec.toFixed(2),
                    currency: cryptoCur,
                    status: nextStatus,
                }),
                (0, p2p_helpers_1.createP2PNotification)({
                    userId: order.sellerId,
                    type: 'P2P_DISPUTE_RESOLVED',
                    severity: resolution === 'REFUND_TO_SELLER' ? 'SUCCESS' : 'WARNING',
                    title: `Dispute Ruling on #${order.orderCode}: ${resolution === 'REFUND_TO_SELLER' ? 'Escrow Refunded to Your Wallet' : 'Released to Buyer'}`,
                    message: resolution === 'REFUND_TO_SELLER'
                        ? `Dispute ruled in your favor (${resolution}). +${cryptoAmountDec.toFixed(2)} ${cryptoCur} has been unlocked and credited back to your available balance.${reason ? ` Note: ${reason}` : ''}`
                        : `Dispute ruled in favor of the buyer (${resolution}). Escrow was released to the buyer.${reason ? ` Note: ${reason}` : ''}`,
                    referenceCode: order.orderCode,
                    amount: cryptoAmountDec.toFixed(2),
                    currency: cryptoCur,
                    status: nextStatus,
                }),
            ]);
            res.json({
                success: true,
                message: `Order ${order.orderCode} resolved with status ${nextStatus}`,
                resolution,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Fulfill an AVORA Priority P2P Order (Specifically and only for INR transactions)
     */
    async fulfillP2POrder(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { releaseNote } = req.body || {};
            const order = await p2p_service_1.p2pService.fulfillPriorityOrder(id, adminUserId, releaseNote);
            res.json({
                success: true,
                message: 'AVORA Priority P2P Order fulfilled! Escrowed crypto credited to buyer.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Cancel a P2P Order and automatically refund escrow to user
     */
    async cancelP2POrder(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const id = String(req.params.id);
            const { reason } = req.body || {};
            const order = await p2p_service_1.p2pService.adminCancelOrder(id, adminUserId, reason);
            res.json({
                success: true,
                message: `P2P Order ${order.orderCode} cancelled. Escrow of ${order.cryptoAmount} ${order.cryptoCurrency} has been refunded to the seller.`,
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/admin/p2p/corridors
     * Retrieve active Country -> Currency -> Payment Rails corridors for Admin configuration
     */
    async getP2PCorridors(req, res, next) {
        try {
            const corridors = await p2p_service_1.p2pService.getCorridorConfigs();
            res.json({ success: true, data: corridors });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/p2p/corridors
     * Save and update Country -> Supported Currencies -> Allowed Payment Rails corridors
     */
    async updateP2PCorridors(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { corridors } = req.body;
            if (!Array.isArray(corridors)) {
                return res.status(400).json({ success: false, message: 'Invalid corridors payload: expected an array.' });
            }
            const updated = await p2p_service_1.p2pService.saveCorridorConfigs(adminUserId, corridors);
            res.json({
                success: true,
                message: `Successfully updated ${updated.length} P2P Country, Currency, and Payment Rail Corridors.`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/admin/otc/corridors
     * Retrieve active OTC Country -> Currency -> Settlement Rails corridors for Admin configuration
     */
    async getOtcCorridors(req, res, next) {
        try {
            const corridors = await otc_service_1.otcService.getCorridorConfigs();
            res.json({ success: true, data: corridors });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/otc/corridors
     * Save and update OTC Country -> Supported Currencies -> Allowed Settlement Rails corridors
     */
    async updateOtcCorridors(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { corridors } = req.body;
            if (!Array.isArray(corridors)) {
                return res.status(400).json({ success: false, message: 'Invalid corridors payload: expected an array.' });
            }
            const updated = await otc_service_1.otcService.saveCorridorConfigs(adminUserId, corridors);
            res.json({
                success: true,
                message: `Successfully updated ${updated.length} OTC Country, Currency, and Settlement Rail Corridors.`,
                data: updated,
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
     * Get platform system status, enabled languages & broadcast announcement
     */
    async getSystemStatus(req, res, next) {
        try {
            const settings = await prisma_1.prisma.cmsSetting.findMany({
                where: { group: 'SYSTEM' },
            });
            const map = {};
            settings.forEach((s) => (map[s.key] = s.value));
            const rawLangs = map['system_enabled_languages'] || 'en,ka';
            const parsedLangs = rawLangs
                .split(',')
                .map((s) => s.trim().toLowerCase())
                .filter((s) => ['en', 'ka', 'hi'].includes(s));
            if (!parsedLangs.includes('en'))
                parsedLangs.unshift('en');
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
                    enabledLanguages: Array.from(new Set(parsedLangs)),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update platform system status, enabled languages & broadcast announcement
     */
    async updateSystemStatus(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const { maintenanceMode, maintenanceMessage, announcementEnabled, announcementTitle, announcementMessage, announcementType, registrationsEnabled, enabledLanguages, } = req.body;
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
            if (enabledLanguages !== undefined) {
                const list = (Array.isArray(enabledLanguages)
                    ? enabledLanguages
                    : String(enabledLanguages).split(','))
                    .map((s) => String(s).trim().toLowerCase())
                    .filter((s) => ['en', 'ka', 'hi'].includes(s));
                if (!list.includes('en'))
                    list.unshift('en');
                pairs['system_enabled_languages'] = Array.from(new Set(list)).join(',');
            }
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
     * Formats elapsed age & SLA breach status relative to `now`.
     */
    computeAgeInfo(dateInput, now, overdueThresholdHours) {
        const dt = new Date(dateInput);
        const ageMs = isNaN(dt.getTime()) ? 0 : Math.max(0, now.getTime() - dt.getTime());
        const ageMins = Math.floor(ageMs / (1000 * 60));
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
        let ageLabel = `${ageMins}m`;
        if (ageHours >= 24) {
            ageLabel = `${ageDays}d ${ageHours % 24}h`;
        }
        else if (ageMins >= 60) {
            ageLabel = `${ageHours}h ${ageMins % 60}m`;
        }
        return {
            ageMs,
            ageHours,
            ageDays,
            ageLabel,
            isOverdue: ageHours >= overdueThresholdHours,
        };
    }
    /**
     * Builds unified date-based alerts & actionable pending requests across all operational queues.
     */
    async buildAdminCommandCenterData() {
        const now = new Date();
        await p2p_service_1.p2pService.ensureP2PReady().catch(() => { });
        const [activeAndPendingPackages, pendingDepositsList, pendingWithdrawalsList, pendingKycList] = await Promise.all([
            prisma_1.prisma.investmentPackage.findMany({
                where: { status: { in: ['ACTIVE', 'PENDING_PAYMENT', 'WITHDRAWAL_REQUESTED'] } },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    returns: true,
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.depositRequest.findMany({
                where: { status: client_1.DepositStatus.PENDING },
                include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.withdrawalRequest.findMany({
                where: {
                    status: {
                        in: [client_1.WithdrawalStatus.REQUESTED, client_1.WithdrawalStatus.UNDER_REVIEW, client_1.WithdrawalStatus.APPROVED],
                    },
                },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    package: { select: { packageCode: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.kycDocument.findMany({
                where: { status: client_1.KycStatus.PENDING },
                include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        const [pendingTransfersList, openTicketsList, disputedP2PList, pendingInquiriesList] = await Promise.all([
            prisma_1.prisma.globalTransfer.findMany({
                where: { status: { in: ['SUBMITTED', 'COMPLIANCE_SCREENED', 'PROCESSING'] } },
                include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.supportTicket.findMany({
                where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.p2POrder.findMany({
                where: { status: { in: [client_1.P2POrderStatus.DISPUTED, client_1.P2POrderStatus.FROZEN] } },
                include: {
                    buyer: { select: { id: true, email: true, firstName: true, lastName: true } },
                    seller: { select: { id: true, email: true, firstName: true, lastName: true } },
                    offer: { select: { fiatCurrency: true, cryptoCurrency: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.inquiry.findMany({
                where: { status: 'NEW' },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        const last72Hours = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        await otc_service_1.otcService.ensureOtcSchema();
        await liquidityRisk_service_1.liquidityRiskService.ensureSchema().catch(() => { });
        const [activeAndDisputedOtcTradesList, underReviewOtcDesksList, pendingP2PAppsList, openOtcInquiriesList, activeP2POrdersList, recentSwapsList, recentP2PTransfersList, recentP2POffersList, pendingVentureInquiriesList, pendingSwapRequestsList,] = await Promise.all([
            prisma_1.prisma.otcTrade.findMany({
                where: {
                    OR: [
                        { status: { in: ['DISPUTED', 'IN_PROGRESS'] } },
                        { createdAt: { gte: last72Hours } },
                    ],
                },
                include: {
                    desk: { select: { deskName: true, city: true, country: true } },
                    customer: { select: { id: true, email: true, firstName: true, lastName: true } },
                    operator: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
            prisma_1.prisma.otcDesk.findMany({
                where: { status: 'UNDER_REVIEW' },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.p2POnboardingApplication.findMany({
                where: { status: 'PENDING' },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'asc' },
            }),
            prisma_1.prisma.otcInquiry
                .findMany({
                where: { status: 'OPEN' },
                include: {
                    desk: { select: { deskName: true, city: true, country: true } },
                    customer: { select: { id: true, email: true, firstName: true, lastName: true } },
                    messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                },
                orderBy: { updatedAt: 'desc' },
            })
                .catch(() => []),
            prisma_1.prisma.p2POrder
                .findMany({
                where: {
                    status: {
                        in: [
                            client_1.P2POrderStatus.PENDING,
                            client_1.P2POrderStatus.ACCEPTED,
                            client_1.P2POrderStatus.PENDING_PAYMENT,
                            client_1.P2POrderStatus.PAYMENT_SENT,
                            client_1.P2POrderStatus.SELLER_CONFIRMING,
                        ],
                    },
                },
                include: {
                    buyer: { select: { id: true, email: true, firstName: true, lastName: true } },
                    seller: { select: { id: true, email: true, firstName: true, lastName: true } },
                    offer: { select: { fiatCurrency: true, cryptoCurrency: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            })
                .catch(() => []),
            prisma_1.prisma.transaction
                .findMany({
                where: {
                    type: client_1.TransactionType.EXCHANGE_BUY,
                    transactionCode: { startsWith: 'TX-SWAP-' },
                    createdAt: { gte: last72Hours },
                },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
            })
                .catch(() => []),
            prisma_1.prisma.transaction
                .findMany({
                where: {
                    type: client_1.TransactionType.P2P_TRANSFER_OUT,
                    createdAt: { gte: last72Hours },
                },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
            })
                .catch(() => []),
            prisma_1.prisma.p2POffer
                .findMany({
                where: {
                    status: client_1.P2POfferStatus.OPEN,
                    createdAt: { gte: last72Hours },
                },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
            })
                .catch(() => []),
            prisma_1.prisma.investmentInquiry
                .findMany({
                where: { status: 'PENDING' },
                include: {
                    investor: { select: { id: true, email: true, firstName: true, lastName: true } },
                    listing: { select: { companyName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 25,
            })
                .catch(() => []),
            prisma_1.prisma.swapRequest
                .findMany({
                where: { status: 'PENDING_APPROVAL' },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 50,
            })
                .catch(() => []),
        ]);
        const pendingRequests = [];
        const alerts = [];
        let yieldDueCount = 0;
        let yieldDueTotalDec = new decimal_js_1.default(0);
        let yieldDueSoonCount = 0;
        let yieldDueSoonTotalDec = new decimal_js_1.default(0);
        let maturedUnsettledCount = 0;
        let approachingMaturityCount = 0;
        let pendingPackagesCount = 0;
        let nextUpcomingYieldDate = null;
        for (const pkg of activeAndPendingPackages) {
            const fullName = `${pkg.user?.firstName || ''} ${pkg.user?.lastName || ''}`.trim() ||
                pkg.user?.email ||
                'Investor';
            const amountFixed = new decimal_js_1.default(pkg.amount.toString()).toFixed(2);
            if (pkg.status === 'PENDING_PAYMENT') {
                pendingPackagesCount++;
                const age = this.computeAgeInfo(pkg.createdAt, now, 48);
                const item = {
                    id: `PKG_ACT-${pkg.id}`,
                    entityId: pkg.id,
                    code: pkg.packageCode,
                    category: 'FD_ACTIVATION',
                    typeLabel: 'FD Package Activation',
                    title: `Pending FD Activation: ${pkg.packageCode}`,
                    description: `$${amountFixed} ${pkg.currency} (${pkg.lockInMonths}m FD via ${pkg.depositMethod || 'BANK_WIRE'}) awaiting payment verification`,
                    customerId: pkg.userId,
                    customerName: fullName,
                    customerEmail: pkg.user?.email || '',
                    amount: amountFixed,
                    currency: pkg.currency,
                    status: pkg.status,
                    targetTab: 'packages',
                    requestDate: pkg.createdAt.toISOString(),
                    createdDate: pkg.createdAt.toISOString(),
                    ageMs: age.ageMs,
                    ageHours: age.ageHours,
                    ageDays: age.ageDays,
                    ageLabel: age.ageLabel,
                    isOverdue: age.isOverdue,
                    urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
                    priorityRank: age.isOverdue ? 1 : 3,
                    meta: {
                        lockInMonths: pkg.lockInMonths,
                        depositMethod: pkg.depositMethod,
                    },
                };
                pendingRequests.push(item);
                alerts.push(item);
                continue;
            }
            // Active FD Yield Schedule evaluation
            const schedule = (0, package_service_1.computePackageYieldSchedule)(pkg, now);
            if (schedule.isYieldDue && schedule.duePeriodsCount > 0) {
                yieldDueCount++;
                const dueAmtDec = new decimal_js_1.default(schedule.dueYieldAmount);
                yieldDueTotalDec = yieldDueTotalDec.plus(dueAmtDec);
                const dueDate = schedule.nextYieldDueDate || now;
                const age = this.computeAgeInfo(dueDate, now, 24);
                const overdueFlag = age.isOverdue || (schedule.daysUntilNextYield ?? 0) < 0;
                const periodSummary = schedule.duePeriodIndices.map((p) => `Month ${p}`).join(', ');
                const yieldItem = {
                    id: `YIELD_DUE-${pkg.id}`,
                    entityId: pkg.id,
                    code: pkg.packageCode,
                    category: 'FD_YIELD_DUE',
                    typeLabel: 'FD Monthly Yield Due',
                    title: `Yield Due: ${pkg.packageCode} (${periodSummary})`,
                    description: `+$${schedule.dueYieldAmount} ${pkg.currency} ready to credit (${schedule.duePeriodsCount} completed monthly cycle${schedule.duePeriodsCount > 1 ? 's' : ''} out of ${schedule.lockMonths}m)`,
                    customerId: pkg.userId,
                    customerName: fullName,
                    customerEmail: pkg.user?.email || '',
                    amount: schedule.dueYieldAmount,
                    currency: pkg.currency,
                    status: 'YIELD_DUE',
                    targetTab: 'packages',
                    requestDate: dueDate.toISOString(),
                    createdDate: dueDate.toISOString(),
                    ageMs: age.ageMs,
                    ageHours: age.ageHours,
                    ageDays: age.ageDays,
                    ageLabel: age.ageHours < 1 ? 'Due today' : `${age.ageLabel} past cycle`,
                    isOverdue: overdueFlag,
                    urgency: overdueFlag ? 'OVERDUE' : 'DUE_TODAY',
                    priorityRank: overdueFlag ? 0 : 1,
                    meta: {
                        packageCode: pkg.packageCode,
                        principalAmount: amountFixed,
                        duePeriodsCount: schedule.duePeriodsCount,
                        duePeriodIndices: schedule.duePeriodIndices,
                        nextPeriodIndex: schedule.nextPeriodIndex,
                        lockInMonths: schedule.lockMonths,
                    },
                };
                pendingRequests.push(yieldItem);
                alerts.push(yieldItem);
            }
            else if (pkg.status === 'ACTIVE' && schedule.nextYieldDueDate) {
                if (!nextUpcomingYieldDate || schedule.nextYieldDueDate < nextUpcomingYieldDate) {
                    nextUpcomingYieldDate = schedule.nextYieldDueDate;
                }
                if (schedule.isYieldDueSoon) {
                    yieldDueSoonCount++;
                    yieldDueSoonTotalDec = yieldDueSoonTotalDec.plus(new decimal_js_1.default(schedule.monthlyYield));
                    alerts.push({
                        id: `YIELD_SOON-${pkg.id}`,
                        entityId: pkg.id,
                        code: pkg.packageCode,
                        category: 'FD_YIELD_SOON',
                        typeLabel: 'Upcoming FD Yield Cycle',
                        title: `Yield Due in ${schedule.daysUntilNextYield}d: ${pkg.packageCode}`,
                        description: `Month ${schedule.nextPeriodIndex}/${schedule.lockMonths} (+$${schedule.monthlyYield} ${pkg.currency}) completes on ${schedule.nextYieldDueDate.toISOString().split('T')[0]}`,
                        customerId: pkg.userId,
                        customerName: fullName,
                        customerEmail: pkg.user?.email || '',
                        amount: schedule.monthlyYield,
                        currency: pkg.currency,
                        status: 'UPCOMING_CYCLE',
                        targetTab: 'packages',
                        requestDate: schedule.nextYieldDueDate.toISOString(),
                        createdDate: schedule.nextYieldDueDate.toISOString(),
                        ageMs: 0,
                        ageHours: 0,
                        ageDays: 0,
                        ageLabel: `In ${schedule.daysUntilNextYield}d`,
                        isOverdue: false,
                        urgency: 'UPCOMING',
                        priorityRank: 4,
                        meta: {
                            packageCode: pkg.packageCode,
                            nextPeriodIndex: schedule.nextPeriodIndex,
                            daysUntilNextYield: schedule.daysUntilNextYield,
                        },
                    });
                }
            }
            // Check FD Maturity / Approaching Maturity
            if (pkg.lockInEnd) {
                const endDt = new Date(pkg.lockInEnd);
                const msRemaining = endDt.getTime() - now.getTime();
                const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
                if (daysRemaining <= 0) {
                    maturedUnsettledCount++;
                    const age = this.computeAgeInfo(endDt, now, 24);
                    const maturedItem = {
                        id: `FD_MATURED-${pkg.id}`,
                        entityId: pkg.id,
                        code: pkg.packageCode,
                        category: 'FD_MATURED',
                        typeLabel: 'FD Maturity Settlement',
                        title: `FD Matured: ${pkg.packageCode} Ready for Settlement`,
                        description: `$${amountFixed} ${pkg.currency} principal lock ended ${endDt.toISOString().split('T')[0]}. Process full settlement (returns + principal).`,
                        customerId: pkg.userId,
                        customerName: fullName,
                        customerEmail: pkg.user?.email || '',
                        amount: amountFixed,
                        currency: pkg.currency,
                        status: 'MATURED_DUE',
                        targetTab: 'packages',
                        requestDate: endDt.toISOString(),
                        createdDate: endDt.toISOString(),
                        ageMs: age.ageMs,
                        ageHours: age.ageHours,
                        ageDays: age.ageDays,
                        ageLabel: age.ageHours < 1 ? 'Matured today' : `${age.ageLabel} past end`,
                        isOverdue: age.isOverdue,
                        urgency: age.isOverdue ? 'OVERDUE' : 'DUE_TODAY',
                        priorityRank: age.isOverdue ? 0 : 1,
                        meta: {
                            packageCode: pkg.packageCode,
                            lockInMonths: pkg.lockInMonths,
                        },
                    };
                    pendingRequests.push(maturedItem);
                    alerts.push(maturedItem);
                }
                else if (daysRemaining <= 15) {
                    approachingMaturityCount++;
                    alerts.push({
                        id: `FD_SOON-${pkg.id}`,
                        entityId: pkg.id,
                        code: pkg.packageCode,
                        category: 'FD_APPROACHING_MATURITY',
                        typeLabel: 'FD Approaching Maturity',
                        title: `FD Maturing in ${daysRemaining}d: ${pkg.packageCode}`,
                        description: `$${amountFixed} ${pkg.currency} principal matures on ${endDt.toISOString().split('T')[0]}`,
                        customerId: pkg.userId,
                        customerName: fullName,
                        customerEmail: pkg.user?.email || '',
                        amount: amountFixed,
                        currency: pkg.currency,
                        status: 'APPROACHING_MATURITY',
                        targetTab: 'packages',
                        requestDate: endDt.toISOString(),
                        createdDate: endDt.toISOString(),
                        ageMs: 0,
                        ageHours: 0,
                        ageDays: 0,
                        ageLabel: `${daysRemaining}d left`,
                        isOverdue: false,
                        urgency: 'UPCOMING',
                        priorityRank: 4,
                        meta: {
                            packageCode: pkg.packageCode,
                            daysRemaining,
                        },
                    });
                }
            }
        }
        // Pending Deposit Requests
        for (const dep of pendingDepositsList) {
            const fullName = `${dep.user?.firstName || ''} ${dep.user?.lastName || ''}`.trim() ||
                dep.user?.email ||
                'Investor';
            const amountFixed = new decimal_js_1.default(dep.amount.toString()).toFixed(2);
            const age = this.computeAgeInfo(dep.createdAt, now, 48);
            const item = {
                id: `DEP-${dep.id}`,
                entityId: dep.id,
                code: dep.depositCode,
                category: 'DEPOSIT',
                typeLabel: 'Deposit / Balance Request',
                title: `Deposit Request: ${dep.depositCode} ($${amountFixed} ${dep.currency})`,
                description: `${dep.depositMethod} deposit awaiting verification${dep.txHashOrRef ? ` • Ref: ${dep.txHashOrRef}` : ' • No gateway ref'}`,
                customerId: dep.userId,
                customerName: fullName,
                customerEmail: dep.user?.email || '',
                amount: amountFixed,
                currency: dep.currency,
                status: dep.status,
                targetTab: 'deposits',
                requestDate: dep.createdAt.toISOString(),
                createdDate: dep.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
                priorityRank: age.isOverdue ? 0 : 2,
                meta: {
                    depositMethod: dep.depositMethod,
                    txHashOrRef: dep.txHashOrRef,
                },
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Pending Withdrawal Requests
        for (const wth of pendingWithdrawalsList) {
            const fullName = `${wth.user?.firstName || ''} ${wth.user?.lastName || ''}`.trim() ||
                wth.user?.email ||
                'Investor';
            const amountFixed = new decimal_js_1.default(wth.amount.toString()).toFixed(2);
            const age = this.computeAgeInfo(wth.createdAt, now, 48);
            let parsedDetails = null;
            try {
                parsedDetails = wth.payoutDetails ? JSON.parse(wth.payoutDetails) : null;
            }
            catch {
                parsedDetails = null;
            }
            const item = {
                id: `WTH-${wth.id}`,
                entityId: wth.id,
                code: wth.requestCode,
                category: 'WITHDRAWAL',
                typeLabel: 'Withdrawal Settlement',
                title: `Withdrawal Request: ${wth.requestCode} (${amountFixed} ${wth.currency})`,
                description: `${wth.payoutMethod}${parsedDetails?.network ? ` • ${parsedDetails.network}` : ''} • ${parsedDetails?.sourceBalanceLabel || wth.withdrawalType}${wth.package?.packageCode ? ` (${wth.package.packageCode})` : ''}`,
                customerId: wth.userId,
                customerName: fullName,
                customerEmail: wth.user?.email || '',
                amount: amountFixed,
                currency: wth.currency,
                status: wth.status,
                targetTab: 'withdrawals',
                requestDate: wth.createdAt.toISOString(),
                createdDate: wth.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
                priorityRank: age.isOverdue ? 0 : 2,
                meta: {
                    payoutMethod: wth.payoutMethod,
                    network: parsedDetails?.network || null,
                    sourceBalanceLabel: parsedDetails?.sourceBalanceLabel || null,
                    withdrawalType: wth.withdrawalType,
                },
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Pending KYC Verifications
        for (const kyc of pendingKycList) {
            const fullName = `${kyc.user?.firstName || ''} ${kyc.user?.lastName || ''}`.trim() ||
                kyc.user?.email ||
                'Investor';
            const age = this.computeAgeInfo(kyc.createdAt, now, 48);
            const item = {
                id: `KYC-${kyc.id}`,
                entityId: kyc.id,
                code: `KYC-${kyc.id.slice(0, 8).toUpperCase()}`,
                category: 'KYC_VERIFICATION',
                typeLabel: 'KYC Verification',
                title: `KYC Review: ${kyc.documentType}`,
                description: `${kyc.documentType} submission awaiting compliance verification`,
                customerId: kyc.userId,
                customerName: fullName,
                customerEmail: kyc.user?.email || '',
                amount: null,
                currency: null,
                status: kyc.status,
                targetTab: 'kyc',
                requestDate: kyc.createdAt.toISOString(),
                createdDate: kyc.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
                priorityRank: age.isOverdue ? 1 : 3,
                meta: { documentType: kyc.documentType },
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Pending Global Remittance Orders
        for (const tr of pendingTransfersList) {
            const fullName = `${tr.user?.firstName || ''} ${tr.user?.lastName || ''}`.trim() ||
                tr.senderName ||
                tr.senderEmail;
            const amountFixed = new decimal_js_1.default(tr.sendingAmount.toString()).toFixed(2);
            const age = this.computeAgeInfo(tr.createdAt, now, 48);
            const item = {
                id: `GMT-${tr.id}`,
                entityId: tr.id,
                code: tr.transferCode,
                category: 'REMITTANCE',
                typeLabel: 'Global Remittance',
                title: `Remittance Order: ${tr.transferCode} (${amountFixed} ${tr.sendingCurrency} → ${tr.recipientCurrency})`,
                description: `To ${tr.recipientName} (${tr.destinationCountry}) • Status: ${tr.status}`,
                customerId: tr.userId,
                customerName: fullName,
                customerEmail: tr.user?.email || tr.senderEmail || '',
                amount: amountFixed,
                currency: tr.sendingCurrency,
                status: tr.status,
                targetTab: 'remittance',
                requestDate: tr.createdAt.toISOString(),
                createdDate: tr.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : age.ageHours >= 24 ? 'HIGH' : 'NORMAL',
                priorityRank: age.isOverdue ? 1 : 3,
                meta: {
                    recipientCurrency: tr.recipientCurrency,
                    destinationCountry: tr.destinationCountry,
                },
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Open Support Tickets
        for (const tkt of openTicketsList) {
            const fullName = `${tkt.user?.firstName || ''} ${tkt.user?.lastName || ''}`.trim() ||
                tkt.user?.email ||
                'Client';
            const age = this.computeAgeInfo(tkt.createdAt, now, 48);
            const item = {
                id: `TKT-${tkt.id}`,
                entityId: tkt.id,
                code: tkt.ticketNumber,
                category: 'SUPPORT_TICKET',
                typeLabel: 'Support Ticket',
                title: `Support Ticket: ${tkt.subject}`,
                description: `Priority: ${tkt.priority} • Category: ${tkt.category}`,
                customerId: tkt.userId,
                customerName: fullName,
                customerEmail: tkt.user?.email || '',
                amount: null,
                currency: null,
                status: tkt.status,
                targetTab: 'disputes',
                requestDate: tkt.createdAt.toISOString(),
                createdDate: tkt.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : tkt.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
                priorityRank: age.isOverdue ? 1 : 3,
                meta: { priority: tkt.priority, ticketCategory: tkt.category },
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Disputed / Frozen P2P Orders
        for (const p2p of disputedP2PList) {
            const buyerName = `${p2p.buyer?.firstName || ''} ${p2p.buyer?.lastName || ''}`.trim() || p2p.buyer?.email || 'Buyer';
            const amountFixed = new decimal_js_1.default(p2p.cryptoAmount.toString()).toFixed(2);
            const cryptoCur = (p2p.cryptoCurrency || p2p.offer?.cryptoCurrency || 'USDT').toUpperCase();
            const fiatCur = (p2p.fiatCurrency || p2p.offer?.fiatCurrency || 'USD').toUpperCase();
            const age = this.computeAgeInfo(p2p.disputedAt || p2p.createdAt, now, 3);
            const item = {
                id: `P2P-${p2p.id}`,
                entityId: p2p.id,
                code: p2p.orderCode,
                category: 'P2P_DISPUTE',
                typeLabel: p2p.status === 'FROZEN' ? 'P2P Order Frozen' : 'P2P Escrow Dispute',
                title: `P2P ${p2p.status === 'FROZEN' ? 'Frozen' : 'Dispute'}: ${p2p.orderCode} (${amountFixed} ${cryptoCur})`,
                description: `${buyerName} vs ${p2p.seller?.email || 'Seller'} (${(0, p2p_helpers_1.formatFiatWithCurrency)(p2p.fiatAmount.toString(), fiatCur)}) • 180m SLA compliance review`,
                customerId: p2p.buyerId,
                customerName: buyerName,
                customerEmail: p2p.buyer?.email || '',
                amount: amountFixed,
                currency: cryptoCur,
                status: p2p.status,
                targetTab: 'p2p',
                requestDate: (p2p.disputedAt || p2p.createdAt).toISOString(),
                createdDate: p2p.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
                priorityRank: 0,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Pending P2P Onboarding Applications
        for (const papp of pendingP2PAppsList) {
            const applicantName = `${papp.user?.firstName || ''} ${papp.user?.lastName || ''}`.trim() ||
                papp.user?.email ||
                'Applicant';
            const age = this.computeAgeInfo(papp.createdAt, now, 24);
            const item = {
                id: `P2PAPP-${papp.id}`,
                entityId: papp.id,
                code: papp.applicationCode,
                category: 'P2P_APPLICATION',
                typeLabel: 'P2P Onboarding Review',
                title: `P2P Trader Verification: ${papp.applicationCode} (${applicantName})`,
                description: `SOF: ${papp.sourceOfFunds} • Volume: ${papp.expectedMonthlyVolume} • Experience: ${papp.tradingExperience}`,
                customerId: papp.userId,
                customerName: applicantName,
                customerEmail: papp.user?.email || '',
                amount: null,
                currency: null,
                status: papp.status,
                targetTab: 'p2p',
                requestDate: papp.createdAt.toISOString(),
                createdDate: papp.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
                priorityRank: 1,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // New Client Inquiries
        for (const inq of pendingInquiriesList) {
            const age = this.computeAgeInfo(inq.createdAt, now, 48);
            const item = {
                id: `INQ-${inq.id}`,
                entityId: inq.id,
                code: `INQ-${inq.id.slice(0, 8).toUpperCase()}`,
                category: 'INQUIRY',
                typeLabel: 'Client Inquiry',
                title: `Client Inquiry: ${inq.subject}`,
                description: `${inq.type} inquiry from ${inq.name}`,
                customerId: inq.userId || null,
                customerName: inq.name,
                customerEmail: inq.email,
                amount: null,
                currency: null,
                status: inq.status,
                targetTab: 'disputes',
                requestDate: inq.createdAt.toISOString(),
                createdDate: inq.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : 'NORMAL',
                priorityRank: age.isOverdue ? 1 : 3,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Active, Disputed & Recent OTC Escrow Trades (Real-Time OTC Purchase Alerts & Liquidity Monitoring)
        const otcReserveObligations = {
            BTC: { quantity: new decimal_js_1.default(0), usdValue: new decimal_js_1.default(0) },
            ETH: { quantity: new decimal_js_1.default(0), usdValue: new decimal_js_1.default(0) },
            USDT: { quantity: new decimal_js_1.default(0), usdValue: new decimal_js_1.default(0) },
            USDC: { quantity: new decimal_js_1.default(0), usdValue: new decimal_js_1.default(0) },
        };
        for (const otc of activeAndDisputedOtcTradesList) {
            const custName = `${otc.customer?.firstName || ''} ${otc.customer?.lastName || ''}`.trim() ||
                otc.customer?.email ||
                'Customer';
            const rawAsset = (otc.tradeType || 'BUY_USDT')
                .replace(/^BUY_/, '')
                .replace(/^SELL_/, '')
                .toUpperCase() || 'USDT';
            const assetPurchased = ['BTC', 'ETH', 'USDT', 'USDC'].includes(rawAsset) ? rawAsset : 'USDT';
            const cryptoDec = new decimal_js_1.default(otc.cryptoAmount.toString());
            const decPlaces = ['BTC', 'ETH'].includes(assetPurchased) ? 6 : 2;
            const amountFixed = cryptoDec.toFixed(decPlaces);
            const isDisputed = otc.status === 'DISPUTED';
            const isInProgress = otc.status === 'IN_PROGRESS';
            const isBuyAction = (otc.tradeType || '').startsWith('BUY');
            // Approximate unit price in USD
            let unitPriceUsd = 1.0;
            if (assetPurchased === 'BTC')
                unitPriceUsd = 96500.0;
            else if (assetPurchased === 'ETH')
                unitPriceUsd = 3450.0;
            else if (assetPurchased === 'USDT' || assetPurchased === 'USDC')
                unitPriceUsd = 1.0;
            if (otc.fiatCurrency === 'USD' && otc.quotedRate) {
                const rateNum = Number(otc.quotedRate.toString());
                if (Number.isFinite(rateNum) && rateNum > 0)
                    unitPriceUsd = rateNum;
            }
            const estUsdVal = cryptoDec.times(unitPriceUsd).toNumber();
            if (isInProgress || isDisputed) {
                if (!otcReserveObligations[assetPurchased]) {
                    otcReserveObligations[assetPurchased] = { quantity: new decimal_js_1.default(0), usdValue: new decimal_js_1.default(0) };
                }
                otcReserveObligations[assetPurchased].quantity = otcReserveObligations[assetPurchased].quantity.plus(cryptoDec);
                otcReserveObligations[assetPurchased].usdValue = otcReserveObligations[assetPurchased].usdValue.plus(estUsdVal);
            }
            const age = this.computeAgeInfo(otc.createdAt, now, isDisputed ? 12 : 24);
            const exactTimeStr = otc.createdAt.toISOString();
            const unitPriceFormatted = otc.quotedRate
                ? `${new decimal_js_1.default(otc.quotedRate.toString()).toFixed(2)} ${otc.fiatCurrency || 'USD'}`
                : `$${unitPriceUsd.toFixed(2)}`;
            const liquidityRequirementText = `Reserve Action: Platform must maintain ${amountFixed} ${assetPurchased} ($${estUsdVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD equivalent) liquidity reserve for delivery / settlement.`;
            const item = {
                id: `OTC_TRD-${otc.id}`,
                entityId: otc.id,
                code: otc.tradeCode,
                category: isDisputed ? 'OTC_DISPUTE' : 'OTC_TRADE',
                typeLabel: isDisputed ? 'OTC Escrow Dispute' : isBuyAction ? 'OTC Crypto Purchase' : 'Active OTC Escrow',
                title: `${isDisputed ? 'OTC Dispute' : 'OTC Purchase'}: ${otc.tradeCode} (${amountFixed} ${assetPurchased})`,
                description: `${custName} (${otc.customer?.email || ''}) purchased ${amountFixed} ${assetPurchased} @ ${unitPriceFormatted} • ${liquidityRequirementText}`,
                customerId: otc.customerId,
                customerName: custName,
                customerEmail: otc.customer?.email || '',
                userName: custName,
                userEmail: otc.customer?.email || '',
                assetPurchased,
                quantity: `${amountFixed} ${assetPurchased}`,
                purchasePrice: unitPriceFormatted,
                currencyUsed: otc.fiatCurrency || 'USD',
                fiatAmount: otc.fiatAmount ? new decimal_js_1.default(otc.fiatAmount.toString()).toFixed(2) : null,
                exactDateTime: exactTimeStr,
                orderId: otc.tradeCode,
                amount: amountFixed,
                currency: assetPurchased,
                status: otc.status,
                targetTab: 'otc',
                deskName: otc.desk?.deskName || 'OTC Desk',
                deskLocation: `${otc.desk?.city || ''}, ${otc.desk?.country || ''}`.trim(),
                operatorName: `${otc.operator?.firstName || ''} ${otc.operator?.lastName || ''}`.trim() || otc.operator?.email || 'Operator',
                liquidityRequirement: liquidityRequirementText,
                reserveObligationUsd: estUsdVal,
                requestDate: exactTimeStr,
                createdDate: exactTimeStr,
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: isDisputed || age.isOverdue ? 'OVERDUE' : isInProgress ? 'HIGH' : 'NORMAL',
                priorityRank: isDisputed ? 0 : isInProgress ? 1 : 2,
            };
            if (isInProgress || isDisputed) {
                pendingRequests.push(item);
            }
            alerts.push(item);
        }
        // OTC Desks Awaiting Review
        for (const desk of underReviewOtcDesksList) {
            const opName = `${desk.user?.firstName || ''} ${desk.user?.lastName || ''}`.trim() ||
                desk.user?.email ||
                'Operator';
            const age = this.computeAgeInfo(desk.createdAt, now, 24);
            const item = {
                id: `OTC_DSK-${desk.id}`,
                entityId: desk.id,
                code: desk.deskCode,
                category: 'OTC_DESK_REVIEW',
                typeLabel: 'OTC Desk Review',
                title: `OTC Desk Review: ${desk.deskName}`,
                description: `${desk.city}, ${desk.country} • ${desk.locationAddress || 'Verify location & deposit'}`,
                customerId: desk.userId,
                customerName: opName,
                customerEmail: desk.user?.email || '',
                amount: new decimal_js_1.default(desk.securityDeposit.toString()).toFixed(2),
                currency: 'USD',
                status: desk.status,
                targetTab: 'otc',
                requestDate: desk.createdAt.toISOString(),
                createdDate: desk.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
                priorityRank: age.isOverdue ? 0 : 2,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Open Pre-Trade OTC Desk Inquiries (customer asking availability / currency)
        for (const inq of openOtcInquiriesList) {
            const custName = `${inq.customer?.firstName || ''} ${inq.customer?.lastName || ''}`.trim() ||
                inq.customer?.email ||
                'Client';
            const lastMsgText = inq.messages?.[0]?.message || inq.subject;
            const age = this.computeAgeInfo(inq.updatedAt || inq.createdAt, now, 12);
            const item = {
                id: `OTC_INQ-${inq.id}`,
                entityId: inq.id,
                code: inq.inquiryCode,
                category: 'OTC_TRADE',
                typeLabel: 'OTC Desk Inquiry',
                title: `OTC Inquiry: ${inq.desk?.deskName || 'OTC Desk'} (${inq.inquiryCode})`,
                description: `${custName}: "${String(lastMsgText).slice(0, 120)}"`,
                customerId: inq.customerId,
                customerName: custName,
                customerEmail: inq.customer?.email || '',
                status: inq.status,
                targetTab: 'otc',
                requestDate: (inq.updatedAt || inq.createdAt).toISOString(),
                createdDate: inq.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
                priorityRank: 1,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Active & New P2P Orders (PENDING, PENDING_PAYMENT, PAYMENT_SENT, etc.)
        for (const ord of activeP2POrdersList) {
            const buyerName = `${ord.buyer?.firstName || ''} ${ord.buyer?.lastName || ''}`.trim() || ord.buyer?.email || 'Buyer';
            const cryptoCur = (ord.cryptoCurrency || ord.offer?.cryptoCurrency || 'USDT').toUpperCase();
            const fiatCur = (ord.fiatCurrency || ord.offer?.fiatCurrency || 'USD').toUpperCase();
            const decPlaces = ['BTC', 'ETH'].includes(cryptoCur) ? 6 : 2;
            const amountFixed = new decimal_js_1.default(ord.cryptoAmount.toString()).toFixed(decPlaces);
            const age = this.computeAgeInfo(ord.createdAt, now, 2);
            const item = {
                id: `P2P_ORD-${ord.id}`,
                entityId: ord.id,
                code: ord.orderCode,
                category: 'P2P_ORDER',
                typeLabel: 'Active P2P Order',
                title: `P2P Order (${ord.status}): ${ord.orderCode} (${amountFixed} ${cryptoCur})`,
                description: `${buyerName} (${ord.buyer?.email || ''}) ↔ ${ord.seller?.email || 'Seller'} (${(0, p2p_helpers_1.formatFiatWithCurrency)(ord.fiatAmount.toString(), fiatCur)})`,
                customerId: ord.buyerId,
                customerName: buyerName,
                customerEmail: ord.buyer?.email || '',
                amount: amountFixed,
                currency: cryptoCur,
                status: ord.status,
                targetTab: 'p2p',
                requestDate: ord.createdAt.toISOString(),
                createdDate: ord.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: ord.status === 'PAYMENT_SENT' ? 'HIGH' : 'NORMAL',
                priorityRank: ord.status === 'PAYMENT_SENT' ? 1 : 2,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Pending Venture Inquiries
        for (const vinq of pendingVentureInquiriesList) {
            const invName = `${vinq.investor?.firstName || ''} ${vinq.investor?.lastName || ''}`.trim() || vinq.investor?.email || 'Investor';
            const age = this.computeAgeInfo(vinq.createdAt, now, 24);
            const item = {
                id: `VINQ-${vinq.id}`,
                entityId: vinq.id,
                code: `VINQ-${vinq.id.slice(0, 8).toUpperCase()}`,
                category: 'VENTURE_INQUIRY',
                typeLabel: 'Venture Inquiry',
                title: `Startup Inquiry (${vinq.listing?.companyName || 'Venture'}): ${vinq.subject}`,
                description: `${invName}: "${String(vinq.message || '').slice(0, 120)}"`,
                customerId: vinq.investorUserId,
                customerName: invName,
                customerEmail: vinq.investor?.email || '',
                amount: null,
                currency: null,
                status: vinq.status,
                targetTab: 'investments',
                requestDate: vinq.createdAt.toISOString(),
                createdDate: vinq.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: age.isOverdue ? 'OVERDUE' : 'HIGH',
                priorityRank: 2,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Pending High-Risk / Large Currency Swap Approvals
        for (const sr of pendingSwapRequestsList) {
            const custName = `${sr.user?.firstName || ''} ${sr.user?.lastName || ''}`.trim() || sr.user?.email || 'Client';
            const fromCur = (sr.fromCurrency || 'USD').toUpperCase();
            const toCur = (sr.toCurrency || 'USDT').toUpperCase();
            const fromDp = ['BTC', 'ETH'].includes(fromCur) ? 6 : 2;
            const toDp = ['BTC', 'ETH'].includes(toCur) ? 6 : 2;
            const fromAmtDec = new decimal_js_1.default(sr.fromAmount?.toString() || '0');
            const toAmtDec = new decimal_js_1.default(sr.toAmount?.toString() || '0');
            const fromUsdDec = new decimal_js_1.default(sr.fromAmountUsd?.toString() || '0');
            const costBasisDec = new decimal_js_1.default(sr.userCostBasisUsd?.toString() || '0');
            const estPnlDec = new decimal_js_1.default(sr.estimatedPnlImpactUsd?.toString() || '0');
            const origUnitPrice = fromAmtDec.greaterThan(0) && costBasisDec.greaterThan(0)
                ? costBasisDec.dividedBy(fromAmtDec).toFixed(2)
                : fromAmtDec.greaterThan(0)
                    ? fromUsdDec.dividedBy(fromAmtDec).toFixed(2)
                    : '1.00';
            const reqSellUnitPrice = fromAmtDec.greaterThan(0)
                ? fromUsdDec.dividedBy(fromAmtDec).toFixed(2)
                : '1.00';
            let parsedFlags = [];
            try {
                parsedFlags = sr.riskFlags ? JSON.parse(sr.riskFlags) : [];
            }
            catch {
                parsedFlags = [];
            }
            const age = this.computeAgeInfo(sr.createdAt, now, 4);
            const item = {
                id: `SWREQ-${sr.id}`,
                entityId: sr.id,
                code: sr.requestCode,
                category: 'SWAP_APPROVAL',
                typeLabel: 'Swap Risk Approval',
                title: `Swap Approval: ${fromAmtDec.toFixed(fromDp)} ${fromCur} -> ${toAmtDec.toFixed(toDp)} ${toCur} ($${fromUsdDec.toFixed(2)})`,
                description: `${custName} • Orig Buy Price: $${origUnitPrice}/${fromCur} → Sell Price: $${reqSellUnitPrice}/${fromCur} • Cost Basis: $${costBasisDec.toFixed(2)} • Est P&L Impact: $${estPnlDec.toFixed(2)}${parsedFlags.length ? ` [${parsedFlags.join(', ')}]` : ''}`,
                customerId: sr.userId,
                customerName: custName,
                customerEmail: sr.user?.email || '',
                amount: fromAmtDec.toFixed(fromDp),
                currency: fromCur,
                status: sr.status,
                targetTab: 'liquidity',
                requestDate: sr.createdAt.toISOString(),
                createdDate: sr.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: age.isOverdue,
                urgency: 'HIGH',
                priorityRank: 1,
            };
            pendingRequests.push(item);
            alerts.push(item);
        }
        // Recent Instant Currency Swaps & Crypto/Fiat Purchases (72h activity visibility with quantity, purchase price & reserve notice)
        for (const sw of recentSwapsList) {
            const custName = `${sw.user?.firstName || ''} ${sw.user?.lastName || ''}`.trim() || sw.user?.email || 'Client';
            const cur = (sw.currency || 'USD').toUpperCase();
            const decPlaces = ['BTC', 'ETH'].includes(cur) ? 6 : 2;
            const amtFixed = new decimal_js_1.default(sw.amount.toString()).toFixed(decPlaces);
            const notesStr = String(sw.notes || '');
            const buyPriceMatch = notesStr.match(/Buy Price:\s*1\s+[A-Z0-9]+\s*=\s*\$?([\d,]+(?:\.\d+)?)/i);
            const costBasisMatch = notesStr.match(/Cost Basis:\s*\$?([\d,]+(?:\.\d+)?)/i);
            const buyPriceLabel = buyPriceMatch ? `1 ${cur} = $${buyPriceMatch[1]} USD` : 'Live Rate';
            const costBasisLabel = costBasisMatch ? `Cost Basis: $${costBasisMatch[1]} USD` : '';
            const age = this.computeAgeInfo(sw.createdAt, now, 9999);
            const item = {
                id: `SWAP-${sw.id}`,
                entityId: sw.id,
                code: sw.transactionCode,
                category: 'CURRENCY_SWAP',
                typeLabel: 'Crypto/Currency Purchase',
                title: `User Purchased ${amtFixed} ${cur} @ ${buyPriceLabel} (${sw.transactionCode})`,
                description: `${custName} (${sw.user?.email || ''}) • ${costBasisLabel ? `${costBasisLabel} • ` : ''}${notesStr} • Reserve Action: Maintain ${amtFixed} ${cur} liquidity for future sell requests`,
                customerId: sw.userId,
                customerName: custName,
                customerEmail: sw.user?.email || '',
                amount: amtFixed,
                currency: cur,
                unitPurchasePriceUsd: buyPriceMatch ? buyPriceMatch[1] : null,
                costBasisUsd: costBasisMatch ? costBasisMatch[1] : null,
                status: sw.status,
                targetTab: 'liquidity',
                requestDate: sw.createdAt.toISOString(),
                createdDate: sw.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: false,
                urgency: ['BTC', 'ETH'].includes(cur) ? 'HIGH' : 'NORMAL',
                priorityRank: ['BTC', 'ETH'].includes(cur) ? 2 : 3,
            };
            alerts.push(item);
        }
        // Recent Avora P2P Internal Transfers (72h)
        for (const ptr of recentP2PTransfersList) {
            const custName = `${ptr.user?.firstName || ''} ${ptr.user?.lastName || ''}`.trim() || ptr.user?.email || 'Client';
            const cur = (ptr.currency || 'USD').toUpperCase();
            const decPlaces = ['BTC', 'ETH'].includes(cur) ? 6 : 2;
            const amtFixed = new decimal_js_1.default(ptr.amount.toString()).toFixed(decPlaces);
            const age = this.computeAgeInfo(ptr.createdAt, now, 9999);
            alerts.push({
                id: `P2PX-${ptr.id}`,
                entityId: ptr.id,
                code: ptr.transactionCode,
                category: 'P2P_TRANSFER',
                typeLabel: 'Avora P2P Transfer',
                title: `P2P Transfer: ${ptr.transactionCode} (${amtFixed} ${cur})`,
                description: `${custName} • ${ptr.notes || 'Avora internal transfer'}`,
                customerId: ptr.userId,
                customerName: custName,
                customerEmail: ptr.user?.email || '',
                amount: amtFixed,
                currency: cur,
                status: ptr.status,
                targetTab: 'p2p',
                requestDate: ptr.createdAt.toISOString(),
                createdDate: ptr.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: false,
                urgency: 'NORMAL',
                priorityRank: 3,
            });
        }
        // Recent New P2P Marketplace Offers (72h)
        for (const off of recentP2POffersList) {
            const merchantName = `${off.user?.firstName || ''} ${off.user?.lastName || ''}`.trim() || off.user?.email || 'Merchant';
            const age = this.computeAgeInfo(off.createdAt, now, 9999);
            alerts.push({
                id: `P2POFF-${off.id}`,
                entityId: off.id,
                code: off.offerCode,
                category: 'P2P_OFFER',
                typeLabel: 'New P2P Offer',
                title: `New P2P ${off.side} Offer: ${off.offerCode} (${new decimal_js_1.default(off.totalAmount.toString()).toFixed(2)} ${off.cryptoCurrency})`,
                description: `${merchantName} (${off.user?.email || ''}) @ ${new decimal_js_1.default(off.price.toString()).toFixed(2)} ${off.fiatCurrency}`,
                customerId: off.userId,
                customerName: merchantName,
                customerEmail: off.user?.email || '',
                amount: new decimal_js_1.default(off.totalAmount.toString()).toFixed(2),
                currency: off.cryptoCurrency,
                status: off.status,
                targetTab: 'p2p',
                requestDate: off.createdAt.toISOString(),
                createdDate: off.createdAt.toISOString(),
                ageMs: age.ageMs,
                ageHours: age.ageHours,
                ageDays: age.ageDays,
                ageLabel: age.ageLabel,
                isOverdue: false,
                urgency: 'NORMAL',
                priorityRank: 3,
            });
        }
        const sortByUrgencyThenAge = (a, b) => {
            if (a.priorityRank !== b.priorityRank)
                return a.priorityRank - b.priorityRank;
            return b.ageMs - a.ageMs;
        };
        pendingRequests.sort(sortByUrgencyThenAge);
        alerts.sort(sortByUrgencyThenAge);
        const overdueCount = pendingRequests.filter((r) => r.isOverdue).length;
        const dueTodayCount = pendingRequests.filter((r) => r.urgency === 'DUE_TODAY').length;
        const totalPendingCount = pendingRequests.filter((r) => !['FD_YIELD_DUE', 'FD_MATURED'].includes(r.category)).length;
        const oldestItem = [...pendingRequests].sort((a, b) => b.ageMs - a.ageMs)[0] || null;
        const summary = {
            yieldDueCount,
            yieldDueTotalUsd: yieldDueTotalDec.toFixed(2),
            yieldDueSoonCount,
            yieldDueSoonTotalUsd: yieldDueSoonTotalDec.toFixed(2),
            maturedUnsettledCount,
            approachingMaturityCount,
            pendingDepositsCount: pendingDepositsList.length,
            pendingWithdrawalsCount: pendingWithdrawalsList.length,
            pendingPackagesCount,
            pendingKycCount: pendingKycList.length,
            pendingRemittancesCount: pendingTransfersList.length,
            openTicketsCount: openTicketsList.length,
            disputedP2PCount: disputedP2PList.length,
            pendingP2PApplicationsCount: pendingP2PAppsList.length,
            disputedOtcCount: activeAndDisputedOtcTradesList.filter((t) => t.status === 'DISPUTED').length,
            activeOtcTradesCount: activeAndDisputedOtcTradesList.length,
            activeP2POrdersCount: activeP2POrdersList.length,
            recentSwapsCount: recentSwapsList.length,
            recentP2PTransfersCount: recentP2PTransfersList.length,
            recentP2POffersCount: recentP2POffersList.length,
            pendingVentureInquiriesCount: pendingVentureInquiriesList.length,
            pendingSwapsCount: pendingSwapRequestsList.length,
            newInquiriesCount: pendingInquiriesList.length,
            totalPendingCount,
            totalActionItems: pendingRequests.length,
            overdueCount,
            dueTodayCount,
            upcomingAlertsCount: alerts.filter((a) => a.urgency === 'UPCOMING').length,
            totalAlertsCount: alerts.length,
            oldestPendingDays: oldestItem ? oldestItem.ageDays : 0,
            oldestPendingLabel: oldestItem ? oldestItem.ageLabel : '0m',
            nextUpcomingYieldDate: nextUpcomingYieldDate ? nextUpcomingYieldDate.toISOString() : null,
        };
        const totalReserveObligationUsd = Object.values(otcReserveObligations).reduce((sum, item) => sum + item.usdValue.toNumber(), 0);
        const liquidityMonitoring = {
            totalReserveObligationUsd: Number(totalReserveObligationUsd.toFixed(2)),
            breakdown: Object.entries(otcReserveObligations).map(([asset, val]) => ({
                asset,
                pendingQuantity: val.quantity.toFixed(asset === 'BTC' || asset === 'ETH' ? 6 : 2),
                reserveUsdEquivalent: Number(val.usdValue.toFixed(2)),
            })),
            recentOtcPurchases: alerts
                .filter((a) => a.category === 'OTC_TRADE' || a.category === 'OTC_DISPUTE' || a.category === 'CURRENCY_SWAP')
                .slice(0, 15),
        };
        return {
            ...summary,
            summary,
            alerts,
            pendingRequests,
            liquidityMonitoring,
            generatedAt: now.toISOString(),
        };
    }
    /**
     * Dedicated endpoint returning real-time date-based notifications, yield alerts & pending/overdue requests
     */
    async getAdminNotifications(req, res, next) {
        try {
            const commandCenter = await this.buildAdminCommandCenterData();
            res.json({
                success: true,
                data: commandCenter,
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
            const [totalUsers, totalPackages, activePackages, pendingDeposits] = await Promise.all([
                prisma_1.prisma.user.count(),
                prisma_1.prisma.investmentPackage.count(),
                prisma_1.prisma.investmentPackage.findMany({
                    where: { status: client_1.PackageStatus.ACTIVE },
                    select: { amount: true },
                }),
                prisma_1.prisma.depositRequest.count({ where: { status: client_1.DepositStatus.PENDING } }),
            ]);
            const [pendingWithdrawals, pendingKyc, totalStartups, totalTransfers] = await Promise.all([
                prisma_1.prisma.withdrawalRequest.count({
                    where: {
                        status: {
                            in: [client_1.WithdrawalStatus.REQUESTED, client_1.WithdrawalStatus.UNDER_REVIEW, client_1.WithdrawalStatus.APPROVED],
                        },
                    },
                }),
                prisma_1.prisma.kycDocument.count({ where: { status: client_1.KycStatus.PENDING } }),
                prisma_1.prisma.startupListing.count({ where: { status: 'PUBLISHED' } }),
                prisma_1.prisma.globalTransfer.count(),
            ]);
            const [totalTickets, totalOtcDesks, totalOtcTrades, onlineOtcDesks] = await Promise.all([
                prisma_1.prisma.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
                prisma_1.prisma.otcDesk.count(),
                prisma_1.prisma.otcTrade.count(),
                prisma_1.prisma.otcDesk.count({ where: { isOnline: true } }),
            ]);
            const [otcCompletedVolAgg, otcActiveCount, p2pStatsRows, tokenPolicy] = await Promise.all([
                prisma_1.prisma.otcTrade.aggregate({
                    where: { status: 'COMPLETED' },
                    _sum: { cryptoAmount: true },
                    _count: true,
                }),
                prisma_1.prisma.otcTrade.count({ where: { status: { in: ['IN_PROGRESS', 'DISPUTED'] } } }),
                prisma_1.prisma.p2POffer.count({ where: { status: client_1.P2POfferStatus.OPEN } }),
                token_service_1.tokenService.getTokenPolicyConfig(),
            ]);
            const [p2pCompletedOrdersAgg, p2pActiveOrdersCount, p2pDisputedCount, p2pMerchantsCount] = await Promise.all([
                prisma_1.prisma.p2POrder.aggregate({
                    where: { status: client_1.P2POrderStatus.COMPLETED },
                    _sum: { cryptoAmount: true },
                    _count: true,
                }),
                prisma_1.prisma.p2POrder.count({
                    where: {
                        status: {
                            in: [
                                client_1.P2POrderStatus.PENDING,
                                client_1.P2POrderStatus.ACCEPTED,
                                client_1.P2POrderStatus.PENDING_PAYMENT,
                                client_1.P2POrderStatus.PAYMENT_SENT,
                                client_1.P2POrderStatus.SELLER_CONFIRMING,
                            ],
                        },
                    },
                }),
                prisma_1.prisma.p2POrder.count({ where: { status: client_1.P2POrderStatus.DISPUTED } }),
                prisma_1.prisma.user.count({ where: { isP2pMerchant: true } }),
            ]);
            const [ventureStatsRows, startupHeadlineRows, fdYieldsPaidAgg, fdDistinctUsers, tokenRecords] = await Promise.all([
                prisma_1.prisma.investmentCommitment.findMany({
                    select: { investorUserId: true, netInvestedAmount: true, sourceType: true },
                }),
                prisma_1.prisma.startupListing.findMany({
                    select: { verifiedFundsRaised: true },
                }),
                prisma_1.prisma.packageReturn.aggregate({
                    where: { status: 'CREDITED' },
                    _sum: { returnAmount: true },
                }),
                prisma_1.prisma.investmentPackage.findMany({
                    select: { userId: true },
                    distinct: ['userId'],
                }),
                prisma_1.prisma.tokenEarlyAccess.findMany({
                    select: { tokensAllocated: true, paidAllocationUsd: true },
                }),
            ]);
            const commandCenter = await this.buildAdminCommandCenterData();
            const platformRevenueSummary = await this.buildPlatformRevenueData(req.user?.id ? String(req.user.id) : undefined).catch(() => null);
            const activeCapital = activePackages.reduce((acc, p) => acc + parseFloat(p.amount.toString()), 0);
            const revMod = platformRevenueSummary?.moduleBreakdown;
            const realVentureRows = ventureStatsRows.filter((c) => c.sourceType !== 'ADMIN_DISPLAY_MOCK');
            const mockVentureRows = ventureStatsRows.filter((c) => c.sourceType === 'ADMIN_DISPLAY_MOCK');
            const uniqueVentureInvestors = new Set(realVentureRows.map((c) => c.investorUserId)).size;
            const totalVentureCommittedUsd = realVentureRows.reduce((s, c) => s + Number(c.netInvestedAmount || 0), 0);
            const mockVentureVolumeUsd = mockVentureRows.reduce((s, c) => s + Number(c.netInvestedAmount || 0), 0);
            const totalCardHeadlineUsd = startupHeadlineRows.reduce((s, l) => s + Number(l.verifiedFundsRaised || 0), 0);
            const headlineDisplayDeltaUsd = Number((totalCardHeadlineUsd - totalVentureCommittedUsd).toFixed(2));
            let tokenPaidHolders = 0;
            let tokenWhitelistOnly = 0;
            let totalTokensAllocated = 0;
            let totalTokenPaidUsd = 0;
            for (const tr of tokenRecords) {
                const tok = Number(tr.tokensAllocated || 0);
                const usd = Number(tr.paidAllocationUsd || 0);
                if (tok > 0 || usd > 0)
                    tokenPaidHolders += 1;
                else
                    tokenWhitelistOnly += 1;
                totalTokensAllocated += tok;
                totalTokenPaidUsd += usd;
            }
            const sectionMetrics = {
                otc: {
                    totalDesks: totalOtcDesks,
                    onlineDesks: onlineOtcDesks,
                    totalTrades: totalOtcTrades,
                    completedTrades: typeof otcCompletedVolAgg._count === 'number' ? otcCompletedVolAgg._count : 0,
                    activeEscrows: otcActiveCount,
                    completedVolumeUsdt: Number(otcCompletedVolAgg._sum?.cryptoAmount || 0).toFixed(2),
                    bankCommissionUsdt: revMod?.otcPlatformFeeUsdt || '0.00',
                    brokerCommissionUsdt: revMod?.otcBrokerCommissionUsdt || '0.00',
                    swapSpreadUsd: revMod?.swapSpreadFeeTotalUsd || '0.00',
                },
                p2p: {
                    verifiedMerchants: p2pMerchantsCount,
                    activeOffers: p2pStatsRows,
                    completedOrders: typeof p2pCompletedOrdersAgg._count === 'number' ? p2pCompletedOrdersAgg._count : 0,
                    activeEscrowOrders: p2pActiveOrdersCount,
                    disputedOrders: p2pDisputedCount,
                    completedVolumeUsdt: Number(p2pCompletedOrdersAgg._sum?.cryptoAmount || 0).toFixed(2),
                    feesUsdEq: revMod?.p2pFeeUsdEq || '0.00',
                    promoFeesUsd: revMod?.p2pPromotionFeeTotal || '0.00',
                },
                packages: {
                    totalPackages,
                    activePackages: activePackages.length,
                    uniqueInvestorsCount: fdDistinctUsers.length,
                    activeCapitalUsd: activeCapital.toFixed(2),
                    totalYieldsPaidUsd: Number(fdYieldsPaidAgg._sum?.returnAmount || 0).toFixed(2),
                    yieldDueCount: commandCenter?.yieldDueCount ?? 0,
                    maturedUnsettledCount: commandCenter?.maturedUnsettledCount ?? 0,
                },
                venture: {
                    publishedCampaigns: totalStartups,
                    totalCommitments: realVentureRows.length,
                    uniqueInvestorsCount: uniqueVentureInvestors,
                    totalNetInvestedUsd: totalVentureCommittedUsd.toFixed(2),
                    mockDisplayCommitmentsCount: mockVentureRows.length,
                    mockDisplayVolumeUsd: mockVentureVolumeUsd.toFixed(2),
                    headlineDisplayDeltaUsd: headlineDisplayDeltaUsd.toFixed(2),
                    allocationFeeUsd: revMod?.ventureAllocationFeeUsd || '0.00',
                    profitShareFeeUsd: revMod?.ventureProfitShareFeeUsd || '0.00',
                },
                token: {
                    livePriceUsd: Number(tokenPolicy.currentPriceUsd.toString()),
                    lockinDays: tokenPolicy.lockinDays,
                    redemptionEnabled: tokenPolicy.redemptionEnabled,
                    unlockAllNow: tokenPolicy.unlockAllNow,
                    paidHoldersCount: tokenPaidHolders,
                    whitelistOnlyCount: tokenWhitelistOnly,
                    totalTokensAllocated,
                    totalPaidUsd: totalTokenPaidUsd.toFixed(2),
                    currentLiabilityUsd: (totalTokensAllocated * Number(tokenPolicy.currentPriceUsd.toString())).toFixed(2),
                },
            };
            const newsletterSubscribersCount = await prisma_1.prisma.inquiry
                .count({ where: { subject: { startsWith: 'NEWSLETTER:' } } })
                .catch(() => 0);
            const payloadData = {
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
                totalOtcDesks,
                totalOtcTrades,
                newsletterSubscribersCount,
                commandCenter,
                platformRevenueSummary,
                sectionMetrics,
            };
            globalThis.__avoraLastOverviewAnalytics = payloadData;
            globalThis.__avoraLastOverviewTime = Date.now();
            res.json({
                success: true,
                data: payloadData,
            });
        }
        catch (err) {
            if (globalThis.__avoraLastOverviewAnalytics) {
                return res.json({
                    success: true,
                    data: globalThis.__avoraLastOverviewAnalytics,
                    cachedFallback: true,
                });
            }
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
            const customRef = txHashOrRef?.trim();
            if (customRef) {
                await ledger_service_1.ledgerService.assertUniqueTxReference(customRef);
            }
            const finalHash = customRef || `MAN-${depositCode}`;
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
    /**
     * Admin: List all OTC Desks with location metadata, security deposits, and summary KPIs
     */
    async getOtcDesks(req, res, next) {
        try {
            const { status, search } = req.query;
            const result = await otc_service_1.otcService.getAllDesksAdmin({
                status: typeof status === 'string' ? status : undefined,
                search: typeof search === 'string' ? search : undefined,
            });
            res.json({
                success: true,
                data: result,
                desks: result.desks,
                summary: result.summary,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Update OTC Desk status, location/landmark, margins, or refund/forfeit $1,000 security deposit
     */
    async updateOtcDesk(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const deskId = String(req.params.id);
            const updated = await otc_service_1.otcService.updateDeskAdmin(adminUserId, deskId, req.body || {});
            res.json({
                success: true,
                message: `OTC Desk ${updated.deskCode} updated (${updated.status}).`,
                data: updated,
            });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message || 'Failed to update OTC desk' });
        }
    }
    /**
     * Admin: List all OTC Escrow Trades across all desks with chat history
     */
    async getOtcTrades(req, res, next) {
        try {
            const { status, search } = req.query;
            const trades = await otc_service_1.otcService.getAllTradesAdmin({
                status: typeof status === 'string' ? status : undefined,
                search: typeof search === 'string' ? search : undefined,
            });
            res.json({
                success: true,
                data: trades,
                trades,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Resolve or Force-Settle an IN_PROGRESS or DISPUTED OTC Trade
     */
    async resolveOtcTrade(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : 'SYSTEM_ADMIN';
            const tradeId = String(req.params.id);
            const { resolution, reason } = req.body || {};
            const trade = await otc_service_1.otcService.resolveTradeAdmin(adminUserId, tradeId, resolution, reason);
            res.json({
                success: true,
                message: `OTC Trade ${trade.tradeCode} resolved (${resolution} -> ${trade.status}).`,
                data: trade,
            });
        }
        catch (err) {
            res.status(400).json({ success: false, message: err.message || 'Failed to resolve OTC trade' });
        }
    }
    /**
     * Admin: List all pre-trade OTC Desk inquiries across all desks
     */
    async getOtcInquiries(req, res, next) {
        try {
            const inquiries = await otc_service_1.otcService.getAllInquiriesAdmin();
            res.json({ success: true, data: inquiries, inquiries });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Get live exchange rates, market benchmark rates, active admin overrides & commission config
     */
    async getExchangeRates(req, res, next) {
        try {
            const [overview, feeSettings] = await Promise.all([
                rate_service_1.rateService.getAdminRatesOverview(),
                prisma_1.prisma.cmsSetting.findMany({
                    where: {
                        key: {
                            in: [
                                'otc_operator_fee_percent',
                                'otc_platform_fee_percent',
                                'withdrawal_fee_percent',
                                'withdrawal_fx_spread_percent',
                                'remittance_fee_percent',
                                'remittance_margin_percent',
                            ],
                        },
                    },
                }),
            ]);
            const settingsMap = {};
            feeSettings.forEach((s) => {
                settingsMap[s.key] = s.value;
            });
            const operatorFeePct = parseFloat(settingsMap['otc_operator_fee_percent'] || '1.5');
            const platformFeePct = parseFloat(settingsMap['otc_platform_fee_percent'] || '0.5');
            res.json({
                success: true,
                data: {
                    ...overview,
                    pricing: {
                        otcOperatorFeePct: operatorFeePct,
                        otcPlatformFeePct: platformFeePct,
                        otcTotalFeePct: Number((operatorFeePct + platformFeePct).toFixed(4)),
                        withdrawalFeePct: parseFloat(settingsMap['withdrawal_fee_percent'] || '0.0'),
                        withdrawalFxSpreadPct: parseFloat(settingsMap['withdrawal_fx_spread_percent'] || '0.0'),
                        remittanceFeePct: parseFloat(settingsMap['remittance_fee_percent'] || '3.0'),
                        remittanceMarginPct: parseFloat(settingsMap['remittance_margin_percent'] || '2.0'),
                    },
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Update real-time currency exchange rate overrides (for Remittance, OTC, P2P & Withdrawals)
     */
    async updateExchangeRates(req, res, next) {
        try {
            const adminUserId = req.user?.id ? String(req.user.id) : undefined;
            const { overrides, replaceAll, syncHouseP2pOffers } = req.body || {};
            if (!overrides || typeof overrides !== 'object') {
                return res.status(400).json({ success: false, message: 'Exchange rate overrides map is required' });
            }
            const updated = await rate_service_1.rateService.updateAdminRateOverrides(overrides, Boolean(replaceAll));
            // Optionally sync default Avora house P2P offers when admin sets a new reference rate
            let syncedOffersCount = 0;
            if (syncHouseP2pOffers !== false) {
                const touchedCurrencies = Object.keys(overrides).map((c) => c.trim().toUpperCase()).filter(Boolean);
                if (touchedCurrencies.length > 0) {
                    const houseOffers = await prisma_1.prisma.p2POffer.findMany({
                        where: {
                            offerCode: { startsWith: 'OFF-' },
                            fiatCurrency: { in: touchedCurrencies },
                            user: { email: { endsWith: '@avorabank.com' } },
                            status: 'OPEN',
                        },
                    });
                    for (const offer of houseOffers) {
                        const effectiveRate = updated.rates[offer.fiatCurrency];
                        if (!effectiveRate || effectiveRate <= 0)
                            continue;
                        // Maintain small market-making spread around Admin rate (BUY ads +0.5%, SELL ads -0.5%)
                        const nextPrice = offer.side === 'BUY'
                            ? new decimal_js_1.default(effectiveRate).times('1.005')
                            : new decimal_js_1.default(effectiveRate).times('0.995');
                        await prisma_1.prisma.p2POffer.update({
                            where: { id: offer.id },
                            data: { price: nextPrice.toFixed(4) },
                        });
                        syncedOffersCount += 1;
                    }
                }
            }
            await prisma_1.prisma.adminAuditLog.create({
                data: {
                    userId: adminUserId,
                    action: 'UPDATE_EXCHANGE_RATES',
                    entity: 'CmsSetting',
                    details: JSON.stringify({
                        updatedOverrides: overrides,
                        replaceAll: Boolean(replaceAll),
                        syncedOffersCount,
                    }),
                },
            });
            res.json({
                success: true,
                message: `Live platform exchange rates updated (${Object.keys(updated.overrides).length} active overrides${syncedOffersCount ? `, synced ${syncedOffersCount} house P2P ads` : ''}).`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Force refresh upstream market exchange rate feed while preserving admin overrides
     */
    async refreshExchangeRates(req, res, next) {
        try {
            const updated = await rate_service_1.rateService.forceRefreshMarketRates();
            res.json({
                success: true,
                message: 'Live upstream market exchange rates refreshed.',
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Unified Transaction ID & Reference Search / Investigation
     * Searches Ledger Transactions, Deposits, Withdrawals, FD Packages,
     * Startup Commitments, P2P Orders, OTC Trades, Remittances & Audit Logs.
     */
    async lookupTransaction(req, res, next) {
        try {
            const q = String(req.query.q || '').trim();
            if (q.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter at least 2 characters of a Transaction ID, Reference, or Order Code.',
                });
            }
            const userSelect = {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                displayName: true,
                country: true,
                kycStatus: true,
                status: true,
            };
            const [ledgerTxs, deposits, withdrawals, packages, rawCommitments, p2pOrders, otcTrades, remittances,] = await Promise.all([
                prisma_1.prisma.transaction.findMany({
                    where: {
                        OR: [
                            { transactionCode: { contains: q } },
                            { settlementReference: { contains: q } },
                            { id: q },
                        ],
                    },
                    include: {
                        user: { select: userSelect },
                        package: {
                            select: {
                                id: true,
                                packageCode: true,
                                amount: true,
                                currency: true,
                                status: true,
                                lockInStart: true,
                                lockInEnd: true,
                                depositMethod: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 25,
                }),
                prisma_1.prisma.depositRequest.findMany({
                    where: {
                        OR: [
                            { depositCode: { contains: q } },
                            { txHashOrRef: { contains: q } },
                            { id: q },
                        ],
                    },
                    include: { user: { select: userSelect } },
                    orderBy: { createdAt: 'desc' },
                    take: 25,
                }),
                prisma_1.prisma.withdrawalRequest.findMany({
                    where: {
                        OR: [
                            { requestCode: { contains: q } },
                            { settlementReference: { contains: q } },
                            { id: q },
                        ],
                    },
                    include: {
                        user: { select: userSelect },
                        package: { select: { id: true, packageCode: true, status: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 25,
                }),
                prisma_1.prisma.investmentPackage.findMany({
                    where: {
                        OR: [{ packageCode: { contains: q } }, { id: q }],
                    },
                    include: {
                        user: { select: userSelect },
                        returns: { orderBy: { periodIndex: 'asc' } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                }),
                prisma_1.prisma.investmentCommitment.findMany({
                    where: {
                        OR: [
                            { investmentCode: { contains: q } },
                            { settlementReference: { contains: q } },
                            { id: q },
                        ],
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                }),
                prisma_1.prisma.p2POrder.findMany({
                    where: {
                        OR: [
                            { orderCode: { contains: q } },
                            { paymentReference: { contains: q } },
                            { id: q },
                        ],
                    },
                    include: {
                        buyer: { select: userSelect },
                        seller: { select: userSelect },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                }),
                prisma_1.prisma.otcTrade.findMany({
                    where: {
                        OR: [{ tradeCode: { contains: q } }, { id: q }],
                    },
                    include: {
                        customer: { select: userSelect },
                        operator: { select: userSelect },
                        desk: { select: { id: true, deskCode: true, deskName: true, city: true, country: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                }),
                prisma_1.prisma.globalTransfer.findMany({
                    where: {
                        OR: [{ transferCode: { contains: q } }, { id: q }],
                    },
                    include: { user: { select: userSelect } },
                    orderBy: { createdAt: 'desc' },
                    take: 15,
                }),
            ]);
            // Cross-link INV-* references found inside matched Ledger Transactions
            const linkedInvCodes = Array.from(new Set(ledgerTxs
                .map((t) => t.settlementReference)
                .filter((r) => Boolean(r && /^INV-/i.test(r)))));
            const rawLinkedCommitments = linkedInvCodes.length > 0
                ? await prisma_1.prisma.investmentCommitment
                    .findMany({
                    where: { investmentCode: { in: linkedInvCodes } },
                })
                    .catch(() => [])
                : [];
            const searchListingIds = Array.from(new Set([...rawCommitments, ...rawLinkedCommitments]
                .map((c) => c.listingId)
                .filter(Boolean)));
            const searchInvestorIds = Array.from(new Set(rawCommitments.map((c) => c.investorUserId).filter(Boolean)));
            const [searchListings, searchInvestors] = await Promise.all([
                searchListingIds.length > 0
                    ? prisma_1.prisma.startupListing
                        .findMany({
                        where: { id: { in: searchListingIds } },
                        select: {
                            id: true,
                            slug: true,
                            companyName: true,
                            industry: true,
                            stage: true,
                            country: true,
                            lockInMonths: true,
                            maturityDate: true,
                        },
                    })
                        .catch(() => [])
                    : Promise.resolve([]),
                searchInvestorIds.length > 0
                    ? prisma_1.prisma.user
                        .findMany({
                        where: { id: { in: searchInvestorIds } },
                        select: userSelect,
                    })
                        .catch(() => [])
                    : Promise.resolve([]),
            ]);
            const searchListingMap = new Map(searchListings.map((l) => [l.id, l]));
            const searchInvestorMap = new Map(searchInvestors.map((u) => [u.id, u]));
            const commitments = rawCommitments.map((c) => ({
                ...c,
                investor: searchInvestorMap.get(c.investorUserId) || null,
                listing: searchListingMap.get(c.listingId) || null,
            }));
            const linkedCommitments = rawLinkedCommitments.map((c) => ({
                ...c,
                listing: searchListingMap.get(c.listingId) || null,
            }));
            const invByCode = new Map(linkedCommitments.map((c) => [c.investmentCode, c]));
            // Cross-check if ledgerTxs have sibling entries with same settlementReference
            const allRefs = Array.from(new Set([
                q,
                ...ledgerTxs.map((t) => t.transactionCode),
                ...ledgerTxs.map((t) => t.settlementReference).filter((x) => Boolean(x)),
                ...deposits.map((d) => d.depositCode),
                ...withdrawals.map((w) => w.requestCode),
                ...packages.map((p) => p.packageCode),
                ...commitments.map((c) => c.investmentCode),
                ...p2pOrders.map((o) => o.orderCode),
                ...otcTrades.map((t) => t.tradeCode),
                ...remittances.map((r) => r.transferCode),
            ]));
            const allEntityIds = Array.from(new Set([
                ...ledgerTxs.map((t) => t.id),
                ...deposits.map((d) => d.id),
                ...withdrawals.map((w) => w.id),
                ...packages.map((p) => p.id),
                ...commitments.map((c) => c.id),
                ...p2pOrders.map((o) => o.id),
                ...otcTrades.map((t) => t.id),
                ...remittances.map((r) => r.id),
            ]));
            const relatedAuditLogs = await prisma_1.prisma.adminAuditLog.findMany({
                where: {
                    OR: [
                        ...(allEntityIds.length > 0 ? [{ entityId: { in: allEntityIds } }] : []),
                        ...allRefs.slice(0, 8).map((ref) => ({ details: { contains: ref } })),
                    ],
                },
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 30,
            });
            const formatUser = (u) => u
                ? {
                    id: u.id,
                    name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
                    email: u.email,
                    phone: u.phone || null,
                    accountNumber: (0, p2p_service_1.generateAvoraAccountNumber)(u.id),
                    country: u.country || null,
                    kycStatus: u.kycStatus,
                    status: u.status,
                }
                : null;
            const results = [];
            for (const tx of ledgerTxs) {
                const linkedInv = tx.settlementReference ? invByCode.get(tx.settlementReference) : undefined;
                const isCompleted = tx.status === 'COMPLETED';
                const isPending = tx.status === 'PENDING';
                results.push({
                    recordKind: 'LEDGER_TRANSACTION',
                    recordLabel: 'Double-Entry Ledger Transaction',
                    id: tx.id,
                    primaryCode: tx.transactionCode,
                    secondaryRef: tx.settlementReference || tx.package?.packageCode || null,
                    title: `${tx.type.replace(/_/g, ' ')}${linkedInv?.listing?.companyName ? ` — ${linkedInv.listing.companyName}` : tx.package ? ` — ${tx.package.packageCode}` : ''}`,
                    currentStatus: tx.status,
                    paymentStatus: isCompleted
                        ? 'Payment & Double-Entry Ledger Completed'
                        : isPending
                            ? 'Ledger Entry Pending Final Settlement'
                            : `Transaction ${tx.status}`,
                    pendingReason: isPending
                        ? 'Double-entry posting is awaiting upstream confirmation or clearing.'
                        : isCompleted
                            ? 'No hold — funds movement was posted to user wallet balances.'
                            : `Marked as ${tx.status}.`,
                    adminActionRequired: isPending,
                    adminActionSummary: isPending
                        ? 'Verify underlying deposit/withdrawal/escrow record before manual intervention.'
                        : 'No Admin action required — transaction already completed and reconciled in ledger.',
                    targetTab: linkedInv
                        ? 'investments'
                        : tx.package
                            ? 'packages'
                            : tx.type.includes('DEPOSIT')
                                ? 'deposits'
                                : tx.type.includes('WITHDRAWAL')
                                    ? 'withdrawals'
                                    : 'users',
                    amount: Number(tx.amount),
                    currency: tx.currency,
                    balanceBefore: Number(tx.balanceBefore),
                    balanceAfter: Number(tx.balanceAfter),
                    notes: tx.notes || null,
                    createdAt: tx.createdAt,
                    user: formatUser(tx.user),
                    linkedContext: linkedInv
                        ? {
                            type: 'STARTUP_INVESTMENT',
                            investmentCode: linkedInv.investmentCode,
                            companyName: linkedInv.listing?.companyName,
                            netInvestedAmount: Number(linkedInv.netInvestedAmount),
                            allocationFeeAmount: Number(linkedInv.allocationFeeAmount),
                            currentValuation: linkedInv.currentValuation ? Number(linkedInv.currentValuation) : Number(linkedInv.netInvestedAmount),
                            status: linkedInv.status,
                        }
                        : tx.package
                            ? {
                                type: 'FD_PACKAGE',
                                packageCode: tx.package.packageCode,
                                amount: Number(tx.package.amount),
                                status: tx.package.status,
                                lockInStart: tx.package.lockInStart,
                                lockInEnd: tx.package.lockInEnd,
                            }
                            : null,
                    timeline: [
                        { label: 'Created & Posted By', detail: tx.createdBy || 'SYSTEM', at: tx.createdAt },
                        ...(linkedInv
                            ? [{ label: 'Linked Startup Commitment', detail: `${linkedInv.investmentCode} • ${linkedInv.listing?.companyName || ''} (${linkedInv.status})`, at: linkedInv.createdAt }]
                            : []),
                    ],
                });
            }
            for (const dep of deposits) {
                const hasProof = Boolean(dep.proofUrl || (dep.txHashOrRef && dep.txHashOrRef.trim() && dep.txHashOrRef.trim().toLowerCase() !== 'none'));
                const isPending = dep.status === 'PENDING';
                results.push({
                    recordKind: 'DEPOSIT',
                    recordLabel: 'Customer Deposit Request',
                    id: dep.id,
                    primaryCode: dep.depositCode,
                    secondaryRef: dep.txHashOrRef || null,
                    title: `${Number(dep.amount).toLocaleString()} ${dep.currency} Deposit via ${dep.depositMethod}`,
                    currentStatus: dep.status,
                    paymentStatus: dep.status === 'APPROVED'
                        ? 'Payment Verified & Wallet Credited'
                        : dep.status === 'REJECTED'
                            ? 'Deposit Rejected (No Credit)'
                            : hasProof
                                ? `Payment Proof / Ref Submitted (${dep.txHashOrRef || 'Screenshot Attached'}) — Awaiting Admin Verification`
                                : 'No Gateway Capture / Payment Proof Submitted Yet',
                    pendingReason: isPending
                        ? hasProof
                            ? 'Waiting for Admin to inspect the submitted bank wire/crypto hash/Razorpay proof and click Approve.'
                            : 'User initiated a deposit request without uploading a transaction reference or proof (possible checkout drop-off or unpaid wire).'
                        : dep.status === 'APPROVED'
                            ? 'None — deposit approved and credited.'
                            : `Rejected${dep.reviewedBy ? ` by ${dep.reviewedBy}` : ''}.`,
                    adminActionRequired: isPending,
                    adminActionSummary: isPending
                        ? 'Action Required: Open Deposits tab, verify the gateway/bank reference & proof, and Approve or Reject.'
                        : `No Admin action pending — already ${dep.status}.`,
                    targetTab: 'deposits',
                    amount: Number(dep.amount),
                    currency: dep.currency,
                    notes: dep.adminNotes || null,
                    proofUrl: dep.proofUrl || null,
                    createdAt: dep.createdAt,
                    user: formatUser(dep.user),
                    timeline: [
                        { label: 'Deposit Requested', detail: `Method: ${dep.depositMethod}${dep.txHashOrRef ? ` • Ref: ${dep.txHashOrRef}` : ''}`, at: dep.createdAt },
                        ...(dep.reviewedAt
                            ? [{ label: `Deposit ${dep.status}`, detail: `Reviewed by ${dep.reviewedBy || 'Admin'}`, at: dep.reviewedAt }]
                            : []),
                    ],
                });
            }
            for (const w of withdrawals) {
                const isPending = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(w.status);
                results.push({
                    recordKind: 'WITHDRAWAL',
                    recordLabel: 'Withdrawal Settlement Request',
                    id: w.id,
                    primaryCode: w.requestCode,
                    secondaryRef: w.settlementReference || w.package?.packageCode || null,
                    title: `${Number(w.amount).toLocaleString()} ${w.currency} Withdrawal (${w.payoutMethod.replace(/_/g, ' ')})`,
                    currentStatus: w.status,
                    paymentStatus: w.status === 'SETTLED'
                        ? `Payout Settled (Ref: ${w.settlementReference || 'Recorded'})`
                        : w.status === 'REJECTED'
                            ? 'Rejected & Balance Refunded to User Wallet'
                            : 'Funds Reserved in Pending Settlement Queue (Awaiting Admin Payout Execution)',
                    pendingReason: isPending
                        ? `Withdrawal is in ${w.status} stage within the 15-day settlement queue awaiting Admin bank/crypto transfer & settlement reference entry.`
                        : w.status === 'SETTLED'
                            ? 'None — payout completed.'
                            : 'Rejected and refunded to user wallet.',
                    adminActionRequired: isPending,
                    adminActionSummary: isPending
                        ? 'Action Required: Open Settlement Queue (Withdrawals tab), execute payout, and click Settle & Record Payout (or Reject).'
                        : `No Admin action pending — ${w.status}.`,
                    targetTab: 'withdrawals',
                    amount: Number(w.amount),
                    currency: w.currency,
                    notes: w.adminNotes || null,
                    createdAt: w.createdAt,
                    user: formatUser(w.user),
                    timeline: [
                        { label: 'Withdrawal Requested', detail: `Type: ${w.withdrawalType} • Queue Window: ${new Date(w.requestWindowDate).toLocaleDateString()}`, at: w.createdAt },
                        ...(w.settledAt
                            ? [{ label: 'Payout Settled', detail: `Settlement Ref: ${w.settlementReference || 'N/A'}`, at: w.settledAt }]
                            : []),
                    ],
                });
            }
            for (const pkg of packages) {
                const isPending = pkg.status === 'PENDING_PAYMENT';
                results.push({
                    recordKind: 'FD_PACKAGE',
                    recordLabel: 'Fixed Deposit Package',
                    id: pkg.id,
                    primaryCode: pkg.packageCode,
                    secondaryRef: pkg.depositMethod || null,
                    title: `${Number(pkg.amount).toLocaleString()} ${pkg.currency} Fixed Deposit (${pkg.lockInMonths}m Lock)`,
                    currentStatus: pkg.status,
                    paymentStatus: isPending
                        ? 'Awaiting Admin Payment Confirmation & FD Activation'
                        : 'Funded & Active / Matured Contract',
                    pendingReason: isPending
                        ? 'Package purchase awaiting Admin verification of funding.'
                        : pkg.status === 'ACTIVE'
                            ? `Active ${pkg.lockInMonths}-month lock-in; monthly yields Paid: ${pkg.returns?.length || 0}/${pkg.lockInMonths}.`
                            : `Contract status is ${pkg.status}.`,
                    adminActionRequired: isPending || pkg.status === 'MATURED',
                    adminActionSummary: isPending
                        ? 'Action Required: Verify payment and Approve & Activate in Packages & Yields tab.'
                        : 'Manage monthly yield credits or full settlement in Packages & Yields tab.',
                    targetTab: 'packages',
                    amount: Number(pkg.amount),
                    currency: pkg.currency,
                    notes: pkg.adminNotes || null,
                    createdAt: pkg.createdAt,
                    user: formatUser(pkg.user),
                    timeline: [
                        { label: 'Package Created', detail: `${Number(pkg.amount).toLocaleString()} ${pkg.currency} • ${pkg.lockInMonths} Months`, at: pkg.createdAt },
                        ...(pkg.lockInStart ? [{ label: 'Lock-In Activated', detail: `Ends ${pkg.lockInEnd ? new Date(pkg.lockInEnd).toLocaleDateString() : '6m'}`, at: pkg.lockInStart }] : []),
                    ],
                });
            }
            for (const inv of commitments) {
                const srcTag = inv.sourceType === 'ADMIN_DISPLAY_MOCK'
                    ? 'ADMIN DISPLAY / MOCK (Unbacked)'
                    : inv.sourceType === 'ADMIN_EXTERNAL_VERIFIED'
                        ? 'EXTERNAL SETTLED (No Wallet Debit)'
                        : 'REAL WALLET LEDGER';
                results.push({
                    recordKind: 'STARTUP_INVESTMENT',
                    recordLabel: `Startup Crowdfunding Commitment · ${srcTag}`,
                    id: inv.id,
                    primaryCode: inv.investmentCode,
                    secondaryRef: inv.settlementReference || inv.listing?.companyName || null,
                    title: `${inv.listing?.companyName || 'Startup Round'} (${inv.instrument}) [${srcTag}]`,
                    currentStatus: inv.status,
                    paymentStatus: inv.sourceType === 'ADMIN_DISPLAY_MOCK'
                        ? `Display / Mock Only ($${Number(inv.netInvestedAmount).toFixed(2)}) — Not Debited From Any Wallet`
                        : inv.sourceType === 'ADMIN_EXTERNAL_VERIFIED'
                            ? `External Bank / SPV Settled ($${Number(inv.netInvestedAmount).toFixed(2)} Net) — No Platform Wallet Debit`
                            : `Paid From Available USD Wallet ($${Number(inv.netInvestedAmount).toFixed(2)} Net + $${Number(inv.allocationFeeAmount).toFixed(2)} Fee = $${Number(inv.grossAmount).toFixed(2)} Gross)`,
                    pendingReason: inv.status === 'EXITED'
                        ? `Exited & distributed $${Number(inv.realizedProceeds).toFixed(2)} USD back to investor.`
                        : `Active nominee holding in ${inv.listing?.companyName || 'round'} (Realized proceeds so far: $${Number(inv.realizedProceeds).toFixed(2)}).`,
                    adminActionRequired: false,
                    adminActionSummary: 'No pending collection action — valuation updates or exit distributions can be executed in Startup Portfolios.',
                    targetTab: 'investments',
                    amount: Number(inv.netInvestedAmount),
                    currency: 'USD',
                    notes: inv.notes || null,
                    createdAt: inv.createdAt,
                    user: formatUser(inv.investor),
                    timeline: [
                        { label: 'Commitment Allocated', detail: `${inv.listing?.companyName || ''} • $${Number(inv.netInvestedAmount).toFixed(2)} net`, at: inv.createdAt },
                        ...(inv.maturedAt ? [{ label: 'Exited / Distributed', detail: `Proceeds: $${Number(inv.realizedProceeds).toFixed(2)}`, at: inv.maturedAt }] : []),
                    ],
                });
            }
            for (const o of p2pOrders) {
                const needsRuling = ['DISPUTED', 'FROZEN'].includes(o.status) || o.isFrozen;
                const inProgress = ['PENDING', 'ACCEPTED', 'PENDING_PAYMENT', 'PAYMENT_SENT', 'SELLER_CONFIRMING'].includes(o.status);
                results.push({
                    recordKind: 'P2P_ORDER',
                    recordLabel: 'P2P Marketplace Escrow Order',
                    id: o.id,
                    primaryCode: o.orderCode,
                    secondaryRef: o.paymentReference || null,
                    title: `${Number(o.cryptoAmount).toFixed(2)} ${o.cryptoCurrency} ↔ ${Number(o.fiatAmount).toLocaleString()} ${o.fiatCurrency}`,
                    currentStatus: o.status,
                    paymentStatus: o.status === 'COMPLETED'
                        ? 'Fiat Confirmed & Escrow Crypto Released'
                        : o.paidAt
                            ? `Buyer Marked Paid (${o.selectedPaymentMethod || 'Rail'}) — Awaiting Seller Release / Ruling`
                            : 'Awaiting Counterparty Acceptance / Fiat Payment',
                    pendingReason: needsRuling
                        ? `Order is ${o.status}${o.disputeReason ? `: ${o.disputeReason}` : ' — requires Admin Dispute Resolution.'}`
                        : inProgress
                            ? 'Live escrow order awaiting buyer payment or seller confirmation.'
                            : `Order finalized as ${o.status}.`,
                    adminActionRequired: needsRuling,
                    adminActionSummary: needsRuling
                        ? 'Action Required: Review payment proof & chat in P2P Escrow tab and issue a dispute ruling.'
                        : 'No Admin action needed unless escalated to dispute.',
                    targetTab: 'p2p',
                    amount: Number(o.cryptoAmount),
                    currency: o.cryptoCurrency,
                    createdAt: o.createdAt,
                    user: formatUser(o.buyer),
                    counterparty: formatUser(o.seller),
                    timeline: [
                        { label: 'Order Opened', detail: `Buyer: ${o.buyer?.email} • Seller: ${o.seller?.email}`, at: o.createdAt },
                        ...(o.acceptedAt ? [{ label: 'Accepted by Counterparty', detail: o.status, at: o.acceptedAt }] : []),
                        ...(o.paidAt ? [{ label: 'Buyer Marked Payment Sent', detail: o.paymentReference || 'Proof uploaded', at: o.paidAt }] : []),
                        ...(o.completedAt ? [{ label: 'Escrow Released / Closed', detail: o.status, at: o.completedAt }] : []),
                    ],
                });
            }
            for (const t of otcTrades) {
                const needsRuling = t.status === 'DISPUTED';
                results.push({
                    recordKind: 'OTC_TRADE',
                    recordLabel: 'OTC Desk Escrow Trade',
                    id: t.id,
                    primaryCode: t.tradeCode,
                    secondaryRef: t.desk?.deskCode || null,
                    title: `${t.tradeType} • ${Number(t.cryptoAmount).toFixed(2)} USDT @ ${t.desk?.deskName || 'OTC Desk'}`,
                    currentStatus: t.status,
                    paymentStatus: t.status === 'COMPLETED'
                        ? 'OTC Trade Settled & Commissions Posted'
                        : t.escrowLocked
                            ? 'USDT Locked in OTC Desk Escrow'
                            : `Trade ${t.status}`,
                    pendingReason: needsRuling
                        ? `Disputed OTC trade${t.disputeReason ? `: ${t.disputeReason}` : ''}.`
                        : t.status === 'IN_PROGRESS'
                            ? 'In-person/desk settlement in progress with OTC operator.'
                            : `Trade finalized (${t.status}).`,
                    adminActionRequired: needsRuling,
                    adminActionSummary: needsRuling
                        ? 'Action Required: Resolve OTC Escrow Dispute in OTC Desks & Trades tab.'
                        : 'Managed between Customer and Desk Operator unless disputed.',
                    targetTab: 'otc',
                    amount: Number(t.cryptoAmount),
                    currency: 'USDT',
                    createdAt: t.createdAt,
                    user: formatUser(t.customer),
                    counterparty: formatUser(t.operator),
                    timeline: [
                        { label: 'OTC Trade Initiated', detail: `${t.desk?.deskName || ''} (${t.desk?.city || ''})`, at: t.createdAt },
                        ...(t.completedAt ? [{ label: 'Trade Settled', detail: t.status, at: t.completedAt }] : []),
                    ],
                });
            }
            for (const r of remittances) {
                const isPending = ['SUBMITTED', 'COMPLIANCE_SCREENED', 'PROCESSING'].includes(r.status);
                results.push({
                    recordKind: 'REMITTANCE',
                    recordLabel: 'Global Remittance Transfer',
                    id: r.id,
                    primaryCode: r.transferCode,
                    secondaryRef: r.recipientBankName || null,
                    title: `${Number(r.sendingAmount).toLocaleString()} ${r.sendingCurrency} → ${Number(r.recipientAmount).toLocaleString()} ${r.recipientCurrency} (${r.destinationCountry})`,
                    currentStatus: r.status,
                    paymentStatus: r.status === 'COMPLETED'
                        ? 'Sender Debited & Remittance Wire Completed'
                        : isPending
                            ? 'Sender Balance Debited — Awaiting Bank/Corridor Dispatch by Admin'
                            : `Remittance ${r.status}`,
                    pendingReason: isPending
                        ? `Transfer is ${r.status} awaiting Admin corridor processing and completion.`
                        : r.status === 'REJECTED'
                            ? `Rejected: ${r.rejectionReason || 'Compliance / bank detail issue'}.`
                            : 'Completed.',
                    adminActionRequired: isPending,
                    adminActionSummary: isPending
                        ? 'Action Required: Process / Update Remittance Transfer status in Remittance Transfers tab.'
                        : 'No Admin action pending.',
                    targetTab: 'remittance',
                    amount: Number(r.totalPaidAmount),
                    currency: r.sendingCurrency,
                    notes: r.complianceNotes || r.rejectionReason || null,
                    createdAt: r.createdAt,
                    user: formatUser(r.user),
                    timeline: [
                        { label: 'Transfer Submitted', detail: `Recipient: ${r.recipientName} • ${r.recipientBankName}`, at: r.createdAt },
                        ...(r.completedAt ? [{ label: 'Wire Completed', detail: r.status, at: r.completedAt }] : []),
                    ],
                });
            }
            res.json({
                success: true,
                data: {
                    query: q,
                    totalMatches: results.length,
                    results,
                    auditLogs: relatedAuditLogs.map((l) => ({
                        id: l.id,
                        action: l.action,
                        entity: l.entity,
                        entityId: l.entityId,
                        details: l.details,
                        adminEmail: l.user?.email || 'SYSTEM',
                        createdAt: l.createdAt,
                    })),
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/admin/liquidity-risk
     * Real-time Platform Liquidity, Exposure, Cost-Basis P&L Risk, Pending Swap Queue & Audit Trail
     */
    async getLiquidityRiskOverview(req, res, next) {
        try {
            const data = await liquidityRisk_service_1.liquidityRiskService.getLiquidityAndExposureOverview();
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/liquidity-risk/config
     * Update Swap Permissions, Disabled Pairs, Risk Limits & Per-Asset Thresholds
     */
    async updateLiquidityRiskConfig(req, res, next) {
        try {
            const adminId = req.user.id;
            const updated = await liquidityRisk_service_1.liquidityRiskService.updateConfig(req.body || {}, adminId);
            res.json({
                success: true,
                message: 'Liquidity & Swap Risk Governance rules updated.',
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/liquidity-risk/swaps/:id/approve
     */
    async approveSwapRequest(req, res, next) {
        try {
            const adminId = req.user.id;
            const swapId = String(req.params.id);
            const adminNotes = req.body?.adminNotes || req.body?.notes || req.body?.reason;
            const customEffectiveRate = req.body?.customEffectiveRate;
            const result = await liquidityRisk_service_1.liquidityRiskService.approveQueuedSwap(swapId, adminId, adminNotes, customEffectiveRate);
            res.json({
                success: true,
                message: `Swap ${result.swapRequest.requestCode} approved and settled (${result.execution.transactionCode}) at rate 1 ${result.execution.fromCurrency} = ${result.execution.rate} ${result.execution.toCurrency}.`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/liquidity-risk/swaps/:id/reject
     */
    async rejectSwapRequest(req, res, next) {
        try {
            const adminId = req.user.id;
            const swapId = String(req.params.id);
            const reason = req.body?.reason || req.body?.notes || req.body?.adminNotes;
            const updated = await liquidityRisk_service_1.liquidityRiskService.rejectQueuedSwap(swapId, adminId, reason);
            res.json({
                success: true,
                message: `Swap ${updated.requestCode} rejected and held balance unlocked to user.`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/users/:id/swap-override
     */
    async updateUserSwapOverride(req, res, next) {
        try {
            const adminId = req.user.id;
            const targetUserId = String(req.params.id);
            const override = req.body || {};
            const updated = await liquidityRisk_service_1.liquidityRiskService.updateConfig({ perUserOverrides: { [targetUserId]: override } }, adminId);
            res.json({
                success: true,
                message: 'User-level swap risk override saved.',
                data: updated.perUserOverrides[targetUserId] || null,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/admin/feature-controls
     * Central Feature Control Registry + Summary + Change Audit History
     */
    async getFeatureControls(req, res, next) {
        try {
            const [overview, history] = await Promise.all([
                featureControl_service_1.featureControlService.getAllFeatures(),
                featureControl_service_1.featureControlService.getHistory(150),
            ]);
            res.json({
                success: true,
                data: {
                    ...overview,
                    history,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/feature-controls/toggle
     * Toggle any platform feature, payment gateway, currency, blockchain network, or trading pair ON/OFF
     * Enforces reason logging, admin attribution, and sensitive feature confirmation + 2FA
     */
    async toggleFeatureControl(req, res, next) {
        try {
            const adminId = req.user.id;
            const { featureKey, enabled, reason, confirmedSensitive, customMeta } = req.body || {};
            if (!featureKey) {
                return res.status(400).json({
                    success: false,
                    message: 'featureKey is required.',
                });
            }
            if (!reason || String(reason).trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    message: 'A clear reason (at least 3 characters) is required for the Admin Audit Log.',
                });
            }
            const { featureMap } = await featureControl_service_1.featureControlService.getAllFeatures();
            const targetFeature = featureMap[String(featureKey).trim().toUpperCase()];
            const isSensitive = targetFeature !== undefined
                ? targetFeature.isSensitive
                : customMeta?.isSensitive !== undefined
                    ? Boolean(customMeta.isSensitive)
                    : true;
            if (isSensitive && !confirmedSensitive) {
                return res.status(400).json({
                    success: false,
                    code: 'SENSITIVE_CONFIRMATION_REQUIRED',
                    message: `Sensitive feature "${targetFeature?.label || featureKey}" requires explicit confirmation before toggling.`,
                });
            }
            const result = await featureControl_service_1.featureControlService.toggleFeature({
                featureKey,
                enabled: Boolean(enabled),
                reason: String(reason).trim(),
                adminId,
                customMeta,
            });
            const [overview, history] = await Promise.all([
                featureControl_service_1.featureControlService.getAllFeatures(),
                featureControl_service_1.featureControlService.getHistory(150),
            ]);
            res.json({
                success: true,
                message: `${result.feature.label} switched ${result.feature.enabled ? 'ON (ENABLED)' : 'OFF (DISABLED)'}. Recorded in Admin Audit Logs.`,
                data: {
                    ...result,
                    ...overview,
                    history,
                },
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Failed to update feature control.',
            });
        }
    }
    /**
     * POST /api/v1/admin/feature-controls/bulk-toggle
     * Emergency Playbook bulk switch (e.g. Freeze Outbound Funds, Pause Trading Engines, Pause On-Chain Rails, or Restore All)
     */
    async bulkToggleFeatureControls(req, res, next) {
        try {
            const adminId = req.user.id;
            const { featureKeys, enabled, reason, confirmedSensitive } = req.body || {};
            if (!Array.isArray(featureKeys) || featureKeys.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'featureKeys array is required.',
                });
            }
            if (!reason || String(reason).trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    message: 'A clear reason (at least 3 characters) is required for the Admin Audit Log.',
                });
            }
            if (!confirmedSensitive) {
                return res.status(400).json({
                    success: false,
                    code: 'SENSITIVE_CONFIRMATION_REQUIRED',
                    message: 'Emergency bulk feature changes require explicit confirmation.',
                });
            }
            const result = await featureControl_service_1.featureControlService.bulkToggleFeatures({
                featureKeys,
                enabled: Boolean(enabled),
                reason: String(reason).trim(),
                adminId,
            });
            const [overview, history] = await Promise.all([
                featureControl_service_1.featureControlService.getAllFeatures(),
                featureControl_service_1.featureControlService.getHistory(150),
            ]);
            res.json({
                success: true,
                message: `${result.updatedCount} feature(s) switched ${enabled ? 'ON (ENABLED)' : 'OFF (DISABLED)'} and logged.`,
                data: {
                    ...result,
                    ...overview,
                    history,
                },
            });
        }
        catch (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Failed to execute bulk feature control update.',
            });
        }
    }
    /**
     * POST /api/v1/admin/system/self-test
     * 1-Click Automated Financial & Mathematical Integrity Self-Test
     * Runs an isolated, self-cleaning 12-point verification of all financial math & double-entry fund conservation rules
     */
    async runFinancialSelfTest(req, res, next) {
        try {
            const adminUserId = req.user?.id;
            const report = await financialSelfTest_service_1.financialSelfTestService.runFullSelfTest(adminUserId);
            res.json({
                success: true,
                message: report.status === 'ALL_PASSED'
                    ? `All ${report.passedCount}/${report.totalChecks} financial & mathematical conservation checks passed with 0.00000000 discrepancy.`
                    : `${report.passedCount}/${report.totalChecks} checks passed (${report.failedCount} issue(s) detected).`,
                data: report,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || 'Failed to execute financial self-test suite.',
            });
        }
    }
    /**
     * GET /api/v1/admin/system/backup-excel/status
     */
    async getExcelBackupStatus(req, res, next) {
        try {
            const { platformBackupService } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
            const status = await platformBackupService.getBackupConfig();
            res.json({ success: true, data: status });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/system/backup-excel/config
     */
    async updateExcelBackupConfig(req, res, next) {
        try {
            const { platformBackupService } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
            const updated = await platformBackupService.updateBackupConfig({
                enabled: req.body?.enabled,
                recipientEmails: req.body?.recipientEmails,
            });
            res.json({
                success: true,
                message: 'End-of-Day Master Excel Backup configuration updated.',
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/admin/system/backup-excel/download
     * Immediately generate and download the 8-sheet Master Excel (.xls) workbook
     */
    async downloadExcelBackup(req, res, next) {
        try {
            const { platformBackupService } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
            const { buffer, filename } = await platformBackupService.generateFullPlatformExcel();
            res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(buffer);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/admin/system/backup-excel/send
     * Immediately generate and email the 8-sheet Master Excel (.xls) workbook to configured recipients
     */
    async sendExcelBackupEmail(req, res, next) {
        try {
            const { platformBackupService } = await Promise.resolve().then(() => __importStar(require('../services/backup.service')));
            const recipientOverride = req.body?.recipientEmails || req.body?.email || undefined;
            if (recipientOverride) {
                await platformBackupService.updateBackupConfig({ recipientEmails: recipientOverride });
            }
            const result = await platformBackupService.sendDailyExcelBackupEmail({
                recipientOverride,
                triggerSource: 'MANUAL_ADMIN',
            });
            res.json({
                success: true,
                message: `Complete 8-Sheet Master Excel Backup (${result.filename}) emailed to ${result.recipients.join(', ')}!`,
                data: result,
            });
        }
        catch (err) {
            return res.status(500).json({
                success: false,
                message: err.message || 'Failed to dispatch Excel backup email.',
            });
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
