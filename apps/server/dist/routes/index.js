"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const cms_routes_1 = __importDefault(require("./cms.routes"));
const upload_routes_1 = __importDefault(require("./upload.routes"));
const wallet_routes_1 = __importDefault(require("./wallet.routes"));
const package_routes_1 = __importDefault(require("./package.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const p2p_routes_1 = __importDefault(require("./p2p.routes"));
const otc_routes_1 = __importDefault(require("./otc.routes"));
const withdrawal_routes_1 = __importDefault(require("./withdrawal.routes"));
const ticket_routes_1 = __importDefault(require("./ticket.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/cms', cms_routes_1.default);
router.use('/upload', upload_routes_1.default);
router.use('/wallet', wallet_routes_1.default);
router.use('/packages', package_routes_1.default);
router.use('/admin', admin_routes_1.default);
router.use('/p2p', p2p_routes_1.default);
router.use('/otc', otc_routes_1.default);
router.use('/withdrawals', withdrawal_routes_1.default);
router.use('/tickets', ticket_routes_1.default);
router.get('/health', (req, res) => {
    res.json({
        status: 'HEALTHY',
        service: 'Avora Bank Core API Engine',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
exports.default = router;
