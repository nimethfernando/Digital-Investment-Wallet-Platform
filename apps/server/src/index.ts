import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { config } from './config';
import routes from './routes';
import { errorHandler } from './middleware/error';
import { returnsJobService } from './services/returns.job';
import { p2pService } from './services/p2p.service';
import { compliancePolicyService } from './services/compliancePolicy.service';
import { bscDepositMonitorService } from './services/bscDepositMonitor.service';
import { getPersistedUploadedAsset, generateArchivedDocumentSvg, ensureUploadedAssetTable } from './services/storage.service';
import { prisma } from './lib/prisma';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
  frameguard: false,
}));

const configuredOrigins = (config.corsOrigin || '')
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

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server, curl, mobile apps, or webhooks without origin
    if (!origin) return callback(null, true);
    if (config.corsOrigin === '*' || allAllowedOrigins.has(origin)) {
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

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadsDirectory = isServerless
  ? path.join('/tmp', 'uploads')
  : path.resolve(config.uploadDir);

try {
  if (!fs.existsSync(uploadsDirectory)) {
    fs.mkdirSync(uploadsDirectory, { recursive: true });
  }
} catch (err) {
  console.warn('[Server] Note on uploads directory creation:', err);
}

app.use(['/uploads', '/api/v1/uploads', '/api/uploads'], async (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);

  try {
    const safeRelPath = path.posix.normalize(req.path || '/');
    if (safeRelPath.includes('..')) {
      return res.status(400).json({ success: false, message: 'Invalid upload path' });
    }

    const isPublicBrandAsset =
      safeRelPath.startsWith('/branding/') || safeRelPath.startsWith('/brochures/');

    // Sensitive documents & payment proofs require authenticated Admin/Staff or authorized token
    if (!isPublicBrandAsset) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const authHeader = req.headers['authorization'];
      const headerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      const queryToken = typeof req.query?.token === 'string' && req.query.token.trim() ? req.query.token.trim() : null;
      const cookieToken =
        (typeof req.cookies?.avora_token === 'string' && req.cookies.avora_token.trim()) ||
        (typeof req.cookies?.token === 'string' && req.cookies.token.trim()) ||
        null;
      const bearerToken = headerToken || queryToken || cookieToken;
      if (!bearerToken) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Private documents are not accessible via public URLs.',
        });
      }

      let payload: any = null;
      try {
        try {
          payload = jwt.verify(bearerToken, config.jwtSecret);
        } catch {
          payload = jwt.verify(bearerToken, config.adminJwtSecret);
        }
      } catch {
        return res.status(403).json({ success: false, message: 'Invalid or expired access token.' });
      }

      const actor = await prisma.user.findUnique({
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
        const ownedProof = await prisma.p2POrder
          .findFirst({
            where: {
              paymentProofUrl: { contains: path.basename(safeRelPath) },
              OR: [{ buyerId: actor.id }, { sellerId: actor.id }],
            },
            select: { id: true },
          })
          .catch(() => null);
        const ownedKyc = await prisma.kycDocument
          .findFirst({
            where: { userId: actor.id, documentUrl: { contains: path.basename(safeRelPath) } },
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

    const filePath = path.join(uploadsDirectory, safeRelPath);
    if (fs.existsSync(filePath)) {
      return next();
    }

    const urlPath = `/uploads${safeRelPath.startsWith('/') ? safeRelPath : `/${safeRelPath}`}`;
    const persisted = await getPersistedUploadedAsset(urlPath);
    if (persisted) {
      fs.promises
        .mkdir(path.dirname(filePath), { recursive: true })
        .then(() => fs.promises.writeFile(filePath, persisted.buffer))
        .catch(() => {});
      res.setHeader('Content-Type', persisted.mimeType);
      res.setHeader(
        'Cache-Control',
        isPublicBrandAsset ? 'public, max-age=86400' : 'no-store, no-cache, must-revalidate, private'
      );
      return res.send(persisted.buffer);
    }

    // Fallback for legacy or archived uploads (only for authenticated authorized requests, never unauthenticated!)
    const filename = path.basename(safeRelPath);
    const ext = path.extname(filename).toLowerCase();
    const isImageOrDoc =
      !isPublicBrandAsset &&
      (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.pdf', '.bmp', '.ico'].includes(ext) ||
        Boolean(req.headers.accept && (req.headers.accept.includes('image/') || req.headers.accept.includes('text/html'))));

    if (isImageOrDoc) {
      let orderMeta: any = null;
      try {
        const orderMatch = await prisma.p2POrder.findFirst({
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
      } catch {}

      const svgContent = generateArchivedDocumentSvg(filename, urlPath, orderMeta);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      return res.send(Buffer.from(svgContent, 'utf-8'));
    }

    return res.status(404).json({ success: false, message: 'Uploaded document file not found' });
  } catch (err) {
    return next(err);
  }
}, express.static(uploadsDirectory));

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

app.use('/api/v1', routes);
app.use('/v1', routes);
app.use('/api', routes);
app.use('/', routes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use(errorHandler);

const port = process.env.PORT || config.port || 5000;

// Listen when started directly in non-test, non-serverless mode (or when PORT is configured outside tests)
if (process.env.NODE_ENV !== 'test' && (process.env.PORT || !isServerless)) {
  try {
    app.listen(port, () => {
      console.log(`====================================================`);
      console.log(`🚀 Avora Bank Core API Server running on port ${port}`);
      console.log(`📡 Base URL: http://localhost:${port}/api/v1`);
      console.log(`📂 Uploads Volume: ${uploadsDirectory}`);
      console.log(`🔒 Environment: ${config.nodeEnv}`);
      console.log(`====================================================`);
      
      // Non-destructively verify non-breaking schema extensions (e.g. displayName column) on boot
      p2pService.ensureP2PReady().catch(() => {});
      ensureUploadedAssetTable().catch(() => {});
      compliancePolicyService.ensureComplianceSchema().catch(() => {});
      bscDepositMonitorService
        .ensureDepositSchema()
        .then(() => bscDepositMonitorService.startBackgroundMonitor(10_000))
        .catch(() => {});

      // Register automated financial background cron jobs
      returnsJobService.startScheduler();
    });
  } catch (err: any) {
    console.warn('[Server] Listen notice:', err.message);
  }
}

const handler = (req: any, res: any) => {
  return app(req, res);
};

export default handler;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  (module.exports as any).default = handler;
  (module.exports as any).app = app;
}
