"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.p2pController = exports.P2PController = void 0;
const p2p_service_1 = require("../services/p2p.service");
class P2PController {
    /**
     * Preview recipient details before transfer confirmation
     */
    async lookupRecipient(req, res, next) {
        try {
            const senderUserId = req.user.id;
            const { identifier } = req.body;
            if (!identifier) {
                return res.status(400).json({
                    success: false,
                    message: 'Recipient identifier (email or User ID) is required',
                });
            }
            const preview = await p2p_service_1.p2pService.lookupRecipient(senderUserId, identifier);
            res.json({
                success: true,
                data: preview,
                recipient: preview,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Execute P2P balance transfer
     */
    async transferFunds(req, res, next) {
        try {
            const senderUserId = req.user.id;
            const { recipientIdentifier, amount, currency, notes, twoFactorCode } = req.body;
            if (!recipientIdentifier || !amount) {
                return res.status(400).json({
                    success: false,
                    message: 'Recipient identifier and amount are required',
                });
            }
            const result = await p2p_service_1.p2pService.executeTransfer(senderUserId, {
                recipientIdentifier,
                amount,
                currency,
                notes,
                twoFactorCode,
            });
            res.status(200).json({
                success: true,
                message: `Successfully transferred $${result.amount} ${result.currency} to ${result.recipient.fullName}.`,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Public P2P Listing Promotion Tiers
     */
    async getPromotionTiers(req, res, next) {
        try {
            const tiers = p2p_service_1.p2pService.getPromotionTiers();
            res.json({ success: true, data: tiers });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get P2P Ads / Offers with rich filtering & sorting
     */
    async getOffers(req, res, next) {
        try {
            const { side, cryptoCurrency, fiatCurrency, paymentMethod, amount, minCompletion, location, sortBy } = req.query;
            const offers = await p2p_service_1.p2pService.getOffers({
                side: side,
                cryptoCurrency: cryptoCurrency,
                fiatCurrency: fiatCurrency,
                paymentMethod: paymentMethod,
                amount: amount,
                minCompletion: minCompletion,
                location: location,
                sortBy: sortBy,
            });
            res.json({ success: true, data: offers });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Public P2P Trader Profile & Reviews
     */
    async getTraderProfile(req, res, next) {
        try {
            const targetUserId = String(req.params.userId);
            const profile = await p2p_service_1.p2pService.getTraderProfile(targetUserId);
            res.json({ success: true, data: profile });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get Authenticated Provider's Own P2P Offers
     */
    async getMyOffers(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const offers = await p2p_service_1.p2pService.getMyOffers(userId);
            res.json({ success: true, data: offers });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Update a P2P Offer (Rate, Payment Methods, Limits, Status)
     */
    async updateOffer(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const offerId = req.params.offerId;
            const result = await p2p_service_1.p2pService.updateOffer(userId, offerId, req.body || {});
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Create a new P2P Offer / Ad (Merchants only)
     */
    async createOffer(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required. Please sign in to create an advertisement.' });
            }
            const result = await p2p_service_1.p2pService.createOffer(userId, req.body);
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Promote / Sponsor an Active P2P Offer ($10 24h, $25 72h, $50 7d)
     */
    async promoteOffer(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const offerId = String(req.params.offerId);
            const { promotionTier } = req.body || {};
            const result = await p2p_service_1.p2pService.promoteOffer(userId, offerId, promotionTier);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Cancel P2P Offer
     */
    async cancelOffer(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
            }
            const offerId = req.params.offerId;
            const result = await p2p_service_1.p2pService.cancelOffer(userId, offerId);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Create P2P Order (Locks seller crypto in Escrow)
     */
    async createOrder(req, res, next) {
        try {
            const buyerId = req.user.id;
            const { offerId, cryptoAmount, fiatAmount, takerSide, selectedPaymentMethod } = req.body;
            if (!offerId || !cryptoAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'offerId and cryptoAmount are required',
                });
            }
            const order = await p2p_service_1.p2pService.createP2POrder(buyerId, {
                offerId,
                cryptoAmount,
                fiatAmount,
                takerSide,
                selectedPaymentMethod,
            });
            res.status(201).json({
                success: true,
                message: 'Order created successfully. Escrow funds locked.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Seller accepts a PENDING order, unlocking buyer payment details & countdown
     */
    async acceptOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const order = await p2p_service_1.p2pService.acceptOrder(orderId, userId);
            res.json({
                success: true,
                message: 'Order accepted. Payment window started.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Seller declines a PENDING order before buyer payment starts
     */
    async declineOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const reason = req.body?.reason ? String(req.body.reason) : undefined;
            const order = await p2p_service_1.p2pService.declineOrder(orderId, userId, reason);
            res.json({
                success: true,
                message: 'Order declined and escrowed crypto returned.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Cancel an unpaid P2P order and unlock escrowed crypto back to seller
     */
    async cancelOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const reason = req.body?.reason ? String(req.body.reason) : undefined;
            const order = await p2p_service_1.p2pService.cancelOrder(orderId, userId, reason);
            res.json({
                success: true,
                message: 'Order cancelled and escrowed crypto returned to seller.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user P2P orders (Filtered by ongoing, fulfilled, unpaid, paid, dispute)
     */
    async getUserOrders(req, res, next) {
        try {
            const userId = req.user.id;
            const { filter } = req.query;
            const orders = await p2p_service_1.p2pService.getUserOrders(userId, filter);
            res.json({ success: true, data: orders });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user P2P earnings, profits, and commission metrics
     */
    async getUserEarnings(req, res, next) {
        try {
            const userId = req.user.id;
            const earnings = await p2p_service_1.p2pService.getUserP2PEarnings(userId);
            res.json({ success: true, data: earnings });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get single P2P order
     */
    async getOrderById(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const order = await p2p_service_1.p2pService.getOrderById(orderId, userId);
            res.json({ success: true, data: order });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Buyer marks payment as sent with optional receipt image & transaction reference
     */
    async markPaymentSent(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const { proofUrl, paymentReference } = req.body || {};
            const order = await p2p_service_1.p2pService.markPaymentSent(orderId, userId, proofUrl, paymentReference);
            res.json({
                success: true,
                message: 'Payment confirmed. Seller has been notified to release escrow.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Submit post-trade feedback / star rating for counterparty
     */
    async submitOrderReview(req, res, next) {
        try {
            const reviewerId = req.user.id;
            const orderId = req.params.orderId;
            const { rating, comment, isPositive } = req.body || {};
            const review = await p2p_service_1.p2pService.submitOrderReview(orderId, reviewerId, {
                rating,
                comment,
                isPositive,
            });
            res.status(201).json({
                success: true,
                message: 'Feedback submitted successfully.',
                data: review,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Seller releases escrow to buyer
     */
    async releaseEscrow(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const { twoFactorCode } = req.body;
            const order = await p2p_service_1.p2pService.releaseOrderEscrow(orderId, userId, twoFactorCode);
            res.json({
                success: true,
                message: 'Escrow released! Crypto has been credited to the buyer wallet.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin / Staff: Fulfill an AVORA Priority P2P Order directly from client view or admin view (Specifically for INR)
     */
    async fulfillPriorityOrder(req, res, next) {
        try {
            const user = req.user;
            if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'STAFF')) {
                return res.status(403).json({ success: false, message: 'Only Avora Bank Administrators can directly fulfill priority desk orders.' });
            }
            const orderId = req.params.orderId;
            const { releaseNote } = req.body || {};
            const order = await p2p_service_1.p2pService.fulfillPriorityOrder(orderId, user.id, releaseNote);
            res.json({
                success: true,
                message: 'AVORA Priority P2P Order fulfilled! Escrowed crypto released to buyer.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Open Dispute on order
     */
    async disputeOrder(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const { reason } = req.body;
            if (!reason) {
                return res.status(400).json({ success: false, message: 'Dispute reason is required' });
            }
            const order = await p2p_service_1.p2pService.disputeOrder(orderId, userId, reason);
            res.json({
                success: true,
                message: 'Dispute opened. Avora Compliance Officer will step in.',
                data: order,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * In-Order Chat: Get messages
     */
    async getOrderMessages(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const chat = await p2p_service_1.p2pService.getOrderMessages(orderId, userId);
            res.json({ success: true, data: chat });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * In-Order Chat: Send message
     */
    async sendOrderMessage(req, res, next) {
        try {
            const senderId = req.user.id;
            const orderId = req.params.orderId;
            const { message, attachmentUrl } = req.body || {};
            if ((!message || !message.trim()) && !attachmentUrl) {
                return res.status(400).json({ success: false, message: 'Message text or attachment cannot be empty' });
            }
            const msg = await p2p_service_1.p2pService.sendOrderMessage(orderId, senderId, message || '', attachmentUrl);
            res.status(201).json({ success: true, data: msg });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get all active P2P conversations for Chat Hub
     */
    async getUserChats(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const chats = await p2p_service_1.p2pService.getUserChats(userId);
            res.json({ success: true, data: chats });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/p2p/onboarding/apply
     */
    async submitOnboardingApplication(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
            }
            const result = await p2p_service_1.p2pService.submitOnboardingApplication(userId, req.body || {});
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/p2p/onboarding/applications
     */
    async getMyOnboardingApplications(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const apps = await p2p_service_1.p2pService.getMyOnboardingApplications(userId);
            res.json({ success: true, data: apps });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/p2p/merchant/status
     */
    async getMerchantStatus(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const status = await p2p_service_1.p2pService.getP2pMerchantStatus(userId);
            res.json({ success: true, data: status });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/p2p/merchant/deposit
     */
    async applyMerchant(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
            }
            const result = await p2p_service_1.p2pService.applyP2pMerchant(userId);
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/p2p/merchant/refund
     */
    async refundMerchant(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
            }
            const result = await p2p_service_1.p2pService.refundP2pMerchant(userId);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/p2p/corridors
     * Public endpoint returning active Country -> Supported Currencies -> Payment Rails corridors
     */
    async getCorridors(req, res, next) {
        try {
            const corridors = await p2p_service_1.p2pService.getCorridorConfigs();
            res.json({ success: true, data: corridors });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.P2PController = P2PController;
exports.p2pController = new P2PController();
