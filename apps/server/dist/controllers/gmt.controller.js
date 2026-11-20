"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmtController = exports.GlobalMoneyTransferController = void 0;
const gmt_service_1 = require("../services/gmt.service");
class GlobalMoneyTransferController {
    /**
     * GET /api/v1/gmt/countries
     * List supported destination countries
     */
    getCountries(req, res) {
        res.json({ success: true, data: gmt_service_1.DESTINATION_COUNTRIES });
    }
    /**
     * POST /api/v1/gmt/quote
     * Calculate binding exchange rate quote with 2% adjustment & 3% fee
     */
    async calculateQuote(req, res, next) {
        try {
            const { sendingCurrency, sendingAmount, destinationCountryCode, recipientCurrency } = req.body;
            const quote = await gmt_service_1.globalMoneyTransferService.calculateQuote({
                sendingCurrency: sendingCurrency || 'USD',
                sendingAmount: parseFloat(sendingAmount),
                destinationCountryCode: destinationCountryCode || 'IN',
                recipientCurrency: recipientCurrency || 'INR',
            });
            res.json({ success: true, data: quote });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/gmt/transfers
     * Submit and fund a global transfer
     */
    async createTransfer(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const transfer = await gmt_service_1.globalMoneyTransferService.createTransfer(userId, req.body);
            res.status(201).json({
                success: true,
                message: `Global Money Transfer ${transfer.transferCode} initiated successfully!`,
                data: transfer,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/gmt/transfers
     * List user's transfers
     */
    async listUserTransfers(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const transfers = await gmt_service_1.globalMoneyTransferService.listUserTransfers(userId);
            res.json({ success: true, data: transfers });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/gmt/transfers/:code
     * Track specific transfer
     */
    async getTransfer(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const code = Array.isArray(req.params.code) ? req.params.code[0] : String(req.params.code);
            const transfer = await gmt_service_1.globalMoneyTransferService.getTransfer(code, userId);
            res.json({ success: true, data: transfer });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/gmt/track/:code
     * Public live tracking for recipients and senders (No login required)
     */
    async trackTransferPublic(req, res, next) {
        try {
            const code = Array.isArray(req.params.code) ? req.params.code[0] : String(req.params.code);
            const transfer = await gmt_service_1.globalMoneyTransferService.getTransfer(code);
            // Return public-safe tracking view
            res.json({
                success: true,
                data: {
                    transferCode: transfer.transferCode,
                    senderName: transfer.senderName,
                    sendingCurrency: transfer.sendingCurrency,
                    sendingAmount: transfer.sendingAmount,
                    destinationCountry: transfer.destinationCountry,
                    destinationCountryCode: transfer.destinationCountryCode,
                    recipientCurrency: transfer.recipientCurrency,
                    recipientAmount: transfer.recipientAmount,
                    recipientName: transfer.recipientName,
                    recipientBankName: transfer.recipientBankName,
                    recipientAccountMasked: `****${transfer.recipientAccount.slice(-4)}`,
                    effectiveRate: transfer.effectiveRate,
                    status: transfer.status,
                    estimatedDeliveryDate: transfer.estimatedDeliveryDate,
                    trackingTimeline: transfer.trackingTimeline,
                    createdAt: transfer.createdAt,
                },
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/gmt/admin/transfers
     * Admin: List all transfers
     */
    async listAllTransfersAdmin(req, res, next) {
        try {
            const status = req.query.status;
            const transfers = await gmt_service_1.globalMoneyTransferService.listAllTransfersAdmin(status);
            res.json({ success: true, data: transfers });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PATCH /api/v1/gmt/admin/transfers/:id
     * Admin: Update transfer status
     */
    async updateTransferStatusAdmin(req, res, next) {
        try {
            const adminUserId = req.user?.id || req.user?.userId || 'ADMIN';
            const { status, notes, complianceNotes, rejectionReason } = req.body;
            const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
            const updated = await gmt_service_1.globalMoneyTransferService.updateTransferStatusAdmin(id, status, complianceNotes ?? notes, { rejectionReason, adminUserId });
            res.json({ success: true, message: `Transfer status updated to ${updated.status}`, data: updated });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.GlobalMoneyTransferController = GlobalMoneyTransferController;
exports.gmtController = new GlobalMoneyTransferController();
