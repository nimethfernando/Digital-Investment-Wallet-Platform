"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const p2p_controller_1 = require("../controllers/p2p.controller");
const auth_1 = require("../middleware/auth");
const rate_limiter_1 = require("../middleware/rate-limiter");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
/**
 * Preview recipient details with email masking & self-transfer block
 */
router.post(['/lookup-recipient', '/lookup'], rate_limiter_1.p2pRateLimiter, (req, res, next) => p2p_controller_1.p2pController.lookupRecipient(req, res, next));
/**
 * Execute P2P transfer with daily velocity limit ($5,000/24h) and 2FA
 */
router.post('/transfer', rate_limiter_1.p2pRateLimiter, (req, res, next) => p2p_controller_1.p2pController.transferFunds(req, res, next));
/**
 * P2P Offers / Market Ads
 */
router.get('/offers', (req, res, next) => p2p_controller_1.p2pController.getOffers(req, res, next));
/**
 * P2P Orders & Escrow
 */
router.post('/orders', (req, res, next) => p2p_controller_1.p2pController.createOrder(req, res, next));
router.get('/orders', (req, res, next) => p2p_controller_1.p2pController.getUserOrders(req, res, next));
router.get('/orders/:orderId', (req, res, next) => p2p_controller_1.p2pController.getOrderById(req, res, next));
router.post('/orders/:orderId/paid', (req, res, next) => p2p_controller_1.p2pController.markPaymentSent(req, res, next));
router.post('/orders/:orderId/release', (req, res, next) => p2p_controller_1.p2pController.releaseEscrow(req, res, next));
router.post('/orders/:orderId/dispute', (req, res, next) => p2p_controller_1.p2pController.disputeOrder(req, res, next));
/**
 * In-Order Live Chat
 */
router.get('/orders/:orderId/messages', (req, res, next) => p2p_controller_1.p2pController.getOrderMessages(req, res, next));
router.post('/orders/:orderId/messages', (req, res, next) => p2p_controller_1.p2pController.sendOrderMessage(req, res, next));
/**
 * User P2P Conversations Hub
 */
router.get('/chats', (req, res, next) => p2p_controller_1.p2pController.getUserChats(req, res, next));
exports.default = router;
