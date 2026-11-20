"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletController = exports.WalletController = void 0;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("../services/ledger.service");
const deposit_service_1 = require("../services/deposit.service");
const card_service_1 = require("../services/card.service");
const package_service_1 = require("../services/package.service");
const p2p_service_1 = require("../services/p2p.service");
const otc_service_1 = require("../services/otc.service");
const liquidityRisk_service_1 = require("../services/liquidityRisk.service");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
async function ensureVirtualCardsEnabled(res) {
    const flag = await prisma_1.prisma.cmsSetting.findUnique({ where: { key: 'enable_virtual_cards' } });
    if (flag?.value === 'true')
        return true;
    res.status(403).json({
        success: false,
        code: 'VIRTUAL_CARDS_COMING_SOON',
        message: 'Virtual Cards are coming soon while Avora Bank finalizes integration with our regulated card-issuing partner.',
    });
    return false;
}
function fmtAmountDisplay(value, currency = 'USD') {
    const num = Number(value || 0);
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return currency === 'USD' ? `$${formatted} USD` : `${formatted} ${currency}`;
}
class WalletController {
    /**
     * Get authenticated user's wallet overview
     */
    async getWalletOverview(req, res, next) {
        try {
            const userId = req.user.id;
            const role = req.user.role;
            const summary = await ledger_service_1.ledgerService.getUserWalletSummary(userId);
            const adminRevenueSummary = role === 'ADMIN' ? await ledger_service_1.ledgerService.getPlatformRevenueVaultSummary().catch(() => null) : null;
            const payload = adminRevenueSummary ? { ...summary, adminRevenueSummary } : summary;
            res.json({ success: true, data: payload, wallet: payload });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's transaction history with filtering and pagination
     */
    async getTransactions(req, res, next) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page, 10) || 1;
            const limit = parseInt(req.query.limit, 10) || 20;
            const skip = (page - 1) * limit;
            const type = req.query.type;
            const currency = req.query.currency;
            const format = req.query.format;
            const where = { userId };
            if (type)
                where.type = type;
            if (currency)
                where.currency = currency;
            if (req.query.startDate && req.query.endDate) {
                where.createdAt = {
                    gte: new Date(req.query.startDate),
                    lte: new Date(req.query.endDate),
                };
            }
            // If format is CSV, export all matching records
            if (format === 'csv') {
                const txs = await prisma_1.prisma.transaction.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    take: 5000,
                });
                let csv = 'Transaction Code,Date,Type,Amount,Currency,Status,Balance Before,Balance After,Reference,Notes\n';
                for (const t of txs) {
                    const dp = ['BTC', 'ETH'].includes((t.currency || '').toUpperCase()) ? 8 : 2;
                    csv += `"${t.transactionCode}","${t.createdAt.toISOString()}","${t.type}","${new decimal_js_1.default(t.amount.toString()).toFixed(dp)}","${t.currency}","${t.status}","${new decimal_js_1.default(t.balanceBefore.toString()).toFixed(dp)}","${new decimal_js_1.default(t.balanceAfter.toString()).toFixed(dp)}","${t.settlementReference || ''}","${(t.notes || '').replace(/"/g, '""')}"\n`;
                }
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`);
                return res.send(csv);
            }
            const [transactions, total] = await Promise.all([
                prisma_1.prisma.transaction.findMany({
                    where,
                    include: {
                        package: { select: { packageCode: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit,
                }),
                prisma_1.prisma.transaction.count({ where }),
            ]);
            const formattedTransactions = transactions.map((t) => {
                const dp = ['BTC', 'ETH'].includes((t.currency || '').toUpperCase()) ? 8 : 2;
                return {
                    id: t.id,
                    transactionCode: t.transactionCode,
                    type: t.type,
                    amount: new decimal_js_1.default(t.amount.toString()).toFixed(dp),
                    currency: t.currency,
                    status: t.status,
                    balanceBefore: new decimal_js_1.default(t.balanceBefore.toString()).toFixed(dp),
                    balanceAfter: new decimal_js_1.default(t.balanceAfter.toString()).toFixed(dp),
                    settlementReference: t.settlementReference,
                    packageCode: t.package?.packageCode || null,
                    notes: t.notes,
                    createdAt: t.createdAt,
                };
            });
            res.json({
                success: true,
                transactions: formattedTransactions,
                data: {
                    transactions: formattedTransactions,
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
     * Get deposit receiving addresses, networks, and instructions
     */
    async getDepositInstructions(req, res, next) {
        try {
            const instructions = await deposit_service_1.depositService.getDepositInstructions();
            res.json({ success: true, data: instructions });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Submit a deposit request
     */
    async submitDeposit(req, res, next) {
        try {
            const userId = req.user.id;
            const { amount, currency, depositMethod, proofUrl, txHashOrRef } = req.body;
            if (!amount || !depositMethod) {
                return res.status(400).json({ success: false, message: 'Amount and deposit method are required' });
            }
            const deposit = await deposit_service_1.depositService.createDeposit(userId, {
                amount,
                currency,
                depositMethod,
                proofUrl,
                txHashOrRef,
            });
            res.status(201).json({
                success: true,
                message: 'Deposit request submitted successfully. Awaiting verification.',
                data: deposit,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's deposit requests
     */
    async getDeposits(req, res, next) {
        try {
            const userId = req.user.id;
            const deposits = await deposit_service_1.depositService.getUserDeposits(userId);
            res.json({ success: true, data: deposits });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Create a Razorpay payment order with 5% total platform commission breakdown
     */
    async createRazorpayOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const { amount, currency, creditAmount, checkoutCurrency, feeMode, purpose } = req.body;
            if (!amount || isNaN(parseFloat(String(amount))) || parseFloat(String(amount)) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'A valid positive payment amount is required',
                });
            }
            const orderResult = await deposit_service_1.depositService.createRazorpayOrder(userId, {
                amount,
                currency,
                creditAmount,
                checkoutCurrency,
                feeMode,
                purpose,
            });
            res.status(201).json({
                success: true,
                message: 'Razorpay payment order initialized',
                data: orderResult,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Verify a Razorpay payment and credit the net amount (after 5% commission) to user's wallet
     */
    async verifyRazorpayPayment(req, res, next) {
        try {
            const userId = req.user.id;
            const { depositId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
            if (!depositId || !razorpay_payment_id) {
                return res.status(400).json({
                    success: false,
                    message: 'depositId and razorpay_payment_id are required',
                });
            }
            const result = await deposit_service_1.depositService.verifyRazorpayPayment(userId, {
                depositId,
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
            });
            res.json({
                success: true,
                message: result.message,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Public Razorpay Webhook endpoint (POST /api/v1/wallet/razorpay/webhook)
     * Safely isolates Avora Bank orders from Avora Library orders on the shared merchant account
     */
    async handleRazorpayWebhook(req, res) {
        try {
            const signature = req.headers['x-razorpay-signature'];
            const rawBody = req.rawBody || JSON.stringify(req.body || {});
            const result = await deposit_service_1.depositService.handleRazorpayWebhook(req.body, rawBody, signature);
            res.status(200).json({
                success: true,
                ...result,
            });
        }
        catch (err) {
            console.error('[WalletController] Razorpay webhook processing notice:', err);
            // Always return 200 to prevent Razorpay from disabling shared merchant webhooks
            res.status(200).json({
                success: false,
                received: true,
                message: err.message || 'Webhook logged',
            });
        }
    }
    /**
     * Execute an instant real multi-currency swap between wallet balances
     */
    async executeSwap(req, res, next) {
        try {
            const userId = req.user.id;
            const { fromCurrency, toCurrency, fromAmount } = req.body;
            if (!fromCurrency || !toCurrency || !fromAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'fromCurrency, toCurrency, and fromAmount are required',
                });
            }
            const result = await liquidityRisk_service_1.liquidityRiskService.evaluateAndExecuteOrQueueSwap({
                userId,
                fromCurrency,
                toCurrency,
                fromAmount,
            });
            res.json({
                success: true,
                message: result.queued
                    ? result.message
                    : `Successfully swapped ${result.fromAmount} ${result.fromCurrency} for ${result.toAmount} ${result.toCurrency}!`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's VirtualCard
     */
    async getCard(req, res, next) {
        try {
            if (!(await ensureVirtualCardsEnabled(res)))
                return;
            const userId = req.user.id;
            const card = await card_service_1.cardService.getOrCreateCard(userId);
            res.json({ success: true, data: card });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Freeze/Unfreeze card
     */
    async toggleCardFreeze(req, res, next) {
        try {
            if (!(await ensureVirtualCardsEnabled(res)))
                return;
            const userId = req.user.id;
            const result = await card_service_1.cardService.toggleFreeze(userId);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update card limits
     */
    async updateCardLimits(req, res, next) {
        try {
            if (!(await ensureVirtualCardsEnabled(res)))
                return;
            const userId = req.user.id;
            const { dailyLimit, monthlyLimit } = req.body;
            const result = await card_service_1.cardService.updateLimits(userId, dailyLimit, monthlyLimit);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update card security settings
     */
    async updateCardSettings(req, res, next) {
        try {
            if (!(await ensureVirtualCardsEnabled(res)))
                return;
            const userId = req.user.id;
            const result = await card_service_1.cardService.updateSettings(userId, req.body);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get card transaction feed
     */
    async getCardTransactions(req, res, next) {
        try {
            if (!(await ensureVirtualCardsEnabled(res)))
                return;
            const userId = req.user.id;
            const transactions = await card_service_1.cardService.getCardTransactions(userId);
            res.json({ success: true, data: transactions });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Request a PCI-compliant ephemeral key / iframe reveal token from the Card Issuer
     */
    async createCardRevealSession(req, res, next) {
        try {
            if (!(await ensureVirtualCardsEnabled(res)))
                return;
            const userId = req.user.id;
            const { nonce } = req.body || {};
            const session = await card_service_1.cardService.createRevealSession(userId, nonce);
            res.json({ success: true, data: session });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Real-Time Authorization Webhook (`/api/v1/wallet/card/webhook/authorize`)
     * Verifies `CARD_WEBHOOK_SECRET` signature, extracts `external_card_id`, `amount`,
     * `currency`, and `merchant_details`, executes atomic MariaDB checks, and responds
     * immediately with HTTP 200 `{ "approved": true }` or
     * `{ "approved": false, "reject_reason": "INSUFFICIENT_FUNDS" | "CARD_FROZEN" | "LIMIT_EXCEEDED" }`.
     */
    async authorizeCardWebhook(req, res) {
        try {
            const signatureHeader = req.headers['stripe-signature'] ||
                req.headers['x-webhook-signature'] ||
                req.headers['x-card-webhook-signature'] ||
                '';
            const rawPayload = typeof req.rawBody === 'string'
                ? req.rawBody
                : JSON.stringify(req.body || {});
            if (!card_service_1.cardService.verifyWebhookSignature(rawPayload, signatureHeader)) {
                return res.status(401).json({
                    approved: false,
                    error: 'INVALID_WEBHOOK_SIGNATURE',
                });
            }
            const body = req.body || {};
            const stripeAuth = body?.data?.object;
            const externalCardId = body.external_card_id ||
                body.card_id ||
                stripeAuth?.card?.id ||
                (typeof stripeAuth?.card === 'string' ? stripeAuth.card : '') ||
                '';
            const rawAmount = body.amount !== undefined
                ? body.amount
                : stripeAuth?.amount !== undefined
                    ? Number(stripeAuth.amount) / 100
                    : 0;
            const currency = body.currency ||
                stripeAuth?.currency ||
                'USD';
            const merchantDetails = body.merchant_details || {
                name: stripeAuth?.merchant_data?.name || body.merchant_name || 'Card Merchant',
                category: stripeAuth?.merchant_data?.category || body.merchant_category || 'ONLINE_POS',
                country: stripeAuth?.merchant_data?.country || body.merchant_country,
                mcc: stripeAuth?.merchant_data?.mcc || body.mcc,
            };
            const result = await card_service_1.cardService.handleRealtimeWebhookAuthorization({
                external_card_id: externalCardId,
                amount: rawAmount,
                currency,
                authorization_id: body.authorization_id || stripeAuth?.id || body.id,
                is_online: body.is_online !== undefined ? Boolean(body.is_online) : true,
                is_international: Boolean(body.is_international),
                merchant_details: merchantDetails,
            });
            if (result.approved) {
                return res.status(200).json({ approved: true });
            }
            return res.status(200).json({
                approved: false,
                reject_reason: result.reject_reason || 'CARD_FROZEN',
            });
        }
        catch (err) {
            return res.status(200).json({
                approved: false,
                reject_reason: 'CARD_FROZEN',
            });
        }
    }
    /**
     * Build real-time event-driven notifications for an authenticated customer
     */
    async buildCustomerNotifications(userId) {
        const now = new Date();
        const settingKey = `notif_state_${userId}`;
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                kycStatus: true,
                twoFactorEnabled: true,
                updatedAt: true,
                createdAt: true,
            },
        });
        if (!user) {
            return {
                summary: {
                    totalCount: 0,
                    unreadCount: 0,
                    supportCount: 0,
                    fdCount: 0,
                    depositWithdrawalCount: 0,
                    transactionCount: 0,
                    accountCount: 0,
                    otcCount: 0,
                },
                notifications: [],
            };
        }
        await Promise.all([p2p_service_1.p2pService.ensureP2PReady(), otc_service_1.otcService.ensureOtcSchema()]);
        const [kycDocuments, supportTickets, inquiries, investmentInquiries, packages, deposits, withdrawals, transactions, globalTransfers, p2pOrders, otcTrades, otcInquiries, persistedNotifications, notifSetting,] = await Promise.all([
            prisma_1.prisma.kycDocument.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
            prisma_1.prisma.supportTicket.findMany({
                where: { userId },
                include: {
                    replies: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
                orderBy: { updatedAt: 'desc' },
                take: 25,
            }),
            prisma_1.prisma.inquiry.findMany({
                where: user.email
                    ? { OR: [{ userId }, { email: user.email }] }
                    : { userId },
                orderBy: { updatedAt: 'desc' },
                take: 15,
            }),
            prisma_1.prisma.investmentInquiry
                .findMany({
                where: { investorUserId: userId },
                include: {
                    listing: { select: { companyName: true, slug: true } },
                },
                orderBy: { updatedAt: 'desc' },
                take: 15,
            })
                .catch(() => []),
            prisma_1.prisma.investmentPackage.findMany({
                where: { userId },
                include: {
                    returns: { orderBy: { payoutDate: 'desc' } },
                },
                orderBy: { updatedAt: 'desc' },
                take: 30,
            }),
            prisma_1.prisma.depositRequest.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                take: 30,
            }),
            prisma_1.prisma.withdrawalRequest.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                take: 30,
            }),
            prisma_1.prisma.transaction.findMany({
                where: { userId },
                include: {
                    package: { select: { packageCode: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 40,
            }),
            prisma_1.prisma.globalTransfer.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                take: 20,
            }),
            prisma_1.prisma.p2POrder.findMany({
                where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
                include: {
                    offer: { select: { fiatCurrency: true, cryptoCurrency: true } },
                },
                orderBy: { updatedAt: 'desc' },
                take: 20,
            }),
            prisma_1.prisma.otcTrade
                .findMany({
                where: { OR: [{ customerId: userId }, { operatorId: userId }] },
                include: {
                    desk: { select: { deskName: true, deskCode: true } },
                    customer: { select: { id: true, firstName: true, lastName: true, displayName: true } },
                    operator: { select: { id: true, firstName: true, lastName: true, displayName: true } },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 6,
                    },
                },
                orderBy: { updatedAt: 'desc' },
                take: 25,
            })
                .catch(() => []),
            prisma_1.prisma.otcInquiry
                .findMany({
                where: { OR: [{ customerId: userId }, { operatorId: userId }] },
                include: {
                    desk: { select: { deskName: true, deskCode: true } },
                    messages: {
                        orderBy: { createdAt: 'desc' },
                        take: 5,
                    },
                },
                orderBy: { updatedAt: 'desc' },
                take: 20,
            })
                .catch(() => []),
            prisma_1.prisma.userNotification
                .findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            })
                .catch(() => []),
            prisma_1.prisma.cmsSetting.findUnique({
                where: { key: settingKey },
            }),
        ]);
        let lastReadAllAt = null;
        let readIds = [];
        if (notifSetting?.value) {
            try {
                const parsed = JSON.parse(notifSetting.value);
                if (parsed?.lastReadAllAt)
                    lastReadAllAt = String(parsed.lastReadAllAt);
                if (Array.isArray(parsed?.readIds))
                    readIds = parsed.readIds.map(String);
            }
            catch {
                // Ignore malformed read state
            }
        }
        const readIdsSet = new Set(readIds);
        const lastReadAllMs = lastReadAllAt ? new Date(lastReadAllAt).getTime() : 0;
        const rawItems = [];
        // 1. SUPPORT TICKETS & INQUIRIES
        for (const ticket of supportTickets) {
            const adminReplies = (ticket.replies || []).filter((r) => r.senderRole === 'ADMIN' || r.senderRole === 'STAFF');
            for (const reply of adminReplies) {
                const snippet = reply.message.length > 140 ? `${reply.message.slice(0, 140)}...` : reply.message;
                rawItems.push({
                    id: `tkt-reply-${reply.id}`,
                    category: 'SUPPORT',
                    type: 'TICKET_REPLY',
                    severity: 'INFO',
                    title: `Support Desk Replied: [${ticket.ticketNumber}]`,
                    message: `${reply.senderName}: "${snippet}" — ${ticket.subject}`,
                    referenceCode: ticket.ticketNumber,
                    status: ticket.status,
                    actionUrl: '/dashboard?tab=support',
                    actionLabel: 'View Reply',
                    createdAt: reply.createdAt.toISOString(),
                });
            }
            if (ticket.status === 'RESOLVED' ||
                ticket.status === 'CLOSED' ||
                ticket.status === 'IN_REVIEW' ||
                ticket.status === 'WAITING_USER' ||
                ticket.adminNotes) {
                rawItems.push({
                    id: `tkt-status-${ticket.id}-${ticket.status}`,
                    category: 'SUPPORT',
                    type: 'TICKET_STATUS',
                    severity: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                        ? 'SUCCESS'
                        : 'INFO',
                    title: `Ticket [${ticket.ticketNumber}] — ${ticket.status.replace(/_/g, ' ')}`,
                    message: ticket.adminNotes
                        ? `Desk Note: ${ticket.adminNotes}`
                        : `Subject: ${ticket.subject}`,
                    referenceCode: ticket.ticketNumber,
                    status: ticket.status,
                    actionUrl: '/dashboard?tab=support',
                    actionLabel: 'Open Ticket',
                    createdAt: ticket.updatedAt.toISOString(),
                });
            }
            else {
                rawItems.push({
                    id: `tkt-open-${ticket.id}`,
                    category: 'SUPPORT',
                    type: 'TICKET_CREATED',
                    severity: 'INFO',
                    title: `Support Ticket Logged: [${ticket.ticketNumber}]`,
                    message: `"${ticket.subject}" has been assigned to our support desk.`,
                    referenceCode: ticket.ticketNumber,
                    status: ticket.status,
                    actionUrl: '/dashboard?tab=support',
                    actionLabel: 'View Ticket',
                    createdAt: ticket.createdAt.toISOString(),
                });
            }
        }
        for (const inq of inquiries) {
            if (inq.status !== 'NEW' || inq.adminNotes) {
                rawItems.push({
                    id: `inq-${inq.id}-${inq.status}`,
                    category: 'SUPPORT',
                    type: 'INQUIRY_UPDATE',
                    severity: inq.status === 'RESOLVED' || inq.status === 'CLOSED' ? 'SUCCESS' : 'INFO',
                    title: `Inquiry Update: ${inq.subject}`,
                    message: inq.adminNotes || `Your inquiry status is now ${inq.status}.`,
                    status: inq.status,
                    actionUrl: '/dashboard?tab=support',
                    actionLabel: 'View Support',
                    createdAt: inq.updatedAt.toISOString(),
                });
            }
        }
        for (const invInq of investmentInquiries) {
            if (invInq.response || invInq.status === 'RESPONDED' || invInq.status === 'CLOSED') {
                rawItems.push({
                    id: `inv-inq-${invInq.id}-${invInq.status}`,
                    category: 'SUPPORT',
                    type: 'VENTURE_INQUIRY_REPLY',
                    severity: 'INFO',
                    title: `Venture Desk Response: ${invInq.listing.companyName}`,
                    message: invInq.response || `Your venture inquiry status updated to ${invInq.status}.`,
                    status: invInq.status,
                    actionUrl: '/dashboard?tab=packages',
                    actionLabel: 'View Portfolio',
                    createdAt: invInq.updatedAt.toISOString(),
                });
            }
        }
        // 2. FD PACKAGES & MONTHLY RETURNS
        for (const pkg of packages) {
            const amtNum = Number(pkg.amount || 0);
            const amtStr = amtNum.toFixed(2);
            const schedule = (0, package_service_1.computePackageYieldSchedule)(pkg, now);
            const daysRemaining = pkg.lockInEnd
                ? Math.ceil((new Date(pkg.lockInEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : null;
            if (pkg.status === 'PENDING_PAYMENT') {
                rawItems.push({
                    id: `pkg-pending-${pkg.id}`,
                    category: 'FD_PACKAGE',
                    type: 'FD_PENDING',
                    severity: 'WARNING',
                    title: `FD [${pkg.packageCode}] Awaiting Activation`,
                    message: `${fmtAmountDisplay(amtNum, pkg.currency)} (${schedule.lockMonths} Months FD) submitted and pending institutional verification.`,
                    referenceCode: pkg.packageCode,
                    amount: amtStr,
                    currency: pkg.currency,
                    status: pkg.status,
                    actionUrl: '/dashboard?tab=packages',
                    actionLabel: 'View FD',
                    createdAt: pkg.createdAt.toISOString(),
                });
            }
            else if (pkg.status === 'ACTIVE') {
                const startTs = (pkg.lockInStart || pkg.purchaseDate || pkg.createdAt).toISOString();
                rawItems.push({
                    id: `pkg-active-${pkg.id}`,
                    category: 'FD_PACKAGE',
                    type: 'FD_ACTIVATED',
                    severity: 'SUCCESS',
                    title: `FD Package [${pkg.packageCode}] Active (${fmtAmountDisplay(amtNum, pkg.currency)})`,
                    message: `Earning 1.0% monthly yield (+$${schedule.monthlyYield}/mo) over ${schedule.lockMonths} months.${schedule.nextYieldDueDate
                        ? ` Next payout cycle: ${new Date(schedule.nextYieldDueDate).toLocaleDateString()}.`
                        : ''}`,
                    referenceCode: pkg.packageCode,
                    amount: amtStr,
                    currency: pkg.currency,
                    status: pkg.status,
                    actionUrl: '/dashboard?tab=packages',
                    actionLabel: 'View FD',
                    createdAt: startTs,
                });
                if (daysRemaining !== null && daysRemaining <= 0) {
                    rawItems.push({
                        id: `pkg-matured-${pkg.id}`,
                        category: 'FD_PACKAGE',
                        type: 'FD_MATURED',
                        severity: 'SUCCESS',
                        title: `FD Package [${pkg.packageCode}] Has Matured!`,
                        message: `Your ${schedule.lockMonths}-month lock-in term is complete (${fmtAmountDisplay(amtNum, pkg.currency)}). Principal is ready for release or withdrawal.`,
                        referenceCode: pkg.packageCode,
                        amount: amtStr,
                        currency: pkg.currency,
                        status: 'MATURED',
                        actionUrl: '/dashboard?tab=withdraw',
                        actionLabel: 'Withdraw Principal',
                        createdAt: (pkg.lockInEnd || pkg.updatedAt).toISOString(),
                    });
                }
                else if (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 15) {
                    const maturingAt = new Date(now.getTime() - 1000).toISOString();
                    rawItems.push({
                        id: `pkg-maturing-${pkg.id}`,
                        category: 'FD_PACKAGE',
                        type: 'FD_MATURING_SOON',
                        severity: 'WARNING',
                        title: `FD [${pkg.packageCode}] Matures in ${daysRemaining} Day(s)`,
                        message: `${fmtAmountDisplay(amtNum, pkg.currency)} FD reaches full maturity on ${new Date(pkg.lockInEnd).toLocaleDateString()}.`,
                        referenceCode: pkg.packageCode,
                        amount: amtStr,
                        currency: pkg.currency,
                        status: pkg.status,
                        actionUrl: '/dashboard?tab=packages',
                        actionLabel: 'View FD',
                        createdAt: maturingAt,
                    });
                }
            }
            else if (pkg.status === 'MATURED') {
                rawItems.push({
                    id: `pkg-matured-${pkg.id}`,
                    category: 'FD_PACKAGE',
                    type: 'FD_MATURED',
                    severity: 'SUCCESS',
                    title: `FD Package [${pkg.packageCode}] Has Matured!`,
                    message: `Your ${schedule.lockMonths}-month term for ${fmtAmountDisplay(amtNum, pkg.currency)} is complete and ready for settlement or withdrawal.`,
                    referenceCode: pkg.packageCode,
                    amount: amtStr,
                    currency: pkg.currency,
                    status: pkg.status,
                    actionUrl: '/dashboard?tab=withdraw',
                    actionLabel: 'Withdraw Principal',
                    createdAt: (pkg.lockInEnd || pkg.updatedAt).toISOString(),
                });
            }
            else if (pkg.status === 'SETTLED') {
                rawItems.push({
                    id: `pkg-settled-${pkg.id}`,
                    category: 'FD_PACKAGE',
                    type: 'FD_SETTLED',
                    severity: 'SUCCESS',
                    title: `FD [${pkg.packageCode}] Settled & Principal Released`,
                    message: `Principal and accumulated returns for ${fmtAmountDisplay(amtNum, pkg.currency)} have been settled to your wallet.`,
                    referenceCode: pkg.packageCode,
                    amount: amtStr,
                    currency: pkg.currency,
                    status: pkg.status,
                    actionUrl: '/dashboard?tab=transactions',
                    actionLabel: 'View Ledger',
                    createdAt: pkg.updatedAt.toISOString(),
                });
            }
            for (const ret of pkg.returns || []) {
                const retAmt = Number(ret.returnAmount || 0);
                rawItems.push({
                    id: `pkg-return-${ret.id}`,
                    category: 'FD_PACKAGE',
                    type: 'FD_YIELD_CREDITED',
                    severity: 'SUCCESS',
                    title: `Monthly FD Yield Credited: +${fmtAmountDisplay(retAmt, ret.currency)}`,
                    message: `Cycle #${ret.periodIndex} monthly return from FD [${pkg.packageCode}] has been credited to your Available Wallet.`,
                    referenceCode: pkg.packageCode,
                    amount: retAmt.toFixed(2),
                    currency: ret.currency,
                    status: ret.status,
                    actionUrl: '/dashboard?tab=packages',
                    actionLabel: 'View Yield',
                    createdAt: (ret.payoutDate || ret.createdAt).toISOString(),
                });
            }
        }
        // 3. DEPOSIT REQUESTS
        for (const dep of deposits) {
            const amtNum = Number(dep.amount || 0);
            const amtStr = amtNum.toFixed(2);
            if (dep.status === 'APPROVED') {
                rawItems.push({
                    id: `dep-approved-${dep.id}`,
                    category: 'DEPOSIT',
                    type: 'DEPOSIT_APPROVED',
                    severity: 'SUCCESS',
                    title: `Deposit Credited: +${fmtAmountDisplay(amtNum, dep.currency)}`,
                    message: `Deposit [${dep.depositCode}] via ${dep.depositMethod.replace(/_/g, ' ')} was approved and added to your available balance.${dep.adminNotes ? ` Note: ${dep.adminNotes}` : ''}`,
                    referenceCode: dep.depositCode,
                    amount: amtStr,
                    currency: dep.currency,
                    status: dep.status,
                    actionUrl: '/dashboard?tab=transactions',
                    actionLabel: 'View Balance',
                    createdAt: (dep.reviewedAt || dep.updatedAt || dep.createdAt).toISOString(),
                });
            }
            else if (dep.status === 'PENDING') {
                rawItems.push({
                    id: `dep-pending-${dep.id}`,
                    category: 'DEPOSIT',
                    type: 'DEPOSIT_PENDING',
                    severity: 'INFO',
                    title: `Deposit Submitted: ${fmtAmountDisplay(amtNum, dep.currency)} (In Review)`,
                    message: `Deposit [${dep.depositCode}] via ${dep.depositMethod.replace(/_/g, ' ')} is awaiting treasury verification.`,
                    referenceCode: dep.depositCode,
                    amount: amtStr,
                    currency: dep.currency,
                    status: dep.status,
                    actionUrl: '/dashboard?tab=overview',
                    actionLabel: 'Track Status',
                    createdAt: dep.createdAt.toISOString(),
                });
            }
            else if (dep.status === 'REJECTED') {
                rawItems.push({
                    id: `dep-rejected-${dep.id}`,
                    category: 'DEPOSIT',
                    type: 'DEPOSIT_REJECTED',
                    severity: 'CRITICAL',
                    title: `Deposit Declined: [${dep.depositCode}]`,
                    message: `Your ${fmtAmountDisplay(amtNum, dep.currency)} deposit request was declined.${dep.adminNotes ? ` Reason: ${dep.adminNotes}` : ''}`,
                    referenceCode: dep.depositCode,
                    amount: amtStr,
                    currency: dep.currency,
                    status: dep.status,
                    actionUrl: '/dashboard?tab=support',
                    actionLabel: 'Contact Support',
                    createdAt: (dep.reviewedAt || dep.updatedAt || dep.createdAt).toISOString(),
                });
            }
        }
        // 4. WITHDRAWAL REQUESTS
        for (const wth of withdrawals) {
            const amtNum = Number(wth.amount || 0);
            const amtStr = amtNum.toFixed(2);
            const railLabel = wth.payoutMethod.replace(/_/g, ' ');
            if (wth.status === 'SETTLED') {
                rawItems.push({
                    id: `wth-settled-${wth.id}`,
                    category: 'WITHDRAWAL',
                    type: 'WITHDRAWAL_SETTLED',
                    severity: 'SUCCESS',
                    title: `Withdrawal Settled: ${fmtAmountDisplay(amtNum, wth.currency)}`,
                    message: `Request [${wth.requestCode}] via ${railLabel} has been settled.${wth.settlementReference ? ` Ref: ${wth.settlementReference}` : ''}`,
                    referenceCode: wth.requestCode,
                    amount: amtStr,
                    currency: wth.currency,
                    status: wth.status,
                    actionUrl: '/dashboard?tab=withdrawals',
                    actionLabel: 'View Receipt',
                    createdAt: (wth.settledAt || wth.updatedAt).toISOString(),
                });
            }
            else if (wth.status === 'REJECTED') {
                rawItems.push({
                    id: `wth-rejected-${wth.id}`,
                    category: 'WITHDRAWAL',
                    type: 'WITHDRAWAL_REJECTED',
                    severity: 'CRITICAL',
                    title: `Withdrawal Declined & Refunded: [${wth.requestCode}]`,
                    message: `Your ${fmtAmountDisplay(amtNum, wth.currency)} withdrawal was declined and funds were restored to your wallet.${wth.adminNotes ? ` Note: ${wth.adminNotes}` : ''}`,
                    referenceCode: wth.requestCode,
                    amount: amtStr,
                    currency: wth.currency,
                    status: wth.status,
                    actionUrl: '/dashboard?tab=withdrawals',
                    actionLabel: 'View Details',
                    createdAt: wth.updatedAt.toISOString(),
                });
            }
            else {
                rawItems.push({
                    id: `wth-${wth.id}-${wth.status}`,
                    category: 'WITHDRAWAL',
                    type: 'WITHDRAWAL_STATUS',
                    severity: wth.status === 'APPROVED' ? 'SUCCESS' : 'INFO',
                    title: `Withdrawal [${wth.requestCode}] — ${wth.status.replace(/_/g, ' ')}`,
                    message: `Your ${fmtAmountDisplay(amtNum, wth.currency)} payout via ${railLabel} is ${wth.status.replace(/_/g, ' ').toLowerCase()}.`,
                    referenceCode: wth.requestCode,
                    amount: amtStr,
                    currency: wth.currency,
                    status: wth.status,
                    actionUrl: '/dashboard?tab=withdrawals',
                    actionLabel: 'Track Withdrawal',
                    createdAt: wth.updatedAt.toISOString(),
                });
            }
        }
        // 5. LEDGER TRANSACTIONS, GLOBAL TRANSFERS & P2P ORDERS
        const depositRefSet = new Set(deposits.flatMap((d) => [d.depositCode, d.txHashOrRef].filter(Boolean)));
        const standaloneTxTypes = new Set([
            client_1.TransactionType.P2P_TRANSFER_IN,
            client_1.TransactionType.P2P_TRANSFER_OUT,
            client_1.TransactionType.EXCHANGE_BUY,
            client_1.TransactionType.EXCHANGE_SELL,
            client_1.TransactionType.CARD_PAYMENT,
            client_1.TransactionType.ADJUSTMENT,
            client_1.TransactionType.REVERSAL,
            client_1.TransactionType.PRINCIPAL_RELEASE,
            client_1.TransactionType.INVESTMENT_ALLOCATION,
            client_1.TransactionType.INVESTMENT_DISTRIBUTION,
        ]);
        for (const tx of transactions) {
            const isDirectAdminDeposit = tx.type === client_1.TransactionType.DEPOSIT &&
                (!tx.settlementReference || !depositRefSet.has(tx.settlementReference)) &&
                !deposits.some((d) => d.status === 'APPROVED' &&
                    Math.abs(Number(d.amount) - Number(tx.amount)) < 0.01 &&
                    Math.abs(new Date(d.reviewedAt || d.updatedAt).getTime() - new Date(tx.createdAt).getTime()) < 120000);
            if (!standaloneTxTypes.has(tx.type) && !isDirectAdminDeposit) {
                continue;
            }
            const amtNum = Number(tx.amount || 0);
            const amtStr = amtNum.toFixed(2);
            const isCredit = tx.type === client_1.TransactionType.P2P_TRANSFER_IN ||
                tx.type === client_1.TransactionType.DEPOSIT ||
                tx.type === client_1.TransactionType.PRINCIPAL_RELEASE ||
                tx.type === client_1.TransactionType.INVESTMENT_DISTRIBUTION ||
                tx.type === client_1.TransactionType.EXCHANGE_BUY;
            const labelMap = {
                P2P_TRANSFER_IN: 'Incoming Account Transfer Received',
                P2P_TRANSFER_OUT: 'Account Transfer Sent',
                EXCHANGE_BUY: 'Instant Swap Credit',
                EXCHANGE_SELL: 'Instant Swap Conversion',
                CARD_PAYMENT: 'Virtual Card Charge',
                ADJUSTMENT: 'Treasury Balance Adjustment',
                REVERSAL: 'Ledger Reversal Processed',
                PRINCIPAL_RELEASE: 'FD Principal Released to Wallet',
                INVESTMENT_ALLOCATION: 'Venture Allocation Executed',
                INVESTMENT_DISTRIBUTION: 'Venture Distribution Credited',
                DEPOSIT: 'Institutional Wallet Credit',
            };
            rawItems.push({
                id: `tx-${tx.id}`,
                category: 'TRANSACTION',
                type: tx.type,
                severity: tx.status === 'FAILED' || tx.status === 'DECLINED' ? 'CRITICAL' : 'SUCCESS',
                title: `${labelMap[tx.type] || tx.type.replace(/_/g, ' ')}: ${isCredit ? '+' : ''}${fmtAmountDisplay(amtNum, tx.currency)}`,
                message: tx.notes || `Transaction [${tx.transactionCode}] completed (${tx.status}).`,
                referenceCode: tx.transactionCode,
                amount: amtStr,
                currency: tx.currency,
                status: tx.status,
                actionUrl: '/dashboard?tab=transactions',
                actionLabel: 'View Ledger',
                createdAt: tx.createdAt.toISOString(),
            });
        }
        for (const gmt of globalTransfers) {
            const sendAmt = Number(gmt.sendingAmount || 0);
            const recAmt = Number(gmt.recipientAmount || 0);
            rawItems.push({
                id: `gmt-${gmt.id}-${gmt.status}`,
                category: 'TRANSACTION',
                type: 'GLOBAL_REMITTANCE',
                severity: gmt.status === 'COMPLETED'
                    ? 'SUCCESS'
                    : gmt.status === 'REJECTED'
                        ? 'CRITICAL'
                        : 'INFO',
                title: `Global Remittance [${gmt.transferCode}] — ${gmt.status.replace(/_/g, ' ')}`,
                message: `${fmtAmountDisplay(sendAmt, gmt.sendingCurrency)} to ${gmt.recipientName} (${fmtAmountDisplay(recAmt, gmt.recipientCurrency)}) is ${gmt.status.replace(/_/g, ' ').toLowerCase()}.${gmt.rejectionReason ? ` Reason: ${gmt.rejectionReason}` : ''}`,
                referenceCode: gmt.transferCode,
                amount: sendAmt.toFixed(2),
                currency: gmt.sendingCurrency,
                status: gmt.status,
                actionUrl: `/transfer/track?code=${encodeURIComponent(gmt.transferCode)}`,
                actionLabel: 'Track Transfer',
                createdAt: (gmt.completedAt || gmt.updatedAt || gmt.createdAt).toISOString(),
            });
        }
        for (const notif of persistedNotifications) {
            rawItems.push({
                id: `un-${notif.id}`,
                category: notif.category || 'TRANSACTION',
                type: notif.type,
                severity: notif.severity || 'INFO',
                title: notif.title,
                message: notif.message,
                referenceCode: notif.referenceCode,
                amount: notif.amount,
                currency: notif.currency,
                status: notif.status,
                actionUrl: notif.actionUrl || '/p2p',
                actionLabel: notif.actionLabel || 'View Details',
                createdAt: notif.createdAt.toISOString(),
            });
        }
        // 5b. OTC ESCROW TRADES & INCOMING OTC CHAT MESSAGES
        // Ensures both newly triggered and previously created OTC trades/messages appear immediately.
        for (const tr of otcTrades) {
            const isOperator = tr.operatorId === userId;
            const counterpartyName = isOperator
                ? `${tr.customer?.firstName || ''} ${tr.customer?.lastName || ''}`.trim() ||
                    (tr.customer?.displayName ? `@${tr.customer.displayName}` : 'Client')
                : tr.desk?.deskName || 'OTC Desk';
            const hasStartedNotif = persistedNotifications.some((n) => n.type === 'OTC_TRADE_STARTED' && n.referenceCode === tr.tradeCode);
            if (!(tr.status === 'IN_PROGRESS' && hasStartedNotif)) {
                rawItems.push({
                    id: `otc-trade-${tr.id}-${tr.status}`,
                    category: 'OTC',
                    type: 'OTC_TRADE',
                    severity: tr.status === 'COMPLETED'
                        ? 'SUCCESS'
                        : tr.status === 'DISPUTED' || tr.status === 'CANCELLED'
                            ? 'CRITICAL'
                            : 'INFO',
                    title: `OTC Escrow [${tr.tradeCode}] — ${String(tr.status).replace(/_/g, ' ')}`,
                    message: `${tr.desk?.deskName || 'OTC Desk'} (${isOperator ? 'Customer' : 'Operator'}: ${counterpartyName}) • ${Number(tr.cryptoAmount).toFixed(2)} USDT ↔ ${fmtAmountDisplay(tr.fiatAmount, tr.fiatCurrency)}.`,
                    referenceCode: tr.tradeCode,
                    amount: Number(tr.cryptoAmount).toFixed(2),
                    currency: 'USDT',
                    status: tr.status,
                    actionUrl: `/exchange?tradeId=${tr.id}`,
                    actionLabel: 'Open OTC Chat',
                    createdAt: (tr.completedAt || tr.disputedAt || tr.updatedAt || tr.createdAt).toISOString(),
                });
            }
            for (const msg of tr.messages || []) {
                if (msg.senderId === userId)
                    continue;
                const msgText = String(msg.message || '');
                const snippet = msgText.length > 140 ? `${msgText.slice(0, 140)}...` : msgText;
                const alreadyPersisted = persistedNotifications.some((n) => n.type === 'OTC_NEW_MESSAGE' &&
                    n.referenceCode === tr.tradeCode &&
                    n.message.includes(msgText.slice(0, 80)));
                if (alreadyPersisted)
                    continue;
                rawItems.push({
                    id: `otc-msg-${msg.id}`,
                    category: 'OTC',
                    type: 'OTC_NEW_MESSAGE',
                    severity: 'INFO',
                    title: `New OTC Message on ${tr.tradeCode} (${tr.desk?.deskName || 'OTC Desk'})`,
                    message: `${msg.senderName}: "${snippet}"`,
                    referenceCode: tr.tradeCode,
                    amount: Number(tr.cryptoAmount).toFixed(2),
                    currency: 'USDT',
                    status: tr.status,
                    actionUrl: `/exchange?tradeId=${tr.id}`,
                    actionLabel: 'Open OTC Chat',
                    createdAt: new Date(msg.createdAt).toISOString(),
                });
            }
        }
        // 5c. PRE-TRADE OTC DESK INQUIRIES (ASK AVAILABILITY / CURRENCY)
        for (const inq of otcInquiries) {
            for (const msg of inq.messages || []) {
                if (msg.senderId === userId)
                    continue;
                const msgText = String(msg.message || '');
                const snippet = msgText.length > 140 ? `${msgText.slice(0, 140)}...` : msgText;
                const alreadyPersisted = persistedNotifications.some((n) => n.type === 'OTC_INQUIRY_MESSAGE' &&
                    n.referenceCode === inq.inquiryCode &&
                    n.message.includes(msgText.slice(0, 80)));
                if (alreadyPersisted)
                    continue;
                rawItems.push({
                    id: `otc-inq-msg-${msg.id}`,
                    category: 'OTC',
                    type: 'OTC_INQUIRY_MESSAGE',
                    severity: 'INFO',
                    title: `OTC Desk Question (${inq.desk?.deskName || 'OTC Desk'}) [${inq.inquiryCode}]`,
                    message: `${msg.senderName}: "${snippet}"`,
                    referenceCode: inq.inquiryCode,
                    status: inq.status,
                    actionUrl: `/exchange?inquiryId=${inq.id}`,
                    actionLabel: 'Open OTC Inquiry',
                    createdAt: new Date(msg.createdAt).toISOString(),
                });
            }
        }
        for (const ord of p2pOrders) {
            const sideLabel = ord.buyerId === userId ? 'Buy' : 'Sell';
            const fiatCur = ord.fiatCurrency || ord.offer?.fiatCurrency || 'USD';
            const cryptoCur = ord.cryptoCurrency || ord.offer?.cryptoCurrency || 'USDT';
            rawItems.push({
                id: `p2p-${ord.id}-${ord.status}`,
                category: 'TRANSACTION',
                type: 'P2P_ORDER',
                severity: ord.status === 'COMPLETED'
                    ? 'SUCCESS'
                    : ['DISPUTED', 'CANCELLED', 'EXPIRED', 'DECLINED', 'FROZEN'].includes(ord.status)
                        ? 'CRITICAL'
                        : 'INFO',
                title: `P2P Escrow [${ord.orderCode}] — ${ord.status.replace(/_/g, ' ')}`,
                message: `${sideLabel} ${Number(ord.cryptoAmount).toFixed(2)} ${cryptoCur} (${fmtAmountDisplay(ord.fiatAmount, fiatCur)}) is ${ord.status.replace(/_/g, ' ').toLowerCase()}.`,
                referenceCode: ord.orderCode,
                amount: Number(ord.cryptoAmount).toFixed(2),
                currency: cryptoCur,
                status: ord.status,
                actionUrl: '/p2p',
                actionLabel: 'Open P2P Desk',
                createdAt: ord.updatedAt.toISOString(),
            });
        }
        // 6. ACCOUNT & KYC UPDATES
        const latestKyc = kycDocuments[0] || null;
        if (user.kycStatus !== 'NOT_STARTED') {
            rawItems.push({
                id: `kyc-${user.kycStatus}-${latestKyc?.id || 'profile'}`,
                category: 'ACCOUNT',
                type: 'KYC_STATUS',
                severity: user.kycStatus === 'APPROVED'
                    ? 'SUCCESS'
                    : user.kycStatus === 'REJECTED'
                        ? 'CRITICAL'
                        : 'WARNING',
                title: user.kycStatus === 'APPROVED'
                    ? 'KYC Identity Verification Approved'
                    : user.kycStatus === 'REJECTED'
                        ? 'KYC Verification Action Required'
                        : 'KYC Documents Under Compliance Review',
                message: user.kycStatus === 'APPROVED'
                    ? 'Your account identity is fully verified. Higher settlement and institutional transfer limits are unlocked.'
                    : user.kycStatus === 'REJECTED'
                        ? `Your verification document was declined.${latestKyc?.rejectionReason ? ` Reason: ${latestKyc.rejectionReason}` : ''}`
                        : 'Your submitted verification document is currently queued for compliance review.',
                status: user.kycStatus,
                actionUrl: '/dashboard?tab=security',
                actionLabel: 'View Security',
                createdAt: (latestKyc?.verifiedAt || latestKyc?.createdAt || user.updatedAt).toISOString(),
            });
        }
        // Deduplicate, apply read status, sort newest first, cap at 80
        const seen = new Set();
        const notifications = rawItems
            .filter((item) => {
            if (seen.has(item.id))
                return false;
            seen.add(item.id);
            return true;
        })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 80)
            .map((item) => {
            const itemMs = new Date(item.createdAt).getTime();
            const isRead = readIdsSet.has(item.id) || (lastReadAllMs > 0 && itemMs <= lastReadAllMs);
            return {
                ...item,
                isRead,
            };
        });
        const summary = {
            totalCount: notifications.length,
            unreadCount: notifications.filter((n) => !n.isRead).length,
            supportCount: notifications.filter((n) => n.category === 'SUPPORT').length,
            fdCount: notifications.filter((n) => n.category === 'FD_PACKAGE').length,
            depositWithdrawalCount: notifications.filter((n) => n.category === 'DEPOSIT' || n.category === 'WITHDRAWAL').length,
            transactionCount: notifications.filter((n) => n.category === 'TRANSACTION').length,
            accountCount: notifications.filter((n) => n.category === 'ACCOUNT').length,
            otcCount: notifications.filter((n) => n.category === 'OTC').length,
        };
        return { summary, notifications };
    }
    /**
     * GET /api/v1/wallet/notifications
     */
    async getNotifications(req, res, next) {
        try {
            const userId = req.user.id;
            const payload = await this.buildCustomerNotifications(userId);
            res.json({
                success: true,
                data: payload,
                summary: payload.summary,
                notifications: payload.notifications,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/wallet/notifications/read
     */
    async markNotificationsRead(req, res, next) {
        try {
            const userId = req.user.id;
            const { notificationIds, markAll } = req.body || {};
            const settingKey = `notif_state_${userId}`;
            const existing = await prisma_1.prisma.cmsSetting.findUnique({
                where: { key: settingKey },
            });
            let state = { readIds: [] };
            if (existing?.value) {
                try {
                    const parsed = JSON.parse(existing.value);
                    state = {
                        lastReadAllAt: parsed?.lastReadAllAt,
                        readIds: Array.isArray(parsed?.readIds) ? parsed.readIds.map(String) : [],
                    };
                }
                catch {
                    state = { readIds: [] };
                }
            }
            if (markAll) {
                state.lastReadAllAt = new Date().toISOString();
                state.readIds = [];
                await prisma_1.prisma.userNotification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }).catch(() => { });
            }
            else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
                const merged = Array.from(new Set([...(state.readIds || []), ...notificationIds.map(String)]));
                state.readIds = merged.slice(-250);
                const dbNotifIds = notificationIds
                    .map(String)
                    .filter((nid) => nid.startsWith('un-'))
                    .map((nid) => nid.slice(3));
                if (dbNotifIds.length > 0) {
                    await prisma_1.prisma.userNotification
                        .updateMany({ where: { id: { in: dbNotifIds }, userId }, data: { isRead: true } })
                        .catch(() => { });
                }
            }
            await prisma_1.prisma.cmsSetting.upsert({
                where: { key: settingKey },
                update: {
                    value: JSON.stringify(state),
                },
                create: {
                    group: 'USER_NOTIFICATIONS',
                    key: settingKey,
                    value: JSON.stringify(state),
                    description: `Notification read state for customer ${userId}`,
                },
            });
            res.json({
                success: true,
                data: state,
                lastReadAllAt: state.lastReadAllAt || null,
                readIds: state.readIds || [],
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WalletController = WalletController;
exports.walletController = new WalletController();
