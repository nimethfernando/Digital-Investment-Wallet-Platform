"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middleware/error");
const returns_job_1 = require("./services/returns.job");
const p2p_service_1 = require("./services/p2p.service");
const compliancePolicy_service_1 = require("./services/compliancePolicy.service");
const bscDepositMonitor_service_1 = require("./services/bscDepositMonitor.service");
const storage_service_1 = require("./services/storage.service");
const prisma_1 = require("./lib/prisma");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
const configuredOrigins = (config_1.config.corsOrigin || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
const defaultOrigins = [
    'https://www.avorabank.com',
    'https://avorabank.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];
const allAllowedOrigins = new Set([...configuredOrigins, ...defaultOrigins]);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow server-to-server, curl, mobile apps, or webhooks without origin
        if (!origin)
            return callback(null, true);
        if (config_1.config.corsOrigin === '*' || allAllowedOrigins.has(origin)) {
            return callback(null, true);
        }
        // Allow subdomains of avorabank.com
        if (/^https?:\/\/([a-zA-Z0-9-]+\.)*avorabank\.com$/i.test(origin)) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)('dev'));
const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDirectory = isServerless
    ? path_1.default.join('/tmp', 'uploads')
    : path_1.default.resolve(config_1.config.uploadDir);
try {
    if (!fs_1.default.existsSync(uploadsDirectory)) {
        fs_1.default.mkdirSync(uploadsDirectory, { recursive: true });
    }
}
catch (err) {
    console.warn('[Server] Note on uploads directory creation:', err);
}
app.use(['/uploads', '/api/v1/uploads', '/api/uploads'], async (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    try {
        const safeRelPath = path_1.default.posix.normalize(req.path || '/');
        if (safeRelPath.includes('..')) {
            return res.status(400).json({ success: false, message: 'Invalid upload path' });
        }
        const isPublicBrandAsset = safeRelPath.startsWith('/branding/') || safeRelPath.startsWith('/brochures/');
        // Sensitive documents & payment proofs require authenticated Admin/Staff or authorized token
        if (!isPublicBrandAsset) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            const authHeader = req.headers['authorization'];
            const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
            if (!bearerToken) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required. Private documents are not accessible via public URLs.',
                });
            }
            let payload = null;
            try {
                try {
                    payload = jsonwebtoken_1.default.verify(bearerToken, config_1.config.jwtSecret);
                }
                catch {
                    payload = jsonwebtoken_1.default.verify(bearerToken, config_1.config.adminJwtSecret);
                }
            }
            catch {
                return res.status(403).json({ success: false, message: 'Invalid or expired access token.' });
            }
            const actor = await prisma_1.prisma.user.findUnique({
                where: { id: payload.userId },
                select: { id: true, role: true, status: true },
            });
            if (!actor || actor.status !== 'ACTIVE') {
                return res.status(403).json({ success: false, message: 'Unauthorized account status.' });
            }
            const isAdminOrStaff = actor.role === 'ADMIN' || actor.role === 'STAFF';
            // Strictly block non-admin access to KYC / documents directory via direct upload URLs
            if (!isAdminOrStaff && safeRelPath.includes('/kyc')) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: KYC documents are restricted to authorized compliance personnel.',
                });
            }
            if (!isAdminOrStaff) {
                // Non-admin authenticated users may only access receipts attached to their own P2P orders
                const urlPathCheck = `/uploads${safeRelPath.startsWith('/') ? safeRelPath : `/${safeRelPath}`}`;
                const ownedProof = await prisma_1.prisma.p2POrder
                    .findFirst({
                    where: {
                        paymentProofUrl: { contains: path_1.default.basename(safeRelPath) },
                        OR: [{ buyerId: actor.id }, { sellerId: actor.id }],
                    },
                    select: { id: true },
                })
                    .catch(() => null);
                const ownedKyc = await prisma_1.prisma.kycDocument
                    .findFirst({
                    where: { userId: actor.id, documentUrl: { contains: path_1.default.basename(safeRelPath) } },
                    select: { id: true },
                })
                    .catch(() => null);
                if (!ownedProof && !ownedKyc && !urlPathCheck.includes(actor.id)) {
                    return res.status(403).json({
                        success: false,
                        message: 'Forbidden: You do not have permission to access this private document.',
                    });
                }
            }
        }
        const filePath = path_1.default.join(uploadsDirectory, safeRelPath);
        if (fs_1.default.existsSync(filePath)) {
            return next();
        }
        const urlPath = `/uploads${safeRelPath.startsWith('/') ? safeRelPath : `/${safeRelPath}`}`;
        const persisted = await (0, storage_service_1.getPersistedUploadedAsset)(urlPath);
        if (persisted) {
            fs_1.default.promises
                .mkdir(path_1.default.dirname(filePath), { recursive: true })
                .then(() => fs_1.default.promises.writeFile(filePath, persisted.buffer))
                .catch(() => { });
            res.setHeader('Content-Type', persisted.mimeType);
            res.setHeader('Cache-Control', isPublicBrandAsset ? 'public, max-age=86400' : 'no-store, no-cache, must-revalidate, private');
            return res.send(persisted.buffer);
        }
        // Fallback for legacy or archived uploads (only for authenticated authorized requests, never unauthenticated!)
        const filename = path_1.default.basename(safeRelPath);
        const ext = path_1.default.extname(filename).toLowerCase();
        const isImageOrDoc = !isPublicBrandAsset &&
            (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.pdf', '.bmp', '.ico'].includes(ext) ||
                Boolean(req.headers.accept && (req.headers.accept.includes('image/') || req.headers.accept.includes('text/html'))));
        if (isImageOrDoc) {
            let orderMeta = null;
            try {
                const orderMatch = await prisma_1.prisma.p2POrder.findFirst({
                    where: {
                        OR: [
                            { paymentProofUrl: { contains: filename } },
                            { paymentReference: { contains: filename.replace(/\.[^/.]+$/, '') } },
                        ],
                    },
                    select: {
                        orderCode: true,
                        fiatAmount: true,
                        fiatCurrency: true,
                        cryptoAmount: true,
                        cryptoCurrency: true,
                        paymentReference: true,
                        selectedPaymentMethod: true,
                        status: true,
                        createdAt: true,
                    },
                });
                if (orderMatch) {
                    orderMeta = {
                        orderCode: orderMatch.orderCode,
                        fiatAmount: `${orderMatch.fiatAmount} ${orderMatch.fiatCurrency}`,
                        cryptoAmount: `${orderMatch.cryptoAmount} ${orderMatch.cryptoCurrency}`,
                        paymentReference: orderMatch.paymentReference,
                        paymentRail: orderMatch.selectedPaymentMethod,
                        status: orderMatch.status,
                        dateStr: orderMatch.createdAt ? new Date(orderMatch.createdAt).toUTCString() : undefined,
                    };
                }
            }
            catch { }
            const svgContent = (0, storage_service_1.generateArchivedDocumentSvg)(filename, urlPath, orderMeta);
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            return res.send(Buffer.from(svgContent, 'utf-8'));
        }
        return res.status(404).json({ success: false, message: 'Uploaded document file not found' });
    }
    catch (err) {
        return next(err);
    }
}, express_1.default.static(uploadsDirectory));
// Robust Health & Diagnostic Endpoint (runs without requiring DB access)
app.get(['/health', '/api/health', '/api/v1/health'], (req, res) => {
    res.json({
        status: 'HEALTHY',
        service: 'Avora Bank Core API Engine',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        isServerless,
        databaseConfigured: Boolean(process.env.DATABASE_URL),
    });
});
app.use('/api/v1', routes_1.default);
app.use('/v1', routes_1.default);
app.use('/api', routes_1.default);
app.use('/', routes_1.default);
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});
app.use(error_1.errorHandler);
const port = process.env.PORT || config_1.config.port || 5000;
// Listen when started directly in non-test, non-serverless mode (or when PORT is configured outside tests)
if (process.env.NODE_ENV !== 'test' && (process.env.PORT || !isServerless)) {
    try {
        app.listen(port, () => {
            console.log(`====================================================`);
            console.log(`🚀 Avora Bank Core API Server running on port ${port}`);
            console.log(`📡 Base URL: http://localhost:${port}/api/v1`);
            console.log(`📂 Uploads Volume: ${uploadsDirectory}`);
            console.log(`🔒 Environment: ${config_1.config.nodeEnv}`);
            console.log(`====================================================`);
            // Non-destructively verify non-breaking schema extensions (e.g. displayName column) on boot
            p2p_service_1.p2pService.ensureP2PReady().catch(() => { });
            (0, storage_service_1.ensureUploadedAssetTable)().catch(() => { });
            compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema().catch(() => { });
            bscDepositMonitor_service_1.bscDepositMonitorService
                .ensureDepositSchema()
                .then(() => bscDepositMonitor_service_1.bscDepositMonitorService.startBackgroundMonitor(10_000))
                .catch(() => { });
            // Register automated financial background cron jobs
            returns_job_1.returnsJobService.startScheduler();
        });
    }
    catch (err) {
        console.warn('[Server] Listen notice:', err.message);
    }
}
const handler = (req, res) => {
    return app(req, res);
};
exports.default = handler;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = handler;
    module.exports.default = handler;
    module.exports.app = app;
}
