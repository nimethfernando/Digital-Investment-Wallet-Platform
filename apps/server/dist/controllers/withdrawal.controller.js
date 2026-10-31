"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawalController = exports.WithdrawalController = void 0;
const withdrawal_service_1 = require("../services/withdrawal.service");
class WithdrawalController {
    /**
     * Submit a new withdrawal request
     * Enforces 24h credential cooldown, optional/mandatory 2FA, 1st-of-month window, and ledger debit
     */
    async requestWithdrawal(req, res, next) {
        try {
            const userId = req.user.id;
            const { withdrawalType, packageId, amount, currency, payoutMethod, payoutDetails, twoFactorCode, } = req.body;
            if (!withdrawalType || !amount || !payoutMethod) {
                return res.status(400).json({
                    success: false,
                    message: 'withdrawalType, amount, and payoutMethod are required fields',
                });
            }
            if (!['MONTHLY_RETURNS', 'PRINCIPAL_RELEASE'].includes(withdrawalType)) {
                return res.status(400).json({
                    success: false,
                    message: 'withdrawalType must be either MONTHLY_RETURNS or PRINCIPAL_RELEASE',
                });
            }
            if (!['BANK_TRANSFER', 'USDT_WALLET', 'CASH_PICKUP_TBILISI'].includes(payoutMethod)) {
                return res.status(400).json({
                    success: false,
                    message: 'payoutMethod must be BANK_TRANSFER, USDT_WALLET, or CASH_PICKUP_TBILISI',
                });
            }
            const result = await withdrawal_service_1.withdrawalService.requestWithdrawal(userId, {
                withdrawalType,
                packageId,
                amount,
                currency: currency || 'USD',
                payoutMethod,
                payoutDetails: payoutDetails || {},
                twoFactorCode,
            });
            res.status(201).json({
                success: true,
                message: 'Withdrawal request submitted successfully. Processing window is ~15 business days.',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get user's withdrawal request history
     */
    async getWithdrawals(req, res, next) {
        try {
            const userId = req.user.id;
            const list = await withdrawal_service_1.withdrawalService.getUserWithdrawals(userId);
            res.json({
                success: true,
                data: list,
                withdrawals: list,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WithdrawalController = WithdrawalController;
exports.withdrawalController = new WithdrawalController();
