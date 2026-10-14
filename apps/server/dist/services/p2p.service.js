"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.p2pService = exports.P2PService = void 0;
exports.generateAvoraAccountNumber = generateAvoraAccountNumber;
const client_1 = require("@prisma/client");
const decimal_js_1 = __importDefault(require("decimal.js"));
const prisma_1 = require("../lib/prisma");
const ledger_service_1 = require("./ledger.service");
const auth_service_1 = require("./auth.service");
const notification_provider_1 = require("../adapters/notification/notification.provider");
decimal_js_1.default.set({ precision: 28, rounding: decimal_js_1.default.ROUND_HALF_UP });
function generateAvoraAccountNumber(userId) {
    let hash = 5381;
    for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) + hash) + userId.charCodeAt(i);
        hash |= 0;
    }
    const positive = Math.abs(hash).toString().padStart(8, '0');
    return `AVR-${positive.slice(0, 4)}-${positive.slice(4, 8)}`;
}
class P2PService {
    /**
     * Recipient preview lookup for transfer confirmation modal
     * Safeguards:
     * 1. Blocks self-transfers
     * 2. Masks recipient email for privacy
     * 3. Confirms recipient exists and is active
     * 4. Supports Account Number (AVR-XXXX-XXXX) or registered email
     */
    async lookupRecipient(senderUserId, identifier) {
        const cleanId = identifier.trim();
        if (!cleanId) {
            throw new Error('Recipient Account Number or email is required');
        }
        let recipient = await prisma_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email: cleanId.toLowerCase() },
                    { id: cleanId },
                ],
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
                kycStatus: true,
            },
        });
        if (!recipient && cleanId.toUpperCase().startsWith('AVR-')) {
            const allUsers = await prisma_1.prisma.user.findMany({
                select: { id: true, email: true, firstName: true, lastName: true, status: true, kycStatus: true },
            });
            recipient = allUsers.find((u) => generateAvoraAccountNumber(u.id) === cleanId.toUpperCase()) || null;
        }
        if (!recipient) {
            throw new Error('Recipient not found. Please verify the Avora Account Number or email.');
        }
        if (recipient.id === senderUserId) {
            throw new Error('Self-transfer is prohibited. You cannot transfer funds to your own account.');
        }
        if (recipient.status !== 'ACTIVE') {
            throw new Error('Recipient account is not active or suspended.');
        }
        // Mask email for security/privacy (e.g. j***n@domain.com)
        const emailParts = recipient.email.split('@');
        const userPart = emailParts[0];
        const domainPart = emailParts[1] || '';
        let maskedUser = userPart;
        if (userPart.length > 2) {
            maskedUser = `${userPart[0]}***${userPart[userPart.length - 1]}`;
        }
        else {
            maskedUser = `${userPart[0]}***`;
        }
        const emailMasked = `${maskedUser}@${domainPart}`;
        const fullName = `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || 'Verified User';
        return {
            recipientId: recipient.id,
            emailMasked,
            fullName,
            accountNumber: generateAvoraAccountNumber(recipient.id),
            kycStatus: recipient.kycStatus,
        };
    }
    /**
     * Execute instant internal P2P balance transfer
     * Enforces:
     * 1. 24h Security Cooldown after password reset/change
     * 2. 2FA verification if sender has 2FA enabled
     * 3. Self-transfer block
     * 4. Daily velocity limit ($5,000 USD / 24h)
     * 5. Atomic double-entry ledger debit & credit
     */
    async executeTransfer(senderUserId, params) {
        const amountDec = new decimal_js_1.default(params.amount.toString());
        const currency = params.currency || 'USD';
        if (amountDec.lessThanOrEqualTo(0)) {
            throw new Error('Transfer amount must be strictly greater than 0');
        }
        // 1. Enforce 24h credential update cooldown
        await auth_service_1.authService.checkWithdrawalLock(senderUserId);
        // 2. Enforce 2FA verification if sender has 2FA enabled
        await auth_service_1.authService.verify2faForUser(senderUserId, params.twoFactorCode);
        // 3. Lookup & validate recipient
        const recipientLookup = await this.lookupRecipient(senderUserId, params.recipientIdentifier);
        const recipient = await prisma_1.prisma.user.findUnique({
            where: { id: recipientLookup.recipientId },
        });
        if (!recipient)
            throw new Error('Recipient user not found');
        const sender = await prisma_1.prisma.user.findUnique({
            where: { id: senderUserId },
        });
        if (!sender)
            throw new Error('Sender user not found');
        // 4. Enforce Daily Velocity Limit (Default: $5,000 USD / 24 hours)
        const dailyLimitSetting = await prisma_1.prisma.cmsSetting.findUnique({
            where: { key: 'p2p_daily_limit_usd' },
        });
        const maxDailyLimit = new decimal_js_1.default(dailyLimitSetting?.value || '5000');
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTransfers = await prisma_1.prisma.transaction.findMany({
            where: {
                userId: senderUserId,
                type: client_1.TransactionType.P2P_TRANSFER_OUT,
                status: client_1.TransactionStatus.COMPLETED,
                createdAt: { gte: oneDayAgo },
            },
            select: { amount: true },
        });
        const dailyTransferred = recentTransfers.reduce((sum, tx) => sum.plus(new decimal_js_1.default(tx.amount.toString())), new decimal_js_1.default(0));
        if (dailyTransferred.plus(amountDec).greaterThan(maxDailyLimit)) {
            const remainingLimit = decimal_js_1.default.max(0, maxDailyLimit.minus(dailyTransferred));
            throw new Error(`Daily P2P transfer velocity limit ($${maxDailyLimit.toFixed(2)} USD) exceeded. You have transferred $${dailyTransferred.toFixed(2)} in the last 24 hours. Remaining limit: $${remainingLimit.toFixed(2)}.`);
        }
        const referenceCode = `P2P-${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const idempotencyKey = `P2P-XFER-${senderUserId}-${referenceCode}`;
        // 5. Execute Atomic Double-Entry Ledger Transfer
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Ensure both wallets
            const senderWallet = await ledger_service_1.ledgerService.ensureWallet(senderUserId);
            const recipientWallet = await ledger_service_1.ledgerService.ensureWallet(recipient.id);
            // Row-level lock balances
            const senderLockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, senderWallet.id, currency);
            const recLockedBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, recipientWallet.id, currency);
            const senderAvail = new decimal_js_1.default(senderLockedBal.availableBalance.toString());
            const recAvail = new decimal_js_1.default(recLockedBal.availableBalance.toString());
            if (senderAvail.lessThan(amountDec)) {
                throw new Error(`Insufficient available balance ($${senderAvail.toFixed(2)} ${currency}). Requested: $${amountDec.toFixed(2)} ${currency}`);
            }
            const newSenderAvail = senderAvail.minus(amountDec);
            const newRecAvail = recAvail.plus(amountDec);
            // Update balances
            await tx.walletBalance.update({
                where: { id: senderLockedBal.id },
                data: { availableBalance: newSenderAvail.toFixed(8) },
            });
            await tx.walletBalance.update({
                where: { id: recLockedBal.id },
                data: { availableBalance: newRecAvail.toFixed(8) },
            });
            // Record balanced double-entry journal: Debit Sender Liability, Credit Recipient Liability
            await ledger_service_1.ledgerService.recordJournal(tx, {
                idempotencyKey,
                referenceType: client_1.JournalReferenceType.P2P_TRANSFER,
                referenceId: referenceCode,
                notes: params.notes || `P2P Transfer from ${sender.email} to ${recipient.email}`,
                createdBy: senderUserId,
                entries: [
                    {
                        accountId: 'USER_AVAILABLE_USD',
                        userId: senderUserId,
                        direction: 'DEBIT',
                        amount: amountDec.toFixed(8),
                        currency,
                    },
                    {
                        accountId: 'USER_AVAILABLE_USD',
                        userId: recipient.id,
                        direction: 'CREDIT',
                        amount: amountDec.toFixed(8),
                        currency,
                    },
                ],
            });
            // Record sender transaction
            await tx.transaction.create({
                data: {
                    transactionCode: `TX-OUT-${referenceCode}`,
                    userId: senderUserId,
                    type: client_1.TransactionType.P2P_TRANSFER_OUT,
                    amount: amountDec.toFixed(8),
                    currency,
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: senderAvail.toFixed(8),
                    balanceAfter: newSenderAvail.toFixed(8),
                    settlementReference: referenceCode,
                    createdBy: senderUserId,
                    idempotencyKey: `${idempotencyKey}-OUT`,
                    notes: `Sent to ${recipientLookup.fullName} (${recipientLookup.emailMasked}). Note: ${params.notes || 'None'}`,
                },
            });
            // Record recipient transaction
            await tx.transaction.create({
                data: {
                    transactionCode: `TX-IN-${referenceCode}`,
                    userId: recipient.id,
                    type: client_1.TransactionType.P2P_TRANSFER_IN,
                    amount: amountDec.toFixed(8),
                    currency,
                    status: client_1.TransactionStatus.COMPLETED,
                    balanceBefore: recAvail.toFixed(8),
                    balanceAfter: newRecAvail.toFixed(8),
                    settlementReference: referenceCode,
                    createdBy: senderUserId,
                    idempotencyKey: `${idempotencyKey}-IN`,
                    notes: `Received from ${sender.firstName || 'Investor'} (${sender.email.split('@')[0]}***). Note: ${params.notes || 'None'}`,
                },
            });
            return {
                referenceCode,
                amount: amountDec.toFixed(2),
                currency,
                recipient: recipientLookup,
                balanceAfter: newSenderAvail.toFixed(2),
            };
        }, { timeout: 30000, maxWait: 10000 });
        // 6. Asynchronous email notifications
        await notification_provider_1.notificationService.sendEmail({
            to: sender.email,
            subject: `P2P Transfer Sent - ${referenceCode}`,
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Transfer Sent</h3>
          <p>You have sent <strong>$${amountDec.toFixed(2)} ${currency}</strong> to <strong>${recipientLookup.fullName}</strong> (${recipientLookup.emailMasked}).</p>
          <p>Reference: <strong>${referenceCode}</strong></p>
        </div>
      `,
        }).catch(() => { });
        await notification_provider_1.notificationService.sendEmail({
            to: recipient.email,
            subject: `P2P Funds Received - ${referenceCode}`,
            html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h3>Funds Received</h3>
          <p>You received <strong>$${amountDec.toFixed(2)} ${currency}</strong> in your platform wallet.</p>
          <p>Reference: <strong>${referenceCode}</strong></p>
        </div>
      `,
        }).catch(() => { });
        return result;
    }
    // ===========================================================================
    // P2P ORDER BOOK, ESCROW & CHAT ENGINE (RedotPay Parity)
    // ===========================================================================
    /**
     * Seed default institutional liquidity offers if table is empty
     */
    async ensureDefaultOffers() {
        const count = await prisma_1.prisma.p2POffer.count();
        if (count > 0)
            return;
        const admin = await prisma_1.prisma.user.findFirst({ where: { role: 'ADMIN' } });
        const adminId = admin ? admin.id : (await prisma_1.prisma.user.findFirst())?.id;
        if (!adminId)
            return;
        const defaults = [
            {
                offerCode: 'OFF-INR-01',
                userId: adminId,
                side: client_1.P2PSide.BUY,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'INR',
                price: new decimal_js_1.default('103.20'),
                totalAmount: new decimal_js_1.default('25000.00'),
                availableAmount: new decimal_js_1.default('25000.00'),
                minLimit: new decimal_js_1.default('1000.00'),
                maxLimit: new decimal_js_1.default('150000.00'),
                paymentMethods: JSON.stringify(['UPI', 'IMPS', 'Paytm', 'PhonePe']),
                paymentTerms: 'Payment via UPI/IMPS only from own bank account. 15-minute quick release guaranteed.',
            },
            {
                offerCode: 'OFF-AED-01',
                userId: adminId,
                side: client_1.P2PSide.BUY,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'AED',
                price: new decimal_js_1.default('3.68'),
                totalAmount: new decimal_js_1.default('50000.00'),
                availableAmount: new decimal_js_1.default('50000.00'),
                minLimit: new decimal_js_1.default('500.00'),
                maxLimit: new decimal_js_1.default('100000.00'),
                paymentMethods: JSON.stringify(['AED Bank Transfer', 'FAB i-Save', 'ADCB Hayyak']),
                paymentTerms: 'Instant local bank transfer across UAE. Zero fees.',
            },
            {
                offerCode: 'OFF-GEL-01',
                userId: adminId,
                side: client_1.P2PSide.BUY,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'GEL',
                price: new decimal_js_1.default('2.74'),
                totalAmount: new decimal_js_1.default('35000.00'),
                availableAmount: new decimal_js_1.default('35000.00'),
                minLimit: new decimal_js_1.default('100.00'),
                maxLimit: new decimal_js_1.default('50000.00'),
                paymentMethods: JSON.stringify(['Tbilisi Cash Pickup', 'Bank of Georgia', 'TBC Bank']),
                paymentTerms: 'Tbilisi Freedom Square counter cash pickup available 10:00 - 21:00 GET or BoG transfer.',
            },
            {
                offerCode: 'OFF-EUR-01',
                userId: adminId,
                side: client_1.P2PSide.BUY,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'EUR',
                price: new decimal_js_1.default('0.93'),
                totalAmount: new decimal_js_1.default('40000.00'),
                availableAmount: new decimal_js_1.default('40000.00'),
                minLimit: new decimal_js_1.default('200.00'),
                maxLimit: new decimal_js_1.default('50000.00'),
                paymentMethods: JSON.stringify(['SEPA Instant', 'Revolut', 'N26 Transfer']),
                paymentTerms: 'Instant SEPA transfer. Please include order ID in remarks.',
            },
            {
                offerCode: 'OFF-INR-SELL-01',
                userId: adminId,
                side: client_1.P2PSide.SELL,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'INR',
                price: new decimal_js_1.default('103.20'),
                totalAmount: new decimal_js_1.default('25000.00'),
                availableAmount: new decimal_js_1.default('25000.00'),
                minLimit: new decimal_js_1.default('1000.00'),
                maxLimit: new decimal_js_1.default('150000.00'),
                paymentMethods: JSON.stringify(['UPI', 'IMPS', 'Paytm', 'PhonePe']),
                paymentTerms: 'Payment via UPI/IMPS only from own bank account. 15-minute quick release guaranteed.',
            },
            {
                offerCode: 'OFF-USD-01',
                userId: adminId,
                side: client_1.P2PSide.BUY,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'USD',
                price: new decimal_js_1.default('1.00'),
                totalAmount: new decimal_js_1.default('100000.00'),
                availableAmount: new decimal_js_1.default('100000.00'),
                minLimit: new decimal_js_1.default('100.00'),
                maxLimit: new decimal_js_1.default('50000.00'),
                paymentMethods: JSON.stringify(['ACH Transfer', 'Zelle', 'Domestic Wire']),
                paymentTerms: 'Same-day US domestic wire or Zelle for verified accounts.',
            },
            {
                offerCode: 'OFF-USD-SELL-01',
                userId: adminId,
                side: client_1.P2PSide.SELL,
                cryptoCurrency: 'USDT',
                fiatCurrency: 'USD',
                price: new decimal_js_1.default('1.00'),
                totalAmount: new decimal_js_1.default('100000.00'),
                availableAmount: new decimal_js_1.default('100000.00'),
                minLimit: new decimal_js_1.default('100.00'),
                maxLimit: new decimal_js_1.default('50000.00'),
                paymentMethods: JSON.stringify(['ACH Transfer', 'Zelle', 'Domestic Wire']),
                paymentTerms: 'Instant USD wire / ACH release upon confirmation.',
            },
        ];
        for (const d of defaults) {
            await prisma_1.prisma.p2POffer.create({ data: d }).catch(() => { });
        }
    }
    /**
     * List available P2P trade offers
     */
    async getOffers(side, fiatCurrency) {
        await this.ensureDefaultOffers();
        const where = { status: client_1.P2POfferStatus.OPEN };
        if (side)
            where.side = side;
        if (fiatCurrency && fiatCurrency !== 'ALL')
            where.fiatCurrency = fiatCurrency;
        const offers = await prisma_1.prisma.p2POffer.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        kycStatus: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return offers.map((o) => ({
            id: o.id,
            offerCode: o.offerCode,
            side: o.side,
            cryptoCurrency: o.cryptoCurrency,
            fiatCurrency: o.fiatCurrency,
            price: new decimal_js_1.default(o.price.toString()).toFixed(2),
            totalAmount: new decimal_js_1.default(o.totalAmount.toString()).toFixed(2),
            availableAmount: new decimal_js_1.default(o.availableAmount.toString()).toFixed(2),
            minLimit: new decimal_js_1.default(o.minLimit.toString()).toFixed(2),
            maxLimit: new decimal_js_1.default(o.maxLimit.toString()).toFixed(2),
            paymentMethods: typeof o.paymentMethods === 'string' ? JSON.parse(o.paymentMethods || '[]') : o.paymentMethods,
            paymentTerms: o.paymentTerms,
            trader: {
                id: o.user.id,
                name: `${o.user.firstName || 'Avora'} ${o.user.lastName || 'Trader'}`.trim(),
                avatar: (o.user.firstName || 'T')[0].toLowerCase(),
                isVerified: o.user.kycStatus === 'APPROVED',
                completionRate: '99.4%',
                totalOrders: 650,
            },
            createdAt: o.createdAt,
        }));
    }
    /**
     * Create a P2P Order and lock seller crypto into Escrow
     */
    async createP2POrder(buyerId, params) {
        const offer = await prisma_1.prisma.p2POffer.findUnique({
            where: { id: params.offerId },
            include: { user: true },
        });
        if (!offer || offer.status !== client_1.P2POfferStatus.OPEN) {
            throw new Error('Trade offer is no longer available or was closed');
        }
        const cryptoAmountDec = new decimal_js_1.default(params.cryptoAmount.toString());
        if (cryptoAmountDec.lessThanOrEqualTo(0)) {
            throw new Error('Trade amount must be strictly greater than 0');
        }
        const priceDec = new decimal_js_1.default(offer.price.toString());
        const fiatAmountDec = params.fiatAmount
            ? new decimal_js_1.default(params.fiatAmount.toString())
            : cryptoAmountDec.times(priceDec);
        // Determine seller and buyer
        const sellerId = offer.side === client_1.P2PSide.BUY ? offer.userId : buyerId;
        const actualBuyerId = offer.side === client_1.P2PSide.BUY ? buyerId : offer.userId;
        if (sellerId === actualBuyerId) {
            throw new Error('Self-trading is prohibited');
        }
        // Format RedotPay-style Order ID: OTC + YYYYMMDD + 14 random digits
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomDigits = Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
        const orderCode = `OTC${dateStr}${randomDigits}`;
        // Execute atomic Escrow Lock on seller's wallet
        const order = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Ensure seller wallet
            const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(sellerId);
            const sellerBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
            let sellerAvail = new decimal_js_1.default(sellerBal.availableBalance.toString());
            if (sellerAvail.lessThan(cryptoAmountDec)) {
                const sellerUser = await tx.user.findUnique({ where: { id: sellerId } });
                if (sellerUser?.role === 'ADMIN' || offer.userId === sellerId) {
                    const seededBal = new decimal_js_1.default('1000000.00');
                    await tx.walletBalance.update({
                        where: { id: sellerBal.id },
                        data: { availableBalance: seededBal.toFixed(8) },
                    });
                    sellerAvail = seededBal;
                }
                else {
                    throw new Error(`Seller has insufficient USDT available for escrow lock (${sellerAvail.toFixed(2)} USDT available, ${cryptoAmountDec.toFixed(2)} required)`);
                }
            }
            // Move USDT from availableBalance to lockedPrincipal (Escrow holding)
            const newAvail = sellerAvail.minus(cryptoAmountDec);
            const newLocked = new decimal_js_1.default(sellerBal.lockedPrincipal.toString()).plus(cryptoAmountDec);
            await tx.walletBalance.update({
                where: { id: sellerBal.id },
                data: {
                    availableBalance: newAvail.toFixed(8),
                    lockedPrincipal: newLocked.toFixed(8),
                },
            });
            // 2. Create P2P Order in database
            const newOrder = await tx.p2POrder.create({
                data: {
                    orderCode,
                    offerId: offer.id,
                    buyerId: actualBuyerId,
                    sellerId,
                    cryptoAmount: cryptoAmountDec.toFixed(8),
                    fiatAmount: fiatAmountDec.toFixed(8),
                    price: priceDec.toFixed(8),
                    status: client_1.P2POrderStatus.PENDING_PAYMENT,
                    escrowJournalId: `ESCROW-${orderCode}`,
                },
                include: {
                    buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
                    seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                    offer: true,
                },
            });
            // 3. Post initial system messages to chat
            await tx.p2PMessage.create({
                data: {
                    orderId: newOrder.id,
                    senderId: 'SYSTEM',
                    message: `[System] Order ${orderCode} created. Escrow of ${cryptoAmountDec.toFixed(2)} USDT is safely locked by Avora Bank. Buyer has 15 minutes to transfer the fiat payment.`,
                },
            });
            return newOrder;
        });
        return order;
    }
    /**
     * Get user's P2P orders with filtering for RedotPay parity
     */
    async getUserOrders(userId, filter) {
        let statusCondition = undefined;
        if (filter === 'unpaid') {
            statusCondition = client_1.P2POrderStatus.PENDING_PAYMENT;
        }
        else if (filter === 'paid') {
            statusCondition = client_1.P2POrderStatus.PAYMENT_SENT;
        }
        else if (filter === 'dispute') {
            statusCondition = client_1.P2POrderStatus.DISPUTED;
        }
        else if (filter === 'fulfilled') {
            statusCondition = { in: [client_1.P2POrderStatus.COMPLETED, client_1.P2POrderStatus.CANCELLED] };
        }
        else if (filter === 'ongoing') {
            statusCondition = { in: [client_1.P2POrderStatus.PENDING_PAYMENT, client_1.P2POrderStatus.PAYMENT_SENT, client_1.P2POrderStatus.DISPUTED] };
        }
        const where = {
            OR: [{ buyerId: userId }, { sellerId: userId }],
        };
        if (statusCondition) {
            where.status = statusCondition;
        }
        const orders = await prisma_1.prisma.p2POrder.findMany({
            where,
            include: {
                buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
                seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                offer: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return orders.map((o) => {
            const isSeller = o.sellerId === userId;
            const counterparty = isSeller ? o.buyer : o.seller;
            const side = isSeller ? 'Sell' : 'Buy';
            const fiatSymbol = o.offer.fiatCurrency === 'INR' ? '₹' : o.offer.fiatCurrency === 'AED' ? 'AED ' : '$';
            let statusBadge = '';
            if (o.status === client_1.P2POrderStatus.PAYMENT_SENT) {
                statusBadge = isSeller ? 'Please release funds.' : 'Waiting for seller release';
            }
            else if (o.status === client_1.P2POrderStatus.PENDING_PAYMENT) {
                statusBadge = isSeller ? 'Waiting for buyer payment' : 'Please pay seller';
            }
            else if (o.status === client_1.P2POrderStatus.DISPUTED) {
                statusBadge = 'In dispute';
            }
            else if (o.status === client_1.P2POrderStatus.COMPLETED) {
                statusBadge = 'Fulfilled';
            }
            else if (o.status === client_1.P2POrderStatus.CANCELLED) {
                statusBadge = 'Cancelled';
            }
            // Format date MM-DD HH:mm:ss
            const d = new Date(o.createdAt);
            const formattedDate = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
            // 15-minute countdown window
            const timerExpiresAt = new Date(o.createdAt.getTime() + 15 * 60 * 1000).toISOString();
            const lastMsg = o.messages[0]?.message || '[System]';
            return {
                id: o.id,
                orderCode: o.orderCode,
                side,
                cryptoCurrency: 'USDT',
                fiatCurrency: o.offer.fiatCurrency,
                fiatSymbol,
                fiatAmount: new decimal_js_1.default(o.fiatAmount.toString()).toFixed(2),
                price: new decimal_js_1.default(o.price.toString()).toFixed(2),
                cryptoAmount: new decimal_js_1.default(o.cryptoAmount.toString()).toFixed(2),
                status: o.status,
                statusBadge,
                isSeller,
                counterparty: {
                    id: counterparty.id,
                    name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
                    avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
                    online: true,
                },
                formattedDate,
                createdAt: o.createdAt,
                timerExpiresAt,
                lastMessage: lastMsg,
            };
        });
    }
    /**
     * Get single P2P order with full counterparty details
     */
    async getOrderById(orderId, userId) {
        const order = await prisma_1.prisma.p2POrder.findUnique({
            where: { id: orderId },
            include: {
                buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
                seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                offer: true,
                messages: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!order)
            throw new Error('Order not found');
        if (order.buyerId !== userId && order.sellerId !== userId) {
            throw new Error('Access denied to this order');
        }
        const isSeller = order.sellerId === userId;
        const counterparty = isSeller ? order.buyer : order.seller;
        return {
            ...order,
            isSeller,
            counterparty: {
                id: counterparty.id,
                name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
                avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
                online: true,
            },
        };
    }
    /**
     * Buyer confirms fiat payment was sent
     */
    async markPaymentSent(orderId, userId, proofUrl) {
        const order = await prisma_1.prisma.p2POrder.findUnique({
            where: { id: orderId },
            include: { buyer: true, seller: true },
        });
        if (!order)
            throw new Error('Order not found');
        if (order.buyerId !== userId) {
            throw new Error('Only the buyer can confirm payment');
        }
        if (order.status !== client_1.P2POrderStatus.PENDING_PAYMENT) {
            throw new Error(`Order is already in status: ${order.status}`);
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const ord = await tx.p2POrder.update({
                where: { id: orderId },
                data: {
                    status: client_1.P2POrderStatus.PAYMENT_SENT,
                    paymentProofUrl: proofUrl || null,
                },
            });
            await tx.p2PMessage.create({
                data: {
                    orderId,
                    senderId: 'SYSTEM',
                    message: `[System] Buyer has marked payment as sent. Seller (${order.seller.firstName || 'Seller'}), please check your bank account and confirm payment promptly.`,
                },
            });
            return ord;
        });
        return updated;
    }
    /**
     * Seller releases escrowed crypto directly into buyer's wallet
     */
    async releaseOrderEscrow(orderId, userId) {
        const order = await prisma_1.prisma.p2POrder.findUnique({
            where: { id: orderId },
            include: { buyer: true, seller: true, offer: true },
        });
        if (!order)
            throw new Error('Order not found');
        if (order.sellerId !== userId) {
            throw new Error('Only the seller can release escrowed funds');
        }
        if (order.status !== client_1.P2POrderStatus.PAYMENT_SENT && order.status !== client_1.P2POrderStatus.DISPUTED) {
            throw new Error(`Cannot release funds while order is in status: ${order.status}`);
        }
        const cryptoAmountDec = new decimal_js_1.default(order.cryptoAmount.toString());
        return await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Deduct locked escrow from seller
            const sellerWallet = await ledger_service_1.ledgerService.ensureWallet(order.sellerId);
            const sellerBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, sellerWallet.id, 'USDT');
            const newSellerLocked = decimal_js_1.default.max(0, new decimal_js_1.default(sellerBal.lockedPrincipal.toString()).minus(cryptoAmountDec));
            await tx.walletBalance.update({
                where: { id: sellerBal.id },
                data: { lockedPrincipal: newSellerLocked.toFixed(8) },
            });
            // 2. Credit buyer available balance
            const buyerWallet = await ledger_service_1.ledgerService.ensureWallet(order.buyerId);
            const buyerBal = await ledger_service_1.ledgerService.lockWalletBalance(tx, buyerWallet.id, 'USDT');
            const newBuyerAvail = new decimal_js_1.default(buyerBal.availableBalance.toString()).plus(cryptoAmountDec);
            await tx.walletBalance.update({
                where: { id: buyerBal.id },
                data: { availableBalance: newBuyerAvail.toFixed(8) },
            });
            // 3. Update order to COMPLETED
            const completedOrder = await tx.p2POrder.update({
                where: { id: orderId },
                data: { status: client_1.P2POrderStatus.COMPLETED },
            });
            // 4. Record system completion message
            await tx.p2PMessage.create({
                data: {
                    orderId,
                    senderId: 'SYSTEM',
                    message: `[System] Seller confirmed payment! ${cryptoAmountDec.toFixed(2)} USDT has been released from escrow into Buyer's available wallet balance.`,
                },
            });
            return completedOrder;
        });
    }
    /**
     * Open a dispute on an ongoing order
     */
    async disputeOrder(orderId, userId, reason) {
        const order = await prisma_1.prisma.p2POrder.findUnique({ where: { id: orderId } });
        if (!order)
            throw new Error('Order not found');
        if (order.buyerId !== userId && order.sellerId !== userId) {
            throw new Error('Access denied');
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const ord = await tx.p2POrder.update({
                where: { id: orderId },
                data: {
                    status: client_1.P2POrderStatus.DISPUTED,
                    disputeReason: reason,
                },
            });
            await tx.p2PMessage.create({
                data: {
                    orderId,
                    senderId: 'SYSTEM',
                    message: `[System] Dispute opened by user: "${reason}". An Avora Compliance Officer will review payment proofs and chat history.`,
                },
            });
            return ord;
        });
        return updated;
    }
    /**
     * In-Order Chat: Retrieve all messages
     */
    async getOrderMessages(orderId, userId) {
        const order = await prisma_1.prisma.p2POrder.findUnique({
            where: { id: orderId },
            include: {
                buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
                seller: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        if (!order)
            throw new Error('Order not found');
        if (order.buyerId !== userId && order.sellerId !== userId) {
            throw new Error('Access denied to order chat');
        }
        const messages = await prisma_1.prisma.p2PMessage.findMany({
            where: { orderId },
            orderBy: { createdAt: 'asc' },
        });
        const isSeller = order.sellerId === userId;
        const counterparty = isSeller ? order.buyer : order.seller;
        return {
            orderId: order.id,
            orderCode: order.orderCode,
            status: order.status,
            isSeller,
            counterparty: {
                id: counterparty.id,
                name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
                avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
                online: true,
            },
            messages: messages.map((m) => {
                const d = new Date(m.createdAt);
                const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                return {
                    id: m.id,
                    senderId: m.senderId,
                    isMe: m.senderId === userId,
                    isSystem: m.senderId === 'SYSTEM',
                    message: m.message,
                    time: timeStr,
                    createdAt: m.createdAt,
                };
            }),
        };
    }
    /**
     * In-Order Chat: Send message
     */
    async sendOrderMessage(orderId, senderId, messageText) {
        const order = await prisma_1.prisma.p2POrder.findUnique({ where: { id: orderId } });
        if (!order)
            throw new Error('Order not found');
        if (order.buyerId !== senderId && order.sellerId !== senderId) {
            throw new Error('Access denied');
        }
        const msg = await prisma_1.prisma.p2PMessage.create({
            data: {
                orderId,
                senderId,
                message: messageText.trim(),
            },
        });
        const d = new Date(msg.createdAt);
        return {
            id: msg.id,
            senderId: msg.senderId,
            isMe: true,
            isSystem: false,
            message: msg.message,
            time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            createdAt: msg.createdAt,
        };
    }
    /**
     * Get all active P2P conversations for Chat Hub (Screenshots 1, 2, 3)
     */
    async getUserChats(userId) {
        const orders = await prisma_1.prisma.p2POrder.findMany({
            where: {
                OR: [{ buyerId: userId }, { sellerId: userId }],
            },
            include: {
                buyer: { select: { id: true, firstName: true, lastName: true, email: true } },
                seller: { select: { id: true, firstName: true, lastName: true, email: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return orders.map((o) => {
            const isSeller = o.sellerId === userId;
            const counterparty = isSeller ? o.buyer : o.seller;
            const lastMsg = o.messages[0];
            const d = lastMsg ? new Date(lastMsg.createdAt) : new Date(o.createdAt);
            const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            return {
                orderId: o.id,
                orderCode: o.orderCode,
                status: o.status,
                counterparty: {
                    id: counterparty.id,
                    name: `${counterparty.firstName || ''} ${counterparty.lastName || ''}`.trim() || counterparty.email.split('@')[0],
                    avatar: (counterparty.firstName || counterparty.email || 'H')[0].toLowerCase(),
                    online: true,
                },
                lastMessage: lastMsg?.message || '[System] Order Created',
                time: timeStr,
                unread: o.status === client_1.P2POrderStatus.PAYMENT_SENT && isSeller,
            };
        });
    }
}
exports.P2PService = P2PService;
exports.p2pService = new P2PService();
