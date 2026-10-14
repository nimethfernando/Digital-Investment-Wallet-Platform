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
}
exports.P2PController = P2PController;
exports.p2pController = new P2PController();
