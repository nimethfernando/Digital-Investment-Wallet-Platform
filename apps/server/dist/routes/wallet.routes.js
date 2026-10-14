"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const withdrawal_controller_1 = require("../controllers/withdrawal.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.get('/', (req, res, next) => wallet_controller_1.walletController.getWalletOverview(req, res, next));
router.get('/transactions', (req, res, next) => wallet_controller_1.walletController.getTransactions(req, res, next));
router.post('/deposit', (req, res, next) => wallet_controller_1.walletController.submitDeposit(req, res, next));
router.get('/deposits', (req, res, next) => wallet_controller_1.walletController.getDeposits(req, res, next));
router.post('/swap', (req, res, next) => wallet_controller_1.walletController.executeSwap(req, res, next));
// Virtual Card Endpoints
router.get('/card', (req, res, next) => wallet_controller_1.walletController.getCard(req, res, next));
router.post('/card/freeze', (req, res, next) => wallet_controller_1.walletController.toggleCardFreeze(req, res, next));
router.post('/card/limits', (req, res, next) => wallet_controller_1.walletController.updateCardLimits(req, res, next));
router.post('/card/settings', (req, res, next) => wallet_controller_1.walletController.updateCardSettings(req, res, next));
router.get('/card/transactions', (req, res, next) => wallet_controller_1.walletController.getCardTransactions(req, res, next));
// Withdrawal shortcuts under /wallet
router.post('/withdraw', rate_limiter_1.withdrawalRateLimiter, (req, res, next) => withdrawal_controller_1.withdrawalController.requestWithdrawal(req, res, next));
router.get('/withdrawals', (req, res, next) => withdrawal_controller_1.withdrawalController.getWithdrawals(req, res, next));
exports.default = router;
