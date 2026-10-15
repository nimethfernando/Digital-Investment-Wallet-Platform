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
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const error_1 = require("./middleware/error");
const returns_job_1 = require("./services/returns.job");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((0, cors_1.default)({
    origin: [config_1.config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
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
app.use('/uploads', (req, res, next) => {
    const filePath = path_1.default.join(uploadsDirectory, req.path);
    if (!fs_1.default.existsSync(filePath)) {
        if (req.path.match(/\.(png|jpg|jpeg|svg|webp)$/i)) {
            res.setHeader('Content-Type', 'image/svg+xml');
            return res.send(`
        <svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" fill="#f1f5f9">
          <rect width="300" height="200" fill="#e2e8f0"/>
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#64748b">Avora Bank Asset Placeholder</text>
        </svg>
      `);
        }
    }
    next();
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
// Listen when started directly, with PORT specified, or in non-serverless mode
if (process.env.PORT || (!isServerless && process.env.NODE_ENV !== 'test')) {
    try {
        app.listen(port, () => {
            console.log(`====================================================`);
            console.log(`🚀 Avora Bank Core API Server running on port ${port}`);
            console.log(`📡 Base URL: http://localhost:${port}/api/v1`);
            console.log(`📂 Uploads Volume: ${uploadsDirectory}`);
            console.log(`🔒 Environment: ${config_1.config.nodeEnv}`);
            console.log(`====================================================`);
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
