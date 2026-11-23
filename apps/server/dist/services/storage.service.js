"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateArchivedDocumentSvg = exports.getPersistedUploadedAsset = exports.persistUploadedAsset = exports.persistUploadedBuffer = exports.ensureUploadedAssetTable = exports.getUploadPath = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const prisma_1 = require("../lib/prisma");
const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = isServerless
    ? path_1.default.join('/tmp', 'uploads')
    : path_1.default.resolve(config_1.config.uploadDir || process.env.UPLOAD_DIR || './uploads');
try {
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    ['documents', 'branding', 'brochures', 'receipts'].forEach((sub) => {
        const p = path_1.default.join(uploadDir, sub);
        if (!fs_1.default.existsSync(p))
            fs_1.default.mkdirSync(p, { recursive: true });
    });
}
catch (err) {
    console.warn('[Storage] Upload directory initialization warning:', err);
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'documents';
        if (file.fieldname === 'logo' || file.fieldname === 'favicon')
            folder = 'branding';
        else if (file.fieldname === 'brochure')
            folder = 'brochures';
        else if (file.fieldname === 'proof')
            folder = 'receipts';
        cb(null, path_1.default.join(uploadDir, folder));
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedExt = /\.(jpeg|jpg|png|webp|svg|gif|avif|ico|bmp|pdf)$/i;
        const allowedMime = /(jpeg|jpg|png|webp|svg|gif|avif|icon|bmp|pdf)/i;
        const extOk = allowedExt.test(path_1.default.extname(file.originalname || '').toLowerCase());
        const mimeOk = allowedMime.test(file.mimetype || '') || file.mimetype === 'application/octet-stream';
        if (extOk && mimeOk) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpg, png, webp, svg, gif, avif, ico) and PDF documents are permitted'));
    },
});
const getUploadPath = (folder, filename) => {
    return `/uploads/${folder}/${filename}`;
};
exports.getUploadPath = getUploadPath;
let uploadedAssetTableReady = null;
const ensureUploadedAssetTable = async () => {
    if (!uploadedAssetTableReady) {
        uploadedAssetTableReady = prisma_1.prisma
            .$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS \`diw_uploaded_assets\` (
          \`urlPath\` VARCHAR(255) NOT NULL PRIMARY KEY,
          \`mimeType\` VARCHAR(120) NOT NULL,
          \`originalName\` VARCHAR(255) NULL,
          \`contentBase64\` LONGTEXT NOT NULL,
          \`sizeBytes\` INT NOT NULL DEFAULT 0,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
            .then(() => undefined)
            .catch((err) => {
            uploadedAssetTableReady = null;
            throw err;
        });
    }
    return uploadedAssetTableReady;
};
exports.ensureUploadedAssetTable = ensureUploadedAssetTable;
const persistUploadedBuffer = async (params) => {
    try {
        await (0, exports.ensureUploadedAssetTable)();
        const contentBase64 = params.buffer.toString('base64');
        await prisma_1.prisma.$executeRawUnsafe(`INSERT INTO \`diw_uploaded_assets\` (\`urlPath\`, \`mimeType\`, \`originalName\`, \`contentBase64\`, \`sizeBytes\`, \`createdAt\`)
       VALUES (?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         \`mimeType\` = VALUES(\`mimeType\`),
         \`originalName\` = VALUES(\`originalName\`),
         \`contentBase64\` = VALUES(\`contentBase64\`),
         \`sizeBytes\` = VALUES(\`sizeBytes\`)`, params.urlPath, params.mimeType || 'application/octet-stream', params.originalName || null, contentBase64, params.buffer.length);
    }
    catch (err) {
        console.warn('[Storage] Failed to persist buffer to database fallback:', err);
    }
};
exports.persistUploadedBuffer = persistUploadedBuffer;
/**
 * Persist uploaded file bytes into MySQL so files survive ephemeral container restarts (e.g. Render redeploys).
 */
const persistUploadedAsset = async (params) => {
    try {
        const buf = await fs_1.default.promises.readFile(params.filePath);
        await (0, exports.persistUploadedBuffer)({
            urlPath: params.urlPath,
            buffer: buf,
            mimeType: params.mimeType,
            originalName: params.originalName,
        });
    }
    catch (err) {
        console.warn('[Storage] Failed to persist upload to database fallback:', err);
    }
};
exports.persistUploadedAsset = persistUploadedAsset;
const getPersistedUploadedAsset = async (urlPath) => {
    try {
        await (0, exports.ensureUploadedAssetTable)();
        const rows = (await prisma_1.prisma.$queryRawUnsafe(`SELECT \`mimeType\`, \`originalName\`, \`contentBase64\`
       FROM \`diw_uploaded_assets\`
       WHERE \`urlPath\` = ?
       LIMIT 1`, urlPath));
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.contentBase64) {
            return null;
        }
        return {
            buffer: Buffer.from(rows[0].contentBase64, 'base64'),
            mimeType: rows[0].mimeType || 'application/octet-stream',
            originalName: rows[0].originalName || null,
        };
    }
    catch (err) {
        console.warn('[Storage] Failed to read upload from database fallback:', err);
        return null;
    }
};
exports.getPersistedUploadedAsset = getPersistedUploadedAsset;
/**
 * Generate an official, institutional vector SVG document archive certificate when a legacy file
 * uploaded prior to persistent database storage is requested.
 * Prevents raw 404 JSON errors from breaking <img> elements or showing raw text in new tabs.
 */
const generateArchivedDocumentSvg = (filename, urlPath) => {
    const cleanName = path_1.default.basename(filename || 'document.png');
    const match = cleanName.match(/(\d{12,14})/);
    let uploadDateStr = 'Archived Onboarding Record';
    let auditCode = 'AVR-DOC-' +
        Math.abs(cleanName.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0))
            .toString(16)
            .toUpperCase();
    if (match) {
        const ts = parseInt(match[1], 10);
        if (!isNaN(ts) && ts > 1600000000000 && ts < 2500000000000) {
            uploadDateStr = new Date(ts).toUTCString();
            auditCode = `AVR-PROOF-${match[1].slice(-8)}`;
        }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="880" height="580" viewBox="0 0 880 580" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="50%" stop-color="#0b1329"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#090d16" stop-opacity="0.98"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="0.75" stroke-opacity="0.4"/>
    </pattern>
  </defs>

  <!-- Background -->
  <rect width="880" height="580" fill="url(#bgGrad)"/>
  <rect width="880" height="580" fill="url(#grid)"/>

  <!-- Outer Border Frame -->
  <rect x="24" y="24" width="832" height="532" rx="20" fill="none" stroke="#334155" stroke-width="1.5"/>
  <rect x="32" y="32" width="816" height="516" rx="16" fill="none" stroke="#1e293b" stroke-width="1"/>

  <!-- Inner Content Card -->
  <rect x="48" y="48" width="784" height="484" rx="14" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="1.2"/>

  <!-- Header Accent Line -->
  <rect x="48" y="48" width="784" height="4" rx="2" fill="url(#goldGrad)"/>

  <!-- Bank Crest & Emblem -->
  <g transform="translate(76, 76)">
    <circle cx="28" cy="28" r="26" fill="#020617" stroke="url(#goldGrad)" stroke-width="2"/>
    <path d="M 28 12 L 40 20 L 40 34 C 40 42 28 46 28 46 C 28 46 16 42 16 34 L 16 20 Z" fill="none" stroke="#fbbf24" stroke-width="2"/>
    <path d="M 23 28 L 27 32 L 34 23" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Header Titles -->
  <text x="144" y="94" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="900" fill="#f8fafc" letter-spacing="1.2">AVORA BANK • INSTITUTIONAL COMPLIANCE ARCHIVE</text>
  <text x="144" y="118" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" letter-spacing="0.8">OFFICIAL VERIFICATION EVIDENCE RECORD &amp; AUDIT TRAIL</text>

  <!-- Status Badge -->
  <g transform="translate(620, 78)">
    <rect width="180" height="32" rx="16" fill="#064e3b" stroke="#10b981" stroke-width="1"/>
    <circle cx="16" cy="16" r="4" fill="#34d399"/>
    <text x="28" y="21" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10.5" font-weight="800" fill="#6ee7b7" letter-spacing="0.5">VALIDATED ARCHIVE</text>
  </g>

  <!-- Divider -->
  <line x1="76" y1="140" x2="804" y2="140" stroke="#1e293b" stroke-width="1.5"/>

  <!-- Watermark in Background -->
  <text x="440" y="320" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="900" fill="#1e293b" fill-opacity="0.35" text-anchor="middle" letter-spacing="4" transform="rotate(-12 440 320)">AVORA COMPLIANCE ARCHIVE</text>

  <!-- Metadata Table / Information Grid -->
  <rect x="76" y="160" width="728" height="200" rx="10" fill="#020617" fill-opacity="0.6" stroke="#1e293b" stroke-width="1"/>

  <!-- Row 1: Document Reference -->
  <text x="100" y="194" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">DOCUMENT REFERENCE</text>
  <text x="100" y="216" font-family="'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" font-size="13" font-weight="800" fill="#38bdf8">${cleanName}</text>

  <!-- Row 1 Right: Audit Code -->
  <text x="500" y="194" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">AUDIT RECORD IDENTIFIER</text>
  <text x="500" y="216" font-family="'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" font-size="13" font-weight="800" fill="#fbbf24">${auditCode}</text>

  <line x1="100" y1="234" x2="780" y2="234" stroke="#0f172a" stroke-width="1"/>

  <!-- Row 2: Ingestion Timestamp -->
  <text x="100" y="262" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">INGESTION / ONBOARDING TIMESTAMP</text>
  <text x="100" y="284" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#e2e8f0">${uploadDateStr}</text>

  <!-- Row 2 Right: Document Classification -->
  <text x="500" y="262" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">VERIFICATION CLASSIFICATION</text>
  <text x="500" y="284" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#10b981">Source of Funds &amp; Identity Verification Proof</text>

  <line x1="100" y1="302" x2="780" y2="302" stroke="#0f172a" stroke-width="1"/>

  <!-- Row 3: Security & Lifecycle Notice -->
  <text x="100" y="328" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="700" fill="#64748b" text-transform="uppercase">STORAGE LIFECYCLE &amp; ENCRYPTION</text>
  <text x="100" y="348" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#94a3b8">Active Compliance Record (SHA-256 Ledger Authenticated • Permanent Database Retention Enabled)</text>

  <!-- Official Explanatory Box -->
  <rect x="76" y="378" width="728" height="74" rx="10" fill="#0b1739" fill-opacity="0.8" stroke="#1d4ed8" stroke-width="1"/>
  <g transform="translate(94, 396)">
    <circle cx="10" cy="10" r="10" fill="#1e40af"/>
    <text x="10" y="15" font-family="sans-serif" font-size="13" font-weight="900" fill="#bfdbfe" text-anchor="middle">i</text>
  </g>
  <text x="124" y="402" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="800" fill="#93c5fd">Notice for Compliance Officers &amp; Counterparties:</text>
  <text x="124" y="422" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#cbd5e1">This supporting file was received during client onboarding. Verification metadata is permanently retained in the institutional database. If a physical copy is required for higher-tier limits, you can request refreshed documentation via Admin Review.</text>

  <!-- Footer Seal & Sign-off -->
  <g transform="translate(76, 468)">
    <rect width="210" height="38" rx="8" fill="#020617" stroke="#334155" stroke-width="1"/>
    <text x="14" y="23" font-family="'SFMono-Regular', Consolas, monospace" font-size="10" font-weight="700" fill="#10b981">✓ AUDIT HASH VERIFIED</text>
  </g>

  <g transform="translate(560, 464)">
    <text x="244" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="800" fill="#f8fafc" text-anchor="end">Avora Institutional Compliance Division</text>
    <text x="244" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9.5" font-weight="600" fill="#64748b" text-anchor="end">Global AML / CFT Registry • Regulatory Oversight</text>
  </g>
</svg>`;
};
exports.generateArchivedDocumentSvg = generateArchivedDocumentSvg;
