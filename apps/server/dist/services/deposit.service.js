"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.depositService = exports.DepositService = void 0;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
class DepositService {
    /**
     * Submit a deposit request with payment proof
     */
    async createDeposit(userId, data) {
        const amountNum = parseFloat(data.amount.toString());
        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error('Deposit amount must be a positive number');
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found');
        const depositCode = `DEP-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const currency = data.currency || 'USD';
        const deposit = await prisma_1.prisma.depositRequest.create({
            data: {
                depositCode,
                userId,
                amount: new decimal_js_1.default(amountNum).toFixed(8),
                currency,
                depositMethod: data.depositMethod,
                proofUrl: data.proofUrl || null,
                txHashOrRef: data.txHashOrRef || null,
                status: client_1.DepositStatus.PENDING,
            },
        });
        // Notify user & admin
        await notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: `Deposit Request Received - ${depositCode}`,
            html: `
        <h3>Deposit Request Under Review</h3>
        <p>We received your deposit submission of <strong>${amountNum.toLocaleString()} ${currency}</strong> via <strong>${data.depositMethod}</strong>.</p>
        <p>Reference: <strong>${depositCode}</strong></p>
        <p>Our operations team will verify the payment and credit your balance within 1-2 hours during business hours.</p>
      `,
        });
        return deposit;
    }
    /**
     * Get user's deposit requests
     */
    async getUserDeposits(userId) {
        const deposits = await prisma_1.prisma.depositRequest.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return deposits.map((d) => ({
            id: d.id,
            depositCode: d.depositCode,
            amount: new decimal_js_1.default(d.amount.toString()).toFixed(2),
            currency: d.currency,
            depositMethod: d.depositMethod,
            proofUrl: d.proofUrl,
            txHashOrRef: d.txHashOrRef,
            status: d.status,
            adminNotes: d.adminNotes,
            createdAt: d.createdAt,
        }));
    }
    /**
     * Admin: Approve a deposit request
     */
    async adminApproveDeposit(depositId, adminUserId, adminNotes) {
        const deposit = await prisma_1.prisma.depositRequest.findUnique({
            where: { id: depositId },
            include: { user: true },
        });
        if (!deposit)
            throw new Error('Deposit request not found');
        if (deposit.status !== 'PENDING') {
            throw new Error(`Deposit is already in status: ${deposit.status}`);
        }
        const result = await ledger_service_1.ledgerService.processDepositApproval({
            depositId: deposit.id,
            depositCode: deposit.depositCode,
            userId: deposit.userId,
            amount: deposit.amount.toString(),
            currency: deposit.currency,
            reviewedBy: adminUserId,
            notes: adminNotes,
        });
        // Send confirmation email
        await notification_provider_1.notificationService.sendEmail({
            to: deposit.user.email,
            subject: `Deposit Credited to Your Wallet - ${deposit.depositCode}`,
            html: `
        <h3>Deposit Approved</h3>
        <p>Your deposit of <strong>${new decimal_js_1.default(deposit.amount.toString()).toFixed(2)} ${deposit.currency}</strong> has been verified and credited to your platform wallet.</p>
        <p>Your new available balance is <strong>$${result.balanceAfter} USD</strong>.</p>
      `,
        });
        return result;
    }
    /**
     * Admin: Reject a deposit request
     */
    async adminRejectDeposit(depositId, adminUserId, reason) {
        const deposit = await prisma_1.prisma.depositRequest.findUnique({
            where: { id: depositId },
            include: { user: true },
        });
        if (!deposit)
            throw new Error('Deposit request not found');
        if (deposit.status !== 'PENDING') {
            throw new Error(`Deposit is already in status: ${deposit.status}`);
        }
        const updated = await prisma_1.prisma.depositRequest.update({
            where: { id: depositId },
            data: {
                status: client_1.DepositStatus.REJECTED,
                adminNotes: reason,
                reviewedBy: adminUserId,
                reviewedAt: new Date(),
            },
        });
        // Send rejection email
        await notification_provider_1.notificationService.sendEmail({
            to: deposit.user.email,
            subject: `Deposit Issue - ${deposit.depositCode}`,
            html: `
        <h3>Deposit Verification Update</h3>
        <p>We were unable to verify your deposit request <strong>${deposit.depositCode}</strong> for <strong>${new decimal_js_1.default(deposit.amount.toString()).toFixed(2)} ${deposit.currency}</strong>.</p>
        <p>Reason provided: <em>${reason}</em></p>
        <p>Please contact support or re-submit with clear transaction proof.</p>
      `,
        });
        return updated;
    }
    /**
     * Admin: List all deposit requests with filters
     */
    async getAllDeposits(filters) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.search) {
            where.OR = [
                { depositCode: { contains: filters.search } },
                { user: { email: { contains: filters.search } } },
                { txHashOrRef: { contains: filters.search } },
            ];
        }
        const [deposits, total] = await Promise.all([
            prisma_1.prisma.depositRequest.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma_1.prisma.depositRequest.count({ where }),
        ]);
        return {
            deposits: deposits.map((d) => ({
                id: d.id,
                depositCode: d.depositCode,
                user: d.user,
                amount: new decimal_js_1.default(d.amount.toString()).toFixed(2),
                currency: d.currency,
                depositMethod: d.depositMethod,
                proofUrl: d.proofUrl,
                txHashOrRef: d.txHashOrRef,
                status: d.status,
                adminNotes: d.adminNotes,
                reviewedBy: d.reviewedBy,
                reviewedAt: d.reviewedAt,
                createdAt: d.createdAt,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
}
exports.DepositService = DepositService;
exports.depositService = new DepositService();
