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
     * Get P2P Ads / Offers
     */
    async getOffers(req, res, next) {
        try {
            const { side, fiatCurrency } = req.query;
            const offers = await p2p_service_1.p2pService.getOffers(side, fiatCurrency);
            res.json({ success: true, data: offers });
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
            const { offerId, cryptoAmount, fiatAmount } = req.body;
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
     * Buyer marks payment as sent
     */
    async markPaymentSent(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const { proofUrl } = req.body;
            const order = await p2p_service_1.p2pService.markPaymentSent(orderId, userId, proofUrl);
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
     * Seller releases escrow to buyer
     */
    async releaseEscrow(req, res, next) {
        try {
            const userId = req.user.id;
            const orderId = req.params.orderId;
            const order = await p2p_service_1.p2pService.releaseOrderEscrow(orderId, userId);
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
            const { message } = req.body;
            if (!message || !message.trim()) {
                return res.status(400).json({ success: false, message: 'Message text cannot be empty' });
            }
            const msg = await p2p_service_1.p2pService.sendOrderMessage(orderId, senderId, message);
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
            const userId = req.user.id;
            const chats = await p2p_service_1.p2pService.getUserChats(userId);
            res.json({ success: true, data: chats });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.P2PController = P2PController;
exports.p2pController = new P2PController();
